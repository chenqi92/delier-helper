<template>
  <div style="display:flex;flex-direction:column;height:100%;">
    <!-- 头部操作栏 -->
    <div class="view-header">
      <div class="header-actions">
        <span v-if="loading" style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:12px;">
          <span class="spinner"></span> {{ loadingText }}
        </span>
        <span v-else-if="schema" style="font-size:12px;color:var(--success-500);">
          <Check :size="12" /> {{ schema.tables.length }} 个表，{{ schema.columns.length }} 个字段
        </span>
        <div class="db-view-switcher" v-if="schema">
          <button :class="['db-view-btn', { active: viewMode === 'table' }]" @click="viewMode = 'table'">
            <Database :size="12" /> 数据字典
          </button>
          <button :class="['db-view-btn', { active: viewMode === 'er' }]" @click="viewMode = 'er'">
            <GitBranch :size="12" /> 关系图
          </button>
          <button :class="['db-view-btn', { active: viewMode === 'relation' }]" @click="viewMode = 'relation'">
            <Link :size="12" /> 实体图
          </button>
        </div>
        <div class="ai-fill-group" v-if="schema">
          <button v-if="!aiProcessing" class="btn btn-primary btn-sm" @click="startAiFill">
            <Bot :size="14" /> AI 补充
          </button>
          <template v-else>
            <span class="btn btn-sm" style="font-size:11px;color:var(--primary-300);pointer-events:none;">
              <span class="spinner" style="width:12px;height:12px;"></span>
              {{ aiProgressText }}
            </span>
            <button v-if="!aiController?.paused" class="btn btn-secondary btn-sm" @click="aiController?.pause()" title="暂停">⏸ 暂停</button>
            <button v-else class="btn btn-primary btn-sm" @click="aiController?.resume()" title="继续">▶ 继续</button>
            <button class="btn btn-danger btn-sm" @click="aiController?.cancel()" title="取消">✕ 取消</button>
          </template>
          <select v-if="aiConfigs.length > 1" class="ai-model-select" v-model="selectedConfigId" :disabled="aiProcessing">
            <option v-for="c in aiConfigs" :key="c.id" :value="c.id">{{ c.name || c.model }}</option>
          </select>
        </div>
        <button v-if="viewMode === 'table'" class="btn btn-primary btn-sm" @click="exportMarkdown" :disabled="!schema">
          <FileText :size="14" /> 导出 Markdown
        </button>
        <button v-if="viewMode === 'table'" class="btn btn-primary btn-sm" @click="exportWord" :disabled="!schema">
          <FileDown :size="14" /> 导出 Word
        </button>
        <button v-if="viewMode === 'er'" class="btn btn-primary btn-sm" @click="openExportDialog('er')" :disabled="!schema">
          <Download :size="14" /> 导出 SVG
        </button>
        <button v-if="viewMode === 'relation'" class="btn btn-primary btn-sm" @click="openExportDialog('relation')" :disabled="!schema">
          <Download :size="14" /> 批量导出
        </button>
      </div>
    </div>

    <!-- AI 日志面板 -->
    <div v-if="aiLogs.length > 0" class="ai-log-panel" ref="aiLogPanel">
      <div v-for="(log, i) in aiLogs" :key="i" :class="['ai-log-item', 'ai-log-' + log.level]">
        <span class="ai-log-time">{{ log.time }}</span>
        <span>{{ log.msg }}</span>
      </div>
    </div>

    <!-- 主体 -->
    <div class="app-body">
      <!-- 左侧配置面板 -->
      <aside class="config-panel">
        <!-- 连接配置 -->
        <div class="card">
          <div class="card-header">
            <h3><Database :size="14" /> 数据库连接</h3>
            <span v-if="connStatus === 'connected'" class="conn-dot connected" title="已连接"></span>
            <span v-else-if="connStatus === 'error'" class="conn-dot error" title="连接失败"></span>
          </div>
          <div class="card-body">
            <!-- 数据库类型 -->
            <div class="form-group">
              <label class="form-label">数据库类型</label>
              <select class="form-input" v-model="config.db_type" @change="onDbTypeChange">
                <option v-for="t in dbTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>

            <!-- 主机 & 端口 -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">主机</label>
                <input type="text" class="form-input" v-model="config.host" placeholder="localhost" />
              </div>
              <div class="form-group" style="max-width:90px;">
                <label class="form-label">端口</label>
                <input type="number" class="form-input" v-model.number="config.port" />
              </div>
            </div>

            <!-- 用户 & 密码 -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">用户名</label>
                <input type="text" class="form-input" v-model="config.username" placeholder="root" />
              </div>
              <div class="form-group">
                <label class="form-label">密码</label>
                <input type="password" class="form-input" v-model="config.password" placeholder="密码" />
              </div>
            </div>

            <!-- 数据库名 -->
            <div class="form-group">
              <label class="form-label">数据库名 <span style="color:var(--text-muted);font-weight:400;">(可连接后选择)</span></label>
              <div v-if="availableDatabases.length > 0" style="display:flex;gap:4px;">
                <select class="form-input" v-model="config.database" style="flex:1;">
                  <option value="">请选择数据库...</option>
                  <option v-for="db in availableDatabases" :key="db" :value="db">{{ db }}</option>
                </select>
              </div>
              <input v-else type="text" class="form-input" v-model="config.database" placeholder="可留空，连接后选择" />
            </div>

            <!-- 操作按钮 -->
            <div style="display:flex;gap:6px;margin-top:8px;">
              <button
                class="btn btn-secondary btn-sm"
                style="flex:1;"
                @click="testConnection"
                :disabled="loading || !isConnConfigComplete"
                :title="!isConnConfigComplete ? '请先填写主机、端口和用户名' : '测试数据库连接'"
              >
                <Wifi :size="14" /> 测试连接
              </button>
              <button
                class="btn btn-primary btn-sm"
                style="flex:1;"
                @click="fetchSchema"
                :disabled="loading || !isConfigComplete"
                :title="!isConfigComplete ? '请先连接并选择一个数据库' : '获取数据库表结构'"
              >
                <Download :size="14" /> 获取结构
              </button>
            </div>

            <!-- 提示 -->
            <div v-if="!isConnConfigComplete && (config.host || config.username)" class="tip" style="margin-top:8px;">
              <Lightbulb :size="14" class="tip-icon" />
              <span>请填写主机、端口和用户名</span>
            </div>
            <div v-else-if="isConnConfigComplete && !config.database && connStatus === 'connected' && availableDatabases.length === 0" class="tip" style="margin-top:8px;">
              <Lightbulb :size="14" class="tip-icon" />
              <span>点击「测试连接」获取数据库列表</span>
            </div>

            <!-- 版本信息 -->
            <div v-if="dbVersion" class="tip" style="margin-top:8px;">
              <Lightbulb :size="14" class="tip-icon" />
              <span>{{ dbVersion }}</span>
            </div>
          </div>
        </div>

        <!-- 表筛选 -->
        <div class="card" v-if="schema">
          <div class="card-header">
            <h3><Filter :size="14" /> 表筛选</h3>
            <span style="font-size:11px;color:var(--text-muted);">{{ selectedTables.length }}/{{ schema.tables.length }}</span>
          </div>
          <div class="card-body">
            <div class="select-actions">
              <span class="select-action" @click="selectAllTables">全选</span>
              <span class="select-action" @click="deselectAllTables">全不选</span>
            </div>
            <div class="db-table-filter-list">
              <label
                v-for="t in schema.tables"
                :key="t.name"
                class="checkbox-label"
                style="display:flex;margin-bottom:3px;"
              >
                <input type="checkbox" :value="t.name" v-model="selectedTables" />
                <span style="flex:1;">
                  {{ t.name }}
                  <span style="color:var(--text-muted);font-size:10px;margin-left:4px;">
                    {{ t.comment || '' }}
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <!-- 导出设置 -->
        <div class="card" v-if="schema">
          <div class="card-header">
            <h3><Settings :size="14" /> 导出设置</h3>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:6px;">
            <label class="checkbox-label">
              <input type="checkbox" v-model="exportOptions.includeToc" />
              包含表目录
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="exportOptions.includeEr" />
              包含 ER 图
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="exportOptions.includeIndexes" />
              包含索引信息
            </label>
          </div>
        </div>
      </aside>

      <!-- 右侧预览区 -->
      <main class="content-panel">
        <!-- 空状态 -->
        <div v-if="!schema" class="empty-state" style="flex:1;">
          <Database :size="48" style="opacity:0.3;margin-bottom:16px;" />
          <p>数据库文档生成器</p>
          <p class="hint">请在左侧配置数据库连接，然后点击「获取结构」。</p>
        </div>

        <!-- 有数据 -->
        <template v-else>
          <!-- 统计 -->
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">{{ filteredTables.length }}</div><div class="stat-label">表数量</div></div>
            <div class="stat-card"><div class="stat-value">{{ filteredColumns.length }}</div><div class="stat-label">字段数</div></div>
            <div class="stat-card"><div class="stat-value">{{ filteredForeignKeys.length }}</div><div class="stat-label">外键</div></div>
            <div class="stat-card"><div class="stat-value">{{ filteredIndexes.length }}</div><div class="stat-label">索引</div></div>
          </div>

          <!-- ER 图视图 -->
          <div v-if="viewMode === 'er'" class="er-diagram-wrap">
            <div class="er-diagram-header">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:13px;font-weight:600;color:var(--text-primary);">表关系图</span>
                <label class="checkbox-label" style="font-size:11px;margin:0;">
                  <input type="checkbox" v-model="erShowComments" /> 显示备注
                </label>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;color:var(--text-muted);">{{ Math.round(diagramScale * 100) }}%</span>
                <button class="btn-icon" @click="zoomIn" title="放大"><span style="font-size:16px;">+</span></button>
                <button class="btn-icon" @click="zoomOut" title="缩小"><span style="font-size:16px;">–</span></button>
                <button class="btn-icon" @click="zoomReset" title="重置"><span style="font-size:12px;">1:1</span></button>
              </div>
            </div>
            <div class="er-diagram-body"
                 ref="erContainer"
                 @wheel.prevent="onDiagramWheel"
                 @mousedown="onDiagramMouseDown"
                 @mousemove="onDiagramMouseMove"
                 @mouseup="onDiagramMouseUp"
                 @mouseleave="onDiagramMouseUp"
            >
              <div class="er-diagram-inner" :style="diagramTransformStyle">
                <div ref="erContent"></div>
              </div>
            </div>
          </div>

          <!-- 关系图视图（每表独立实体图） -->
          <div v-if="viewMode === 'relation'" class="er-diagram-wrap">
            <div class="er-diagram-header">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:13px;font-weight:600;color:var(--text-primary);">实体属性图</span>
                <select class="form-input" style="width:180px;height:28px;font-size:12px;padding:2px 8px;" v-model="currentEntityTableIndex">
                  <option v-for="(t, idx) in filteredTables" :key="t.name" :value="idx">
                    {{ t.name }} {{ t.comment ? '(' + t.comment + ')' : '' }}
                  </option>
                </select>
                <span style="font-size:11px;color:var(--text-muted);">{{ currentEntityTableIndex + 1 }} / {{ filteredTables.length }}</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <button class="btn-icon" @click="prevEntityTable" :disabled="currentEntityTableIndex <= 0" title="上一张">❮</button>
                <button class="btn-icon" @click="nextEntityTable" :disabled="currentEntityTableIndex >= filteredTables.length - 1" title="下一张">❯</button>
                <span style="width:1px;height:16px;background:var(--border-color);margin:0 2px;"></span>
                <span style="font-size:11px;color:var(--text-muted);">{{ Math.round(diagramScale * 100) }}%</span>
                <button class="btn-icon" @click="zoomIn" title="放大"><span style="font-size:16px;">+</span></button>
                <button class="btn-icon" @click="zoomOut" title="缩小"><span style="font-size:16px;">–</span></button>
                <button class="btn-icon" @click="zoomReset" title="重置"><span style="font-size:12px;">1:1</span></button>
              </div>
            </div>
            <div class="er-diagram-body"
                 ref="entityContainer"
                 @wheel.prevent="onDiagramWheel"
                 @mousedown="onDiagramMouseDown"
                 @mousemove="onDiagramMouseMove"
                 @mouseup="onDiagramMouseUp"
                 @mouseleave="onDiagramMouseUp"
            >
              <div class="er-diagram-inner" :style="diagramTransformStyle">
                <div ref="entityContent"></div>
              </div>
            </div>
            <!-- 图例 -->
            <div style="padding:6px 14px;border-top:1px solid var(--border-color);display:flex;gap:16px;font-size:11px;color:var(--text-muted);">
              <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b;margin-right:4px;"></span>主键</span>
              <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3b82f6;margin-right:4px;"></span>外键</span>
              <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#1e293b;border:1px solid #475569;margin-right:4px;"></span>普通字段</span>
            </div>
          </div>

          <!-- 表结构列表 -->
          <div v-if="viewMode === 'table'" class="api-preview-scroll">
            <div v-for="(table, tIdx) in filteredTables" :key="table.name" class="api-module-group">
              <div class="api-module-header" @click="toggleTableExpand(table.name)">
                <div style="display:flex;align-items:center;gap:8px;">
                  <ChevronRight :size="14" :class="{'chevron-expanded': expandedTables.has(table.name)}" />
                  <span class="api-module-index">{{ tIdx + 1 }}</span>
                  <span class="api-module-name">{{ table.name }}</span>
                  <span class="badge badge-primary">{{ getTableColCount(table.name) }}</span>
                </div>
                <span class="db-table-comment-text">
                  <span
                    :class="{'placeholder-text': isPlaceholder(getTableComment(table))}"
                    contenteditable="true"
                    @blur="onTableCommentEdit(table, $event)"
                    @keydown.enter.prevent="$event.target.blur()"
                  >{{ getTableComment(table) }}</span>
                </span>
              </div>

              <div v-if="expandedTables.has(table.name)" class="api-module-body">
                <div class="db-columns-container">
                  <table class="detail-table">
                    <thead>
                      <tr>
                        <th style="width:30px;">#</th>
                        <th>字段名</th>
                        <th>类型</th>
                        <th style="width:50px;">可空</th>
                        <th>默认值</th>
                        <th style="width:50px;">主键</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(col, cIdx) in getTableColumns(table.name)" :key="col.name">
                        <td style="color:var(--text-muted);font-size:11px;">{{ cIdx + 1 }}</td>
                        <td><code>{{ col.name }}</code></td>
                        <td style="font-size:11px;font-family:'Courier New',monospace;">{{ col.full_type }}</td>
                        <td><span :class="col.is_nullable ? 'tag-optional' : 'tag-required'">{{ col.is_nullable ? '✓' : '✗' }}</span></td>
                        <td style="font-size:11px;">{{ col.default_value || '-' }}</td>
                        <td>
                          <span v-if="col.is_primary_key" class="badge badge-warning" style="font-size:10px;">PK</span>
                        </td>
                        <td>
                          <span
                            :class="{'placeholder-text': isPlaceholder(getColumnComment(col))}"
                            contenteditable="true"
                            @blur="onColumnCommentEdit(col, $event)"
                            @keydown.enter.prevent="$event.target.blur()"
                          >{{ getColumnComment(col) }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- 索引 -->
                <div v-if="getTableIndexes(table.name).length > 0" class="db-sub-section">
                  <div class="db-sub-label"><Key :size="12" /> 索引</div>
                  <table class="detail-table">
                    <thead>
                      <tr>
                        <th>索引名</th>
                        <th>列</th>
                        <th style="width:50px;">唯一</th>
                        <th style="width:50px;">主键</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="idx in getTableIndexes(table.name)" :key="idx.index_name">
                        <td>{{ idx.index_name }}</td>
                        <td><code>{{ idx.columns.join(', ') }}</code></td>
                        <td><span :class="idx.is_unique ? 'tag-required' : ''">{{ idx.is_unique ? '✓' : '✗' }}</span></td>
                        <td>{{ idx.is_primary ? '✓' : '' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- 外键 -->
                <div v-if="getTableForeignKeys(table.name).length > 0" class="db-sub-section">
                  <div class="db-sub-label"><Link :size="12" /> 外键关系</div>
                  <div v-for="fk in getTableForeignKeys(table.name)" :key="fk.name" class="db-fk-item">
                    <code>{{ fk.column_name }}</code>
                    <span style="color:var(--text-muted);margin:0 6px;">→</span>
                    <code>{{ fk.ref_table }}.{{ fk.ref_column }}</code>
                    <span style="font-size:10px;color:var(--text-muted);margin-left:8px;">({{ fk.name }})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>

    <!-- 导出选择弹框 -->
    <div v-if="exportDialog.show" class="modal-overlay" @click.self="exportDialog.show = false">
      <div class="modal-content" style="width:420px;">
        <div class="modal-header">
          <h3>{{ exportDialog.mode === 'er' ? '导出关系图' : '批量导出实体图' }}</h3>
          <button class="btn-icon" @click="exportDialog.show = false"><X :size="14" /></button>
        </div>
        <div class="modal-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:12px;color:var(--text-muted);">{{ exportDialog.selected.length }} / {{ filteredTables.length }} 张表已选</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secondary btn-sm" style="font-size:11px;padding:1px 6px;" @click="exportDialogSelectAll">全选</button>
              <button class="btn btn-secondary btn-sm" style="font-size:11px;padding:1px 6px;" @click="exportDialogSelectNone">全不选</button>
            </div>
          </div>
          <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:4px;">
            <label v-for="table in filteredTables" :key="table.name" class="checkbox-label" style="padding:4px 8px;margin:0;font-size:12px;display:flex;align-items:center;gap:6px;">
              <input type="checkbox" :value="table.name" v-model="exportDialog.selected" />
              <code style="font-size:11px;">{{ table.name }}</code>
              <span v-if="table.comment" style="color:var(--text-muted);font-size:10px;">{{ table.comment }}</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" @click="exportDialog.show = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="doExportImages" :disabled="exportDialog.selected.length === 0 || exportDialog.exporting">
            <span v-if="exportDialog.exporting" class="spinner" style="width:12px;height:12px;"></span>
            {{ exportDialog.exporting ? '导出中...' : '开始导出' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import {
  processColumnComment, processTableComment, isDbPlaceholder,
  generateErMermaid, generateTableEntitySvg, renderDbMarkdown, renderDbDocx
} from '../core/db-doc/db-doc-renderer.js'
import { loadAllConfigs, loadActiveConfigId, fillDbDocPlaceholders, createAiController } from '../core/llm/llm-service.js'
import {
  Database, Check, FileDown, FileText, ChevronRight, Filter, Settings,
  Lightbulb, Wifi, Download, GitBranch, Key, Link, X, Bot
} from 'lucide-vue-next'

export default {
  name: 'DbDocGenerator',
  components: {
    Database, Check, FileDown, FileText, ChevronRight, Filter, Settings,
    Lightbulb, Wifi, Download, GitBranch, Key, Link, X, Bot
  },
  inject: ['showToast'],
  data() {
    return {
      config: {
        db_type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: '',
        database: '',
      },
      dbTypes: [
        { value: 'mysql', label: 'MySQL', defaultPort: 3306, defaultUser: 'root' },
        { value: 'postgres', label: 'PostgreSQL', defaultPort: 5432, defaultUser: 'postgres' },
      ],
      availableDatabases: [],
      loading: false,
      loadingText: '',
      connStatus: '', // '' | 'connected' | 'error'
      dbVersion: '',
      schema: null,
      selectedTables: [],
      expandedTables: new Set(),
      viewMode: 'table', // 'table' | 'er' | 'relation'
      diagramScale: 1,
      diagramX: 0,
      diagramY: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      _renderCounter: 0,
      currentEntityTableIndex: 0,
      erShowComments: true,
      exportDialog: {
        show: false,
        mode: '', // 'er' | 'relation'
        selected: [],
        exporting: false,
      },
      exportOptions: {
        includeToc: true,
        includeEr: true,
        includeIndexes: true,
      },
      // 用户编辑的注释覆盖（用于占位符编辑）
      commentOverrides: {},
      aiProcessing: false,
      aiProgressText: '',
      aiLogs: [],
      aiController: null,
      aiConfigs: [],
      selectedConfigId: null,
    }
  },
  computed: {
    isConnConfigComplete() {
      const c = this.config
      return c.host && c.port && c.username
    },
    isConfigComplete() {
      return this.isConnConfigComplete && !!this.config.database
    },
    diagramTransformStyle() {
      return {
        transform: `translate(${this.diagramX}px, ${this.diagramY}px) scale(${this.diagramScale})`,
        transformOrigin: 'center center',
        transition: this.isDragging ? 'none' : 'transform 0.15s ease',
        cursor: this.isDragging ? 'grabbing' : 'grab',
      }
    },
    filteredTables() {
      if (!this.schema) return []
      if (this.selectedTables.length === 0) return this.schema.tables
      return this.schema.tables.filter(t => this.selectedTables.includes(t.name))
    },
    filteredColumns() {
      if (!this.schema) return []
      const names = new Set(this.filteredTables.map(t => t.name))
      return this.schema.columns.filter(c => names.has(c.table_name))
    },
    filteredForeignKeys() {
      if (!this.schema) return []
      const names = new Set(this.filteredTables.map(t => t.name))
      return this.schema.foreign_keys.filter(f => names.has(f.table_name))
    },
    filteredIndexes() {
      if (!this.schema) return []
      const names = new Set(this.filteredTables.map(t => t.name))
      return this.schema.indexes.filter(i => names.has(i.table_name))
    },
    erMermaidCode() {
      if (!this.schema) return ''
      if (this.filteredForeignKeys.length === 0 && this.filteredTables.length === 0) return ''
      return generateErMermaid(this.filteredTables, this.filteredColumns, this.filteredForeignKeys, { showComments: this.erShowComments })
    },
    filteredSchema() {
      return {
        tables: this.filteredTables,
        columns: this.filteredColumns,
        foreign_keys: this.filteredForeignKeys,
        indexes: this.filteredIndexes,
      }
    },
  },
  watch: {
    viewMode(val) {
      this.diagramScale = 1
      this.diagramX = 0
      this.diagramY = 0
      if (val === 'er') {
        this.$nextTick(() => this.renderErDiagram())
      } else if (val === 'relation') {
        this.currentEntityTableIndex = 0
        this.$nextTick(() => this.renderEntityDiagram())
      }
    },
    filteredTables() {
      if (this.viewMode === 'er') {
        this.$nextTick(() => this.renderErDiagram())
      } else if (this.viewMode === 'relation') {
        this.currentEntityTableIndex = 0
        this.$nextTick(() => this.renderEntityDiagram())
      }
    },
    currentEntityTableIndex() {
      this.diagramScale = 1
      this.diagramX = 0
      this.diagramY = 0
      this.$nextTick(() => this.renderEntityDiagram())
    },
    erShowComments() {
      if (this.viewMode === 'er') {
        this.$nextTick(() => this.renderErDiagram())
      }
    },
  },
  methods: {
    // ===== 数据库类型切换 =====
    onDbTypeChange() {
      const t = this.dbTypes.find(d => d.value === this.config.db_type)
      if (t) {
        this.config.port = t.defaultPort
        this.config.username = t.defaultUser
      }
      this.connStatus = ''
      this.dbVersion = ''
      this.availableDatabases = []
      this.config.database = ''
    },

    // ===== 连接测试 =====
    async testConnection() {
      this.loading = true
      this.loadingText = '正在测试连接...'
      this.connStatus = ''
      this.dbVersion = ''
      this.availableDatabases = []

      try {
        const configToSend = {
          ...this.config,
          database: this.config.database || null,
        }
        const result = await invoke('db_test_connection', { config: configToSend })
        if (result.success) {
          this.connStatus = 'connected'
          this.dbVersion = result.version
          this.showToast(`连接成功: ${result.version}`, 'success')
          // 自动获取数据库列表
          await this.loadDatabases(configToSend)
        } else {
          this.connStatus = 'error'
          this.showToast(`连接失败: ${result.error}`, 'error')
        }
      } catch (e) {
        this.connStatus = 'error'
        this.showToast(`连接异常: ${String(e)}`, 'error')
      }

      this.loading = false
    },

    // ===== 加载数据库列表 =====
    async loadDatabases(configToSend) {
      try {
        const result = await invoke('db_fetch_databases', { config: configToSend })
        if (result.success) {
          this.availableDatabases = result.databases
          // 如果当前已填写的数据库名在列表中，保持选中
          if (this.config.database && !result.databases.includes(this.config.database)) {
            this.config.database = ''
          }
          // 如果只有一个库，自动选中
          if (result.databases.length === 1 && !this.config.database) {
            this.config.database = result.databases[0]
          }
        }
      } catch (e) {
        console.warn('加载数据库列表失败:', e)
      }
    },

    // ===== 获取结构 =====
    async fetchSchema() {
      this.loading = true
      this.loadingText = '正在获取数据库结构...'

      try {
        const configToSend = {
          ...this.config,
          database: this.config.database || null,
        }
        const result = await invoke('db_fetch_schema', { config: configToSend })
        if (result.success && result.schema) {
          this.schema = result.schema
          this.selectedTables = result.schema.tables.map(t => t.name)
          this.connStatus = 'connected'
          this.commentOverrides = {}

          // 自动展开前3个表
          const first3 = result.schema.tables.slice(0, 3).map(t => t.name)
          this.expandedTables = new Set(first3)

          const colCount = result.schema.columns.length
          const fkCount = result.schema.foreign_keys.length
          this.showToast(`获取成功: ${result.schema.tables.length} 个表, ${colCount} 个字段, ${fkCount} 个外键`, 'success')
        } else {
          this.connStatus = 'error'
          this.showToast(`获取失败: ${result.error}`, 'error')
        }
      } catch (e) {
        this.connStatus = 'error'
        this.showToast(`获取异常: ${String(e)}`, 'error')
      }

      this.loading = false
    },

    // ===== 表操作 =====
    selectAllTables() {
      if (this.schema) this.selectedTables = this.schema.tables.map(t => t.name)
    },
    deselectAllTables() {
      this.selectedTables = []
    },
    toggleTableExpand(name) {
      const s = new Set(this.expandedTables)
      s.has(name) ? s.delete(name) : s.add(name)
      this.expandedTables = s
    },
    getTableColCount(tableName) {
      if (!this.schema) return 0
      return this.schema.columns.filter(c => c.table_name === tableName).length
    },
    getTableColumns(tableName) {
      if (!this.schema) return []
      return this.schema.columns.filter(c => c.table_name === tableName)
    },
    getTableIndexes(tableName) {
      if (!this.schema) return []
      return this.schema.indexes.filter(i => i.table_name === tableName)
    },
    getTableForeignKeys(tableName) {
      if (!this.schema) return []
      return this.schema.foreign_keys.filter(f => f.table_name === tableName)
    },

    // ===== 注释处理 =====
    getColumnComment(col) {
      const key = `${col.table_name}:${col.name}`
      if (this.commentOverrides[key] !== undefined) return this.commentOverrides[key]
      return processColumnComment(col)
    },
    getTableComment(table) {
      const key = `${table.name}:__TABLE__`
      if (this.commentOverrides[key] !== undefined) return this.commentOverrides[key]
      return processTableComment(table)
    },
    isPlaceholder(text) {
      return isDbPlaceholder(text)
    },
    onColumnCommentEdit(col, event) {
      const newText = event.target.innerText.trim()
      const key = `${col.table_name}:${col.name}`
      if (newText && newText !== this.getColumnComment(col)) {
        this.commentOverrides = { ...this.commentOverrides, [key]: newText }
        // 同时更新原始数据以便导出
        col.comment = newText
      }
    },
    onTableCommentEdit(table, event) {
      const newText = event.target.innerText.trim()
      const key = `${table.name}:__TABLE__`
      if (newText && newText !== this.getTableComment(table)) {
        this.commentOverrides = { ...this.commentOverrides, [key]: newText }
        table.comment = newText
      }
    },

    // ===== ER 图渲染 (Mermaid) =====
    async renderErDiagram() {
      const content = this.$refs.erContent
      if (!content) return

      const code = this.erMermaidCode
      if (!code || code.split('\n').length <= 1) {
        content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;">暂无外键关系，无法生成 ER 图。</div>'
        return
      }

      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          er: { useMaxWidth: false, layoutDirection: 'TB' },
          securityLevel: 'loose',
        })
        this._renderCounter++
        const id = `er-${this._renderCounter}`
        const { svg } = await mermaid.render(id, code)
        content.innerHTML = svg
        this.$nextTick(() => this.autoFitDiagram('erContainer', 'erContent'))
      } catch (e) {
        content.innerHTML = `<div style="padding:20px;color:var(--danger-500);font-size:12px;">ER 图渲染失败: ${String(e)}</div>`
        console.error('Mermaid render error:', e)
      }
    },

    // ===== 单表实体关系图渲染 (SVG) =====
    renderEntityDiagram() {
      const content = this.$refs.entityContent
      if (!content) return

      const table = this.filteredTables[this.currentEntityTableIndex]
      if (!table) {
        content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;">请选择一张表</div>'
        return
      }

      const svg = generateTableEntitySvg(table, this.filteredColumns, this.filteredForeignKeys)
      content.innerHTML = svg
      this.$nextTick(() => this.autoFitDiagram('entityContainer', 'entityContent'))
    },

    // ===== 翻页 =====
    prevEntityTable() {
      if (this.currentEntityTableIndex > 0) this.currentEntityTableIndex--
    },
    nextEntityTable() {
      if (this.currentEntityTableIndex < this.filteredTables.length - 1) this.currentEntityTableIndex++
    },

    autoFitDiagram(containerRef, contentRef) {
      const container = this.$refs[containerRef]
      const content = this.$refs[contentRef]
      if (!container || !content) return
      const svg = content.querySelector('svg')
      if (!svg) return
      const svgW = svg.getBoundingClientRect().width
      const svgH = svg.getBoundingClientRect().height
      const containerW = container.clientWidth - 32
      const containerH = container.clientHeight - 32
      if (svgW > 0 && svgH > 0) {
        const scaleX = containerW / svgW
        const scaleY = containerH / svgH
        this.diagramScale = Math.min(scaleX, scaleY, 1.5)
        this.diagramX = 0
        this.diagramY = 0
      }
    },

    // ===== 缩放/平移 =====
    zoomIn() {
      this.diagramScale = Math.min(this.diagramScale * 1.25, 5)
    },
    zoomOut() {
      this.diagramScale = Math.max(this.diagramScale / 1.25, 0.1)
    },
    zoomReset() {
      this.diagramScale = 1
      this.diagramX = 0
      this.diagramY = 0
    },
    onDiagramWheel(e) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      this.diagramScale = Math.min(Math.max(this.diagramScale * delta, 0.1), 5)
    },
    onDiagramMouseDown(e) {
      this.isDragging = true
      this.dragStartX = e.clientX - this.diagramX
      this.dragStartY = e.clientY - this.diagramY
    },
    onDiagramMouseMove(e) {
      if (!this.isDragging) return
      this.diagramX = e.clientX - this.dragStartX
      this.diagramY = e.clientY - this.dragStartY
    },
    onDiagramMouseUp() {
      this.isDragging = false
    },

    // ===== 导出 =====
    async exportMarkdown() {
      if (!this.schema) return
      const path = await save({
        title: '导出数据库文档 (Markdown)',
        defaultPath: '数据库文档.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })
      if (!path) return

      const md = renderDbMarkdown(this.filteredSchema, this.exportOptions)
      await writeTextFile(path, md)
      this.showToast('Markdown 文档已导出', 'success')
    },

    async exportWord() {
      if (!this.schema) return
      const path = await save({
        title: '导出数据库文档 (Word)',
        defaultPath: '数据库文档.docx',
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      })
      if (!path) return

      try {
        const buffer = await renderDbDocx(this.filteredSchema, this.exportOptions)
        await writeFile(path, buffer)
        this.showToast('Word 文档已导出', 'success')
      } catch (e) {
        this.showToast('Word 导出失败: ' + String(e), 'error')
      }
    },

    // ===== 图片导出 =====
    openExportDialog(mode) {
      this.exportDialog.mode = mode
      this.exportDialog.selected = this.filteredTables.map(t => t.name)
      this.exportDialog.exporting = false
      this.exportDialog.show = true
    },
    exportDialogSelectAll() {
      this.exportDialog.selected = this.filteredTables.map(t => t.name)
    },
    exportDialogSelectNone() {
      this.exportDialog.selected = []
    },

    async svgToPng(svgString, scale = 2) {
      return new Promise((resolve, reject) => {
        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
        const svgEl = svgDoc.documentElement

        // 确保有 xmlns
        svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        svgEl.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

        // 获取尺寸（Mermaid 常只设 style 不设 attribute）
        let w = 0, h = 0

        // 1. 先从 viewBox 取
        const vb = svgEl.getAttribute('viewBox')
        if (vb) {
          const parts = vb.split(/[\s,]+/).map(Number)
          if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
            w = parts[2]
            h = parts[3]
          }
        }

        // 2. 从 width/height 属性取（可能是 "800px" 或 "100%"）
        if (!w || !h) {
          const attrW = parseFloat(svgEl.getAttribute('width'))
          const attrH = parseFloat(svgEl.getAttribute('height'))
          if (attrW > 0 && attrH > 0) { w = attrW; h = attrH }
        }

        // 3. 从 style 取 (Mermaid 用 max-width)
        if (!w || !h) {
          const style = svgEl.getAttribute('style') || ''
          const wMatch = style.match(/(?:max-)?width:\s*([\d.]+)/)
          const hMatch = style.match(/(?:max-)?height:\s*([\d.]+)/)
          if (wMatch) w = parseFloat(wMatch[1]) || w
          if (hMatch) h = parseFloat(hMatch[1]) || h
        }

        // 4. 兜底
        if (!w || w <= 0) w = 1200
        if (!h || h <= 0) h = 800

        // 强制设置 width/height 属性（Image 需要明确尺寸）
        svgEl.setAttribute('width', String(w))
        svgEl.setAttribute('height', String(h))
        if (!vb) {
          svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`)
        }

        // 处理 foreignObject → 替换为 SVG text
        const foreignObjects = svgEl.querySelectorAll('foreignObject')
        foreignObjects.forEach(fo => {
          const x = fo.getAttribute('x') || '0'
          const y = fo.getAttribute('y') || '0'
          const foW = parseFloat(fo.getAttribute('width') || '100')
          const foH = parseFloat(fo.getAttribute('height') || '30')
          const textContent = (fo.textContent || '').trim()
          if (textContent) {
            const textEl = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text')
            textEl.setAttribute('x', String(parseFloat(x) + foW / 2))
            textEl.setAttribute('y', String(parseFloat(y) + foH / 2 + 4))
            textEl.setAttribute('text-anchor', 'middle')
            textEl.setAttribute('fill', '#e2e8f0')
            textEl.setAttribute('font-size', '12')
            textEl.setAttribute('font-family', 'sans-serif')
            textEl.textContent = textContent.length > 40 ? textContent.substring(0, 39) + '…' : textContent
            fo.parentNode.replaceChild(textEl, fo)
          } else {
            fo.parentNode.removeChild(fo)
          }
        })

        // 内嵌暗色主题样式
        const styleEl = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style')
        styleEl.textContent = `
          * { font-family: 'Microsoft YaHei', sans-serif; }
          .er.entityBox { fill: #1e293b; stroke: #6366f1; }
          .er.entityLabel { fill: #e2e8f0; }
          .er.attributeBoxOdd, .er.attributeBoxEven { fill: #1e293b; }
          .er.relationshipLine { stroke: #94a3b8; }
          text { fill: #e2e8f0; }
          .label { fill: #e2e8f0 !important; }
          rect.basic.label-container { fill: #1e293b; stroke: #475569; }
        `
        svgEl.insertBefore(styleEl, svgEl.firstChild)

        // 背景矩形
        const bgRect = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect')
        bgRect.setAttribute('width', String(w))
        bgRect.setAttribute('height', String(h))
        bgRect.setAttribute('fill', '#1e1e2e')
        svgEl.insertBefore(bgRect, svgEl.firstChild)

        const canvas = document.createElement('canvas')
        canvas.width = w * scale
        canvas.height = h * scale
        const ctx = canvas.getContext('2d')

        // 使用 base64 data URI（比 encodeURIComponent 更可靠）
        const svgData = new XMLSerializer().serializeToString(svgEl)
        const base64 = btoa(unescape(encodeURIComponent(svgData)))
        const dataUrl = 'data:image/svg+xml;base64,' + base64

        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          // 优先用 toDataURL（更可靠）
          try {
            const pngUrl = canvas.toDataURL('image/png')
            const binary = atob(pngUrl.split(',')[1])
            const arr = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
            resolve(arr)
          } catch (e) {
            canvas.toBlob(b => {
              if (b) {
                b.arrayBuffer().then(ab => resolve(new Uint8Array(ab)))
              } else {
                reject(new Error('PNG 导出失败'))
              }
            }, 'image/png')
          }
        }
        img.onerror = (e) => {
          console.error('SVG Image load error:', e)
          reject(new Error('SVG 加载失败'))
        }
        img.src = dataUrl
      })
    },

    async doExportImages() {
      const { mode, selected } = this.exportDialog
      if (selected.length === 0) return
      this.exportDialog.exporting = true

      try {
        if (mode === 'er') {
          await this.exportErImage(selected)
        } else {
          await this.exportEntityImages(selected)
        }
      } catch (e) {
        this.showToast('导出失败: ' + String(e), 'error')
        console.error('Export error:', e)
      }

      this.exportDialog.exporting = false
      this.exportDialog.show = false
    },

    async exportErImage(selectedNames) {
      const tables = this.filteredTables.filter(t => selectedNames.includes(t.name))
      const columns = this.filteredColumns.filter(c => selectedNames.includes(c.table_name))
      const fks = this.filteredForeignKeys.filter(f => selectedNames.includes(f.table_name))
      const code = generateErMermaid(tables, columns, fks, { showComments: this.erShowComments })

      if (!code || code.split('\n').length <= 1) {
        this.showToast('选中的表没有外键关系，无法生成关系图', 'error')
        return
      }

      const mermaid = (await import('mermaid')).default
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        er: { useMaxWidth: false, layoutDirection: 'TB' },
        securityLevel: 'loose',
      })
      this._renderCounter++
      const { svg } = await mermaid.render(`export-er-${this._renderCounter}`, code)

      // 直接导出 SVG 文件（避免 Canvas 尺寸限制）
      const parser = new DOMParser()
      const svgDoc = parser.parseFromString(svg, 'image/svg+xml')
      const svgEl = svgDoc.documentElement

      // 添加深色背景
      let w = 1200, h = 800
      const vb = svgEl.getAttribute('viewBox')
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number)
        if (parts.length >= 4 && parts[2] > 0) { w = parts[2]; h = parts[3] }
      }
      const bgRect = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect')
      bgRect.setAttribute('width', String(w))
      bgRect.setAttribute('height', String(h))
      bgRect.setAttribute('fill', '#1e1e2e')
      svgEl.insertBefore(bgRect, svgEl.firstChild)

      const svgData = new XMLSerializer().serializeToString(svgEl)
      const encoder = new TextEncoder()
      const svgBytes = encoder.encode(svgData)

      const path = await save({
        title: '导出关系图',
        defaultPath: '关系图.svg',
        filters: [{ name: 'SVG 矢量图', extensions: ['svg'] }],
      })
      if (!path) return
      await writeFile(path, svgBytes)
      this.showToast('关系图已导出 (SVG 格式，可用浏览器打开)', 'success')
    },

    async exportEntityImages(selectedNames) {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const imgFolder = zip.folder('实体关系图')

      let count = 0
      for (const name of selectedNames) {
        const table = this.filteredTables.find(t => t.name === name)
        if (!table) continue

        const svgStr = generateTableEntitySvg(table, this.filteredColumns, this.filteredForeignKeys)
        try {
          const pngData = await this.svgToPng(svgStr)
          imgFolder.file(`${name}.png`, pngData)
          count++
        } catch (e) {
          console.warn(`导出 ${name} 失败:`, e)
        }
      }

      if (count === 0) {
        this.showToast('没有成功生成任何图片', 'error')
        return
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipData = new Uint8Array(await zipBlob.arrayBuffer())

      const path = await save({
        title: '导出关系图压缩包',
        defaultPath: '实体关系图.zip',
        filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
      })
      if (!path) return
      await writeFile(path, zipData)
      this.showToast(`已导出 ${count} 张实体关系图`, 'success')
    },

    addAiLog(msg, level = 'info') {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      this.aiLogs.push({ time, msg, level })
      this.$nextTick(() => {
        const panel = this.$refs.aiLogPanel
        if (panel) panel.scrollTop = panel.scrollHeight
      })
    },

    async startAiFill() {
      if (!this.schema || this.aiProcessing) return

      this.aiConfigs = await loadAllConfigs()
      if (this.aiConfigs.length === 0) {
        this.showToast('请先在「AI 设置」标签页配置模型', 'warning')
        return
      }

      if (!this.selectedConfigId) {
        const activeId = await loadActiveConfigId()
        this.selectedConfigId = activeId || this.aiConfigs[0].id
      }
      const config = this.aiConfigs.find(c => c.id === this.selectedConfigId) || this.aiConfigs[0]

      this.aiProcessing = true
      this.aiLogs = []
      this.aiController = createAiController()
      this.aiProgressText = `使用 ${config.name || config.model}...`
      this.addAiLog(`开始 AI 补充，使用 ${config.name || config.model}`, 'info')

      try {
        const result = await fillDbDocPlaceholders(
          config,
          this.schema,
          (table) => this.getTableComment(table),
          (col) => this.getColumnComment(col),
          this.commentOverrides,
          (msg, level) => {
            this.addAiLog(msg, level)
            this.aiProgressText = msg
          },
          (batchName, filled, batchTotal) => {
            this.schema = { ...this.schema }
          },
          this.aiController,
        )

        if (result.total === 0) {
          this.showToast('没有需要补充的占位符', 'info')
        } else {
          this.commentOverrides = result.newOverrides
          this.showToast(`AI 补充完成: ${result.filled}/${result.total} 个注释已填充`, 'success')
        }
      } catch (e) {
        this.showToast('AI 补充失败: ' + String(e), 'error')
        this.addAiLog(`失败: ${e.message}`, 'error')
      }

      this.aiProcessing = false
      this.aiProgressText = ''
      this.aiController = null
    },
  },
}
</script>
