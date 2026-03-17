/**
 * 文档生成 LLM 服务
 * 为 SRS / SDD 文档章节提供 AI 批量生成能力
 */
import { callLlm, createAiController } from '../llm/llm-service.js'

/**
 * 为单个章节构建 LLM prompt
 * @param {Object} section - 章节节点
 * @param {string} contextSummary - 代码库上下文摘要（由 buildContextSummary 生成）
 * @param {Object} docInfo - 文档信息
 * @returns {Array} messages - OpenAI 格式 messages
 */
export function buildDocSectionPrompt(section, contextSummary, docInfo = {}) {
    const docTitle = docInfo.docTitle || '技术文档'
    const systemMsg = `你是一个专业的软件文档工程师。你正在编写「${docTitle}」。
请根据用户提供的项目信息和代码结构，为文档的指定章节生成内容。

输出要求：
1. 使用正式的技术文档语言，禁止口语化
2. 直接输出章节内容，不要带章节编号和标题前缀（用户已有标题）
3. 如果是表格类型，使用标准 Markdown 表格格式：
   - 每个单元格内容必须在一行内完成，不要在单元格中使用换行
   - 每个单元格内容不超过 80 字，保持简洁
   - 单元格中不要嵌入代码块（\`\`\`），如需代码请用行内代码 \`code\`
   - 不要在表格单元格中使用编号列表
   - 严禁在单元格内容中使用 | 管道符号，多个值请用顿号（、）或逗号分隔
4. 如果是流程图/架构图类型，仅输出 Mermaid 代码（不含 \`\`\`mermaid 包裹）
5. 不要输出任何解释性质的前言或总结（例如"以下是..."、"根据以上..."）
6. 严禁使用任何 HTML 标签（如 <br>、<code>、<strong> 等），只使用纯 Markdown 格式
7. 保持内容专业、结构清晰`

    const userMsg = `${contextSummary}

---

## 当前章节
- 编号：${section.number}
- 标题：${section.title}
- 类型：${section.type === 'diagram' ? '流程图/架构图（请输出 Mermaid 代码）' : section.type === 'table' ? '表格（请输出 Markdown 表格）' : '正文'}

## 生成要求
${section.prompt}`

    return [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
    ]
}

/**
 * 解析并应用 LLM 返回的章节内容
 * @param {string} responseText - LLM 响应文本
 * @param {Object} section - 章节节点
 */
export function applyDocSectionResult(responseText, section) {
    if (!responseText || typeof responseText !== 'string') return false

    let cleaned = responseText.trim()

    if (section.type === 'diagram') {
        // 提取 Mermaid 代码
        const mermaidMatch = cleaned.match(/```(?:mermaid)?\s*\n?([\s\S]*?)\n?\s*```/)
        if (mermaidMatch) {
            cleaned = mermaidMatch[1].trim()
        }
        // 去掉可能的 markdown 代码块标记
        cleaned = cleaned.replace(/^```mermaid\s*\n?/, '').replace(/\n?\s*```$/, '').trim()
        section.mermaidCode = cleaned
        section.content = ''
    } else {
        section.content = cleaned
    }

    return true
}

/**
 * 批量生成所有启用的章节
 * ① 已有有效内容的章节会自动跳过（断点续生成）
 * ② 单章节超时保护（默认 120 秒），防止无限卡住
 * @param {Object} config - LLM 配置 { baseUrl, apiKey, model, providerId }
 * @param {Array} sections - 要生成的章节列表（扁平化的叶子节点）
 * @param {string} contextSummary - 代码库上下文摘要
 * @param {Object} docInfo - 文档信息
 * @param {Function} onLog - 日志回调
 * @param {Function} onSectionDone - 单个章节完成回调 (section, index, total)
 * @param {Object} controller - AI 控制器（暂停/继续/取消）
 * @param {Object} opts - 额外选项 { timeoutMs: 单章节超时毫秒数(默认120000), forceRegenerate: 强制重新生成所有章节(默认false) }
 * @returns {Promise<{generated: number, skipped: number, failed: number, total: number}>}
 */
export async function fillDocSections(config, sections, contextSummary, docInfo = {}, onLog = () => { }, onSectionDone = () => { }, controller = null, opts = {}) {
    if (sections.length === 0) return { generated: 0, skipped: 0, failed: 0, total: 0 }

    const { timeoutMs = 120000, forceRegenerate = false } = opts

    // 计算有多少章节需要生成
    const needGenerate = forceRegenerate ? sections.length : sections.filter(s => !sectionHasContent(s)).length
    onLog(`[信息] 开始生成文档，共 ${sections.length} 个章节${needGenerate < sections.length ? `（${sections.length - needGenerate} 个已有内容将跳过）` : ''}`, 'info')

    let generated = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < sections.length; i++) {
        if (controller?.cancelled) {
            onLog(`[取消] 已取消生成`, 'warn')
            break
        }
        if (controller?.paused) {
            onLog(`⏸ 已暂停...`, 'info')
            await controller.waitIfPaused()
            if (controller?.cancelled) break
            onLog(`▶ 已恢复`, 'info')
        }

        const section = sections[i]

        // ① 断点续生成：跳过已有有效内容的章节
        if (!forceRegenerate && sectionHasContent(section)) {
            skipped++
            onLog(`[跳过] [${i + 1}/${sections.length}] ${section.number} ${section.title} — 已有内容`, 'info')
            onSectionDone(section, i, sections.length)
            continue
        }

        section.generating = true
        section.error = null
        onLog(`[进行] [${i + 1}/${sections.length}] ${section.number} ${section.title}`, 'info')

        try {
            const messages = buildDocSectionPrompt(section, contextSummary, docInfo)
            // 图表类型使用更大的 maxTokens
            const maxTokens = section.type === 'diagram' ? 4096 : 8192

            // ② 超时保护：单章节超时，防止无限卡住
            const responseText = await callLlmWithTimeout(
                config, messages,
                { maxTokens, temperature: 0.4, signal: controller?.signal },
                timeoutMs,
            )
            const success = applyDocSectionResult(responseText, section)

            section.generating = false
            if (success) {
                generated++
                section.error = null
                onLog(`[完成] [${i + 1}/${sections.length}] ${section.number} ${section.title} ✓`, 'success')
            } else {
                failed++
                section.error = '生成内容为空，请重试'
                onLog(`[警告] [${i + 1}/${sections.length}] ${section.number} ${section.title} - 内容为空`, 'warn')
            }
            onSectionDone(section, i, sections.length)
        } catch (e) {
            section.generating = false
            // AbortError 表示用户主动取消，直接中断循环
            if (e.name === 'AbortError') {
                onLog(`[取消] 用户取消了生成`, 'warn')
                break
            }
            failed++
            section.error = e.message || String(e)
            onLog(`[失败] [${i + 1}/${sections.length}] ${section.number} ${section.title}: ${e.message}`, 'error')
            onSectionDone(section, i, sections.length)
        }
    }

    const summary = [`已完成 ${generated}/${sections.length}`]
    if (skipped > 0) summary.push(`跳过 ${skipped}（已有内容）`)
    if (failed > 0) summary.push(`失败 ${failed}`)
    onLog(`[完成] 文档生成完成: ${summary.join('，')}`, 'info')
    return { generated, skipped, failed, total: sections.length }
}

/**
 * 判断章节是否已有有效内容
 */
function sectionHasContent(section) {
    if (section.type === 'diagram') {
        return !!(section.mermaidCode && section.mermaidCode.trim())
    }
    return !!(section.content && section.content.trim())
}

/**
 * 带超时的 callLlm 封装
 * @param {number} timeoutMs - 超时毫秒数
 */
async function callLlmWithTimeout(config, messages, options, timeoutMs) {
    if (!timeoutMs || timeoutMs <= 0) {
        return callLlm(config, messages, options)
    }

    return new Promise((resolve, reject) => {
        let settled = false
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true
                reject(new Error(`章节生成超时（${Math.round(timeoutMs / 1000)}秒），模型可能卡住，已自动跳过`))
            }
        }, timeoutMs)

        callLlm(config, messages, options).then(result => {
            if (!settled) { settled = true; clearTimeout(timer); resolve(result) }
        }).catch(err => {
            if (!settled) { settled = true; clearTimeout(timer); reject(err) }
        })
    })
}

// 重新导出 createAiController 方便引用
export { createAiController }
