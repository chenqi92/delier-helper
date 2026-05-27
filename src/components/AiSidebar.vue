<template>
  <div class="ai-sidebar">
    <!-- 面板（在 Tab 左侧，IDEA 风格） -->
    <div :class="['ai-sidebar-panel', { open: !!activeTab }]">
      <!-- 日志面板 -->
      <div v-show="activeTab === 'logs'" class="ai-sidebar-content">
        <div class="ai-sidebar-panel-header">
          <span><ClipboardList :size="14" style="vertical-align:-2px;margin-right:4px;" /> 实时日志</span>
          <button class="chat-clear-btn" @click="clearLogs" title="清空日志和用量统计">
            <Trash2 :size="12" />
          </button>
        </div>
        <div v-if="tokenUsage.calls > 0" class="ai-token-usage-bar" title="本次会话累计 Token 用量（关闭应用后清零）">
          <span>本次会话 · {{ tokenUsage.calls }} 次调用</span>
          <span>· 输入 {{ formatTokens(tokenUsage.promptTokens) }}</span>
          <span>· 输出 {{ formatTokens(tokenUsage.completionTokens) }}</span>
          <span>· 合计 {{ formatTokens(tokenUsage.totalTokens) }}</span>
        </div>
        <div class="ai-sidebar-log-list" ref="logListRef">
          <div v-if="logs.length === 0" class="ai-sidebar-empty">
            <ClipboardList :size="28" style="opacity:0.3;" />
            <p>暂无日志，AI 补充时将在此显示进度</p>
          </div>
          <div v-for="(log, i) in logs" :key="i" :class="['ai-log-item', 'ai-log-' + log.level]">
            <span class="ai-log-time">{{ log.time }}</span>
            <span>{{ log.msg }}</span>
          </div>
        </div>
      </div>

      <!-- 对话面板 -->
      <div v-show="activeTab === 'chat'" class="ai-sidebar-content">
        <div class="ai-sidebar-panel-header">
          <span><MessageCircle :size="14" style="vertical-align:-2px;margin-right:4px;" /> AI 对话</span>
          <div style="display:flex;gap:4px;">
            <button class="chat-clear-btn" @click="newConversation" title="新建对话">
              <Plus :size="12" />
            </button>
            <button :class="['chat-clear-btn', { active: showConvList }]" @click="showConvList = !showConvList" :title="showConvList ? '关闭列表' : '对话历史'">
              <History :size="12" />
            </button>
          </div>
        </div>
        <!-- 对话列表 -->
        <div v-if="showConvList" class="chat-conv-list">
          <div class="chat-conv-list-header" v-if="conversations.length > 0">
            <span class="chat-conv-count">{{ conversations.length }} 条对话</span>
            <button class="chat-conv-clear-all" @click="clearAllConversations" title="清空全部">
              <Trash2 :size="10" /> 清空
            </button>
          </div>
          <div v-if="conversations.length === 0" class="chat-conv-empty">暂无历史对话</div>
          <div
            v-for="conv in conversations" :key="conv.id"
            :class="['chat-conv-item', { active: conv.id === currentConversationId }]"
            @click="switchConversation(conv.id)"
          >
            <div class="chat-conv-info">
              <span class="chat-conv-title">{{ conv.title }}</span>
              <span class="chat-conv-time">{{ formatTime(conv.updatedAt) }}</span>
            </div>
            <button class="chat-conv-del" @click.stop="deleteConv(conv.id)" title="删除">
              <X :size="10" />
            </button>
          </div>
        </div>
        <div class="chat-messages" ref="chatMessagesRef">
          <div v-if="chatMessages.length === 0" class="chat-empty">
            <Bot :size="28" style="opacity:0.3;" />
            <p>选择模型后开始对话</p>
          </div>
          <div v-for="(msg, i) in chatMessages" :key="i" :class="['chat-msg', msg.role]">
            <div v-if="msg.role === 'user'" class="chat-msg-bubble user">
              <!-- 用户图片 -->
              <div v-if="msg.images && msg.images.length" class="chat-user-images">
                <img v-for="(img, j) in msg.images" :key="j" :src="img" class="chat-user-img" @click="previewImage(img)" />
              </div>
              {{ msg.content }}
            </div>
            <div v-else class="chat-msg-bubble assistant">
              <details v-if="msg.thinking" class="chat-thinking-block">
                <summary><Brain :size="12" /> 思考过程</summary>
                <div class="chat-thinking-content" v-html="renderMd(msg.thinking)"></div>
              </details>
              <div class="chat-md-content" v-html="renderMd(msg.content)"></div>
            </div>
          </div>
          <div v-if="chatLoading" class="chat-msg assistant">
            <div class="chat-msg-bubble assistant chat-loading">
              <span class="chat-dot-pulse"></span> 正在思考...
            </div>
          </div>
        </div>
        <!-- 模型选择 -->
        <div class="chat-model-bar">
          <select class="chat-model-select" v-model="selectedProviderId" @change="onProviderSelect" title="选择厂商">
            <option :value="null" disabled>厂商...</option>
            <option v-for="p in globalStore.providerConfigs" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
          <select class="chat-model-select" v-model="selectedModelId" :title="selectedModelId || '选择模型'">
            <option :value="null" disabled>模型...</option>
            <option v-for="m in currentProviderModels" :key="m.id" :value="m.id">{{ m.id }}</option>
          </select>
        </div>
        <!-- 图片预览条 -->
        <div v-if="chatImages.length > 0" class="chat-image-preview-bar">
          <div v-for="(img, i) in chatImages" :key="i" class="chat-image-thumb-wrap">
            <img :src="img" class="chat-image-thumb" />
            <button class="chat-image-remove" @click="chatImages.splice(i, 1)" title="移除">
              <X :size="10" />
            </button>
          </div>
        </div>
        <div class="chat-input-area">
          <button class="chat-attach-btn" @click="pickImage" :disabled="chatLoading" title="添加图片">
            <ImagePlus :size="16" />
          </button>
          <textarea ref="chatInputRef" class="chat-input" v-model="chatInput"
            placeholder="输入消息... (Enter 发送)" rows="1"
            @keydown="onChatKeydown" @input="autoResizeChat" :disabled="chatLoading"
            @paste="onPaste"
          ></textarea>
          <button class="chat-send-btn" @click="sendChat"
            :disabled="(!chatInput.trim() && chatImages.length === 0) || chatLoading" title="发送">
            <Send :size="16" />
          </button>
        </div>
        <input type="file" ref="imageInputRef" accept="image/*" multiple style="display:none;" @change="onImageSelected" />
      </div>
    </div>

    <!-- 纵向标签按钮（始终最右侧，IDEA 风格） -->
    <div class="ai-sidebar-tabs">
      <button
        :class="['ai-sidebar-tab', { active: activeTab === 'logs' }]"
        @click="toggleTab('logs')"
        title="实时日志"
      >
        <ClipboardList :size="16" />
        <span class="ai-sidebar-tab-label">日志</span>
      </button>
      <button
        :class="['ai-sidebar-tab', { active: activeTab === 'chat' }]"
        @click="toggleTab('chat')"
        title="AI 对话"
      >
        <MessageCircle :size="16" />
        <span class="ai-sidebar-tab-label">对话</span>
      </button>
    </div>
  </div>
</template>

<script>
import { ClipboardList, MessageCircle, Bot, Send, Brain, Trash2, ImagePlus, X, Plus, History } from 'lucide-vue-next'
import { invoke } from '@tauri-apps/api/core'
import { getResolvedConfig } from '../core/llm/llm-service.js'
import {
  createConversation, getConversations, getMessages,
  addMessage, updateConversationTitle, deleteConversation,
  generateTitle
} from '../core/db.js'
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

export default {
  name: 'AiSidebar',
  components: { ClipboardList, MessageCircle, Bot, Send, Brain, Trash2, ImagePlus, X, Plus, History },
  inject: ['globalStore', 'showToast'],
  data() {
    return {
      activeTab: null,
      logs: [],
      selectedProviderId: null,
      selectedModelId: null,
      chatMessages: [],
      chatInput: '',
      chatLoading: false,
      chatImages: [],
      conversations: [],
      currentConversationId: null,
      showConvList: false,
      tokenUsage: { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }
  },
  mounted() {
    this._logHandler = (e) => {
      this.logs.push(e.detail)
      if (this.activeTab === 'logs') {
        this.$nextTick(() => {
          const el = this.$refs.logListRef
          if (el) el.scrollTop = el.scrollHeight
        })
      }
    }
    window.addEventListener('ai-log', this._logHandler)

    this._aiStartHandler = () => {
      this.activeTab = 'logs'
    }
    window.addEventListener('ai-fill-start', this._aiStartHandler)

    this._usageHandler = (e) => {
      const u = e.detail || {}
      this.tokenUsage.calls += 1
      this.tokenUsage.promptTokens += (u.promptTokens || 0)
      this.tokenUsage.completionTokens += (u.completionTokens || 0)
      this.tokenUsage.totalTokens += (u.totalTokens || 0)
    }
    window.addEventListener('llm-usage', this._usageHandler)

    // 初始化时从全局 store 同步选中状态
    this.syncSelectionFromStore()

    // 监听 globalStore 变化（provider 配置可能延迟加载）
    this.$watch(
      () => this.globalStore.providerConfigs,
      () => { if (!this.selectedProviderId) this.syncSelectionFromStore() },
      { deep: true }
    )

    // 预加载对话列表
    this.loadConversations()
  },
  beforeUnmount() {
    if (this._logHandler) window.removeEventListener('ai-log', this._logHandler)
    if (this._aiStartHandler) window.removeEventListener('ai-fill-start', this._aiStartHandler)
    if (this._usageHandler) window.removeEventListener('llm-usage', this._usageHandler)
  },
  computed: {
    currentProviderModels() {
      const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      return p ? p.models : []
    },
    currentModelMultimodal() {
      const m = this.currentProviderModels.find(m => m.id === this.selectedModelId)
      return m?.capabilities?.multimodal || false
    },
    currentModelDeepThinking() {
      const m = this.currentProviderModels.find(m => m.id === this.selectedModelId)
      return m?.capabilities?.deepThinking || false
    },
  },
  methods: {
    formatTokens(n) {
      if (!n) return '0'
      if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
      return String(n)
    },
    clearLogs() {
      this.logs = []
      this.tokenUsage = { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    },
    toggleTab(tab) {
      this.activeTab = this.activeTab === tab ? null : tab
      if (tab === 'chat') {
        if (!this.selectedProviderId) this.syncSelectionFromStore()
        this.loadConversations()
      }
    },
    onProviderSelect() {
      const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (p && p.models.length > 0) {
        this.selectedModelId = p.activeModelId || p.models[0].id
      } else {
        this.selectedModelId = null
      }
    },
    syncSelectionFromStore() {
      if (this.globalStore.providerConfigs.length > 0 && !this.selectedProviderId) {
        this.selectedProviderId = this.globalStore.activeProviderId || this.globalStore.providerConfigs[0].id
        const p = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
        this.selectedModelId = this.globalStore.activeModelId || p?.activeModelId || (p?.models[0]?.id || '')
      }
    },
    renderMd(text) {
      if (!text) return ''
      try { return marked.parse(text) }
      catch { return text.replace(/</g, '&lt;').replace(/\n/g, '<br>') }
    },
    autoResizeChat() {
      const el = this.$refs.chatInputRef
      if (!el) return
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    },
    onChatKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChat() }
    },
    scrollChatBottom() {
      this.$nextTick(() => { const el = this.$refs.chatMessagesRef; if (el) el.scrollTop = el.scrollHeight })
    },

    // ========= 时间格式化 =========
    formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
      const isYesterday = d.toDateString() === yesterday.toDateString()
      const hm = d.toTimeString().slice(0, 5)
      if (isToday) return hm
      if (isYesterday) return `昨天 ${hm}`
      return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
    },

    // ========= 图片相关 =========
    pickImage() {
      this.$refs.imageInputRef?.click()
    },
    onImageSelected(e) {
      const files = Array.from(e.target.files || [])
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        this.readFileAsDataUrl(file)
      }
      e.target.value = ''
    },
    onPaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) this.readFileAsDataUrl(file)
        }
      }
    },
    readFileAsDataUrl(file) {
      const maxDim = 1024
      const quality = 0.7
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim }
          else { w = Math.round(w * maxDim / h); h = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        if (this.chatImages.length < 5) {
          this.chatImages.push(dataUrl)
        }
      }
      img.onerror = () => URL.revokeObjectURL(url)
      img.src = url
    },
    previewImage(src) {
      window.open(src, '_blank')
    },

    // ========= 发送消息 =========
    async sendChat() {
      const text = this.chatInput.trim()
      const images = [...this.chatImages]
      if (!text && images.length === 0) return
      if (this.chatLoading) return

      // 自动选择模型（如果还没选）
      if (!this.selectedProviderId || !this.selectedModelId) {
        this.syncSelectionFromStore()
      }
      if (!this.selectedProviderId) {
        this.showToast('请先在「AI 设置」中配置模型', 'warning')
        return
      }
      if (!this.selectedModelId) {
        this.showToast('请选择模型', 'warning')
        return
      }

      const provider = this.globalStore.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (!provider) {
        this.showToast('未找到厂商配置，请重新选择', 'warning')
        return
      }
      const config = getResolvedConfig(provider, this.selectedModelId)
      if (!config) {
        this.showToast('模型配置异常', 'warning')
        return
      }

      // 如果没有当前对话，自动创建
      if (!this.currentConversationId) {
        try {
          const conv = await createConversation(this.selectedProviderId, this.selectedModelId)
          this.currentConversationId = conv.id
          this.conversations.unshift(conv)
        } catch (e) {
          console.error('创建对话失败:', e)
          this.showToast('创建对话失败: ' + String(e), 'error')
          return
        }
      }

      this.chatMessages.push({ role: 'user', content: text, images: images.length > 0 ? images : undefined })
      await addMessage(this.currentConversationId, 'user', text, null, images.length > 0 ? images : null)

      // 第一条消息自动生成标题
      const isFirst = this.chatMessages.filter(m => m.role === 'user').length === 1
      if (isFirst) {
        const title = generateTitle(text)
        await updateConversationTitle(this.currentConversationId, title)
        const conv = this.conversations.find(c => c.id === this.currentConversationId)
        if (conv) conv.title = title
      }

      this.chatInput = ''
      this.chatImages = []
      this.$nextTick(() => { if (this.$refs.chatInputRef) this.$refs.chatInputRef.style.height = 'auto' })
      this.scrollChatBottom()
      this.chatLoading = true
      try {
        const msgs = this.buildApiMessages()
        const result = await this.callChatLlm(config, msgs)
        const assistantMsg = { role: 'assistant', content: result.content || '', thinking: result.thinking || null }
        this.chatMessages.push(assistantMsg)
        await addMessage(this.currentConversationId, 'assistant', assistantMsg.content, assistantMsg.thinking)
      } catch (err) {
        console.error('对话请求失败:', err)
        const errStr = typeof err === 'string' ? err : (err?.message || String(err))
        const errContent = `**错误**：${errStr}`
        this.chatMessages.push({ role: 'assistant', content: errContent })
        try { await addMessage(this.currentConversationId, 'assistant', errContent) } catch {}
        this.showToast('请求失败: ' + errStr, 'error')
      } finally {
        this.chatLoading = false
        this.scrollChatBottom()
      }
    },

    buildApiMessages() {
      return this.chatMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => {
          if (m.role === 'user' && m.images && m.images.length > 0) {
            const content = []
            for (const img of m.images) {
              const match = img.match(/^data:(image\/\w+);base64,(.+)$/)
              if (match) {
                content.push({
                  type: 'image_url',
                  image_url: { url: img }
                })
              }
            }
            if (m.content) {
              content.push({ type: 'text', text: m.content })
            }
            return { role: 'user', content }
          }
          return { role: m.role, content: m.content }
        })
    },

    async callChatLlm(config, messages) {
      const { baseUrl, apiKey, model, providerId } = config
      const base = baseUrl.replace(/\/+$/, '')
      const isGemini = providerId === 'gemini' || base.includes('generativelanguage.googleapis.com')

      const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'))

      const reqBody = {
        model,
        messages,
        temperature: 0.7,
        max_tokens: hasImages ? 4096 : 8192,
        stream: false,
      }

      if (this.currentModelDeepThinking) {
        if (providerId === 'openai' && (model.startsWith('o') || model.includes('/o'))) {
          reqBody.reasoning_effort = 'high'
        } else {
          reqBody.enable_thinking = true
        }
      }

      const result = await invoke('llm_request', { req: { url: `${base}/chat/completions`, apiKey, body: JSON.stringify(reqBody), isGemini } })

      if (!result.success) {
        let errMsg = `API 错误 (${result.status})`
        if (result.error) {
          try {
            const errBody = JSON.parse(result.error.replace(/^HTTP \d+: /, ''))
            errMsg = errBody.error?.message || errBody.error || errMsg
          } catch {
            errMsg = result.error
          }
        }
        if (result.status === 503) errMsg += '\n\n💡 503 通常表示模型正在加载或显存不足。'
        throw new Error(errMsg)
      }
      if (!result.body || !result.body.trim()) throw new Error('返回空响应')
      const data = JSON.parse(result.body)
      if (!data.choices || data.choices.length === 0) throw new Error('返回空结果')
      const msg = data.choices[0].message || {}
      return { content: msg.content || msg.reasoning_content || msg.text || '', thinking: msg.reasoning_content || msg.thinking || null }
    },

    // ========= 对话历史 =========
    async loadConversations() {
      try {
        this.conversations = await getConversations()
      } catch (e) {
        console.warn('加载对话列表失败:', e)
      }
    },
    newConversation() {
      this.currentConversationId = null
      this.chatMessages = []
      this.chatImages = []
      this.showConvList = false
    },
    async switchConversation(id) {
      this.currentConversationId = id
      this.showConvList = false
      try {
        const msgs = await getMessages(id)
        this.chatMessages = msgs.map(m => ({
          role: m.role,
          content: m.content,
          thinking: m.thinking || null,
          images: m.images,
        }))
        this.$nextTick(() => this.scrollChatBottom())
      } catch (e) {
        console.error('加载对话失败:', e)
        this.showToast('加载对话失败: ' + String(e), 'error')
      }
    },
    async deleteConv(id) {
      try {
        await deleteConversation(id)
        this.conversations = this.conversations.filter(c => c.id !== id)
        if (this.currentConversationId === id) {
          this.currentConversationId = null
          this.chatMessages = []
        }
      } catch (e) {
        console.error('删除对话失败:', e)
        this.showToast('删除失败: ' + String(e), 'error')
      }
    },
    async clearAllConversations() {
      if (this.conversations.length === 0) return
      try {
        for (const conv of this.conversations) {
          await deleteConversation(conv.id)
        }
        this.conversations = []
        this.currentConversationId = null
        this.chatMessages = []
        this.showToast('已清空全部对话', 'success')
      } catch (e) {
        console.error('清空失败:', e)
        this.showToast('清空失败: ' + String(e), 'error')
        this.loadConversations()
      }
    },
  },
}
</script>

<style scoped>
.ai-token-usage-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
}
.ai-token-usage-bar > span:first-child {
  color: var(--text-primary);
  font-weight: 500;
}

/* 图片预览条 */
.chat-image-preview-bar {
  display: flex;
  gap: 6px;
  padding: 6px 10px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-wrap: wrap;
}
.chat-image-thumb-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}
.chat-image-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.chat-image-remove {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--danger-500);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.chat-image-thumb-wrap:hover .chat-image-remove {
  opacity: 1;
}

/* 附件按钮 */
.chat-attach-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.chat-attach-btn:hover:not(:disabled) {
  border-color: var(--primary-400);
  color: var(--primary-400);
}
.chat-attach-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 用户消息中的图片 */
.chat-user-images {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.chat-user-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.2);
  transition: transform 0.15s;
}
.chat-user-img:hover {
  transform: scale(1.05);
}

/* 对话历史列表 */
.chat-conv-list {
  max-height: 280px;
  overflow-y: auto;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}
.chat-conv-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}
.chat-conv-count {
  font-size: 10px;
  color: var(--text-muted);
}
.chat-conv-clear-all {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s;
}
.chat-conv-clear-all:hover {
  color: var(--danger-500);
  background: rgba(239, 68, 68, 0.08);
}
.chat-conv-empty {
  padding: 12px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
}
.chat-conv-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 2px solid transparent;
  gap: 6px;
}
.chat-conv-item:hover {
  background: var(--bg-tertiary);
}
.chat-conv-item.active {
  background: rgba(99, 102, 241, 0.08);
  border-left-color: var(--primary-400);
}
.chat-conv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.chat-conv-title {
  font-size: 11px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chat-conv-time {
  font-size: 9px;
  color: var(--text-muted);
}
.chat-conv-del {
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}
.chat-conv-item:hover .chat-conv-del {
  opacity: 1;
}
.chat-conv-del:hover {
  color: var(--danger-500);
  background: var(--bg-secondary);
}

/* 历史按钮高亮状态 */
.chat-clear-btn.active {
  color: var(--primary-400);
  background: rgba(99, 102, 241, 0.1);
}
</style>
