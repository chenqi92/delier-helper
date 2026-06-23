/**
 * 长行折行器
 *
 * 背景：Word 会把超过页面可用宽度的长行自动折行显示，而启用「连续行号」后
 * 每个折行都会单独编号、并占用一个 EXACT 行距网格行，导致导出的实际页数
 * 多于预览按逻辑行数估算的页数。
 *
 * 解决：在生成前按 A4 可用宽度把长行硬折成多行，预览与导出使用同一份已折行
 * 内容，Word 不再二次折行，`ceil(行数 / 每页行数)` 与实际渲染页数一致。
 */

// A4 纸宽 210mm，左右页边距各 31.8mm（与 docx-generator.js 保持一致）
const USABLE_WIDTH_MM = 210 - 31.8 - 31.8
const USABLE_WIDTH_PT = (USABLE_WIDTH_MM / 25.4) * 72
// 安全系数：估算宽度略小于真实可容纳宽度，确保 Word 不会再触发自动折行
const SAFETY = 0.95
// 制表符按 4 个半角字符估算宽度
const TAB_WIDTH_EM = 2.0

/**
 * 判断码点是否为全角 / CJK 字符（占 1 个 em 宽度）
 */
function isWide(cp) {
    return (
        (cp >= 0x1100 && cp <= 0x115f) ||   // Hangul Jamo
        (cp >= 0x2e80 && cp <= 0x303e) ||   // CJK 部首、康熙部首、CJK 符号
        (cp >= 0x3041 && cp <= 0x33ff) ||   // 平假名、片假名、CJK 兼容符号
        (cp >= 0x3400 && cp <= 0x4dbf) ||   // CJK 扩展 A
        (cp >= 0x4e00 && cp <= 0x9fff) ||   // CJK 统一表意
        (cp >= 0xa000 && cp <= 0xa4cf) ||   // 彝文
        (cp >= 0xac00 && cp <= 0xd7a3) ||   // 谚文音节
        (cp >= 0xf900 && cp <= 0xfaff) ||   // CJK 兼容表意
        (cp >= 0xfe10 && cp <= 0xfe4f) ||   // 竖排标点、CJK 兼容形式
        (cp >= 0xff00 && cp <= 0xff60) ||   // 全角 ASCII
        (cp >= 0xffe0 && cp <= 0xffe6) ||   // 全角符号
        (cp >= 0x20000 && cp <= 0x3fffd)    // CJK 扩展 B 及以上
    )
}

/**
 * 单个字符的估算宽度（em）
 */
function charWidth(ch) {
    if (ch === '\t') return TAB_WIDTH_EM
    const cp = ch.codePointAt(0)
    return isWide(cp) ? 1.0 : 0.5
}

/**
 * 字符串的估算宽度（em）
 */
function strWidth(chars) {
    let w = 0
    for (const ch of chars) w += charWidth(ch)
    return w
}

/**
 * 根据字号（半磅，docx 单位）计算每行最大可容纳宽度（em）
 */
export function calcMaxLineWidth(fontSizeHalfPt) {
    const fontSizePt = (fontSizeHalfPt || 21) / 2
    return (USABLE_WIDTH_PT / fontSizePt) * SAFETY
}

/**
 * 将单行按最大宽度折成多行
 * - 优先在空格处断行，找不到则硬断
 * - 续行保留原始缩进（缩进过深时放弃缩进，避免续行可用宽度过窄）
 *
 * @param {string} line - 原始行
 * @param {number} maxWidth - 每行最大宽度（em）
 * @returns {string[]} 折行后的多行
 */
export function wrapLine(line, maxWidth) {
    const chars = Array.from(line)
    if (strWidth(chars) <= maxWidth) return [line]

    // 续行缩进：沿用原始前导空白；若缩进本身过宽则不缩进
    const indentMatch = line.match(/^[\t ]*/)
    let contIndent = indentMatch ? indentMatch[0] : ''
    if (strWidth(Array.from(contIndent)) > maxWidth * 0.4) contIndent = ''
    const contIndentChars = Array.from(contIndent)
    const contIndentWidth = strWidth(contIndentChars)

    const result = []
    let start = 0
    let isFirst = true

    while (start < chars.length) {
        const prefixWidth = isFirst ? 0 : contIndentWidth
        let w = prefixWidth
        let end = start
        let lastBreak = -1

        while (end < chars.length) {
            const cw = charWidth(chars[end])
            if (w + cw > maxWidth && end > start) break
            w += cw
            if (chars[end] === ' ') lastBreak = end + 1
            end++
        }

        let sliceEnd = end
        // 在空格处断行更易读，但避免产生过短的续行碎片
        if (end < chars.length && lastBreak > start + 4) {
            sliceEnd = lastBreak
        }
        if (sliceEnd === start) sliceEnd = start + 1 // 保证至少前进一个字符，防止死循环

        const prefix = isFirst ? '' : contIndent
        result.push(prefix + chars.slice(start, sliceEnd).join(''))
        start = sliceEnd
        isFirst = false
    }

    return result
}

/**
 * 批量折行
 *
 * @param {string[]} lines - 行数组
 * @param {number} maxWidth - 每行最大宽度（em）；<= 0 时不折行
 * @returns {string[]}
 */
export function wrapLines(lines, maxWidth) {
    if (!maxWidth || maxWidth <= 0) return lines
    const out = []
    for (const line of lines) {
        const pieces = wrapLine(line, maxWidth)
        for (const p of pieces) out.push(p)
    }
    return out
}
