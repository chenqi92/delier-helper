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
        <div class="form-group">
          <label class="form-label">服务地址</label>
          <input
            type="text"
            class="form-input"
            v-model="cloudServiceUrl"
            placeholder="https://你的云端服务域名"
            :disabled="cloudLoggingIn || cloudPasswordBusy || cloudEmailBusy || cloudEmailSending"
          />
        </div>

        <div class="cloud-tabs">
          <button :class="{ active: cloudAuthMode === 'wechat' }" @click="setAuthMode('wechat')">微信扫码</button>
          <button :class="{ active: cloudAuthMode === 'login' }" @click="setAuthMode('login')">账号登录</button>
          <button :class="{ active: cloudAuthMode === 'email' }" @click="setAuthMode('email')">邮箱验证码</button>
          <button :class="{ active: cloudAuthMode === 'register' }" @click="setAuthMode('register')">注册账号</button>
        </div>

        <!-- 微信扫码 -->
        <div v-if="cloudAuthMode === 'wechat'" class="cloud-qr-wrap">
          <img v-if="cloudQrDataUrl" :src="cloudQrDataUrl" class="cloud-qr" alt="微信登录二维码" />
          <div v-else class="cloud-qr cloud-qr-placeholder">
            <span v-if="cloudLoggingIn" class="spinner"></span>
            <span v-else>二维码</span>
          </div>
          <div class="cloud-qr-tip">{{ cloudStatus || '请使用微信扫码确认登录' }}</div>
          <div class="cloud-qr-btns">
            <button class="btn btn-secondary btn-sm" @click="ensureWechatSession(true)" :disabled="cloudLoggingIn">
              <RefreshCw :size="14" /> 刷新二维码
            </button>
            <button class="btn btn-secondary btn-sm" @click="openCloudLoginUrl" :disabled="!cloudLoginSession">
              <ExternalLink :size="14" /> 打开登录页
            </button>
          </div>
        </div>

        <!-- 账号密码登录 / 注册 -->
        <div v-else-if="cloudAuthMode !== 'email'" class="cloud-form">
          <input
            type="text"
            class="form-input"
            v-model.trim="cloudLoginAccount"
            placeholder="账号 / 邮箱"
            autocomplete="username"
            @keyup.enter="doPasswordCloudAuth"
          />
          <input
            type="password"
            class="form-input"
            v-model="cloudLoginPassword"
            placeholder="密码，至少 8 位"
            :autocomplete="cloudAuthMode === 'register' ? 'new-password' : 'current-password'"
            @keyup.enter="doPasswordCloudAuth"
          />
          <input
            v-if="cloudAuthMode === 'register'"
            type="password"
            class="form-input"
            v-model="cloudPasswordConfirm"
            placeholder="确认密码"
            autocomplete="new-password"
            @keyup.enter="doPasswordCloudAuth"
          />
          <input
            v-if="cloudAuthMode === 'register'"
            type="text"
            class="form-input"
            v-model.trim="cloudRegisterNickname"
            placeholder="昵称，可选"
            autocomplete="nickname"
            @keyup.enter="doPasswordCloudAuth"
          />
          <button class="btn btn-primary btn-sm cloud-submit" @click="doPasswordCloudAuth" :disabled="cloudPasswordBusy || !passwordAuthValid">
            <UserPlus v-if="cloudAuthMode === 'register'" :size="14" />
            <LogIn v-else :size="14" />
            {{ cloudPasswordBusy ? '处理中...' : (cloudAuthMode === 'register' ? '注册并登录' : '登录') }}
          </button>
        </div>

        <!-- 邮箱验证码 -->
        <div v-else class="cloud-form">
          <input
            type="email"
            class="form-input"
            v-model.trim="cloudEmail"
            placeholder="邮箱地址"
            autocomplete="email"
            @keyup.enter="doEmailCloudLogin"
          />
          <div class="cloud-code-row">
            <input
              type="text"
              class="form-input"
              v-model.trim="cloudEmailCode"
              placeholder="6 位验证码"
              inputmode="numeric"
              maxlength="6"
              autocomplete="one-time-code"
              @keyup.enter="doEmailCloudLogin"
            />
            <button class="btn btn-secondary btn-sm" @click="sendEmailCode" :disabled="cloudEmailSending || cloudEmailCooldown > 0 || !emailInputValid">
              {{ cloudEmailCooldown > 0 ? `${cloudEmailCooldown}s` : (cloudEmailSending ? '发送中...' : '发送验证码') }}
            </button>
          </div>
          <button class="btn btn-primary btn-sm cloud-submit" @click="doEmailCloudLogin" :disabled="cloudEmailBusy || !emailAuthValid">
            <LogIn :size="14" /> {{ cloudEmailBusy ? '登录中...' : '邮箱登录' }}
          </button>
        </div>

        <div v-if="cloudStatus && cloudAuthMode !== 'wechat'" class="cloud-status" :class="cloudStatusType">{{ cloudStatus }}</div>
        <div class="tip cloud-modal-tip">
          <Lightbulb :size="14" class="tip-icon" />
          <span>通过服务端统一调度模型和额度，客户端不保存上游模型 API Key。</span>
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
  checkinCloudAccount, createCloudLoginSession, loadCloudAccount,
  loginCloudEmailCode, loginCloudAccount, logoutCloudAccount,
  normalizeCloudServiceUrl, pollCloudLoginSession, registerCloudAccount,
  sendCloudEmailCode, syncCloudProvider,
} from '../core/llm/llm-service.js'
import { refreshProviderConfigs } from '../core/global-store.js'

const DEFAULT_CLOUD_SERVICE_URL = 'https://soft.yzs.ai'

const LEVEL_LABELS = { 0: '免费版', 1: '基础版', 2: '专业版', 3: '旗舰版' }

export default {
  name: 'CloudAccount',
  components: { User, Cloud, LogIn, LogOut, Gift, ExternalLink, RefreshCw, UserPlus, X, Lightbulb },
  inject: ['showToast'],
  data() {
    return {
      panelOpen: false,
      authModalOpen: false,
      cloudServiceUrl: DEFAULT_CLOUD_SERVICE_URL,
      cloudAccount: null,
      cloudLoginSession: null,
      cloudQrDataUrl: '',
      cloudLoggingIn: false,
      cloudSyncing: false,
      cloudCheckingIn: false,
      cloudStatus: '',
      cloudStatusType: 'info',
      cloudPollTimer: null,
      cloudAuthMode: 'wechat',
      cloudLoginAccount: '',
      cloudLoginPassword: '',
      cloudRegisterNickname: '',
      cloudPasswordConfirm: '',
      cloudPasswordBusy: false,
      cloudEmail: '',
      cloudEmailCode: '',
      cloudEmailSending: false,
      cloudEmailBusy: false,
      cloudEmailCooldown: 0,
      cloudEmailCooldownTimer: null,
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
      const raw = normalizeCloudServiceUrl(this.cloudAccount?.serviceUrl || this.cloudServiceUrl)
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
    passwordAuthValid() {
      const account = (this.cloudLoginAccount || '').trim()
      const password = this.cloudLoginPassword || ''
      if (!this.cloudServiceUrl || account.length < 3 || password.length < 8) return false
      if (this.cloudAuthMode === 'register' && password !== this.cloudPasswordConfirm) return false
      return true
    },
    emailInputValid() {
      return !!this.cloudServiceUrl && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((this.cloudEmail || '').trim())
    },
    emailAuthValid() {
      return this.emailInputValid && /^\d{6}$/.test((this.cloudEmailCode || '').trim())
    },
  },
  async mounted() {
    await this.loadCloudAccountState()
  },
  beforeUnmount() {
    this.stopCloudPolling()
    this.stopEmailCooldown()
  },
  methods: {
    async loadCloudAccountState() {
      this.cloudAccount = await loadCloudAccount()
      this.cloudServiceUrl = this.cloudAccount?.serviceUrl || DEFAULT_CLOUD_SERVICE_URL
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
      this.cloudStatus = ''
      this.cloudStatusType = 'info'
      this.setAuthMode('wechat')
    },

    closeAuthModal() {
      this.authModalOpen = false
      this.stopCloudPolling()
      this.cloudLoggingIn = false
      this.cloudLoginSession = null
      this.cloudQrDataUrl = ''
      this.cloudLoginPassword = ''
      this.cloudPasswordConfirm = ''
    },

    setAuthMode(mode) {
      if (mode !== 'wechat') {
        this.stopCloudPolling()
        this.cloudLoggingIn = false
      }
      this.cloudStatus = ''
      this.cloudStatusType = 'info'
      this.cloudAuthMode = mode
      if (mode === 'wechat') this.ensureWechatSession()
    },

    async onLoginSuccess(account, toastMsg) {
      this.cloudAccount = account
      this.cloudStatusType = 'success'
      this.cloudStatus = '登录成功，正在同步可用模型...'
      await this.syncCloudModels()
      this.showToast(toastMsg || '云端账号已登录', 'success')
      this.closeAuthModal()
    },

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
      const base = normalizeCloudServiceUrl(this.cloudServiceUrl)
      if (!base) return
      this.cloudServiceUrl = base
      this.cloudLoggingIn = true
      this.cloudStatusType = 'info'
      this.cloudStatus = '正在创建登录二维码...'
      try {
        const session = await createCloudLoginSession(base)
        this.cloudLoginSession = session
        this.cloudQrDataUrl = await QRCode.toDataURL(session.loginUrl, { width: 220, margin: 1 })
        this.cloudStatus = '请使用微信扫码确认登录'
        this.startCloudPolling()
      } catch (e) {
        this.cloudLoggingIn = false
        this.cloudStatusType = 'error'
        this.cloudStatus = `创建登录失败：${e.message || e}`
      }
    },

    startCloudPolling() {
      this.stopCloudPolling()
      this.cloudPollTimer = setInterval(() => {
        this.pollCloudLogin().catch(e => {
          this.cloudStatusType = 'error'
          this.cloudStatus = `登录轮询失败：${e.message || e}`
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
      const result = await pollCloudLoginSession(this.cloudServiceUrl, s.id, s.pollToken)
      if (result.status === 'pending') return
      if (result.status === 'expired' || result.status === 'consumed') {
        this.cloudStatusType = 'error'
        this.cloudStatus = result.status === 'expired' ? '二维码已过期，请刷新二维码' : '该登录二维码已使用'
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

    async doPasswordCloudAuth() {
      if (!this.passwordAuthValid || this.cloudPasswordBusy) return
      const base = normalizeCloudServiceUrl(this.cloudServiceUrl)
      if (!base) return
      this.cloudServiceUrl = base
      this.cloudPasswordBusy = true
      this.cloudStatusType = 'info'
      this.cloudStatus = this.cloudAuthMode === 'register' ? '正在注册云端账号...' : '正在登录云端账号...'
      try {
        const result = this.cloudAuthMode === 'register'
          ? await registerCloudAccount(base, this.cloudLoginAccount, this.cloudLoginPassword, this.cloudRegisterNickname)
          : await loginCloudAccount(base, this.cloudLoginAccount, this.cloudLoginPassword)
        await this.onLoginSuccess(result.account, this.cloudAuthMode === 'register' ? '云端账号已注册并登录' : '云端账号已登录')
      } catch (e) {
        this.cloudStatusType = 'error'
        const msg = e.message || String(e)
        if (/Account already exists|account_exists/.test(msg)) {
          this.cloudStatus = '账号已存在，请切换到账号登录'
        } else if (/Invalid account or password|invalid_login/.test(msg)) {
          this.cloudStatus = '账号或密码错误'
        } else if (/Too many failed|temporarily_locked|429/.test(msg)) {
          this.cloudStatus = '登录失败次数过多，请稍后再试'
        } else {
          this.cloudStatus = `${this.cloudAuthMode === 'register' ? '注册' : '登录'}失败：${msg}`
        }
      } finally {
        this.cloudPasswordBusy = false
      }
    },

    async sendEmailCode() {
      if (!this.emailInputValid || this.cloudEmailSending) return
      const base = normalizeCloudServiceUrl(this.cloudServiceUrl)
      if (!base) return
      this.cloudServiceUrl = base
      this.cloudEmailSending = true
      this.cloudStatusType = 'info'
      this.cloudStatus = '正在发送邮箱验证码...'
      try {
        const result = await sendCloudEmailCode(base, this.cloudEmail)
        if (result.debugCode) this.cloudEmailCode = result.debugCode
        this.cloudStatusType = 'success'
        this.cloudStatus = '验证码已发送，请查收邮箱'
        this.startEmailCooldown(60)
      } catch (e) {
        this.cloudStatusType = 'error'
        const msg = e.message || String(e)
        if (/rate_limited|Too many|429/.test(msg)) {
          this.cloudStatus = '验证码发送太频繁，请稍后再试'
        } else {
          this.cloudStatus = `验证码发送失败：${msg}`
        }
      } finally {
        this.cloudEmailSending = false
      }
    },

    async doEmailCloudLogin() {
      if (!this.emailAuthValid || this.cloudEmailBusy) return
      const base = normalizeCloudServiceUrl(this.cloudServiceUrl)
      if (!base) return
      this.cloudServiceUrl = base
      this.cloudEmailBusy = true
      this.cloudStatusType = 'info'
      this.cloudStatus = '正在验证邮箱验证码...'
      try {
        const result = await loginCloudEmailCode(base, this.cloudEmail, this.cloudEmailCode)
        this.cloudEmailCode = ''
        await this.onLoginSuccess(result.account)
      } catch (e) {
        this.cloudStatusType = 'error'
        const msg = e.message || String(e)
        if (/Invalid or expired|invalid_email_code/.test(msg)) {
          this.cloudStatus = '验证码错误或已过期'
        } else if (/Too many verification|too_many_code_attempts|429/.test(msg)) {
          this.cloudStatus = '验证码尝试次数过多，请重新发送'
        } else {
          this.cloudStatus = `邮箱登录失败：${msg}`
        }
      } finally {
        this.cloudEmailBusy = false
      }
    },

    startEmailCooldown(seconds) {
      this.stopEmailCooldown()
      this.cloudEmailCooldown = seconds
      this.cloudEmailCooldownTimer = setInterval(() => {
        this.cloudEmailCooldown = Math.max(0, this.cloudEmailCooldown - 1)
        if (this.cloudEmailCooldown <= 0) this.stopEmailCooldown()
      }, 1000)
    },

    stopEmailCooldown() {
      if (this.cloudEmailCooldownTimer) {
        clearInterval(this.cloudEmailCooldownTimer)
        this.cloudEmailCooldownTimer = null
      }
      if (this.cloudEmailCooldown < 0) this.cloudEmailCooldown = 0
    },

    async syncCloudModels() {
      this.cloudSyncing = true
      this.cloudStatusType = 'info'
      this.cloudStatus = '正在同步云端模型...'
      try {
        const provider = await syncCloudProvider(this.cloudServiceUrl)
        await refreshProviderConfigs()
        this.cloudAccount = await loadCloudAccount()
        this.cloudStatusType = 'success'
        this.cloudStatus = `已同步 ${provider.models.length} 个模型`
      } catch (e) {
        this.cloudStatusType = 'error'
        this.cloudStatus = `同步失败：${e.message || e}`
      } finally {
        this.cloudSyncing = false
      }
    },

    async doCloudCheckin() {
      this.cloudCheckingIn = true
      try {
        const result = await checkinCloudAccount()
        this.cloudAccount = await loadCloudAccount()
        this.cloudStatusType = 'success'
        this.cloudStatus = `签到成功，获得 ${this.formatCredits(result.amount)} 额度`
      } catch (e) {
        this.cloudStatusType = 'error'
        this.cloudStatus = e.message?.includes('Already') ? '今天已经签到过了' : `签到失败：${e.message || e}`
      } finally {
        this.cloudCheckingIn = false
      }
    },

    async doCloudLogout() {
      await logoutCloudAccount()
      await refreshProviderConfigs()
      this.cloudAccount = null
      this.panelOpen = false
      this.cloudStatusType = 'info'
      this.cloudStatus = ''
      this.showToast('已退出云端账号', 'info')
    },

    async openWebConsole() {
      const base = normalizeCloudServiceUrl(this.cloudAccount?.serviceUrl || this.cloudServiceUrl)
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

/* ===== 登录弹框 ===== */
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
  width: 420px;
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
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cloud-modal-tip {
  margin: 0;
}

.cloud-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-secondary);
}
.cloud-tabs button {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  padding: 7px 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.cloud-tabs button:hover {
  color: var(--text-primary);
}
.cloud-tabs button.active {
  background: var(--primary-500);
  color: #fff;
}

.cloud-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cloud-submit {
  margin-top: 2px;
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
  min-width: 96px;
}

.cloud-qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.cloud-qr {
  width: 200px;
  height: 200px;
  border-radius: 6px;
  background: #fff;
  padding: 8px;
}
.cloud-qr-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
  border: 1px dashed var(--border-color);
  background: var(--bg-input);
}
.cloud-qr-tip {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}
.cloud-qr-btns {
  display: flex;
  gap: 8px;
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
