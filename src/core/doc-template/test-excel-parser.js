/**
 * Excel 原始数据提取器
 * 从用户上传的 Excel 文件中提取所有原始数据和嵌入图片
 * 不做列匹配/语义判断，交给 AI 自行理解数据含义
 */
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

// ==================== MIME 类型映射 ====================
const EXT_MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp',
    tiff: 'image/tiff', tif: 'image/tiff', emf: 'image/x-emf', wmf: 'image/x-wmf',
}

export const TEST_EXCEL_LIMITS = Object.freeze({
    maxTotalRows: 5000,
    maxRowsPerSheet: 2000,
    maxColumnsPerSheet: 100,
    maxCellChars: 4000,
    maxMarkdownRowsPerSheet: 200,
    maxImages: 30,
    maxImageBytes: 3 * 1024 * 1024,
    maxTotalImageBytes: 20 * 1024 * 1024,
})

/**
 * 从 ArrayBuffer 读取 Excel 并提取原始数据（含图片）
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {Promise<{ sheets: Array<{ name, headers, rows, totalRows, images, imageCount }> }>}
 */
export async function parseTestExcel(buffer) {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)

    // 先完成 ZIP 图片提取，再解析工作簿，降低两套解析结构同时驻留的峰值。
    let imagesBySheetFile = {}
    let sheetFileMapping = {}
    let imageStats = { retainedImages: 0, omittedImages: 0, totalImageBytes: 0 }
    try {
        const extraction = await extractImagesFromXlsx(uint8)
        imagesBySheetFile = extraction.imagesBySheetFile
        sheetFileMapping = extraction.sheetFileMapping
        imageStats = extraction.imageStats
    } catch (e) {
        console.warn('图片提取失败（不影响文字数据）:', e)
    }
    const workbook = XLSX.read(uint8, { type: 'array' })

    const sheets = []
    let retainedRows = 0
    let omittedRows = 0

    for (let sheetIdx = 0; sheetIdx < workbook.SheetNames.length; sheetIdx++) {
        const sheetName = workbook.SheetNames[sheetIdx]
        const sheet = workbook.Sheets[sheetName]
        if (!sheet?.['!ref']) continue

        const sourceRange = XLSX.utils.decode_range(sheet['!ref'])
        const remainingRows = Math.max(0, TEST_EXCEL_LIMITS.maxTotalRows - retainedRows)
        const sheetRowLimit = Math.min(TEST_EXCEL_LIMITS.maxRowsPerSheet, remainingRows)
        if (sheetRowLimit === 0) {
            omittedRows += Math.max(0, sourceRange.e.r - sourceRange.s.r)
            continue
        }

        // 只解码当前会保留的行列，避免 sheet_to_json 先创建一份无界的二维数组。
        const readRange = {
            s: sourceRange.s,
            e: {
                r: Math.min(sourceRange.e.r, sourceRange.s.r + sheetRowLimit + 5),
                c: Math.min(sourceRange.e.c, sourceRange.s.c + TEST_EXCEL_LIMITS.maxColumnsPerSheet - 1),
            },
        }
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', range: readRange })
        if (!jsonData || jsonData.length < 2) continue

        // 找出表头行（前5行中最像表头的行）
        const headerRowIndex = findHeaderRow(jsonData)
        const rawHeaders = jsonData[headerRowIndex] || []
        const headerEntries = rawHeaders
            .map((cell, index) => ({ name: normalizeHeader(cell), index }))
            .filter(entry => entry.name)
        const headers = headerEntries.map(entry => entry.name)

        if (headers.length < 2) continue

        // 该 sheet 的图片
        const sheetFileName = sheetFileMapping[sheetName]
        const sheetImages = sheetFileName ? (imagesBySheetFile[sheetFileName] || {}) : {}

        // 提取数据行（表头之后的所有非空行）
        const dataRows = jsonData.slice(headerRowIndex + 1)
            .map((row, offset) => ({
                row,
                actualRow: readRange.s.r + headerRowIndex + 1 + offset,
            }))
            .filter(({ row }) => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))
            .slice(0, sheetRowLimit)

        const rows = dataRows.map(({ row, actualRow }) => {
            // 以标准化表头为 key 构建一行数据
            const obj = {}
            for (const header of headerEntries) {
                obj[header.name] = normalizeCell(row[header.index])
            }

            // 查找该行关联的图片
            const rowImages = []
            for (const [, img] of Object.entries(sheetImages)) {
                if (img.row === actualRow) {
                    rowImages.push(img)
                }
            }
            if (rowImages.length > 0) {
                obj._images = rowImages
            }
            obj._rowIndex = actualRow

            return obj
        }).filter(obj => {
            const vals = Object.entries(obj).filter(([k]) => !k.startsWith('_')).map(([, v]) => v)
            return vals.some(v => v !== '')
        })

        const sourceTotalRows = Math.max(rows.length, sourceRange.e.r - (sourceRange.s.r + headerRowIndex))
        const sheetOmittedRows = Math.max(0, sourceTotalRows - rows.length)
        retainedRows += rows.length
        omittedRows += sheetOmittedRows
        const retainedRowNumbers = new Set(rows.map(row => row._rowIndex))
        const allSheetImages = Object.values(sheetImages).filter(img => retainedRowNumbers.has(img.row))

        if (rows.length > 0) {
            sheets.push({
                name: sheetName,
                headers,
                rows,
                totalRows: rows.length,
                sourceTotalRows,
                omittedRows: sheetOmittedRows,
                truncated: sheetOmittedRows > 0 || sourceRange.e.c > readRange.e.c,
                images: allSheetImages,
                imageCount: allSheetImages.length,
            })
        }
    }

    return {
        sheets,
        limits: {
            ...TEST_EXCEL_LIMITS,
            retainedRows,
            omittedRows,
            retainedImages: imageStats.retainedImages,
            omittedImages: imageStats.omittedImages,
            totalImageBytes: imageStats.totalImageBytes,
            truncated: omittedRows > 0 || imageStats.omittedImages > 0,
        },
    }
}

/**
 * 将所有 sheet 数据转为完整的 Markdown 文本，供 AI 上下文使用
 * @param {{ sheets: Array }} excelData - parseTestExcel 的返回值
 * @returns {string} 完整的 Markdown 表格文本
 */
export function sheetsToMarkdown(excelData) {
    if (!excelData || !excelData.sheets || excelData.sheets.length === 0) return ''
    let md = ''

    for (const sheet of excelData.sheets) {
        md += `\n### 工作表: ${sheet.name}（${sheet.totalRows} 条数据）\n\n`
        md += `**列名：** ${sheet.headers.join('、')}\n\n`

        // 构建 Markdown 表格
        const lines = [
            `| ${sheet.headers.join(' | ')} |`,
            `| ${sheet.headers.map(() => '---').join(' | ')} |`,
        ]
        const markdownRows = sheet.rows.slice(0, TEST_EXCEL_LIMITS.maxMarkdownRowsPerSheet)
        for (const row of markdownRows) {
            const cells = sheet.headers.map(h => {
                const val = row[h] || ''
                return val.replace(/\|/g, '｜').replace(/[\r\n]+/g, ' ').trim() || '-'
            })
            lines.push(`| ${cells.join(' | ')} |`)
        }
        md += lines.join('\n')
        if (sheet.rows.length > markdownRows.length) {
            md += `\n\n> 为控制生成上下文，本工作表仅展示前 ${markdownRows.length} 条；其余数据已拆分到对应生成章节。`
        }

        // 标注含图片的行
        const imgRows = sheet.rows.filter(r => r._images?.length > 0)
        if (imgRows.length > 0) {
            md += '\n\n**含截图的行：** '
            md += imgRows.map(r => `行${r._rowIndex + 1}（${r._images.length}张）`).join('、')
            md += '\n'
        }
    }

    return md
}

/**
 * 获取 Excel 数据的基础统计信息（不做语义判断）
 */
export function getBasicStats(excelData) {
    if (!excelData || !excelData.sheets) return null
    const totalRows = excelData.sheets.reduce((sum, s) => sum + s.totalRows, 0)
    const totalImages = excelData.sheets.reduce((sum, s) => sum + (s.imageCount || 0), 0)
    const allHeaders = excelData.sheets.flatMap(s => s.headers)
    return {
        totalRows,
        totalImages,
        sourceTotalRows: totalRows + (excelData.limits?.omittedRows || 0),
        omittedRows: excelData.limits?.omittedRows || 0,
        omittedImages: excelData.limits?.omittedImages || 0,
        sheetCount: excelData.sheets.length,
        allHeaders,
    }
}

// ==================== 内部工具函数 ====================

/**
 * 标准化表头：去除换行、多余空格、制表符
 */
function normalizeHeader(val) {
    return String(val || '').replace(/[\r\n\t]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * 标准化单元格值
 * 自动转换 Excel 序列号日期为 YYYY-MM-DD
 */
function normalizeCell(val) {
    if (val === null || val === undefined) return ''
    if (typeof val === 'number' && val > 40000 && val < 55000 && Number.isInteger(val)) {
        return excelDateToString(val)
    }
    const normalized = String(val).replace(/[\r]/g, '').trim()
    return normalized.length > TEST_EXCEL_LIMITS.maxCellChars
        ? normalized.slice(0, TEST_EXCEL_LIMITS.maxCellChars) + '…'
        : normalized
}

/**
 * Excel 序列号转日期字符串
 */
function excelDateToString(serial) {
    const baseDate = new Date(1899, 11, 30)
    const date = new Date(baseDate.getTime() + serial * 86400000)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/**
 * 查找最可能的表头行索引
 * 策略：前5行中，非数字短文本最多的行
 */
function findHeaderRow(data) {
    const maxScan = Math.min(data.length, 5)
    let bestScore = 0
    let bestIndex = 0

    for (let i = 0; i < maxScan; i++) {
        const row = data[i]
        if (!row || row.length < 2) continue
        const cells = row.map(c => normalizeHeader(c)).filter(h => h !== '')
        if (cells.length < 2) continue

        let score = cells.length // 非空列越多越好
        for (const cell of cells) {
            if (isNaN(Number(cell)) && cell.length < 30) score += 2 // 更像表头
        }

        if (score > bestScore) {
            bestScore = score
            bestIndex = i
        }
    }

    return bestIndex
}

// ==================== 图片提取 ====================

async function extractImagesFromXlsx(uint8) {
    const zip = await JSZip.loadAsync(uint8)
    const imagesBySheetFile = {}

    // 1. 读取 xl/media/ 下所有图片
    const mediaMap = {}
    const imageStats = { retainedImages: 0, omittedImages: 0, totalImageBytes: 0 }
    for (const [path, file] of Object.entries(zip.files)) {
        if (!path.startsWith('xl/media/') || file.dir) continue
        const ext = path.split('.').pop().toLowerCase()
        const mime = EXT_MIME[ext]
        if (!mime) continue
        const declaredSize = Number(file?._data?.uncompressedSize || 0)
        if (
            imageStats.retainedImages >= TEST_EXCEL_LIMITS.maxImages ||
            declaredSize > TEST_EXCEL_LIMITS.maxImageBytes ||
            (declaredSize > 0 && imageStats.totalImageBytes + declaredSize > TEST_EXCEL_LIMITS.maxTotalImageBytes)
        ) {
            imageStats.omittedImages += 1
            continue
        }
        try {
            const base64 = await file.async('base64')
            const actualSize = Math.floor(base64.length * 3 / 4)
            if (
                actualSize > TEST_EXCEL_LIMITS.maxImageBytes ||
                imageStats.totalImageBytes + actualSize > TEST_EXCEL_LIMITS.maxTotalImageBytes
            ) {
                imageStats.omittedImages += 1
                continue
            }
            mediaMap[path] = { dataUrl: `data:${mime};base64,${base64}`, fileName: path.split('/').pop() }
            imageStats.retainedImages += 1
            imageStats.totalImageBytes += actualSize
        } catch { /* skip */ }
    }

    // 2. 解析 workbook rels 获取 sheetName -> sheetFile 映射
    const sheetFileMapping = {}
    const wbRelsFile = zip.file('xl/_rels/workbook.xml.rels')
    const wbFile = zip.file('xl/workbook.xml')
    if (wbRelsFile && wbFile) {
        const relsXml = await wbRelsFile.async('text')
        const wbXml = await wbFile.async('text')
        const rIdToFile = {}
        let m
        const relRegex = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"[^>]*\/?\s*>/gi
        while ((m = relRegex.exec(relsXml)) !== null) {
            if (m[2].includes('worksheets/')) rIdToFile[m[1]] = m[2].split('/').pop()
        }
        const sheetRegex = /<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"[^>]*\/?\s*>/gi
        while ((m = sheetRegex.exec(wbXml)) !== null) {
            if (rIdToFile[m[2]]) sheetFileMapping[m[1]] = rIdToFile[m[2]]
        }
    }

    if (Object.keys(mediaMap).length === 0) return { imagesBySheetFile, sheetFileMapping, imageStats }

    // 3. 遍历 sheet → drawing → images
    const sheetFiles = Object.values(sheetFileMapping)
    if (sheetFiles.length === 0) {
        for (let si = 1; si <= 30; si++) {
            const f = `sheet${si}.xml`
            if (zip.file(`xl/worksheets/${f}`)) sheetFiles.push(f)
        }
    }

    for (const sheetFile of sheetFiles) {
        const sheetRelsZip = zip.file(`xl/worksheets/_rels/${sheetFile}.rels`)
        if (!sheetRelsZip) continue

        const sheetRelsXml = await sheetRelsZip.async('text')
        const drawingMatch = sheetRelsXml.match(/<Relationship[^>]*Target="[^"]*?(\/?\.\.\/drawings\/drawing\d+\.xml|drawings\/drawing\d+\.xml)"[^>]*\/?\s*>/i)
        if (!drawingMatch) continue

        let drawingTarget = drawingMatch[0].match(/Target="([^"]+)"/i)?.[1]
        if (!drawingTarget) continue

        let drawingPath = drawingTarget.startsWith('../') ? 'xl/' + drawingTarget.slice(3)
            : drawingTarget.startsWith('/') ? drawingTarget.slice(1)
            : 'xl/worksheets/' + drawingTarget
        const drawingFile = zip.file(drawingPath)
        if (!drawingFile) continue

        const drawingFileName = drawingPath.split('/').pop()
        const drawingRelsZip = zip.file(`xl/drawings/_rels/${drawingFileName}.rels`)
        if (!drawingRelsZip) continue

        const drawingRelsXml = await drawingRelsZip.async('text')
        const rIdMap = {}
        const dRelRegex = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"[^>]*\/?\s*>/gi
        let dm
        while ((dm = dRelRegex.exec(drawingRelsXml)) !== null) {
            let tp = dm[2]
            tp = tp.startsWith('../') ? 'xl/' + tp.slice(3) : tp.startsWith('xl/') ? tp : 'xl/drawings/' + tp
            if (mediaMap[tp]) rIdMap[dm[1]] = mediaMap[tp]
        }

        if (Object.keys(rIdMap).length === 0) continue

        const drawingXml = await drawingFile.async('text')
        const sheetImageMap = {}
        const anchorRegex = /<(?:\w+:)?(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)[^>]*>([\s\S]*?)<\/(?:\w+:)?(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)>/gi
        let anchorMatch
        while ((anchorMatch = anchorRegex.exec(drawingXml)) !== null) {
            const block = anchorMatch[1]
            const fromBlock = block.match(/<(?:\w+:)?from>([\s\S]*?)<\/(?:\w+:)?from>/i)
            if (!fromBlock) continue
            const colMatch = fromBlock[1].match(/<(?:\w+:)?col>(\d+)<\/(?:\w+:)?col>/i)
            const rowMatch = fromBlock[1].match(/<(?:\w+:)?row>(\d+)<\/(?:\w+:)?row>/i)
            if (!colMatch || !rowMatch) continue
            const col = parseInt(colMatch[1], 10)
            const row = parseInt(rowMatch[1], 10)
            const blipMatch = block.match(/<\w+:blip[^>]*(?:r:embed|embed)="(rId\d+)"/i)
            if (!blipMatch) continue
            if (rIdMap[blipMatch[1]]) {
                sheetImageMap[`${row},${col}`] = { row, col, ...rIdMap[blipMatch[1]] }
            }
        }

        if (Object.keys(sheetImageMap).length > 0) {
            imagesBySheetFile[sheetFile] = sheetImageMap
        }
    }

    return { imagesBySheetFile, sheetFileMapping, imageStats }
}
