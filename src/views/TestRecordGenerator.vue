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
        <div class="ai-fill-group" v-if="hasContent" data-guide="tr-ai-gen">
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

        <button class="btn btn-primary btn-sm" @click="exportWord" :disabled="!hasContent" data-guide="tr-export">
          <FileDown :size="14" /> 导出 Word
        </button>
        <button class="btn btn-secondary btn-sm" @click="exportMarkdown" :disabled="!hasContent">
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
          data-guide="tr-template"
          :doc-type="'testrecord'"
          :sections="sections"
          @switch-template="onSwitchTemplate"
          @update-sections="onUpdateSections"
        />

        <!-- Excel 导入（核心输入） -->
        <div class="card" data-guide="tr-excel">
          <div class="card-header">
            <h3><FileSpreadsheet :size="14" /> Excel 测试记录导入</h3>
          </div>
          <div class="card-body">
            <button class="btn btn-primary btn-sm" style="width:100%;" @click="importExcel" :disabled="excelLoading">
              <Upload :size="14" /> {{ excelLoading ? '正在解析 Excel...' : '导入 Excel 测试记录' }}
            </button>
            <div v-if="excelLoading" class="tip" style="margin-top:8px;">
              <span class="spinner-sm"></span>
              <span>正在解析 Excel 文件并提取数据，请稍候...</span>
            </div>
            <div v-if="excelData" style="margin-top:8px;">
              <div class="tip">
                <Lightbulb :size="14" class="tip-icon" />
                <span>已导入 {{ excelData.sheets.length }} 个工作表，共 {{ excelStats.totalRows }} 条数据</span>
              </div>
              <div v-for="sheet in excelData.sheets" :key="sheet.name" style="margin-top:4px;font-size:11px;color:var(--text-secondary);">
                📋 {{ sheet.name }}（{{ sheet.totalRows }} 行{{ sheet.imageCount > 0 ? `，${sheet.imageCount} 张图片` : '' }}）
              </div>
              <div style="margin-top:6px;font-size:11px;color:var(--text-secondary);">
                <strong>列名：</strong>{{ excelData.sheets.map(s => s.headers.join('、')).join(' | ') }}
              </div>
              <!-- 图片画廊 -->
              <div v-if="excelStats.totalImages > 0" style="margin-top:6px;font-size:11px;color:var(--info-500);">
                <strong>📷 图片：</strong>{{ excelStats.totalImages }} 张
                <button class="btn btn-secondary btn-sm" style="margin-left:6px;padding:1px 6px;font-size:10px;" @click="showImageGallery = !showImageGallery">
                  {{ showImageGallery ? '收起' : '查看' }}
                </button>
              </div>
              <div v-if="showImageGallery && allExcelImages.length > 0" class="excel-image-gallery">
                <div v-for="(img, idx) in allExcelImages" :key="idx" class="excel-image-thumb" @click="previewImage = img.dataUrl">
                  <img :src="img.dataUrl" :alt="img.fileName" />
                  <span class="excel-image-label">行{{ img.row + 1 }}</span>
                </div>
              </div>
              <div v-if="previewImage" class="image-preview-overlay" @click="previewImage = null">
                <img :src="previewImage" class="image-preview-full" @click.stop />
                <button class="btn btn-secondary btn-sm" style="position:absolute;top:16px;right:16px;" @click="previewImage = null">✕ 关闭</button>
              </div>
            </div>
            <div v-else class="tip" style="margin-top:8px;">
              <Lightbulb :size="14" class="tip-icon" />
              <span>导入 Excel 测试记录后，AI 将基于实际数据生成测试报告</span>
            </div>
          </div>
        </div>

        <!-- 参考文件 -->
        <ReferenceFiles data-guide="tr-ref-files" @update-files="onUpdateReferenceFiles" />

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
        <div v-if="!hasContent" class="empty-state" style="flex:1;">
          <ClipboardList :size="48" style="opacity:0.3;margin-bottom:16px;" />
          <p>测试记录文档</p>
          <p class="hint">请在左侧导入 Excel 测试记录，选择模板后点击"AI 生成"自动填充。</p>
        </div>

        <template v-else>
          <div class="doc-preview-scroll">
            <div class="doc-preview-container">
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
        </template>
      </main>
    </div>
  </div>
</template>

<script>
import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { FolderOpen, Search, X, Check, FileDown, FileText, ChevronRight, Bot, Upload, ClipboardList } from 'lucide-vue-next'
import { createTestRecordTemplate, getEnabledLeafSections, findSectionById, injectExcelSections } from '../core/doc-template/test-template.js'
import { renderDocSections } from '../core/doc-template/doc-docx-renderer.js'
import { renderSectionsToMarkdown } from '../core/doc-template/ops-md-renderer.js'
import { fillDocSections, buildDocSectionPrompt, applyDocSectionResult, evaluateSectionQuality, createAiController } from '../core/doc-template/doc-llm-service.js'

const SECTION_TEMPERATURE = { diagram: 0.1, table: 0.35, text: 0.55 }
import { getResolvedConfig, callLlm } from '../core/llm/llm-service.js'
import { savePageConfig, loadPageConfig, getSetting, setSetting } from '../core/db.js'
import { parseTestExcel, sheetsToMarkdown, getBasicStats } from '../core/doc-template/test-excel-parser.js'
import { excelSourceSnapshot, modelSnapshot, saveHistoryRecord, sectionsArtifact } from '../core/generation-history.js'
import SectionEditor from '../components/SectionEditor.vue'
import TemplateSelector from '../components/TemplateSelector.vue'
import ReferenceFiles from '../components/ReferenceFiles.vue'
import GuideTour from '../components/GuideTour.vue'

const FileSpreadsheet = { template: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :width="size" :height="size"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg>', props: { size: { type: Number, default: 14 } } }
const Lightbulb = { template: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :width="size" :height="size"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>', props: { size: { type: Number, default: 14 } } }

export default {
  name: 'TestRecordGenerator',
  components: {
    FolderOpen, Search, X, Check, FileDown, FileText, ChevronRight, Bot, Upload, ClipboardList,
    FileSpreadsheet, Lightbulb,
    SectionEditor, TemplateSelector, ReferenceFiles, GuideTour,
  },
  inject: ['showToast', 'guide', 'globalStore'],
  data() {
    return {
      sections: createTestRecordTemplate(),
      expandedSections: new Set(),
      docInfo: {
        docTitle: '测试记录文档',
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
      excelData: null,
      excelLoading: false,
      showImageGallery: false,
      previewImage: null,
      guideFinished: false,
      isActive: true,
      guideSteps: [
        { target: 'tr-template', text: '① 选择模板：标准版或精简版，也可导入自定义模板' },
        { target: 'tr-excel', text: '② 导入 Excel 测试记录，系统会智能识别表头并提取执行数据和统计信息' },
        { target: 'tr-ai-gen', text: '③ 点击 AI 生成，基于导入的测试数据自动生成完整测试报告', doneWhen: 'hasGenerated' },
        { target: 'tr-export', text: '④ 导出 Word 或 Markdown 文件' },
      ],
    }
  },
  async created() {
    if (this.sections.length > 0) {
      this.expandedSections = new Set(this.sections.map(s => s.id))
    }
    this.syncSelectionFromStore()
    loadPageConfig('tr-doc-info').then(saved => {
      if (saved) Object.assign(this.docInfo, saved)
    }).catch(() => {})
    getSetting('guide-finished-tr', false).then(v => { if (v) this.guideFinished = true }).catch(() => {})
  },
  watch: {
    docInfo: {
      deep: true,
      handler(val) { savePageConfig('tr-doc-info', val).catch(() => {}) }
    },
    guideFinished(val) { if (val) setSetting('guide-finished-tr', true).catch(() => {}) },
    'guide.enabled'(val) { if (val) this.guideFinished = false },
  },
  computed: {
    currentProviderModels() {
      const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      return p ? p.models : []
    },
    hasContent() {
      return !!this.excelData
    },
    excelStats() {
      return getBasicStats(this.excelData) || { totalRows: 0, totalImages: 0 }
    },
    allExcelImages() {
      if (!this.excelData) return []
      return this.excelData.sheets.flatMap(s => s.images || [])
    },
    guideVisible() {
      if (this.guideFinished) return false
      return !!this.guide?.enabled
    },
    guideConditions() {
      return {
        hasGenerated: this.sections.some(s => s.content || s.children?.some(c => c.content)),
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
    // ===== Excel 导入 =====
    async importExcel() {
      if (this.excelLoading) return
      const filePath = await open({
        title: '选择 Excel 测试记录文件',
        filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }],
      })
      if (!filePath) return
      this.excelLoading = true
      try {
        const fileBytes = await readFile(filePath)
        this.excelData = await parseTestExcel(fileBytes)
        if (this.excelData.sheets.length === 0) {
          this.showToast('未在 Excel 中识别到有效数据', 'warning')
          this.excelData = null
          return
        }
        const stats = getBasicStats(this.excelData)
        // 动态注入测试记录到模板章节
        this.sections = injectExcelSections(this.sections, this.excelData, 'testrecord')
        this.expandedSections = new Set(this.sections.map(s => s.id))
        this.showToast(`成功导入 ${stats.totalRows} 条测试记录，已按模块注入到章节`, 'success')
        this.addLog(`[Excel] 导入 ${this.excelData.sheets.length} 个工作表，共 ${stats.totalRows} 行，已智能分组注入`)
      } catch (e) {
        this.showToast('Excel 导入失败: ' + String(e), 'error')
      } finally {
        this.excelLoading = false
      }
    },

    // ===== 章节控制 =====
    toggleSection(id) {
      const s = new Set(this.expandedSections)
      s.has(id) ? s.delete(id) : s.add(id)
      this.expandedSections = s
    },
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
    _buildExcelContext() {
      if (!this.excelData || this.excelData.sheets.length === 0) return ''
      const stats = getBasicStats(this.excelData)
      // 测试记录数据已注入到各子章节的 prompt 中
      let ctx = '\n\n## 导入的 Excel 测试记录概览\n'
      ctx += `用户已导入 Excel 测试执行记录，共 ${stats.totalRows} 条。`
      ctx += `各测试项的具体数据已分配到对应的测试记录子章节中，请在生成每个章节时仔细查看 prompt 中的具体数据。\n`
      if (stats.totalImages > 0) ctx += `包含 ${stats.totalImages} 张截图。截图信息已标注在对应的子章节 prompt 中。\n`
      return ctx
    },
    async startAiGenerate() {
      if (!this.hasContent || this.aiProcessing) return
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
        let contextSummary = `项目名称: ${this.docInfo.projectName || '未指定'}\n`
        contextSummary += this._buildExcelContext()

        const leafSections = getEnabledLeafSections(this.sections)
        await fillDocSections(
          config, leafSections, contextSummary, this.docInfo,
          (msg) => {
            this.addLog(msg)
            this.aiProgressText = msg
          },
          () => { this.sections = [...this.sections] },
          controller,
        )
        if (controller.cancelled) this.showToast('已停止生成', 'info')
        else {
          const generatedCount = getEnabledLeafSections(this.sections).filter(s => s.content || s.mermaidCode || s.imageData).length
          await saveHistoryRecord({
            type: 'tr-doc',
            title: `${this.docInfo.projectName || '系统'} 测试记录`,
            summary: `${generatedCount} 个章节已生成，Excel ${this.excelStats.totalRows || 0} 行`,
            providerId: provider.id,
            modelId: config.model,
            source: {
              excel: excelSourceSnapshot(this.excelData),
              referenceFiles: this.referenceFiles.map(f => ({ name: f.name || f.path || '参考文件', type: f.type || '', size: f.size || 0 })),
            },
            settings: {
              docInfo: this.docInfo,
              model: modelSnapshot(provider, this.selectedModelId, config),
              enabledSections: getEnabledLeafSections(this.sections).map(s => ({ number: s.number, title: s.title, type: s.type })),
            },
            result: {
              generatedSections: generatedCount,
              totalSections: getEnabledLeafSections(this.sections).length,
              excelStats: this.excelStats,
            },
            artifact: sectionsArtifact(this.sections, this.docInfo),
          })
          this.showToast('测试记录生成完成！', 'success')
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
    async generateSingle(sectionId) {
      if (this.aiProcessing) return
      const provider = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (!provider) {
        this.showToast('请先选择 AI 模型', 'warning')
        return
      }
      const config = getResolvedConfig(provider, this.selectedModelId)
      const section = findSectionById(this.sections, sectionId)
      if (!section) return

      const controller = createAiController()
      this.aiProcessing = true
      this.aiController = controller
      section.generating = true
      section.error = null
      this.sections = [...this.sections]
      this.aiProgressText = `生成 ${section.number} ${section.title}...`
      try {
        let contextSummary = `项目名称: ${this.docInfo.projectName || '未指定'}\n`
        contextSummary += this._buildExcelContext()
        const messages = buildDocSectionPrompt(section, contextSummary, this.docInfo)
        const maxTokens = config.maxOutputTokens || 16384
        const temperature = SECTION_TEMPERATURE[section.type] ?? 0.5
        const responseText = await callLlm(config, messages, { maxTokens, temperature, jsonMode: false, signal: controller.signal })
        applyDocSectionResult(responseText, section)
        section.generating = false
        section.error = null
        evaluateSectionQuality(section)
        this.sections = [...this.sections]
        this.showToast(`${section.number} ${section.title} 生成完成`, 'success')
      } catch (e) {
        if (e?.name === 'AbortError' || controller.cancelled) {
          this.showToast('已停止生成', 'info')
        } else {
          section.error = e.message || String(e)
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
        defaultPath: `${this.docInfo.projectName || '系统'}测试记录.docx`,
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      })
      if (!path) return
      try {
        const buffer = await renderDocSections(this.sections, { ...this.docInfo, docTitle: this.docInfo.docTitle || '测试记录文档' })
        await writeFile(path, buffer)
        this.showToast('Word 文档已导出', 'success')
      } catch (e) {
        this.showToast('导出失败: ' + String(e), 'error')
      }
    },
    async exportMarkdown() {
      const path = await save({
        title: '导出 Markdown 文件',
        defaultPath: `${this.docInfo.projectName || '系统'}测试记录.md`,
        filters: [{ name: 'Markdown 文件', extensions: ['md'] }],
      })
      if (!path) return
      try {
        const md = renderSectionsToMarkdown(this.sections, { ...this.docInfo, docTitle: this.docInfo.docTitle || '测试记录文档' })
        await writeTextFile(path, md)
        this.showToast('Markdown 文件已导出', 'success')
      } catch (e) {
        this.showToast('导出失败: ' + String(e), 'error')
      }
    },

    // ===== 辅助 =====
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
.doc-preview-scroll { flex: 1; overflow-y: auto; padding: 24px; }
.doc-preview-container { max-width: 900px; margin: 0 auto; }
.doc-h1 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 24px 0 8px 0; padding: 8px 12px; border-left: 4px solid var(--primary-500); background: var(--bg-secondary); border-radius: 0 6px 6px 0; display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; transition: background 0.15s; }
.doc-h1:hover { background: var(--bg-tertiary); }
.doc-h2 { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 16px 0 6px 0; padding: 6px 0; border-bottom: 1px solid var(--border-primary); }
.doc-section-content { padding: 8px 0 16px 0; }
.chevron-expanded { transform: rotate(90deg); transition: transform 0.15s; }
.excel-image-gallery { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; max-height: 200px; overflow-y: auto; }
.excel-image-thumb { width: 60px; height: 60px; border-radius: 4px; overflow: hidden; cursor: pointer; border: 1px solid var(--border-primary); position: relative; transition: transform 0.15s; }
.excel-image-thumb:hover { transform: scale(1.1); z-index: 1; }
.excel-image-thumb img { width: 100%; height: 100%; object-fit: cover; }
.excel-image-label { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); color: #fff; font-size: 9px; text-align: center; padding: 1px; }
.image-preview-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.image-preview-full { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px; cursor: default; }
</style>
