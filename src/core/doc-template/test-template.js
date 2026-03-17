/**
 * 测试用例 / 测试记录 模板工具库
 * 复用 SRS 的章节树工具函数，仅提供模板创建入口
 */

import { getTestCasePresets, getTestRecordPresets, instantiateTemplate, createSectionNode } from './template-presets.js'
export { createSectionNode } from './template-presets.js'
export { getEnabledLeafSections, countSections, flattenSections, findSectionById, renumberSections } from './srs-template.js'
import { renumberSections } from './srs-template.js'

/**
 * 创建默认测试用例模板
 */
export function createTestCaseTemplate(presetId) {
    const presets = getTestCasePresets()
    const preset = presetId
        ? presets.find(p => p.id === presetId) || presets[0]
        : presets[0]
    return instantiateTemplate(preset)
}

/**
 * 创建默认测试记录模板
 */
export function createTestRecordTemplate(presetId) {
    const presets = getTestRecordPresets()
    const preset = presetId
        ? presets.find(p => p.id === presetId) || presets[0]
        : presets[0]
    return instantiateTemplate(preset)
}

// ==================== 智能分组策略 ====================

/**
 * 推断 Excel 数据的最佳分组方式
 * 优先级: 模块列 > 工作表名 > 自动均分
 */
function _inferGrouping(allRows, excelData) {
    const headers = excelData.sheets[0]?.headers || []

    // ① 尝试按明确的分组列分组
    const groupCol = headers.find(h =>
        /^(模块|功能模块|所属模块|分类|类别|页面|系统|类型|category|module)$/i.test(h.trim())
    ) || headers.find(h =>
        /模块|分类|类别|页面|系统/i.test(h)
    )

    if (groupCol) {
        const map = new Map()
        for (const row of allRows) {
            const key = (row[groupCol] || '').trim() || '其他'
            if (!map.has(key)) map.set(key, [])
            map.get(key).push(row)
        }
        const groups = [...map.entries()].map(([name, rows]) => ({ name, rows }))
        // 只有分组数 >= 2 且没有超大组时才认为此分组合理
        if (groups.length >= 2 && groups.every(g => g.rows.length <= 60)) {
            return { type: 'column', column: groupCol, groups }
        }
    }

    // ② 如果有多个工作表，按工作表分组
    if (excelData.sheets.length > 1) {
        const groups = excelData.sheets
            .filter(s => s.rows.length > 0)
            .map(s => ({ name: s.name, rows: s.rows.map(r => ({ ...r, _headers: s.headers })) }))
        if (groups.length >= 2) {
            return { type: 'sheet', groups }
        }
    }

    // ③ 兜底：所有数据作为一个组
    return { type: 'single', groups: [{ name: '全部功能', rows: allRows }] }
}

/**
 * 推断名称列（用于展示）
 */
function _inferNameColumn(headers) {
    return headers.find(h =>
        /^(名称|标题|功能|功能名称|测试项|用例名|bug描述|缺陷描述|问题|需求|summary|title)$/i.test(h.trim())
    ) || headers.find(h =>
        /名称|标题|功能|描述|bug|问题/i.test(h)
    ) || headers[0]
}

// ==================== 章节注入 ====================

/**
 * 将 Excel 导入的数据动态注入到模板章节中
 * 按模块/分类智能分组，每组 → 一个子章节，AI 为该组所有变点生成完整测试表格
 *
 * @param {Array} sections - 当前模板章节树
 * @param {Object} excelData - parseTestExcel 返回的数据 { sheets: [...] }
 * @param {'testcase'|'testrecord'} mode - 注入模式
 * @returns {Array} 更新后的章节树
 */
export function injectExcelSections(sections, excelData, mode = 'testcase') {
    if (!excelData || !excelData.sheets || excelData.sheets.length === 0) return sections

    const allRows = excelData.sheets.flatMap(sheet =>
        sheet.rows.map(row => ({ ...row, _sheetName: sheet.name, _headers: sheet.headers }))
    )
    if (allRows.length === 0) return sections

    if (mode === 'testcase') {
        return _injectTestCaseSections(sections, allRows, excelData)
    } else {
        return _injectTestRecordSections(sections, allRows, excelData)
    }
}

/**
 * 测试用例模式：按模块分组 → 每组一个子章节（含该组全部功能点的表格）
 *
 * 标准测试用例文档结构：
 *   3 功能测试用例
 *   ├── 3.1 用户管理模块（表格：该模块所有测试用例）
 *   ├── 3.2 数据采集模块（表格：该模块所有测试用例）
 *   └── 3.3 系统管理模块（表格：该模块所有测试用例）
 */
function _injectTestCaseSections(sections, allRows, excelData) {
    const headers = excelData.sheets[0]?.headers || []
    const { groups } = _inferGrouping(allRows, excelData)
    const nameCol = _inferNameColumn(headers)

    const childSections = groups.map((group, idx) => {
        // 列出该组所有功能点，供 AI 参考
        const itemList = group.rows.map((row, i) => {
            const detail = headers
                .filter(h => h && !h.startsWith('_'))
                .map(h => row[h] ? `${h}: ${row[h]}` : null)
                .filter(Boolean)
                .join(' | ')
            return `${i + 1}. ${detail}`
        }).join('\n')

        return createSectionNode({
            id: `excel-tc-${idx}`,
            number: '',
            title: group.name,
            type: 'table',
            prompt: `请为「${group.name}」模块的以下 ${group.rows.length} 个功能点编写功能测试用例。

## 待覆盖的功能点（共 ${group.rows.length} 项，必须全部覆盖）

${itemList}

## 输出要求
Markdown 表格，列：用例编号、用例名称、前置条件、测试步骤、预期结果、优先级。
每个功能点至少 1 条测试用例，重要功能点可 2-3 条（含异常场景）。
不要遗漏任何功能点。`,
            children: [],
        })
    })

    // 注入到目标章节
    const targetSection = _findSectionByTitle(sections, ['功能测试用例', '测试用例', '功能测试'])
    if (targetSection) {
        targetSection.children = childSections
    } else {
        sections.push(createSectionNode({
            id: 'excel-tc-root',
            number: '',
            title: '功能测试用例',
            type: 'text',
            prompt: '',
            children: childSections.map(s => ({ ...s, children: [] })),
        }))
    }

    renumberSections(sections)
    return sections
}

/**
 * 测试记录模式：按模块分组 → 每组一个子章节（含该组全部执行记录的表格 + 截图）
 *
 * 标准测试记录文档结构：
 *   3 测试执行记录
 *   ├── 3.1 用户管理模块（表格 + 截图）
 *   ├── 3.2 数据采集模块（表格 + 截图）
 *   └── 3.3 系统管理模块（表格 + 截图）
 */
function _injectTestRecordSections(sections, allRows, excelData) {
    const headers = excelData.sheets[0]?.headers || []
    const { groups } = _inferGrouping(allRows, excelData)

    const childSections = groups.map((group, idx) => {
        const itemList = group.rows.map((row, i) => {
            const detail = headers
                .filter(h => h && !h.startsWith('_'))
                .map(h => row[h] ? `${h}: ${row[h]}` : null)
                .filter(Boolean)
                .join(' | ')
            const imgNote = row._images?.length > 0 ? ` [📷 ${row._images.length}张截图]` : ''
            return `${i + 1}. ${detail}${imgNote}`
        }).join('\n')

        // 收集该组所有截图
        const groupImages = group.rows.flatMap(r => r._images || [])
        const hasImages = groupImages.length > 0

        let prompt = `请根据以下「${group.name}」的 ${group.rows.length} 条测试执行数据，生成测试执行记录。

## 测试数据（共 ${group.rows.length} 条）

${itemList}
`
        if (hasImages) {
            prompt += `\n## 截图信息
该模块共有 ${groupImages.length} 张测试截图（已附在章节中），请在测试记录中标注含截图的测试项。\n`
        }

        prompt += `\n## 输出要求
Markdown 表格，列：编号、测试项名称、执行时间、测试人员、实际结果、是否通过、备注。
请忠实反映上述数据中的实际执行情况，不要遗漏任何测试项。
如果数据中有"通过"/"完成"/"是"等正向状态，标记为"通过"；"失败"/"否"等标记为"未通过"；其他标记为"待定"。
${hasImages ? '含截图的测试项请在备注中标注"见截图"。' : ''}`

        // 取第一张截图作为 imageData
        const imageData = hasImages ? groupImages[0].dataUrl : null

        return createSectionNode({
            id: `excel-tr-${idx}`,
            number: '',
            title: group.name,
            type: 'table',
            prompt,
            imageData,
            children: [],
        })
    })

    // 注入到目标章节
    const targetSection = _findSectionByTitle(sections, ['测试执行记录', '测试记录', '执行记录'])
    if (targetSection) {
        targetSection.children = childSections
        targetSection.prompt = ''
        targetSection.type = 'text'
    } else {
        sections.push(createSectionNode({
            id: 'excel-tr-root',
            number: '',
            title: '测试执行记录',
            type: 'text',
            prompt: '',
            children: childSections.map(s => ({ ...s, children: [] })),
        }))
    }

    renumberSections(sections)
    return sections
}

/**
 * 在章节树中按标题关键词查找章节（支持深层搜索）
 */
function _findSectionByTitle(sections, keywords) {
    for (const s of sections) {
        if (keywords.some(kw => s.title && s.title.includes(kw))) return s
        if (s.children && s.children.length > 0) {
            const found = _findSectionByTitle(s.children, keywords)
            if (found) return found
        }
    }
    return null
}
