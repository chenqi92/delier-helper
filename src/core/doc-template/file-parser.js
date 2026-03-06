/**
 * 辅助文件解析器
 * 支持解析 Word (.docx)、Excel (.xlsx/.xls)、PDF (.pdf)、Markdown (.md)、文本 (.txt/.csv) 文件
 * 提取文本内容供 LLM 作为参考上下文
 */
import { readTextFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'

/** 最大提取内容长度（字符数） */
const MAX_CONTENT_LENGTH = 8000

/**
 * 支持的文件扩展名
 */
export const SUPPORTED_EXTENSIONS = ['.docx', '.xlsx', '.xls', '.pdf', '.md', '.txt', '.csv']

/**
 * 获取文件选择对话框的过滤器
 */
export function getFileFilters() {
    return [
        { name: '所有支持的文件', extensions: ['docx', 'xlsx', 'xls', 'pdf', 'md', 'txt', 'csv'] },
        { name: 'Word 文档', extensions: ['docx'] },
        { name: 'Excel 表格', extensions: ['xlsx', 'xls'] },
        { name: 'PDF 文档', extensions: ['pdf'] },
        { name: 'Markdown', extensions: ['md'] },
        { name: '文本文件', extensions: ['txt', 'csv'] },
    ]
}

/**
 * 解析单个文件
 * @param {string} filePath - 文件绝对路径
 * @returns {Promise<ParsedFile>}
 */
export async function parseFile(filePath) {
    const fileName = filePath.split(/[/\\]/).pop()
    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop().toLowerCase() : ''

    const result = {
        name: fileName,
        path: filePath,
        type: ext,
        content: '',
        error: null,
        parsing: false,
    }

    try {
        result.parsing = true
        switch (ext) {
            case '.docx':
                result.content = await parseDocx(filePath)
                break
            case '.xlsx':
            case '.xls':
                result.content = await parseExcel(filePath)
                break
            case '.pdf':
                result.content = await parsePdf(filePath)
                break
            case '.md':
            case '.txt':
            case '.csv':
                result.content = await parseText(filePath)
                break
            default:
                result.error = `不支持的文件格式: ${ext}`
        }
    } catch (e) {
        result.error = `解析失败: ${e.message || String(e)}`
        console.error(`文件解析失败 [${fileName}]:`, e)
    }

    result.parsing = false
    // 截断过长内容
    if (result.content && result.content.length > MAX_CONTENT_LENGTH) {
        result.content = result.content.substring(0, MAX_CONTENT_LENGTH) + '\n\n... (内容过长，已截断)'
    }

    return result
}

/**
 * 批量解析文件
 */
export async function parseFiles(filePaths) {
    const results = []
    for (const fp of filePaths) {
        results.push(await parseFile(fp))
    }
    return results
}

// ==================== 各格式解析器 ====================

/**
 * 解析 Word (.docx) 文件
 * 使用 mammoth 库提取纯文本
 */
async function parseDocx(filePath) {
    const mammoth = await import('mammoth')
    // 通过 Tauri 读取文件二进制
    const bytes = await invoke('plugin:fs|read_file', { path: filePath })
    const arrayBuffer = new Uint8Array(bytes).buffer
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value || ''
}

/**
 * 解析 Excel (.xlsx / .xls) 文件
 * 使用 xlsx (SheetJS) 库，将每个 sheet 转为 Markdown 表格
 */
async function parseExcel(filePath) {
    const XLSX = await import('xlsx')
    const bytes = await invoke('plugin:fs|read_file', { path: filePath })
    const workbook = XLSX.read(new Uint8Array(bytes), { type: 'array' })

    const parts = []
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        if (jsonData.length === 0) continue

        parts.push(`### 工作表: ${sheetName}`)
        // 转为 Markdown 表格
        const header = jsonData[0]
        parts.push('| ' + header.join(' | ') + ' |')
        parts.push('| ' + header.map(() => '---').join(' | ') + ' |')
        for (let i = 1; i < jsonData.length && i < 100; i++) {
            const row = jsonData[i]
            parts.push('| ' + row.map(c => String(c).replace(/\|/g, '\\|')).join(' | ') + ' |')
        }
        if (jsonData.length > 100) {
            parts.push(`\n... (共 ${jsonData.length} 行，已截取前 100 行)`)
        }
        parts.push('')
    }

    return parts.join('\n')
}

/**
 * 解析 PDF 文件
 * 使用 pdfjs-dist 逐页提取文本
 */
async function parsePdf(filePath) {
    const pdfjsLib = await import('pdfjs-dist')
    // 设置 worker（使用内联 worker 避免路径问题）
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''

    const bytes = await invoke('plugin:fs|read_file', { path: filePath })
    const data = new Uint8Array(bytes)

    const pdf = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise
    const parts = []

    const maxPages = Math.min(pdf.numPages, 50) // 最多读 50 页
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map(item => item.str).join(' ')
        if (pageText.trim()) {
            parts.push(pageText)
        }
    }

    if (pdf.numPages > 50) {
        parts.push(`\n... (共 ${pdf.numPages} 页，已截取前 50 页)`)
    }

    return parts.join('\n\n')
}

/**
 * 解析纯文本文件（.md / .txt / .csv）
 */
async function parseText(filePath) {
    return await readTextFile(filePath)
}

/**
 * 将解析后的参考文件列表构建为上下文摘要文本
 */
export function buildReferenceContext(parsedFiles) {
    if (!parsedFiles || parsedFiles.length === 0) return ''

    const parts = ['## 参考文档']
    for (const file of parsedFiles) {
        if (file.error || !file.content) continue
        parts.push(`### ${file.name}`)
        parts.push(file.content)
        parts.push('')
    }

    return parts.length > 1 ? parts.join('\n') : ''
}
