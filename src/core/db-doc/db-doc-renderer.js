/**
 * 数据库文档渲染器
 * 生成 Markdown / Word / Mermaid ER 图
 */
import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, BorderStyle, HeadingLevel, AlignmentType
} from 'docx'

// ==================== 占位符 ====================

const PLACEHOLDER_PREFIX = '{{AI_FILL:'
const PLACEHOLDER_SUFFIX = '}}'

/**
 * 生成占位符文本
 */
export function makePlaceholder(fieldName, tableName) {
    return `${PLACEHOLDER_PREFIX}${tableName}.${fieldName}${PLACEHOLDER_SUFFIX}`
}

/**
 * 判断是否为占位符
 */
export function isDbPlaceholder(text) {
    if (!text) return false
    return text.startsWith(PLACEHOLDER_PREFIX) && text.endsWith(PLACEHOLDER_SUFFIX)
}

/**
 * 处理列注释，缺失时填充占位符
 */
export function processColumnComment(column) {
    if (column.comment && column.comment.trim()) {
        return column.comment.trim()
    }
    return makePlaceholder(column.name, column.table_name)
}

/**
 * 处理表注释
 */
export function processTableComment(table) {
    if (table.comment && table.comment.trim()) {
        return table.comment.trim()
    }
    return makePlaceholder('TABLE_COMMENT', table.name)
}

// ==================== ER 图 ====================

/**
 * 生成 Mermaid erDiagram 代码
 */
export function generateErMermaid(tables, columns, foreignKeys, options = {}) {
    const { showComments = true } = options
    const lines = ['erDiagram']

    // 实体定义
    for (const table of tables) {
        const tableCols = columns.filter(c => c.table_name === table.name)
        const sanitizedName = sanitizeMermaidId(table.name)
        lines.push(`    ${sanitizedName} {`)
        // 表注释作为第一行
        if (showComments && table.comment && table.comment.trim()) {
            const tc = table.comment.trim().substring(0, 30).replace(/"/g, "'")
            lines.push(`        string ___${sanitizedName}_desc___ "${tc}"`)
        }
        // 只展示 PK/FK 和前几个关键字段，避免过长
        const maxCols = 15
        const showCols = tableCols.slice(0, maxCols)
        for (const col of showCols) {
            const pkMark = col.is_primary_key ? 'PK' : ''
            const fk = foreignKeys.find(f => f.table_name === table.name && f.column_name === col.name)
            const fkMark = fk ? 'FK' : ''
            const marks = [pkMark, fkMark].filter(Boolean).join(',')
            const marksStr = marks ? ` ${marks}` : ''
            const sanitizedType = col.full_type.replace(/[^a-zA-Z0-9_]/g, '')
            const comment = (showComments && col.comment) ? ` "${col.comment.substring(0, 20)}"` : ''
            lines.push(`        ${sanitizedType} ${sanitizeMermaidId(col.name)}${marksStr}${comment}`)
        }
        if (tableCols.length > maxCols) {
            lines.push(`        string ___more_${tableCols.length - maxCols}_fields___`)
        }
        lines.push('    }')
    }

    // 关系定义
    for (const fk of foreignKeys) {
        const from = sanitizeMermaidId(fk.table_name)
        const to = sanitizeMermaidId(fk.ref_table)
        lines.push(`    ${from} }o--|| ${to} : "${fk.column_name}"`)
    }

    return lines.join('\n')
}

/**
 * 生成表关系依赖图 (graph TD)
 * 显示所有表之间的引用关系，即使没有外键也展示独立表
 */
/**
 * 生成单张表的 Chen 式实体关系图 SVG
 * 表名矩形居中，字段椭圆放射排列
 */
export function generateTableEntitySvg(table, columns, foreignKeys = []) {
    const cols = columns.filter(c => c.table_name === table.name)
    const fkCols = new Set(foreignKeys.filter(f => f.table_name === table.name).map(f => f.column_name))
    const count = cols.length
    if (count === 0) return '<svg></svg>'

    // 布局参数
    const radius = Math.max(200, count * 22)
    const centerX = radius + 180
    const centerY = radius + 100
    const svgW = (radius + 180) * 2
    const svgH = (radius + 100) * 2
    const ellipseRx = 75
    const ellipseRy = 28
    const rectW = 160
    const rectH = 55

    // 表注释
    const tableComment = table.comment && table.comment.trim() ? table.comment.trim() : table.name
    const tableName = table.name

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family:'Microsoft YaHei',sans-serif;">\n`

    // 背景
    svg += `  <rect width="${svgW}" height="${svgH}" fill="transparent"/>\n`

    // 连线（先画，在下层）
    for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2
        const ex = centerX + radius * Math.cos(angle)
        const ey = centerY + radius * Math.sin(angle)
        svg += `  <line x1="${centerX}" y1="${centerY}" x2="${ex}" y2="${ey}" stroke="#94a3b8" stroke-width="1.5"/>\n`
    }

    // 中心矩形（表名）
    const rx1 = centerX - rectW / 2
    const ry1 = centerY - rectH / 2
    svg += `  <rect x="${rx1}" y="${ry1}" width="${rectW}" height="${rectH}" rx="4" fill="#4f46e5" stroke="#6366f1" stroke-width="2"/>\n`
    svg += `  <text x="${centerX}" y="${centerY - 8}" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">${escSvg(tableComment)}</text>\n`
    svg += `  <text x="${centerX}" y="${centerY + 14}" text-anchor="middle" fill="#c7d2fe" font-size="11">${escSvg(tableName)}</text>\n`

    // 字段椭圆
    for (let i = 0; i < count; i++) {
        const col = cols[i]
        const angle = (2 * Math.PI * i) / count - Math.PI / 2
        const ex = centerX + radius * Math.cos(angle)
        const ey = centerY + radius * Math.sin(angle)
        const isPk = col.is_primary_key
        const isFk = fkCols.has(col.name)

        // 椭圆
        const fillColor = isPk ? '#f59e0b' : isFk ? '#3b82f6' : '#1e293b'
        const strokeColor = isPk ? '#fbbf24' : isFk ? '#60a5fa' : '#475569'
        const textColor = isPk || isFk ? '#fff' : '#e2e8f0'

        svg += `  <ellipse cx="${ex}" cy="${ey}" rx="${ellipseRx}" ry="${ellipseRy}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>\n`

        // 注释（上方）
        const comment = col.comment && col.comment.trim() ? col.comment.trim() : ''
        if (comment) {
            const truncated = comment.length > 12 ? comment.substring(0, 11) + '…' : comment
            svg += `  <text x="${ex}" y="${ey - 5}" text-anchor="middle" fill="${textColor}" font-size="12" font-weight="bold">${escSvg(truncated)}</text>\n`
            svg += `  <text x="${ex}" y="${ey + 12}" text-anchor="middle" fill="${textColor}" font-size="10" opacity="0.8">${escSvg(col.name)}</text>\n`
        } else {
            svg += `  <text x="${ex}" y="${ey + 4}" text-anchor="middle" fill="${textColor}" font-size="12" font-weight="500">${escSvg(col.name)}</text>\n`
        }

        // PK 下划线标记
        if (isPk) {
            const nameLen = col.name.length * 3.5
            svg += `  <line x1="${ex - nameLen}" y1="${ey + (comment ? 14 : 6)}" x2="${ex + nameLen}" y2="${ey + (comment ? 14 : 6)}" stroke="${textColor}" stroke-width="1"/>\n`
        }
    }

    svg += '</svg>'
    return svg
}

function escSvg(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function sanitizeMermaidId(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_')
}

// ==================== Markdown 渲染 ====================

/**
 * 渲染数据库文档为 Markdown
 */
export function renderDbMarkdown(schema, options = {}) {
    const { includeToc = true, includeEr = true, includeIndexes = true } = options
    const lines = []
    const tables = schema.tables || []
    const columns = schema.columns || []
    const foreignKeys = schema.foreign_keys || []
    const indexes = schema.indexes || []

    // Title
    lines.push('# 数据库设计文档')
    lines.push('')

    // 概览
    lines.push('## 概览')
    lines.push('')
    lines.push(`- **表数量**: ${tables.length}`)
    lines.push(`- **字段总数**: ${columns.length}`)
    lines.push(`- **外键关系**: ${foreignKeys.length}`)
    lines.push(`- **索引数量**: ${indexes.length}`)
    lines.push('')

    // 目录
    if (includeToc && tables.length > 0) {
        lines.push('## 表目录')
        lines.push('')
        lines.push('| 序号 | 表名 | 说明 | 字段数 |')
        lines.push('| --- | --- | --- | --- |')
        tables.forEach((t, i) => {
            const colCount = columns.filter(c => c.table_name === t.name).length
            const comment = processTableComment(t)
            lines.push(`| ${i + 1} | \`${t.name}\` | ${stripPlaceholder(comment)} | ${colCount} |`)
        })
        lines.push('')
    }

    // 各表详情
    lines.push('## 表结构详情')
    lines.push('')

    for (const table of tables) {
        const tableCols = columns.filter(c => c.table_name === table.name)
        const tableIndexes = indexes.filter(i => i.table_name === table.name)
        const tableFks = foreignKeys.filter(f => f.table_name === table.name)
        const tableComment = processTableComment(table)

        lines.push(`### ${table.name}`)
        lines.push('')
        lines.push(`**说明**: ${stripPlaceholder(tableComment)}`)
        if (table.row_count !== null && table.row_count !== undefined) {
            lines.push(`**预估行数**: ${table.row_count}`)
        }
        lines.push('')

        // 列表格
        lines.push('| 字段名 | 类型 | 可空 | 默认值 | 主键 | 说明 |')
        lines.push('| --- | --- | --- | --- | --- | --- |')
        for (const col of tableCols) {
            const nullable = col.is_nullable ? '✓' : '✗'
            const pk = col.is_primary_key ? '✓' : ''
            const def = col.default_value || '-'
            const comment = processColumnComment(col)
            lines.push(`| \`${col.name}\` | ${col.full_type} | ${nullable} | ${def} | ${pk} | ${stripPlaceholder(comment)} |`)
        }
        lines.push('')

        // 索引
        if (includeIndexes && tableIndexes.length > 0) {
            lines.push('**索引:**')
            lines.push('')
            lines.push('| 索引名 | 列 | 唯一 | 主键 |')
            lines.push('| --- | --- | --- | --- |')
            for (const idx of tableIndexes) {
                lines.push(`| ${idx.index_name} | ${idx.columns.join(', ')} | ${idx.is_unique ? '✓' : '✗'} | ${idx.is_primary ? '✓' : ''} |`)
            }
            lines.push('')
        }

        // 外键
        if (tableFks.length > 0) {
            lines.push('**外键:**')
            lines.push('')
            for (const fk of tableFks) {
                lines.push(`- \`${fk.column_name}\` → \`${fk.ref_table}.${fk.ref_column}\` (${fk.name})`)
            }
            lines.push('')
        }

        lines.push('---')
        lines.push('')
    }

    // ER 图
    if (includeEr && foreignKeys.length > 0) {
        lines.push('## ER 关系图')
        lines.push('')
        lines.push('```mermaid')
        lines.push(generateErMermaid(tables, columns, foreignKeys))
        lines.push('```')
        lines.push('')
    }

    return lines.join('\n')
}

function stripPlaceholder(text) {
    if (isDbPlaceholder(text)) return '*待补充*'
    return text
}

// ==================== Word (docx) 渲染 ====================

const BORDER_STYLE = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: 'CCCCCC',
}
const CELL_BORDERS = {
    top: BORDER_STYLE,
    bottom: BORDER_STYLE,
    left: BORDER_STYLE,
    right: BORDER_STYLE,
}

function headerCell(text) {
    return new TableCell({
        borders: CELL_BORDERS,
        shading: { fill: 'F0F0F0' },
        children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size: 20, font: '微软雅黑' })],
        })],
    })
}

function bodyCell(text, options = {}) {
    const runs = [new TextRun({
        text: text || '-',
        size: 20,
        font: '微软雅黑',
        ...options,
    })]
    return new TableCell({
        borders: CELL_BORDERS,
        children: [new Paragraph({ children: runs })],
    })
}

/**
 * 渲染数据库文档为 Word
 */
export async function renderDbDocx(schema, options = {}) {
    const { includeIndexes = true } = options
    const tables = schema.tables || []
    const columns = schema.columns || []
    const foreignKeys = schema.foreign_keys || []
    const indexes = schema.indexes || []

    const children = []

    // Title
    children.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun({ text: '数据库设计文档', bold: true, size: 36, font: '微软雅黑' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
    }))

    // 概览
    children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: '概览', bold: true, size: 28, font: '微软雅黑' })],
        spacing: { before: 300, after: 200 },
    }))
    children.push(new Paragraph({
        children: [new TextRun({ text: `表数量: ${tables.length}   字段总数: ${columns.length}   外键关系: ${foreignKeys.length}   索引数量: ${indexes.length}`, size: 22, font: '微软雅黑' })],
        spacing: { after: 200 },
    }))

    // 表目录
    children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: '表目录', bold: true, size: 28, font: '微软雅黑' })],
        spacing: { before: 300, after: 200 },
    }))

    const tocHeader = new TableRow({
        children: [headerCell('序号'), headerCell('表名'), headerCell('说明'), headerCell('字段数')],
    })
    const tocRows = tables.map((t, i) => {
        const colCount = columns.filter(c => c.table_name === t.name).length
        const comment = processTableComment(t)
        return new TableRow({
            children: [
                bodyCell(String(i + 1)),
                bodyCell(t.name),
                bodyCell(stripPlaceholder(comment)),
                bodyCell(String(colCount)),
            ],
        })
    })
    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [tocHeader, ...tocRows],
    }))

    // 各表详情
    children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: '表结构详情', bold: true, size: 28, font: '微软雅黑' })],
        spacing: { before: 400, after: 200 },
    }))

    for (const table of tables) {
        const tableCols = columns.filter(c => c.table_name === table.name)
        const tableIndexes = indexes.filter(i => i.table_name === table.name)
        const tableComment = processTableComment(table)

        children.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: table.name, bold: true, size: 24, font: '微软雅黑' })],
            spacing: { before: 300, after: 100 },
        }))
        children.push(new Paragraph({
            children: [new TextRun({ text: `说明: ${stripPlaceholder(tableComment)}`, size: 21, font: '微软雅黑' })],
            spacing: { after: 100 },
        }))

        // 列表格
        const colHeader = new TableRow({
            children: [
                headerCell('字段名'), headerCell('类型'), headerCell('可空'),
                headerCell('默认值'), headerCell('主键'), headerCell('说明'),
            ],
        })
        const colRows = tableCols.map(col => {
            const comment = processColumnComment(col)
            return new TableRow({
                children: [
                    bodyCell(col.name),
                    bodyCell(col.full_type),
                    bodyCell(col.is_nullable ? '✓' : '✗'),
                    bodyCell(col.default_value || '-'),
                    bodyCell(col.is_primary_key ? '✓' : ''),
                    bodyCell(stripPlaceholder(comment)),
                ],
            })
        })
        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [colHeader, ...colRows],
        }))

        // 索引
        if (includeIndexes && tableIndexes.length > 0) {
            children.push(new Paragraph({
                children: [new TextRun({ text: '索引:', bold: true, size: 21, font: '微软雅黑' })],
                spacing: { before: 150, after: 50 },
            }))
            const idxHeader = new TableRow({
                children: [headerCell('索引名'), headerCell('列'), headerCell('唯一'), headerCell('主键')],
            })
            const idxRows = tableIndexes.map(idx => new TableRow({
                children: [
                    bodyCell(idx.index_name),
                    bodyCell(idx.columns.join(', ')),
                    bodyCell(idx.is_unique ? '✓' : '✗'),
                    bodyCell(idx.is_primary ? '✓' : ''),
                ],
            }))
            children.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [idxHeader, ...idxRows],
            }))
        }
    }

    const doc = new Document({
        sections: [{ children }],
    })

    const blob = await Packer.toBlob(doc)
    return new Uint8Array(await blob.arrayBuffer())
}
