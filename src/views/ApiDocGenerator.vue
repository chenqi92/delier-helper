<template>
  <div style="display:flex;flex-direction:column;height:100%;">
    <GuideTour
      :steps="guideSteps"
      :enabled="guideVisible"
      :conditions="guideConditions"
      @finish="guideVisible = false"
    />
    <!-- 头部操作栏 -->
    <div class="view-header">
      <div class="header-actions">
        <span v-if="parsing" style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:12px;">
          <span class="spinner"></span> {{ parseProgress }}
        </span>
        <span v-else-if="parseResult" style="font-size:12px;color:var(--success-500);">
          <Check :size="12" /> {{ parseResult.modules.length }} 个模块，{{ totalApis }} 个接口
        </span>
        <div class="ai-fill-group" v-if="parseResult">
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
        <button class="btn btn-primary btn-sm" @click="exportMarkdown" :disabled="!parseResult">
          <FileText :size="14" /> 导出 Markdown
        </button>
        <button class="btn btn-primary btn-sm" @click="exportWord" :disabled="!parseResult">
          <FileDown :size="14" /> 导出 Word
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
        <!-- 项目目录 -->
        <div class="card">
          <div class="card-header">
            <h3><FolderOpen :size="14" /> 项目目录</h3>
          </div>
          <div class="card-body">
            <div v-if="!projectDir" class="tip">
              <Lightbulb :size="14" class="tip-icon" />
              <span>选择 Spring Boot 项目的根目录。</span>
            </div>
            <div v-else class="dir-item">
              <div class="dir-item-header">
                <span class="dir-path" :title="projectDir">{{ projectDir }}</span>
                <button class="btn btn-danger btn-sm btn-icon" @click="clearProject"><X :size="14" /></button>
              </div>
              <div v-if="detectedLang" style="margin-top:4px;">
                <span class="badge badge-success">{{ detectedLang.icon }} {{ detectedLang.label }}</span>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" style="width:100%;margin-top:8px;" @click="selectProject" data-guide="api-select-dir">
              <FolderOpen :size="14" /> {{ projectDir ? '更换目录' : '选择目录' }}
            </button>
          </div>
        </div>

        <!-- 解析操作 -->
        <div class="card" v-if="projectDir">
          <div class="card-header">
            <h3><Search :size="14" /> 解析控制</h3>
          </div>
          <div class="card-body">
            <button
              class="btn btn-primary"
              style="width:100%;"
              @click="startParsing"
              :disabled="parsing || !detectedLang"
              data-guide="api-start-parse"
            >
              <Scan :size="14" /> {{ parsing ? '解析中...' : '开始解析' }}
            </button>
            <!-- 进度条 -->
            <div v-if="parsing" class="parse-progress" style="margin-top:8px;">
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" :style="{width: parsePercent + '%'}"></div>
              </div>
              <span style="font-size:11px;color:var(--text-muted);">{{ parsePercent }}%</span>
            </div>
            <!-- 解析日志 -->
            <div v-if="parseLogs.length > 0" class="parse-log-panel" ref="logPanel">
              <div v-for="(log, i) in parseLogs" :key="i" class="parse-log-item">
                <span class="parse-log-time">{{ log.time }}</span>
                <span>{{ log.msg }}</span>
              </div>
            </div>
            <div v-if="parseResult" style="margin-top:8px;">
              <div class="tip">
                <Lightbulb :size="14" class="tip-icon" />
                <span>发现 {{ parseResult.modules.length }} 个模块，共 {{ totalApis }} 个接口</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 显示设置 -->
        <div class="card" v-if="parseResult">
          <div class="card-header">
            <h3><Settings :size="14" /> 显示设置</h3>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:8px;">
            <div class="setting-row">
              <span class="setting-label">自定义前缀</span>
              <input
                type="text"
                v-model="customPrefix"
                class="setting-input"
                placeholder="如 /api/v1"
              />
            </div>
            <label class="checkbox-label">
              <input type="checkbox" v-model="groupByController" />
              按 Controller 分组
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="showModulePath" />
              显示模块路径前缀
            </label>
          </div>
        </div>

        <!-- 模块筛选 -->
        <div class="card" v-if="parseResult">
          <div class="card-header">
            <h3><Filter :size="14" /> 接口筛选</h3>
          </div>
          <div class="card-body">
            <div class="select-actions">
              <span class="select-action" @click="selectAllModules">全选</span>
              <span class="select-action" @click="deselectAllModules">全不选</span>
            </div>
            <div style="max-height:160px;overflow-y:auto;">
              <label v-for="mod in parseResult.modules" :key="mod.className" class="checkbox-label" style="display:flex;margin-bottom:4px;">
                <input type="checkbox" :value="mod.className" v-model="selectedModules" />
                <span>{{ mod.name }} <span style="color:var(--text-muted);font-size:11px;">({{ mod.apis.length }})</span></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 文档模块配置 -->
        <div class="card">
          <div class="card-header">
            <h3><Settings :size="14" /> 文档内容</h3>
          </div>
          <div class="card-body">
            <div class="doc-module-list">
              <div
                v-for="(mod, idx) in docModules"
                :key="mod.id"
                class="doc-module-item"
              >
                <label class="checkbox-label" style="flex:1;">
                  <input type="checkbox" v-model="mod.enabled" />
                  {{ mod.label }}
                </label>
                <div class="reorder-btns">
                  <button class="reorder-btn" :disabled="idx === 0" @click="moveModule(idx, -1)" title="上移">▲</button>
                  <button class="reorder-btn" :disabled="idx === docModules.length - 1" @click="moveModule(idx, 1)" title="下移">▼</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧预览区 -->
      <main class="content-panel">
        <!-- 空状态 -->
        <div v-if="!parseResult" class="empty-state" style="flex:1;">
          <Plug :size="48" style="opacity:0.3;margin-bottom:16px;" />
          <p>接口文档生成器</p>
          <p class="hint">{{ projectDir ? '点击左侧"开始解析"按钮分析项目接口。' : '请先在左侧选择 Spring Boot 项目目录。' }}</p>
        </div>

        <!-- 接口列表 -->
        <template v-else>
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">{{ filteredModules.length }}</div><div class="stat-label">模块数量</div></div>
            <div class="stat-card"><div class="stat-value">{{ filteredApis }}</div><div class="stat-label">接口数量</div></div>
            <div class="stat-card"><div class="stat-value">{{ methodStats.GET || 0 }}</div><div class="stat-label">GET</div></div>
            <div class="stat-card"><div class="stat-value">{{ methodStats.POST || 0 }}</div><div class="stat-label">POST</div></div>
          </div>

          <div class="api-preview-scroll">
            <div v-for="(mod, modIdx) in displayModules" :key="mod.className" class="api-module-group">
              <div class="api-module-header" @click="toggleModuleExpand(mod.className)">
                <div style="display:flex;align-items:center;gap:8px;">
                  <ChevronRight :size="14" :class="{'chevron-expanded': expandedModules.has(mod.className)}" />
                  <span class="api-module-index">{{ modIdx + 1 }}</span>
                  <span class="api-module-name">{{ mod.name }}</span>
                  <span class="badge badge-primary">{{ mod.apis.length }}</span>
                </div>
                <span v-if="mod.file" style="font-size:11px;color:var(--text-muted);">{{ mod.file }}</span>
              </div>

              <div v-if="expandedModules.has(mod.className)" class="api-module-body">
                <div
                  v-for="(api, idx) in mod.apis"
                  :key="idx"
                  class="api-item"
                >
                  <div class="api-item-header" @click="toggleApiExpand(mod.className + '.' + api.methodName)">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="api-index">{{ modIdx + 1 }}.{{ idx + 1 }}</span>
                      <span :class="'method-badge method-' + api.method.toLowerCase()">{{ api.method }}</span>
                      <span class="api-path">{{ api.displayPath || api.path }}</span>
                    </div>
                    <span class="api-summary-text">{{ api.summary }}</span>
                  </div>

                  <!-- 展开的接口详情 -->
                  <div v-if="expandedApis.has(mod.className + '.' + api.methodName)" class="api-item-detail">
                    <!-- 按照 docModules 顺序渲染 -->
                    <template v-for="dm in enabledDocModules" :key="dm.id">
                      <!-- 请求方式 -->
                      <div v-if="dm.id === 'method'" class="detail-row">
                        <span class="detail-label">请求方式</span>
                        <span :class="'method-badge method-' + api.method.toLowerCase()">{{ api.method }}</span>
                      </div>

                      <!-- 请求地址 -->
                      <div v-if="dm.id === 'path'" class="detail-row">
                        <span class="detail-label">请求地址</span>
                        <code class="detail-code">{{ api.path }}</code>
                      </div>

                      <!-- 接口说明 -->
                      <div v-if="dm.id === 'summary'" class="detail-row">
                        <span class="detail-label">接口说明</span>
                        <span
                          :class="{'placeholder-text': checkPlaceholder(api.description)}"
                          contenteditable="true"
                          @blur="onApiDescEdit(api, $event)"
                        >{{ api.description || '-' }}</span>
                      </div>

                      <!-- 请求参数 -->
                      <template v-if="dm.id === 'params'">
                        <div v-if="api.params.length > 0" class="detail-section">
                          <div class="detail-label">请求参数</div>
                          <table class="detail-table">
                            <thead><tr><th>参数名</th><th>类型</th><th>必须</th><th>说明</th></tr></thead>
                            <tbody>
                              <tr v-for="p in api.params" :key="p.name">
                                <td><code>{{ p.name }}</code></td>
                                <td>{{ p.type }}</td>
                                <td><span :class="p.required ? 'tag-required' : 'tag-optional'">{{ p.required ? '是' : '否' }}</span></td>
                                <td>
                                  <span
                                    :class="{'placeholder-text': checkPlaceholder(p.description)}"
                                    contenteditable="true"
                                    @blur="onFieldDescEdit(api, 'params', $event, p)"
                                  >{{ p.description || '-' }}</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div v-if="api.requestBody && api.requestBody.fields.length > 0" class="detail-section">
                          <div class="detail-label">请求体 ({{ api.requestBody.type }})</div>
                          <table class="detail-table">
                            <thead><tr><th>参数名</th><th>类型</th><th>必须</th><th>说明</th></tr></thead>
                            <tbody>
                              <tr v-for="f in api.requestBody.fields" :key="f.name">
                                <td><code>{{ f.name }}</code></td>
                                <td>{{ f.type }}</td>
                                <td><span :class="f.required ? 'tag-required' : 'tag-optional'">{{ f.required ? '是' : '否' }}</span></td>
                                <td>
                                  <span
                                    :class="{'placeholder-text': checkPlaceholder(f.description)}"
                                    contenteditable="true"
                                    @blur="onFieldDescEdit(api, 'requestBody', $event, f)"
                                  >{{ f.description || '-' }}</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </template>

                      <!-- 返回数据 -->
                      <div v-if="dm.id === 'response' && api.response && api.response.fields.length > 0" class="detail-section">
                        <div class="detail-label">返回数据 ({{ api.response.type }})</div>
                        <table class="detail-table">
                          <thead><tr><th>参数名</th><th>类型</th><th>说明</th></tr></thead>
                          <tbody>
                            <tr v-for="f in api.response.fields" :key="f.name">
                              <td><code>{{ f.name }}</code></td>
                              <td>{{ f.type }}</td>
                              <td>
                                <span
                                  :class="{'placeholder-text': checkPlaceholder(f.description)}"
                                  contenteditable="true"
                                  @blur="onFieldDescEdit(api, 'response', $event, f)"
                                >{{ f.description || '-' }}</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <!-- 请求示例 -->
                      <div v-if="dm.id === 'requestExample' && api.requestBody && api.requestBody.example" class="detail-section">
                        <div class="detail-label">请求示例</div>
                        <pre class="detail-json">{{ JSON.stringify(api.requestBody.example, null, 2) }}</pre>
                      </div>

                      <!-- 返回示例 -->
                      <div v-if="dm.id === 'responseExample' && api.response && api.response.example" class="detail-section">
                        <div class="detail-label">返回示例</div>
                        <pre class="detail-json">{{ JSON.stringify(api.response.example, null, 2) }}</pre>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- 扁平模式：直接列出 API -->
            <div v-if="!groupByController" class="flat-api-list">
              <div
                v-for="(api, idx) in flatApis"
                :key="idx"
                class="api-item flat-api-item"
              >
                <div class="api-item-header" @click="toggleApiExpand('__flat__.' + idx)">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="api-index">{{ idx + 1 }}</span>
                    <span :class="'method-badge method-' + api.method.toLowerCase()">{{ api.method }}</span>
                    <span class="api-path">{{ api.displayPath || api.path }}</span>
                  </div>
                  <span class="api-summary-text">{{ api.summary }}</span>
                </div>

                <div v-if="expandedApis.has('__flat__.' + idx)" class="api-item-detail">
                  <template v-for="dm in enabledDocModules" :key="dm.id">
                    <div v-if="dm.id === 'method'" class="detail-row">
                      <span class="detail-label">请求方式</span>
                      <span :class="'method-badge method-' + api.method.toLowerCase()">{{ api.method }}</span>
                    </div>
                    <div v-if="dm.id === 'path'" class="detail-row">
                      <span class="detail-label">请求地址</span>
                      <code class="detail-code">{{ api.displayPath || api.path }}</code>
                    </div>
                    <div v-if="dm.id === 'summary'" class="detail-row">
                      <span class="detail-label">接口说明</span>
                      <span
                        :class="{'placeholder-text': checkPlaceholder(api.description)}"
                        contenteditable="true"
                        @blur="onApiDescEdit(api, $event)"
                      >{{ api.description || '-' }}</span>
                    </div>
                    <template v-if="dm.id === 'params'">
                      <div v-if="api.params.length > 0" class="detail-section">
                        <div class="detail-label">请求参数</div>
                        <table class="detail-table">
                          <thead><tr><th>参数名</th><th>类型</th><th>必须</th><th>说明</th></tr></thead>
                          <tbody>
                            <tr v-for="p in api.params" :key="p.name">
                              <td><code>{{ p.name }}</code></td><td>{{ p.type }}</td>
                              <td><span :class="p.required ? 'tag-required' : 'tag-optional'">{{ p.required ? '是' : '否' }}</span></td>
                              <td>{{ p.description || '-' }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </template>
                    <template v-if="dm.id === 'response'">
                      <div v-if="api.response && api.response.fields.length > 0" class="detail-section">
                        <div class="detail-label">返回数据 ({{ api.response.type }})</div>
                        <table class="detail-table">
                          <thead><tr><th>参数名</th><th>类型</th><th>说明</th></tr></thead>
                          <tbody>
                            <tr v-for="f in api.response.fields" :key="f.name">
                              <td><code>{{ f.name }}</code></td><td>{{ f.type }}</td><td>{{ f.description || '-' }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </template>
                    <div v-if="dm.id === 'requestExample' && api.requestBody && api.requestBody.example" class="detail-section">
                      <div class="detail-label">请求示例</div>
                      <pre class="detail-json">{{ JSON.stringify(api.requestBody.example, null, 2) }}</pre>
                    </div>
                    <div v-if="dm.id === 'responseExample' && api.response && api.response.example" class="detail-section">
                      <div class="detail-label">返回示例</div>
                      <pre class="detail-json">{{ JSON.stringify(api.response.example, null, 2) }}</pre>
                    </div>
                  </template>
                </div>
              </div>
            </div>

          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script>
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { detectProjectLanguage } from '../core/api-doc/parser-registry.js'
import { parseSpringBootProject, isPlaceholder } from '../core/api-doc/spring-boot-parser.js'
import { renderMarkdown, renderDocx, DEFAULT_DOC_MODULES } from '../core/api-doc/api-doc-renderer.js'
import { loadAllConfigs, loadActiveConfigId, fillApiDocPlaceholders, createAiController } from '../core/llm/llm-service.js'
import GuideTour from '../components/GuideTour.vue'
import {
  FolderOpen, Search, X, Lightbulb, Check, FileDown, FileText,
  Plug, Filter, Settings, ChevronRight, Scan, Bot
} from 'lucide-vue-next'

export default {
  name: 'ApiDocGenerator',
  components: {
    GuideTour,
    FolderOpen, Search, X, Lightbulb, Check, FileDown, FileText,
    Plug, Filter, Settings, ChevronRight, Scan, Bot
  },
  inject: ['showToast', 'getGuideEnabled'],
  data() {
    return {
      projectDir: '',
      detectedLang: null,
      parsing: false,
      parseProgress: '',
      parsePercent: 0,
      parseLogs: [],
      parseResult: null,
      selectedModules: [],
      expandedModules: new Set(),
      expandedApis: new Set(),
      docModules: JSON.parse(JSON.stringify(DEFAULT_DOC_MODULES)),
      groupByController: true,
      showModulePath: false,
      customPrefix: '',
      aiProcessing: false,
      aiProgressText: '',
      aiLogs: [],
      aiController: null,
      aiConfigs: [],
      selectedConfigId: null,
      guideVisible: true,
      guideSteps: [
        { target: 'api-select-dir', text: '选择 Spring Boot 项目的根目录', doneWhen: 'hasProject' },
        { target: 'api-start-parse', text: '点击开始解析接口文档', doneWhen: 'hasParsed' },
      ],
    }
  },
  computed: {
    totalApis() {
      if (!this.parseResult) return 0
      return this.parseResult.modules.reduce((s, m) => s + m.apis.length, 0)
    },
    filteredModules() {
      if (!this.parseResult) return []
      if (this.selectedModules.length === 0) return this.parseResult.modules
      return this.parseResult.modules.filter(m => this.selectedModules.includes(m.className))
    },
    filteredApis() {
      return this.filteredModules.reduce((s, m) => s + m.apis.length, 0)
    },
    methodStats() {
      const stats = {}
      for (const mod of this.filteredModules) {
        for (const api of mod.apis) {
          stats[api.method] = (stats[api.method] || 0) + 1
        }
      }
      return stats
    },
    enabledDocModules() {
      return this.docModules.filter(m => m.enabled)
    },
    guideConditions() {
      return {
        hasProject: !!this.projectDir,
        hasParsed: !!this.parseResult,
      }
    },
    displayModules() {
      const prefix = this.customPrefix ? this.customPrefix.replace(/\/+$/, '') : ''
      const addPrefix = (path) => {
        if (!prefix) return path
        const p = path.startsWith('/') ? path : '/' + path
        return (prefix + p).replace(/\/+/g, '/')
      }
      const stripPath = (name) => {
        if (this.showModulePath) return name
        return name.replace(/^\[.*?\]\s*/, '')
      }

      if (this.groupByController) {
        return this.filteredModules.map(mod => ({
          ...mod,
          name: stripPath(mod.name),
          apis: mod.apis.map(api => ({ ...api, displayPath: addPrefix(api.path) })),
        }))
      } else {
        return []
      }
    },
    flatApis() {
      if (this.groupByController) return []
      const prefix = this.customPrefix ? this.customPrefix.replace(/\/+$/, '') : ''
      const addPrefix = (path) => {
        if (!prefix) return path
        const p = path.startsWith('/') ? path : '/' + path
        return (prefix + p).replace(/\/+/g, '/')
      }
      const stripPath = (name) => {
        if (this.showModulePath) return name
        return name.replace(/^\[.*?\]\s*/, '')
      }
      const allApis = []
      for (const mod of this.filteredModules) {
        for (const api of mod.apis) {
          allApis.push({
            ...api,
            displayPath: addPrefix(api.path),
            _fromModule: stripPath(mod.name),
          })
        }
      }
      return allApis
    },
  },
  mounted() {
    this.guideVisible = localStorage.getItem('guideEnabled') !== 'false'
    this._guideHandler = (e) => { this.guideVisible = e.detail }
    window.addEventListener('guide-toggle', this._guideHandler)
  },
  beforeUnmount() {
    if (this._guideHandler) window.removeEventListener('guide-toggle', this._guideHandler)
  },
  methods: {
    // ===== 项目选择 =====
    async selectProject() {
      const dir = await open({ directory: true, multiple: false, title: '选择项目根目录' })
      if (!dir) return
      this.projectDir = dir
      this.parseResult = null
      this.selectedModules = []
      await this.detectLanguage()
    },
    clearProject() {
      this.projectDir = ''
      this.detectedLang = null
      this.parseResult = null
      this.selectedModules = []
    },

    // ===== 语言检测 =====
    async detectLanguage() {
      try {
        const result = await invoke('scan_directory', {
          dirPath: this.projectDir,
          customIgnore: [],
          useGitignore: true,
        })
        const fileNames = result.files.map(f => f.name)
        // 也检查根目录下的特征文件
        const rootFiles = result.files
          .filter(f => !f.relative_path.includes('/') && !f.relative_path.includes('\\'))
          .map(f => f.name)

        this.detectedLang = detectProjectLanguage(rootFiles)

        if (!this.detectedLang) {
          // 宽松匹配：检查所有文件名中是否包含特征文件
          this.detectedLang = detectProjectLanguage(fileNames)
        }

        if (this.detectedLang) {
          this.showToast(`已识别项目类型: ${this.detectedLang.label}`, 'success')
        } else {
          this.showToast('无法识别项目类型，请确认是否为支持的项目', 'warning')
        }
      } catch (e) {
        this.showToast('目录扫描失败: ' + String(e), 'error')
      }
    },

    // ===== 解析 =====
    async startParsing() {
      if (!this.projectDir || !this.detectedLang) return
      this.parsing = true
      this.parseLogs = []
      this.parsePercent = 0
      this.addLog('开始解析项目...')

      try {
        // 1. 扫描所有 Java 文件
        this.addLog('正在扫描 Java 文件...')
        this.parsePercent = 2
        const scanResult = await invoke('scan_directory', {
          dirPath: this.projectDir,
          customIgnore: ['**/test/**', '**/target/**', '**/build/**', '**/.git/**'],
          useGitignore: true,
        })

        const javaFiles = scanResult.files.filter(f => f.ext === '.java')
        if (javaFiles.length === 0) {
          this.showToast('未找到 Java 文件', 'warning')
          this.addLog('⚠️ 未找到 Java 文件')
          this.parsing = false
          return
        }

        this.addLog(`发现 ${javaFiles.length} 个 Java 文件`)
        this.parsePercent = 5

        // 2. 分批读取内容
        const allFiles = []
        for (let i = 0; i < javaFiles.length; i += 50) {
          const batch = javaFiles.slice(i, i + 50)
          const loaded = Math.min(i + 50, javaFiles.length)
          this.addLog(`正在读取文件 (${loaded}/${javaFiles.length})...`)
          this.parsePercent = 5 + Math.round((loaded / javaFiles.length) * 15)

          const readResult = await invoke('read_files_content', {
            files: batch.map(f => ({
              path: f.path,
              relative_path: f.relative_path,
              name: f.name,
              ext: f.ext,
            }))
          })

          for (const fc of readResult.files) {
            if (!fc.error && fc.content) {
              allFiles.push({
                name: fc.name,
                relative_path: fc.relative_path,
                content: fc.content,
              })
            }
          }
        }

        this.addLog(`文件读取完成，共 ${allFiles.length} 个有效文件`)

        // 3. 解析（带进度回调）
        await new Promise(r => setTimeout(r, 50))
        const result = await parseSpringBootProject(allFiles, (msg, pct) => {
          this.addLog(msg)
          this.parsePercent = 20 + Math.round(pct * 0.8)
        })

        this.parseResult = result
        this.selectedModules = result.modules.map(m => m.className)

        if (result.modules.length > 0) {
          this.expandedModules = new Set([result.modules[0].className])
        }

        const apiCount = result.modules.reduce((s, m) => s + m.apis.length, 0)
        this.parsePercent = 100
        this.addLog(`✅ 解析完成！${result.modules.length} 个模块，${apiCount} 个接口`)
        this.showToast(`解析完成！发现 ${result.modules.length} 个模块，${apiCount} 个接口`, 'success')
      } catch (e) {
        this.showToast('解析失败: ' + String(e), 'error')
        this.addLog('❌ 解析失败: ' + String(e))
        console.error(e)
      }

      // 保存日志到项目目录
      await this.saveParseLog()
      this.parsing = false
    },

    async saveParseLog() {
      if (!this.projectDir || this.parseLogs.length === 0) return
      try {
        const logContent = this.parseLogs.map(l => `[${l.time}] ${l.msg}`).join('\n')
        const logPath = this.projectDir + (this.projectDir.includes('/') ? '/' : '\\') + 'api-doc-parse.log'
        await writeTextFile(logPath, logContent)
        this.addLog(`📄 日志已保存: api-doc-parse.log`)
      } catch (e) {
        console.warn('保存日志失败:', e)
      }
    },

    addLog(msg) {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
      this.parseLogs.push({ time, msg })
      // 自动滚动到底部
      this.$nextTick(() => {
        const panel = this.$refs.logPanel
        if (panel) panel.scrollTop = panel.scrollHeight
      })
    },

    // ===== 模块筛选 =====
    selectAllModules() {
      if (this.parseResult) {
        this.selectedModules = this.parseResult.modules.map(m => m.className)
      }
    },
    deselectAllModules() {
      this.selectedModules = []
    },

    // ===== 展开/折叠 =====
    toggleModuleExpand(className) {
      const s = new Set(this.expandedModules)
      s.has(className) ? s.delete(className) : s.add(className)
      this.expandedModules = s
    },
    toggleApiExpand(key) {
      const s = new Set(this.expandedApis)
      s.has(key) ? s.delete(key) : s.add(key)
      this.expandedApis = s
    },

    // ===== 文档模块排序 =====
    moveModule(idx, direction) {
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= this.docModules.length) return
      const arr = [...this.docModules]
      const tmp = arr[idx]
      arr[idx] = arr[newIdx]
      arr[newIdx] = tmp
      this.docModules = arr
    },

    // ===== 导出 =====
    async exportMarkdown() {
      if (!this.parseResult) return
      const path = await save({
        title: '导出 Markdown',
        defaultPath: '接口文档.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })
      if (!path) return

      const filtered = { modules: this.filteredModules }
      const md = renderMarkdown(filtered, this.docModules)
      await writeTextFile(path, md)
      this.showToast('Markdown 文档已导出', 'success')
    },

    async exportWord() {
      if (!this.parseResult) return
      const path = await save({
        title: '导出 Word 文档',
        defaultPath: '接口文档.docx',
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      })
      if (!path) return

      try {
        const filtered = { modules: this.filteredModules }
        const buffer = await renderDocx(filtered, this.docModules)
        await writeFile(path, buffer)
        this.showToast('Word 文档已导出', 'success')
      } catch (e) {
        this.showToast('Word 导出失败: ' + String(e), 'error')
      }
    },

    // ===== 占位符 =====
    checkPlaceholder(text) {
      return isPlaceholder(text)
    },

    onApiDescEdit(api, event) {
      const newText = event.target.innerText.trim()
      if (newText && newText !== api.description) {
        api.description = newText
      }
    },

    onFieldDescEdit(api, section, event, field) {
      const newText = event.target.innerText.trim()
      if (newText && newText !== field.description) {
        field.description = newText
      }
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
      if (!this.parseResult || this.aiProcessing) return

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
        const result = await fillApiDocPlaceholders(
          config,
          this.parseResult,
          (msg, level) => {
            this.addAiLog(msg, level)
            this.aiProgressText = msg
          },
          (batchName, filled, batchTotal) => {
            // 每批完成后实时刷新视图
            this.parseResult = { ...this.parseResult }
          },
          this.aiController,
        )

        if (result.total === 0) {
          this.showToast('没有需要补充的占位符', 'info')
        } else {
          this.showToast(`AI 补充完成: ${result.filled}/${result.total} 个字段已填充`, 'success')
          this.parseResult = { ...this.parseResult }
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
