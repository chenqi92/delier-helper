<template>
  <div class="table-editor">
    <!-- 工具栏 -->
    <div class="te-toolbar">
      <button class="btn btn-secondary btn-sm" @click="addRow" title="添加行">
        <Plus :size="12" /> 添加行
      </button>
      <button class="btn btn-secondary btn-sm" @click="addColumn" title="添加列">
        <Plus :size="12" /> 添加列
      </button>
      <button class="btn btn-secondary btn-sm" @click="toggleRawEdit" :title="rawEditing ? '切换表格视图' : '编辑 Markdown'">
        <Code :size="12" /> {{ rawEditing ? '表格视图' : 'Markdown' }}
      </button>
    </div>

    <!-- Markdown 原文编辑模式 -->
    <div v-if="rawEditing" class="te-raw-editor">
      <textarea
        class="te-raw-textarea"
        v-model="rawMarkdown"
        @blur="parseRawMarkdown"
        :rows="Math.max(6, rawMarkdown.split('\n').length + 1)"
        placeholder="输入 Markdown 表格..."
      ></textarea>
    </div>

    <!-- 表格可视化编辑模式 -->
    <div v-else class="te-table-wrap">
      <table v-if="rows.length > 0" class="te-table">
        <thead>
          <tr>
            <th class="te-row-num">#</th>
            <th v-for="(header, colIdx) in headers" :key="'h-' + colIdx" class="te-header-cell">
              <input
                class="te-cell-input te-header-input"
                :value="header"
                @input="updateHeader(colIdx, $event.target.value)"
                @blur="syncToContent"
              />
              <button
                v-if="headers.length > 1"
                class="te-col-del-btn"
                @click="removeColumn(colIdx)"
                title="删除此列"
              >×</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIdx) in rows" :key="'r-' + rowIdx">
            <td class="te-row-num">
              <span>{{ rowIdx + 1 }}</span>
              <button
                v-if="rows.length > 1"
                class="te-row-del-btn"
                @click="removeRow(rowIdx)"
                title="删除此行"
              >×</button>
            </td>
            <td v-for="(cell, colIdx) in row" :key="'c-' + rowIdx + '-' + colIdx" class="te-body-cell">
              <input
                class="te-cell-input"
                :value="cell"
                @input="updateCell(rowIdx, colIdx, $event.target.value)"
                @blur="syncToContent"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 空状态 -->
      <div v-else class="te-empty" @click="initTable">
        <span>点击创建表格，或使用 AI 生成</span>
      </div>
    </div>
  </div>
</template>

<script>
import { Plus, Code } from 'lucide-vue-next'

export default {
  name: 'TableEditor',
  components: { Plus, Code },
  props: {
    section: { type: Object, required: true },
  },
  emits: ['update-content'],
  data() {
    return {
      headers: [],
      rows: [],
      rawEditing: false,
      rawMarkdown: '',
    }
  },
  watch: {
    'section.content': {
      immediate: true,
      handler(val) {
        if (val) {
          this.parseMarkdownTable(val)
        }
      },
    },
  },
  methods: {
    /**
     * 解析 Markdown 表格为 headers + rows
     */
    parseMarkdownTable(md) {
      if (!md || !md.trim()) {
        this.headers = []
        this.rows = []
        return
      }

      const lines = md.split('\n').filter(l => l.trim())
      const tableLines = []
      const nonTableLines = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          // 跳过分隔行
          if (/^\|[\s-|:]+\|$/.test(trimmed)) continue
          tableLines.push(trimmed)
        } else {
          nonTableLines.push(trimmed)
        }
      }

      if (tableLines.length === 0) {
        this.headers = []
        this.rows = []
        return
      }

      // 第一行为表头
      this.headers = tableLines[0].split('|').filter(c => c !== '').map(c => c.trim())
      this.rows = tableLines.slice(1).map(line =>
        line.split('|').filter(c => c !== '').map(c => c.trim())
      )

      // 确保每行列数与表头一致
      const colCount = this.headers.length
      this.rows = this.rows.map(row => {
        while (row.length < colCount) row.push('')
        return row.slice(0, colCount)
      })
    },

    /**
     * 将 headers + rows 转回 Markdown 并同步
     */
    toMarkdownTable() {
      if (this.headers.length === 0) return ''
      const lines = []
      lines.push('| ' + this.headers.join(' | ') + ' |')
      lines.push('| ' + this.headers.map(() => '---').join(' | ') + ' |')
      for (const row of this.rows) {
        const paddedRow = [...row]
        while (paddedRow.length < this.headers.length) paddedRow.push('')
        lines.push('| ' + paddedRow.join(' | ') + ' |')
      }
      return lines.join('\n')
    },

    syncToContent() {
      const md = this.toMarkdownTable()
      this.$emit('update-content', {
        sectionId: this.section.id,
        content: md,
      })
    },

    updateHeader(colIdx, value) {
      this.headers[colIdx] = value
    },

    updateCell(rowIdx, colIdx, value) {
      this.rows[rowIdx][colIdx] = value
    },

    addRow() {
      if (this.headers.length === 0) {
        this.initTable()
        return
      }
      this.rows.push(new Array(this.headers.length).fill(''))
      this.syncToContent()
    },

    removeRow(rowIdx) {
      this.rows.splice(rowIdx, 1)
      this.syncToContent()
    },

    addColumn() {
      if (this.headers.length === 0) {
        this.initTable()
        return
      }
      this.headers.push('新列')
      for (const row of this.rows) {
        row.push('')
      }
      this.syncToContent()
    },

    removeColumn(colIdx) {
      this.headers.splice(colIdx, 1)
      for (const row of this.rows) {
        row.splice(colIdx, 1)
      }
      this.syncToContent()
    },

    initTable() {
      this.headers = ['列1', '列2', '列3']
      this.rows = [['', '', '']]
      this.syncToContent()
    },

    toggleRawEdit() {
      if (this.rawEditing) {
        // 切回表格视图：解析原文
        this.parseMarkdownTable(this.rawMarkdown)
        this.syncToContent()
      } else {
        // 切到原文编辑
        this.rawMarkdown = this.toMarkdownTable() || this.section.content || ''
      }
      this.rawEditing = !this.rawEditing
    },

    parseRawMarkdown() {
      this.parseMarkdownTable(this.rawMarkdown)
      this.syncToContent()
    },
  },
}
</script>

<style scoped>
.table-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.te-toolbar {
  display: flex;
  gap: 4px;
  align-items: center;
}
.te-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
}
.te-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.te-table th,
.te-table td {
  border: 1px solid var(--border-primary);
  padding: 0;
  position: relative;
}
.te-row-num {
  width: 36px;
  min-width: 36px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  position: relative;
}
.te-row-del-btn,
.te-col-del-btn {
  position: absolute;
  width: 16px;
  height: 16px;
  border: none;
  background: var(--danger-500, #ef4444);
  color: white;
  border-radius: 50%;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 2;
  padding: 0;
}
.te-row-num:hover .te-row-del-btn,
.te-header-cell:hover .te-col-del-btn {
  opacity: 1;
}
.te-row-del-btn {
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
}
.te-col-del-btn {
  right: 2px;
  top: 2px;
}
.te-header-cell {
  background: var(--bg-secondary);
  position: relative;
}
.te-cell-input {
  width: 100%;
  border: none;
  background: transparent;
  padding: 6px 8px;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
}
.te-cell-input:focus {
  background: var(--primary-50, #eff6ff);
}
.te-header-input {
  font-weight: 600;
}
.te-empty {
  padding: 24px;
  text-align: center;
  border: 2px dashed var(--border-primary);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 13px;
}
.te-empty:hover {
  border-color: var(--primary-400);
  color: var(--primary-500);
}
.te-raw-editor {
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  overflow: hidden;
}
.te-raw-textarea {
  width: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  border: none;
  padding: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
  outline: none;
}
</style>
