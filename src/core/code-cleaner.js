/**
 * 代码清理器 - 移除空行、行尾空白等
 */

const COPYRIGHT_PATTERNS = [
    /copyright/i, /license/i, /all rights reserved/i,
    /licensed under/i, /permission is hereby granted/i,
    /\(c\)\s*\d{4}/i, /©\s*\d{4}/i, /©/,
    /SPDX-License-Identifier/i,
    /Apache License/i, /MIT License/i, /GPL/i, /BSD/i, /Mozilla Public License/i,
    /GNU (General|Lesser|Affero) Public License/i,
    /This (file|source|code|software|program) is (part of|licensed|distributed|released)/i,
    /free software/i, /open source/i,
    /redistribute (it )?and\/or modify/i,
    /under the terms of/i,
    /WITHOUT WARRANTY/i, /AS IS/i,
    /版权所有/i, /开源协议/i, /许可证/i, /授权/i,
]

export function cleanCode(code, options = {}) {
    const {
        removeEmptyLines = true,
        removeTrailingWhitespace = true,
        removeImports = false,
        removeCopyrightHeaders = true,
    } = options

    code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    let lines = code.split('\n')
    if (removeCopyrightHeaders) lines = removeCopyrightBlock(lines)
    if (removeImports) lines = lines.filter(l => !isImportLine(l))
    if (removeTrailingWhitespace) lines = lines.map(l => l.replace(/\s+$/, ''))
    if (removeEmptyLines) lines = lines.filter(l => l.trim().length > 0)
    return lines.join('\n')
}

function isImportLine(line) {
    const t = line.trim()
    if (/^import\s+/.test(t)) return true
    if (/^(const|let|var)\s+.*=\s*require\s*\(/.test(t)) return true
    if (/^from\s+\S+\s+import\s+/.test(t)) return true
    if (/^#include\s+/.test(t)) return true
    if (/^using\s+[\w.]+;?\s*$/.test(t)) return true
    if (/^use\s+[\w:]+/.test(t)) return true
    return false
}

function removeCopyrightBlock(lines) {
    // 策略1: 检测文件头部的块注释 (/* ... */) 是否为许可声明
    const firstNonEmpty = lines.findIndex(l => l.trim().length > 0)
    if (firstNonEmpty < 0) return lines

    const firstLine = lines[firstNonEmpty].trim()

    // 块注释形式: /* ... */
    if (firstLine.startsWith('/*')) {
        let blockEnd = -1
        for (let i = firstNonEmpty; i < Math.min(lines.length, firstNonEmpty + 50); i++) {
            if (lines[i].includes('*/')) { blockEnd = i; break }
        }
        if (blockEnd >= 0) {
            const blockText = lines.slice(firstNonEmpty, blockEnd + 1).join('\n')
            if (COPYRIGHT_PATTERNS.some(p => p.test(blockText))) {
                // 跳过块注释后的空行
                let nextStart = blockEnd + 1
                while (nextStart < lines.length && lines[nextStart].trim() === '') nextStart++
                return lines.slice(nextStart)
            }
        }
    }

    // 策略2: 连续单行注释 (// 或 #) 形式
    if (firstLine.startsWith('//') || firstLine.startsWith('#')) {
        const commentPrefix = firstLine.startsWith('//') ? '//' : '#'
        let blockEnd = firstNonEmpty
        for (let i = firstNonEmpty; i < Math.min(lines.length, firstNonEmpty + 30); i++) {
            const t = lines[i].trim()
            if (t.startsWith(commentPrefix) || t === '') {
                blockEnd = i
            } else break
        }
        const blockText = lines.slice(firstNonEmpty, blockEnd + 1).join('\n')
        if (COPYRIGHT_PATTERNS.some(p => p.test(blockText))) {
            let nextStart = blockEnd + 1
            while (nextStart < lines.length && lines[nextStart].trim() === '') nextStart++
            return lines.slice(nextStart)
        }
    }

    // 策略3: 回退 — 逐行扫描前30行
    let end = -1, inBlock = false
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const line = lines[i].trim()
        if (COPYRIGHT_PATTERNS.some(p => p.test(line))) {
            inBlock = true; end = i
        } else if (inBlock) {
            if (line.startsWith('*') || line.startsWith('//') || line.startsWith('#') || line === '*/' || line === '') {
                end = i
            } else break
        }
    }
    return end >= 0 ? lines.slice(end + 1) : lines
}

export function getCodeStats(original, cleaned) {
    const origLines = original.split('\n')
    const cleanLines = cleaned.split('\n').filter(l => l.trim().length > 0)
    const empty = origLines.filter(l => l.trim().length === 0).length
    return {
        originalLineCount: origLines.length,
        cleanedLineCount: cleanLines.length,
        emptyLinesRemoved: empty,
        commentLinesRemoved: Math.max(0, origLines.length - empty - cleanLines.length),
        reductionPercentage: origLines.length > 0 ? Math.round((1 - cleanLines.length / origLines.length) * 100) : 0,
    }
}
