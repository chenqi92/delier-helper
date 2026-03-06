<template>
  <div style="display:flex;flex-direction:column;height:100%;">
    <!-- 头部操作栏 -->
    <div class="view-header">
      <div class="header-actions">
        <span style="font-size:12px;color:var(--text-secondary);">配置大模型 API 密钥和可用模型</span>
      </div>
    </div>

    <!-- 主体 -->
    <div class="app-body">
      <!-- 左侧：已保存的厂商列表 -->
      <aside class="config-panel">
        <div class="card">
          <div class="card-header">
            <h3><Bot :size="14" /> 厂商配置</h3>
          </div>
          <div class="card-body" style="padding:6px;">
            <button class="ai-add-btn" @click="addNewProvider">
              <Plus :size="14" /> 新增厂商
            </button>

            <div class="ai-cfg-list">
              <div
                v-for="cfg in providerConfigs"
                :key="cfg.id"
                :class="['ai-cfg-item', { active: editingId === cfg.id }]"
                @click="selectProvider(cfg)"
              >
                <div class="ai-cfg-item-main">
                  <span class="ai-cfg-item-name">{{ cfg.label || '未命名' }}</span>
                  <span class="ai-cfg-item-model">{{ cfg.models.length }} 个模型</span>
                </div>
                <div class="ai-cfg-item-actions">
                  <button class="ai-cfg-act-btn ai-cfg-del" title="删除" @click.stop="removeProvider(cfg)">
                    <Trash2 :size="12" />
                  </button>
                </div>
              </div>
            </div>

            <div v-if="providerConfigs.length === 0" class="ai-empty-hint">
              暂无配置，点击上方按钮新增
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧：厂商编辑 + 模型管理 -->
      <main class="content-panel">
        <div v-if="form" class="ai-edit-area">
          <!-- 厂商基本信息 -->
          <div class="card">
            <div class="card-header">
              <h3><Settings :size="14" /> {{ form.label || '新厂商配置' }}</h3>
              <span v-if="saved" class="ai-saved-badge"><Check :size="12" /> 已保存</span>
            </div>
            <div class="card-body" style="display:flex;flex-direction:column;gap:14px;">
              <!-- 提供商 -->
              <div class="form-group">
                <label class="form-label">模型提供商</label>
                <select class="form-input" v-model="form.providerId" @change="onProviderChange">
                  <option v-for="p in providerPresets" :key="p.id" :value="p.id">{{ p.label }}</option>
                </select>
              </div>

              <!-- 配置名称 -->
              <div class="form-group">
                <label class="form-label">显示名称 <span class="form-label-hint">(留空则使用提供商名称)</span></label>
                <input type="text" class="form-input" v-model="form.label" placeholder="例如：DeepSeek 日常" />
              </div>

              <!-- API 地址 -->
              <div class="form-group">
                <label class="form-label">
                  API 地址 (Base URL)
                  <span v-if="isCurrentLocal" class="form-label-hint">(本地服务地址，已预填)</span>
                  <span v-else-if="form.providerId !== 'custom'" class="form-label-hint">(已预填，可修改)</span>
                </label>
                <input type="text" class="form-input" v-model="form.baseUrl" placeholder="https://api.example.com/v1" />
              </div>

              <!-- API Key -->
              <div class="form-group" v-if="!isCurrentLocal">
                <label class="form-label">API Key</label>
                <div style="display:flex;gap:6px;">
                  <input :type="showKey ? 'text' : 'password'" class="form-input" style="flex:1;"
                         v-model="form.apiKey" placeholder="sk-..." />
                  <button class="btn btn-secondary btn-sm" @click="showKey = !showKey" style="min-width:36px;" :title="showKey ? '隐藏' : '显示'">
                    <Eye v-if="!showKey" :size="14" />
                    <EyeOff v-else :size="14" />
                  </button>
                </div>
              </div>
              <div v-else class="tip" style="margin:0;">
                <Lightbulb :size="14" class="tip-icon" />
                <span>本地服务无需 API Key，确保服务已启动后使用「检测模型」获取可用列表</span>
              </div>

              <!-- 操作按钮 -->
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;">
                <button class="btn btn-secondary btn-sm" @click="doTest" :disabled="testing || !isFormValid">
                  <span v-if="testing" class="spinner" style="width:12px;height:12px;"></span>
                  <Wifi v-else :size="14" />
                  {{ testing ? '测试中...' : '测试连接' }}
                </button>
                <button class="btn btn-primary btn-sm" @click="save" :disabled="!isFormValid">
                  <Save :size="14" /> 保存配置
                </button>
                <span v-if="testResult" :style="{ fontSize: '12px', color: testResult.success ? 'var(--success-500)' : 'var(--danger-500)' }">
                  {{ testResult.message }}
                </span>
              </div>
            </div>
          </div>

          <!-- 模型管理 -->
          <div class="card">
            <div class="card-header">
              <h3><Layers :size="14" /> 可用模型</h3>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-secondary btn-sm" @click="doDetect" :disabled="detecting || !form.baseUrl">
                  <span v-if="detecting" class="spinner" style="width:12px;height:12px;"></span>
                  <Search v-else :size="12" />
                  {{ detecting ? '检测中...' : '检测模型' }}
                </button>
                <button class="btn btn-secondary btn-sm" @click="showAddModel = true">
                  <Plus :size="12" /> 自定义模型
                </button>
              </div>
            </div>
            <div v-if="detectResult" style="padding:8px 12px 0;">
              <span :style="{ fontSize: '12px', color: detectResult.success ? 'var(--success-500)' : 'var(--danger-500)' }">
                {{ detectResult.message }}
              </span>
            </div>
            <div class="card-body" style="padding:0;">
              <table class="ai-model-table">
                <thead>
                  <tr>
                    <th style="width:30%;">模型 ID</th>
                    <th style="width:20%;">显示名</th>
                    <th style="width:22%;">能力</th>
                    <th style="width:18%;">上下文长度</th>
                    <th style="width:10%;"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(m, idx) in form.models" :key="m.id">
                    <td class="model-id-cell">{{ m.id }}</td>
                    <td>{{ m.label }}</td>
                    <td>
                      <span v-if="m.capabilities?.multimodal" class="cap-tag cap-multimodal">多模态</span>
                      <span v-if="m.capabilities?.deepThinking" class="cap-tag cap-thinking">深度思考</span>
                      <span v-if="!m.capabilities?.multimodal && !m.capabilities?.deepThinking" class="cap-tag cap-text">文本</span>
                    </td>
                    <td>{{ formatCtx(m.contextLength) }}</td>
                    <td>
                      <button class="ai-cfg-act-btn ai-cfg-del" @click="removeModel(idx)" title="移除">
                        <X :size="12" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="form.models.length === 0">
                    <td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px;">
                      暂无模型，请添加自定义模型
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 新增自定义模型弹窗 -->
          <div v-if="showAddModel" class="ai-modal-mask" @click.self="showAddModel = false">
            <div class="ai-modal">
              <div class="ai-modal-header">
                <span>新增自定义模型</span>
                <button class="ai-cfg-act-btn" @click="showAddModel = false"><X :size="14" /></button>
              </div>
              <div class="ai-modal-body">
                <div class="form-group">
                  <label class="form-label">模型 ID</label>
                  <input type="text" class="form-input" v-model="newModel.id" placeholder="例如：my-custom-model" />
                </div>
                <div class="form-group">
                  <label class="form-label">显示名称</label>
                  <input type="text" class="form-input" v-model="newModel.label" placeholder="例如：自定义模型" />
                </div>
                <div class="form-group">
                  <label class="form-label">能力标签</label>
                  <div style="display:flex;gap:12px;">
                    <label class="cap-check"><input type="checkbox" v-model="newModel.multimodal" /> 多模态</label>
                    <label class="cap-check"><input type="checkbox" v-model="newModel.deepThinking" /> 深度思考</label>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">上下文长度 (tokens)</label>
                  <input type="number" class="form-input" v-model.number="newModel.contextLength" placeholder="32768" />
                </div>
              </div>
              <div class="ai-modal-footer">
                <button class="btn btn-secondary btn-sm" @click="showAddModel = false">取消</button>
                <button class="btn btn-primary btn-sm" @click="addCustomModel" :disabled="!newModel.id">添加</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 未选择任何配置时的空状态 -->
        <div v-else class="ai-edit-area ai-empty-state">
          <Bot :size="48" style="color:var(--text-muted);" />
          <p>选择左侧已有厂商进行编辑，或点击「新增厂商」</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
import {
  Bot, Settings, Check, Eye, EyeOff, Wifi, Save,
  Plus, Trash2, X, Layers, Search, Lightbulb
} from 'lucide-vue-next'
import {
  LLM_PROVIDERS, loadProviderConfigs, upsertProviderConfig,
  deleteProviderConfig, testLlmConnection, getDefaultModels,
  getResolvedConfig, nextId, detectModels
} from '../core/llm/llm-service.js'

export default {
  name: 'AiSettings',
  components: { Bot, Settings, Check, Eye, EyeOff, Wifi, Save, Plus, Trash2, X, Layers, Search, Lightbulb },
  inject: ['showToast'],
  data() {
    return {
      providerPresets: LLM_PROVIDERS,
      providerConfigs: [],
      editingId: null,
      form: null,
      showKey: false,
      testing: false,
      testResult: null,
      detecting: false,
      detectResult: null,
      saved: false,
      showAddModel: false,
      newModel: { id: '', label: '', multimodal: false, deepThinking: false, contextLength: 32768 },
    }
  },
  computed: {
    isFormValid() {
      if (!this.form || !this.form.baseUrl) return false
      const preset = this.providerPresets.find(p => p.id === this.form.providerId)
      const needKey = preset ? preset.apiKeyRequired !== false : true
      if (needKey && !this.form.apiKey) return false
      return this.form.models.length > 0
    },
    isCurrentLocal() {
      if (!this.form) return false
      const preset = this.providerPresets.find(p => p.id === this.form.providerId)
      return preset ? !!preset.local : false
    },
  },
  async mounted() {
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.providerConfigs = await loadProviderConfigs()
      if (this.providerConfigs.length > 0) {
        this.selectProvider(this.providerConfigs[0])
      }
    },

    selectProvider(cfg) {
      this.editingId = cfg.id
      this.form = JSON.parse(JSON.stringify(cfg))
      this.testResult = null
      this.saved = false
    },

    addNewProvider() {
      const defaultPreset = this.providerPresets[1] // DeepSeek
      const newCfg = {
        id: nextId(),
        providerId: defaultPreset.id,
        label: defaultPreset.label,
        baseUrl: defaultPreset.baseUrl,
        apiKey: '',
        models: getDefaultModels(defaultPreset.id),
        activeModelId: defaultPreset.models[0]?.id || '',
      }
      this.editingId = newCfg.id
      this.form = JSON.parse(JSON.stringify(newCfg))
      this.testResult = null
      this.saved = false
    },

    onProviderChange() {
      const preset = this.providerPresets.find(p => p.id === this.form.providerId)
      if (preset) {
        this.form.baseUrl = preset.baseUrl || this.form.baseUrl
        this.form.label = preset.label
        if (preset.local) {
          // 本地服务：清空模型列表，等待检测
          this.form.models = []
          this.form.apiKey = ''
          this.form.activeModelId = ''
        } else if (preset.id !== 'custom') {
          this.form.models = getDefaultModels(preset.id)
          this.form.activeModelId = preset.models[0]?.id || ''
        }
      }
      this.testResult = null
      this.detectResult = null
      this.saved = false
    },

    removeModel(idx) {
      this.form.models.splice(idx, 1)
    },

    addCustomModel() {
      if (!this.newModel.id) return
      this.form.models.push({
        id: this.newModel.id,
        label: this.newModel.label || this.newModel.id,
        capabilities: {
          multimodal: this.newModel.multimodal,
          deepThinking: this.newModel.deepThinking,
        },
        contextLength: this.newModel.contextLength || 32768,
        custom: true,
      })
      this.newModel = { id: '', label: '', multimodal: false, deepThinking: false, contextLength: 32768 }
      this.showAddModel = false
    },

    async doTest() {
      if (!this.form.models.length) return
      this.testing = true
      this.testResult = null
      try {
        const config = getResolvedConfig(this.form, this.form.models[0].id)
        this.testResult = await testLlmConnection(config)
      } catch (e) {
        this.testResult = { success: false, message: String(e) }
      }
      this.testing = false
    },

    async doDetect() {
      if (!this.form.baseUrl) return
      this.detecting = true
      this.detectResult = null
      try {
        const result = await detectModels(this.form)
        this.detectResult = result
        if (result.success && result.models.length > 0) {
          this.form.models = result.models
          this.form.activeModelId = result.models[0].id
        }
      } catch (e) {
        this.detectResult = { success: false, message: String(e) }
      }
      this.detecting = false
    },

    async save() {
      if (!this.form.label) {
        const preset = this.providerPresets.find(p => p.id === this.form.providerId)
        this.form.label = preset ? preset.label : this.form.providerId
      }
      if (!this.form.activeModelId && this.form.models.length > 0) {
        this.form.activeModelId = this.form.models[0].id
      }
      await upsertProviderConfig(this.form)
      this.providerConfigs = await loadProviderConfigs()
      this.editingId = this.form.id
      this.saved = true
      this.showToast('配置已保存', 'success')
      setTimeout(() => { this.saved = false }, 3000)
    },

    async removeProvider(cfg) {
      await deleteProviderConfig(cfg.id)
      this.providerConfigs = await loadProviderConfigs()
      if (this.editingId === cfg.id) {
        if (this.providerConfigs.length > 0) {
          this.selectProvider(this.providerConfigs[0])
        } else {
          this.form = null
          this.editingId = null
        }
      }
      this.showToast('配置已删除', 'success')
    },

    formatCtx(n) {
      if (!n) return '-'
      if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
      if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
      return String(n)
    },
  },
}
</script>

<style scoped>
.ai-edit-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px;
}

.ai-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-muted);
  font-size: 13px;
}

/* 新增按钮 */
.ai-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 8px;
  margin-bottom: 6px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.ai-add-btn:hover {
  border-color: var(--primary-400);
  color: var(--primary-500);
  background: var(--bg-secondary);
}

/* 配置列表 */
.ai-cfg-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-cfg-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid transparent;
  gap: 4px;
}
.ai-cfg-item:hover {
  background: var(--bg-secondary);
}
.ai-cfg-item.active {
  background: var(--primary-50, rgba(99,102,241,0.08));
  border-color: var(--primary-300, rgba(99,102,241,0.3));
}

.ai-cfg-item-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.ai-cfg-item-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ai-cfg-item-model {
  font-size: 10px;
  color: var(--text-muted);
}

.ai-cfg-item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.ai-cfg-act-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}
.ai-cfg-act-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.ai-cfg-del:hover {
  color: var(--danger-500);
}

.ai-empty-hint {
  text-align: center;
  padding: 20px 8px;
  font-size: 12px;
  color: var(--text-muted);
}

/* 表单 hint */
.form-label-hint {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 11px;
  margin-left: 4px;
}

.ai-saved-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--success-500);
}

/* 模型表格 */
.ai-model-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.ai-model-table th {
  padding: 8px 12px;
  text-align: left;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  font-size: 11px;
}
.ai-model-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}
.ai-model-table tbody tr:hover {
  background: var(--bg-hover);
}
.model-id-cell {
  font-family: 'Consolas', monospace;
  font-size: 11px;
  color: var(--text-secondary);
}

/* 能力标签 */
.cap-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
  margin-right: 3px;
}
.cap-multimodal {
  background: rgba(99,102,241,0.15);
  color: var(--primary-400);
}
.cap-thinking {
  background: rgba(234,179,8,0.15);
  color: var(--warning-500);
}
.cap-text {
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.cap-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}
.cap-check input {
  accent-color: var(--primary-500);
}

/* 自定义模型弹窗 */
.ai-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.ai-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.ai-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.ai-modal-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ai-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}
</style>
