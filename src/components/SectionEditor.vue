<template>
  <div class="section-editor">
    <!-- 错误状态提示条 + 重试按钮 -->
    <div v-if="section.error" class="section-error-bar">
      <div class="section-error-text">
        <span class="section-error-icon">✕</span>
        <span>生成失败: {{ section.error }}</span>
      </div>
      <button class="btn btn-primary btn-sm section-retry-btn" @click="$emit('generate-single', section.id)">
        <RefreshCw :size="12" /> 重试
      </button>
    </div>

    <!-- 正在生成中 -->
    <div v-if="section.generating" class="section-generating-bar">
      <span class="spinner"></span>
      <span>正在生成...</span>
    </div>

    <!-- 操作按钮行 -->
    <div class="section-editor-toolbar">
      <button class="btn btn-secondary btn-sm" @click="$emit('generate-single', section.id)" title="单独生成此章节">
        <Bot :size="12" /> {{ section.error ? '重新生成' : '生成' }}
      </button>
      <button
        v-if="section.type === 'diagram' || section.type === 'image'"
        class="btn btn-secondary btn-sm"
        @click="triggerImageUpload"
        title="上传图片"
      >
        <ImageIcon :size="12" /> 上传图片
      </button>
      <!-- 表格类型提供"编辑源码"按钮 -->
      <button
        v-if="hasTable && !editing"
        class="btn btn-secondary btn-sm"
        @click="startEdit"
        title="编辑 Markdown 源码"
      >
        <Edit3 :size="12" /> 编辑源码
      </button>
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        style="display:none;"
        @change="handleImageUpload"
      />
    </div>

    <!-- 图表类型: Mermaid 预览 -->
    <template v-if="section.type === 'diagram'">
      <!-- Mermaid 编辑器 -->
      <div class="mermaid-editor-wrapper" v-if="editing">
        <textarea
          class="mermaid-editor"
          :value="localMermaidCode"
          @input="localMermaidCode = $event.target.value"
          @blur="saveMermaid"
          placeholder="输入 Mermaid 代码..."
          rows="8"
        ></textarea>
        <button class="btn btn-primary btn-sm" style="margin-top:4px;" @click="saveMermaid">
          确认并渲染
        </button>
      </div>

      <!-- Mermaid 渲染结果 -->
      <div v-if="renderedSvg" class="mermaid-preview" v-html="renderedSvg" @click="editing = true"></div>
      <div v-else-if="section.mermaidCode && !editing && !mermaidError" class="mermaid-placeholder" @click="editing = true">
        <span class="spinner" style="margin-right:6px;"></span> 渲染中...
      </div>
      <div v-else-if="!editing && !mermaidError" class="mermaid-placeholder" @click="editing = true">
        <ImageIcon :size="20" style="opacity:0.3;" />
        <span>点击编辑 Mermaid 代码，或使用 AI 生成</span>
      </div>

      <!-- Mermaid 渲染错误 -->
      <div v-if="mermaidError" class="mermaid-error-block">
        <div class="mermaid-error-header">
          <span class="section-error-icon">⚠</span>
          <span>Mermaid 图表渲染失败</span>
        </div>
        <div class="mermaid-error-detail">{{ mermaidError }}</div>
        <div class="mermaid-error-actions">
          <button class="btn btn-primary btn-sm" @click="$emit('generate-single', section.id)" title="让AI重新生成此图表">
            <RefreshCw :size="12" /> 重新生成
          </button>
          <button class="btn btn-secondary btn-sm" @click="editing = true">
            <Edit3 :size="12" /> 编辑代码
          </button>
          <button class="btn btn-secondary btn-sm" @click="triggerImageUpload">
            <ImageIcon :size="12" /> 上传替代图片
          </button>
        </div>
      </div>

      <!-- 用户上传的图片 -->
      <div v-if="section.imageData" class="uploaded-image-wrapper">
        <img :src="section.imageData" class="uploaded-image" />
        <button class="btn btn-danger btn-sm btn-icon uploaded-image-remove" @click="removeImage">
          <X :size="12" />
        </button>
      </div>
    </template>

    <!-- 图片类型 -->
    <template v-else-if="section.type === 'image'">
      <div v-if="section.imageData" class="uploaded-image-wrapper">
        <img :src="section.imageData" class="uploaded-image" />
        <button class="btn btn-danger btn-sm btn-icon uploaded-image-remove" @click="removeImage">
          <X :size="12" />
        </button>
      </div>
      <div v-else class="image-placeholder" @click="triggerImageUpload">
        <ImageIcon :size="24" style="opacity:0.3;" />
        <span>点击上传图片</span>
      </div>
    </template>

    <!-- 文本/表格内容编辑 -->
    <div class="content-editor-wrapper">
      <div v-if="!section.content && !editing" class="content-empty" @click="editing = true">
        <span style="color:var(--text-muted);font-size:13px;">{{ section.type === 'diagram' ? '图表说明文字（可选）' : '点击编辑内容，或使用 AI 生成' }}</span>
      </div>
      <textarea
        v-else-if="editing"
        class="content-textarea"
        :value="localContent"
        @input="localContent = $event.target.value"
        @blur="saveContent"
        :placeholder="section.type === 'diagram' ? '输入图表说明文字...' : '输入章节内容...'"
        :rows="Math.max(4, (localContent || '').split('\n').length + 1)"
      ></textarea>
      <div
        v-else
        class="content-preview"
        @click="handlePreviewClick"
        v-html="renderedContentHtml"
      ></div>

      <!-- 单元格编辑浮层 -->
      <div v-if="cellEditing" class="cell-edit-overlay" @click.self="saveCellEdit">
        <div class="cell-edit-popup" :style="cellEditStyle">
          <textarea
            ref="cellInput"
            v-model="cellEditValue"
            class="cell-edit-input"
            @keydown.enter.exact.prevent="saveCellEdit"
            @keydown.escape="cancelCellEdit"
            rows="2"
          ></textarea>
          <div class="cell-edit-actions">
            <button class="btn btn-primary btn-sm" @click="saveCellEdit">确认</button>
            <button class="btn btn-secondary btn-sm" @click="cancelCellEdit">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Bot, Image as ImageIcon, X, RefreshCw, Edit3 } from 'lucide-vue-next'
import mermaid from 'mermaid'

// 初始化 Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
})

let mermaidIdCounter = 0

export default {
  name: 'SectionEditor',
  components: { Bot, ImageIcon, X, RefreshCw, Edit3 },
  props: {
    section: { type: Object, required: true },
  },
  emits: ['update-content', 'upload-image', 'generate-single'],
  data() {
    return {
      editing: false,
      localContent: '',
      localMermaidCode: '',
      renderedSvg: '',
      mermaidError: '',
      // 单元格编辑状态
      cellEditing: false,
      cellEditRow: -1,
      cellEditCol: -1,
      cellEditValue: '',
      cellEditStyle: {},
    }
  },
  computed: {
    /** 内容中是否包含 Markdown 表格 */
    hasTable() {
      return !!(this.section.content && /^\|.+\|$/m.test(this.section.content))
    },
    /** 渲染后的 HTML（携带单元格位置属性） */
    renderedContentHtml() {
      return this.renderMarkdown(this.section.content)
    },
  },
  watch: {
    'section.content'(val) {
      if (!this.editing) this.localContent = val || ''
    },
    'section.mermaidCode': {
      immediate: true,
      handler(val) {
        if (val) {
          this.localMermaidCode = val
          this.renderMermaid(val)
        }
      },
    },
  },
  mounted() {
    this.localContent = this.section.content || ''
    this.localMermaidCode = this.section.mermaidCode || ''
    if (this.section.mermaidCode) {
      this.renderMermaid(this.section.mermaidCode)
    }
  },
  methods: {
    startEdit() {
      this.localContent = this.section.content || ''
      this.editing = true
    },
    saveContent() {
      this.editing = false
      this.$emit('update-content', {
        sectionId: this.section.id,
        content: this.localContent,
      })
    },
    saveMermaid() {
      this.editing = false
      this.$emit('update-content', {
        sectionId: this.section.id,
        mermaidCode: this.localMermaidCode,
      })
      if (this.localMermaidCode) {
        this.renderMermaid(this.localMermaidCode)
      }
    },

    // ===== 表格单元格编辑 =====

    /**
     * 处理预览区域的点击
     * 如果点击的是 <td>/<th>，进入单元格编辑模式
     * 否则进入整体文本编辑
     */
    handlePreviewClick(e) {
      const cell = e.target.closest('td[data-row][data-col], th[data-row][data-col]')
      if (cell) {
        e.stopPropagation()
        this.startCellEdit(cell)
        return
      }
      // 非表格区域 → 整体编辑
      this.startEdit()
    },

    /** 开始编辑某个单元格 */
    startCellEdit(cell) {
      const row = parseInt(cell.dataset.row)
      const col = parseInt(cell.dataset.col)
      if (isNaN(row) || isNaN(col)) return

      // 从 markdown 源码中提取该单元格的值
      const table = this._parseMarkdownTable()
      if (!table || row >= table.length || col >= table[row].length) return

      this.cellEditRow = row
      this.cellEditCol = col
      this.cellEditValue = table[row][col]

      // 计算浮层位置（相对于点击的单元格）
      const rect = cell.getBoundingClientRect()
      const wrapper = this.$el.querySelector('.content-editor-wrapper')
      const wrapperRect = wrapper?.getBoundingClientRect() || { left: 0, top: 0 }

      this.cellEditStyle = {
        position: 'absolute',
        left: `${rect.left - wrapperRect.left}px`,
        top: `${rect.top - wrapperRect.top + rect.height + 4}px`,
        minWidth: `${Math.max(rect.width, 180)}px`,
        maxWidth: '400px',
      }

      this.cellEditing = true
      this.$nextTick(() => {
        this.$refs.cellInput?.focus()
        this.$refs.cellInput?.select()
      })
    },

    /** 保存单元格编辑 → 更新 markdown 源码中对应位置 */
    saveCellEdit() {
      if (!this.cellEditing) return

      const table = this._parseMarkdownTable()
      if (!table || this.cellEditRow >= table.length || this.cellEditCol >= table[this.cellEditRow].length) {
        this.cancelCellEdit()
        return
      }

      // 更新该单元格
      table[this.cellEditRow][this.cellEditCol] = this.cellEditValue.replace(/\|/g, '│').replace(/\n/g, ' ')

      // 重建 markdown 表格并替换原内容中的表格部分
      const newContent = this._rebuildContentWithTable(table)

      this.cellEditing = false
      this.cellEditRow = -1
      this.cellEditCol = -1

      this.$emit('update-content', {
        sectionId: this.section.id,
        content: newContent,
      })
    },

    cancelCellEdit() {
      this.cellEditing = false
      this.cellEditRow = -1
      this.cellEditCol = -1
    },

    /**
     * 从 section.content 中解析 markdown 表格为二维数组
     * 返回 [[header1, header2], [cell1, cell2], ...]
     * row 0 = 表头
     */
    _parseMarkdownTable() {
      const content = this.section.content || ''
      const lines = content.split('\n')
      const table = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          // 跳过分隔行 |---|---|
          if (/^\|[\s\-|:]+\|$/.test(trimmed)) continue
          const cells = trimmed.split('|').slice(1, -1).map(c => c.trim())
          table.push(cells)
        }
      }
      return table.length > 0 ? table : null
    },

    /**
     * 将修改后的二维数组重建为 markdown，替换原文中的表格
     */
    _rebuildContentWithTable(table) {
      const content = this.section.content || ''
      const lines = content.split('\n')
      const result = []
      let tableRowIdx = 0
      let headerDone = false

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          // 分隔行原样保留
          if (/^\|[\s\-|:]+\|$/.test(trimmed)) {
            result.push(trimmed)
            continue
          }
          if (tableRowIdx < table.length) {
            const row = table[tableRowIdx]
            result.push('| ' + row.join(' | ') + ' |')
            tableRowIdx++
            // 表头后面如果没有分隔行，自动加一行
            if (!headerDone) {
              headerDone = true
            }
          }
        } else {
          result.push(line)
        }
      }
      return result.join('\n')
    },

    // ===== Markdown 渲染 =====

    async renderMermaid(code) {
      if (!code) return
      this.mermaidError = ''
      try {
        const id = `mermaid-${Date.now()}-${++mermaidIdCounter}`
        const { svg } = await mermaid.render(id, code)
        this.renderedSvg = svg
      } catch (e) {
        this.mermaidError = e.message || String(e)
        this.renderedSvg = ''
      }
    },
    triggerImageUpload() {
      this.$refs.imageInput?.click()
    },
    handleImageUpload(event) {
      const file = event.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        this.$emit('upload-image', {
          sectionId: this.section.id,
          imageData: e.target.result,
        })
      }
      reader.readAsDataURL(file)
      event.target.value = ''
    },
    removeImage() {
      this.$emit('upload-image', {
        sectionId: this.section.id,
        imageData: null,
      })
    },
    renderMarkdown(text) {
      if (!text) return ''
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      html = this.renderMarkdownTable(html)
      html = html.replace(/^#### (.+)$/gm, '<h5 style="margin:8px 0 4px;font-size:13px;font-weight:600;">$1</h5>')
      html = html.replace(/^### (.+)$/gm, '<h4 style="margin:12px 0 4px;font-size:14px;font-weight:600;">$1</h4>')
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      html = html.replace(/^[-*] (.+)$/gm, '<li style="margin-left:16px;font-size:13px;">$1</li>')
      html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;font-size:13px;">$1</li>')
      html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre style="background:var(--bg-tertiary);padding:8px;border-radius:4px;font-size:12px;overflow-x:auto;">$1</pre>')
      html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-tertiary);padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
      html = html.replace(/\n/g, '<br>')
      return html
    },
    renderMarkdownTable(text) {
      const lines = text.split('\n')
      let result = []
      let inTable = false
      let tableHtml = ''
      let isFirstRow = true
      let rowIndex = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith('|') && line.endsWith('|')) {
          if (/^[\s\-|:]+$/.test(line.replace(/\|/g, ''))) continue
          if (!inTable) {
            inTable = true
            isFirstRow = true
            rowIndex = 0
            tableHtml = '<table class="detail-table editable-table" style="width:100%;margin:8px 0;"><thead>'
          }
          const cells = line.split('|').filter(c => c !== '').map(c => c.trim())
          if (isFirstRow) {
            tableHtml += '<tr>' + cells.map((c, ci) =>
              `<th data-row="${rowIndex}" data-col="${ci}" title="点击编辑">${c}</th>`
            ).join('') + '</tr></thead><tbody>'
            isFirstRow = false
            rowIndex++
          } else {
            tableHtml += '<tr>' + cells.map((c, ci) =>
              `<td data-row="${rowIndex}" data-col="${ci}" title="点击编辑">${c}</td>`
            ).join('') + '</tr>'
            rowIndex++
          }
        } else {
          if (inTable) {
            tableHtml += '</tbody></table>'
            result.push(tableHtml)
            inTable = false
            tableHtml = ''
            isFirstRow = true
          }
          result.push(line)
        }
      }
      if (inTable) {
        tableHtml += '</tbody></table>'
        result.push(tableHtml)
      }
      return result.join('\n')
    },
  },
}
</script>

<style scoped>
.section-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* === 错误状态条 === */
.section-error-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--danger-50, #fef2f2);
  border: 1px solid var(--danger-200, #fecaca);
  border-radius: 8px;
  gap: 8px;
}
.section-error-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--danger-700, #b91c1c);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.section-error-icon {
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}
.section-retry-btn {
  flex-shrink: 0;
  animation: pulse-attention 1.5s ease-in-out infinite;
}
@keyframes pulse-attention {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb, 59, 130, 246), 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(var(--primary-rgb, 59, 130, 246), 0); }
}
/* === 生成中状态 === */
.section-generating-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--info-50, #eff6ff);
  border: 1px solid var(--info-200, #bfdbfe);
  border-radius: 8px;
  font-size: 12px;
  color: var(--info-700, #1d4ed8);
}
/* === Mermaid 渲染错误块 === */
.mermaid-error-block {
  background: var(--danger-50, #fef2f2);
  border: 1px solid var(--danger-200, #fecaca);
  border-radius: 8px;
  padding: 12px;
}
.mermaid-error-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--danger-700, #b91c1c);
  margin-bottom: 4px;
}
.mermaid-error-detail {
  font-size: 11px;
  color: var(--danger-500, #ef4444);
  margin-bottom: 8px;
  max-height: 60px;
  overflow-y: auto;
  word-break: break-all;
  line-height: 1.4;
}
.mermaid-error-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
/* === 原有样式 === */
.section-editor-toolbar {
  display: flex;
  gap: 4px;
  align-items: center;
}
.mermaid-editor-wrapper {
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 8px;
  background: var(--bg-secondary);
}
.mermaid-editor {
  width: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  padding: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
  line-height: 1.5;
}
.mermaid-preview {
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 16px;
  background: #fff;
  text-align: center;
  cursor: pointer;
  min-height: 60px;
  overflow-x: auto;
}
.mermaid-preview:hover {
  border-color: var(--primary-400);
}
.mermaid-preview :deep(svg) {
  max-width: 100%;
  height: auto;
}
.mermaid-placeholder {
  border: 2px dashed var(--border-primary);
  border-radius: 6px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 60px;
}
.mermaid-placeholder:hover {
  border-color: var(--primary-400);
  color: var(--primary-500);
}
.uploaded-image-wrapper {
  position: relative;
  display: inline-block;
  margin: 8px 0;
}
.uploaded-image {
  max-width: 100%;
  max-height: 400px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
}
.uploaded-image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.uploaded-image-wrapper:hover .uploaded-image-remove {
  opacity: 1;
}
.image-placeholder {
  border: 2px dashed var(--border-primary);
  border-radius: 6px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.image-placeholder:hover {
  border-color: var(--primary-400);
  color: var(--primary-500);
}
.content-editor-wrapper {
  min-height: 40px;
  position: relative;
}
.content-empty {
  padding: 12px;
  border: 1px dashed var(--border-primary);
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
}
.content-empty:hover {
  border-color: var(--primary-400);
}
.content-textarea {
  width: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid var(--primary-400);
  border-radius: 6px;
  padding: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
  outline: none;
}
.content-preview {
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
  transition: border-color 0.15s;
}
.content-preview:hover {
  border-color: var(--border-primary);
  background: var(--bg-secondary);
}

/* === 可编辑表格单元格交互 === */
.content-preview :deep(.editable-table td),
.content-preview :deep(.editable-table th) {
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}
.content-preview :deep(.editable-table td:hover),
.content-preview :deep(.editable-table th:hover) {
  background: var(--primary-500, #6366f1) !important;
  background: rgba(99, 102, 241, 0.1) !important;
  box-shadow: inset 0 0 0 1px var(--primary-400, #818cf8);
}

/* 单元格编辑浮层 */
.cell-edit-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
}
.cell-edit-popup {
  z-index: 101;
  background: #1e293b;
  border: 1px solid #818cf8;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.cell-edit-input {
  width: 100%;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid #475569;
  border-radius: 4px;
  padding: 6px 8px;
  background: #0f172a;
  color: #f1f5f9;
  resize: vertical;
  outline: none;
  font-family: inherit;
}
.cell-edit-input:focus {
  border-color: #818cf8;
}
.cell-edit-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  justify-content: flex-end;
}
</style>
