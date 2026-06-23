/**
 * 自定义 PPT 模板持久化（@tauri-apps/plugin-store）
 */
import { load } from '@tauri-apps/plugin-store'

const STORE_NAME = 'ppt-templates.json'
let storeInstance = null

async function getStore() {
  if (!storeInstance) storeInstance = await load(STORE_NAME, { autoSave: true })
  return storeInstance
}

export async function loadCustomPptTemplates() {
  try {
    const store = await getStore()
    return (await store.get('templates')) || []
  } catch (e) {
    console.warn('加载自定义 PPT 模板失败', e)
    return []
  }
}

/**
 * @param {{id?, name, description?, styleId, mode, skeleton?}} template
 */
export async function saveCustomPptTemplate(template) {
  const store = await getStore()
  const templates = await loadCustomPptTemplates()
  const now = new Date().toISOString()
  if (template.id) {
    const idx = templates.findIndex(t => t.id === template.id)
    if (idx >= 0) templates[idx] = { ...templates[idx], ...template, updatedAt: now }
    else templates.push({ ...template, createdAt: now, updatedAt: now })
  } else {
    template.id = `ppt-custom-${Date.now()}`
    template.createdAt = now
    template.updatedAt = now
    templates.push(template)
  }
  await store.set('templates', templates)
  return template
}

export async function deleteCustomPptTemplate(id) {
  const store = await getStore()
  const templates = await loadCustomPptTemplates()
  await store.set('templates', templates.filter(t => t.id !== id))
}
