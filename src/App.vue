<template>
  <div class="app-container" :class="{ 'light-theme': theme === 'light' }" style="height:100vh;display:flex;flex-direction:column;">
    <!-- Toast -->
    <div v-if="toast.show" :class="['message-toast', toast.type]">{{ toast.message }}</div>

    <!-- 头部 -->
    <header class="app-header">
      <div class="app-brand">
        <img src="./assets/logo.svg" class="app-logo" alt="logo" />
        <span class="app-title">交付助手</span>
      </div>

      <TabNav
        :tabs="tabs"
        v-model="activeTab"
      />

      <div class="header-actions">
        <button
          :class="['btn', 'btn-secondary', 'btn-sm', 'guide-toggle-btn', { 'guide-active': guideEnabled }]"
          @click="toggleGuide"
          :title="guideEnabled ? '关闭引导提示' : '开启引导提示'"
        >
          <HelpCircle :size="14" />
        </button>
        <button class="btn btn-secondary btn-sm" @click="toggleTheme" :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'">
          <Sun v-if="theme === 'dark'" :size="14" />
          <Moon v-else :size="14" />
        </button>
      </div>
    </header>

    <!-- 主体 - 动态组件 -->
    <keep-alive>
      <component :is="currentView" :key="activeTab" />
    </keep-alive>
  </div>
</template>

<script>
import { Sun, Moon, FileCode, Plug, Database, Bot, HelpCircle } from 'lucide-vue-next'
import { markRaw } from 'vue'
import TabNav from './components/TabNav.vue'
import CopyrightGenerator from './views/CopyrightGenerator.vue'
import ApiDocGenerator from './views/ApiDocGenerator.vue'
import DbDocGenerator from './views/DbDocGenerator.vue'
import AiSettings from './views/AiSettings.vue'

export default {
  name: 'App',
  components: { TabNav, Sun, Moon, HelpCircle, CopyrightGenerator, ApiDocGenerator, DbDocGenerator, AiSettings },
  provide() {
    return {
      showToast: this.showToast,
      getGuideEnabled: () => this.guideEnabled,
    }
  },
  data() {
    return {
      activeTab: 'copyright',
      theme: 'light',
      guideEnabled: localStorage.getItem('guideEnabled') !== 'false',
      toast: { show: false, message: '', type: 'info' },
      tabs: [
        { id: 'copyright', label: '软著代码', icon: markRaw(FileCode) },
        { id: 'api-doc',   label: '接口文档', icon: markRaw(Plug) },
        { id: 'db-doc',    label: '数据库文档', icon: markRaw(Database) },
        { id: 'ai-settings', label: 'AI 设置', icon: markRaw(Bot) },
      ],
      viewMap: {
        'copyright': 'CopyrightGenerator',
        'api-doc': 'ApiDocGenerator',
        'db-doc': 'DbDocGenerator',
        'ai-settings': 'AiSettings',
      },
    }
  },
  computed: {
    currentView() {
      return this.viewMap[this.activeTab] || 'CopyrightGenerator'
    },
  },
  methods: {
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
    },
    toggleGuide() {
      this.guideEnabled = !this.guideEnabled
      localStorage.setItem('guideEnabled', this.guideEnabled)
      window.dispatchEvent(new CustomEvent('guide-toggle', { detail: this.guideEnabled }))
    },
    showToast(message, type = 'info') {
      this.toast = { show: true, message, type }
      setTimeout(() => { this.toast.show = false }, 3000)
    },
  },
}
</script>
