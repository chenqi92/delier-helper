<template>
  <div class="card">
    <div class="card-header">
      <h3><Paperclip :size="14" /> 参考文件</h3>
    </div>
    <div class="card-body">
      <!-- 已导入的文件列表 -->
      <div v-if="files.length > 0" class="ref-file-list">
        <div v-for="(file, idx) in files" :key="idx" class="ref-file-item">
          <div class="ref-file-header">
            <div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0;">
              <component :is="getFileIcon(file.type)" :size="12" />
              <span class="ref-file-name" :title="file.name">{{ file.name }}</span>
              <span v-if="file.error" class="badge badge-danger" style="font-size:9px;">错误</span>
              <span v-else-if="file.parsing" class="badge badge-info" style="font-size:9px;">解析中</span>
              <span v-else class="badge badge-success" style="font-size:9px;">
                {{ file.content ? formatSize(file.content.length) : '空' }}
              </span>
            </div>
            <div style="display:flex;gap:2px;">
              <button class="te-btn" @click="togglePreview(idx)" title="预览内容">
                {{ previewIdx === idx ? '收起' : '预览' }}
              </button>
              <button class="te-btn te-btn-danger" @click="removeFile(idx)" title="删除">✕</button>
            </div>
          </div>
          <!-- 内容预览 -->
          <div v-if="previewIdx === idx" class="ref-file-preview">
            <div v-if="file.error" style="color:var(--danger-600);">{{ file.error }}</div>
            <pre v-else>{{ file.content?.substring(0, 2000) || '(无内容)' }}</pre>
          </div>
        </div>
      </div>

      <!-- 空提示 -->
      <div v-else style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px;">
        导入 Word、Excel、PDF、Markdown 等文件，辅助 AI 生成更精准的内容
      </div>

      <!-- 导入按钮 -->
      <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:6px;" @click="importFiles" :disabled="parsing">
        <Plus :size="12" /> {{ parsing ? '解析中...' : '导入文件' }}
      </button>
    </div>
  </div>
</template>

<script>
import { Paperclip, FileText, Table2, FileImage, Plus, File } from 'lucide-vue-next'
import { open } from '@tauri-apps/plugin-dialog'
import { parseFile, getFileFilters } from '../core/doc-template/file-parser.js'

export default {
  name: 'ReferenceFiles',
  components: { Paperclip, FileText, Table2, FileImage, Plus, File },
  inject: ['showToast'],
  emits: ['update-files'],
  data() {
    return {
      files: [],
      parsing: false,
      previewIdx: -1,
    }
  },
  methods: {
    async importFiles() {
      const selected = await open({
        multiple: true,
        title: '导入参考文件',
        filters: getFileFilters(),
      })
      if (!selected) return
      const paths = Array.isArray(selected) ? selected : [selected]
      if (paths.length === 0) return

      this.parsing = true
      for (const filePath of paths) {
        // 避免重复导入
        if (this.files.some(f => f.path === filePath)) continue

        const placeholder = {
          name: filePath.split(/[/\\]/).pop(),
          path: filePath,
          type: '.' + filePath.split('.').pop().toLowerCase(),
          content: null,
          error: null,
          parsing: true,
        }
        this.files.push(placeholder)
        const idx = this.files.length - 1

        try {
          const result = await parseFile(filePath)
          this.files[idx] = result
        } catch (e) {
          this.files[idx].error = String(e)
          this.files[idx].parsing = false
        }
      }
      this.parsing = false
      this.$emit('update-files', this.files)
      this.showToast(`已导入 ${paths.length} 个文件`, 'success')
    },
    removeFile(idx) {
      this.files.splice(idx, 1)
      if (this.previewIdx === idx) this.previewIdx = -1
      else if (this.previewIdx > idx) this.previewIdx--
      this.$emit('update-files', this.files)
    },
    togglePreview(idx) {
      this.previewIdx = this.previewIdx === idx ? -1 : idx
    },
    getFileIcon(type) {
      if (['.xlsx', '.xls', '.csv'].includes(type)) return 'Table2'
      if (['.pdf'].includes(type)) return 'FileImage'
      return 'FileText'
    },
    formatSize(chars) {
      if (chars < 1000) return `${chars} 字`
      return `${(chars / 1000).toFixed(1)}k 字`
    },
  },
}
</script>

<style scoped>
.ref-file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ref-file-item {
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  overflow: hidden;
}
.ref-file-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  font-size: 12px;
}
.ref-file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}
.ref-file-preview {
  border-top: 1px solid var(--border-primary);
  padding: 6px 8px;
  background: var(--bg-secondary);
  max-height: 200px;
  overflow-y: auto;
}
.ref-file-preview pre {
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
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
.te-btn-danger:hover {
  background: var(--danger-50, #fef2f2);
  color: var(--danger-600, #dc2626);
}
</style>
