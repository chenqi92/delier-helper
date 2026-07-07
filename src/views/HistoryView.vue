<template>
  <div class="history-page">
    <aside class="history-sidebar">
      <div class="history-head">
        <div>
          <h2>历史记录</h2>
          <p>查看每次生成的来源、设置和结果快照</p>
        </div>
        <button class="btn btn-secondary btn-sm" @click="loadRecords" :disabled="loading">刷新</button>
      </div>

      <div class="history-filters">
        <button :class="['history-filter', { active: activeType === '' }]" @click="setType('')">全部</button>
        <button
          v-for="t in types"
          :key="t.id"
          :class="['history-filter', { active: activeType === t.id }]"
          @click="setType(t.id)"
        >
          {{ t.label }}
        </button>
      </div>

      <input class="form-input history-search" v-model="keyword" placeholder="搜索标题 / 摘要 / 类型" />

      <div class="history-list">
        <div v-if="loading" class="history-empty">正在加载...</div>
        <div v-else-if="filteredRecords.length === 0" class="history-empty">暂无历史记录</div>
        <template v-else>
          <button
            v-for="item in filteredRecords"
            :key="item.id"
            :class="['history-item', { active: selectedId === item.id }]"
            @click="selectRecord(item.id)"
          >
            <span class="history-type">{{ typeLabel(item.type) }}</span>
            <span class="history-title">{{ item.title }}</span>
            <span class="history-summary">{{ item.summary || '无摘要' }}</span>
            <span class="history-time">{{ formatDate(item.updatedAt) }}</span>
          </button>
        </template>
      </div>
    </aside>

    <main class="history-detail">
      <div v-if="!selected" class="empty-state history-empty-main">
        <p>选择左侧记录查看详情</p>
        <p class="hint">生成成功后会自动保存快照，刷新页面后仍可在这里查看。</p>
      </div>

      <template v-else>
        <div class="history-detail-head">
          <div>
            <div class="detail-kicker">{{ typeLabel(selected.type) }} · {{ formatDate(selected.updatedAt) }}</div>
            <h1>{{ selected.title }}</h1>
            <p>{{ selected.summary }}</p>
          </div>
          <button class="btn btn-danger btn-sm" @click="removeSelected">删除</button>
        </div>

        <div class="history-meta-grid">
          <div class="history-meta-card">
            <span>状态</span>
            <strong>{{ selected.status || 'completed' }}</strong>
          </div>
          <div class="history-meta-card">
            <span>模型</span>
            <strong>{{ selected.modelId || selected.settings?.model?.modelId || '-' }}</strong>
          </div>
          <div class="history-meta-card">
            <span>厂商</span>
            <strong>{{ selected.providerId || selected.settings?.model?.providerLabel || '-' }}</strong>
          </div>
          <div class="history-meta-card">
            <span>创建时间</span>
            <strong>{{ formatDate(selected.createdAt) }}</strong>
          </div>
        </div>

        <div class="history-section">
          <h3>内容预览</h3>
          <div class="history-preview">
            <template v-if="artifactKind === 'sections'">
              <div v-for="sec in flatSections" :key="sec.key" class="preview-section">
                <div class="preview-section-title">{{ sec.number }} {{ sec.title }}</div>
                <pre v-if="sec.content" class="preview-text">{{ sec.content }}</pre>
                <pre v-if="sec.mermaidCode" class="preview-text">{{ sec.mermaidCode }}</pre>
                <div v-if="!sec.content && !sec.mermaidCode" class="preview-muted">无正文快照</div>
              </div>
            </template>

            <template v-else-if="artifactKind === 'api-doc'">
              <div v-for="mod in selected.artifact.modules || []" :key="mod.className || mod.name" class="preview-section">
                <div class="preview-section-title">{{ mod.name || mod.className }} · {{ (mod.apis || []).length }} 个接口</div>
                <div v-for="api in (mod.apis || []).slice(0, 20)" :key="api.methodName || api.path" class="preview-line">
                  <code>{{ api.method }}</code>
                  <span>{{ api.displayPath || api.path }}</span>
                  <em>{{ api.description || api.summary || '-' }}</em>
                </div>
              </div>
            </template>

            <template v-else-if="artifactKind === 'db-doc'">
              <div v-for="table in selected.artifact.schema?.tables || []" :key="table.name" class="preview-section">
                <div class="preview-section-title">{{ table.name }} · {{ table.comment || '无表说明' }}</div>
                <div v-for="col in tableColumns(table.name).slice(0, 30)" :key="col.name" class="preview-line">
                  <code>{{ col.name }}</code>
                  <span>{{ col.full_type || col.data_type }}</span>
                  <em>{{ col.comment || '-' }}</em>
                </div>
              </div>
            </template>

            <template v-else-if="artifactKind === 'ppt'">
              <div v-for="(slide, idx) in selected.artifact.deck?.slides || []" :key="slide.id || idx" class="preview-section">
                <div class="preview-section-title">第 {{ idx + 1 }} 页 · {{ slide.layout || slide.type }} · {{ slide.title || '未命名' }}</div>
                <pre class="preview-text">{{ compactJson(slide) }}</pre>
              </div>
            </template>

            <template v-else-if="artifactKind === 'copyright'">
              <div class="preview-section">
                <div class="preview-section-title">代码快照</div>
                <pre class="preview-text code-preview">{{ (selected.artifact.lines || []).slice(0, 2000).join('\n') }}</pre>
                <div v-if="(selected.artifact.lines || []).length > 2000" class="preview-muted">
                  仅预览前 2000 行，完整行数：{{ selected.artifact.lines.length }}
                </div>
              </div>
            </template>

            <pre v-else class="preview-text">{{ compactJson(selected.artifact) }}</pre>
          </div>
        </div>

        <div class="history-section">
          <h3>生成来源</h3>
          <pre class="json-box">{{ compactJson(selected.source) }}</pre>
        </div>

        <div class="history-section">
          <h3>当时设置</h3>
          <pre class="json-box">{{ compactJson(selected.settings) }}</pre>
        </div>

        <div class="history-section">
          <h3>结果摘要</h3>
          <pre class="json-box">{{ compactJson(selected.result) }}</pre>
        </div>
      </template>
    </main>
  </div>
</template>

<script>
import { getGenerationHistory, deleteGenerationHistory } from '../core/db.js'
import { HISTORY_TYPES, historyTypeLabel } from '../core/generation-history.js'

export default {
  name: 'HistoryView',
  inject: ['showToast'],
  data() {
    return {
      loading: false,
      records: [],
      selectedId: '',
      activeType: '',
      keyword: '',
      types: HISTORY_TYPES,
    }
  },
  computed: {
    filteredRecords() {
      const kw = this.keyword.trim().toLowerCase()
      if (!kw) return this.records
      return this.records.filter(r => {
        return [r.title, r.summary, r.type, this.typeLabel(r.type)].some(v => String(v || '').toLowerCase().includes(kw))
      })
    },
    selected() {
      return this.records.find(r => r.id === this.selectedId) || this.filteredRecords[0] || null
    },
    artifactKind() {
      return this.selected?.artifact?.kind || ''
    },
    flatSections() {
      const out = []
      const walk = (sections = [], prefix = '') => {
        for (const sec of sections) {
          const key = `${prefix}${sec.id || sec.number || sec.title || out.length}`
          if (sec.enabled !== false) out.push({ ...sec, key })
          if (Array.isArray(sec.children)) walk(sec.children, `${key}.`)
        }
      }
      walk(this.selected?.artifact?.sections || [])
      return out
    },
  },
  async created() {
    await this.loadRecords()
  },
  activated() {
    this.loadRecords()
  },
  methods: {
    async loadRecords() {
      this.loading = true
      try {
        this.records = await getGenerationHistory({ type: this.activeType, limit: 300 })
        if (!this.records.some(r => r.id === this.selectedId)) {
          this.selectedId = this.records[0]?.id || ''
        }
      } catch (e) {
        this.showToast?.('历史记录加载失败: ' + String(e), 'error')
      } finally {
        this.loading = false
      }
    },
    setType(type) {
      this.activeType = type
      this.selectedId = ''
      this.loadRecords()
    },
    selectRecord(id) {
      this.selectedId = id
    },
    async removeSelected() {
      if (!this.selected) return
      await deleteGenerationHistory(this.selected.id)
      this.showToast?.('历史记录已删除', 'success')
      await this.loadRecords()
    },
    typeLabel(type) {
      return historyTypeLabel(type)
    },
    formatDate(ts) {
      if (!ts) return '-'
      const d = new Date(ts)
      const pad = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    },
    compactJson(value) {
      return JSON.stringify(value || {}, null, 2)
    },
    tableColumns(tableName) {
      return (this.selected?.artifact?.schema?.columns || []).filter(c => c.table_name === tableName)
    },
  },
}
</script>

<style scoped>
.history-page {
  height: 100%;
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  background: var(--bg-primary);
}
.history-sidebar {
  border-right: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-secondary);
}
.history-head {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--border-primary);
}
.history-head h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}
.history-head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.history-filters {
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.history-filter {
  border: 1px solid var(--border-primary);
  background: var(--surface-50);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}
.history-filter.active {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-500);
}
.history-search {
  margin: 0 12px 12px;
  width: calc(100% - 24px);
}
.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 12px;
}
.history-item {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 8px;
  padding: 10px;
  display: grid;
  gap: 4px;
  cursor: pointer;
  color: var(--text-primary);
}
.history-item:hover,
.history-item.active {
  background: var(--surface-50);
  border-color: var(--border-primary);
}
.history-type {
  font-size: 11px;
  color: var(--primary-500);
  font-weight: 700;
}
.history-title {
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-summary,
.history-time,
.history-empty {
  font-size: 12px;
  color: var(--text-secondary);
}
.history-empty {
  padding: 20px;
  text-align: center;
}
.history-detail {
  min-width: 0;
  overflow-y: auto;
  padding: 24px;
}
.history-empty-main {
  height: 100%;
}
.history-detail-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}
.detail-kicker {
  font-size: 12px;
  color: var(--primary-500);
  font-weight: 700;
  margin-bottom: 4px;
}
.history-detail-head h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 24px;
}
.history-detail-head p {
  color: var(--text-secondary);
  margin: 6px 0 0;
}
.history-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}
.history-meta-card {
  border: 1px solid var(--border-primary);
  background: var(--surface-50);
  border-radius: 8px;
  padding: 10px;
  min-width: 0;
}
.history-meta-card span {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.history-meta-card strong {
  display: block;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-section {
  margin-top: 16px;
}
.history-section h3 {
  margin: 0 0 8px;
  font-size: 15px;
  color: var(--text-primary);
}
.history-preview,
.json-box {
  border: 1px solid var(--border-primary);
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px;
}
.json-box,
.preview-text {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
}
.preview-section {
  border-bottom: 1px solid var(--border-primary);
  padding: 10px 0;
}
.preview-section:first-child {
  padding-top: 0;
}
.preview-section:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
.preview-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.preview-line {
  display: grid;
  grid-template-columns: 80px minmax(160px, 1fr) minmax(200px, 1fr);
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 3px 0;
}
.preview-line code {
  color: var(--primary-500);
}
.preview-line em {
  color: var(--text-muted);
  font-style: normal;
}
.preview-muted {
  font-size: 12px;
  color: var(--text-muted);
}
.code-preview {
  font-family: Consolas, 'Courier New', monospace;
}
@media (max-width: 1100px) {
  .history-page {
    grid-template-columns: 300px minmax(0, 1fr);
  }
  .history-meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
