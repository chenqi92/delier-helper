/**
 * 软件设计文档 (SDD) 模板工具库
 *
 * 模板预设定义已移至 template-presets.js
 * 本文件复用 srs-template.js 的工具函数
 */

import { getSddPresets, instantiateTemplate } from './template-presets.js'

export {
    flattenSections,
    findSectionById,
    getEnabledLeafSections,
    countSections,
    createSectionNode,
    renumberSections,
} from './srs-template.js'

/**
 * 创建默认 SDD 模板（标准版）
 */
export function createSddTemplate(presetId) {
    const presets = getSddPresets()
    const preset = presetId
        ? presets.find(p => p.id === presetId) || presets[0]
        : presets[0]
    return instantiateTemplate(preset)
}
