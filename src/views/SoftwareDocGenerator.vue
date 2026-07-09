<template>
  <div class="software-doc-view">
    <div class="view-header">
      <div class="header-title">
        <FileText :size="16" />
        <span>软件文档</span>
      </div>
      <div class="header-actions">
        <span v-if="scanning" class="software-doc-status"><span class="spinner"></span> 扫描中...</span>
        <span v-else-if="scanResult" class="software-doc-ready">
          <Check :size="12" /> {{ scanResult.stats.totalFiles }} 个文件，{{ scanResult.modules.length }} 个模块
        </span>

        <div class="ai-fill-group">
          <button v-if="!aiProcessing" class="btn btn-primary btn-sm" @click="startAiGenerate" :disabled="!scanResult">
            <Bot :size="14" /> AI 生成
          </button>
          <template v-else>
            <button class="btn btn-secondary btn-sm" @click="toggleAiPause">
              {{ aiController?.paused ? '▶ 继续' : '⏸ 暂停' }}
            </button>
            <button class="btn btn-danger btn-sm" @click="cancelAi">✕ 取消</button>
            <span class="software-doc-progress">{{ aiProgressText }}</span>
          </template>
          <select class="ai-model-select" v-model="selectedProviderId" @change="onProviderSelect" :disabled="aiProcessing">
            <option :value="null" disabled>选择厂商...</option>
            <option v-for="provider in providerConfigs" :key="provider.id" :value="provider.id">{{ provider.label }}</option>
          </select>
          <select class="ai-model-select" v-model="selectedModelId" :disabled="aiProcessing">
            <option v-for="model in currentProviderModels" :key="model.id" :value="model.id">{{ model.label || model.id }}</option>
          </select>
        </div>

        <button class="btn btn-primary btn-sm" @click="exportWord" :disabled="!hasGeneratedContent">
          <FileDown :size="14" /> 导出 Word
        </button>
        <button class="btn btn-secondary btn-sm" @click="exportMarkdown" :disabled="!hasGeneratedContent">
          <FileDown :size="14" /> 导出 MD
        </button>
      </div>
    </div>

    <div class="app-body">
      <aside class="config-panel">
        <div class="card">
          <div class="card-header">
            <h3><FolderOpen :size="14" /> 开发目录</h3>
            <span v-if="scanning" class="software-doc-status"><span class="spinner"></span> 扫描中...</span>
            <span v-else-if="scanResult" class="software-doc-ready"><Check :size="12" /> {{ scanResult.stats.totalFiles }} 个文件</span>
          </div>
          <div class="card-body">
            <div v-for="(dir, idx) in projectDirs" :key="dir" class="dir-item">
              <div class="dir-item-header">
                <span class="dir-path" :title="dir">{{ dir }}</span>
                <button class="btn btn-danger btn-sm btn-icon" @click="removeDir(idx)" :disabled="aiProcessing || scanning">
                  <X :size="14" />
                </button>
              </div>
            </div>
            <div class="software-doc-dir-actions">
              <button class="btn btn-primary btn-sm" @click="addProjectDir" :disabled="aiProcessing || scanning">
                <FolderOpen :size="14" /> {{ projectDirs.length ? '添加目录' : '选择目录' }}
              </button>
              <button
                class="btn btn-secondary btn-sm"
                @click="startScan"
                :disabled="projectDirs.length === 0 || scanning || aiProcessing"
              >
                <Search :size="14" /> {{ scanning ? '扫描中...' : '扫描并自动填充' }}
              </button>
            </div>
            <button class="btn btn-secondary btn-sm software-doc-full-btn" @click="aiFillProfile" :disabled="!scanResult || aiProcessing">
              <Bot :size="14" /> AI 补全软件信息
            </button>
            <button class="btn btn-secondary btn-sm software-doc-full-btn" @click="clearDetectedProfile" :disabled="aiProcessing || scanning">
              <RotateCcw :size="14" /> 清空扫描信息
            </button>
            <div v-if="profile.sourceProjectName || profileSourceDirsText" class="software-doc-source-note">
              信息来源：{{ profile.sourceProjectName || profileSourceDirsText }}
            </div>
            <div v-if="recentProjects.length > 0 && projectDirs.length === 0" class="recent-dirs">
              <span class="recent-dirs-label">最近使用</span>
              <button v-for="rp in recentProjects" :key="rp" class="recent-dir-item" @click="addRecentDir(rp)" :title="rp">
                {{ rp.split(/[\\/]/).pop() || rp }}
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3><FileText :size="14" /> 文档类型</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">软件文档</label>
              <select class="form-input" v-model="profile.documentTypeId" @change="onDocTypeChange" :disabled="aiProcessing">
                <option v-for="doc in documentOptions" :key="doc.id" :value="doc.id">{{ doc.label }}</option>
              </select>
            </div>
            <p class="software-doc-desc">{{ docOption.description }}</p>
            <div class="software-doc-count">{{ generatedCount }} / {{ leafSections.length }} 个章节已生成</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3><BadgeInfo :size="14" /> 软件信息</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">软件全称</label>
              <input class="form-input" v-model="profile.softwareName" placeholder="例：XXX管理系统软件" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">简称</label>
                <input class="form-input" v-model="profile.shortName" />
              </div>
              <div class="form-group">
                <label class="form-label">版本号</label>
                <input class="form-input" v-model="profile.version" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">申请范围</label>
              <select class="form-input" v-model="profile.applyScope" @change="syncTypeFromScope">
                <option value="">扫描后自动识别或手动选择</option>
                <option v-for="scope in applyScopeOptions" :key="scope.value" :value="scope.value">{{ scope.label }}</option>
              </select>
              <div class="form-help">用于判断本次申报的软件形态，并影响运行平台、材料清单提示和软件文档生成侧重点。</div>
            </div>
            <div class="form-group">
              <label class="form-label">软件类型</label>
              <select class="form-input" v-model="profile.softwareType" @change="syncPlatformFromType">
                <option value="">扫描后自动识别或手动选择</option>
                <option v-for="type in softwareTypeOptions" :key="type.value" :value="type.label">{{ type.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">主要语言/技术</label>
              <input class="form-input" v-model="profile.programmingLanguages" />
              <div class="form-help">用于申请信息表、技术特点说明和软件文档上下文；扫描目录后会按文件类型自动识别。</div>
            </div>
            <div class="form-group">
              <label class="form-label">运行平台</label>
              <input class="form-input" v-model="profile.operatingPlatform" />
            </div>
            <div class="form-group">
              <label class="form-label">功能简介</label>
              <textarea class="form-input software-doc-textarea" v-model="profile.softwareDescription"></textarea>
            </div>
          </div>
        </div>

        <ReferenceFiles @update-files="onUpdateReferenceFiles" />
      </aside>

      <main class="content-panel">
        <div v-if="!scanResult" class="empty-state">
          <FileText :size="48" style="opacity:0.3;margin-bottom:16px;" />
          <p>{{ docOption.label }}</p>
          <p class="hint">选择开发目录并扫描后，AI 将基于代码、README、配置和参考文件生成正文。</p>
        </div>

        <div v-else class="software-doc-preview-scroll">
          <div class="software-doc-preview-container">
            <template v-for="sec in sections" :key="sec.id">
              <template v-if="sec.enabled">
                <h2 class="doc-h1" @click="toggleSection(sec.id)">
                  <ChevronRight :size="14" :class="{ 'chevron-expanded': expandedSections.has(sec.id) }" />
                  {{ sec.number }} {{ sec.title }}
                </h2>

                <template v-if="expandedSections.has(sec.id)">
                  <div v-if="sec.prompt && !sec.children?.length" class="doc-section-content">
                    <SectionEditor
                      :section="sec"
                      @update-content="onContentUpdate"
                      @upload-image="onImageUpload"
                      @generate-single="generateSingle"
                    />
                  </div>

                  <template v-for="child in sec.children" :key="child.id">
                    <template v-if="child.enabled">
                      <h3 class="doc-h2">{{ child.number }} {{ child.title }}</h3>
                      <div class="doc-section-content">
                        <SectionEditor
                          :section="child"
                          @update-content="onContentUpdate"
                          @upload-image="onImageUpload"
                          @generate-single="generateSingle"
                        />
                      </div>
                    </template>
                  </template>
                </template>
              </template>
            </template>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { BadgeInfo, Bot, Check, ChevronRight, FileDown, FileText, FolderOpen, RotateCcw, Search, X } from 'lucide-vue-next'
import { getRecentProjects, loadPageConfig, savePageConfig, saveRecentProject } from '../core/db.js'
import { scanCodebase, buildContextSummary } from '../core/doc-template/codebase-scanner.js'
import { renderDocSections } from '../core/doc-template/doc-docx-renderer.js'
import { renderSectionsToMarkdown } from '../core/doc-template/ops-md-renderer.js'
import {
  applyDocSectionResult,
  buildDocSectionPrompt,
  createAiController,
  evaluateSectionQuality,
  fillDocSections,
} from '../core/doc-template/doc-llm-service.js'
import { callLlm, getResolvedConfig } from '../core/llm/llm-service.js'
import { findSectionById, getEnabledLeafSections } from '../core/doc-template/srs-template.js'
import { APPLY_SCOPE_OPTIONS, SOFTWARE_TYPE_OPTIONS, createDefaultCopyrightProfile } from '../core/copyright-package-renderer.js'
import {
  COPYRIGHT_PROFILE_KEY,
  SOFTWARE_DOC_CONFIG_KEY,
  SOFTWARE_DOCUMENT_OPTIONS,
  buildCopyrightSoftwareDocContext,
  createCopyrightSoftwareDocInfo,
  createCopyrightSoftwareDocSections,
  getSoftwareDocumentOption,
  inferCopyrightProfileFromScan,
  stripLegacyCopyrightDefaults,
} from '../core/copyright-software-docs.js'
import { modelSnapshot, saveHistoryRecord, scanSourceSnapshot, sectionsArtifact } from '../core/generation-history.js'
import SectionEditor from '../components/SectionEditor.vue'
import ReferenceFiles from '../components/ReferenceFiles.vue'

const SECTION_TEMPERATURE = { diagram: 0.1, table: 0.35, text: 0.55 }

function parseJsonObject(text) {
  if (!text) return {}
  const cleaned = String(text).trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return {}
    try { return JSON.parse(match[0]) } catch { return {} }
  }
}

export default {
  name: 'SoftwareDocGenerator',
  components: {
    BadgeInfo, Bot, Check, ChevronRight, FileDown, FileText, FolderOpen,
    ReferenceFiles, RotateCcw, Search, SectionEditor, X,
  },
  inject: ['showToast', 'globalStore'],
  data() {
    const profile = createDefaultCopyrightProfile()
    return {
      profile,
      documentOptions: SOFTWARE_DOCUMENT_OPTIONS,
      applyScopeOptions: APPLY_SCOPE_OPTIONS,
      softwareTypeOptions: SOFTWARE_TYPE_OPTIONS,
      sections: createCopyrightSoftwareDocSections(profile.documentTypeId, profile),
      expandedSections: new Set(),
      projectDirs: [],
      recentProjects: [],
      scanning: false,
      scanResult: null,
      referenceFiles: [],
      aiProcessing: false,
      aiProgressText: '',
      aiController: null,
      selectedProviderId: null,
      selectedModelId: null,
      loaded: false,
    }
  },
  computed: {
    providerConfigs() {
      return this.globalStore?.providerConfigs || []
    },
    currentProviderModels() {
      const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      return provider?.models || []
    },
    docOption() {
      return getSoftwareDocumentOption(this.profile.documentTypeId)
    },
    docInfo() {
      return createCopyrightSoftwareDocInfo(this.profile, this.profile.documentTypeId)
    },
    profileSourceDirsText() {
      return Array.isArray(this.profile.sourceProjectDirs)
        ? this.profile.sourceProjectDirs.map(dir => String(dir).split(/[\\/]/).pop()).filter(Boolean).join('、')
        : ''
    },
    leafSections() {
      return getEnabledLeafSections(this.sections)
    },
    generatedCount() {
      return this.leafSections.filter(s => (s.content && s.content.trim()) || (s.mermaidCode && s.mermaidCode.trim()) || s.imageData).length
    },
    hasGeneratedContent() {
      return this.generatedCount > 0
    },
  },
  watch: {
    profile: {
      deep: true,
      handler() {
        if (!this.loaded) return
        this.syncDocumentNameFromType(false)
        this.persistProfile()
      },
    },
    sections: {
      deep: true,
      handler() {
        if (!this.loaded) return
        this.persistSoftwareDoc()
      },
    },
  },
  async created() {
    await this.loadProfile()
    await this.loadSavedSoftwareDoc()
    this.expandedSections = new Set(this.sections.map(s => s.id))
    this.syncSelectionFromStore()
    this.loadRecentProjects()
    this.loaded = true
  },
  activated() {
    this.syncSelectionFromStore()
  },
  methods: {
    async loadProfile() {
      const saved = await loadPageConfig(COPYRIGHT_PROFILE_KEY).catch(() => null)
      if (saved) this.profile = { ...createDefaultCopyrightProfile(), ...stripLegacyCopyrightDefaults(saved) }
      this.profile.documentTypeId = this.profile.documentTypeId || 'user-manual'
      this.syncProjectDirsFromProfile()
      this.syncDocumentNameFromType(false)
    },
    async loadSavedSoftwareDoc() {
      const savedDoc = await loadPageConfig(SOFTWARE_DOC_CONFIG_KEY).catch(() => null)
      if (Array.isArray(savedDoc?.sections) && savedDoc.sections.length && savedDoc.documentTypeId === this.profile.documentTypeId) {
        this.sections = savedDoc.sections
      } else {
        this.resetSections(false)
      }
    },
    persistProfile() {
      savePageConfig(COPYRIGHT_PROFILE_KEY, this.profile).catch(() => {})
    },
    persistSoftwareDoc() {
      savePageConfig(SOFTWARE_DOC_CONFIG_KEY, {
        documentTypeId: this.profile.documentTypeId,
        docInfo: this.docInfo,
        sections: this.sections,
      }).catch(() => {})
    },
    resetSections(persist = true) {
      this.sections = createCopyrightSoftwareDocSections(this.profile.documentTypeId, this.profile)
      this.expandedSections = new Set(this.sections.map(s => s.id))
      if (persist) this.persistSoftwareDoc()
    },
    syncDocumentNameFromType(persist = true) {
      const option = getSoftwareDocumentOption(this.profile.documentTypeId)
      this.profile.documentMaterialType = option.label
      this.profile.documentName = option.label
      if (persist) this.persistProfile()
    },
    syncProjectDirsFromProfile() {
      const dirs = Array.isArray(this.profile.sourceProjectDirs)
        ? this.profile.sourceProjectDirs.filter(Boolean)
        : []
      if (dirs.length && this.projectDirs.length === 0) this.projectDirs = [...dirs]
    },
    onDocTypeChange() {
      if (this.aiProcessing) {
        this.showToast('AI 正在生成中，请先停止生成再切换文档类型', 'warning')
        return
      }
      this.syncDocumentNameFromType()
      this.resetSections()
      this.showToast(`已切换为${this.docOption.label}`, 'success')
    },
    syncPlatformFromType() {
      const opt = this.softwareTypeOptions.find(item => item.label === this.profile.softwareType)
      if (!opt) return
      const knownPlatforms = this.softwareTypeOptions.map(item => item.platform)
      if (!this.profile.operatingPlatform || knownPlatforms.includes(this.profile.operatingPlatform)) {
        this.profile.operatingPlatform = opt.platform
      }
    },
    syncTypeFromScope() {
      const typeByScope = {
        desktop: '桌面应用软件',
        web: 'Web 系统/网站后台',
        'mobile-app': '移动 App',
        'mini-program': '小程序',
        'backend-service': '后端服务/API',
        cloud: '云端 SaaS/平台服务',
        both: '多端系统',
        'multi-terminal': '多端系统',
        embedded: '嵌入式/设备软件',
      }
      const nextType = typeByScope[this.profile.applyScope]
      const knownTypes = this.softwareTypeOptions.map(item => item.label)
      if (nextType && (!this.profile.softwareType || knownTypes.includes(this.profile.softwareType))) {
        this.profile.softwareType = nextType
        this.syncPlatformFromType()
      }
    },
    async addProjectDir() {
      const dir = await open({ directory: true, multiple: false, title: '选择软件开发目录' })
      if (!dir) return
      if (this.projectDirs.includes(dir)) {
        this.showToast('该目录已添加', 'warning')
        return
      }
      this.projectDirs.push(dir)
      saveRecentProject(dir, 'software-doc').catch(() => {})
    },
    removeDir(index) {
      this.projectDirs.splice(index, 1)
      if (this.projectDirs.length === 0) {
        this.scanResult = null
        this.profile.sourceProjectDirs = []
        this.profile.sourceProjectName = ''
        this.profile.profileAutoFilledAt = ''
        this.persistProfile()
      }
    },
    async startScan() {
      if (this.projectDirs.length === 0) {
        this.showToast('请先选择软件开发目录', 'warning')
        return
      }
      this.scanning = true
      this.addLog('开始扫描软件开发目录...')
      try {
        this.scanResult = await scanCodebase(this.projectDirs)
        const { totalFiles, totalDirs, languages } = this.scanResult.stats
        const langList = Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([lang]) => lang).join('、')
        this.addLog(`[完成] 扫描完成: ${totalFiles} 个文件, ${totalDirs} 个目录${langList ? `, 主要语言: ${langList}` : ''}`, 'success')
        this.showToast(`扫描完成，发现 ${totalFiles} 个文件`, 'success')
        this.fillProfileFromScan()
      } catch (e) {
        this.addLog('[失败] 扫描失败: ' + String(e), 'error')
        this.showToast('扫描失败: ' + String(e), 'error')
      } finally {
        this.scanning = false
      }
    },
    fillProfileFromScan() {
      if (!this.scanResult) return
      this.profile = inferCopyrightProfileFromScan(this.scanResult, this.profile)
      this.syncDocumentNameFromType(false)
      this.persistProfile()
    },
    clearDetectedProfile() {
      const keys = [
        'softwareName', 'shortName', 'version', 'softwareCategory', 'softwareType',
        'applyScope', 'programmingLanguages', 'operatingPlatform', 'softwareDescription',
        'developmentTools', 'developmentHardwareEnv', 'runtimeHardwareEnv',
        'developmentSoftwareEnv', 'runtimeSoftwareEnv', 'technicalFeatures',
        'sourceProjectName', 'profileAutoFilledAt',
      ]
      for (const key of keys) this.profile[key] = ''
      this.profile.sourceProjectDirs = []
      this.persistProfile()
      this.showToast('已清空扫描识别的软件信息', 'success')
    },
    onUpdateReferenceFiles(files) {
      this.referenceFiles = files
    },
    toggleSection(id) {
      const next = new Set(this.expandedSections)
      next.has(id) ? next.delete(id) : next.add(id)
      this.expandedSections = next
    },
    onContentUpdate({ sectionId, content, mermaidCode }) {
      const section = findSectionById(this.sections, sectionId)
      if (!section) return
      if (content !== undefined) section.content = content
      if (mermaidCode !== undefined) section.mermaidCode = mermaidCode
      this.sections = [...this.sections]
    },
    onImageUpload({ sectionId, imageData }) {
      const section = findSectionById(this.sections, sectionId)
      if (!section) return
      section.imageData = imageData
      this.sections = [...this.sections]
    },
    onProviderSelect() {
      const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (provider?.models?.length) this.selectedModelId = provider.activeModelId || provider.models[0].id
    },
    async startAiGenerate() {
      if (this.aiProcessing) return
      if (!this.scanResult) {
        this.showToast('请先选择开发目录并扫描代码库', 'warning')
        return
      }
      const provider = this.requireProvider()
      if (!provider) return
      const config = getResolvedConfig(provider, this.selectedModelId)
      if (!config?.model) {
        this.showToast('请选择模型', 'warning')
        return
      }

      const controller = createAiController()
      this.aiProcessing = true
      window.dispatchEvent(new Event('ai-fill-start'))
      this.aiController = controller
      const modelLabel = provider.models.find(m => m.id === config.model)?.label || config.model
      this.aiProgressText = `使用 ${provider.label} / ${modelLabel}...`

      try {
        await fillDocSections(
          config,
          this.leafSections,
          this.buildContext(),
          this.docInfo,
          (msg, level) => { this.addLog(msg, level); this.aiProgressText = msg },
          () => { this.sections = [...this.sections] },
          controller,
        )
        if (controller.cancelled) {
          this.showToast('已停止生成', 'info')
        } else {
          this.persistSoftwareDoc()
          this.persistProfile()
          await this.saveHistory(provider, config)
          this.showToast(`${this.docOption.label}生成完成`, 'success')
        }
      } catch (e) {
        if (e?.name === 'AbortError' || controller.cancelled) this.showToast('已停止生成', 'info')
        else this.showToast('生成失败: ' + String(e), 'error')
      } finally {
        if (this.aiController === controller) {
          this.aiProcessing = false
          this.aiProgressText = ''
          this.aiController = null
        }
      }
    },
    async aiFillProfile() {
      if (this.aiProcessing) return
      if (!this.scanResult) {
        this.showToast('请先扫描开发目录', 'warning')
        return
      }
      const provider = this.requireProvider()
      if (!provider) return
      const config = getResolvedConfig(provider, this.selectedModelId)
      if (!config?.model) {
        this.showToast('请选择模型', 'warning')
        return
      }

      const controller = createAiController()
      this.aiProcessing = true
      this.aiController = controller
      this.aiProgressText = 'AI 正在提取软件信息...'
      this.addLog('[进行] AI 提取软件基础信息')
      try {
        const base = buildContextSummary(this.scanResult, this.docInfo, this.referenceFiles)
        const messages = [
          {
            role: 'system',
            content: '你负责从项目代码目录、README、配置文件、路由、接口和页面文案中提取软件著作权填报所需的基础信息。只输出 JSON，不要输出解释。',
          },
          {
            role: 'user',
            content: `${base}

请提取以下 JSON 字段，无法从材料判断时填空字符串：
{
  "softwareName": "软件全称，建议以“软件”结尾",
  "shortName": "软件简称",
  "version": "版本号，不要自行编造",
  "softwareCategory": "软件分类，例如应用软件、系统软件、嵌入式软件等",
  "applyScope": "desktop|web|mobile-app|mini-program|backend-service|cloud|multi-terminal|embedded 之一",
  "softwareType": "中文软件类型",
  "operatingPlatform": "运行平台",
  "programmingLanguages": "主要语言/技术，顿号分隔",
  "developmentTools": "开发工具/构建工具，顿号分隔",
  "developmentSoftwareEnv": "开发软件环境",
  "runtimeSoftwareEnv": "运行软件环境",
  "technicalFeatures": "技术特点，80-180字，必须基于代码证据",
  "softwareDescription": "软件功能简介，80-180字，必须基于代码证据"
}`,
          },
        ]
        const response = await callLlm(config, messages, {
          maxTokens: Math.min(config.maxOutputTokens || 4096, 4096),
          temperature: 0.2,
          jsonMode: true,
          signal: controller.signal,
        })
        const parsed = parseJsonObject(response)
        const allowed = [
          'softwareName', 'shortName', 'version', 'softwareCategory', 'applyScope',
          'softwareType', 'operatingPlatform', 'programmingLanguages', 'developmentTools',
          'developmentSoftwareEnv', 'runtimeSoftwareEnv', 'technicalFeatures', 'softwareDescription',
        ]
        for (const key of allowed) {
          const value = parsed[key]
          if (typeof value === 'string' && value.trim() && !this.profile[key]) {
            this.profile[key] = value.trim()
          }
        }
        this.syncDocumentNameFromType(false)
        this.persistProfile()
        this.addLog('[完成] AI 软件信息提取完成', 'success')
        this.showToast('软件信息已补全', 'success')
      } catch (e) {
        if (e?.name === 'AbortError' || controller.cancelled) this.showToast('已停止生成', 'info')
        else this.showToast('AI 补全失败: ' + String(e), 'error')
      } finally {
        if (this.aiController === controller) {
          this.aiProcessing = false
          this.aiProgressText = ''
          this.aiController = null
        }
      }
    },
    async generateSingle(sectionId) {
      if (this.aiProcessing) return
      if (!this.scanResult) {
        this.showToast('请先扫描开发目录', 'warning')
        return
      }
      const provider = this.requireProvider()
      if (!provider) return
      const config = getResolvedConfig(provider, this.selectedModelId)
      const section = findSectionById(this.sections, sectionId)
      if (!section || !config?.model) return

      const controller = createAiController()
      this.aiProcessing = true
      this.aiController = controller
      section.generating = true
      section.error = null
      this.sections = [...this.sections]
      this.aiProgressText = `生成 ${section.number} ${section.title}...`
      this.addLog(`[进行] 单独生成: ${section.number} ${section.title}`)
      try {
        const messages = buildDocSectionPrompt(section, this.buildContext(), this.docInfo)
        const maxTokens = config.maxOutputTokens || (section.type === 'diagram' ? 4096 : 16384)
        const temperature = SECTION_TEMPERATURE[section.type] ?? 0.5
        const responseText = await callLlm(config, messages, { maxTokens, temperature, jsonMode: false, signal: controller.signal })
        applyDocSectionResult(responseText, section)
        section.error = null
        const warnings = evaluateSectionQuality(section)
        if (warnings.length) this.addLog(`[完成] ${section.number} ${section.title} ⚠ ${warnings.join('；')}`, 'warn')
        else this.addLog(`[完成] ${section.number} ${section.title} ✓`, 'success')
        this.persistSoftwareDoc()
        this.showToast(`${section.number} ${section.title} 生成完成`, 'success')
      } catch (e) {
        if (e?.name === 'AbortError' || controller.cancelled) {
          this.showToast('已停止生成', 'info')
        } else {
          section.error = e.message || String(e)
          this.addLog(`[失败] ${section.number} ${section.title}: ${section.error}`, 'error')
          this.showToast('生成失败: ' + String(e), 'error')
        }
      } finally {
        section.generating = false
        this.sections = [...this.sections]
        if (this.aiController === controller) {
          this.aiProcessing = false
          this.aiProgressText = ''
          this.aiController = null
        }
      }
    },
    toggleAiPause() {
      if (!this.aiController) return
      this.aiController.paused ? this.aiController.resume() : this.aiController.pause()
    },
    cancelAi() {
      if (!this.aiController) return
      this.aiController.cancel()
      this.aiProcessing = false
      this.aiProgressText = '已停止'
    },
    requireProvider() {
      if (this.providerConfigs.length === 0) {
        this.showToast('请先在「AI 设置」标签页配置模型', 'warning')
        return null
      }
      const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (!provider) {
        this.showToast('请先选择 AI 厂商和模型', 'warning')
        return null
      }
      return provider
    },
    buildContext() {
      const base = buildContextSummary(this.scanResult, this.docInfo, this.referenceFiles)
      return buildCopyrightSoftwareDocContext(base, this.profile, this.docOption)
    },
    async exportWord() {
      const path = await save({
        title: `导出${this.docOption.label}`,
        defaultPath: `${this.profile.softwareName || '软件'}_${this.docOption.label}.docx`,
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      })
      if (!path) return
      try {
        await writeFile(path, await renderDocSections(this.sections, this.docInfo))
        this.showToast(`${this.docOption.label}已导出`, 'success')
      } catch (e) {
        this.showToast('导出失败: ' + String(e), 'error')
      }
    },
    async exportMarkdown() {
      const path = await save({
        title: `导出${this.docOption.label} Markdown`,
        defaultPath: `${this.profile.softwareName || '软件'}_${this.docOption.label}.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })
      if (!path) return
      try {
        await writeTextFile(path, renderSectionsToMarkdown(this.sections, this.docInfo))
        this.showToast(`${this.docOption.label} Markdown 已导出`, 'success')
      } catch (e) {
        this.showToast('导出失败: ' + String(e), 'error')
      }
    },
    async saveHistory(provider, config) {
      await saveHistoryRecord({
        type: 'software-doc',
        title: `${this.profile.softwareName || '未命名软件'} ${this.docOption.label}`,
        summary: `${this.generatedCount}/${this.leafSections.length} 个章节已生成，${this.projectDirs.length} 个目录`,
        providerId: provider.id,
        modelId: config.model,
        source: scanSourceSnapshot(this.projectDirs, this.scanResult, this.referenceFiles),
        settings: {
          profile: this.profile,
          documentType: this.docOption,
          model: modelSnapshot(provider, this.selectedModelId, config),
        },
        result: {
          generatedSections: this.generatedCount,
          totalSections: this.leafSections.length,
        },
        artifact: sectionsArtifact(this.sections, this.docInfo),
      })
    },
    syncSelectionFromStore() {
      if (this.providerConfigs.length > 0 && !this.selectedProviderId) {
        this.selectedProviderId = this.globalStore?.activeProviderId || this.providerConfigs[0].id
        const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId)
        this.selectedModelId = this.globalStore?.activeModelId || provider?.activeModelId || (provider?.models[0]?.id || '')
      }
    },
    async loadRecentProjects() {
      try {
        this.recentProjects = (await getRecentProjects('software-doc')).map(r => r.path)
      } catch { /* ignore */ }
    },
    addRecentDir(path) {
      if (this.projectDirs.includes(path)) return
      this.projectDirs.push(path)
    },
    addLog(msg, level = 'info') {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      window.dispatchEvent(new CustomEvent('ai-log', { detail: { time, msg, level } }))
    },
  },
}
</script>

<style scoped>
.software-doc-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.software-doc-status,
.software-doc-ready {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.software-doc-status,
.software-doc-progress {
  color: var(--text-secondary);
}

.software-doc-ready {
  color: var(--success-500);
}

.software-doc-progress {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

.software-doc-desc {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  user-select: text;
}

.software-doc-count {
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-secondary);
  font-size: 12px;
}

.software-doc-textarea {
  min-height: 84px;
  resize: vertical;
  line-height: 1.5;
}

.form-help {
  margin-top: 5px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
  user-select: text;
}

.software-doc-dir-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.software-doc-dir-actions .btn {
  min-width: 0;
}

.software-doc-full-btn {
  width: 100%;
  margin-top: 6px;
}

.software-doc-source-note {
  margin-top: 8px;
  padding: 7px 9px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.45;
  word-break: break-word;
  user-select: text;
}

.software-doc-preview-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.software-doc-preview-container {
  max-width: 900px;
  margin: 0 auto;
}

.doc-h1 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 24px 0 8px;
  padding: 8px 12px;
  border-left: 4px solid var(--primary-500);
  border-radius: 0 6px 6px 0;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
}

.doc-h1:hover {
  background: var(--bg-tertiary);
}

.doc-h2 {
  margin: 16px 0 6px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-primary);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.doc-section-content {
  padding: 8px 0 16px;
}

.chevron-expanded {
  transform: rotate(90deg);
  transition: transform 0.15s;
}
</style>
