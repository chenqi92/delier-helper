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

/**
 * 将 Excel 导入的数据动态注入到模板章节中
 * 测试用例模式：为每个功能点/需求项创建独立子章节，注入到"功能测试用例"类章节
 * 测试记录模式：为每批测试项创建独立子章节，注入到"测试执行记录"类章节
 *
 * @param {Array} sections - 当前模板章节树
 * @param {Object} excelData - parseTestExcel 返回的数据 { sheets: [...] }
 * @param {'testcase'|'testrecord'} mode - 注入模式
 * @returns {Array} 更新后的章节树
 */
export function injectExcelSections(sections, excelData, mode = 'testcase') {
    if (!excelData || !excelData.sheets || excelData.sheets.length === 0) return sections

    // 收集所有行数据
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
 * 测试用例模式：将功能点按分组注入到"功能测试用例"章节
 */
function _injectTestCaseSections(sections, allRows, excelData) {
    // 策略：按模块/分类分组，如果没有明显分组则按 BATCH_SIZE 拆分
    const BATCH_SIZE = 8

    // 尝试从列名推断分组列
    const headers = excelData.sheets[0]?.headers || []
    const groupCol = headers.find(h =>
        /模块|分类|类别|页面|系统|类型|功能模块|category|module/i.test(h)
    )

    let groups
    if (groupCol) {
        // 按分组列分组
        const map = new Map()
        for (const row of allRows) {
            const key = row[groupCol]?.trim() || '其他'
            if (!map.has(key)) map.set(key, [])
            map.get(key).push(row)
        }
        groups = [...map.entries()].map(([name, rows]) => ({ name, rows }))
    } else {
        // 没有分组列，按 BATCH_SIZE 拆分
        groups = []
        for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
            const batch = allRows.slice(i, i + BATCH_SIZE)
            const start = i + 1
            const end = Math.min(i + BATCH_SIZE, allRows.length)
            groups.push({ name: `功能点 ${start}-${end}`, rows: batch })
        }
    }

    // 找到"功能测试用例"类章节 — 按标题匹配
    const targetSection = _findSectionByTitle(sections, ['功能测试用例', '测试用例', '功能测试'])

    if (targetSection) {
        // 替换其子章节为动态生成的功能点章节
        targetSection.children = groups.map((group, idx) => {
            const rowDataText = _rowsToPromptText(group.rows, headers)
            return createSectionNode({
                id: `excel-tc-${idx}`,
                number: `${targetSection.number}.${idx + 1}`,
                title: group.name,
                type: 'table',
                prompt: `请为以下功能点/需求项编写完整的功能测试用例。

## 需要覆盖的功能点（共 ${group.rows.length} 项）

${rowDataText}

## 输出要求
Markdown 表格，列：用例编号、用例名称、前置条件、测试步骤、预期结果、优先级。
必须为上述每个功能点编写至少 1-2 条测试用例（包含正常流程和异常场景）。
不要遗漏任何功能点。`,
                children: [],
            })
        })
    } else {
        // 没有找到目标章节，在根节点末尾插入一个新的功能测试章节
        const newSection = createSectionNode({
            id: 'excel-tc-root',
            number: String(sections.length + 1),
            title: '功能测试用例（来自 Excel）',
            type: 'text',
            prompt: '',
            children: groups.map((group, idx) => {
                const rowDataText = _rowsToPromptText(group.rows, headers)
                return {
                    id: `excel-tc-${idx}`,
                    number: `${sections.length + 1}.${idx + 1}`,
                    title: group.name,
                    type: 'table',
                    prompt: `请为以下功能点/需求项编写完整的功能测试用例。

## 需要覆盖的功能点（共 ${group.rows.length} 项）

${rowDataText}

## 输出要求
Markdown 表格，列：用例编号、用例名称、前置条件、测试步骤、预期结果、优先级。
必须为上述每个功能点编写至少 1-2 条测试用例。`,
                    children: [],
                }
            }),
        })
        sections.push(newSection)
    }

    // 重新编号
    renumberSections(sections)
    return sections
}

/**
 * 测试记录模式：将测试执行数据按分批注入到"测试执行记录"章节
 */
function _injectTestRecordSections(sections, allRows, excelData) {
    const BATCH_SIZE = 15
    const headers = excelData.sheets[0]?.headers || []

    // 按批拆分
    const batches = []
    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
        const batch = allRows.slice(i, i + BATCH_SIZE)
        const start = i + 1
        const end = Math.min(i + BATCH_SIZE, allRows.length)
        batches.push({ name: `测试记录 ${start}-${end}`, rows: batch })
    }

    // 找到"测试执行记录"类章节
    const targetSection = _findSectionByTitle(sections, ['测试执行记录', '测试记录', '执行记录'])

    const buildPrompt = (batch) => {
        const rowDataText = _rowsToPromptText(batch.rows, headers)
        // 统计含图片的行
        const imgRows = batch.rows.filter(r => r._images?.length > 0)
        let prompt = `请根据以下实际测试执行数据，生成测试执行记录。

## 测试数据（共 ${batch.rows.length} 条）

${rowDataText}
`
        if (imgRows.length > 0) {
            prompt += `\n## 截图信息\n以下测试项包含了截图证据：\n`
            imgRows.forEach(r => {
                const idx = r._rowIndex || '?'
                prompt += `- 第 ${idx} 行：${r._images.length} 张截图\n`
            })
        }

        prompt += `\n## 输出要求
Markdown 表格，列：编号、测试项名称、执行时间、测试人员、实际结果、是否通过、备注。
请忠实反映上述数据中的实际执行情况，不要遗漏或编造内容。
如果数据中有"通过"/"完成"/"是"等正向状态，标记为"通过"；"失败"/"否"等标记为"未通过"；其他标记为"待定"。`
        return prompt
    }

    if (targetSection) {
        targetSection.children = batches.map((batch, idx) =>
            createSectionNode({
                id: `excel-tr-${idx}`,
                number: `${targetSection.number}.${idx + 1}`,
                title: batch.name,
                type: 'table',
                prompt: buildPrompt(batch),
                children: [],
            })
        )
        // 如果只有一批，直接在 targetSection 上设置 prompt （不创建子章节更简洁）
        if (batches.length === 1) {
            targetSection.type = 'table'
            targetSection.prompt = buildPrompt(batches[0])
            targetSection.children = []
        }
    } else {
        const newSection = createSectionNode({
            id: 'excel-tr-root',
            number: String(sections.length + 1),
            title: '测试执行记录（来自 Excel）',
            type: 'text',
            prompt: '',
            children: batches.map((batch, idx) => ({
                id: `excel-tr-${idx}`,
                number: `${sections.length + 1}.${idx + 1}`,
                title: batch.name,
                type: 'table',
                prompt: buildPrompt(batch),
                children: [],
            })),
        })
        sections.push(newSection)
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

/**
 * 将行数据转为 AI prompt 中的描述文本
 */
function _rowsToPromptText(rows, headers) {
    if (rows.length === 0) return '（无数据）'

    // 使用编号格式，每行一条，包含所有列的key=value
    return rows.map((row, idx) => {
        const fields = headers
            .filter(h => h && !h.startsWith('_'))
            .map(h => {
                const v = row[h]
                return v ? `${h}: ${v}` : null
            })
            .filter(Boolean)
            .join(' | ')
        return `${idx + 1}. ${fields}`
    }).join('\n')
}
