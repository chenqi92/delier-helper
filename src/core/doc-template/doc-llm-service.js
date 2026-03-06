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
3. 如果是表格类型，使用标准 Markdown 表格格式
4. 如果是流程图/架构图类型，仅输出 Mermaid 代码（不含 \`\`\`mermaid 包裹）
5. 不要输出任何解释性质的前言或总结（例如"以下是..."、"根据以上..."）
6. 保持内容专业、结构清晰`

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
 * @param {Object} config - LLM 配置 { baseUrl, apiKey, model, providerId }
 * @param {Array} sections - 要生成的章节列表（扁平化的叶子节点）
 * @param {string} contextSummary - 代码库上下文摘要
 * @param {Object} docInfo - 文档信息
 * @param {Function} onLog - 日志回调
 * @param {Function} onSectionDone - 单个章节完成回调 (section, index, total)
 * @param {Object} controller - AI 控制器（暂停/继续/取消）
 * @returns {Promise<{generated: number, total: number}>}
 */
export async function fillDocSections(config, sections, contextSummary, docInfo = {}, onLog = () => { }, onSectionDone = () => { }, controller = null) {
    if (sections.length === 0) return { generated: 0, total: 0 }

    onLog(`[信息] 开始生成文档，共 ${sections.length} 个章节`, 'info')

    let generated = 0
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
        onLog(`[进行] [${i + 1}/${sections.length}] ${section.number} ${section.title}`, 'info')

        try {
            const messages = buildDocSectionPrompt(section, contextSummary, docInfo)
            // 图表类型使用更大的 maxTokens
            const maxTokens = section.type === 'diagram' ? 4096 : 8192
            const responseText = await callLlm(config, messages, { maxTokens, temperature: 0.4 })
            const success = applyDocSectionResult(responseText, section)

            if (success) {
                generated++
                onLog(`[完成] [${i + 1}/${sections.length}] ${section.number} ${section.title} ✓`, 'success')
            } else {
                onLog(`[警告] [${i + 1}/${sections.length}] ${section.number} ${section.title} - 内容为空`, 'warn')
            }
            onSectionDone(section, i, sections.length)
        } catch (e) {
            onLog(`[失败] [${i + 1}/${sections.length}] ${section.number} ${section.title} 失败: ${e.message}`, 'error')
        }
    }

    onLog(`[完成] 文档生成完成: ${generated}/${sections.length} 个章节`, 'info')
    return { generated, total: sections.length }
}

// 重新导出 createAiController 方便引用
export { createAiController }
