/**
 * 运维手册 Markdown 导出渲染器
 * 将章节树渲染为完整的 Markdown 文本
 */

/**
 * 将章节树渲染为 Markdown 文本
 * @param {Array} sections - 章节树
 * @param {Object} docInfo - 文档信息
 * @returns {string} Markdown 文本
 */
export function renderSectionsToMarkdown(sections, docInfo = {}) {
    const lines = []

    // 标题
    lines.push(`# ${docInfo.docTitle || docInfo.projectName || '服务器运维手册'}`)
    lines.push('')
    lines.push('---')
    lines.push('')

    // 渲染章节
    renderSectionsRecursive(sections, lines, 1)

    return lines.join('\n')
}

/**
 * 递归渲染章节
 */
function renderSectionsRecursive(sections, lines, depth) {
    for (const sec of sections) {
        if (!sec.enabled) continue

        // 章节标题 — 前言使用 ##，其他按编号深度
        const headingPrefix = '#'.repeat(Math.min(depth + 1, 6))

        // 前言特殊处理（编号为 0 时不显示编号）
        if (sec.number === '0') {
            lines.push(`${headingPrefix} ${sec.title}`)
        } else {
            lines.push(`${headingPrefix} ${sec.number} ${sec.title}`)
        }
        lines.push('')

        // 章节内容
        if (sec.type === 'diagram' && sec.mermaidCode) {
            lines.push('```mermaid')
            lines.push(sec.mermaidCode)
            lines.push('```')
            lines.push('')
        }

        if (sec.content) {
            lines.push(sec.content)
            lines.push('')
        }

        // 分割线（一级章节之间）
        if (depth === 1 && !sec.children?.length) {
            lines.push('---')
            lines.push('')
        }

        // 递归子章节
        if (sec.children && sec.children.length > 0) {
            renderSectionsRecursive(sec.children, lines, depth + 1)

            // 一级章节结束后的分割线
            if (depth === 1) {
                lines.push('---')
                lines.push('')
            }
        }
    }
}
