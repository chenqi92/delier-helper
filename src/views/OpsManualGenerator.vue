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
        <span v-else-if="hasContext" style="font-size:12px;color:var(--success-500);">
          <Check :size="12" /> 上下文就绪
        </span>

        <div class="ai-fill-group" v-if="hasContext" data-guide="ops-ai-gen">
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

        <button class="btn btn-primary btn-sm" @click="exportWord" :disabled="!hasContext" data-guide="ops-export">
          <FileDown :size="14" /> 导出 Word
        </button>
        <button class="btn btn-secondary btn-sm" @click="exportMarkdown" :disabled="!hasContext">
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
          data-guide="ops-template"
          :doc-type="'ops'"
          :sections="sections"
          @switch-template="onSwitchTemplate"
          @update-sections="onUpdateSections"
        />

        <!-- 项目目录 -->
        <div class="card" data-guide="ops-project-dir">
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
          </div>
        </div>

        <!-- 服务器连接 -->
        <ServerConnector data-guide="ops-servers" @update-servers="onUpdateServers" />

        <!-- 参考文件 -->
        <ReferenceFiles data-guide="ops-ref-files" @update-files="onUpdateReferenceFiles" />

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
        <div v-if="!hasContext" class="empty-state" style="flex:1;">
          <ServerIcon :size="48" style="opacity:0.3;margin-bottom:16px;" />
          <p>服务器运维手册</p>
          <p class="hint">请在左侧添加项目目录和/或服务器连接，扫描后点击"AI 生成"自动填充文档内容。</p>
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
                      <TableEditor
                        v-if="sec.type === 'table'"
                        :section="sec"
                        @update-content="onContentUpdate"
                      />
                      <SectionEditor
                        v-else
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
                          <TableEditor
                            v-if="child.type === 'table'"
                            :section="child"
                            @update-content="onContentUpdate"
                          />
                          <SectionEditor
                            v-else
                            :section="child"
                            @update-content="onContentUpdate"
                            @upload-image="onImageUpload"
                            @generate-single="generateSingle"
                          />
                        </div>

                        <!-- 三级子章节 -->
                        <template v-if="child.children && child.children.length > 0">
                          <template v-for="sub in child.children" :key="sub.id">
                            <template v-if="sub.enabled">
                              <h4 class="doc-h3">{{ sub.number }} {{ sub.title }}</h4>
                              <div class="doc-section-content">
                                <TableEditor
                                  v-if="sub.type === 'table'"
                                  :section="sub"
                                  @update-content="onContentUpdate"
                                />
                                <SectionEditor
                                  v-else
                                  :section="sub"
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
import { FolderOpen, Search, X, Check, FileDown, FileText, Settings, ChevronRight, Bot, Server as ServerIcon } from 'lucide-vue-next'
import { createOpsTemplate, getOpsPresets } from '../core/doc-template/ops-template.js'
import { getEnabledLeafSections, countSections, findSectionById, renumberSections } from '../core/doc-template/srs-template.js'
import { scanCodebase, buildContextSummary } from '../core/doc-template/codebase-scanner.js'
import { buildOpsContextSummary, buildOpsSectionPrompt, fillDocSections, createAiController } from '../core/doc-template/ops-llm-service.js'
import { applyDocSectionResult } from '../core/doc-template/doc-llm-service.js'
import { renderDocSections } from '../core/doc-template/doc-docx-renderer.js'
import { renderSectionsToMarkdown } from '../core/doc-template/ops-md-renderer.js'
import { getResolvedConfig, callLlm } from '../core/llm/llm-service.js'
import { saveRecentProject, getRecentProjects, savePageConfig, loadPageConfig, getSetting, setSetting } from '../core/db.js'
import SectionEditor from '../components/SectionEditor.vue'
import TableEditor from '../components/TableEditor.vue'
import TemplateSelector from '../components/TemplateSelector.vue'
import ReferenceFiles from '../components/ReferenceFiles.vue'
import ServerConnector from '../components/ServerConnector.vue'
import GuideTour from '../components/GuideTour.vue'

export default {
  name: 'OpsManualGenerator',
  components: {
    FolderOpen, Search, X, Check, FileDown, FileText, Settings, ChevronRight, Bot, ServerIcon,
    SectionEditor, TableEditor, TemplateSelector, ReferenceFiles, ServerConnector, GuideTour,
  },
  inject: ['showToast', 'guide', 'globalStore'],
  data() {
    return {
      projectDirs: [],
      scanning: false,
      scanResult: null,
      serverInfos: [],
      sections: createOpsTemplate(),
      expandedSections: new Set(),
      docInfo: {
        docTitle: '服务器运维手册',
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
        { target: 'ops-template', text: '① 选择模板：内置"标准运维手册"和"精简运维手册"，也可从 .docx/.md 导入自定义模板。点击「编辑章节」可增删章节和调整类型' },
        { target: 'ops-project-dir', text: '② 添加项目代码目录（支持多目录），扫描后 AI 可根据代码结构推断技术栈和部署方式', doneWhen: 'hasProject' },
        { target: 'ops-servers', text: '③ 添加服务器 SSH 连接信息，点击扫描可自动读取服务器上的运行服务、端口、软件版本等信息' },
        { target: 'ops-ref-files', text: '④ 导入辅助参考文件（可选）：如现有的运维文档、部署说明等，AI 会综合分析生成内容' },
        { target: 'ops-chapters', text: '⑤ 章节控制：勾选需要生成的章节。标签「表」表示该节会生成 Markdown 表格，可在右侧交互式编辑' },
        { target: 'ops-ai-gen', text: '⑥ 点击 AI 生成自动填充所有勾选章节，支持暂停/继续/取消', doneWhen: 'hasContext' },
        { target: 'ops-export', text: '⑦ 导出 Word 或 Markdown 文件' },
      ],
    }
  },
  async created() {
    if (this.sections.length > 0) {
      this.expandedSections = new Set(this.sections.map(s => s.id))
    }
    this.syncSelectionFromStore()
    loadPageConfig('ops-doc-info').then(saved => {
      if (saved) Object.assign(this.docInfo, saved)
    }).catch(() => {})
    getSetting('guide-finished-ops', false).then(v => { if (v) this.guideFinished = true }).catch(() => {})
  },
  watch: {
    docInfo: {
      deep: true,
      handler(val) { savePageConfig('ops-doc-info', val).catch(() => {}) }
    },
    guideFinished(val) { if (val) setSetting('guide-finished-ops', true).catch(() => {}) },
    'guide.enabled'(val) { if (val) this.guideFinished = false },
  },
  computed: {
    currentProviderModels() {
      const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      return p ? p.models : []
    },
    hasContext() {
      return !!(this.scanResult || this.serverInfos.some(s => s.serverData))
    },
    guideVisible() {
      if (this.guideFinished) return false
      return !!this.guide?.enabled
    },
    guideConditions() {
      return {
        hasProject: this.projectDirs.length > 0,
        hasContext: this.hasContext,
      }
    },
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
    },
    removeDir(idx) {
      this.projectDirs.splice(idx, 1)
      if (this.projectDirs.length === 0) this.scanResult = null
    },

    // ===== 代码库扫描 =====
    async startScan() {
      if (this.projectDirs.length === 0) return
      this.scanning = true
      this.addLog('开始扫描代码库...')
      try {
        this.scanResult = await scanCodebase(this.projectDirs)
        const { totalFiles } = this.scanResult.stats
        this.addLog(`[完成] 扫描完成: ${totalFiles} 个文件`)
        this.showToast(`扫描完成！发现 ${totalFiles} 个文件`, 'success')

        // 尝试推断项目名称
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
      }
      this.scanning = false
    },

    // ===== 服务器管理 =====
    onUpdateServers(servers) {
      this.serverInfos = servers
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
          if (child.children) {
            for (const sub of child.children) sub.enabled = enabled
          }
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
      if (!this.hasContext || this.aiProcessing) return
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

      this.aiProcessing = true
      window.dispatchEvent(new Event('ai-fill-start'))
      this.aiController = createAiController()
      const modelLabel = provider.models.find(m => m.id === config.model)?.label || config.model
      this.aiProgressText = `使用 ${provider.label} / ${modelLabel}...`

      try {
        const contextSummary = buildOpsContextSummary(this.scanResult, this.serverInfos, this.docInfo, this.referenceFiles)
        const leafSections = getEnabledLeafSections(this.sections)

        // 使用运维手册专用 prompt 构建器的自定义 fillDocSections
        for (let i = 0; i < leafSections.length; i++) {
          if (this.aiController?.cancelled) break
          if (this.aiController?.paused) {
            await this.aiController.waitIfPaused()
            if (this.aiController?.cancelled) break
          }

          const section = leafSections[i]
          section.generating = true
          section.error = null
          this.aiProgressText = `[${i + 1}/${leafSections.length}] ${section.number} ${section.title}`
          this.addLog(`[进行] ${this.aiProgressText}`)

          try {
            const messages = buildOpsSectionPrompt(section, contextSummary, this.docInfo)
            const defaultMaxTokens = section.type === 'diagram' ? 4096 : 16384
            const maxTokens = config.maxOutputTokens || defaultMaxTokens
            const responseText = await callLlm(config, messages, { maxTokens, temperature: 0.4, signal: this.aiController?.signal })
            applyDocSectionResult(responseText, section)
            section.generating = false
            section.error = null
            this.sections = [...this.sections]
            this.addLog(`[完成] ${section.number} ${section.title} ✓`, 'success')
          } catch (e) {
            section.generating = false
            if (e.name === 'AbortError') break
            section.error = e.message || String(e)
            this.sections = [...this.sections]
            this.addLog(`[失败] ${section.number} ${section.title}: ${e.message}`, 'error')
          }
        }
        this.showToast('运维手册生成完成！', 'success')
      } catch (e) {
        this.showToast('生成失败: ' + String(e), 'error')
      }
      this.aiProcessing = false
      this.aiProgressText = ''
      this.aiController = null
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
      if (!section || !this.hasContext) return

      this.aiProcessing = true
      section.generating = true
      section.error = null
      this.sections = [...this.sections]
      this.aiProgressText = `生成 ${section.number} ${section.title}...`
      this.addLog(`[进行] 单独生成: ${section.number} ${section.title}`)
      try {
        const contextSummary = buildOpsContextSummary(this.scanResult, this.serverInfos, this.docInfo, this.referenceFiles)
        const messages = buildOpsSectionPrompt(section, contextSummary, this.docInfo)
        const defaultMaxTokens = section.type === 'diagram' ? 4096 : 16384
        const maxTokens = config.maxOutputTokens || defaultMaxTokens
        const responseText = await callLlm(config, messages, { maxTokens, temperature: 0.4 })
        applyDocSectionResult(responseText, section)
        section.generating = false
        section.error = null
        this.sections = [...this.sections]
        this.addLog(`[完成] ${section.number} ${section.title} ✓`, 'success')
        this.showToast(`${section.number} ${section.title} 生成完成`, 'success')
      } catch (e) {
        section.generating = false
        section.error = e.message || String(e)
        this.sections = [...this.sections]
        this.showToast('生成失败: ' + String(e), 'error')
      }
      this.aiProcessing = false
      this.aiProgressText = ''
    },

    toggleAiPause() {
      if (this.aiController) {
        this.aiController.paused ? this.aiController.resume() : this.aiController.pause()
      }
    },
    cancelAi() {
      if (this.aiController) this.aiController.cancel()
    },

    // ===== 导出 =====
    async exportWord() {
      const path = await save({
        title: '导出 Word 文档',
        defaultPath: `${this.docInfo.projectName || '系统'}服务器运维手册.docx`,
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
        defaultPath: `${this.docInfo.projectName || '系统'}服务器运维手册.md`,
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
.doc-h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 12px 0 4px 0;
  padding: 4px 0;
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
