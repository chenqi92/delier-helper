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

      <!-- 章节树（合并了章节控制和编辑功能） -->
      <div class="ts-chapter-tree" :class="{ 'editing': showEditor }">
        <div class="ts-tree-header">
          <span style="font-size:11px;color:var(--text-muted);">{{ showEditor ? '拖拽排序 · 点击编辑' : '勾选需要生成的章节' }}</span>
          <div style="display:flex;gap:4px;">
            <span class="select-action" @click="toggleAll(true)">全选</span>
            <span class="select-action" @click="toggleAll(false)">全不选</span>
          </div>
        </div>
        <div class="ts-tree-body">
          <div v-for="(sec, secIdx) in sections" :key="sec.id" class="ts-sec">
            <div class="ts-sec-row">
              <label class="ts-checkbox-label">
                <input type="checkbox" v-model="sec.enabled" @change="toggleChildren(sec, sec.enabled)" />
                <span class="ts-sec-number">{{ sec.number }}</span>
                <template v-if="showEditor">
                  <input
                    class="ts-title-input"
                    :value="sec.title"
                    @change="updateTitle(sec, $event.target.value)"
                    :title="sec.title"
                  />
                </template>
                <span v-else class="ts-sec-title">{{ sec.title }}</span>
              </label>
              <div v-if="showEditor" class="ts-sec-actions">
                <select class="ts-type-select" :value="sec.type" @change="updateType(sec, $event.target.value)">
                  <option value="text">文本</option>
                  <option value="table">表格</option>
                  <option value="diagram">图表</option>
                  <option value="image">图片</option>
                </select>
                <button class="te-btn" @click="addChild(sec)" title="添加子章节">+子</button>
                <button class="te-btn" @click="moveSection(secIdx, -1, sections)" :disabled="secIdx === 0">▲</button>
                <button class="te-btn" @click="moveSection(secIdx, 1, sections)" :disabled="secIdx === sections.length - 1">▼</button>
                <button class="te-btn te-btn-danger" @click="removeSection(secIdx, sections)">✕</button>
              </div>
              <div v-else class="ts-sec-badges">
                <span v-if="sec.type === 'diagram'" class="badge badge-info" style="font-size:9px;">图</span>
                <span v-if="sec.type === 'table'" class="badge badge-warning" style="font-size:9px;">表</span>
              </div>
            </div>

            <!-- 子章节 -->
            <div v-if="sec.children && sec.children.length > 0" class="ts-children">
              <div v-for="(child, childIdx) in sec.children" :key="child.id" class="ts-child-row">
                <label class="ts-checkbox-label">
                  <input type="checkbox" v-model="child.enabled" />
                  <span class="ts-sec-number">{{ child.number }}</span>
                  <template v-if="showEditor">
                    <input
                      class="ts-title-input"
                      :value="child.title"
                      @change="updateTitle(child, $event.target.value)"
                    />
                  </template>
                  <span v-else class="ts-sec-title" style="font-size:12px;">{{ child.title }}</span>
                </label>
                <div v-if="showEditor" class="ts-sec-actions">
                  <select class="ts-type-select" :value="child.type" @change="updateType(child, $event.target.value)">
                    <option value="text">文本</option>
                    <option value="table">表格</option>
                    <option value="diagram">图表</option>
                    <option value="image">图片</option>
                  </select>
                  <button class="te-btn" @click="editPrompt(child)" title="编辑 Prompt">📝</button>
                  <button class="te-btn" @click="moveSection(childIdx, -1, sec.children)" :disabled="childIdx === 0">▲</button>
                  <button class="te-btn" @click="moveSection(childIdx, 1, sec.children)" :disabled="childIdx === sec.children.length - 1">▼</button>
                  <button class="te-btn te-btn-danger" @click="removeSection(childIdx, sec.children)">✕</button>
                </div>
                <div v-else class="ts-sec-badges">
                  <span v-if="child.type === 'diagram'" class="badge badge-info" style="font-size:9px;">图</span>
                  <span v-if="child.type === 'table'" class="badge badge-warning" style="font-size:9px;">表</span>
                </div>
              </div>
            </div>
          </div>
          <button v-if="showEditor" class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px;" @click="addTopSection">
            + 添加一级章节
          </button>
        </div>
      </div>

      <!-- Prompt 编辑弹窗 -->
      <Teleport to="body">
        <div v-if="editingPromptSection" class="prompt-overlay" @click.self="editingPromptSection = null">
          <div class="prompt-dialog">
            <div class="prompt-dialog-header">
              <div class="prompt-dialog-title">
                <span class="prompt-dialog-badge">Prompt</span>
                {{ editingPromptSection.number }} {{ editingPromptSection.title }}
              </div>
              <button class="prompt-dialog-close" @click="editingPromptSection = null">
                <X :size="16" />
              </button>
            </div>
            <div class="prompt-dialog-body">
              <textarea
                class="prompt-dialog-textarea"
                v-model="editingPromptSection.prompt"
                rows="12"
                placeholder="输入 AI 生成指令..."
              ></textarea>
            </div>
            <div class="prompt-dialog-footer">
              <span class="prompt-dialog-hint">此 Prompt 会作为 AI 生成该章节内容时的指令</span>
              <button class="btn btn-primary btn-sm" @click="editingPromptSection = null">确定</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 保存模板弹窗 -->
      <Teleport to="body">
        <div v-if="showSaveDialog" class="prompt-overlay" @click.self="showSaveDialog = false">
          <div class="prompt-dialog" style="max-width:380px;">
            <div class="prompt-dialog-header">
              <div class="prompt-dialog-title">保存为自定义模板</div>
              <button class="prompt-dialog-close" @click="showSaveDialog = false">
                <X :size="16" />
              </button>
            </div>
            <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
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
      </Teleport>
    </div>
  </div>
</template>

<script>
import { Layout, Save, Edit, Trash2, X, ChevronLeft, ChevronRight, Upload } from 'lucide-vue-next'
import { getSrsPresets, getSddPresets, getOpsPresets, getTestCasePresets, getTestRecordPresets, instantiateTemplate, toTemplateSkeleton, createSectionNode } from '../core/doc-template/template-presets.js'
import { loadCustomTemplates, saveCustomTemplate, deleteCustomTemplate } from '../core/doc-template/template-store.js'
import { renumberSections } from '../core/doc-template/srs-template.js'
import { generateTemplateFromFile } from '../core/doc-template/template-from-doc.js'
import { open } from '@tauri-apps/plugin-dialog'

export default {
  name: 'TemplateSelector',
  components: { Layout, Save, Edit, Trash2, X, ChevronLeft, ChevronRight, Upload },
  inject: ['showToast'],
  props: {
    docType: { type: String, default: 'srs' },
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
      return this.docType === 'srs' ? getSrsPresets()
        : this.docType === 'sdd' ? getSddPresets()
        : this.docType === 'ops' ? getOpsPresets()
        : this.docType === 'testcase' ? getTestCasePresets()
        : this.docType === 'testrecord' ? getTestRecordPresets()
        : getSrsPresets()
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
    // ===== 章节控制 =====
    toggleAll(enabled) {
      const walk = (list) => {
        for (const s of list) {
          s.enabled = enabled
          if (s.children) walk(s.children)
        }
      }
      walk(this.sections)
    },
    toggleChildren(parent, enabled) {
      if (parent.children) {
        for (const child of parent.children) {
          child.enabled = enabled
          if (child.children) {
            for (const sub of child.children) sub.enabled = enabled
          }
        }
      }
    },

    // ===== 模板操作 =====
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
        // 自动选中并应用
        this.currentPresetId = tpl.id
        this.$emit('switch-template', instantiateTemplate(tpl))
        this.showToast(`模板「${tpl.name}」已导入并应用`, 'success')
      } catch (e) {
        this.showToast('导入失败: ' + String(e), 'error')
      }
      this.uploading = false
    },

    selectPreset(preset) {
      this.currentPresetId = preset.id
      const sections = instantiateTemplate(preset)
      this.$emit('switch-template', sections)
    },

    async deletePreset(preset) {
      await deleteCustomTemplate(this.docType, preset.id)
      this.customTemplates = await loadCustomTemplates(this.docType)
      this.showToast('模板已删除', 'success')
    },

    saveAsCurrent() {
      this.saveName = ''
      this.saveDesc = ''
      this.showSaveDialog = true
    },

    async confirmSave() {
      const tpl = await saveCustomTemplate(this.docType, {
        name: this.saveName.trim(),
        description: this.saveDesc.trim(),
        sections: toTemplateSkeleton(this.sections),
      })
      this.customTemplates = await loadCustomTemplates(this.docType)
      this.currentPresetId = tpl.id
      this.showSaveDialog = false
      this.showToast('模板已保存', 'success')
    },

    // ===== 章节编辑 =====
    updateTitle(sec, newTitle) {
      sec.title = newTitle
      this.$emit('update-sections', this.sections)
    },
    updateType(sec, newType) {
      sec.type = newType
      this.$emit('update-sections', this.sections)
    },
    addChild(parent) {
      if (!parent.children) parent.children = []
      parent.children.push(createSectionNode('新子章节'))
      renumberSections(this.sections)
      this.$emit('update-sections', this.sections)
    },
    addTopSection() {
      this.sections.push(createSectionNode('新章节'))
      renumberSections(this.sections)
      this.$emit('update-sections', this.sections)
    },
    moveSection(idx, dir, list) {
      const target = idx + dir
      if (target < 0 || target >= list.length) return
      const temp = list[idx]
      list[idx] = list[target]
      list[target] = temp
      renumberSections(this.sections)
      this.$emit('update-sections', this.sections)
    },
    removeSection(idx, list) {
      list.splice(idx, 1)
      renumberSections(this.sections)
      this.$emit('update-sections', this.sections)
    },
    editPrompt(section) {
      this.editingPromptSection = section
    },

    // ===== 滚动 =====
    scrollTemplates(dir) {
      const el = this.$refs.templateGridRef
      if (el) el.scrollBy({ left: dir * 120, behavior: 'smooth' })
    },
    onTemplateScroll() {
      this.checkScrollState()
    },
    checkScrollState() {
      const el = this.$refs.templateGridRef
      if (!el) return
      this.canScrollLeft = el.scrollLeft > 4
      this.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    },
  },
}
</script>

<style scoped>
/* === 模板卡片区域 === */
.template-scroll-wrap {
  position: relative;
}
.template-grid {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.template-grid::-webkit-scrollbar { display: none; }
.template-scroll-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  border: 1px solid var(--border-primary);
  background: var(--bg-primary);
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  color: var(--text-secondary);
}
.template-scroll-left { left: -4px; }
.template-scroll-right { right: -4px; }
.template-scroll-hint {
  text-align: center;
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 4px;
}
.template-card {
  min-width: 110px;
  width: 110px;
  padding: 8px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--bg-primary);
  scroll-snap-align: start;
  position: relative;
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

/* === 章节树（合并了章节控制+编辑） === */
.ts-chapter-tree {
  margin-top: 8px;
  border-top: 1px solid var(--border-primary);
  padding-top: 8px;
}
.ts-tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.ts-tree-body {
  max-height: 320px;
  overflow-y: auto;
}
.ts-sec {
  margin-bottom: 1px;
}
.ts-sec-row,
.ts-child-row {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 0;
  min-height: 24px;
}
.ts-checkbox-label {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  font-size: 13px;
}
.ts-checkbox-label input[type="checkbox"] {
  margin: 0;
  flex-shrink: 0;
}
.ts-sec-number {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 20px;
  flex-shrink: 0;
}
.ts-sec-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}
.ts-sec-row .ts-sec-title {
  font-weight: 600;
  font-size: 13px;
}
.ts-sec-badges {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.ts-sec-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.ts-children {
  padding-left: 18px;
}
.ts-title-input {
  flex: 1;
  font-size: 12px;
  border: 1px solid var(--border-primary);
  border-radius: 3px;
  padding: 1px 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 0;
  outline: none;
}
.ts-title-input:focus {
  border-color: var(--primary-400);
}
.ts-type-select {
  font-size: 10px;
  border: 1px solid var(--border-primary);
  border-radius: 3px;
  padding: 1px 2px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  min-width: 38px;
}

/* === 编辑模式小按钮 === */
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

/* === Prompt 编辑弹窗（优化版） === */
.prompt-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(3px);
}
.prompt-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.06);
  width: 90%;
  max-width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.prompt-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-tertiary);
}
.prompt-dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.prompt-dialog-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--primary-600, #4f46e5);
  background: var(--primary-50, #eef2ff);
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.prompt-dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;
}
.prompt-dialog-close:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}
.prompt-dialog-body {
  flex: 1;
  padding: 16px;
  overflow: hidden;
}
.prompt-dialog-textarea {
  width: 100%;
  min-height: 240px;
  font-size: 13px;
  line-height: 1.6;
  padding: 12px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
  outline: none;
  font-family: 'Consolas', 'Monaco', monospace;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.prompt-dialog-textarea:focus {
  border-color: var(--primary-400, #818cf8);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}
.prompt-dialog-textarea::placeholder {
  color: var(--text-muted);
}
.prompt-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--border-primary);
  background: var(--bg-tertiary);
}
.prompt-dialog-hint {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
