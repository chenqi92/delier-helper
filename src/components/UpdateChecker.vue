<template>
  <Teleport to="body">
    <!-- 更新提示弹窗 -->
    <div v-if="showDialog" class="update-overlay">
      <div class="update-dialog">
        <!-- 关闭按钮 -->
        <button class="update-close" @click="dismiss" v-if="!installing">
          <X :size="16" />
        </button>

        <!-- 发现更新 -->
        <template v-if="!installing">
          <div class="update-icon">🚀</div>
          <h3 class="update-title">发现新版本</h3>
          <p class="update-version">
            <span class="version-old">v{{ currentVersion }}</span>
            <span class="version-arrow">→</span>
            <span class="version-new">v{{ update?.version }}</span>
          </p>
          <div v-if="update?.body" class="update-notes">
            <p>{{ update.body }}</p>
          </div>
          <div class="update-actions">
            <button class="btn-update" @click="startUpdate">立即更新</button>
            <button class="btn-skip" @click="dismiss">稍后再说</button>
          </div>
        </template>

        <!-- 下载安装中 -->
        <template v-else>
          <div class="update-icon">⏳</div>
          <h3 class="update-title">{{ statusText }}</h3>
          <div class="progress-bar-container">
            <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <p class="progress-text">{{ progressPercent.toFixed(1) }}%</p>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { X } from 'lucide-vue-next'

export default {
  name: 'UpdateChecker',
  components: { X },
  data() {
    return {
      showDialog: false,
      installing: false,
      statusText: '正在下载更新...',
      update: null,
      currentVersion: '',
      downloaded: 0,
      contentLength: 0,
    }
  },
  computed: {
    progressPercent() {
      if (this.contentLength <= 0) return 0
      return Math.min((this.downloaded / this.contentLength) * 100, 100)
    },
  },
  async mounted() {
    // 延迟 3 秒后检查更新，避免影响启动体验
    setTimeout(() => this.checkForUpdate(), 3000)
  },
  methods: {
    async checkForUpdate() {
      try {
        const update = await check()
        if (update) {
          this.update = update
          this.currentVersion = update.currentVersion
          this.showDialog = true
        }
      } catch (e) {
        console.warn('检查更新失败:', e)
      }
    },
    async startUpdate() {
      if (!this.update) return
      this.installing = true
      this.statusText = '正在下载更新...'
      this.downloaded = 0
      this.contentLength = 0

      try {
        await this.update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              this.contentLength = event.data.contentLength || 0
              break
            case 'Progress':
              this.downloaded += event.data.chunkLength
              break
            case 'Finished':
              this.statusText = '安装完成，即将重启...'
              break
          }
        })
        // 重启应用
        await relaunch()
      } catch (e) {
        console.error('更新失败:', e)
        this.installing = false
        this.statusText = ''
        // 通过 inject 的 showToast 提示
        this.showToastMsg?.('更新失败: ' + e, 'error')
      }
    },
    dismiss() {
      this.showDialog = false
    },
  },
  inject: {
    showToastMsg: { from: 'showToast', default: null },
  },
}
</script>

<style scoped>
.update-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.update-dialog {
  position: relative;
  width: 400px;
  max-width: 90vw;
  padding: 32px 28px 24px;
  border-radius: 16px;
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  text-align: center;
  color: var(--text-primary, #e0e0e0);
}

.light-theme .update-dialog {
  background: #ffffff;
  border-color: rgba(0, 0, 0, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  color: #1a1a2e;
}

.update-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--text-secondary, #999);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: background 0.2s;
}
.update-close:hover {
  background: rgba(255, 255, 255, 0.1);
}
.light-theme .update-close:hover {
  background: rgba(0, 0, 0, 0.06);
}

.update-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.update-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px;
}

.update-version {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 15px;
}
.version-old {
  color: var(--text-secondary, #999);
  text-decoration: line-through;
}
.version-arrow {
  color: var(--accent, #7c6ef0);
}
.version-new {
  color: var(--accent, #7c6ef0);
  font-weight: 600;
}

.update-notes {
  max-height: 120px;
  overflow-y: auto;
  padding: 10px 14px;
  margin-bottom: 20px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
  color: var(--text-secondary, #bbb);
}
.light-theme .update-notes {
  background: rgba(0, 0, 0, 0.03);
  color: #555;
}

.update-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.btn-update {
  padding: 10px 28px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c6ef0, #5b4dd4);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.btn-update:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(124, 110, 240, 0.4);
}
.btn-skip {
  padding: 10px 20px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary, #999);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-skip:hover {
  background: rgba(255, 255, 255, 0.06);
}
.light-theme .btn-skip {
  border-color: rgba(0, 0, 0, 0.15);
  color: #666;
}
.light-theme .btn-skip:hover {
  background: rgba(0, 0, 0, 0.04);
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin: 16px 0 8px;
}
.light-theme .progress-bar-container {
  background: rgba(0, 0, 0, 0.06);
}
.progress-bar {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #7c6ef0, #a78bfa);
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 13px;
  color: var(--text-secondary, #999);
  margin: 0;
}
</style>
