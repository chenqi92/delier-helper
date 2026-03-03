/**
 * API 文档渲染器
 * 将解析结果渲染为 Markdown 或 Word (docx) 格式
 */

import { Document, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, BorderStyle, WidthType, AlignmentType, Packer } from 'docx'
import { isPlaceholder } from './spring-boot-parser.js'

/**
 * 导出时过滤占位符：占位符文本替换为 '-'
 */
function exportText(text) {
    if (!text || isPlaceholder(text)) return '-'
    return text
}

/**
 * 默认文档模块配置
 */
export const DEFAULT_DOC_MODULES = [
    { id: 'method', label: '请求方式', enabled: true },
    { id: 'path', label: '请求地址', enabled: true },
    { id: 'summary', label: '接口说明', enabled: true },
    { id: 'params', label: '请求参数', enabled: true },
    { id: 'response', label: '返回数据', enabled: true },
    { id: 'requestExample', label: '请求示例', enabled: true },
    { id: 'responseExample', label: '返回示例', enabled: true },
]

/**
 * HTTP 方法对应的颜色标签（用于预览）
 */
export const METHOD_COLORS = {
    GET: { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' },
    POST: { bg: '#e3f2fd', color: '#1565c0', border: '#90caf9' },
    PUT: { bg: '#fff3e0', color: '#e65100', border: '#ffcc80' },
    DELETE: { bg: '#fce4ec', color: '#c62828', border: '#ef9a9a' },
    PATCH: { bg: '#f3e5f5', color: '#6a1b9a', border: '#ce93d8' },
}

// ==================== Markdown 渲染 ====================

/**
 * 渲染为 Markdown 字符串
 * @param {{ modules: Array }} parseResult - 解析结果
 * @param {Array} docModules - 启用的模块配置
 * @returns {string}
 */
export function renderMarkdown(parseResult, docModules) {
    const enabledIds = docModules.filter(m => m.enabled).map(m => m.id)
    const lines = []

    lines.push('# 接口文档\n')

    for (let modIdx = 0; modIdx < parseResult.modules.length; modIdx++) {
        const mod = parseResult.modules[modIdx]
        lines.push(`## ${modIdx + 1}. ${mod.name}\n`)
        if (mod.basePath) {
            lines.push(`> 基础路径: \`${mod.basePath}\`\n`)
        }

        for (let apiIdx = 0; apiIdx < mod.apis.length; apiIdx++) {
            const api = mod.apis[apiIdx]
            lines.push(`### ${modIdx + 1}.${apiIdx + 1} ${api.summary}\n`)

            for (const modId of enabledIds) {
                switch (modId) {
                    case 'method':
                        lines.push(`**请求方式：** \`${api.method}\`\n`)
                        break
                    case 'path':
                        lines.push(`**请求地址：** \`${api.path}\`\n`)
                        break
                    case 'summary': {
                        const desc = exportText(api.description)
                        if (desc !== '-') {
                            lines.push(`**接口说明：** ${desc}\n`)
                        }
                        break
                    }
                    case 'params':
                        if (api.params.length > 0) {
                            lines.push('**请求参数：**\n')
                            lines.push('| 参数名 | 类型 | 是否必须 | 说明 |')
                            lines.push('|--------|------|----------|------|')
                            for (const p of api.params) {
                                lines.push(`| ${p.name} | ${p.type} | ${p.required ? '是' : '否'} | ${exportText(p.description)} |`)
                            }
                            lines.push('')
                        }
                        if (api.requestBody) {
                            lines.push(`**请求体 (${api.requestBody.type})：**\n`)
                            if (api.requestBody.fields.length > 0) {
                                lines.push('| 参数名 | 类型 | 是否必须 | 说明 |')
                                lines.push('|--------|------|----------|------|')
                                for (const f of api.requestBody.fields) {
                                    lines.push(`| ${f.name} | ${f.type} | ${f.required ? '是' : '否'} | ${exportText(f.description)} |`)
                                }
                                lines.push('')
                            }
                        }
                        break
                    case 'response':
                        if (api.response && api.response.fields.length > 0) {
                            lines.push(`**返回数据 (${api.response.type})：**\n`)
                            lines.push('| 参数名 | 类型 | 说明 |')
                            lines.push('|--------|------|------|')
                            for (const f of api.response.fields) {
                                lines.push(`| ${f.name} | ${f.type} | ${exportText(f.description)} |`)
                            }
                            lines.push('')
                        }
                        break
                    case 'requestExample':
                        if (api.requestBody && api.requestBody.example) {
                            lines.push('**请求示例：**\n')
                            lines.push('```json')
                            lines.push(JSON.stringify(api.requestBody.example, null, 2))
                            lines.push('```\n')
                        }
                        break
                    case 'responseExample':
                        if (api.response && api.response.example) {
                            lines.push('**返回示例：**\n')
                            lines.push('```json')
                            lines.push(JSON.stringify(api.response.example, null, 2))
                            lines.push('```\n')
                        }
                        break
                }
            }

            lines.push('---\n')
        }
    }

    return lines.join('\n')
}

// ==================== Word 渲染 ====================

const FONT_NAME = '微软雅黑'
const TABLE_BORDER = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: 'cccccc',
}
const TABLE_BORDERS = {
    top: TABLE_BORDER,
    bottom: TABLE_BORDER,
    left: TABLE_BORDER,
    right: TABLE_BORDER,
    insideHorizontal: TABLE_BORDER,
    insideVertical: TABLE_BORDER,
}

function makeText(text, options = {}) {
    return new TextRun({
        text,
        font: FONT_NAME,
        size: options.size || 21,
        bold: options.bold || false,
        color: options.color,
    })
}

function makeCell(text, options = {}) {
    return new TableCell({
        children: [new Paragraph({
            children: [makeText(text, { size: 18, ...options })],
            spacing: { before: 40, after: 40 },
        })],
        width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
        shading: options.shading ? { fill: options.shading } : undefined,
    })
}

function makeHeaderCell(text, width) {
    return makeCell(text, { bold: true, width, shading: 'f0f0f0' })
}

/**
 * 渲染为 Word docx Buffer
 * @param {{ modules: Array }} parseResult
 * @param {Array} docModules
 * @returns {Promise<Uint8Array>}
 */
export async function renderDocx(parseResult, docModules) {
    const enabledIds = docModules.filter(m => m.enabled).map(m => m.id)
    const sections = []
    const children = []

    children.push(new Paragraph({
        children: [makeText('接口文档', { size: 44, bold: true })],
        heading: HeadingLevel.TITLE,
        spacing: { after: 300 },
    }))

    for (let modIdx = 0; modIdx < parseResult.modules.length; modIdx++) {
        const mod = parseResult.modules[modIdx]
        children.push(new Paragraph({
            children: [makeText(`${modIdx + 1}. ${mod.name}`, { size: 32, bold: true })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
        }))

        if (mod.basePath) {
            children.push(new Paragraph({
                children: [makeText(`基础路径: ${mod.basePath}`, { size: 18, color: '666666' })],
                spacing: { after: 200 },
            }))
        }

        for (let apiIdx = 0; apiIdx < mod.apis.length; apiIdx++) {
            const api = mod.apis[apiIdx]
            children.push(new Paragraph({
                children: [makeText(`${modIdx + 1}.${apiIdx + 1} ${api.summary}`, { size: 26, bold: true })],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
            }))

            for (const modId of enabledIds) {
                switch (modId) {
                    case 'method':
                        children.push(new Paragraph({
                            children: [
                                makeText('请求方式：', { size: 21, bold: true }),
                                makeText(api.method, { size: 21 }),
                            ],
                            spacing: { after: 80 },
                        }))
                        break

                    case 'path':
                        children.push(new Paragraph({
                            children: [
                                makeText('请求地址：', { size: 21, bold: true }),
                                makeText(api.path, { size: 21 }),
                            ],
                            spacing: { after: 80 },
                        }))
                        break

                    case 'summary': {
                        const desc = exportText(api.description)
                        if (desc !== '-') {
                            children.push(new Paragraph({
                                children: [
                                    makeText('接口说明：', { size: 21, bold: true }),
                                    makeText(desc, { size: 21 }),
                                ],
                                spacing: { after: 80 },
                            }))
                        }
                        break
                    }

                    case 'params': {
                        // 查询/路径参数表
                        if (api.params.length > 0) {
                            children.push(new Paragraph({
                                children: [makeText('请求参数：', { size: 21, bold: true })],
                                spacing: { before: 100, after: 60 },
                            }))
                            const rows = [
                                new TableRow({
                                    children: [
                                        makeHeaderCell('参数名', 25),
                                        makeHeaderCell('类型', 20),
                                        makeHeaderCell('是否必须', 15),
                                        makeHeaderCell('说明', 40),
                                    ],
                                }),
                                ...api.params.map(p => new TableRow({
                                    children: [
                                        makeCell(p.name),
                                        makeCell(p.type),
                                        makeCell(p.required ? '是' : '否'),
                                        makeCell(exportText(p.description)),
                                    ],
                                })),
                            ]
                            children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS }))
                        }
                        // 请求体参数表
                        if (api.requestBody && api.requestBody.fields.length > 0) {
                            children.push(new Paragraph({
                                children: [makeText(`请求体 (${api.requestBody.type})：`, { size: 21, bold: true })],
                                spacing: { before: 100, after: 60 },
                            }))
                            const rows = [
                                new TableRow({
                                    children: [
                                        makeHeaderCell('参数名', 25),
                                        makeHeaderCell('类型', 20),
                                        makeHeaderCell('是否必须', 15),
                                        makeHeaderCell('说明', 40),
                                    ],
                                }),
                                ...api.requestBody.fields.map(f => new TableRow({
                                    children: [
                                        makeCell(f.name),
                                        makeCell(f.type),
                                        makeCell(f.required ? '是' : '否'),
                                        makeCell(exportText(f.description)),
                                    ],
                                })),
                            ]
                            children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS }))
                        }
                        break
                    }

                    case 'response': {
                        if (api.response && api.response.fields.length > 0) {
                            children.push(new Paragraph({
                                children: [makeText(`返回数据 (${api.response.type})：`, { size: 21, bold: true })],
                                spacing: { before: 100, after: 60 },
                            }))
                            const rows = [
                                new TableRow({
                                    children: [
                                        makeHeaderCell('参数名', 30),
                                        makeHeaderCell('类型', 25),
                                        makeHeaderCell('说明', 45),
                                    ],
                                }),
                                ...api.response.fields.map(f => new TableRow({
                                    children: [
                                        makeCell(f.name),
                                        makeCell(f.type),
                                        makeCell(exportText(f.description)),
                                    ],
                                })),
                            ]
                            children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS }))
                        }
                        break
                    }

                    case 'requestExample':
                        if (api.requestBody && api.requestBody.example) {
                            children.push(new Paragraph({
                                children: [makeText('请求示例：', { size: 21, bold: true })],
                                spacing: { before: 100, after: 60 },
                            }))
                            children.push(new Paragraph({
                                children: [makeText(JSON.stringify(api.requestBody.example, null, 2), { size: 18 })],
                                spacing: { after: 80 },
                            }))
                        }
                        break

                    case 'responseExample':
                        if (api.response && api.response.example) {
                            children.push(new Paragraph({
                                children: [makeText('返回示例：', { size: 21, bold: true })],
                                spacing: { before: 100, after: 60 },
                            }))
                            children.push(new Paragraph({
                                children: [makeText(JSON.stringify(api.response.example, null, 2), { size: 18 })],
                                spacing: { after: 80 },
                            }))
                        }
                        break
                }
            }
        }
    }

    const doc = new Document({
        sections: [{ children }],
    })

    const blob = await Packer.toBlob(doc)
    return new Uint8Array(await blob.arrayBuffer())
}
