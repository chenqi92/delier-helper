<template>
  <div style="display:flex;flex-direction:column;height:100%;">
    <GuideTour
      :steps="guideSteps"
      :enabled="guideVisible"
      :active="isActive"
      :conditions="guideConditions"
      @finish="guideFinished = true"
    />
    <!-- 头部操作栏 -->
    <div class="view-header">
      <div class="header-title">
        <Plug :size="16" />
        <span>接口文档</span>
      </div>
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
            <button class="btn btn-danger btn-sm" @click="cancelAi" title="取消">✕ 取消</button>
          </template>
          <select class="ai-model-select" v-model="selectedProviderId" :disabled="aiProcessing" @change="onProviderSelect">
            <option v-for="p in globalStore.providerConfigs" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
          <select class="ai-model-select" v-model="selectedModelId" :disabled="aiProcessing">
            <option v-for="m in currentProviderModels" :key="m.id" :value="m.id">{{ m.label || m.id }}</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" @click="exportWord" :disabled="!parseResult || exporting">
          <FileDown :size="14" /> {{ exporting ? '导出中...' : '导出 Word' }}
        </button>
        <button class="btn btn-secondary btn-sm" @click="exportMarkdown" :disabled="!parseResult || exporting">
          <FileDown :size="14" /> 导出 MD
        </button>
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
              <span>选择项目根目录（支持 Java / Go / Python / Rust）</span>
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
            <div v-if="recentProjects.length > 0 && !projectDir" class="recent-dirs">
              <span class="recent-dirs-label">最近使用</span>
              <button v-for="rp in recentProjects" :key="rp" class="recent-dir-item" @click="useRecentDir(rp)" :title="rp">
                {{ rp.split('/').pop() || rp }}
              </button>
            </div>
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
              <input type="checkbox" v-model="groupByController" @change="onGroupModeChange" />
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
            <input
              v-if="parseResult.modules.length > moduleSelectorLimit"
              v-model.trim="moduleSearch"
              class="setting-input"
              style="width:100%;margin:6px 0;"
              placeholder="搜索模块/Controller"
            />
            <div style="max-height:160px;overflow-y:auto;">
              <label v-for="mod in selectableModules" :key="mod.className" class="checkbox-label" style="display:flex;margin-bottom:4px;">
                <input type="checkbox" :value="mod.className" v-model="selectedModules" @change="onModuleSelectionChange" />
                <span>{{ mod.name }} <span style="color:var(--text-muted);font-size:11px;">({{ moduleApiCount(mod) }})</span></span>
              </label>
            </div>
            <div v-if="matchingModules.length > selectableModules.length" style="margin-top:6px;font-size:11px;color:var(--text-muted);">
              当前显示前 {{ selectableModules.length }} 项，请输入关键词缩小范围
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
          <p class="hint">{{ projectDir ? '点击左侧"开始解析"按钮分析项目接口。' : '请先在左侧选择项目目录（支持 Java / Go / Python / Rust）。' }}</p>
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
                  <span class="api-module-name">{{ formatModuleName(mod.name) }}</span>
                  <span class="badge badge-primary">{{ moduleApiCount(mod) }}</span>
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
                      <span class="api-path">{{ formatDisplayPath(api.path) }}</span>
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
                        <div v-if="api.requestBody && bodyFields(api.requestBody).length > 0" class="detail-section">
                          <div class="detail-label">请求体 ({{ api.requestBody.type }})</div>
                          <table class="detail-table">
                            <thead><tr><th>参数名</th><th>类型</th><th>必须</th><th>说明</th></tr></thead>
                            <tbody>
                              <tr v-for="f in bodyFields(api.requestBody)" :key="f.name">
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
                      <div v-if="dm.id === 'response' && api.response && bodyFields(api.response).length > 0" class="detail-section">
                        <div class="detail-label">返回数据 ({{ api.response.type }})</div>
                        <table class="detail-table">
                          <thead><tr><th>参数名</th><th>类型</th><th>说明</th></tr></thead>
                          <tbody>
                            <tr v-for="f in bodyFields(api.response)" :key="f.name">
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
                      <div v-if="dm.id === 'requestExample' && api.requestBody && bodyExample(api.requestBody)" class="detail-section">
                        <div class="detail-label">请求示例</div>
                        <pre class="detail-json">{{ bodyExampleJson(api.requestBody) }}</pre>
                      </div>

                      <!-- 返回示例 -->
                      <div v-if="dm.id === 'responseExample' && api.response && bodyExample(api.response)" class="detail-section">
                        <div class="detail-label">返回示例</div>
                        <pre class="detail-json">{{ bodyExampleJson(api.response) }}</pre>
                      </div>
                    </template>
                  </div>
                </div>
                <button
                  v-if="diskBacked && mod.apis.length < moduleApiCount(mod)"
                  class="btn btn-secondary btn-sm"
                  style="width:100%;margin:8px 0;"
                  :disabled="mod._loading"
                  @click="loadMoreModuleApis(mod)"
                >
                  {{ mod._loading ? '加载中...' : `继续加载（${mod.apis.length}/${moduleApiCount(mod)}）` }}
                </button>
              </div>
            </div>
            <button
              v-if="groupByController && displayModules.length < filteredModules.length"
              class="btn btn-secondary btn-sm"
              style="width:100%;margin-top:8px;"
              @click="visibleModuleCount += modulePageSize"
            >
              继续加载（已显示 {{ displayModules.length }}/{{ filteredModules.length }} 个模块）
            </button>

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
                      <div v-if="api.response && bodyFields(api.response).length > 0" class="detail-section">
                        <div class="detail-label">返回数据 ({{ api.response.type }})</div>
                        <table class="detail-table">
                          <thead><tr><th>参数名</th><th>类型</th><th>说明</th></tr></thead>
                          <tbody>
                            <tr v-for="f in bodyFields(api.response)" :key="f.name">
                              <td><code>{{ f.name }}</code></td><td>{{ f.type }}</td><td>{{ f.description || '-' }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </template>
                    <div v-if="dm.id === 'requestExample' && api.requestBody && bodyExample(api.requestBody)" class="detail-section">
                      <div class="detail-label">请求示例</div>
                      <pre class="detail-json">{{ bodyExampleJson(api.requestBody) }}</pre>
                    </div>
                    <div v-if="dm.id === 'responseExample' && api.response && bodyExample(api.response)" class="detail-section">
                      <div class="detail-label">返回示例</div>
                      <pre class="detail-json">{{ bodyExampleJson(api.response) }}</pre>
                    </div>
                  </template>
                </div>
              </div>
            </div>
            <button
              v-if="!groupByController && flatApis.length < filteredApis"
              class="btn btn-secondary btn-sm"
              style="width:100%;margin-top:8px;"
              :disabled="flatLoading"
              @click="loadMoreFlatApis"
            >
              {{ flatLoading ? '加载中...' : `继续加载（已显示 ${flatApis.length}/${filteredApis} 个接口）` }}
            </button>

          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script>
import { markRaw } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { detectProjectLanguage, parseProject } from '../core/api-doc/parser-registry.js'
import { createSpringBootParseSession, isPlaceholder } from '../core/api-doc/spring-boot-parser.js'
import { buildTypeIndex } from '../core/api-doc/java-type-resolver.js'
import { renderMarkdown, renderDocx, DEFAULT_DOC_MODULES } from '../core/api-doc/api-doc-renderer.js'
import { loadProviderConfigs, loadActiveSelection, fillApiDocPlaceholders, createAiController, getResolvedConfig } from '../core/llm/llm-service.js'
import { saveRecentProject, getRecentProjects, getSetting, setSetting } from '../core/db.js'
import { apiArtifact, modelSnapshot, saveHistoryRecord } from '../core/generation-history.js'
import { createApiSchemaAccessor } from '../core/api-doc/api-schema-accessor.js'
import {
  appendApiDocModules, createApiDocJob, finishApiDocJob, getApiDocJob,
  groupStoredApis, listApiDocModules, queryApiDocApis, updateApiDocApis,
} from '../core/api-doc/api-doc-store.js'
import GuideTour from '../components/GuideTour.vue'
import {
  FolderOpen, Search, X, Lightbulb, Check, FileDown, FileText,
  Plug, Filter, Settings, ChevronRight, Scan, Bot
} from 'lucide-vue-next'

const MAX_API_SOURCE_FILE_BYTES = 5 * 1024 * 1024
const API_READ_BATCH_SIZE = 25
const MAX_WORD_APIS_PER_FILE = 300
const MAX_MARKDOWN_APIS_PER_FILE = 1500
const MODULE_API_PAGE_SIZE = 200

function splitModulesByApiLimit(modules, maxApis) {
  const parts = []
  let current = []
  let currentCount = 0
  const flush = () => {
    if (current.length > 0) parts.push(current)
    current = []
    currentCount = 0
  }

  for (const mod of modules) {
    for (let offset = 0; offset < mod.apis.length; offset += maxApis) {
      const apiSlice = mod.apis.slice(offset, offset + maxApis)
      if (currentCount > 0 && currentCount + apiSlice.length > maxApis) flush()
      current.push(apiSlice.length === mod.apis.length ? mod : {
        ...mod,
        className: `${mod.className}__part_${Math.floor(offset / maxApis) + 1}`,
        name: `${mod.name}（续）`,
        apis: apiSlice,
      })
      currentCount += apiSlice.length
      if (currentCount >= maxApis) flush()
    }
  }
  flush()
  return parts
}

function buildPartPath(path, index, total) {
  if (total <= 1) return path
  const dot = path.lastIndexOf('.')
  const suffix = `-part-${String(index + 1).padStart(2, '0')}`
  return dot > 0 ? `${path.slice(0, dot)}${suffix}${path.slice(dot)}` : `${path}${suffix}`
}

function memorySuffix() {
  const memory = typeof performance !== 'undefined' ? performance.memory : null
  if (!memory?.usedJSHeapSize) return ''
  return `，JS 堆 ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(0)}/${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0)} MB`
}

function compactSchemaStats(result) {
  const seenFieldLists = new Set()
  let fieldCount = 0
  for (const mod of result?.modules || []) {
    for (const api of mod.apis || []) {
      for (const body of [api.requestBody, api.response]) {
        if (!Array.isArray(body?.fields) || seenFieldLists.has(body.fields)) continue
        seenFieldLists.add(body.fields)
        fieldCount += body.fields.length
      }
    }
  }
  return { schemaCount: seenFieldLists.size, fieldCount }
}

export default {
  name: 'ApiDocGenerator',
  components: {
    GuideTour,
    FolderOpen, Search, X, Lightbulb, Check, FileDown, FileText,
    Plug, Filter, Settings, ChevronRight, Scan, Bot
  },
  inject: ['showToast', 'guide', 'globalStore'],
  data() {
    return {
      projectDir: '',
      detectedLang: null,
      parsing: false,
      parseProgress: '',
      parsePercent: 0,
      parseLogs: [],
      parseResult: null,
      apiDocJobId: null,
      diskBacked: false,
      schemaAccessor: null,
      flatApiRows: [],
      flatLoading: false,
      flatLoadToken: 0,
      selectedModules: [],
      moduleSearch: '',
      moduleSelectorLimit: 300,
      modulePageSize: 150,
      apiPageSize: 300,
      visibleModuleCount: 150,
      visibleApiCount: 300,
      expandedModules: new Set(),
      expandedApis: new Set(),
      docModules: JSON.parse(JSON.stringify(DEFAULT_DOC_MODULES)),
      groupByController: true,
      showModulePath: false,
      customPrefix: '',
      aiProcessing: false,
      exporting: false,
      aiProgressText: '',
      aiLogs: [],
      aiController: null,
      selectedProviderId: null,
      selectedModelId: null,
      guideFinished: false,
      isActive: true,
      recentProjects: [],
      guideSteps: [
        { target: 'api-select-dir', text: '选择项目根目录（支持 Java / Go / Python / Rust）', doneWhen: 'hasProject' },
        { target: 'api-start-parse', text: '点击开始解析接口文档', doneWhen: 'hasParsed' },
      ],
    }
  },
  async created() {
    this.syncSelectionFromStore()
    this.recentProjects = (await getRecentProjects('api-doc').catch(() => [])).map(r => r.path)
    const gf = await getSetting('guide-finished-api', false).catch(() => false)
    if (gf) this.guideFinished = true
  },
  watch: {
    guideFinished(val) { if (val) setSetting('guide-finished-api', true).catch(() => {}) },
  },
  computed: {
    totalApis() {
      if (!this.parseResult) return 0
      return this.parseResult.modules.reduce((s, m) => s + this.moduleApiCount(m), 0)
    },
    currentProviderModels() {
      const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      return p ? p.models : []
    },
    selectedModuleSet() {
      return new Set(this.selectedModules)
    },
    filteredModules() {
      if (!this.parseResult) return []
      return this.parseResult.modules.filter(m => this.selectedModuleSet.has(m.className))
    },
    matchingModules() {
      if (!this.parseResult) return []
      const query = this.moduleSearch.toLowerCase()
      if (!query) return this.parseResult.modules
      return this.parseResult.modules.filter(mod =>
        `${mod.name || ''} ${mod.className || ''} ${mod.file || ''}`.toLowerCase().includes(query)
      )
    },
    selectableModules() {
      return this.matchingModules.slice(0, this.moduleSelectorLimit)
    },
    filteredApis() {
      return this.filteredModules.reduce((s, m) => s + this.moduleApiCount(m), 0)
    },
    methodStats() {
      const stats = {}
      for (const mod of this.filteredModules) {
        if (this.diskBacked && mod.methodStats) {
          for (const [method, count] of Object.entries(mod.methodStats)) {
            stats[method] = (stats[method] || 0) + Number(count || 0)
          }
        } else {
          for (const api of mod.apis) {
            stats[api.method] = (stats[api.method] || 0) + 1
          }
        }
      }
      return stats
    },
    enabledDocModules() {
      return this.docModules.filter(m => m.enabled)
    },
    guideVisible() {
      if (this.guideFinished) return false
      return !!this.guide?.enabled
    },
    guideConditions() {
      return {
        hasProject: !!this.projectDir,
        hasParsed: !!this.parseResult,
      }
    },
    displayModules() {
      if (this.groupByController) {
        return this.filteredModules.slice(0, this.visibleModuleCount)
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
      if (this.diskBacked) {
        return this.flatApiRows.map(api => ({
          ...api,
          displayPath: addPrefix(api.path),
          _fromModule: stripPath(api._moduleName),
        }))
      }
      const allApis = []
      let reachedLimit = false
      for (const mod of this.filteredModules) {
        for (const api of mod.apis) {
          if (allApis.length >= this.visibleApiCount) {
            reachedLimit = true
            break
          }
          allApis.push({
            ...api,
            displayPath: addPrefix(api.path),
            _fromModule: stripPath(mod.name),
          })
        }
        if (reachedLimit) break
      }
      return allApis
    },
  },
  watch: {
    'guide.enabled'(val) { if (val) this.guideFinished = false },
  },
  activated() {
    this.isActive = true
    this.syncSelectionFromStore()
  },
  deactivated() {
    this.isActive = false
  },
  methods: {
    // ===== 项目选择 =====
    async selectProject() {
      const dir = await open({ directory: true, multiple: false, title: '选择项目根目录' })
      if (!dir) return
      this.projectDir = dir
      saveRecentProject(dir, 'api-doc').catch(() => {})
      this.parseResult = null
      this.apiDocJobId = null
      this.diskBacked = false
      this.schemaAccessor = null
      this.selectedModules = []
      this.flatApiRows = []
      await this.detectLanguage()
    },
    clearProject() {
      this.projectDir = ''
      this.detectedLang = null
      this.parseResult = null
      this.apiDocJobId = null
      this.diskBacked = false
      this.schemaAccessor = null
      this.selectedModules = []
      this.flatApiRows = []
    },
    useRecentDir(path) {
      this.projectDir = path
      this.parseResult = null
      this.apiDocJobId = null
      this.diskBacked = false
      this.schemaAccessor = null
      this.selectedModules = []
      this.flatApiRows = []
      this.detectLanguage()
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
      this.parseResult = null
      this.apiDocJobId = null
      this.diskBacked = false
      this.schemaAccessor = null
      this.selectedModules = []
      this.flatApiRows = []
      this.expandedModules = new Set()
      this.expandedApis = new Set()
      this.moduleSearch = ''
      this.visibleModuleCount = this.modulePageSize
      this.visibleApiCount = this.apiPageSize
      this.parsing = true
      this.parsePercent = 0
      this.parseProgress = '准备解析...'
      window.dispatchEvent(new CustomEvent('ai-fill-start'))
      const lang = this.detectedLang
      this.addLog(`开始解析 ${lang.label} 项目...`)

      try {
        // 1. 扫描源文件
        const ext = lang.sourceExt
        const ignorePatterns = [
          '**/.git/**',
          ...(lang.ignorePatterns || []),
        ]
        this.addLog(`正在扫描 ${ext} 文件...`)
        this.parsePercent = 2
        const scanResult = await invoke('scan_directory', {
          dirPath: this.projectDir,
          customIgnore: ignorePatterns,
          useGitignore: true,
        })

        const matchedSourceFiles = scanResult.files.filter(f => f.ext === ext)
        const sourceFiles = matchedSourceFiles.filter(f => Number(f.size || 0) <= MAX_API_SOURCE_FILE_BYTES)
        const oversizedSourceFiles = matchedSourceFiles.length - sourceFiles.length
        if (sourceFiles.length === 0) {
          const message = oversizedSourceFiles > 0
            ? `${oversizedSourceFiles} 个 ${ext} 文件均超过 5MB，请拆分后重试`
            : `未找到 ${ext} 文件`
          this.showToast(message, 'warning')
          this.addLog(`[警告] ${message}`)
          this.parsing = false
          return
        }

        this.addLog(`发现 ${sourceFiles.length} 个 ${ext} 文件`)
        const sourceBytes = sourceFiles.reduce((sum, file) => sum + Number(file.size || 0), 0)
        this.addLog(`源码总量 ${(sourceBytes / 1024 / 1024).toFixed(1)} MB${memorySuffix()}`)
        if (oversizedSourceFiles > 0) {
          this.addLog(`[稳定性限流] 已跳过 ${oversizedSourceFiles} 个超过 5MB 的超大源码文件`)
        }
        this.parsePercent = 5

        if (lang.id === 'spring-boot') {
          await this.parseSpringBootToStore(sourceFiles, sourceBytes, lang)
          this.parsing = false
          return
        }

        // 2. 分批读取内容
        const allFiles = []
        for (let i = 0; i < sourceFiles.length; i += API_READ_BATCH_SIZE) {
          const batch = sourceFiles.slice(i, i + API_READ_BATCH_SIZE)
          const loaded = Math.min(i + API_READ_BATCH_SIZE, sourceFiles.length)
          this.addLog(`正在读取文件 (${loaded}/${sourceFiles.length})...`)
          this.parsePercent = 5 + Math.round((loaded / sourceFiles.length) * 15)

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
        this.addLog(`准备构建紧凑类型索引${memorySuffix()}`)

        // 3. 动态调度对应解析器
        await new Promise(r => setTimeout(r, 50))
        let lastProgressPercent = -1
        const parsedFileCount = allFiles.length
        const result = await parseProject(lang.id, allFiles, (msg, pct) => {
          const normalizedPercent = Math.max(0, Math.min(100, Math.round(pct)))
          this.parsePercent = 20 + Math.round(normalizedPercent * 0.8)
          const isImportant = /\[(?:警告|失败)\]/.test(msg) || normalizedPercent === 100
          if (isImportant || normalizedPercent !== lastProgressPercent) {
            lastProgressPercent = normalizedPercent
            this.parseProgress = msg
            this.addLog(msg)
          }
        })

        // 解析完成后立即释放源码字符串，避免和解析结果、历史快照同时占用内存。
        allFiles.length = 0
        this.parseResult = markRaw(result)
        this.schemaAccessor = markRaw(createApiSchemaAccessor(result, { maxExampleCache: 120 }))
        this.selectedModules = result.modules.map(m => m.className)

        const apiCount = result.modules.reduce((s, m) => s + m.apis.length, 0)
        if (result.modules.length > 0 && apiCount <= 2000) {
          this.expandedModules = new Set([result.modules[0].className])
        } else {
          this.expandedModules = new Set()
        }

        const schemaStats = compactSchemaStats(result)
        this.parsePercent = 100
        this.parseProgress = '解析完成'
        this.addLog(`[完成] 解析完成！${result.modules.length} 个模块，${apiCount} 个接口`)
        this.addLog(`[内存优化] ${schemaStats.schemaCount} 份共享类型结构、${schemaStats.fieldCount} 个字段；示例改为按需生成${memorySuffix()}`)
        if (apiCount > 2000) {
          this.addLog('[大项目模式] 默认折叠全部模块，展开时再渲染接口详情')
        }
        await saveHistoryRecord({
          type: 'api-doc',
          title: `${this.projectDir.split(/[/\\]/).pop() || '项目'} 接口文档`,
          summary: `${result.modules.length} 个模块，${apiCount} 个接口`,
          source: {
            projectDir: this.projectDir,
            language: lang,
            sourceFileCount: sourceFiles.length,
            parsedFileCount,
          },
          settings: {
            customPrefix: this.customPrefix,
            groupByController: this.groupByController,
            showModulePath: this.showModulePath,
            docModules: this.docModules,
          },
          result: {
            moduleCount: result.modules.length,
            apiCount,
            selectedModules: this.selectedModules,
          },
          artifact: apiArtifact(result, this.docModules),
        })
        this.showToast(`解析完成！发现 ${result.modules.length} 个模块，${apiCount} 个接口`, 'success')
      } catch (e) {
        this.showToast('解析失败: ' + String(e), 'error')
        this.addLog('[失败] 解析失败: ' + String(e))
        console.error(e)
      }

      this.parsing = false
    },

    async parseSpringBootToStore(sourceFiles, sourceBytes, lang) {
      let jobId = null
      let session = null
      try {
        jobId = await createApiDocJob(
          this.projectDir,
          lang.id,
          sourceFiles.length,
          sourceBytes,
        )
        this.apiDocJobId = jobId
        this.diskBacked = true
        this.addLog(`[磁盘缓存] 已创建任务 ${jobId}，SQLite WAL + 单写/多读连接池`)

        // 第一遍只构建紧凑类型索引，并记录 Controller 路径；源码按批次立即释放。
        const typeIndex = new Map()
        const controllerFiles = []
        for (let i = 0; i < sourceFiles.length; i += API_READ_BATCH_SIZE) {
          const batch = sourceFiles.slice(i, i + API_READ_BATCH_SIZE)
          const readResult = await invoke('read_files_content', {
            files: batch.map(file => ({
              path: file.path,
              relative_path: file.relative_path,
              name: file.name,
              ext: file.ext,
            })),
          })
          const loadedFiles = []
          for (const file of readResult.files) {
            if (file.error || !file.content) continue
            loadedFiles.push({
              name: file.name,
              relative_path: file.relative_path,
              content: file.content,
            })
            if (/@(?:Rest)?Controller\b/.test(file.content)) {
              controllerFiles.push({
                path: file.path,
                relative_path: file.relative_path,
                name: file.name,
                ext: file.ext,
              })
            }
          }
          buildTypeIndex(loadedFiles, typeIndex)
          for (const file of loadedFiles) file.content = ''

          const loaded = Math.min(i + API_READ_BATCH_SIZE, sourceFiles.length)
          this.parsePercent = 5 + Math.round((loaded / sourceFiles.length) * 35)
          this.parseProgress = `构建类型索引 (${loaded}/${sourceFiles.length})`
          if (loaded === sourceFiles.length || loaded % 250 === 0) {
            this.addLog(`类型索引 ${loaded}/${sourceFiles.length}，${typeIndex.size} 个类型${memorySuffix()}`)
          }
          await new Promise(resolve => setTimeout(resolve, 0))
        }

        this.addLog(`[流式解析] 第一遍完成：${typeIndex.size} 个类型，${controllerFiles.length} 个 Controller`)
        session = createSpringBootParseSession(typeIndex)
        const schemaStats = new Map()

        // 第二遍只重读 Controller；解析一批、事务写入一批，然后释放该批对象。
        for (let i = 0; i < controllerFiles.length; i += API_READ_BATCH_SIZE) {
          const batch = controllerFiles.slice(i, i + API_READ_BATCH_SIZE)
          const readResult = await invoke('read_files_content', { files: batch })
          const loadedControllers = readResult.files
            .filter(file => !file.error && file.content)
            .map(file => ({
              name: file.name,
              relative_path: file.relative_path,
              content: file.content,
            }))
          const modules = await session.parseControllers(loadedControllers, {
            onWarning: (file, error) => this.addLog(`[警告] ${file.name}: ${error.message}`),
          })

          for (const module of modules) {
            for (const api of module.apis) {
              for (const body of [api.requestBody, api.response]) {
                if (body?.type && !schemaStats.has(body.type)) {
                  schemaStats.set(body.type, body.fields?.length || 0)
                }
              }
            }
          }

          await appendApiDocModules(
            jobId,
            modules,
            sourceFiles.length,
          )

          const parsed = Math.min(i + API_READ_BATCH_SIZE, controllerFiles.length)
          this.parsePercent = 40 + Math.round((parsed / Math.max(1, controllerFiles.length)) * 55)
          this.parseProgress = `解析并写入接口 (${parsed}/${controllerFiles.length})`
          this.addLog(`已解析并入库 Controller ${parsed}/${controllerFiles.length}`)
          modules.length = 0
          await new Promise(resolve => setTimeout(resolve, 0))
        }

        await finishApiDocJob(jobId, 'completed')
        const [job, modules] = await Promise.all([
          getApiDocJob(jobId),
          listApiDocModules(jobId),
        ])
        if (!job) throw new Error('接口文档任务写入后无法读取')

        this.parseResult = { modules }
        this.schemaAccessor = markRaw(createApiSchemaAccessor(this.parseResult, { maxExampleCache: 80 }))
        this.selectedModules = modules.map(module => module.className)
        this.expandedModules = new Set()
        this.expandedApis = new Set()
        this.flatApiRows = []

        if (job.apiCount <= 2000 && modules.length > 0) {
          this.expandedModules = new Set([modules[0].className])
          await this.loadMoreModuleApis(this.parseResult.modules[0])
        }

        this.parsePercent = 100
        this.parseProgress = '解析完成'
        const fieldCount = [...schemaStats.values()].reduce((sum, count) => sum + count, 0)
        this.addLog(`[完成] ${job.moduleCount} 个模块，${job.apiCount} 个接口`)
        this.addLog(`[磁盘模式] ${schemaStats.size} 份共享结构、${fieldCount} 个字段；WebView 仅保留已展开页面${memorySuffix()}`)
        if (job.apiCount > 2000) {
          this.addLog('[大项目模式] 接口详情按页从 SQLite 读取，折叠后释放页面缓存')
        }

        await saveHistoryRecord({
          type: 'api-doc',
          title: `${this.projectDir.split(/[/\\]/).pop() || '项目'} 接口文档`,
          summary: `${job.moduleCount} 个模块，${job.apiCount} 个接口`,
          source: {
            projectDir: this.projectDir,
            language: lang,
            sourceFileCount: sourceFiles.length,
            parsedFileCount: sourceFiles.length,
            apiDocJobId: jobId,
          },
          settings: {
            customPrefix: this.customPrefix,
            groupByController: this.groupByController,
            showModulePath: this.showModulePath,
            docModules: this.docModules,
          },
          result: {
            moduleCount: job.moduleCount,
            apiCount: job.apiCount,
            selectedModules: this.selectedModules,
            diskBacked: true,
          },
          artifact: apiArtifact(this.parseResult, this.docModules),
        })
        this.showToast(`解析完成！发现 ${job.moduleCount} 个模块，${job.apiCount} 个接口`, 'success')
      } catch (error) {
        if (jobId) await finishApiDocJob(jobId, 'failed', String(error)).catch(() => {})
        throw error
      } finally {
        session?.dispose()
      }
    },



    addLog(msg) {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
      window.dispatchEvent(new CustomEvent('ai-log', { detail: { time, msg, level: 'info' } }))
    },

    // ===== 模块筛选 =====
    moduleApiCount(module) {
      return Number(module?.apiCount ?? module?.apis?.length ?? 0)
    },
    selectAllModules() {
      if (this.parseResult) {
        this.selectedModules = this.parseResult.modules.map(m => m.className)
        this.onModuleSelectionChange()
      }
    },
    deselectAllModules() {
      this.selectedModules = []
      this.onModuleSelectionChange()
    },
    onModuleSelectionChange() {
      if (this.diskBacked && !this.groupByController) this.loadFlatApiPage(true)
    },
    onGroupModeChange() {
      this.expandedApis = new Set()
      if (this.diskBacked && !this.groupByController) this.loadFlatApiPage(true)
    },
    async loadFlatApiPage(reset = false) {
      if (!this.diskBacked || !this.apiDocJobId || this.flatLoading) return
      const token = ++this.flatLoadToken
      if (reset) this.flatApiRows = []
      if (this.selectedModules.length === 0) return
      this.flatLoading = true
      try {
        const page = await queryApiDocApis(this.apiDocJobId, {
          classNames: this.selectedModules,
          limit: this.apiPageSize,
          offset: this.flatApiRows.length,
        })
        if (token !== this.flatLoadToken) return
        this.flatApiRows.push(...page.items)
        this.visibleApiCount = this.flatApiRows.length
      } catch (error) {
        this.showToast('接口分页读取失败: ' + String(error), 'error')
      } finally {
        if (token === this.flatLoadToken) this.flatLoading = false
      }
    },
    async loadMoreFlatApis() {
      await this.loadFlatApiPage(false)
    },

    // ===== 展开/折叠 =====
    async toggleModuleExpand(className) {
      const s = new Set(this.expandedModules)
      const opening = !s.has(className)
      opening ? s.add(className) : s.delete(className)
      this.expandedModules = s
      if (!this.diskBacked) return
      const module = this.parseResult?.modules.find(item => item.className === className)
      if (!module) return
      if (opening) {
        await this.loadMoreModuleApis(module)
      } else {
        // 完整结果已在 SQLite，折叠即可释放 WebView 中的详情对象。
        module.apis.splice(0, module.apis.length)
        module._loaded = false
        this.expandedApis = new Set([...this.expandedApis].filter(key => !key.startsWith(`${className}.`)))
      }
    },
    async loadMoreModuleApis(module) {
      if (!this.diskBacked || !this.apiDocJobId || !module || module._loading) return
      if (module.apis.length >= this.moduleApiCount(module)) {
        module._loaded = true
        return
      }
      module._loading = true
      try {
        const page = await queryApiDocApis(this.apiDocJobId, {
          moduleId: module.id,
          limit: MODULE_API_PAGE_SIZE,
          offset: module.apis.length,
        })
        module.apis.push(...page.items)
        module._loaded = module.apis.length >= this.moduleApiCount(module)
      } catch (error) {
        this.showToast(`读取 ${module.name} 失败: ${String(error)}`, 'error')
      } finally {
        module._loading = false
      }
    },
    toggleApiExpand(key) {
      const s = new Set(this.expandedApis)
      s.has(key) ? s.delete(key) : s.add(key)
      this.expandedApis = s
    },

    formatModuleName(name) {
      if (this.showModulePath) return name
      return String(name || '').replace(/^\[.*?\]\s*/, '')
    },

    formatDisplayPath(path) {
      const prefix = this.customPrefix ? this.customPrefix.replace(/\/+$/, '') : ''
      if (!prefix) return path
      const normalizedPath = String(path || '').startsWith('/') ? path : '/' + path
      return (prefix + normalizedPath).replace(/\/+/g, '/')
    },

    bodyFields(body) {
      return this.schemaAccessor?.getFields(body) || body?.fields || []
    },
    bodyExample(body) {
      return this.schemaAccessor?.getExample(body) ?? body?.example ?? null
    },
    bodyExampleJson(body) {
      const example = this.bodyExample(body)
      return example == null ? '' : JSON.stringify(example, null, 2)
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
      if (!this.parseResult || this.exporting) return
      const path = await save({
        title: '导出 Markdown',
        defaultPath: '接口文档.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })
      if (!path) return

      this.exporting = true
      try {
        if (this.diskBacked) {
          const total = this.filteredApis
          if (total === 0) throw new Error('请至少选择一个包含接口的模块')
          const partCount = Math.ceil(total / MAX_MARKDOWN_APIS_PER_FILE)
          for (let i = 0; i < partCount; i++) {
            const page = await queryApiDocApis(this.apiDocJobId, {
              classNames: this.selectedModules,
              limit: MAX_MARKDOWN_APIS_PER_FILE,
              offset: i * MAX_MARKDOWN_APIS_PER_FILE,
            })
            const md = renderMarkdown({ modules: groupStoredApis(page.items) }, this.docModules)
            await writeTextFile(buildPartPath(path, i, partCount), md)
            this.addLog(`Markdown 导出 ${i + 1}/${partCount}`)
            await new Promise(resolve => setTimeout(resolve, 0))
          }
          this.showToast(partCount > 1 ? `Markdown 已分为 ${partCount} 个文件导出` : 'Markdown 文档已导出', 'success')
          return
        }
        const parts = splitModulesByApiLimit(this.filteredModules, MAX_MARKDOWN_APIS_PER_FILE)
        for (let i = 0; i < parts.length; i++) {
          const filtered = { modules: parts[i], typeIndex: this.parseResult.typeIndex }
          const md = renderMarkdown(filtered, this.docModules)
          await writeTextFile(buildPartPath(path, i, parts.length), md)
          await new Promise(resolve => setTimeout(resolve, 0))
        }
        this.showToast(parts.length > 1 ? `Markdown 已分为 ${parts.length} 个文件导出` : 'Markdown 文档已导出', 'success')
      } catch (e) {
        this.showToast('Markdown 导出失败: ' + String(e), 'error')
      } finally {
        this.exporting = false
      }
    },

    async exportWord() {
      if (!this.parseResult || this.exporting) return
      const path = await save({
        title: '导出 Word 文档',
        defaultPath: '接口文档.docx',
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      })
      if (!path) return

      try {
        this.exporting = true
        if (this.diskBacked) {
          const total = this.filteredApis
          if (total === 0) throw new Error('请至少选择一个包含接口的模块')
          const partCount = Math.ceil(total / MAX_WORD_APIS_PER_FILE)
          for (let i = 0; i < partCount; i++) {
            const page = await queryApiDocApis(this.apiDocJobId, {
              classNames: this.selectedModules,
              limit: MAX_WORD_APIS_PER_FILE,
              offset: i * MAX_WORD_APIS_PER_FILE,
            })
            const buffer = await renderDocx({ modules: groupStoredApis(page.items) }, this.docModules)
            await writeFile(buildPartPath(path, i, partCount), buffer)
            this.addLog(`Word 导出 ${i + 1}/${partCount}`)
            await new Promise(resolve => setTimeout(resolve, 0))
          }
          this.showToast(partCount > 1 ? `Word 已分为 ${partCount} 个文件导出` : 'Word 文档已导出', 'success')
          return
        }
        const parts = splitModulesByApiLimit(this.filteredModules, MAX_WORD_APIS_PER_FILE)
        for (let i = 0; i < parts.length; i++) {
          const filtered = { modules: parts[i], typeIndex: this.parseResult.typeIndex }
          const buffer = await renderDocx(filtered, this.docModules)
          await writeFile(buildPartPath(path, i, parts.length), buffer)
          await new Promise(resolve => setTimeout(resolve, 0))
        }
        this.showToast(parts.length > 1 ? `Word 已分为 ${parts.length} 个文件导出` : 'Word 文档已导出', 'success')
      } catch (e) {
        this.showToast('Word 导出失败: ' + String(e), 'error')
      } finally {
        this.exporting = false
      }
    },

    // ===== 占位符 =====
    checkPlaceholder(text) {
      return isPlaceholder(text)
    },

    async onApiDescEdit(api, event) {
      const newText = event.target.innerText.trim()
      if (newText && newText !== api.description) {
        api.description = newText
        if (this.diskBacked) {
          await updateApiDocApis(this.apiDocJobId, [api]).catch(error => {
            this.showToast('接口说明保存失败: ' + String(error), 'error')
          })
        }
      }
    },

    async onFieldDescEdit(api, section, event, field) {
      const newText = event.target.innerText.trim()
      if (newText && newText !== field.description) {
        field.description = newText
        if (this.diskBacked) {
          await updateApiDocApis(this.apiDocJobId, [api]).catch(error => {
            this.showToast('字段说明保存失败: ' + String(error), 'error')
          })
        }
      }
    },

    addAiLog(msg, level = 'info') {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      window.dispatchEvent(new CustomEvent('ai-log', { detail: { time, msg, level } }))
    },

    onProviderSelect() {
      const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (p && p.models.length > 0) {
        this.selectedModelId = p.activeModelId || p.models[0].id
      }
    },

    async fillStoredApiDocs(config, controller) {
      const chunkSize = 80
      let totalFilled = 0
      let totalItems = 0
      for (let offset = 0; offset < this.totalApis; offset += chunkSize) {
        if (controller.cancelled) break
        if (controller.paused) {
          await controller.waitIfPaused()
          if (controller.cancelled) break
        }
        const page = await queryApiDocApis(this.apiDocJobId, {
          limit: chunkSize,
          offset,
        })
        if (page.items.length === 0) break
        const chunkResult = { modules: groupStoredApis(page.items) }
        this.aiProgressText = `按页补充 ${Math.min(offset + page.items.length, this.totalApis)}/${this.totalApis}`
        const result = await fillApiDocPlaceholders(
          config,
          chunkResult,
          (msg, level) => this.addAiLog(`[${Math.floor(offset / chunkSize) + 1}] ${msg}`, level),
          () => {},
          controller,
        )
        totalFilled += result.filled || 0
        totalItems += result.total || 0
        await updateApiDocApis(this.apiDocJobId, page.items)
        await new Promise(resolve => setTimeout(resolve, 0))
      }

      // 清理旧页面并按需重读，保证 AI 写入后的内容与 SQLite 一致。
      const expanded = new Set(this.expandedModules)
      for (const module of this.parseResult.modules) {
        if (module.apis.length > 0) module.apis.splice(0, module.apis.length)
        module._loaded = false
      }
      if (this.groupByController) {
        for (const module of this.parseResult.modules) {
          if (expanded.has(module.className)) await this.loadMoreModuleApis(module)
        }
      } else {
        await this.loadFlatApiPage(true)
      }
      return { filled: totalFilled, total: totalItems, cancelled: controller.cancelled }
    },

    async startAiFill() {
      if (!this.parseResult || this.aiProcessing) return

      if (this.globalStore.providerConfigs.length === 0) {
        this.showToast('请先在「AI 设置」标签页配置模型', 'warning')
        return
      }

      const provider = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (!provider) {
        this.showToast('请先选择 AI 厂商和模型', 'warning')
        return
      }
      const config = getResolvedConfig(provider, this.selectedModelId)
      if (!config || !config.model) {
        this.showToast('请选择模型', 'warning')
        return
      }

      const controller = createAiController()
      this.aiProcessing = true
      window.dispatchEvent(new Event('ai-fill-start'))
      this.aiController = controller
      const modelLabel = provider.models.find(m => m.id === config.model)?.label || config.model
      this.aiProgressText = `使用 ${provider.label} / ${modelLabel}...`
      this.addAiLog(`开始 AI 补充，使用 ${provider.label} / ${modelLabel}`, 'info')

      try {
        const result = this.diskBacked
          ? await this.fillStoredApiDocs(config, controller)
          : await fillApiDocPlaceholders(
            config,
            this.parseResult,
            (msg, level) => {
              this.addAiLog(msg, level)
              this.aiProgressText = msg
            },
            () => {
              this.parseResult = markRaw({ ...this.parseResult })
            },
            controller,
          )

        if (result.cancelled || controller.cancelled) {
          this.showToast('已停止 AI 补充', 'info')
        } else if (result.total === 0) {
          this.showToast('没有需要补充的占位符', 'info')
        } else {
          this.showToast(`AI 补充完成: ${result.filled}/${result.total} 个字段已填充`, 'success')
          this.parseResult = markRaw({ ...this.parseResult })
          await saveHistoryRecord({
            type: 'api-doc',
            title: `${this.projectDir.split(/[/\\]/).pop() || '项目'} 接口文档（AI 补充）`,
            summary: `${this.filteredModules.length} 个模块，${this.filteredApis} 个接口，补充 ${result.filled}/${result.total} 个字段`,
            providerId: provider.id,
            modelId: config.model,
            source: {
              projectDir: this.projectDir,
              language: this.detectedLang,
            },
            settings: {
              model: modelSnapshot(provider, this.selectedModelId, config),
              customPrefix: this.customPrefix,
              groupByController: this.groupByController,
              showModulePath: this.showModulePath,
              docModules: this.docModules,
            },
            result: {
              filled: result.filled,
              total: result.total,
              selectedModules: this.selectedModules,
            },
            artifact: apiArtifact(this.parseResult, this.docModules),
          })
        }
      } catch (e) {
        if (e?.name === 'AbortError' || controller.cancelled) {
          this.showToast('已停止 AI 补充', 'info')
        } else {
          this.showToast('AI 补充失败: ' + String(e), 'error')
          this.addAiLog(`失败: ${e.message}`, 'error')
        }
      } finally {
        if (this.aiController === controller) {
          this.aiProcessing = false
          this.aiProgressText = ''
          this.aiController = null
        }
      }
    },
    cancelAi() {
      if (!this.aiController) return
      this.aiController.cancel()
      this.aiProcessing = false
      this.aiProgressText = '已停止'
    },
    syncSelectionFromStore() {
      if (this.globalStore.providerConfigs.length > 0 && !this.selectedProviderId) {
        this.selectedProviderId = this.globalStore.activeProviderId || this.globalStore.providerConfigs[0].id
        const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
        this.selectedModelId = this.globalStore.activeModelId || p?.activeModelId || (p?.models[0]?.id || '')
      }
    },
  },
}
</script>
