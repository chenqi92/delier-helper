<template>
  <div class="section-editor">
    <!-- 操作按钮行 -->
    <div class="section-editor-toolbar">
      <button class="btn btn-secondary btn-sm" @click="$emit('generate-single', section.id)" title="单独生成此章节">
        <Bot :size="12" /> 生成
      </button>
      <button
        v-if="section.type === 'diagram' || section.type === 'image'"
        class="btn btn-secondary btn-sm"
        @click="triggerImageUpload"
        title="上传图片"
      >
        <ImageIcon :size="12" /> 上传图片
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
      <div v-else-if="section.mermaidCode && !editing" class="mermaid-placeholder" @click="editing = true">
        <span class="spinner" style="margin-right:6px;"></span> 渲染中...
      </div>
      <div v-else-if="!editing" class="mermaid-placeholder" @click="editing = true">
        <ImageIcon :size="20" style="opacity:0.3;" />
        <span>点击编辑 Mermaid 代码，或使用 AI 生成</span>
      </div>

      <!-- 渲染错误 -->
      <div v-if="mermaidError" class="mermaid-error">
        ⚠ Mermaid 渲染错误: {{ mermaidError }}
        <button class="btn btn-sm" @click="editing = true">编辑代码</button>
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
        @click="startEdit"
        v-html="renderMarkdown(section.content)"
      ></div>
    </div>
  </div>
</template>

<script>
import { Bot, Image as ImageIcon, X } from 'lucide-vue-next'
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
  components: { Bot, ImageIcon, X },
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
    }
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
      // 简单的 Markdown 转 HTML（不依赖 marked 库）
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      // 表格
      html = this.renderMarkdownTable(html)
      // 标题
      html = html.replace(/^#### (.+)$/gm, '<h5 style="margin:8px 0 4px;font-size:13px;font-weight:600;">$1</h5>')
      html = html.replace(/^### (.+)$/gm, '<h4 style="margin:12px 0 4px;font-size:14px;font-weight:600;">$1</h4>')
      // 加粗
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 列表
      html = html.replace(/^[-*] (.+)$/gm, '<li style="margin-left:16px;font-size:13px;">$1</li>')
      html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;font-size:13px;">$1</li>')
      // 代码块
      html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre style="background:var(--bg-tertiary);padding:8px;border-radius:4px;font-size:12px;overflow-x:auto;">$1</pre>')
      // 行内代码
      html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-tertiary);padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
      // 换行
      html = html.replace(/\n/g, '<br>')
      return html
    },
    renderMarkdownTable(text) {
      // 简单表格解析
      const lines = text.split('\n')
      let result = []
      let inTable = false
      let tableHtml = ''
      let isFirstRow = true

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith('|') && line.endsWith('|')) {
          if (/^\|[\s-|:]+\|$/.test(line)) continue // 跳过分隔行
          if (!inTable) {
            inTable = true
            isFirstRow = true
            tableHtml = '<table class="detail-table" style="width:100%;margin:8px 0;"><thead>'
          }
          const cells = line.split('|').filter(c => c !== '').map(c => c.trim())
          if (isFirstRow) {
            tableHtml += '<tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
            isFirstRow = false
          } else {
            tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>'
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
.mermaid-error {
  background: var(--danger-50, #fef2f2);
  color: var(--danger-600, #dc2626);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
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
</style>
