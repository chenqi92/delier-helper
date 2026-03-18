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
                v-for="(cfg, idx) in globalStore.providerConfigs"
                :key="cfg.id"
                :class="['ai-cfg-item', { active: editingId === cfg.id, 'drag-over': providerDragOver === idx }]"
                @click="selectProvider(cfg)"
                draggable="true"
                @dragstart="onProviderDragStart(idx, $event)"
                @dragover.prevent="onProviderDragOver(idx)"
                @dragleave="providerDragOver = -1"
                @drop.prevent="onProviderDrop(idx)"
                @dragend="providerDragOver = -1"
              >
                <GripVertical :size="12" class="drag-handle" />
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

            <div v-if="globalStore.providerConfigs.length === 0" class="ai-empty-hint">
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
                    <th style="width:4%;"></th>
                    <th style="width:28%;">模型 ID</th>
                    <th style="width:18%;">显示名</th>
                    <th style="width:22%;">能力</th>
                    <th style="width:18%;">上下文长度</th>
                    <th style="width:10%;"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(m, idx) in form.models" :key="m.id"
                    :class="{ 'drag-over-row': modelDragOver === idx }"
                    draggable="true"
                    @dragstart="onModelDragStart(idx, $event)"
                    @dragover.prevent="onModelDragOver(idx)"
                    @dragleave="modelDragOver = -1"
                    @drop.prevent="onModelDrop(idx)"
                    @dragend="modelDragOver = -1"
                  >
                    <td style="cursor:grab;text-align:center;"><GripVertical :size="12" style="opacity:0.4;" /></td>
                    <td class="model-id-cell">
                      {{ m.id }}
                      <span v-if="idx === 0" class="default-model-tag">默认</span>
                    </td>
                    <td>{{ m.label }}</td>
                    <td>
                      <span v-if="m.capabilities?.multimodal" class="cap-tag cap-multimodal">多模态</span>
                      <span v-if="m.capabilities?.deepThinking" class="cap-tag cap-thinking">深度思考</span>
                      <span v-if="m.capabilities?.codeGen" class="cap-tag cap-code">代码</span>
                      <span v-if="m.capabilities?.webSearch" class="cap-tag cap-search">联网</span>
                      <span v-if="m.capabilities?.functionCall" class="cap-tag cap-func">函数调用</span>
                      <span v-if="m.capabilities?.longContext" class="cap-tag cap-long">长文本</span>
                      <span v-if="!m.capabilities?.multimodal && !m.capabilities?.deepThinking && !m.capabilities?.codeGen && !m.capabilities?.webSearch && !m.capabilities?.functionCall && !m.capabilities?.longContext" class="cap-tag cap-text">文本</span>
                    </td>
                    <td>{{ formatCtx(m.contextLength) }}</td>
                    <td>
                      <div style="display:flex;gap:2px;align-items:center;">
                        <button
                          class="ai-cfg-act-btn"
                          :class="{ 'ai-cfg-ok': m._testOk === true, 'ai-cfg-fail': m._testOk === false }"
                          @click="testSingleModel(idx)"
                          :disabled="m._testing"
                          :title="m._testOk === true ? '测试成功' : m._testOk === false ? '测试失败: ' + (m._testMsg || '') : '测试连接'"
                        >
                          <Wifi v-if="!m._testing" :size="12" />
                          <span v-else style="font-size:10px;">...</span>
                        </button>
                        <button class="ai-cfg-act-btn" @click="editModel(idx)" title="编辑">
                          <Edit3 :size="12" />
                        </button>
                        <button class="ai-cfg-act-btn ai-cfg-del" @click="removeModel(idx)" title="移除">
                          <X :size="12" />
                        </button>
                      </div>
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
                  <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <label class="cap-check"><input type="checkbox" v-model="newModel.multimodal" /> 多模态</label>
                    <label class="cap-check"><input type="checkbox" v-model="newModel.deepThinking" /> 深度思考</label>
                    <label class="cap-check"><input type="checkbox" v-model="newModel.codeGen" /> 代码生成</label>
                    <label class="cap-check"><input type="checkbox" v-model="newModel.webSearch" /> 联网搜索</label>
                    <label class="cap-check"><input type="checkbox" v-model="newModel.functionCall" /> 函数调用</label>
                    <label class="cap-check"><input type="checkbox" v-model="newModel.longContext" /> 长文本</label>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">上下文长度 (K)</label>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <input type="number" class="form-input" style="flex:1;" v-model.number="newModel.contextLengthK" placeholder="32" />
                    <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">= {{ (newModel.contextLengthK || 0) * 1024 }} tokens</span>
                  </div>
                </div>
              </div>
              <div class="ai-modal-footer">
                <button class="btn btn-secondary btn-sm" @click="showAddModel = false">取消</button>
                <button class="btn btn-primary btn-sm" @click="addCustomModel" :disabled="!newModel.id">添加</button>
              </div>
            </div>
          </div>
        </div>

          <!-- 编辑模型弹窗 -->
          <div v-if="editingModelIdx !== null" class="ai-modal-mask" @click.self="editingModelIdx = null">
            <div class="ai-modal">
              <div class="ai-modal-header">
                <span>编辑模型：{{ editModelForm.id }}</span>
                <button class="ai-cfg-act-btn" @click="editingModelIdx = null"><X :size="14" /></button>
              </div>
              <div class="ai-modal-body">
                <div class="form-group">
                  <label class="form-label">显示名称</label>
                  <input type="text" class="form-input" v-model="editModelForm.label" />
                </div>
                <div class="form-group">
                  <label class="form-label">能力标签</label>
                  <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <label class="cap-check"><input type="checkbox" v-model="editModelForm.multimodal" /> 多模态</label>
                    <label class="cap-check"><input type="checkbox" v-model="editModelForm.deepThinking" /> 深度思考</label>
                    <label class="cap-check"><input type="checkbox" v-model="editModelForm.codeGen" /> 代码生成</label>
                    <label class="cap-check"><input type="checkbox" v-model="editModelForm.webSearch" /> 联网搜索</label>
                    <label class="cap-check"><input type="checkbox" v-model="editModelForm.functionCall" /> 函数调用</label>
                    <label class="cap-check"><input type="checkbox" v-model="editModelForm.longContext" /> 长文本</label>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">上下文长度 (K)</label>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <input type="number" class="form-input" style="flex:1;" v-model.number="editModelForm.contextLengthK" />
                    <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">= {{ (editModelForm.contextLengthK || 0) * 1024 }} tokens</span>
                  </div>
                </div>
              </div>
              <div class="ai-modal-footer">
                <button class="btn btn-secondary btn-sm" @click="editingModelIdx = null">取消</button>
                <button class="btn btn-primary btn-sm" @click="saveEditModel">保存</button>
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
  Plus, Trash2, X, Layers, Search, Lightbulb, Edit3, GripVertical
} from 'lucide-vue-next'
import {
  LLM_PROVIDERS, loadProviderConfigs, upsertProviderConfig,
  deleteProviderConfig, testLlmConnection, getDefaultModels,
  getResolvedConfig, nextId, detectModels
} from '../core/llm/llm-service.js'
import { refreshProviderConfigs } from '../core/global-store.js'

export default {
  name: 'AiSettings',
  components: { Bot, Settings, Check, Eye, EyeOff, Wifi, Save, Plus, Trash2, X, Layers, Search, Lightbulb, Edit3, GripVertical },
  inject: ['showToast', 'globalStore'],
  data() {
    return {
      providerPresets: LLM_PROVIDERS,
      editingId: null,
      form: null,
      showKey: false,
      testing: false,
      testResult: null,
      detecting: false,
      detectResult: null,
      saved: false,
      showAddModel: false,
      newModel: { id: '', label: '', multimodal: false, deepThinking: false, codeGen: false, webSearch: false, functionCall: false, longContext: false, contextLengthK: 32 },
      editingModelIdx: null,
      editModelForm: { id: '', label: '', multimodal: false, deepThinking: false, codeGen: false, webSearch: false, functionCall: false, longContext: false, contextLengthK: 32 },
      // 拖拽排序状态
      providerDragIdx: -1,
      providerDragOver: -1,
      modelDragIdx: -1,
      modelDragOver: -1,
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
      await refreshProviderConfigs()
      if (this.globalStore.providerConfigs.length > 0) {
        this.selectProvider(this.globalStore.providerConfigs[0])
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
          codeGen: this.newModel.codeGen,
          webSearch: this.newModel.webSearch,
          functionCall: this.newModel.functionCall,
          longContext: this.newModel.longContext,
        },
        contextLength: (this.newModel.contextLengthK || 32) * 1024,
        custom: true,
      })
      this.newModel = { id: '', label: '', multimodal: false, deepThinking: false, codeGen: false, webSearch: false, functionCall: false, longContext: false, contextLengthK: 32 }
      this.showAddModel = false
    },

    editModel(idx) {
      const m = this.form.models[idx]
      this.editingModelIdx = idx
      this.editModelForm = {
        id: m.id,
        label: m.label || m.id,
        multimodal: !!m.capabilities?.multimodal,
        deepThinking: !!m.capabilities?.deepThinking,
        codeGen: !!m.capabilities?.codeGen,
        webSearch: !!m.capabilities?.webSearch,
        functionCall: !!m.capabilities?.functionCall,
        longContext: !!m.capabilities?.longContext,
        contextLengthK: Math.round((m.contextLength || 32768) / 1024),
      }
    },
    saveEditModel() {
      const idx = this.editingModelIdx
      if (idx === null || idx < 0 || idx >= this.form.models.length) return
      const f = this.editModelForm
      this.form.models[idx] = {
        ...this.form.models[idx],
        label: f.label || f.id,
        capabilities: {
          multimodal: f.multimodal,
          deepThinking: f.deepThinking,
          codeGen: f.codeGen,
          webSearch: f.webSearch,
          functionCall: f.functionCall,
          longContext: f.longContext,
        },
        contextLength: (f.contextLengthK || 32) * 1024,
      }
      this.editingModelIdx = null
    },

    async testSingleModel(idx) {
      const m = this.form.models[idx]
      if (!m || m._testing) return
      // Vue 2/3 reactivity: use $set or spread to add reactive properties
      this.form.models.splice(idx, 1, { ...m, _testing: true, _testOk: null, _testMsg: '' })
      try {
        const config = getResolvedConfig(this.form, m.id)
        const result = await testLlmConnection(config)
        const updated = { ...this.form.models[idx], _testing: false, _testOk: result.success, _testMsg: result.message || '' }
        this.form.models.splice(idx, 1, updated)
      } catch (e) {
        const updated = { ...this.form.models[idx], _testing: false, _testOk: false, _testMsg: String(e) }
        this.form.models.splice(idx, 1, updated)
      }
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

    async save(silent = false) {
      if (!this.form.label) {
        const preset = this.providerPresets.find(p => p.id === this.form.providerId)
        this.form.label = preset ? preset.label : this.form.providerId
      }
      if (!this.form.activeModelId && this.form.models.length > 0) {
        this.form.activeModelId = this.form.models[0].id
      }
      await upsertProviderConfig(this.form)
      await refreshProviderConfigs()
      this.editingId = this.form.id
      if (!silent) {
        this.saved = true
        this.showToast('配置已保存', 'success')
        setTimeout(() => { this.saved = false }, 3000)
      }
    },

    async removeProvider(cfg) {
      await deleteProviderConfig(cfg.id)
      await refreshProviderConfigs()
      if (this.editingId === cfg.id) {
        if (this.globalStore.providerConfigs.length > 0) {
          this.selectProvider(this.globalStore.providerConfigs[0])
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

    // ===== 厂商拖拽排序 =====
    onProviderDragStart(idx, e) {
      this.providerDragIdx = idx
      e.dataTransfer.effectAllowed = 'move'
    },
    onProviderDragOver(idx) {
      if (this.providerDragIdx === idx) return
      this.providerDragOver = idx
    },
    async onProviderDrop(targetIdx) {
      this.providerDragOver = -1
      const fromIdx = this.providerDragIdx
      if (fromIdx < 0 || fromIdx === targetIdx) return
      const arr = [...this.globalStore.providerConfigs]
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(targetIdx, 0, moved)
      this.globalStore.providerConfigs = arr
      // 持久化顺序
      for (let i = 0; i < arr.length; i++) {
        arr[i].sortOrder = i
        await upsertProviderConfig(arr[i])
      }
    },

    // ===== 模型拖拽排序 =====
    onModelDragStart(idx, e) {
      this.modelDragIdx = idx
      e.dataTransfer.effectAllowed = 'move'
    },
    onModelDragOver(idx) {
      if (this.modelDragIdx === idx) return
      this.modelDragOver = idx
    },
    async onModelDrop(targetIdx) {
      this.modelDragOver = -1
      const fromIdx = this.modelDragIdx
      if (fromIdx < 0 || fromIdx === targetIdx) return
      const [moved] = this.form.models.splice(fromIdx, 1)
      this.form.models.splice(targetIdx, 0, moved)
      // 第一个模型自动成为默认
      this.form.activeModelId = this.form.models[0]?.id || ''
      // 自动保存排序结果
      await this.save(true)
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
.ai-cfg-ok {
  color: #22c55e !important;
}
.ai-cfg-fail {
  color: var(--danger-500) !important;
}
.ai-cfg-act-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
.cap-code {
  background: rgba(16,185,129,0.15);
  color: #059669;
}
.cap-search {
  background: rgba(59,130,246,0.15);
  color: #2563eb;
}
.cap-func {
  background: rgba(168,85,247,0.15);
  color: #7c3aed;
}
.cap-long {
  background: rgba(244,63,94,0.15);
  color: #e11d48;
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

/* 拖拽排序 */
.drag-handle {
  opacity: 0.3;
  cursor: grab;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.ai-cfg-item:hover .drag-handle {
  opacity: 0.7;
}
.ai-cfg-item.drag-over {
  border-color: var(--primary-400) !important;
  background: rgba(99, 102, 241, 0.12);
}
.drag-over-row {
  outline: 2px solid var(--primary-400);
  outline-offset: -2px;
  background: rgba(99, 102, 241, 0.08) !important;
}
.ai-model-table tbody tr {
  cursor: grab;
}
.ai-model-table tbody tr:active {
  cursor: grabbing;
}

/* 默认模型标签 */
.default-model-tag {
  display: inline-block;
  padding: 0 5px;
  margin-left: 6px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 600;
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  vertical-align: 1px;
}
</style>
