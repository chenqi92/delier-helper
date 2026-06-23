<template>
  <div style="display:flex;flex-direction:column;height:100%;">
    <!-- 头部操作栏 -->
    <div class="view-header">
      <div class="header-actions">
        <span v-if="scanning" style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:12px;">
          <span class="spinner"></span> 扫描中...
        </span>
        <span v-else-if="scanResult" style="font-size:12px;color:var(--success-500);">
          <Check :size="12" /> 上下文就绪
        </span>

        <div class="ai-fill-group">
          <button v-if="!aiProcessing" class="btn btn-primary btn-sm" @click="startAiGenerate">
            <Sparkles :size="14" /> {{ deck ? '重新生成' : 'AI 生成' }}
          </button>
          <template v-else>
            <button class="btn btn-secondary btn-sm" @click="toggleAiPause">
              {{ aiController?.paused ? '▶ 继续' : '⏸ 暂停' }}
            </button>
            <button class="btn btn-danger btn-sm" @click="cancelAi">✕ 取消</button>
            <span style="font-size:11px;color:var(--text-secondary);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
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

        <button class="btn btn-primary btn-sm" @click="exportPptx" :disabled="!deck || exporting">
          <FileDown :size="14" /> {{ exporting ? '导出中...' : '导出 PPTX' }}
        </button>
      </div>
    </div>

    <div class="app-body">
      <!-- 左侧配置面板 -->
      <aside class="config-panel">
        <!-- 模板 -->
        <div class="card">
          <div class="card-header"><h3><LayoutTemplate :size="14" /> 模板</h3></div>
          <div class="card-body" style="padding:8px;">
            <div class="tpl-strip">
              <div v-for="t in templatePreviews" :key="t.id"
                :class="['tpl-card', { active: selectedTemplateId === t.id }]"
                @click="selectedTemplateId = t.id" :title="t.description">
                <div class="tpl-thumb">
                  <SlideCanvas :slide="t.slide" :width="186" :interactive="false" />
                  <button v-if="t.isCustom" class="tpl-del" @click.stop="removeTemplate(t)"><X :size="11" /></button>
                  <span v-if="t.mode==='fixed'" class="tpl-badge2">固定</span>
                </div>
                <div class="tpl-card-name">{{ t.name }}</div>
              </div>
            </div>
            <div class="tpl-desc-line">{{ selectedTemplate?.description }}</div>
          </div>
        </div>

        <!-- 风格 -->
        <div class="card">
          <div class="card-header"><h3><Palette :size="14" /> 风格</h3></div>
          <div class="card-body">
            <select class="form-input" v-model="styleOverrideId" :disabled="aiProcessing">
              <option value="">跟随模板{{ templateStyleName ? '（' + templateStyleName + '）' : '' }}</option>
              <option v-for="s in styleList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <div class="swatch-row">
              <span v-for="s in styleList" :key="s.id"
                :class="['swatch', { active: effectiveStyleId === s.id }]"
                :style="{ background: '#' + s.primary, borderColor: '#' + s.accent }"
                :title="s.name" @click="!aiProcessing && (styleOverrideId = s.id)"></span>
            </div>
          </div>
        </div>

        <!-- 项目目录 -->
        <div class="card">
          <div class="card-header"><h3><FolderOpen :size="14" /> 项目目录</h3></div>
          <div class="card-body">
            <div v-for="(dir, idx) in projectDirs" :key="idx" class="dir-item" style="margin-bottom:4px;">
              <div class="dir-item-header">
                <span class="dir-path" :title="dir">{{ dir }}</span>
                <button class="btn btn-danger btn-sm btn-icon" @click="removeDir(idx)"><X :size="14" /></button>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" style="width:100%;margin-top:8px;" @click="addProjectDir">
              <FolderOpen :size="14" /> {{ projectDirs.length > 0 ? '添加目录' : '选择目录（可多套）' }}
            </button>
            <button v-if="projectDirs.length > 0" class="btn btn-secondary btn-sm" style="width:100%;margin-top:4px;" @click="startScan" :disabled="scanning">
              <Search :size="14" /> {{ scanning ? '扫描中...' : '扫描代码库' }}
            </button>
          </div>
        </div>

        <!-- 内容设置 -->
        <div class="card">
          <div class="card-header"><h3><Settings :size="14" /> 内容设置</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:6px;">
            <button class="btn btn-secondary btn-sm" style="width:100%;" :disabled="analyzing || aiProcessing || !scanResult" @click="analyzeProject">
              <Wand2 :size="14" /> {{ analyzing ? '分析中...' : 'AI 分析项目 · 自动填主题/方向/风格' }}
            </button>
            <div class="form-group">
              <label class="form-label">主题<span style="color:var(--text-muted);font-weight:400;"> · 留空则由 AI 分析项目拟定</span></label>
              <input type="text" class="form-input" v-model="cfg.topic" placeholder="如：XX 管理系统 产品介绍" />
            </div>
            <div class="form-group">
              <label class="form-label">受众</label>
              <input type="text" class="form-input" v-model="cfg.audience" placeholder="公司领导 / 客户 / 技术团队" />
            </div>
            <div class="form-group">
              <label class="form-label">内容大方向</label>
              <textarea class="form-input" v-model="cfg.direction" rows="2" placeholder="希望突出的重点，如：技术架构 + 核心能力 + 实施成效"></textarea>
            </div>
            <div style="display:flex;gap:6px;">
              <div class="form-group" style="flex:1;">
                <label class="form-label">页数</label>
                <input type="number" class="form-input" v-model.number="cfg.pageCount" min="3" max="40" :disabled="fixedTemplateSelected" />
              </div>
              <div class="form-group" style="flex:1;">
                <label class="form-label">语言</label>
                <input type="text" class="form-input" v-model="cfg.language" placeholder="中文" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">落款（单位 / 作者 / 日期）</label>
              <input type="text" class="form-input" v-model="cfg.footnote" placeholder="可选" />
            </div>
          </div>
        </div>

        <!-- 图片素材 -->
        <div class="card">
          <div class="card-header"><h3><ImageIcon :size="14" /> 图片素材</h3></div>
          <div class="card-body">
            <p style="font-size:11px;color:var(--text-secondary);margin:0 0 6px;line-height:1.5;">导入截图/配图,生成时自动编排进合适的页面(大图展示/图集/图文页)</p>
            <div v-if="images.length" class="img-thumbs">
              <div v-for="(im, idx) in images" :key="idx" class="img-thumb">
                <img :src="im.src" :title="im.name" />
                <button class="img-del" @click="removeImage(idx)"><X :size="10" /></button>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:6px;" @click="addImages">
              <ImageIcon :size="14" /> 添加图片{{ images.length ? '（' + images.length + '）' : '' }}
            </button>
          </div>
        </div>

        <button v-if="deck" class="btn btn-secondary btn-sm" style="margin-top:2px;" @click="saveAsTemplate">
          <Save :size="14" /> 存为模板
        </button>
      </aside>

      <!-- 右侧编辑 / 预览区 -->
      <main class="content-panel" style="padding:0;">
        <!-- 空状态 -->
        <div v-if="!deck" class="empty-state" style="flex:1;">
          <Presentation :size="48" style="opacity:0.3;margin-bottom:16px;" />
          <p>项目 PPT 生成器</p>
          <p class="hint">左侧选模板与风格、填主题与页数（可扫描代码库作为依据），点击「AI 生成」。生成后右侧可直接拖拽、缩放、改字、增删元素。</p>
        </div>

        <template v-else>
          <!-- 元素 / 页面工具栏 -->
          <div class="editor-toolbar" :class="{ 'tb-locked': aiProcessing }">
            <div class="tb-group">
              <button class="tb-btn" @click="addText" title="加文本"><Type :size="14" /></button>
              <button class="tb-btn" @click="addShape('rect')" title="加矩形"><Square :size="14" /></button>
              <button class="tb-btn" @click="addShape('roundRect')" title="加圆角矩形"><SquareRoundCorner :size="14" /></button>
              <button class="tb-btn" @click="addShape('ellipse')" title="加圆"><Circle :size="14" /></button>
              <button class="tb-btn" @click="addIcon" title="加图标"><Star :size="14" /></button>
              <button class="tb-btn" @click="addImageEl" title="加图片"><ImageIcon :size="14" /></button>
            </div>
            <div class="tb-group" v-if="selectedEl">
              <input type="color" class="tb-color" :value="'#' + selColor" @input="setSelColor($event.target.value)" title="颜色" />
              <button class="tb-btn" @click="zOrder(1)" title="上移一层"><ChevronUp :size="14" /></button>
              <button class="tb-btn" @click="zOrder(-1)" title="下移一层"><ChevronDown :size="14" /></button>
              <button class="tb-btn" @click="duplicateEl" title="复制"><Copy :size="14" /></button>
              <button class="tb-btn danger" @click="deleteEl" title="删除"><Trash2 :size="14" /></button>
            </div>
            <div style="flex:1;"></div>
            <div class="tb-group">
              <span class="tb-label">第 {{ currentSlideIndex + 1 }} / {{ deck.slides.length }} 页</span>
              <button class="tb-btn" @click="regenerateSlide" :disabled="aiProcessing" title="重生成本页"><RefreshCw :size="14" /></button>
              <button class="tb-btn" @click="duplicateSlide" title="复制本页"><CopyPlus :size="14" /></button>
              <button class="tb-btn" @click="addSlide" title="新增空白页"><Plus :size="14" /></button>
              <button class="tb-btn danger" @click="deleteSlide" :disabled="deck.slides.length <= 1" title="删除本页"><Trash2 :size="14" /></button>
            </div>
          </div>

          <!-- 主画布 -->
          <div ref="canvasWrap" class="canvas-wrap" tabindex="0" @keydown="onKey">
            <SlideCanvas
              v-if="currentSlide"
              :slide="currentSlide"
              :width="canvasWidth"
              :interactive="!aiProcessing"
              v-model:selectedId="selectedElId"
              @change="markDirty"
            />
            <div v-if="currentSlide && currentSlide.pending" class="pending-badge"><span class="spinner"></span> 待填充…</div>
          </div>

          <!-- 缩略图条 -->
          <div class="filmstrip">
            <div v-for="(s, i) in deck.slides" :key="s.id"
              :class="['thumb', { active: i === currentSlideIndex }]"
              @click="selectSlide(i)">
              <div class="thumb-no">{{ i + 1 }}</div>
              <div class="thumb-canvas">
                <SlideCanvas :slide="s" :width="148" :interactive="false" />
                <div v-if="s.pending" class="thumb-pending"></div>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script>
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeFile, readFile } from '@tauri-apps/plugin-fs'
import {
  Check, Sparkles, FileDown, FolderOpen, Search, X, Settings, Palette, LayoutTemplate, Presentation,
  Save, Type, Square, Circle, Star, Trash2, Copy, CopyPlus, Plus, RefreshCw, ChevronUp, ChevronDown,
  SquareRoundCorner, Image as ImageIcon, Wand2,
} from 'lucide-vue-next'
import SlideCanvas from '../components/SlideCanvas.vue'
import { scanCodebase, buildContextSummary } from '../core/doc-template/codebase-scanner.js'
import { getResolvedConfig } from '../core/llm/llm-service.js'
import { generateOutline, generateSlideContent, generateProjectBrief, createAiController } from '../core/ppt/ppt-llm-service.js'
import { buildDeckFromOutline, restyleDeck, appendBlankSlide } from '../core/ppt/ppt-deck.js'
import { buildSlide } from '../core/ppt/ppt-layouts.js'
import { getStyle, listStyles, pickRandomStyle, DEFAULT_STYLE_ID } from '../core/ppt/ppt-styles.js'
import { E, cloneElement } from '../core/ppt/ppt-elements.js'
import { pickInk, SLIDE_W, SLIDE_H } from '../core/ppt/ppt-geometry.js'
import { getPptPresets, toDeckSkeleton } from '../core/ppt/ppt-template-presets.js'
import { loadCustomPptTemplates, saveCustomPptTemplate, deleteCustomPptTemplate } from '../core/ppt/ppt-template-store.js'
import { renderDeckToPptx } from '../core/ppt/ppt-pptx-renderer.js'
import { savePageConfig, loadPageConfig, getSetting, setSetting } from '../core/db.js'

export default {
  name: 'PptGenerator',
  components: {
    SlideCanvas,
    Check, Sparkles, FileDown, FolderOpen, Search, X, Settings, Palette, LayoutTemplate, Presentation,
    Save, Type, Square, Circle, Star, Trash2, Copy, CopyPlus, Plus, RefreshCw, ChevronUp, ChevronDown,
    SquareRoundCorner, ImageIcon, Wand2,
  },
  inject: ['showToast', 'globalStore'],
  data() {
    return {
      projectDirs: [],
      scanning: false,
      scanResult: null,
      deck: null,
      currentSlideIndex: 0,
      selectedElId: null,
      canvasWidth: 880,
      cfg: { topic: '', audience: '', direction: '', pageCount: 12, language: '中文', footnote: '' },
      selectedTemplateId: 'ppt-auto',
      styleOverrideId: '',
      customTemplates: [],
      images: [],
      analyzing: false,
      lastStyleId: null,
      aiProcessing: false,
      aiProgressText: '',
      aiController: null,
      exporting: false,
      selectedProviderId: null,
      selectedModelId: null,
      styleList: listStyles(),
    }
  },
  computed: {
    allTemplates() {
      return [...getPptPresets().map(t => ({ ...t, isCustom: false })), ...this.customTemplates.map(t => ({ ...t, isCustom: true }))]
    },
    templatePreviews() {
      const sample = {
        kicker: '示例', title: '风格预览',
        cards: [
          { icon: 'zap', title: '高性能', desc: '示例描述文字内容' },
          { icon: 'shield', title: '更安全', desc: '示例描述文字内容' },
          { icon: 'database', title: '易扩展', desc: '示例描述文字内容' },
        ],
      }
      return this.allTemplates.map(t => {
        const sid = (!t.styleId || t.styleId === 'auto') ? 'tech-dark' : t.styleId
        return { ...t, slide: buildSlide('featureGrid', sample, getStyle(sid), 1) }
      })
    },
    selectedTemplate() {
      return this.allTemplates.find(t => t.id === this.selectedTemplateId) || this.allTemplates[0]
    },
    fixedTemplateSelected() { return this.selectedTemplate?.mode === 'fixed' },
    templateStyleName() {
      const sid = this.selectedTemplate?.styleId
      if (!sid || sid === 'auto') return '自动'
      return getStyle(sid).name
    },
    effectiveStyleId() {
      if (this.styleOverrideId) return this.styleOverrideId
      const sid = this.selectedTemplate?.styleId
      return (!sid || sid === 'auto') ? (this.deck?.styleId || '') : sid
    },
    currentSlide() { return this.deck ? this.deck.slides[this.currentSlideIndex] : null },
    selectedEl() {
      if (!this.currentSlide || !this.selectedElId) return null
      return this.currentSlide.elements.find(e => e.id === this.selectedElId) || null
    },
    currentProviderModels() {
      const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      return p ? p.models : []
    },
    selColor: {
      get() {
        const el = this.selectedEl
        if (!el) return '000000'
        if (el.type === 'text') return el.color
        if (el.type === 'line') return el.lineColor
        if (el.type === 'icon') return el.color
        return el.fill || 'FFFFFF'
      },
      set(v) {},
    },
  },
  watch: {
    styleOverrideId(v) {
      if (this.deck && v) { restyleDeck(this.deck, v); this.selectedElId = null }
    },
    cfg: { deep: true, handler(val) { savePageConfig('ppt-cfg', val).catch(() => {}) } },
  },
  created() {
    this.syncSelectionFromStore()
    loadPageConfig('ppt-cfg').then(saved => { if (saved) Object.assign(this.cfg, saved) }).catch(() => {})
    getSetting('ppt-last-style', null).then(v => { if (v) this.lastStyleId = v }).catch(() => {})
    loadCustomPptTemplates().then(list => { this.customTemplates = list }).catch(() => {})
  },
  mounted() {
    this.$nextTick(this.updateSize)
    window.addEventListener('resize', this.updateSize)
  },
  activated() { this.isActive = true; this.syncSelectionFromStore(); this.$nextTick(this.updateSize) },
  deactivated() { this.isActive = false },
  beforeUnmount() { window.removeEventListener('resize', this.updateSize) },
  methods: {
    addLog(msg, level = 'info') {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      window.dispatchEvent(new CustomEvent('ai-log', { detail: { time, msg, level } }))
    },
    updateSize() {
      const wrap = this.$refs.canvasWrap
      if (!wrap) return
      const availW = wrap.clientWidth - 36
      const availH = wrap.clientHeight - 36
      if (availW <= 0 || availH <= 0) return
      const wByH = availH * SLIDE_W / SLIDE_H
      this.canvasWidth = Math.max(360, Math.round(Math.min(availW, wByH)))
    },

    // ===== 目录与扫描 =====
    async addProjectDir() {
      const dir = await open({ directory: true, multiple: false, title: '选择项目目录' })
      if (!dir) return
      if (this.projectDirs.includes(dir)) { this.showToast('该目录已添加', 'warning'); return }
      this.projectDirs.push(dir)
    },
    removeDir(idx) {
      this.projectDirs.splice(idx, 1)
      if (this.projectDirs.length === 0) this.scanResult = null
    },
    async startScan() {
      if (this.projectDirs.length === 0) return
      this.scanning = true
      this.addLog('开始扫描代码库...')
      try {
        this.scanResult = await scanCodebase(this.projectDirs)
        const { totalFiles } = this.scanResult.stats
        this.showToast(`扫描完成！发现 ${totalFiles} 个文件`, 'success')
        if (!this.cfg.topic) {
          for (const cfg of this.scanResult.configs) {
            if (cfg.name !== 'package.json') continue
            let pkgName = ''
            try { pkgName = (JSON.parse(cfg.content).name || '').trim() } catch (e) { continue }
            if (pkgName) { this.cfg.topic = pkgName + ' 产品介绍'; break }
          }
        }
      } catch (e) {
        this.showToast('扫描失败: ' + String(e), 'error')
      }
      this.scanning = false
    },

    // ===== 图片素材 =====
    bytesToDataUrl(bytes, mime) {
      return new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result)
        fr.onerror = reject
        fr.readAsDataURL(new Blob([bytes], { type: mime }))
      })
    },
    mimeOf(path) {
      const ext = String(path).split('.').pop().toLowerCase()
      return ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : ext === 'bmp' ? 'image/bmp' : 'image/jpeg'
    },
    async readImageDataUrl(path) {
      const bytes = await readFile(path)
      return this.bytesToDataUrl(bytes, this.mimeOf(path))
    },
    async addImages() {
      const picked = await open({ multiple: true, title: '选择图片', filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }] })
      if (!picked) return
      const list = Array.isArray(picked) ? picked : [picked]
      for (const p of list) {
        try {
          const src = await this.readImageDataUrl(p)
          this.images.push({ name: p.split(/[\\/]/).pop(), src })
        } catch (e) { this.showToast('读取图片失败: ' + String(e), 'error') }
      }
    },
    removeImage(idx) { this.images.splice(idx, 1) },
    async addImageEl() {
      const p = await open({ multiple: false, title: '选择图片', filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }] })
      if (!p) return
      try {
        const src = await this.readImageDataUrl(p)
        this.addElement(E.image({ x: 4, y: 2.3, w: 5.3, h: 3.3, src, sizing: 'cover', frame: true, radius: 0.08 }))
      } catch (e) { this.showToast('读取图片失败: ' + String(e), 'error') }
    },
    /** 把可用图片注入到图片类版式的内容里（content 自带 src，换风格不丢图） */
    assignImages(layout, content, srcs, ptr) {
      if (!srcs || !srcs.length) return
      if (layout === 'imageShowcase') { content.imageSrc = srcs[ptr.v % srcs.length]; ptr.v++ }
      else if (layout === 'textMedia') { content.mediaSrc = srcs[ptr.v % srcs.length]; ptr.v++ }
      else if (layout === 'imageGrid') {
        const n = Math.min(4, Math.max(2, (content.captions || []).length || Math.min(srcs.length, 4)))
        content.imageSrcs = Array.from({ length: n }, (_, i) => srcs[(ptr.v + i) % srcs.length])
        ptr.v += n
      }
    },

    // ===== 项目分析 =====
    async analyzeProject() {
      if (this.analyzing || this.aiProcessing) return
      const llmConfig = this.resolveLlm()
      if (!llmConfig) return
      if (!this.scanResult) { this.showToast('请先扫描代码库', 'warning'); return }
      this.analyzing = true
      try {
        const brief = await generateProjectBrief(llmConfig, this.buildContext())
        if (brief.topic) this.cfg.topic = brief.topic
        if (brief.audience) this.cfg.audience = brief.audience
        if (brief.direction) this.cfg.direction = brief.direction
        if (brief.styleId) this.styleOverrideId = brief.styleId
        this.showToast(brief.summary ? `已分析：${brief.summary}` : '已根据项目填好主题与方向', 'success')
      } catch (e) {
        this.showToast('分析失败: ' + String(e.message || e), 'error')
      }
      this.analyzing = false
    },

    // ===== AI 生成 =====
    onProviderSelect() {
      const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (p && p.models.length > 0) this.selectedModelId = p.activeModelId || p.models[0].id
    },
    syncSelectionFromStore() {
      if (this.globalStore.providerConfigs.length > 0 && !this.selectedProviderId) {
        this.selectedProviderId = this.globalStore.activeProviderId || this.globalStore.providerConfigs[0].id
        const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
        this.selectedModelId = this.globalStore.activeModelId || p?.activeModelId || (p?.models[0]?.id || '')
      }
    },
    resolveLlm() {
      const provider = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (!provider) { this.showToast('请先在「AI 设置」配置并选择厂商', 'warning'); return null }
      const config = getResolvedConfig(provider, this.selectedModelId)
      if (!config || !config.model) { this.showToast('请选择模型', 'warning'); return null }
      return config
    },
    buildContext() {
      if (!this.scanResult) return ''
      return buildContextSummary(this.scanResult, { projectName: this.cfg.topic }, [])
    },
    resolveStyleId(outlineStyleId) {
      if (this.styleOverrideId) return this.styleOverrideId
      const tplStyle = this.selectedTemplate?.styleId
      if (tplStyle && tplStyle !== 'auto') return tplStyle
      return outlineStyleId || pickRandomStyle(this.lastStyleId).id
    },

    async startAiGenerate() {
      if (this.aiProcessing) return
      if (!this.cfg.topic && !this.scanResult) { this.showToast('请填写主题，或先扫描代码库', 'warning'); return }
      const llmConfig = this.resolveLlm()
      if (!llmConfig) return

      this.aiProcessing = true
      this.aiController = createAiController()
      window.dispatchEvent(new Event('ai-fill-start'))
      const contextSummary = this.buildContext()
      const tpl = this.selectedTemplate
      const imgSrcs = this.images.map(i => i.src)

      try {
        // 项目分析：主题留空且已扫描时，先由 AI 分析项目定主题/方向/风格
        let briefStyle = null
        if (!this.cfg.topic && this.scanResult) {
          this.aiProgressText = '分析项目…'
          this.addLog('[进行] 分析项目，推导主题...')
          try {
            const brief = await generateProjectBrief(llmConfig, contextSummary, { signal: this.aiController.signal })
            if (brief.topic) this.cfg.topic = brief.topic
            if (brief.audience && !this.cfg.audience) this.cfg.audience = brief.audience
            if (brief.direction && !this.cfg.direction) this.cfg.direction = brief.direction
            briefStyle = brief.styleId
            if (brief.summary) this.addLog(`[完成] 项目定位：${brief.summary}`, 'success')
          } catch (e) { if (e.name === 'AbortError') throw e }
        }
        const tplStyle = (tpl?.styleId && tpl.styleId !== 'auto') ? tpl.styleId : null
        const genCfg = { ...this.cfg, imageCount: imgSrcs.length, styleId: this.styleOverrideId || tplStyle || briefStyle || 'auto' }

        // 阶段 A：大纲
        this.aiProgressText = '正在编排大纲…'
        this.addLog('[进行] 编排 PPT 大纲...')
        let outline
        if (tpl?.mode === 'fixed' && Array.isArray(tpl.skeleton)) {
          outline = {
            styleId: this.resolveStyleId(tpl.styleId === 'auto' ? null : tpl.styleId),
            slides: tpl.skeleton.map(s => ({ layout: s.layout, title: s.title, intent: '' })),
          }
          this.cfg.pageCount = outline.slides.length
        } else {
          outline = await generateOutline(llmConfig, contextSummary, genCfg, this.lastStyleId, { signal: this.aiController.signal })
          outline.styleId = this.resolveStyleId(outline.styleId)
        }
        if (this.aiController.cancelled) throw new Error('已取消')

        this.lastStyleId = outline.styleId
        setSetting('ppt-last-style', outline.styleId).catch(() => {})

        // 注入落款到封面/封底
        const meta = { topic: this.cfg.topic, audience: this.cfg.audience, language: this.cfg.language, direction: this.cfg.direction, footnote: this.cfg.footnote }
        this.deck = buildDeckFromOutline(outline, meta)
        this.deck.assets = { images: imgSrcs }
        this.currentSlideIndex = 0
        this.selectedElId = null
        this.$nextTick(this.updateSize)
        this.addLog(`[完成] 大纲就绪：${outline.slides.length} 页 · 风格 ${getStyle(outline.styleId).name}`, 'success')

        // 阶段 B：逐页填充（按 id 回写，防止生成期间结构变化导致错位）
        const prevTitles = []
        const imgPtr = { v: 0 }
        for (let i = 0; i < outline.slides.length; i++) {
          if (this.aiController.cancelled) break
          if (this.aiController.paused) { await this.aiController.waitIfPaused(); if (this.aiController.cancelled) break }
          const o = outline.slides[i]
          const slideId = this.deck.slides[i].id
          this.aiProgressText = `[${i + 1}/${outline.slides.length}] ${o.title || o.layout}`
          this.currentSlideIndex = i
          try {
            const content = await generateSlideContent(llmConfig, o, contextSummary, genCfg, prevTitles.slice(-12), { signal: this.aiController.signal })
            prevTitles.push(content.title || o.title || '')
            this.applyCoverFootnote(o.layout, content)
            this.assignImages(o.layout, content, imgSrcs, imgPtr)
            const idx = this.deck.slides.findIndex(s => s.id === slideId)
            if (idx < 0) continue
            const built = buildSlide(o.layout, content, getStyle(this.deck.styleId), idx + 1)
            built.id = slideId
            built.intent = o.intent
            built.pending = false
            this.deck.slides.splice(idx, 1, built)
            this.addLog(`[完成] 第 ${idx + 1} 页 ${content.title || o.title || ''} ✓`, 'success')
          } catch (e) {
            if (e.name === 'AbortError') break
            const idx = this.deck.slides.findIndex(s => s.id === slideId)
            if (idx >= 0) this.deck.slides[idx].pending = false
            this.addLog(`[失败] 第 ${i + 1} 页：${e.message}`, 'error')
          }
        }
        if (!this.aiController.cancelled) this.showToast('PPT 生成完成！可直接在右侧编辑', 'success')
      } catch (e) {
        if (e.name !== 'AbortError' && e.message !== '已取消') this.showToast('生成失败: ' + String(e.message || e), 'error')
      }
      this.aiProcessing = false
      this.aiProgressText = ''
      this.aiController = null
    },
    applyCoverFootnote(layout, content) {
      if ((layout === 'cover' || layout === 'closing') && !content.footnote && this.cfg.footnote) content.footnote = this.cfg.footnote
      if (layout === 'cover' && !content.contact && this.cfg.footnote) content.footnote = this.cfg.footnote
    },
    async regenerateSlide() {
      if (this.aiProcessing || !this.currentSlide) return
      const llmConfig = this.resolveLlm()
      if (!llmConfig) return
      const i = this.currentSlideIndex
      const s = this.currentSlide
      this.aiProcessing = true
      this.aiController = createAiController()
      this.aiProgressText = `重生成第 ${i + 1} 页…`
      s.pending = true
      try {
        const o = { layout: s.layout, title: s.title, intent: s.intent || '' }
        const content = await generateSlideContent(llmConfig, o, this.buildContext(), { ...this.cfg }, [], { signal: this.aiController.signal })
        this.applyCoverFootnote(s.layout, content)
        // 保留本页原有配图；若原本没有则按需补一张
        if (s.content) {
          if (s.content.imageSrc) content.imageSrc = s.content.imageSrc
          if (s.content.imageSrcs) content.imageSrcs = s.content.imageSrcs
          if (s.content.mediaSrc) content.mediaSrc = s.content.mediaSrc
        }
        if (!content.imageSrc && !content.mediaSrc && !content.imageSrcs) {
          this.assignImages(s.layout, content, this.deck.assets?.images || [], { v: 0 })
        }
        const idx = this.deck.slides.findIndex(x => x.id === s.id)
        if (idx >= 0) {
          const built = buildSlide(s.layout, content, getStyle(this.deck.styleId), idx + 1)
          built.id = s.id; built.pending = false; built.intent = s.intent
          this.deck.slides.splice(idx, 1, built)
          this.showToast('本页已重生成', 'success')
        }
      } catch (e) {
        if (this.currentSlide) this.currentSlide.pending = false
        if (e.name !== 'AbortError') this.showToast('重生成失败: ' + String(e.message || e), 'error')
      }
      this.aiProcessing = false
      this.aiProgressText = ''
      this.aiController = null
    },
    toggleAiPause() { if (this.aiController) this.aiController.paused ? this.aiController.resume() : this.aiController.pause() },
    cancelAi() { if (this.aiController) this.aiController.cancel() },

    // ===== 幻灯片操作 =====
    selectSlide(i) { this.currentSlideIndex = i; this.selectedElId = null },
    addSlide() {
      if (this.aiProcessing) return
      appendBlankSlide(this.deck)
      const newIdx = this.deck.slides.length - 1
      const s = this.deck.slides.pop()
      this.deck.slides.splice(this.currentSlideIndex + 1, 0, s)
      this.currentSlideIndex += 1
      this.selectedElId = null
    },
    deleteSlide() {
      if (this.aiProcessing || this.deck.slides.length <= 1) return
      this.deck.slides.splice(this.currentSlideIndex, 1)
      this.currentSlideIndex = Math.min(this.currentSlideIndex, this.deck.slides.length - 1)
      this.selectedElId = null
    },
    duplicateSlide() {
      if (this.aiProcessing) return
      const copy = JSON.parse(JSON.stringify(this.currentSlide))
      copy.id = `sld_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e5).toString(36)}`
      copy.elements.forEach(el => { el.id = el.id + '_c' + Math.floor(Math.random() * 1e4).toString(36) })
      this.deck.slides.splice(this.currentSlideIndex + 1, 0, copy)
      this.currentSlideIndex += 1
      this.selectedElId = null
    },

    // ===== 元素操作 =====
    addElement(el) {
      this.currentSlide.elements.push(el)
      this.selectedElId = el.id
    },
    currentStyle() { return getStyle(this.deck.styleId) },
    inkForSlide() { return pickInk(this.currentSlide.background?.color || 'FFFFFF') },
    addText() {
      const st = this.currentStyle()
      this.addElement(E.text({ x: 4.4, y: 3.1, w: 4.5, h: 1, text: '双击编辑文字', fontFace: st.fonts.body, fontSize: 18, color: this.inkForSlide(), valign: 'middle' }))
    },
    addShape(type) {
      const st = this.currentStyle()
      const base = { x: 5, y: 2.8, w: 2.5, h: 1.6, fill: st.colors.accent, fillAlpha: 0.9 }
      if (type === 'ellipse') { base.w = 1.6; base.h = 1.6 }
      this.addElement(E[type](base))
    },
    addIcon() {
      const st = this.currentStyle()
      this.addElement(E.icon({ x: 6, y: 3, w: 1.1, h: 1.1, name: 'star', color: pickInk(st.colors.accent), chip: true, chipColor: st.colors.accent, chipRound: true }))
    },
    deleteEl() {
      if (!this.selectedEl) return
      const idx = this.currentSlide.elements.findIndex(e => e.id === this.selectedElId)
      if (idx >= 0) this.currentSlide.elements.splice(idx, 1)
      this.selectedElId = null
    },
    duplicateEl() {
      if (!this.selectedEl) return
      const copy = cloneElement(this.selectedEl)
      this.currentSlide.elements.push(copy)
      this.selectedElId = copy.id
    },
    zOrder(dir) {
      const arr = this.currentSlide.elements
      const idx = arr.findIndex(e => e.id === this.selectedElId)
      if (idx < 0) return
      const ni = idx + dir
      if (ni < 0 || ni >= arr.length) return
      const [el] = arr.splice(idx, 1)
      arr.splice(ni, 0, el)
    },
    setSelColor(hex) {
      const el = this.selectedEl
      if (!el) return
      const c = hex.replace('#', '').toUpperCase()
      if (el.type === 'text') el.color = c
      else if (el.type === 'line') el.lineColor = c
      else if (el.type === 'icon') el.color = c
      else el.fill = c
    },
    markDirty() { /* 元素被编辑，预留：可在此打脏标记/自动保存 */ },
    onKey(e) {
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'textarea' || tag === 'input') return
      if (!this.selectedEl) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteEl(); return }
      const step = e.shiftKey ? 0.5 : 0.08
      const el = this.selectedEl
      if (e.key === 'ArrowLeft') { el.x = +(el.x - step).toFixed(3); e.preventDefault() }
      else if (e.key === 'ArrowRight') { el.x = +(el.x + step).toFixed(3); e.preventDefault() }
      else if (e.key === 'ArrowUp') { el.y = +(el.y - step).toFixed(3); e.preventDefault() }
      else if (e.key === 'ArrowDown') { el.y = +(el.y + step).toFixed(3); e.preventDefault() }
    },

    // ===== 模板 =====
    async saveAsTemplate() {
      if (!this.deck) return
      const name = window.prompt('模板名称', this.cfg.topic ? this.cfg.topic + ' 模板' : '我的 PPT 模板')
      if (!name) return
      const sk = toDeckSkeleton(this.deck)
      await saveCustomPptTemplate({ name, description: `${sk.skeleton.length} 页 · ${getStyle(this.deck.styleId).name}`, styleId: this.deck.styleId, mode: 'fixed', skeleton: sk.skeleton })
      this.customTemplates = await loadCustomPptTemplates()
      this.showToast('已存为模板', 'success')
    },
    async removeTemplate(t) {
      await deleteCustomPptTemplate(t.id)
      this.customTemplates = await loadCustomPptTemplates()
      if (this.selectedTemplateId === t.id) this.selectedTemplateId = 'ppt-auto'
    },

    // ===== 导出 =====
    async exportPptx() {
      if (!this.deck) return
      const path = await save({
        title: '导出 PPTX',
        defaultPath: `${this.cfg.topic || 'PPT'}.pptx`,
        filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
      })
      if (!path) return
      this.exporting = true
      try {
        const bytes = await renderDeckToPptx(this.deck)
        await writeFile(path, bytes)
        this.showToast('PPTX 已导出', 'success')
      } catch (e) {
        this.showToast('导出失败: ' + String(e.message || e), 'error')
      }
      this.exporting = false
    },
  },
}
</script>

<style scoped>
.tpl-item {
  padding: 7px 9px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.tpl-item:hover { border-color: var(--border-hover); }
.tpl-item.active { border-color: var(--primary-500); background: var(--bg-secondary); }
.tpl-name { font-size: 12.5px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px; }
.tpl-badge { font-size: 9px; padding: 1px 5px; border-radius: 6px; background: var(--primary-500); color: #fff; font-weight: 600; }
.tpl-desc { font-size: 11px; color: var(--text-secondary); margin-top: 2px; line-height: 1.4; }
.icon-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; display: flex; }
.icon-btn:hover { color: var(--danger-500); }
.swatch-row { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.swatch { width: 20px; height: 20px; border-radius: 5px; border: 2px solid transparent; cursor: pointer; }
.swatch.active { outline: 2px solid var(--primary-500); outline-offset: 1px; }

.tpl-strip { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; scroll-snap-type: x mandatory; }
.tpl-card { flex: 0 0 auto; width: 188px; cursor: pointer; scroll-snap-align: start; }
.tpl-thumb { position: relative; border: 2px solid transparent; border-radius: 7px; overflow: hidden; line-height: 0; }
.tpl-card.active .tpl-thumb { border-color: var(--primary-500); box-shadow: var(--shadow-glow); }
.tpl-card-name { font-size: 11.5px; font-weight: 600; color: var(--text-primary); margin-top: 5px; text-align: center; }
.tpl-card.active .tpl-card-name { color: var(--primary-500); }
.tpl-del { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.55); border: none; color: #fff; border-radius: 4px; padding: 2px; cursor: pointer; display: flex; }
.tpl-del:hover { background: var(--danger-500); }
.tpl-badge2 { position: absolute; top: 4px; left: 4px; font-size: 9px; background: var(--primary-500); color: #fff; padding: 1px 6px; border-radius: 6px; font-weight: 600; }
.tpl-desc-line { font-size: 11px; color: var(--text-secondary); margin-top: 6px; line-height: 1.5; }

.img-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
.img-thumb { position: relative; aspect-ratio: 1; border-radius: 5px; overflow: hidden; border: 1px solid var(--border-color); }
.img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.img-del { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.55); border: none; color: #fff; border-radius: 3px; padding: 1px; cursor: pointer; display: flex; }
.img-del:hover { background: var(--danger-500); }

.editor-toolbar {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 12px; background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color); flex-shrink: 0;
}
.editor-toolbar.tb-locked { opacity: 0.5; pointer-events: none; }
.tb-group { display: flex; align-items: center; gap: 4px; }
.tb-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: 1px solid var(--border-color);
  background: var(--bg-elevated); color: var(--text-secondary);
  border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition-fast);
}
.tb-btn:hover { color: var(--text-primary); border-color: var(--border-hover); }
.tb-btn.danger:hover { color: var(--danger-500); border-color: var(--danger-500); }
.tb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tb-color { width: 28px; height: 28px; padding: 0; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: none; cursor: pointer; }
.tb-label { font-size: 11px; color: var(--text-secondary); margin-right: 4px; }

.canvas-wrap {
  flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
  padding: 18px; overflow: hidden; position: relative; outline: none;
  background: var(--bg-app);
}
.pending-badge {
  position: absolute; top: 26px; right: 26px;
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--text-secondary);
  background: var(--bg-surface); padding: 4px 10px; border-radius: 12px; border: 1px solid var(--border-color);
}
.filmstrip {
  display: flex; gap: 8px; padding: 10px 12px; overflow-x: auto; flex-shrink: 0;
  background: var(--bg-surface); border-top: 1px solid var(--border-color);
}
.thumb { flex-shrink: 0; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.thumb-no { font-size: 10px; color: var(--text-muted); }
.thumb-canvas { position: relative; border: 2px solid transparent; border-radius: 4px; overflow: hidden; line-height: 0; }
.thumb.active .thumb-canvas { border-color: var(--primary-500); }
.thumb-pending { position: absolute; inset: 0; background: repeating-linear-gradient(45deg, rgba(99,102,241,0.06), rgba(99,102,241,0.06) 6px, transparent 6px, transparent 12px); }
</style>
