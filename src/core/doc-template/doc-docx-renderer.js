/**
 * 文档 Word 导出渲染器
 * 将章节树渲染为专业的 Word (.docx) 文档
 */
import {
    Document, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, BorderStyle, WidthType,
    PageBreak, Packer, Header, Footer, PageNumber,
    convertMillimetersToTwip, TableOfContents,
} from 'docx'

const FONT_NAME = '微软雅黑'
const FONT_EN = 'Calibri'

const TABLE_BORDER = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: 'aaaaaa',
}
const TABLE_BORDERS = {
    top: TABLE_BORDER,
    bottom: TABLE_BORDER,
    left: TABLE_BORDER,
    right: TABLE_BORDER,
    insideHorizontal: TABLE_BORDER,
    insideVertical: TABLE_BORDER,
}

// ==================== 工具函数 ====================

function makeText(text, options = {}) {
    return new TextRun({
        text,
        font: { name: options.font || FONT_NAME, eastAsia: FONT_NAME },
        size: options.size || 21,
        bold: options.bold || false,
        color: options.color,
        italics: options.italics || false,
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
 * 获取标题级别
 */
function getHeadingLevel(number) {
    const depth = number.split('.').length
    switch (depth) {
        case 1: return HeadingLevel.HEADING_1
        case 2: return HeadingLevel.HEADING_2
        case 3: return HeadingLevel.HEADING_3
        default: return HeadingLevel.HEADING_4
    }
}

/**
 * 获取标题字号（半磅）
 */
function getHeadingSize(number) {
    const depth = number.split('.').length
    switch (depth) {
        case 1: return 36  // 三号
        case 2: return 28  // 小三
        case 3: return 24  // 四号
        default: return 21 // 小四
    }
}

// ==================== 封面页 ====================

function createCoverPage(docInfo) {
    const { docTitle, projectName, version, author, date, organization } = docInfo
    const children = []

    // 上方留白
    for (let i = 0; i < 8; i++) {
        children.push(new Paragraph({ children: [], spacing: { after: 200 } }))
    }

    // 文档标题
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [makeText(docTitle || '文档标题', { size: 52, bold: true })],
        spacing: { after: 600 },
    }))

    // 项目名称
    if (projectName) {
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [makeText(projectName, { size: 36, color: '444444' })],
            spacing: { after: 800 },
        }))
    }

    // 分割线
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [makeText('━━━━━━━━━━━━━━━━━━━━━━━━', { size: 21, color: 'cccccc' })],
        spacing: { after: 600 },
    }))

    // 信息表
    const infoItems = [
        ['版本号', version || 'V1.0'],
        ['编写人', author || ''],
        ['编写日期', date || new Date().toISOString().slice(0, 10)],
    ]
    if (organization) {
        infoItems.push(['编写单位', organization])
    }

    for (const [label, value] of infoItems) {
        if (!value) continue
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                makeText(`${label}：`, { size: 24, bold: true }),
                makeText(value, { size: 24 }),
            ],
            spacing: { after: 150 },
        }))
    }

    // 分页
    children.push(new Paragraph({
        children: [new PageBreak()],
    }))

    return children
}

// ==================== 页眉页脚 ====================

function createDocHeader(docTitle) {
    return new Header({
        children: [
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    makeText(docTitle || '', { size: 18, color: '888888' }),
                ],
            }),
        ],
    })
}

function createDocFooter() {
    return new Footer({
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    makeText('第 ', { size: 18 }),
                    new TextRun({ children: [PageNumber.CURRENT], font: { name: FONT_NAME }, size: 18 }),
                    makeText(' 页 共 ', { size: 18 }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], font: { name: FONT_NAME }, size: 18 }),
                    makeText(' 页', { size: 18 }),
                ],
            }),
        ],
    })
}

// ==================== 内容渲染 ====================

/**
 * 将 Markdown 文本解析为基础 docx 段落
 * 支持：标题(####)、加粗、列表、表格、代码块、普通段落
 */
function parseMarkdownToParagraphs(markdownText) {
    if (!markdownText) return []
    const lines = markdownText.split('\n')
    const paragraphs = []
    let inCodeBlock = false
    let inTable = false
    let tableRows = []

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // 代码块
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock
            continue
        }
        if (inCodeBlock) {
            paragraphs.push(new Paragraph({
                children: [new TextRun({ text: line, font: { name: 'Consolas' }, size: 17, color: '333333' })],
                spacing: { before: 0, after: 0, line: 276 },
                shading: { fill: 'f5f5f5' },
            }))
            continue
        }

        // 空行
        if (line.trim() === '') {
            // 如果前面在表格模式中，结束表格
            if (inTable && tableRows.length > 0) {
                paragraphs.push(buildDocxTable(tableRows))
                tableRows = []
                inTable = false
            }
            continue
        }

        // 表格行
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            // 跳过分隔行
            if (/^\|[\s-|:]+\|$/.test(line.trim())) {
                continue
            }
            inTable = true
            const cells = line.trim().split('|').filter(c => c.trim() !== '').map(c => c.trim())
            tableRows.push(cells)
            continue
        } else if (inTable && tableRows.length > 0) {
            paragraphs.push(buildDocxTable(tableRows))
            tableRows = []
            inTable = false
        }

        // 标题
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
        if (headingMatch) {
            const level = headingMatch[1].length
            const text = headingMatch[2]
            const headingLevels = [null, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2,
                HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_4, HeadingLevel.HEADING_4]
            const sizes = [0, 36, 28, 24, 21, 21, 21]
            paragraphs.push(new Paragraph({
                children: [makeText(text, { size: sizes[level] || 21, bold: true })],
                heading: headingLevels[level] || HeadingLevel.HEADING_4,
                spacing: { before: 200, after: 100 },
            }))
            continue
        }

        // 列表
        const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/)
        if (listMatch) {
            const indent = Math.floor(listMatch[1].length / 2)
            const text = listMatch[3]
            paragraphs.push(new Paragraph({
                children: parseInlineFormatting(`• ${text}`),
                indent: { left: convertMillimetersToTwip(5 * (indent + 1)) },
                spacing: { before: 40, after: 40 },
            }))
            continue
        }

        // 普通段落
        paragraphs.push(new Paragraph({
            children: parseInlineFormatting(line),
            spacing: { before: 60, after: 60 },
        }))
    }

    // 处理末尾残留的表格
    if (inTable && tableRows.length > 0) {
        paragraphs.push(buildDocxTable(tableRows))
    }

    return paragraphs
}

/**
 * 解析行内格式（加粗）
 */
function parseInlineFormatting(text) {
    const runs = []
    const regex = /\*\*(.+?)\*\*/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            runs.push(makeText(text.substring(lastIndex, match.index)))
        }
        runs.push(makeText(match[1], { bold: true }))
        lastIndex = regex.lastIndex
    }
    if (lastIndex < text.length) {
        runs.push(makeText(text.substring(lastIndex)))
    }
    if (runs.length === 0) {
        runs.push(makeText(text))
    }
    return runs
}

/**
 * 将二维数组构建为 docx 表格
 */
function buildDocxTable(rows) {
    if (rows.length === 0) return new Paragraph({ children: [] })

    const docxRows = rows.map((cells, rowIdx) => {
        return new TableRow({
            children: cells.map(cellText =>
                rowIdx === 0
                    ? makeHeaderCell(cellText, Math.floor(100 / cells.length))
                    : makeCell(cellText)
            ),
        })
    })

    return new Table({
        rows: docxRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
    })
}

// ==================== 主渲染函数 ====================

/**
 * 将章节树渲染为 Word 文档 buffer
 * @param {Array} sections - 章节树
 * @param {Object} docInfo - 文档信息 { docTitle, projectName, version, author, date, organization }
 * @param {Object} options - 选项 { includeCover, includeToc }
 * @returns {Promise<Uint8Array>}
 */
export async function renderDocSections(sections, docInfo = {}, options = {}) {
    const {
        includeCover = true,
        includeToc = true,
    } = options

    const children = []

    // 封面页
    if (includeCover) {
        children.push(...createCoverPage(docInfo))
    }

    // 目录页
    if (includeToc) {
        children.push(new Paragraph({
            children: [makeText('目  录', { size: 36, bold: true })],
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }))
        children.push(new TableOfContents('目录', {
            hyperlink: true,
            headingStyleRange: '1-4',
        }))
        children.push(new Paragraph({
            children: [new PageBreak()],
        }))
    }

    // 渲染章节内容
    renderSectionsToChildren(sections, children)

    const doc = new Document({
        features: { updateFields: true },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertMillimetersToTwip(25),
                        bottom: convertMillimetersToTwip(25),
                        left: convertMillimetersToTwip(30),
                        right: convertMillimetersToTwip(25),
                    },
                },
            },
            headers: { default: createDocHeader(docInfo.docTitle) },
            footers: { default: createDocFooter() },
            children,
        }],
    })

    const blob = await Packer.toBlob(doc)
    return new Uint8Array(await blob.arrayBuffer())
}

/**
 * 递归渲染章节到 children 数组
 */
function renderSectionsToChildren(sections, children) {
    for (const sec of sections) {
        if (!sec.enabled) continue

        const headingSize = getHeadingSize(sec.number)

        // 章节标题
        children.push(new Paragraph({
            children: [makeText(`${sec.number} ${sec.title}`, { size: headingSize, bold: true })],
            heading: getHeadingLevel(sec.number),
            spacing: { before: 300, after: 150 },
        }))

        // 章节内容
        if (sec.type === 'diagram') {
            // 图表类型：如果有 Mermaid 代码，显示代码说明
            if (sec.mermaidCode) {
                children.push(new Paragraph({
                    children: [makeText('（图表请参见附件或使用 Mermaid 渲染以下代码）', { size: 18, color: '888888', italics: true })],
                    spacing: { after: 100 },
                }))
                // 嵌入 Mermaid 源代码
                const mermaidLines = sec.mermaidCode.split('\n')
                for (const line of mermaidLines) {
                    children.push(new Paragraph({
                        children: [new TextRun({ text: line, font: { name: 'Consolas' }, size: 16, color: '2d5f2d' })],
                        spacing: { before: 0, after: 0, line: 276 },
                        shading: { fill: 'f8f9fa' },
                    }))
                }
                children.push(new Paragraph({ children: [], spacing: { after: 100 } }))
            }

            // 如果有用户上传的图片
            if (sec.imageData) {
                try {
                    const imageBuffer = base64ToArrayBuffer(sec.imageData)
                    children.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new ImageRun({
                                data: imageBuffer,
                                transformation: { width: 500, height: 350 },
                                type: 'png',
                            }),
                        ],
                        spacing: { before: 100, after: 100 },
                    }))
                } catch (e) {
                    children.push(new Paragraph({
                        children: [makeText('[图片加载失败]', { color: 'cc0000', italics: true })],
                    }))
                }
            }

            // 图表下方的文字说明
            if (sec.content) {
                children.push(...parseMarkdownToParagraphs(sec.content))
            }
        } else if (sec.type === 'image') {
            // 纯图片类型
            if (sec.imageData) {
                try {
                    const imageBuffer = base64ToArrayBuffer(sec.imageData)
                    children.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new ImageRun({
                                data: imageBuffer,
                                transformation: { width: 500, height: 350 },
                                type: 'png',
                            }),
                        ],
                        spacing: { before: 100, after: 100 },
                    }))
                } catch (e) {
                    children.push(new Paragraph({
                        children: [makeText('[图片占位：请在预览中上传图片]', { color: '888888', italics: true })],
                    }))
                }
            } else {
                children.push(new Paragraph({
                    children: [makeText('[图片占位：请在预览中上传图片]', { color: '888888', italics: true })],
                    spacing: { after: 100 },
                }))
            }
            if (sec.content) {
                children.push(...parseMarkdownToParagraphs(sec.content))
            }
        } else {
            // text / table 类型
            if (sec.content) {
                children.push(...parseMarkdownToParagraphs(sec.content))
            }
        }

        // 递归渲染子章节
        if (sec.children && sec.children.length > 0) {
            renderSectionsToChildren(sec.children, children)
        }
    }
}

/**
 * Base64 → ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
    // 去掉 data:image/xxx;base64, 前缀
    const raw = base64.includes(',') ? base64.split(',')[1] : base64
    const binary = atob(raw)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
}
