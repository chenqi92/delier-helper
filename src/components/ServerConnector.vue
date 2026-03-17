<template>
  <div class="card">
    <div class="card-header">
      <h3><Server :size="14" /> 服务器连接</h3>
    </div>
    <div class="card-body">
      <!-- 已添加的服务器列表 -->
      <div v-for="(srv, idx) in servers" :key="idx" class="srv-card" :class="{ connected: srv.status === 'connected', error: srv.status === 'error' }">
        <div class="srv-card-header">
          <span class="srv-alias">{{ srv.alias || srv.host || '未命名服务器' }}</span>
          <div style="display:flex;gap:2px;">
            <button class="btn btn-secondary btn-sm btn-icon" @click="toggleExpand(idx)" :title="srv.expanded ? '收起' : '展开'">
              <ChevronDown :size="12" :class="{ 'chevron-rotated': srv.expanded }" />
            </button>
            <button class="btn btn-danger btn-sm btn-icon" @click="removeServer(idx)"><X :size="12" /></button>
          </div>
        </div>
        <div class="srv-status-line">
          <span v-if="srv.status === 'connected'" class="srv-status-badge connected">已连接</span>
          <span v-else-if="srv.status === 'scanning'" class="srv-status-badge scanning"><span class="spinner-sm"></span> 扫描中</span>
          <span v-else-if="srv.status === 'error'" class="srv-status-badge error">连接失败</span>
          <span v-else class="srv-status-badge idle">未连接</span>
          <span v-if="srv.serverData" class="srv-summary">
            {{ srv.serverData.hostname }} · {{ Object.values(srv.serverData.softwareVersions || {}).filter(v => v && !v.includes('not installed')).length }} 个软件
          </span>
        </div>

        <!-- 展开的配置表单 -->
        <div v-if="srv.expanded" class="srv-form">
          <div class="form-row">
            <div class="form-group" style="flex:1;">
              <label class="form-label">别名</label>
              <input type="text" class="form-input" v-model="srv.alias" placeholder="业务服务器" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:2;">
              <label class="form-label">主机 IP</label>
              <input type="text" class="form-input" v-model="srv.host" placeholder="192.168.1.100" />
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">SSH 端口</label>
              <input type="number" class="form-input" v-model.number="srv.port" placeholder="22" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1;">
              <label class="form-label">用户名</label>
              <input type="text" class="form-input" v-model="srv.username" placeholder="root" />
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">密码</label>
              <input type="password" class="form-input" v-model="srv.password" placeholder="密码" />
            </div>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            <button class="btn btn-secondary btn-sm" @click="testConnection(idx)" :disabled="srv.status === 'scanning'">
              <Plug :size="12" /> 测试连接
            </button>
            <button class="btn btn-primary btn-sm" @click="scanServer(idx)" :disabled="srv.status === 'scanning' || !srv.host">
              <Search :size="12" /> 扫描服务器
            </button>
          </div>
          <div v-if="srv.errorMsg" class="srv-error-msg">{{ srv.errorMsg }}</div>

          <!-- 扫描结果摘要 -->
          <div v-if="srv.serverData" class="srv-scan-result">
            <div class="srv-scan-label">扫描结果摘要</div>
            <div class="srv-scan-items">
              <span v-if="srv.serverData.hostname">🖥️ {{ srv.serverData.hostname }}</span>
              <span v-if="srv.serverData.uptime">⏱️ {{ srv.serverData.uptime.trim().substring(0, 60) }}</span>
              <span v-for="(v, k) in srv.serverData.softwareVersions" :key="k" v-if="v && !v.includes('not installed')">
                📦 {{ k }}: {{ v.substring(0, 40) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 添加服务器按钮 -->
      <button class="btn btn-primary btn-sm" style="width:100%;margin-top:6px;" @click="addServer">
        <Plus :size="14" /> 添加服务器
      </button>

      <!-- 批量扫描 -->
      <button
        v-if="servers.length > 0"
        class="btn btn-secondary btn-sm"
        style="width:100%;margin-top:4px;"
        @click="scanAllServers"
        :disabled="scanning"
      >
        <Search :size="14" /> {{ scanning ? '扫描中...' : '扫描全部服务器' }}
      </button>
    </div>
  </div>
</template>

<script>
import { invoke } from '@tauri-apps/api/core'
import { Server, ChevronDown, X, Plus, Search, Plug } from 'lucide-vue-next'

export default {
  name: 'ServerConnector',
  components: { Server, ChevronDown, X, Plus, Search, Plug },
  inject: ['showToast'],
  emits: ['update-servers'],
  data() {
    return {
      servers: [],
      scanning: false,
    }
  },
  methods: {
    addServer() {
      this.servers.push({
        alias: '',
        host: '',
        port: 22,
        username: 'root',
        password: '',
        status: 'idle', // idle | scanning | connected | error
        errorMsg: '',
        serverData: null,
        expanded: true,
      })
    },

    removeServer(idx) {
      this.servers.splice(idx, 1)
      this.emitUpdate()
    },

    toggleExpand(idx) {
      this.servers[idx].expanded = !this.servers[idx].expanded
    },

    async testConnection(idx) {
      const srv = this.servers[idx]
      if (!srv.host || !srv.username) {
        this.showToast('请填写主机 IP 和用户名', 'warning')
        return
      }
      srv.status = 'scanning'
      srv.errorMsg = ''
      try {
        await invoke('ssh_test_connection', {
          host: srv.host,
          port: srv.port || 22,
          username: srv.username,
          password: srv.password,
        })
        srv.status = 'connected'
        this.showToast(`${srv.alias || srv.host} 连接成功`, 'success')
      } catch (e) {
        srv.status = 'error'
        srv.errorMsg = String(e)
        this.showToast(`连接失败: ${e}`, 'error')
      }
    },

    async scanServer(idx) {
      const srv = this.servers[idx]
      if (!srv.host || !srv.username) {
        this.showToast('请填写主机 IP 和用户名', 'warning')
        return
      }
      srv.status = 'scanning'
      srv.errorMsg = ''
      try {
        const data = await invoke('ssh_read_server_info', {
          host: srv.host,
          port: srv.port || 22,
          username: srv.username,
          password: srv.password,
        })
        srv.serverData = data
        srv.status = 'connected'
        this.showToast(`${srv.alias || srv.host} 扫描完成`, 'success')
        this.emitUpdate()
      } catch (e) {
        srv.status = 'error'
        srv.errorMsg = String(e)
        this.showToast(`扫描失败: ${e}`, 'error')
      }
    },

    async scanAllServers() {
      this.scanning = true
      for (let i = 0; i < this.servers.length; i++) {
        if (this.servers[i].host && this.servers[i].username) {
          await this.scanServer(i)
        }
      }
      this.scanning = false
    },

    emitUpdate() {
      this.$emit('update-servers', this.servers.map(s => ({
        alias: s.alias,
        host: s.host,
        port: s.port,
        serverData: s.serverData,
      })))
    },
  },
}
</script>

<style scoped>
.srv-card {
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 6px;
  transition: border-color 0.15s;
}
.srv-card.connected {
  border-color: var(--success-400, #4ade80);
}
.srv-card.error {
  border-color: var(--danger-400, #f87171);
}
.srv-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.srv-alias {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.srv-status-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.srv-status-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
}
.srv-status-badge.idle { background: var(--bg-tertiary); color: var(--text-muted); }
.srv-status-badge.connected { background: var(--success-100, #dcfce7); color: var(--success-700, #15803d); }
.srv-status-badge.scanning { background: var(--info-100, #dbeafe); color: var(--info-700, #1d4ed8); display: flex; align-items: center; gap: 4px; }
.srv-status-badge.error { background: var(--danger-100, #fee2e2); color: var(--danger-700, #b91c1c); }
.srv-summary {
  font-size: 11px;
  color: var(--text-secondary);
}
.srv-form {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.form-row {
  display: flex;
  gap: 6px;
}
.srv-error-msg {
  font-size: 11px;
  color: var(--danger-600, #dc2626);
  margin-top: 4px;
  word-break: break-all;
}
.srv-scan-result {
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
}
.srv-scan-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.srv-scan-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.srv-scan-items span {
  font-size: 11px;
  color: var(--text-primary);
  background: var(--bg-primary);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--border-primary);
}
.chevron-rotated {
  transform: rotate(180deg);
  transition: transform 0.15s;
}
.spinner-sm {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
