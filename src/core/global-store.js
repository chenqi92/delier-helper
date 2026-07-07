/**
 * 全局响应式状态管理
 * 通过 App.vue provide 注入所有子组件，解决 keep-alive 下跨页面状态同步问题
 */
import { reactive } from 'vue'
import { ensureCloudAccessToken, loadProviderConfigs, loadActiveSelection, saveActiveSelection } from './llm/llm-service.js'

export const globalStore = reactive({
  providerConfigs: [],
  activeProviderId: null,
  activeModelId: null,
  loaded: false,
})

/**
 * 初始化全局状态（App.vue mounted 调用一次）
 */
export async function initStore() {
  try {
    await ensureCloudAccessToken()
  } catch (e) {
    console.warn('云端账号刷新失败:', e)
  }
  globalStore.providerConfigs = await loadProviderConfigs()
  const { providerId, modelId } = await loadActiveSelection()
  if (globalStore.providerConfigs.length > 0) {
    const found = globalStore.providerConfigs.find(p => p.id === providerId)
    const target = found || globalStore.providerConfigs[0]
    const hasStoredModel = target.models.some(m => m.id === modelId)
    globalStore.activeProviderId = target.id
    globalStore.activeModelId = hasStoredModel ? modelId : (target.activeModelId || (target.models[0]?.id || ''))
  }
  globalStore.loaded = true
}

/**
 * 刷新模型配置（AiSettings 保存/删除后调用）
 * 自动同步到所有 inject 了 globalStore 的组件
 */
export async function refreshProviderConfigs() {
  globalStore.providerConfigs = await loadProviderConfigs()
  // 如果当前选中的厂商已被删除，切换到第一个
  if (globalStore.providerConfigs.length > 0) {
    const found = globalStore.providerConfigs.find(p => p.id === globalStore.activeProviderId)
    if (!found) {
      const { providerId, modelId } = await loadActiveSelection()
      const target = globalStore.providerConfigs.find(p => p.id === providerId) || globalStore.providerConfigs[0]
      const hasStoredModel = target.models.some(m => m.id === modelId)
      globalStore.activeProviderId = target.id
      globalStore.activeModelId = hasStoredModel ? modelId : (target.activeModelId || (target.models[0]?.id || ''))
    } else if (!found.models.some(m => m.id === globalStore.activeModelId)) {
      globalStore.activeModelId = found.activeModelId || (found.models[0]?.id || '')
    }
  } else {
    globalStore.activeProviderId = null
    globalStore.activeModelId = null
  }
}
