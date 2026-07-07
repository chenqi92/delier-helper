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
      <div class="header-actions">
        <span v-if="scanning" style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:12px;">
          <span class="spinner"></span> 扫描中...
        </span>
        <span v-else-if="scanResult" style="font-size:12px;color:var(--success-500);">
          <Check :size="12" /> {{ scanResult.stats.totalFiles }} 个文件，{{ scanResult.modules.length }} 个模块
        </span>

        <div class="ai-fill-group" v-if="scanResult" data-guide="srs-ai-gen">
          <button v-if="!aiProcessing" class="btn btn-primary btn-sm" @click="startAiGenerate">
            <Bot :size="14" /> AI 生成
          </button>
          <template v-else>
            <button class="btn btn-secondary btn-sm" @click="toggleAiPause">
              {{ aiController?.paused ? '▶ 继续' : '⏸ 暂停' }}
            </button>
            <button class="btn btn-danger btn-sm" @click="cancelAi">✕ 取消</button>
            <span style="font-size:11px;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              {{ aiProgressText }}
            </span>
          </template>
          <select class="ai-model-select" v-model="selectedProviderId" @change="onProviderSelect" :disabled="aiProcessing">
            <option :value="null" disabled>选择厂商...</option>
            <option v-for="p in globalStore.providerConfigs" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
          <select class="ai-model-select" v-model="selectedModelId" :disabled="aiProcessing">
            <option v-for="m in currentProviderModels" :key="m.id" :value="m.id">{{ m.label || m.id }}</option>
          </select>
        </div>

        <button class="btn btn-primary btn-sm" @click="exportWord" :disabled="!scanResult" data-guide="srs-export">
          <FileDown :size="14" /> 导出 Word
        </button>
        <button class="btn btn-secondary btn-sm" @click="exportMarkdown" :disabled="!scanResult">
          <FileDown :size="14" /> 导出 MD
        </button>
      </div>
    </div>

    <!-- 主体 -->
    <div class="app-body">
      <!-- 左侧配置面板 -->
      <aside class="config-panel">
        <!-- 模板选择 -->
        <TemplateSelector
          data-guide="srs-template"
          :doc-type="'srs'"
          :sections="sections"
          @switch-template="onSwitchTemplate"
          @update-sections="onUpdateSections"
        />
        <!-- 项目目录 -->
        <div class="card" data-guide="srs-project-dir">
          <div class="card-header">
            <h3><FolderOpen :size="14" /> 项目目录</h3>
          </div>
          <div class="card-body">
            <div v-for="(dir, idx) in projectDirs" :key="idx" class="dir-item" style="margin-bottom:4px;">
              <div class="dir-item-header">
                <span class="dir-path" :title="dir">{{ dir }}</span>
                <button class="btn btn-danger btn-sm btn-icon" @click="removeDir(idx)"><X :size="14" /></button>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" style="width:100%;margin-top:8px;" @click="addProjectDir">
              <FolderOpen :size="14" /> {{ projectDirs.length > 0 ? '添加目录' : '选择目录' }}
            </button>
            <button
              v-if="projectDirs.length > 0"
              class="btn btn-secondary btn-sm"
              style="width:100%;margin-top:4px;"
              @click="startScan"
              :disabled="scanning"
            >
              <Search :size="14" /> {{ scanning ? '扫描中...' : '扫描代码库' }}
            </button>
            <div v-if="recentProjects.length > 0 && projectDirs.length === 0" class="recent-dirs">
              <span class="recent-dirs-label">最近使用</span>
              <button v-for="rp in recentProjects" :key="rp" class="recent-dir-item" @click="addRecentDir(rp)" :title="rp">
                {{ rp.split('/').pop() || rp }}
              </button>
            </div>
          </div>
        </div>

        <!-- 参考文件 -->
        <ReferenceFiles data-guide="srs-ref-files" @update-files="onUpdateReferenceFiles" />

        <!-- 文档信息 -->
        <div class="card">
          <div class="card-header">
            <h3><FileText :size="14" /> 文档信息</h3>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:6px;">
            <div class="form-group">
              <label class="form-label">项目名称</label>
              <input type="text" class="form-input" v-model="docInfo.projectName" placeholder="XXX系统" />
            </div>
            <div class="form-group">
              <label class="form-label">版本号</label>
              <input type="text" class="form-input" v-model="docInfo.version" placeholder="V1.0" />
            </div>
            <div class="form-group">
              <label class="form-label">编写人</label>
              <input type="text" class="form-input" v-model="docInfo.author" />
            </div>
            <div class="form-group">
              <label class="form-label">编写单位</label>
              <input type="text" class="form-input" v-model="docInfo.organization" />
            </div>
          </div>
        </div>

      </aside>

      <!-- 右侧预览/编辑区 -->
      <main class="content-panel">
        <!-- 空状态 -->
        <div v-if="!scanResult" class="empty-state" style="flex:1;">
          <FileText :size="48" style="opacity:0.3;margin-bottom:16px;" />
          <p>系统需求规格说明书</p>
          <p class="hint">请在左侧选择项目目录并扫描，然后点击"AI 生成"自动填充文档内容。</p>
        </div>

        <!-- 章节预览 -->
        <template v-else>
          <div class="doc-preview-scroll">
            <div class="doc-preview-container">
              <template v-for="sec in sections" :key="sec.id">
                <template v-if="sec.enabled">
                  <!-- 一级标题 -->
                  <h2 class="doc-h1" @click="toggleSection(sec.id)">
                    <ChevronRight :size="14" :class="{ 'chevron-expanded': expandedSections.has(sec.id) }" />
                    {{ sec.number }} {{ sec.title }}
                  </h2>

                  <template v-if="expandedSections.has(sec.id)">
                    <!-- 一级标题自身内容 -->
                    <div v-if="sec.prompt && !sec.children?.length" class="doc-section-content">
                      <SectionEditor
                        :section="sec"
                        @update-content="onContentUpdate"
                        @upload-image="onImageUpload"
                        @generate-single="generateSingle"
                      />
                    </div>

                    <!-- 子章节 -->
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
        </template>
      </main>
    </div>
  </div>
</template>

<script>
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { FolderOpen, Search, X, Check, FileDown, FileText, Settings, ChevronRight, Bot } from 'lucide-vue-next'
import { createSrsTemplate, getEnabledLeafSections, countSections, findSectionById, renumberSections } from '../core/doc-template/srs-template.js'
import { scanCodebase, buildContextSummary } from '../core/doc-template/codebase-scanner.js'
import { renderDocSections } from '../core/doc-template/doc-docx-renderer.js'
import { renderSectionsToMarkdown } from '../core/doc-template/ops-md-renderer.js'
import { fillDocSections, buildDocSectionPrompt, applyDocSectionResult, evaluateSectionQuality, createAiController } from '../core/doc-template/doc-llm-service.js'

const SECTION_TEMPERATURE = { diagram: 0.1, table: 0.35, text: 0.55 }
import { loadProviderConfigs, loadActiveSelection, getResolvedConfig, callLlm } from '../core/llm/llm-service.js'
import { saveRecentProject, getRecentProjects, savePageConfig, loadPageConfig, getSetting, setSetting } from '../core/db.js'
import SectionEditor from '../components/SectionEditor.vue'
import TemplateSelector from '../components/TemplateSelector.vue'
import ReferenceFiles from '../components/ReferenceFiles.vue'
import GuideTour from '../components/GuideTour.vue'

export default {
  name: 'SrsGenerator',
  components: {
    FolderOpen, Search, X, Check, FileDown, FileText, Settings, ChevronRight, Bot,
    SectionEditor, TemplateSelector, ReferenceFiles, GuideTour,
  },
  inject: ['showToast', 'guide', 'globalStore'],
  data() {
    return {
      projectDirs: [],
      recentProjects: [],
      scanning: false,
      scanResult: null,
      sections: createSrsTemplate(),
      expandedSections: new Set(),
      docInfo: {
        docTitle: '系统需求规格说明书',
        projectName: '',
        version: 'V1.0',
        author: '',
        organization: '',
        date: new Date().toISOString().slice(0, 10),
      },
      aiProcessing: false,
      aiProgressText: '',
      aiController: null,
      selectedProviderId: null,
      selectedModelId: null,
      referenceFiles: [],
      guideFinished: false,
      isActive: true,
      guideSteps: [
        { target: 'srs-template', text: '① 选择模板：点击切换内置模板（标准版/精简版/企业版/政企版），也可从 .docx/.md 文件导入生成自定义模板。点击「编辑章节」可增删章节、调整顺序、切换类型（文本/表格/图表/图片），点击📝可编辑各章节的 AI Prompt' },
        { target: 'srs-project-dir', text: '② 添加项目代码目录（支持多目录），然后点击「扫描代码库」让系统自动识别项目架构、模块划分和技术栈，作为 AI 生成文档的上下文', doneWhen: 'hasProject' },
        { target: 'srs-ref-files', text: '③ 导入参考文件（可选）：支持 Word/Excel/PDF/Markdown 等文档，内容会被提取并注入 AI 生成的上下文，帮助生成更贴合实际的内容' },
        { target: 'srs-chapters', text: '④ 章节控制：勾选/取消控制哪些章节需要生成。标签「图」表示该节会生成 Mermaid 架构图；「表」表示生成表格。部分模板支持三级标题（如遵循标准规范下的子章节）' },
        { target: 'srs-ai-gen', text: '⑤ 点击 AI 生成自动填充所有已勾选章节，支持暂停/继续/取消。生成失败的章节会在右侧显示红色❌和重试按钮，可单独重新生成', doneWhen: 'hasScanned' },
        { target: 'srs-export', text: '⑥ 导出 Word 文档：生成完成后可在右侧预览区直接编辑内容（点击章节标题展开/折叠），编辑满意后点击此处导出为 .docx 文件' },
      ],
    }
  },
  async created() {
    if (this.sections.length > 0) {
      this.expandedSections = new Set(this.sections.map(s => s.id))
    }
    this.syncSelectionFromStore()
    this.loadRecentProjects()
    loadPageConfig('srs-doc-info').then(saved => {
      if (saved) Object.assign(this.docInfo, saved)
    }).catch(() => {})
    getSetting('guide-finished-srs', false).then(v => { if (v) this.guideFinished = true }).catch(() => {})
  },
  watch: {
    docInfo: {
      deep: true,
      handler(val) { savePageConfig('srs-doc-info', val).catch(() => {}) }
    },
    guideFinished(val) { if (val) setSetting('guide-finished-srs', true).catch(() => {}) },
  },
  computed: {
    currentProviderModels() {
      const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      return p ? p.models : []
    },
    sectionStats() {
      return countSections(this.sections)
    },
    guideVisible() {
      if (this.guideFinished) return false
      return !!this.guide?.enabled
    },
    guideConditions() {
      return {
        hasProject: this.projectDirs.length > 0,
        hasScanned: !!this.scanResult,
      }
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
    // ===== 项目目录管理 =====
    async addProjectDir() {
      const dir = await open({ directory: true, multiple: false, title: '选择项目目录' })
      if (!dir) return
      if (this.projectDirs.includes(dir)) {
        this.showToast('该目录已添加', 'warning')
        return
      }
      this.projectDirs.push(dir)
      saveRecentProject(dir, 'srs').catch(() => {})
    },
    removeDir(idx) {
      this.projectDirs.splice(idx, 1)
      if (this.projectDirs.length === 0) {
        this.scanResult = null
      }
    },

    // ===== 代码库扫描 =====
    async startScan() {
      if (this.projectDirs.length === 0) return
      this.scanning = true
      this.addLog('开始扫描代码库...')
      try {
        this.scanResult = await scanCodebase(this.projectDirs)
        const { totalFiles, totalDirs, languages } = this.scanResult.stats
        const langList = Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l).join(', ')
        this.addLog(`[完成] 扫描完成: ${totalFiles} 个文件, ${totalDirs} 个目录, 主要语言: ${langList}`)
        this.showToast(`扫描完成！发现 ${totalFiles} 个文件`, 'success')

        // 尝试从配置文件推断项目名称
        if (!this.docInfo.projectName) {
          for (const cfg of this.scanResult.configs) {
            if (cfg.name === 'package.json') {
              try { this.docInfo.projectName = JSON.parse(cfg.content).name || '' } catch (e) {}
            } else if (cfg.name === 'pom.xml') {
              const match = cfg.content.match(/<artifactId>([^<]+)<\/artifactId>/)
              if (match) this.docInfo.projectName = match[1]
            }
          }
        }
      } catch (e) {
        this.showToast('扫描失败: ' + String(e), 'error')
        this.addLog('[失败] 扫描失败: ' + String(e))
      }
      this.scanning = false
    },

    // ===== 章节控制 =====
    toggleSection(id) {
      const s = new Set(this.expandedSections)
      s.has(id) ? s.delete(id) : s.add(id)
      this.expandedSections = s
    },
    toggleAllSections(enabled) {
      const walk = (sections) => {
        for (const s of sections) {
          s.enabled = enabled
          if (s.children) walk(s.children)
        }
      }
      walk(this.sections)
    },
    toggleChildSections(parent, enabled) {
      if (parent.children) {
        for (const child of parent.children) {
          child.enabled = enabled
        }
      }
    },

    // ===== 模板和参考文件 =====
    onSwitchTemplate(newSections) {
      if (this.aiProcessing) {
        this.showToast('AI 正在生成中，请先停止生成再切换模板', 'warning')
        return
      }
      this.sections = newSections
      this.expandedSections = new Set(newSections.map(s => s.id))
    },
    onUpdateSections(sections) {
      this.sections = [...sections]
    },
    onUpdateReferenceFiles(files) {
      this.referenceFiles = files
    },

    // ===== 内容编辑 =====
    onContentUpdate({ sectionId, content, mermaidCode }) {
      const sec = findSectionById(this.sections, sectionId)
      if (!sec) return
      if (content !== undefined) sec.content = content
      if (mermaidCode !== undefined) sec.mermaidCode = mermaidCode
    },
    onImageUpload({ sectionId, imageData }) {
      const sec = findSectionById(this.sections, sectionId)
      if (sec) sec.imageData = imageData
    },

    // ===== AI 生成 =====
    onProviderSelect() {
      const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (p && p.models.length > 0) {
        this.selectedModelId = p.activeModelId || p.models[0].id
      }
    },
    async startAiGenerate() {
      if (!this.scanResult || this.aiProcessing) return
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

      try {
        const contextSummary = buildContextSummary(this.scanResult, this.docInfo, this.referenceFiles)
        const leafSections = getEnabledLeafSections(this.sections)

        await fillDocSections(
          config, leafSections, contextSummary, this.docInfo,
          (msg, level) => {
            this.addLog(msg, level)
            this.aiProgressText = msg
          },
          (section) => {
            // 触发 Vue 响应式更新
            this.sections = [...this.sections]
          },
          controller,
        )
        if (controller.cancelled) {
          this.showToast('已停止生成', 'info')
        } else {
          this.showToast('文档生成完成！', 'success')
        }
      } catch (e) {
        if (e?.name === 'AbortError' || controller.cancelled) {
          this.showToast('已停止生成', 'info')
        } else {
          this.showToast('生成失败: ' + String(e), 'error')
        }
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
      const provider = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (!provider) {
        this.showToast('请先选择 AI 模型', 'warning')
        return
      }
      const config = getResolvedConfig(provider, this.selectedModelId)
      const section = findSectionById(this.sections, sectionId)
      if (!section || !this.scanResult) return

      const controller = createAiController()
      this.aiProcessing = true
      this.aiController = controller
      section.generating = true
      section.error = null
      this.sections = [...this.sections]
      this.aiProgressText = `生成 ${section.number} ${section.title}...`
      this.addLog(`[进行] 单独生成: ${section.number} ${section.title}`)
      try {
        const contextSummary = buildContextSummary(this.scanResult, this.docInfo, this.referenceFiles)
        const messages = buildDocSectionPrompt(section, contextSummary, this.docInfo)
        const defaultMaxTokens = section.type === 'diagram' ? 4096 : 16384
        const maxTokens = config.maxOutputTokens || defaultMaxTokens
        const temperature = SECTION_TEMPERATURE[section.type] ?? 0.5
        const responseText = await callLlm(config, messages, { maxTokens, temperature, jsonMode: false, signal: controller.signal })
        applyDocSectionResult(responseText, section)
        section.generating = false
        section.error = null
        const warnings = evaluateSectionQuality(section)
        this.sections = [...this.sections]
        if (warnings.length > 0) {
          this.addLog(`[完成] ${section.number} ${section.title} ⚠ ${warnings.join('；')}`, 'warn')
        } else {
          this.addLog(`[完成] ${section.number} ${section.title} ✓`, 'success')
        }
        this.showToast(`${section.number} ${section.title} 生成完成`, 'success')
      } catch (e) {
        if (e?.name === 'AbortError' || controller.cancelled) {
          this.addLog(`[取消] ${section.number} ${section.title} 已停止`, 'warn')
          this.showToast('已停止生成', 'info')
        } else {
          section.error = e.message || String(e)
          this.addLog(`[失败] ${section.number} ${section.title}: ${e.message}`, 'error')
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
      if (this.aiController) {
        this.aiController.paused ? this.aiController.resume() : this.aiController.pause()
      }
    },
    cancelAi() {
      if (!this.aiController) return
      this.aiController.cancel()
      this.aiProcessing = false
      this.aiProgressText = '已停止'
    },

    // ===== 导出 =====
    async exportWord() {
      const path = await save({
        title: '导出 Word 文档',
        defaultPath: `${this.docInfo.projectName || '系统'}需求规格说明书.docx`,
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      })
      if (!path) return
      try {
        const buffer = await renderDocSections(this.sections, this.docInfo)
        await writeFile(path, buffer)
        this.showToast('Word 文档已导出', 'success')
      } catch (e) {
        this.showToast('导出失败: ' + String(e), 'error')
      }
    },

    async exportMarkdown() {
      const path = await save({
        title: '导出 Markdown 文件',
        defaultPath: `${this.docInfo.projectName || '系统'}需求规格说明书.md`,
        filters: [{ name: 'Markdown 文件', extensions: ['md'] }],
      })
      if (!path) return
      try {
        const md = renderSectionsToMarkdown(this.sections, this.docInfo)
        await writeTextFile(path, md)
        this.showToast('Markdown 文件已导出', 'success')
      } catch (e) {
        this.showToast('导出失败: ' + String(e), 'error')
      }
    },

    // ===== 日志 =====
    addLog(msg, level = 'info') {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
      window.dispatchEvent(new CustomEvent('ai-log', { detail: { time, msg, level } }))
    },
    syncSelectionFromStore() {
      if (this.globalStore.providerConfigs.length > 0 && !this.selectedProviderId) {
        this.selectedProviderId = this.globalStore.activeProviderId || this.globalStore.providerConfigs[0].id
        const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
        this.selectedModelId = this.globalStore.activeModelId || p?.activeModelId || (p?.models[0]?.id || '')
      }
    },
    async loadRecentProjects() {
      try {
        this.recentProjects = (await getRecentProjects('srs')).map(r => r.path)
      } catch { /* ignore */ }
    },
    addRecentDir(path) {
      if (this.projectDirs.includes(path)) return
      this.projectDirs.push(path)
    },
  },
}
</script>

<style scoped>
.doc-preview-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
.doc-preview-container {
  max-width: 900px;
  margin: 0 auto;
}
.doc-h1 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 24px 0 8px 0;
  padding: 8px 12px;
  border-left: 4px solid var(--primary-500);
  background: var(--bg-secondary);
  border-radius: 0 6px 6px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.doc-h1:hover {
  background: var(--bg-tertiary);
}
.doc-h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 16px 0 6px 0;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-primary);
}
.doc-section-content {
  padding: 8px 0 16px 0;
}
.section-tree-item {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
  font-size: 13px;
}
.chevron-expanded {
  transform: rotate(90deg);
  transition: transform 0.15s;
}
</style>
