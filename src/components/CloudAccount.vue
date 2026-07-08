<template>
  <!-- 左侧导航底部：账号入口 -->
  <button
    class="left-nav-item cloud-nav-item"
    :class="{ active: panelOpen || authModalOpen }"
    @click="onEntryClick"
    :title="isLoggedIn ? (cloudAccount.user.nickname || '云端账号') : '登录云端账号'"
  >
    <span v-if="isLoggedIn && avatarText" class="cloud-avatar">{{ avatarText }}</span>
    <User v-else :size="18" />
    <span class="left-nav-label">{{ isLoggedIn ? creditsShort : '登录' }}</span>
  </button>

  <!-- 账号面板（已登录）：锚定导航底部的浮层 -->
  <div v-if="panelOpen" class="cloud-pop-mask" @click.self="panelOpen = false">
    <div class="cloud-pop-card">
      <div class="cloud-pop-head">
        <span class="cloud-avatar cloud-avatar-lg">{{ avatarText || '云' }}</span>
        <div class="cloud-pop-id">
          <div class="cloud-pop-name">{{ cloudAccount?.user?.nickname || '云端用户' }}</div>
          <div class="cloud-pop-sub">
            <span v-if="cloudAccount?.user?.level" class="cloud-level-badge">{{ levelLabel }}</span>
            <span class="cloud-pop-host">{{ serviceHost }}</span>
          </div>
        </div>
        <button class="cloud-icon-btn" title="关闭" @click="panelOpen = false"><X :size="14" /></button>
      </div>

      <div class="cloud-credit-card">
        <div class="cloud-credit-top">
          <span class="cloud-credit-label">剩余额度</span>
          <span v-if="creditPct !== null" class="cloud-credit-frac">
            {{ formatCredits(cloudAccount.user.creditBalance) }} / {{ formatCredits(creditTotal) }}
          </span>
        </div>
        <div class="cloud-credit-value">{{ formatCredits(cloudAccount?.user?.creditBalance) }}</div>
        <div v-if="creditPct !== null" class="cloud-credit-bar">
          <div class="cloud-credit-bar-fill" :style="{ width: creditPct + '%' }"></div>
        </div>
      </div>

      <div class="cloud-pop-actions">
        <button class="btn btn-secondary btn-sm" @click="doCloudCheckin" :disabled="cloudCheckingIn">
          <Gift :size="14" /> {{ cloudCheckingIn ? '签到中...' : '每日签到' }}
        </button>
        <button class="btn btn-secondary btn-sm" @click="syncCloudModels" :disabled="cloudSyncing">
          <RefreshCw :size="14" :class="{ spin: cloudSyncing }" /> {{ cloudSyncing ? '同步中...' : '刷新模型' }}
        </button>
      </div>

      <div v-if="cloudAccount?.expiresAt" class="cloud-pop-meta">
        <span>登录令牌 {{ formatExpire(cloudAccount.expiresAt) }}过期，将自动续期</span>
      </div>

      <div v-if="cloudStatus" class="cloud-status" :class="cloudStatusType">{{ cloudStatus }}</div>

      <div class="cloud-pop-footer">
        <button class="btn btn-secondary btn-sm" @click="openWebConsole">
          <ExternalLink :size="14" /> 网页控制台
        </button>
        <button class="btn btn-secondary btn-sm cloud-logout" @click="doCloudLogout">
          <LogOut :size="14" /> 退出登录
        </button>
      </div>
    </div>
  </div>

  <!-- 登录 / 注册弹框（未登录） -->
  <div v-if="authModalOpen" class="cloud-modal-mask" @click.self="closeAuthModal">
    <div class="cloud-modal">
      <div class="cloud-modal-head">
        <span><Cloud :size="15" /> 云端账号</span>
        <button class="cloud-icon-btn" @click="closeAuthModal"><X :size="15" /></button>
      </div>
      <div class="cloud-modal-body">
        <div class="cloud-auth-heading">{{ authMode === 'login' ? '欢迎回来' : '创建云端账号' }}</div>
        <div class="cloud-auth-sub">
          {{ authMode === 'login' ? '登录以使用服务端统一调度的模型与额度' : '注册需验证邮箱，模型与额度由服务端统一管理' }}
        </div>

        <!-- 分段：登录 / 注册（替代 tab 切换） -->
        <div class="cloud-seg">
          <span class="cloud-seg-thumb" :class="authMode"></span>
          <button :class="{ active: authMode === 'login' }" @click="switchAuthMode('login')">登录</button>
          <button :class="{ active: authMode === 'register' }" @click="switchAuthMode('register')">注册</button>
        </div>

        <div class="cloud-auth-fields">
          <!-- 登录 -->
          <template v-if="authMode === 'login'">
            <div class="cloud-field">
              <label class="cloud-field-label">{{ loginMethod === 'email' ? '邮箱' : '账号 / 邮箱' }}</label>
              <input
                :type="loginMethod === 'email' ? 'email' : 'text'"
                class="form-input"
                v-model.trim="loginAccount"
                :placeholder="loginMethod === 'email' ? '邮箱地址' : '账号或邮箱'"
                autocomplete="username"
                @keyup.enter="submitLogin"
              />
            </div>

            <div v-if="loginMethod === 'password'" class="cloud-field">
              <div class="cloud-field-row">
                <label class="cloud-field-label">密码</label>
                <span class="cloud-field-link" @click="onForgotPassword">忘记密码？</span>
              </div>
              <input
                type="password"
                class="form-input"
                v-model="loginPassword"
                placeholder="密码，至少 8 位"
                autocomplete="current-password"
                @keyup.enter="submitLogin"
              />
            </div>

            <div v-else class="cloud-field">
              <label class="cloud-field-label">邮箱验证码</label>
              <div class="cloud-code-row">
                <input
                  type="text"
                  class="form-input"
                  v-model.trim="emailCode"
                  placeholder="6 位验证码"
                  inputmode="numeric"
                  maxlength="6"
                  autocomplete="one-time-code"
                  @keyup.enter="submitLogin"
                />
                <button class="btn btn-secondary btn-sm" @click="sendCode" :disabled="sendCodeDisabled">
                  {{ codeBtnLabel }}
                </button>
              </div>
            </div>
          </template>

          <!-- 注册（邮箱 + 邮箱验证码 + 密码，昵称可选） -->
          <template v-else>
            <div class="cloud-field">
              <label class="cloud-field-label">邮箱</label>
              <input
                type="email"
                class="form-input"
                v-model.trim="regEmail"
                placeholder="邮箱地址"
                autocomplete="email"
                @keyup.enter="submitRegister"
              />
            </div>
            <div class="cloud-field">
              <label class="cloud-field-label">邮箱验证码</label>
              <div class="cloud-code-row">
                <input
                  type="text"
                  class="form-input"
                  v-model.trim="emailCode"
                  placeholder="6 位验证码"
                  inputmode="numeric"
                  maxlength="6"
                  autocomplete="one-time-code"
                  @keyup.enter="submitRegister"
                />
                <button class="btn btn-secondary btn-sm" @click="sendCode" :disabled="sendCodeDisabled">
                  {{ codeBtnLabel }}
                </button>
              </div>
            </div>
            <div class="cloud-field">
              <label class="cloud-field-label">密码</label>
              <input
                type="password"
                class="form-input"
                v-model="regPassword"
                placeholder="密码，至少 8 位"
                autocomplete="new-password"
                @keyup.enter="submitRegister"
              />
            </div>
            <div class="cloud-field">
              <label class="cloud-field-label">昵称 <span class="cloud-field-opt">（可选）</span></label>
              <input
                type="text"
                class="form-input"
                v-model.trim="regNickname"
                placeholder="怎么称呼你"
                autocomplete="nickname"
                @keyup.enter="submitRegister"
              />
            </div>
          </template>
        </div>

        <!-- Cloudflare Turnstile 人机验证（防止刷账号；未配置 sitekey 时自动隐藏） -->
        <div v-show="turnstileSiteKey" class="cloud-captcha-slot">
          <div ref="turnstile" class="cloud-turnstile"></div>
        </div>

        <button
          class="btn btn-primary cloud-submit"
          @click="authMode === 'login' ? submitLogin() : submitRegister()"
          :disabled="submitting || !submitValid"
        >
          <LogIn v-if="authMode === 'login'" :size="15" />
          <UserPlus v-else :size="15" />
          {{ submitButtonLabel }}
        </button>

        <div v-if="authMode === 'login'" class="cloud-method-switch">
          <span class="cloud-hr"></span>
          <span class="cloud-method-link" @click="toggleLoginMethod">
            {{ loginMethod === 'password' ? '使用邮箱验证码登录' : '使用密码登录' }}
          </span>
          <span class="cloud-hr"></span>
        </div>

        <div v-if="cloudStatus" class="cloud-status" :class="cloudStatusType">{{ cloudStatus }}</div>
        <div class="tip cloud-modal-tip">
          <Lightbulb :size="14" class="tip-icon" />
          <span>服务端统一调度模型与额度，客户端不保存上游模型 API Key。</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { User, Cloud, LogIn, LogOut, Gift, ExternalLink, RefreshCw, UserPlus, X, Lightbulb } from 'lucide-vue-next'
import { openUrl } from '@tauri-apps/plugin-opener'
import QRCode from 'qrcode'
import {
  checkinCloudAccount, createCloudLoginSession, fetchCloudConfig, loadCloudAccount,
  loginCloudEmailCode, loginCloudAccount, logoutCloudAccount,
  normalizeCloudServiceUrl, pollCloudLoginSession, registerCloudAccount,
  sendCloudEmailCode, syncCloudProvider,
} from '../core/llm/llm-service.js'
import { refreshProviderConfigs } from '../core/global-store.js'

// 内置服务地址：不展示、不可修改，统一走独立额度制中转网关
const CLOUD_SERVICE_URL = 'https://soft.yzs.ai'
// 暂时隐藏微信扫码登录（相关方法保留，后续需要时改回 true 并接回 UI）
// eslint-disable-next-line no-unused-vars
const SHOW_WECHAT = false
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_RE = /^\d{6}$/
const CODE_COOLDOWN_STORAGE_PREFIX = 'ranzhu-cloud-email-code-next-send-at'

const LEVEL_LABELS = { 0: '免费版', 1: '基础版', 2: '专业版', 3: '旗舰版' }

let turnstileScriptPromise = null
function loadTurnstileScript() {
  if (typeof window !== 'undefined' && window.turnstile) return Promise.resolve()
  if (turnstileScriptPromise) return turnstileScriptPromise
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = TURNSTILE_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => { turnstileScriptPromise = null; reject(new Error('Turnstile 脚本加载失败')) }
    document.head.appendChild(s)
  })
  return turnstileScriptPromise
}

export default {
  name: 'CloudAccount',
  components: { User, Cloud, LogIn, LogOut, Gift, ExternalLink, RefreshCw, UserPlus, X, Lightbulb },
  inject: ['showToast'],
  data() {
    return {
      panelOpen: false,
      authModalOpen: false,
      cloudAccount: null,

      // 认证表单
      authMode: 'login',         // 'login' | 'register'
      loginMethod: 'password',   // 'password' | 'email'
      loginAccount: '',
      loginPassword: '',
      regEmail: '',
      regPassword: '',
      regNickname: '',
      emailCode: '',

      // 人机验证（Cloudflare Turnstile）
      turnstileSiteKey: '',
      turnstileWidgetId: null,
      captchaToken: '',

      // 交互状态
      codeSending: false,
      codeCooldown: 0,
      codeCooldownTimer: null,
      submitting: false,
      cloudStatus: '',
      cloudStatusType: 'info',

      // 账号面板
      cloudSyncing: false,
      cloudCheckingIn: false,

      // 微信扫码（暂时隐藏，逻辑保留）
      cloudLoginSession: null,
      cloudQrDataUrl: '',
      cloudLoggingIn: false,
      cloudPollTimer: null,
    }
  },
  computed: {
    isLoggedIn() {
      return !!this.cloudAccount?.user
    },
    avatarText() {
      const n = (this.cloudAccount?.user?.nickname || '').trim()
      return n ? n.charAt(0).toUpperCase() : ''
    },
    creditsShort() {
      if (!this.cloudAccount?.user) return '登录'
      return this.formatCredits(this.cloudAccount.user.creditBalance)
    },
    levelLabel() {
      const lv = this.cloudAccount?.user?.level
      if (lv == null) return ''
      return LEVEL_LABELS[lv] || `Lv.${lv}`
    },
    serviceHost() {
      const raw = normalizeCloudServiceUrl(this.cloudAccount?.serviceUrl || CLOUD_SERVICE_URL)
      try {
        return new URL(raw).host
      } catch {
        return raw
      }
    },
    creditTotal() {
      const u = this.cloudAccount?.user || {}
      return u.creditTotal ?? u.creditQuota ?? null
    },
    creditPct() {
      const total = this.creditTotal
      const bal = this.cloudAccount?.user?.creditBalance
      if (total == null || total <= 0 || bal == null) return null
      return Math.max(0, Math.min(100, Math.round((bal / total) * 100)))
    },

    // ----- 认证校验 -----
    currentEmail() {
      return (this.authMode === 'register' ? this.regEmail : this.loginAccount || '').trim()
    },
    currentEmailValid() {
      return EMAIL_RE.test(this.currentEmail)
    },
    codeValid() {
      return CODE_RE.test((this.emailCode || '').trim())
    },
    captchaReady() {
      // 未配置 sitekey 时降级为不强制人机验证
      return !this.turnstileSiteKey || !!this.captchaToken
    },
    sendCodeDisabled() {
      return this.codeSending || this.codeCooldown > 0 || !this.currentEmailValid || !this.captchaReady
    },
    submitValid() {
      if (!this.captchaReady) return false
      if (this.authMode === 'register') {
        return this.currentEmailValid && this.codeValid && (this.regPassword || '').length >= 8
      }
      if (this.loginMethod === 'password') {
        return (this.loginAccount || '').trim().length >= 3 && (this.loginPassword || '').length >= 8
      }
      return this.currentEmailValid && this.codeValid
    },
    codeBtnLabel() {
      if (this.codeCooldown > 0) return `${this.codeCooldown} 秒后重发`
      return this.codeSending ? '发送中...' : '发送验证码'
    },
    submitButtonLabel() {
      if (this.submitting) return '处理中...'
      return this.authMode === 'register' ? '注册并登录' : '登录'
    },
  },
  watch: {
    currentEmail() {
      this.restoreCooldown()
    },
    authMode() {
      this.$nextTick(() => this.restoreCooldown())
    },
    loginMethod() {
      this.$nextTick(() => this.restoreCooldown())
    },
  },
  async mounted() {
    await this.loadCloudAccountState()
    this.loadTurnstileConfig()
  },
  beforeUnmount() {
    this.stopCloudPolling()
    this.stopCooldown()
    this.unmountTurnstile()
  },
  methods: {
    async loadCloudAccountState() {
      this.cloudAccount = await loadCloudAccount()
    },

    async loadTurnstileConfig() {
      try {
        const cfg = await fetchCloudConfig(CLOUD_SERVICE_URL)
        this.turnstileSiteKey = cfg.turnstileSiteKey || cfg.turnstile_site_key || ''
        if (this.authModalOpen) this.$nextTick(() => this.mountTurnstile())
      } catch {
        // 忽略：降级为不强制人机验证
      }
    },

    setStatus(msg, type = 'info') {
      this.cloudStatus = msg
      this.cloudStatusType = type
    },

    onEntryClick() {
      if (this.isLoggedIn) {
        this.panelOpen = !this.panelOpen
        if (this.panelOpen) this.loadCloudAccountState()
      } else {
        this.openAuthModal()
      }
    },

    openAuthModal() {
      this.panelOpen = false
      this.authModalOpen = true
      this.resetAuthState()
      this.$nextTick(() => this.mountTurnstile())
    },

    closeAuthModal() {
      this.authModalOpen = false
      this.stopCooldown()
      this.unmountTurnstile()
      this.loginPassword = ''
      this.regPassword = ''
      this.emailCode = ''
      // 微信扫码清理（隐藏时不会触发，仍保证状态干净）
      this.stopCloudPolling()
      this.cloudLoggingIn = false
      this.cloudLoginSession = null
      this.cloudQrDataUrl = ''
    },

    resetAuthState() {
      this.authMode = 'login'
      this.loginMethod = 'password'
      this.loginAccount = ''
      this.loginPassword = ''
      this.regEmail = ''
      this.regPassword = ''
      this.regNickname = ''
      this.emailCode = ''
      this.captchaToken = ''
      this.cloudStatus = ''
      this.cloudStatusType = 'info'
      this.stopCooldown()
    },

    switchAuthMode(mode) {
      if (this.authMode === mode) return
      this.authMode = mode
      this.emailCode = ''
      this.cloudStatus = ''
      this.cloudStatusType = 'info'
      this.stopCooldown()
      this.$nextTick(() => this.restoreCooldown())
    },

    toggleLoginMethod() {
      this.loginMethod = this.loginMethod === 'password' ? 'email' : 'password'
      this.emailCode = ''
      this.cloudStatus = ''
      this.stopCooldown()
      this.$nextTick(() => this.restoreCooldown())
    },

    async onForgotPassword() {
      // 找回密码在网页控制台完成
      await openUrl(CLOUD_SERVICE_URL)
    },

    // ----- Turnstile -----
    async mountTurnstile() {
      if (!this.turnstileSiteKey || this.turnstileWidgetId != null) return
      const el = this.$refs.turnstile
      if (!el) return
      try {
        await loadTurnstileScript()
        if (!window.turnstile || !this.$refs.turnstile || this.turnstileWidgetId != null) return
        this.turnstileWidgetId = window.turnstile.render(this.$refs.turnstile, {
          sitekey: this.turnstileSiteKey,
          theme: 'auto',
          callback: (token) => { this.captchaToken = token },
          'expired-callback': () => { this.captchaToken = '' },
          'error-callback': () => { this.captchaToken = '' },
        })
      } catch (e) {
        console.warn('Turnstile 加载失败:', e)
      }
    },

    resetTurnstile() {
      this.captchaToken = ''
      if (window.turnstile && this.turnstileWidgetId != null) {
        try { window.turnstile.reset(this.turnstileWidgetId) } catch { /* noop */ }
      }
    },

    unmountTurnstile() {
      if (window.turnstile && this.turnstileWidgetId != null) {
        try { window.turnstile.remove(this.turnstileWidgetId) } catch { /* noop */ }
      }
      this.turnstileWidgetId = null
      this.captchaToken = ''
    },

    // ----- 邮箱验证码 -----
    async sendCode() {
      const email = this.currentEmail
      if (!EMAIL_RE.test(email)) { this.setStatus('请输入有效的邮箱地址', 'error'); return }
      if (!this.captchaReady) { this.setStatus('请先完成人机验证', 'error'); return }
      if (this.codeSending || this.codeCooldown > 0) return
      this.codeSending = true
      this.setStatus('正在发送邮箱验证码...', 'info')
      try {
        const scene = this.authMode === 'register' ? 'register' : 'login'
        const res = await sendCloudEmailCode(CLOUD_SERVICE_URL, email, this.captchaToken, scene)
        if (res && res.debugCode) this.emailCode = res.debugCode
        this.setStatus('验证码已发送，请查收邮箱', 'success')
        this.startCooldown(res?.cooldownSeconds || res?.retryAfter || 60, res?.nextSendAt)
        this.resetTurnstile()
      } catch (e) {
        const msg = e.message || String(e)
        const retry = this.getRetryAfter(e)
        if (retry.seconds > 0 || /cooldown|rate_limited|Too many|429/i.test(msg)) {
          if (retry.seconds > 0) this.startCooldown(retry.seconds, retry.nextSendAt)
          this.setStatus(retry.seconds > 0 ? `验证码发送太频繁，请 ${retry.seconds} 秒后再试` : '验证码发送太频繁，请稍后再试', 'error')
        } else if (/captcha|turnstile/i.test(msg)) {
          this.setStatus('人机验证失败，请重试', 'error')
          this.resetTurnstile()
        } else {
          this.setStatus(`验证码发送失败：${msg}`, 'error')
        }
      } finally {
        this.codeSending = false
      }
    },

    // ----- 登录 -----
    async submitLogin() {
      if (this.submitting || !this.submitValid) return
      this.submitting = true
      this.setStatus('正在登录云端账号...', 'info')
      try {
        const result = this.loginMethod === 'password'
          ? await loginCloudAccount(CLOUD_SERVICE_URL, this.loginAccount, this.loginPassword, this.captchaToken)
          : await loginCloudEmailCode(CLOUD_SERVICE_URL, this.loginAccount, this.emailCode)
        await this.onLoginSuccess(result.account, '云端账号已登录')
      } catch (e) {
        const msg = e.message || String(e)
        if (/Invalid account or password|invalid_login/i.test(msg)) {
          this.setStatus('账号或密码错误', 'error')
        } else if (/Invalid or expired|invalid_email_code/i.test(msg)) {
          this.setStatus('验证码错误或已过期', 'error')
        } else if (/Too many|temporarily_locked|429/i.test(msg)) {
          this.setStatus('尝试次数过多，请稍后再试', 'error')
        } else if (/captcha|turnstile/i.test(msg)) {
          this.setStatus('人机验证失败，请重试', 'error')
        } else {
          this.setStatus(`登录失败：${msg}`, 'error')
        }
        this.resetTurnstile()
      } finally {
        this.submitting = false
      }
    },

    // ----- 注册 -----
    async submitRegister() {
      if (this.submitting || !this.submitValid) return
      this.submitting = true
      this.setStatus('正在注册云端账号...', 'info')
      try {
        const result = await registerCloudAccount(CLOUD_SERVICE_URL, {
          email: this.regEmail,
          code: this.emailCode,
          password: this.regPassword,
          nickname: this.regNickname,
          captchaToken: this.captchaToken,
        })
        await this.onLoginSuccess(result.account, '云端账号已注册并登录')
      } catch (e) {
        const msg = e.message || String(e)
        if (/already exists|account_exists|email_exists/i.test(msg)) {
          this.setStatus('该邮箱已注册，请直接登录', 'error')
        } else if (/Invalid or expired|invalid_email_code/i.test(msg)) {
          this.setStatus('验证码错误或已过期', 'error')
        } else if (/captcha|turnstile/i.test(msg)) {
          this.setStatus('人机验证失败，请重试', 'error')
        } else {
          this.setStatus(`注册失败：${msg}`, 'error')
        }
        this.resetTurnstile()
      } finally {
        this.submitting = false
      }
    },

    async onLoginSuccess(account, toastMsg) {
      this.cloudAccount = account
      this.setStatus('登录成功，正在同步可用模型...', 'success')
      await this.syncCloudModels()
      this.showToast(toastMsg || '云端账号已登录', 'success')
      this.closeAuthModal()
    },

    startCooldown(seconds, nextSendAt = null) {
      const now = Math.floor(Date.now() / 1000)
      const target = Number(nextSendAt) > now ? Number(nextSendAt) : now + Math.max(1, Number(seconds) || 60)
      this.persistCooldown(target)
      this.startCooldownUntil(target)
    },

    startCooldownUntil(nextSendAt) {
      this.stopCooldown()
      const tick = () => {
        this.codeCooldown = Math.max(0, Math.ceil(Number(nextSendAt) - Date.now() / 1000))
        if (this.codeCooldown <= 0) {
          this.clearCooldown()
          this.stopCooldown()
        }
      }
      tick()
      if (this.codeCooldown > 0) this.codeCooldownTimer = setInterval(tick, 1000)
    },

    stopCooldown() {
      if (this.codeCooldownTimer) {
        clearInterval(this.codeCooldownTimer)
        this.codeCooldownTimer = null
      }
      this.codeCooldown = 0
    },

    restoreCooldown() {
      if (!this.isEmailCodeMode()) {
        this.stopCooldown()
        return
      }
      const key = this.cooldownStorageKey()
      if (!key) {
        this.stopCooldown()
        return
      }
      const nextSendAt = Number(localStorage.getItem(key) || 0)
      if (nextSendAt > Math.floor(Date.now() / 1000)) {
        this.startCooldownUntil(nextSendAt)
      } else {
        this.clearCooldown(key)
        this.stopCooldown()
      }
    },

    persistCooldown(nextSendAt) {
      const key = this.cooldownStorageKey()
      if (key) localStorage.setItem(key, String(Math.floor(Number(nextSendAt))))
    },

    clearCooldown(key = this.cooldownStorageKey()) {
      if (key) localStorage.removeItem(key)
    },

    cooldownStorageKey() {
      const email = (this.currentEmail || '').trim().toLowerCase()
      return email ? `${CODE_COOLDOWN_STORAGE_PREFIX}:${email}` : ''
    },

    isEmailCodeMode() {
      return this.authMode === 'register' || this.loginMethod === 'email'
    },

    getRetryAfter(error) {
      const details = error?.details || error?.response?.error?.details || {}
      const now = Math.floor(Date.now() / 1000)
      const nextSendAt = Number(details.nextSendAt || 0)
      if (nextSendAt > now) return { seconds: Math.ceil(nextSendAt - now), nextSendAt }
      const retryAfter = Number(details.retryAfter || 0)
      return retryAfter > 0 ? { seconds: Math.ceil(retryAfter), nextSendAt: now + Math.ceil(retryAfter) } : { seconds: 0, nextSendAt: 0 }
    },

    // ----- 账号面板 -----
    async syncCloudModels() {
      this.cloudSyncing = true
      this.setStatus('正在同步云端模型...', 'info')
      try {
        const provider = await syncCloudProvider(CLOUD_SERVICE_URL)
        await refreshProviderConfigs()
        this.cloudAccount = await loadCloudAccount()
        this.setStatus(`已同步 ${provider.models.length} 个模型`, 'success')
      } catch (e) {
        this.setStatus(`同步失败：${e.message || e}`, 'error')
      } finally {
        this.cloudSyncing = false
      }
    },

    async doCloudCheckin() {
      this.cloudCheckingIn = true
      try {
        const result = await checkinCloudAccount()
        this.cloudAccount = await loadCloudAccount()
        this.setStatus(`签到成功，获得 ${this.formatCredits(result.amount)} 额度`, 'success')
      } catch (e) {
        this.setStatus(e.message?.includes('Already') ? '今天已经签到过了' : `签到失败：${e.message || e}`, 'error')
      } finally {
        this.cloudCheckingIn = false
      }
    },

    async doCloudLogout() {
      await logoutCloudAccount()
      await refreshProviderConfigs()
      this.cloudAccount = null
      this.panelOpen = false
      this.setStatus('', 'info')
      this.showToast('已退出云端账号', 'info')
    },

    async openWebConsole() {
      const base = normalizeCloudServiceUrl(this.cloudAccount?.serviceUrl || CLOUD_SERVICE_URL)
      if (base) await openUrl(base)
    },

    formatCredits(n) {
      if (n == null) return '-'
      if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`
      if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
      return String(n)
    },

    formatExpire(sec) {
      const left = sec - Math.floor(Date.now() / 1000)
      if (left <= 0) return '已'
      if (left < 3600) return `${Math.ceil(left / 60)} 分钟后`
      return `${Math.ceil(left / 3600)} 小时后`
    },

    // ===== 微信扫码登录（暂时隐藏，逻辑保留，SHOW_WECHAT 置 true 可恢复）=====
    async ensureWechatSession(force = false) {
      if (!force && (this.cloudLoginSession || this.cloudLoggingIn)) return
      if (force) {
        this.stopCloudPolling()
        this.cloudLoginSession = null
        this.cloudQrDataUrl = ''
      }
      await this.startCloudLogin()
    },

    async startCloudLogin() {
      this.cloudLoggingIn = true
      this.setStatus('正在创建登录二维码...', 'info')
      try {
        const session = await createCloudLoginSession(CLOUD_SERVICE_URL)
        this.cloudLoginSession = session
        this.cloudQrDataUrl = await QRCode.toDataURL(session.loginUrl, { width: 220, margin: 1 })
        this.setStatus('请使用微信扫码确认登录', 'info')
        this.startCloudPolling()
      } catch (e) {
        this.cloudLoggingIn = false
        this.setStatus(`创建登录失败：${e.message || e}`, 'error')
      }
    },

    startCloudPolling() {
      this.stopCloudPolling()
      this.cloudPollTimer = setInterval(() => {
        this.pollCloudLogin().catch(e => {
          this.setStatus(`登录轮询失败：${e.message || e}`, 'error')
          this.stopCloudPolling()
          this.cloudLoggingIn = false
        })
      }, 1800)
    },

    stopCloudPolling() {
      if (this.cloudPollTimer) {
        clearInterval(this.cloudPollTimer)
        this.cloudPollTimer = null
      }
    },

    async pollCloudLogin() {
      const s = this.cloudLoginSession
      if (!s) return
      const result = await pollCloudLoginSession(CLOUD_SERVICE_URL, s.id, s.pollToken)
      if (result.status === 'pending') return
      if (result.status === 'expired' || result.status === 'consumed') {
        this.setStatus(result.status === 'expired' ? '二维码已过期，请刷新二维码' : '该登录二维码已使用', 'error')
        this.stopCloudPolling()
        this.cloudLoggingIn = false
        return
      }
      if (result.status === 'authenticated') {
        this.stopCloudPolling()
        this.cloudLoggingIn = false
        await this.onLoginSuccess(result.account)
      }
    },

    async openCloudLoginUrl() {
      if (this.cloudLoginSession?.loginUrl) {
        await openUrl(this.cloudLoginSession.loginUrl)
      }
    },
  },
}
</script>

<style scoped>
/* ===== 导航入口 ===== */
.cloud-nav-item {
  cursor: pointer;
}
.cloud-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-600), var(--primary-400));
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
.cloud-avatar-lg {
  width: 38px;
  height: 38px;
  font-size: 17px;
  flex-shrink: 0;
}

/* ===== 账号浮层 ===== */
.cloud-pop-mask {
  position: fixed;
  inset: 0;
  background: transparent;
  z-index: 1200;
}
.cloud-pop-card {
  position: fixed;
  left: 66px;
  bottom: 10px;
  width: 288px;
  background: var(--bg-surface);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cloud-pop-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cloud-pop-id {
  flex: 1;
  min-width: 0;
}
.cloud-pop-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cloud-pop-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
}
.cloud-level-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--primary-400);
}
.cloud-pop-host {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cloud-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.cloud-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 额度卡片 */
.cloud-credit-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(99, 102, 241, 0.04));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 12px;
}
.cloud-credit-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cloud-credit-label {
  font-size: 11px;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}
.cloud-credit-frac {
  font-size: 11px;
  color: var(--text-muted);
}
.cloud-credit-value {
  font-size: 26px;
  font-weight: 700;
  margin-top: 2px;
  background: linear-gradient(135deg, var(--primary-300), var(--primary-500));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.cloud-credit-bar {
  margin-top: 8px;
  height: 6px;
  background: var(--bg-input);
  border-radius: 3px;
  overflow: hidden;
}
.cloud-credit-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-500), var(--primary-300));
  border-radius: 3px;
  transition: width 0.4s ease;
}

.cloud-pop-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.cloud-pop-actions .btn {
  width: 100%;
}
.cloud-pop-meta {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cloud-pop-meta:empty {
  display: none;
}
.cloud-pop-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}
.cloud-pop-footer .btn {
  width: 100%;
}
.cloud-logout:hover {
  color: var(--danger-500) !important;
  border-color: var(--danger-500) !important;
}

/* ===== 登录 / 注册弹框 ===== */
.cloud-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}
.cloud-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  width: 400px;
  max-width: 92vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
.cloud-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.cloud-modal-head span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cloud-modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cloud-modal-tip {
  margin: 0;
}

.cloud-auth-heading {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}
.cloud-auth-sub {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: -8px;
  line-height: 1.5;
}

/* 分段：登录 / 注册 */
.cloud-seg {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}
.cloud-seg button {
  position: relative;
  z-index: 1;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  padding: 8px 4px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.18s;
}
.cloud-seg button.active {
  color: #fff;
}
.cloud-seg-thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc(50% - 4px);
  border-radius: calc(var(--radius-sm) - 2px);
  background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
  transition: left 0.2s ease;
}
.cloud-seg-thumb.register {
  left: 50%;
}

/* 表单字段 */
.cloud-auth-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cloud-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cloud-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cloud-field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.cloud-field-opt {
  font-weight: 400;
  color: var(--text-muted);
}
.cloud-field-link {
  font-size: 12px;
  color: var(--primary-400);
  cursor: pointer;
}
.cloud-field-link:hover {
  text-decoration: underline;
}

.cloud-code-row {
  display: flex;
  gap: 8px;
}
.cloud-code-row .form-input {
  flex: 1;
  min-width: 0;
}
.cloud-code-row .btn {
  white-space: nowrap;
  min-width: 112px;
}

/* Turnstile 人机验证 */
.cloud-captcha-slot {
  display: flex;
  justify-content: center;
  min-height: 66px;
}
.cloud-turnstile {
  min-height: 65px;
}

.cloud-submit {
  width: 100%;
  justify-content: center;
  margin-top: 2px;
}

/* 登录方式切换（密码 / 邮箱验证码） */
.cloud-method-switch {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cloud-hr {
  flex: 1;
  height: 1px;
  background: var(--border-color);
}
.cloud-method-link {
  font-size: 12px;
  color: var(--primary-400);
  cursor: pointer;
  font-weight: 500;
}
.cloud-method-link:hover {
  text-decoration: underline;
}

.cloud-status {
  font-size: 12px;
  color: var(--text-secondary);
}
.cloud-status.success {
  color: var(--success-500);
}
.cloud-status.error {
  color: var(--danger-500);
}

.spin {
  animation: spin 0.8s linear infinite;
}
</style>
