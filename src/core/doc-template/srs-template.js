/**
 * 系统需求规格说明书 (SRS) 模板工具库
 *
 * 模板预设定义已移至 template-presets.js
 * 本文件保留章节树相关的工具函数
 */

import { getSrsPresets, instantiateTemplate, createSectionNode } from './template-presets.js'

// 导出节点工厂函数
export { createSectionNode }

/**
 * 创建默认 SRS 模板（标准版）
 */
export function createSrsTemplate(presetId) {
    const presets = getSrsPresets()
    const preset = presetId
        ? presets.find(p => p.id === presetId) || presets[0]
        : presets[0]
    return instantiateTemplate(preset)
}

/**
 * 获取所有叶子章节（扁平化），用于批量生成
 */
export function flattenSections(sections) {
    const result = []
    for (const sec of sections) {
        if (sec.children && sec.children.length > 0) {
            result.push(...flattenSections(sec.children))
        } else {
            result.push(sec)
        }
    }
    return result
}

/**
 * 获取所有启用的叶子章节
 */
export function getEnabledLeafSections(sections) {
    return flattenSections(sections).filter(s => s.enabled && s.prompt)
}

/**
 * 统计章节
 */
export function countSections(sections) {
    let total = 0
    let enabled = 0
    for (const sec of sections) {
        if (sec.children && sec.children.length > 0) {
            const child = countSections(sec.children)
            total += child.total
            enabled += child.enabled
        } else if (sec.prompt) {
            total++
            if (sec.enabled) enabled++
        }
    }
    return { total, enabled }
}

/**
 * 根据 id 查找章节
 */
export function findSectionById(sections, id) {
    for (const sec of sections) {
        if (sec.id === id) return sec
        if (sec.children && sec.children.length > 0) {
            const found = findSectionById(sec.children, id)
            if (found) return found
        }
    }
    return null
}

/**
 * 重新编号所有章节（编辑章节结构后调用）
 */
export function renumberSections(sections, prefix = '') {
    sections.forEach((sec, i) => {
        const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`
        sec.number = num
        if (sec.children && sec.children.length > 0) {
            renumberSections(sec.children, num)
        }
    })
}
