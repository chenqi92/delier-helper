<template>
  <div style="display:flex;flex-direction:column;height:100%;">
    <GuideTour
      :steps="guideSteps"
      :enabled="guideVisible"
      :conditions="guideConditions"
      @finish="guideVisible = false"
    />
    <!-- 头部操作栏 -->
    <div class="view-header">
      <div class="header-actions">
        <span style="font-size:12px;color:var(--text-secondary);">配置大模型 API 用于智能补充文档占位符</span>
      </div>
    </div>

    <!-- 主体 -->
    <div class="app-body">
      <!-- 左侧：已保存的配置列表 -->
      <aside class="config-panel">
        <div class="card">
          <div class="card-header">
            <h3><Bot :size="14" /> 模型配置</h3>
          </div>
          <div class="card-body" style="padding:6px;">
            <button class="ai-add-btn" @click="addNewConfig" data-guide="ai-add">
              <Plus :size="14" /> 新增配置
            </button>

            <div class="ai-cfg-list">
              <div
                v-for="cfg in configs"
                :key="cfg.id"
                :class="['ai-cfg-item', { active: editingId === cfg.id, 'is-active-cfg': activeId === cfg.id }]"
                @click="selectConfig(cfg)"
              >
                <div class="ai-cfg-item-main">
                  <span class="ai-cfg-item-name">{{ cfg.name || '未命名' }}</span>
                  <span class="ai-cfg-item-model">{{ cfg.model }}</span>
                </div>
                <div class="ai-cfg-item-actions">
                  <button
                    v-if="activeId !== cfg.id"
                    class="ai-cfg-act-btn"
                    title="设为默认"
                    @click.stop="setDefault(cfg)"
                  ><Star :size="12" /></button>
                  <Star v-else :size="12" class="ai-cfg-star-active" />
                  <button class="ai-cfg-act-btn ai-cfg-del" title="删除" @click.stop="removeConfig(cfg)">
                    <Trash2 :size="12" />
                  </button>
                </div>
              </div>
            </div>

            <div v-if="configs.length === 0" class="ai-empty-hint">
              暂无配置，点击上方按钮新增
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧：配置编辑区 -->
      <main class="content-panel">
        <div v-if="form" class="ai-edit-area">
          <!-- 配置名称 -->
          <div class="card">
            <div class="card-header">
              <h3><Settings :size="14" /> {{ form.name || '新配置' }}</h3>
              <span v-if="saved" class="ai-saved-badge"><Check :size="12" /> 已保存</span>
            </div>
            <div class="card-body" style="display:flex;flex-direction:column;gap:14px;">
              <!-- 配置名称 -->
              <div class="form-group">
                <label class="form-label">配置名称</label>
                <input type="text" class="form-input" v-model="form.name" placeholder="例如：DeepSeek 日常使用" />
              </div>

              <!-- 提供商 -->
              <div class="form-group">
                <label class="form-label">模型提供商</label>
                <select class="form-input" v-model="form.providerId" @change="onProviderChange">
                  <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.label }}</option>
                </select>
              </div>

              <!-- API 地址 -->
              <div class="form-group">
                <label class="form-label">
                  API 地址 (Base URL)
                  <span v-if="form.providerId !== 'custom'" class="form-label-hint">(已预填，可修改)</span>
                </label>
                <input type="text" class="form-input" v-model="form.baseUrl"
                       placeholder="https://api.example.com/v1" />
              </div>

              <!-- API Key -->
              <div class="form-group" data-guide="ai-apikey">
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

              <!-- 模型名称 -->
              <div class="form-group">
                <label class="form-label">
                  模型名称
                  <span class="form-label-hint">(可直接输入任意模型名)</span>
                </label>
                <input type="text" class="form-input"
                       v-model="form.model"
                       :placeholder="modelSuggestions.length > 0 ? modelSuggestions[0] : '输入模型名称'"
                       list="model-suggestions" />
                <datalist id="model-suggestions">
                  <option v-for="m in modelSuggestions" :key="m" :value="m" />
                </datalist>
                <div v-if="modelSuggestions.length > 0" class="ai-model-tags">
                  <span
                    v-for="m in modelSuggestions"
                    :key="m"
                    :class="['ai-model-tag', { active: form.model === m }]"
                    @click="form.model = m"
                  >{{ m }}</span>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;">
                <button class="btn btn-secondary btn-sm" @click="doTest" :disabled="testing || !isFormValid">
                  <span v-if="testing" class="spinner" style="width:12px;height:12px;"></span>
                  <Wifi v-else :size="14" />
                  {{ testing ? '测试中...' : '测试连接' }}
                </button>
                <button class="btn btn-primary btn-sm" @click="save" :disabled="!isFormValid" data-guide="ai-save">
                  <Save :size="14" /> 保存配置
                </button>
                <span v-if="testResult" :style="{ fontSize: '12px', color: testResult.success ? 'var(--success-500)' : 'var(--danger-500)' }">
                  {{ testResult.message }}
                </span>
              </div>
            </div>
          </div>

          <!-- 使用说明 -->
          <div class="card">
            <div class="card-header">
              <h3><Lightbulb :size="14" /> 使用说明</h3>
            </div>
            <div class="card-body">
              <div class="ai-help-list">
                <div class="ai-help-item">
                  <span class="ai-help-step">1</span>
                  <span>新增配置 → 选择提供商 → 填入 API Key 和模型名称 → 保存</span>
                </div>
                <div class="ai-help-item">
                  <span class="ai-help-step">2</span>
                  <span>点击 <Star :size="11" style="vertical-align:middle;color:var(--warning-400);" /> 将常用配置设为默认（AI 补充时优先使用）</span>
                </div>
                <div class="ai-help-item">
                  <span class="ai-help-step">3</span>
                  <span>可保存多个配置，在「接口文档」或「数据库文档」点击 AI 补充时可选择使用哪个</span>
                </div>
              </div>
              <div class="tip" style="margin-top:12px;">
                <Lightbulb :size="14" class="tip-icon" />
                <span>所有模型均使用 OpenAI 兼容协议，支持 Ollama、vLLM、LM Studio 等本地部署。模型名称可自由填写。配置保存后重启不会丢失。</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 未选择任何配置时的空状态 -->
        <div v-else class="ai-edit-area ai-empty-state">
          <Bot :size="48" style="color:var(--text-muted);" />
          <p>选择左侧已有配置进行编辑，或点击「新增配置」</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
import {
  Bot, Settings, Check, Eye, EyeOff, Wifi, Save, Lightbulb,
  Plus, Trash2, Star
} from 'lucide-vue-next'
import {
  LLM_PROVIDERS, loadAllConfigs, loadActiveConfigId, setActiveConfigId,
  upsertConfig, deleteConfig, testLlmConnection, generateConfigName, nextId
} from '../core/llm/llm-service.js'
import GuideTour from '../components/GuideTour.vue'

export default {
  name: 'AiSettings',
  components: { GuideTour, Bot, Settings, Check, Eye, EyeOff, Wifi, Save, Lightbulb, Plus, Trash2, Star },
  inject: ['showToast'],
  data() {
    return {
      providers: LLM_PROVIDERS,
      configs: [],
      activeId: null,
      editingId: null,
      form: null,
      showKey: false,
      testing: false,
      testResult: null,
      saved: false,
      guideVisible: true,
      guideSteps: [
        { target: 'ai-add', text: '点击新增配置，添加一个 AI 模型配置', doneWhen: 'hasForm' },
        { target: 'ai-apikey', text: '填写模型提供商的 API Key', doneWhen: 'hasKey' },
        { target: 'ai-save', text: '点击保存配置，即可在其他页面使用 AI 补充', doneWhen: 'hasSaved' },
      ],
    }
  },
  computed: {
    currentProvider() {
      if (!this.form) return null
      return this.providers.find(p => p.id === this.form.providerId)
    },
    modelSuggestions() {
      return this.currentProvider ? this.currentProvider.models : []
    },
    isFormValid() {
      return this.form && this.form.baseUrl && this.form.apiKey && this.form.model
    },
    guideConditions() {
      return {
        hasForm: !!this.form,
        hasKey: !!(this.form && this.form.apiKey),
        hasSaved: this.configs.length > 0,
      }
    },
  },
  async mounted() {
    await this.loadData()
    this.guideVisible = localStorage.getItem('guideEnabled') !== 'false'
    this._guideHandler = (e) => { this.guideVisible = e.detail }
    window.addEventListener('guide-toggle', this._guideHandler)
  },
  beforeUnmount() {
    if (this._guideHandler) window.removeEventListener('guide-toggle', this._guideHandler)
  },
  methods: {
    async loadData() {
      this.configs = await loadAllConfigs()
      this.activeId = await loadActiveConfigId()
      // 自动选中激活配置或第一个
      if (this.configs.length > 0) {
        const target = this.configs.find(c => c.id === this.activeId) || this.configs[0]
        this.selectConfig(target)
      }
    },

    selectConfig(cfg) {
      this.editingId = cfg.id
      this.form = { ...cfg }
      this.testResult = null
      this.saved = false
    },

    addNewConfig() {
      const defaultProvider = this.providers[1] // DeepSeek
      const newCfg = {
        id: nextId(),
        name: '',
        providerId: defaultProvider.id,
        baseUrl: defaultProvider.baseUrl,
        apiKey: '',
        model: defaultProvider.models[0] || '',
      }
      this.editingId = newCfg.id
      this.form = { ...newCfg }
      this.testResult = null
      this.saved = false
    },

    onProviderChange() {
      const provider = this.currentProvider
      if (provider && provider.id !== 'custom') {
        this.form.baseUrl = provider.baseUrl
        if (provider.models.length > 0 && !provider.models.includes(this.form.model)) {
          this.form.model = provider.models[0]
        }
      }
      this.testResult = null
      this.saved = false
    },

    async doTest() {
      this.testing = true
      this.testResult = null
      try {
        this.testResult = await testLlmConnection(this.form)
      } catch (e) {
        this.testResult = { success: false, message: String(e) }
      }
      this.testing = false
    },

    async save() {
      if (!this.form.name) {
        this.form.name = generateConfigName(this.form)
      }
      const saved = await upsertConfig(this.form)
      this.configs = await loadAllConfigs()

      // 如果是第一个配置或没有激活配置，自动设为默认
      if (!this.activeId || this.configs.length === 1) {
        this.activeId = saved.id
        await setActiveConfigId(saved.id)
      }

      this.editingId = saved.id
      this.saved = true
      this.showToast('配置已保存', 'success')
      setTimeout(() => { this.saved = false }, 3000)
    },

    async setDefault(cfg) {
      this.activeId = cfg.id
      await setActiveConfigId(cfg.id)
      this.showToast(`已将「${cfg.name || cfg.model}」设为默认模型`, 'success')
    },

    async removeConfig(cfg) {
      this.configs = await deleteConfig(cfg.id)
      this.activeId = await loadActiveConfigId()
      if (this.editingId === cfg.id) {
        if (this.configs.length > 0) {
          this.selectConfig(this.configs[0])
        } else {
          this.form = null
          this.editingId = null
        }
      }
      this.showToast('配置已删除', 'success')
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
.ai-cfg-star-active {
  color: var(--warning-400);
  fill: var(--warning-400);
}

.ai-empty-hint {
  text-align: center;
  padding: 20px 8px;
  font-size: 12px;
  color: var(--text-muted);
}

/* 活跃配置左侧高亮条 */
.ai-cfg-item.is-active-cfg {
  border-left: 3px solid var(--warning-400);
  padding-left: 7px;
}

/* 表单 hint */
.form-label-hint {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 11px;
  margin-left: 4px;
}

/* 模型标签 */
.ai-model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.ai-model-tag {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: all 0.15s;
}
.ai-model-tag:hover {
  border-color: var(--primary-400);
  color: var(--primary-500);
}
.ai-model-tag.active {
  background: var(--primary-500);
  color: #fff;
  border-color: var(--primary-600);
}

.ai-saved-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--success-500);
}

.ai-help-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-help-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary);
}
.ai-help-step {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-500);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
</style>
