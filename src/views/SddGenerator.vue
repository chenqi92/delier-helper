<template>
  <div style="display:flex;flex-direction:column;height:100%;">
    <!-- 头部操作栏 -->
    <div class="view-header">
      <div class="header-actions">
        <span v-if="scanning" style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:12px;">
          <span class="spinner"></span> 扫描中...
        </span>
        <span v-else-if="scanResult" style="font-size:12px;color:var(--success-500);">
          <Check :size="12" /> {{ scanResult.stats.totalFiles }} 个文件，{{ scanResult.modules.length }} 个模块
        </span>

        <div class="ai-fill-group" v-if="scanResult">
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
            <option v-for="p in providerConfigs" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
          <select class="ai-model-select" v-model="selectedModelId" :disabled="aiProcessing">
            <option v-for="m in currentProviderModels" :key="m.id" :value="m.id">{{ m.label || m.id }}</option>
          </select>
        </div>

        <button class="btn btn-primary btn-sm" @click="exportWord" :disabled="!scanResult">
          <FileDown :size="14" /> 导出 Word
        </button>
      </div>
    </div>

    <!-- 主体 -->
    <div class="app-body">
      <!-- 左侧配置面板 -->
      <aside class="config-panel">
        <!-- 模板选择 -->
        <TemplateSelector
          :doc-type="'sdd'"
          :sections="sections"
          @switch-template="onSwitchTemplate"
          @update-sections="onUpdateSections"
        />
        <!-- 项目目录 -->
        <div class="card">
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

        <!-- 参考文件 -->
        <ReferenceFiles @update-files="onUpdateReferenceFiles" />

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

        <!-- 章节控制 -->
        <div class="card">
          <div class="card-header">
            <h3><Settings :size="14" /> 章节控制</h3>
            <div style="display:flex;gap:4px;">
              <span class="select-action" @click="toggleAllSections(true)">全选</span>
              <span class="select-action" @click="toggleAllSections(false)">全不选</span>
            </div>
          </div>
          <div class="card-body" style="max-height:300px;overflow-y:auto;">
            <div v-for="sec in sections" :key="sec.id">
              <label class="checkbox-label section-tree-item" :style="{ fontWeight: 'bold' }">
                <input type="checkbox" v-model="sec.enabled" @change="toggleChildSections(sec, sec.enabled)" />
                <span>{{ sec.number }} {{ sec.title }}</span>
              </label>
              <div v-if="sec.children && sec.children.length > 0" style="padding-left:16px;">
                <label v-for="child in sec.children" :key="child.id" class="checkbox-label section-tree-item">
                  <input type="checkbox" v-model="child.enabled" />
                  <span style="font-size:12px;">{{ child.number }} {{ child.title }}</span>
                  <span v-if="child.type === 'diagram'" class="badge badge-info" style="font-size:10px;margin-left:4px;">图</span>
                  <span v-if="child.type === 'table'" class="badge badge-warning" style="font-size:10px;margin-left:4px;">表</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧预览/编辑区 -->
      <main class="content-panel">
        <!-- 空状态 -->
        <div v-if="!scanResult" class="empty-state" style="flex:1;">
          <BookOpen :size="48" style="opacity:0.3;margin-bottom:16px;" />
          <p>软件设计文档</p>
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
                    <!-- 一级标题自身内容（无子章节时） -->
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
import { writeFile } from '@tauri-apps/plugin-fs'
import { FolderOpen, Search, X, Check, FileDown, FileText, Settings, ChevronRight, Bot, BookOpen } from 'lucide-vue-next'
import { createSddTemplate, getEnabledLeafSections, findSectionById } from '../core/doc-template/sdd-template.js'
import { scanCodebase, buildContextSummary } from '../core/doc-template/codebase-scanner.js'
import { renderDocSections } from '../core/doc-template/doc-docx-renderer.js'
import { fillDocSections, buildDocSectionPrompt, applyDocSectionResult, createAiController } from '../core/doc-template/doc-llm-service.js'
import { loadProviderConfigs, loadActiveSelection, getResolvedConfig, callLlm } from '../core/llm/llm-service.js'
import SectionEditor from '../components/SectionEditor.vue'
import TemplateSelector from '../components/TemplateSelector.vue'
import ReferenceFiles from '../components/ReferenceFiles.vue'

export default {
  name: 'SddGenerator',
  components: {
    FolderOpen, Search, X, Check, FileDown, FileText, Settings, ChevronRight, Bot, BookOpen,
    SectionEditor, TemplateSelector, ReferenceFiles,
  },
  inject: ['showToast'],
  data() {
    return {
      projectDirs: [],
      scanning: false,
      scanResult: null,
      sections: createSddTemplate(),
      expandedSections: new Set(),
      docInfo: {
        docTitle: '软件设计文档',
        projectName: '',
        version: 'V1.0',
        author: '',
        organization: '',
        date: new Date().toISOString().slice(0, 10),
      },
      aiProcessing: false,
      aiProgressText: '',
      aiController: null,
      providerConfigs: [],
      selectedProviderId: null,
      selectedModelId: null,
      referenceFiles: [],
    }
  },
  async created() {
    if (this.sections.length > 0) {
      this.expandedSections = new Set(this.sections.map(s => s.id))
    }
    this.providerConfigs = await loadProviderConfigs()
    if (this.providerConfigs.length > 0) {
      const { providerId, modelId } = await loadActiveSelection()
      const found = this.providerConfigs.find(p => p.id === providerId)
      const target = found || this.providerConfigs[0]
      this.selectedProviderId = target.id
      this.selectedModelId = modelId || target.activeModelId || (target.models[0]?.id || '')
    }
  },
  computed: {
    currentProviderModels() {
      const p = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      return p ? p.models : []
    },
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
        const { totalFiles, totalDirs, languages } = this.scanResult.stats
        const langList = Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l).join(', ')
        this.addLog(`[完成] 扫描完成: ${totalFiles} 个文件, ${totalDirs} 个目录, 主要语言: ${langList}`)
        this.showToast(`扫描完成！发现 ${totalFiles} 个文件`, 'success')

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
        for (const child of parent.children) child.enabled = enabled
      }
    },

    // ===== 模板和参考文件 =====
    onSwitchTemplate(newSections) {
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
      const p = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (p && p.models.length > 0) this.selectedModelId = p.activeModelId || p.models[0].id
    },
    async startAiGenerate() {
      if (!this.scanResult || this.aiProcessing) return
      this.providerConfigs = await loadProviderConfigs()
      if (this.providerConfigs.length === 0) {
        this.showToast('请先在「AI 设置」标签页配置模型', 'warning')
        return
      }
      const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId) || this.providerConfigs[0]
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
        const contextSummary = buildContextSummary(this.scanResult, this.docInfo, this.referenceFiles)
        const leafSections = getEnabledLeafSections(this.sections)
        await fillDocSections(
          config, leafSections, contextSummary, this.docInfo,
          (msg, level) => { this.addLog(msg, level); this.aiProgressText = msg },
          () => { this.sections = [...this.sections] },
          this.aiController,
        )
        this.showToast('文档生成完成！', 'success')
      } catch (e) {
        this.showToast('生成失败: ' + String(e), 'error')
      }
      this.aiProcessing = false
      this.aiProgressText = ''
      this.aiController = null
    },
    async generateSingle(sectionId) {
      if (this.aiProcessing) return
      const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (!provider) { this.showToast('请先选择 AI 模型', 'warning'); return }
      const config = getResolvedConfig(provider, this.selectedModelId)
      const section = findSectionById(this.sections, sectionId)
      if (!section || !this.scanResult) return

      this.aiProcessing = true
      this.aiProgressText = `生成 ${section.number} ${section.title}...`
      this.addLog(`[进行] 单独生成: ${section.number} ${section.title}`)
      try {
        const contextSummary = buildContextSummary(this.scanResult, this.docInfo, this.referenceFiles)
        const messages = buildDocSectionPrompt(section, contextSummary, this.docInfo)
        const maxTokens = section.type === 'diagram' ? 4096 : 8192
        const responseText = await callLlm(config, messages, { maxTokens, temperature: 0.4 })
        applyDocSectionResult(responseText, section)
        this.sections = [...this.sections]
        this.addLog(`[完成] ${section.number} ${section.title} ✓`, 'success')
        this.showToast(`${section.number} ${section.title} 生成完成`, 'success')
      } catch (e) {
        this.addLog(`[失败] ${section.number} ${section.title}: ${e.message}`, 'error')
        this.showToast('生成失败: ' + String(e), 'error')
      }
      this.aiProcessing = false
      this.aiProgressText = ''
    },
    toggleAiPause() {
      if (this.aiController) this.aiController.paused ? this.aiController.resume() : this.aiController.pause()
    },
    cancelAi() {
      if (this.aiController) this.aiController.cancel()
    },

    // ===== 导出 =====
    async exportWord() {
      const path = await save({
        title: '导出 Word 文档',
        defaultPath: `${this.docInfo.projectName || '系统'}软件设计文档.docx`,
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

    // ===== 日志 =====
    addLog(msg, level = 'info') {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
      window.dispatchEvent(new CustomEvent('ai-log', { detail: { time, msg, level } }))
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
