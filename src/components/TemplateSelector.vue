<template>
  <div class="card">
    <div class="card-header">
      <h3><Layout :size="14" /> 模板选择</h3>
    </div>
    <div class="card-body">
      <!-- 预设模板选择（水平滚动） -->
      <div class="template-scroll-wrap">
        <button v-show="canScrollLeft" class="template-scroll-btn template-scroll-left" @click="scrollTemplates(-1)">
          <ChevronLeft :size="14" />
        </button>
        <div class="template-grid" ref="templateGridRef" @scroll="onTemplateScroll">
          <!-- 上传卡片（最左侧） -->
          <div class="template-card template-upload-card" @click="uploadTemplate" :class="{ 'uploading': uploading }">
            <div v-if="!uploading" class="template-upload-icon">
              <Upload :size="16" />
            </div>
            <div v-if="!uploading" class="template-card-name">从文档导入</div>
            <div v-if="!uploading" class="template-card-desc">.docx / .md</div>
            <div v-if="uploading" class="template-card-name" style="text-align:center;">解析中...</div>
          </div>
          <div
            v-for="preset in allPresets"
            :key="preset.id"
            class="template-card"
            :class="{ active: currentPresetId === preset.id, custom: preset.isCustom }"
            @click="selectPreset(preset)"
          >
            <div class="template-card-name">{{ preset.name }}</div>
            <div class="template-card-desc">{{ preset.description || '自定义模板' }}</div>
            <button
              v-if="preset.isCustom"
              class="btn btn-danger btn-sm btn-icon template-delete-btn"
              @click.stop="deletePreset(preset)"
              title="删除"
            >
              <Trash2 :size="10" />
            </button>
          </div>
        </div>
        <button v-show="canScrollRight" class="template-scroll-btn template-scroll-right" @click="scrollTemplates(1)">
          <ChevronRight :size="14" />
        </button>
      </div>
      <div v-if="allPresets.length > 3" class="template-scroll-hint">← 左右滑动查看更多模板 →</div>

      <!-- 操作按钮 -->
      <div style="display:flex;gap:4px;margin-top:8px;">
        <button class="btn btn-secondary btn-sm" style="flex:1;" @click="saveAsCurrent" title="将当前章节结构保存为模板">
          <Save :size="12" /> 保存当前
        </button>
        <button class="btn btn-secondary btn-sm" style="flex:1;" @click="showEditor = !showEditor">
          <Edit :size="12" /> {{ showEditor ? '收起编辑' : '编辑章节' }}
        </button>
      </div>

      <!-- 模板编辑器 -->
      <div v-if="showEditor" class="template-editor">
        <div class="template-editor-header">
          <span style="font-size:12px;color:var(--text-secondary);">点击章节可编辑标题和类型，可拖拽排序</span>
        </div>
        <div class="template-editor-tree">
          <div v-for="(sec, secIdx) in sections" :key="sec.id" class="te-section">
            <div class="te-section-header">
              <div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0;">
                <span class="te-number">{{ sec.number }}</span>
                <input
                  class="te-title-input"
                  :value="sec.title"
                  @change="updateTitle(sec, $event.target.value)"
                  :title="sec.title"
                />
                <select class="te-type-select" :value="sec.type" @change="updateType(sec, $event.target.value)">
                  <option value="text">文本</option>
                  <option value="table">表格</option>
                  <option value="diagram">图表</option>
                  <option value="image">图片</option>
                </select>
              </div>
              <div style="display:flex;gap:2px;">
                <button class="te-btn" @click="addChild(sec)" title="添加子章节">+子</button>
                <button class="te-btn" @click="moveSection(secIdx, -1, sections)" title="上移" :disabled="secIdx === 0">▲</button>
                <button class="te-btn" @click="moveSection(secIdx, 1, sections)" title="下移" :disabled="secIdx === sections.length - 1">▼</button>
                <button class="te-btn te-btn-danger" @click="removeSection(secIdx, sections)" title="删除">✕</button>
              </div>
            </div>

            <!-- 子章节 -->
            <div v-if="sec.children && sec.children.length > 0" class="te-children">
              <div v-for="(child, childIdx) in sec.children" :key="child.id" class="te-child-row">
                <span class="te-number">{{ child.number }}</span>
                <input
                  class="te-title-input"
                  :value="child.title"
                  @change="updateTitle(child, $event.target.value)"
                />
                <select class="te-type-select" :value="child.type" @change="updateType(child, $event.target.value)">
                  <option value="text">文本</option>
                  <option value="table">表格</option>
                  <option value="diagram">图表</option>
                  <option value="image">图片</option>
                </select>
                <button class="te-btn" @click="moveSection(childIdx, -1, sec.children)" :disabled="childIdx === 0">▲</button>
                <button class="te-btn" @click="moveSection(childIdx, 1, sec.children)" :disabled="childIdx === sec.children.length - 1">▼</button>
                <button class="te-btn te-btn-danger" @click="removeSection(childIdx, sec.children)">✕</button>
                <button class="te-btn" @click="editPrompt(child)" title="编辑 prompt">📝</button>
              </div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px;" @click="addTopSection">
            + 添加一级章节
          </button>
        </div>

        <!-- Prompt 编辑弹窗 -->
        <div v-if="editingPromptSection" class="prompt-editor-overlay" @click.self="editingPromptSection = null">
          <div class="prompt-editor-dialog">
            <div class="prompt-editor-header">
              <span>编辑 Prompt: {{ editingPromptSection.number }} {{ editingPromptSection.title }}</span>
              <button class="btn btn-sm btn-icon" @click="editingPromptSection = null"><X :size="14" /></button>
            </div>
            <textarea
              class="prompt-editor-textarea"
              v-model="editingPromptSection.prompt"
              rows="10"
              placeholder="输入 AI 生成指令..."
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 保存模板弹窗 -->
      <div v-if="showSaveDialog" class="prompt-editor-overlay" @click.self="showSaveDialog = false">
        <div class="prompt-editor-dialog" style="max-width:360px;">
          <div class="prompt-editor-header">
            <span>保存为自定义模板</span>
            <button class="btn btn-sm btn-icon" @click="showSaveDialog = false"><X :size="14" /></button>
          </div>
          <div style="padding:12px;display:flex;flex-direction:column;gap:8px;">
            <div class="form-group">
              <label class="form-label">模板名称</label>
              <input type="text" class="form-input" v-model="saveName" placeholder="我的自定义模板" />
            </div>
            <div class="form-group">
              <label class="form-label">描述（可选）</label>
              <input type="text" class="form-input" v-model="saveDesc" placeholder="简要描述" />
            </div>
            <button class="btn btn-primary btn-sm" @click="confirmSave" :disabled="!saveName.trim()">保存</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Layout, Save, Edit, Trash2, X, ChevronLeft, ChevronRight, Upload } from 'lucide-vue-next'
import { getSrsPresets, getSddPresets, getOpsPresets, instantiateTemplate, toTemplateSkeleton, createSectionNode } from '../core/doc-template/template-presets.js'
import { loadCustomTemplates, saveCustomTemplate, deleteCustomTemplate } from '../core/doc-template/template-store.js'
import { renumberSections } from '../core/doc-template/srs-template.js'
import { generateTemplateFromFile } from '../core/doc-template/template-from-doc.js'
import { open } from '@tauri-apps/plugin-dialog'

export default {
  name: 'TemplateSelector',
  components: { Layout, Save, Edit, Trash2, X, ChevronLeft, ChevronRight, Upload },
  inject: ['showToast'],
  props: {
    docType: { type: String, required: true }, // 'srs' | 'sdd'
    sections: { type: Array, required: true },
  },
  emits: ['switch-template', 'update-sections'],
  data() {
    return {
      currentPresetId: null,
      customTemplates: [],
      showEditor: false,
      editingPromptSection: null,
      showSaveDialog: false,
      saveName: '',
      saveDesc: '',
      canScrollLeft: false,
      canScrollRight: false,
      uploading: false,
    }
  },
  mounted() {
    this.$nextTick(() => this.checkScrollState())
  },
  computed: {
    builtinPresets() {
      return this.docType === 'srs' ? getSrsPresets() : this.docType === 'ops' ? getOpsPresets() : getSddPresets()
    },
    allPresets() {
      const builtins = this.builtinPresets.map(p => ({ ...p, isCustom: false }))
      const customs = this.customTemplates.map(p => ({ ...p, isCustom: true }))
      return [...builtins, ...customs]
    },
  },
  async created() {
    this.customTemplates = await loadCustomTemplates(this.docType)
    // 默认选中第一个预设
    if (this.builtinPresets.length > 0) {
      this.currentPresetId = this.builtinPresets[0].id
    }
  },
  methods: {
    async uploadTemplate() {
      if (this.uploading) return
      try {
        const filePath = await open({
          title: '选择文档以生成模板',
          filters: [
            { name: '支持的文档', extensions: ['docx', 'md'] },
            { name: 'Word 文档', extensions: ['docx'] },
            { name: 'Markdown', extensions: ['md'] },
          ],
          multiple: false,
        })
        if (!filePath) return

        this.uploading = true
        const { name, sections } = await generateTemplateFromFile(filePath)

        // 自动保存为自定义模板
        const tpl = await saveCustomTemplate(this.docType, {
          name: `导入: ${name}`,
          description: `从 ${filePath.split(/[/\\]/).pop()} 导入的模板结构`,
          sections: toTemplateSkeleton(sections),
        })

        this.customTemplates = await loadCustomTemplates(this.docType)
        this.currentPresetId = tpl.id

        // 直接切换到该模板
        this.$emit('switch-template', sections)
        this.showToast(`已从文档导入 ${sections.length} 个章节`, 'success')

        // 更新滚动状态
        this.$nextTick(() => this.checkScrollState())
      } catch (e) {
        this.showToast(`导入失败: ${e.message || e}`, 'error')
      } finally {
        this.uploading = false
      }
    },

    selectPreset(preset) {
      this.currentPresetId = preset.id
      const sections = instantiateTemplate(preset)
      this.$emit('switch-template', sections)
    },
    async saveAsCurrent() {
      this.saveName = ''
      this.saveDesc = ''
      this.showSaveDialog = true
    },
    async confirmSave() {
      if (!this.saveName.trim()) return
      const skeleton = toTemplateSkeleton(this.sections)
      const tpl = await saveCustomTemplate(this.docType, {
        name: this.saveName.trim(),
        description: this.saveDesc.trim(),
        sections: skeleton,
      })
      this.customTemplates = await loadCustomTemplates(this.docType)
      this.currentPresetId = tpl.id
      this.showSaveDialog = false
      this.showToast('模板已保存', 'success')
    },
    async deletePreset(preset) {
      if (!confirm(`确定删除模板「${preset.name}」？`)) return
      await deleteCustomTemplate(this.docType, preset.id)
      this.customTemplates = await loadCustomTemplates(this.docType)
      this.showToast('模板已删除', 'success')
    },
    // ===== 编辑器操作 =====
    updateTitle(sec, title) {
      sec.title = title
      this.$emit('update-sections', this.sections)
    },
    updateType(sec, type) {
      sec.type = type
      this.$emit('update-sections', this.sections)
    },
    addChild(parent) {
      if (!parent.children) parent.children = []
      parent.children.push(createSectionNode({ title: '新子章节' }))
      renumberSections(this.sections)
      this.$emit('update-sections', this.sections)
    },
    addTopSection() {
      this.sections.push(createSectionNode({ title: '新章节', children: [] }))
      renumberSections(this.sections)
      this.$emit('update-sections', this.sections)
    },
    moveSection(idx, direction, arr) {
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= arr.length) return
      const tmp = arr[idx]
      arr[idx] = arr[newIdx]
      arr[newIdx] = tmp
      renumberSections(this.sections)
      this.$emit('update-sections', this.sections)
    },
    removeSection(idx, arr) {
      arr.splice(idx, 1)
      renumberSections(this.sections)
      this.$emit('update-sections', this.sections)
    },
    editPrompt(sec) {
      this.editingPromptSection = sec
    },
    // ===== 滚动控制 =====
    scrollTemplates(dir) {
      const el = this.$refs.templateGridRef
      if (!el) return
      el.scrollBy({ left: dir * 160, behavior: 'smooth' })
    },
    onTemplateScroll() {
      this.checkScrollState()
    },
    checkScrollState() {
      const el = this.$refs.templateGridRef
      if (!el) return
      this.canScrollLeft = el.scrollLeft > 4
      this.canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 4
    },
  },
}
</script>

<style scoped>
/* 水平滚动容器 */
.template-scroll-wrap {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
}
.template-scroll-btn {
  position: absolute;
  z-index: 2;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--border-primary);
  background: var(--bg-elevated, var(--bg-primary));
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  transition: all 0.15s;
}
.template-scroll-btn:hover {
  background: var(--bg-secondary);
  color: var(--primary-400);
  border-color: var(--primary-400);
}
.template-scroll-left { left: -4px; }
.template-scroll-right { right: -4px; }
.template-scroll-hint {
  text-align: center;
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 4px;
  opacity: 0.7;
}
.template-grid {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 2px 0;
  flex: 1;
}
.template-grid::-webkit-scrollbar {
  display: none;
}
.template-card {
  position: relative;
  flex: 0 0 auto;
  width: 120px;
  padding: 6px 8px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--bg-primary);
  scroll-snap-align: start;
}
.template-card:hover {
  border-color: var(--primary-400);
  background: var(--bg-secondary);
}
.template-upload-card {
  border-style: dashed;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 90px;
  width: 90px;
}
.template-upload-card:hover {
  border-color: var(--primary-500);
  background: var(--primary-50, #eff6ff);
}
.template-upload-card.uploading {
  opacity: 0.7;
  pointer-events: none;
}
.template-upload-icon {
  color: var(--primary-400);
  margin-bottom: 2px;
}
.template-card.active {
  border-color: var(--primary-500);
  background: var(--primary-50, #eff6ff);
  box-shadow: 0 0 0 1px var(--primary-500);
}
.template-card-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.template-card-desc {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.template-delete-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  padding: 2px !important;
}
.template-card:hover .template-delete-btn {
  opacity: 1;
}
.template-editor {
  margin-top: 8px;
  border-top: 1px solid var(--border-primary);
  padding-top: 8px;
}
.template-editor-tree {
  max-height: 300px;
  overflow-y: auto;
}
.te-section {
  margin-bottom: 4px;
}
.te-section-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 0;
}
.te-children {
  padding-left: 16px;
}
.te-child-row {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 0;
}
.te-number {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 24px;
}
.te-title-input {
  flex: 1;
  font-size: 12px;
  border: 1px solid transparent;
  border-radius: 3px;
  padding: 2px 4px;
  background: transparent;
  color: var(--text-primary);
  min-width: 0;
}
.te-title-input:hover, .te-title-input:focus {
  border-color: var(--border-primary);
  background: var(--bg-primary);
  outline: none;
}
.te-type-select {
  font-size: 10px;
  border: 1px solid var(--border-primary);
  border-radius: 3px;
  padding: 1px 2px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  min-width: 42px;
}
.te-btn {
  font-size: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 3px;
  padding: 1px 4px;
  cursor: pointer;
  color: var(--text-secondary);
  line-height: 1.4;
}
.te-btn:hover {
  background: var(--bg-tertiary);
}
.te-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.te-btn-danger:hover {
  background: var(--danger-50, #fef2f2);
  color: var(--danger-600, #dc2626);
}
.prompt-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.prompt-editor-dialog {
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  width: 90%;
  max-width: 500px;
  overflow: hidden;
}
.prompt-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-primary);
  font-size: 13px;
  font-weight: 600;
}
.prompt-editor-textarea {
  width: 100%;
  font-size: 12px;
  line-height: 1.5;
  padding: 12px;
  border: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
  outline: none;
  font-family: 'Consolas', monospace;
}
</style>
