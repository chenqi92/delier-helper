/**
 * 自定义模板持久化存储
 * 使用 @tauri-apps/plugin-store 保存用户自定义模板
 */
import { load } from '@tauri-apps/plugin-store'

const STORE_NAME = 'custom-templates.json'
let storeInstance = null

async function getStore() {
    if (!storeInstance) {
        storeInstance = await load(STORE_NAME, { autoSave: true })
    }
    return storeInstance
}

/**
 * 加载指定类型的自定义模板列表
 * @param {'srs' | 'sdd'} docType
 * @returns {Promise<Array>} [{id, name, description, sections, createdAt, updatedAt}]
 */
export async function loadCustomTemplates(docType) {
    try {
        const store = await getStore()
        const templates = await store.get(`templates-${docType}`)
        return templates || []
    } catch (e) {
        console.warn('加载自定义模板失败', e)
        return []
    }
}

/**
 * 保存/更新自定义模板
 * @param {'srs' | 'sdd'} docType
 * @param {Object} template - { id?, name, description?, sections }
 * @returns {Promise<Object>} 保存后的模板（含 id）
 */
export async function saveCustomTemplate(docType, template) {
    const store = await getStore()
    const templates = await loadCustomTemplates(docType)

    const now = new Date().toISOString()
    if (template.id) {
        // 更新
        const idx = templates.findIndex(t => t.id === template.id)
        if (idx >= 0) {
            templates[idx] = {
                ...templates[idx],
                ...template,
                updatedAt: now,
            }
        } else {
            templates.push({ ...template, createdAt: now, updatedAt: now })
        }
    } else {
        // 新增
        template.id = `custom-${docType}-${Date.now()}`
        template.createdAt = now
        template.updatedAt = now
        templates.push(template)
    }

    await store.set(`templates-${docType}`, templates)
    return template
}

/**
 * 删除自定义模板
 * @param {'srs' | 'sdd'} docType
 * @param {string} templateId
 */
export async function deleteCustomTemplate(docType, templateId) {
    const store = await getStore()
    const templates = await loadCustomTemplates(docType)
    const filtered = templates.filter(t => t.id !== templateId)
    await store.set(`templates-${docType}`, filtered)
}
