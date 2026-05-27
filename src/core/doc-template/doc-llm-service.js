/**
 * 文档生成 LLM 服务
 * 为 SRS / SDD 文档章节提供 AI 批量生成能力
 */
import { callLlm, createAiController } from '../llm/llm-service.js'

const TEMPERATURE_BY_TYPE = {
    diagram: 0.1,
    table: 0.35,
    text: 0.55,
}

const FEW_SHOT_PROSE = `## 示例（正文）
错误：以下是数据采集模块的相关内容。系统采用先进的技术架构...
正确：数据采集模块负责对接生产线上的 5 类传感器，按 1 秒频率从 OPC UA 网关读取温度、压力、振动数据，落地至 InfluxDB。模块以独立进程运行于边缘网关，断网时本地缓存最多 7 天数据，恢复后增量补传。`

const FEW_SHOT_TABLE = `## 示例（表格）
| 角色 | 主要职责 | 系统权限 |
| --- | --- | --- |
| 系统管理员 | 用户/角色/权限维护、审计日志查看 | 全部 |
| 业务管理员 | 部门内员工管理、流程审批 | 本部门数据读写 |
| 普通员工 | 提交流程、查看本人数据 | 本人数据读写 |`

const FEW_SHOT_DIAGRAM = `## 示例（Mermaid 流程图）
flowchart LR
  A[用户提交订单] --> B{库存充足?}
  B -- 是 --> C[扣减库存]
  B -- 否 --> D[订单标记缺货]
  C --> E[生成支付单]
  E --> F[(支付网关)]`

/**
 * 为单个章节构建 LLM prompt
 * @param {Object} section - 章节节点
 * @param {string} contextSummary - 代码库上下文摘要（由 buildContextSummary 生成）
 * @param {Object} docInfo - 文档信息
 * @param {Array<{number,title,excerpt}>} previousSummaries - 前面已生成章节的摘要，避免重复
 * @returns {Array} messages - OpenAI 格式 messages
 */
export function buildDocSectionPrompt(section, contextSummary, docInfo = {}, previousSummaries = []) {
    const docTitle = docInfo.docTitle || '技术文档'
    const projectName = docInfo.projectName || ''
    const audience = docInfo.audience || '项目验收方、后续维护开发、测试人员'
    const sectionType = section.type === 'diagram' ? '流程图/架构图（Mermaid 代码）'
        : section.type === 'table' ? '表格（Markdown 表格）'
        : '正文'

    const fewShot = section.type === 'diagram' ? FEW_SHOT_DIAGRAM
        : section.type === 'table' ? FEW_SHOT_TABLE
        : FEW_SHOT_PROSE

    const previousBlock = previousSummaries.length > 0
        ? `\n## 已生成章节（避免重复展开，可引用编号）\n${previousSummaries.map(s => `- ${s.number} ${s.title}：${s.excerpt}`).join('\n')}\n`
        : ''

    const systemMsg = `你正在编写《${docTitle}》${projectName ? `（项目：${projectName}）` : ''}。读者：${audience}。

你的目标是产出能直接落入交付文档的章节内容 —— 具体、可验证、有项目特征，避免泛泛而谈。

风格要求（用正例理解，不要逐条死扣）：
- 名词性短语开头，少用"本系统/本模块"作主语
- 出现数字 / 阈值 / 字段名 / 接口名 / 表名 这种具体信息，比形容词更有说服力
- 不写"为了提升用户体验"、"采用先进的技术架构"这种空话
- 段落不要太长，3-6 行为宜

输出格式：
- 类型为「正文」：直接输出 Markdown 段落，可用列表、行内代码 \`code\`，**不要**输出章节标题（用户已有）
- 类型为「表格」：直接输出 Markdown 表格，每个单元格一行内完成且不超 80 字，单元格内**不嵌入** \`\`\` 代码块、不用编号列表、不用 \`|\` 字符（多值用顿号或逗号）
- 类型为「流程图/架构图」：仅输出 Mermaid 代码主体，**不要**包裹 \`\`\`mermaid 标记，**不要**任何解释文字

通用约束：
- 严禁使用 HTML 标签（如 \`<br>\` \`<code>\` \`<strong>\`），只用纯 Markdown
- 不要输出"以下是..."、"根据以上..."、"综上所述"等开场白与总结句
- 内容必须基于用户提供的代码库上下文，不要凭空捏造接口名、表名、字段名

${fewShot}`

    const userMsg = `${contextSummary}
${previousBlock}
---

## 当前章节
- 编号：${section.number}
- 标题：${section.title}
- 类型：${sectionType}

## 章节要求
${section.prompt}`

    return [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
    ]
}

/**
 * 解析并应用 LLM 返回的章节内容
 */
export function applyDocSectionResult(responseText, section) {
    if (!responseText || typeof responseText !== 'string') return false

    let cleaned = responseText.trim()

    if (section.type === 'diagram') {
        const mermaidMatch = cleaned.match(/```(?:mermaid)?\s*\n?([\s\S]*?)\n?\s*```/)
        if (mermaidMatch) {
            cleaned = mermaidMatch[1].trim()
        }
        cleaned = cleaned.replace(/^```mermaid\s*\n?/, '').replace(/\n?\s*```$/, '').trim()
        section.mermaidCode = cleaned
        section.content = ''
    } else {
        // 去掉模型偶尔自带的章节编号/标题前缀
        cleaned = cleaned.replace(new RegExp(`^#+\\s*${section.number}\\s+${escapeRegex(section.title)}\\s*\\n+`, 'i'), '')
        cleaned = cleaned.replace(new RegExp(`^${escapeRegex(section.number)}\\s+${escapeRegex(section.title)}\\s*\\n+`, 'i'), '')
        // 去掉"以下是..."这种开场白
        cleaned = cleaned.replace(/^(以下是|下面是|这里是|根据以上).*?[：:。]\s*\n+/, '')
        section.content = cleaned
    }

    return true
}

function escapeRegex(s) {
    return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 章节质量自检 —— 不阻断生成，但把问题挂在 section.warnings 上供 UI 标红
 */
export function evaluateSectionQuality(section, previousSummaries = []) {
    const warnings = []
    if (section.type === 'diagram') {
        const code = (section.mermaidCode || '').trim()
        if (!code) warnings.push('Mermaid 代码为空')
        else if (code.length < 30) warnings.push('Mermaid 代码过短，可能不完整')
        else if (!/(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|mindmap)\b/i.test(code)) {
            warnings.push('未检测到合法的 Mermaid 图类型声明')
        }
        section.warnings = warnings
        return warnings
    }

    const content = (section.content || '').trim()
    if (!content) {
        warnings.push('正文为空')
        section.warnings = warnings
        return warnings
    }
    // 长度过短
    const minLen = section.type === 'table' ? 80 : 120
    if (content.length < minLen) warnings.push(`内容偏短（${content.length} 字符），可能未充分展开`)

    // 空话/套话探测
    const platitudes = ['采用先进', '具有良好的', '提升用户体验', '满足用户需求', '符合行业标准', '充分发挥', '具备...能力']
    const hit = platitudes.filter(p => content.includes(p.replace('...', '')))
    if (hit.length >= 2) warnings.push(`空话偏多（命中：${hit.slice(0, 3).join('、')}）`)

    // 与前置章节内容重复（简单 5-gram 哈希）
    if (previousSummaries.length > 0) {
        const myGrams = ngrams(content, 12)
        let maxOverlap = 0, maxTitle = ''
        for (const prev of previousSummaries) {
            const grams = ngrams(prev.excerpt || '', 12)
            const overlap = countOverlap(myGrams, grams)
            if (overlap > maxOverlap) { maxOverlap = overlap; maxTitle = prev.title }
        }
        if (maxOverlap >= 5) warnings.push(`与「${maxTitle}」内容重复度偏高`)
    }

    // HTML 标签泄漏（即便要求过不要 HTML，模型偶尔仍会输出）
    if (/<(br|code|strong|em|p|div|span|table|tr|td|th)[\s/>]/i.test(content)) {
        warnings.push('包含 HTML 标签，导出 Word 可能格式异常')
    }

    section.warnings = warnings
    return warnings
}

function ngrams(str, n) {
    const s = (str || '').replace(/\s+/g, '')
    const out = new Set()
    for (let i = 0; i + n <= s.length; i++) out.add(s.slice(i, i + n))
    return out
}

function countOverlap(a, b) {
    let c = 0
    for (const g of a) if (b.has(g)) c++
    return c
}

function summarizeForContext(section, maxChars = 180) {
    const text = section.type === 'diagram' ? `[Mermaid: ${(section.mermaidCode || '').split('\n')[0]}]` : (section.content || '')
    const cleaned = text.replace(/\s+/g, ' ').trim()
    return cleaned.length > maxChars ? cleaned.slice(0, maxChars) + '…' : cleaned
}

/**
 * 批量生成所有启用的章节
 */
export async function fillDocSections(config, sections, contextSummary, docInfo = {}, onLog = () => { }, onSectionDone = () => { }, controller = null, opts = {}) {
    if (sections.length === 0) return { generated: 0, skipped: 0, failed: 0, total: 0 }

    const { timeoutMs = 120000, forceRegenerate = false } = opts

    const needGenerate = forceRegenerate ? sections.length : sections.filter(s => !sectionHasContent(s)).length
    onLog(`[信息] 开始生成文档，共 ${sections.length} 个章节${needGenerate < sections.length ? `（${sections.length - needGenerate} 个已有内容将跳过）` : ''}`, 'info')

    let generated = 0
    let skipped = 0
    let failed = 0
    const previousSummaries = []

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

        if (!forceRegenerate && sectionHasContent(section)) {
            skipped++
            previousSummaries.push({ number: section.number, title: section.title, excerpt: summarizeForContext(section) })
            onLog(`[跳过] [${i + 1}/${sections.length}] ${section.number} ${section.title} — 已有内容`, 'info')
            onSectionDone(section, i, sections.length)
            continue
        }

        section.generating = true
        section.error = null
        section.warnings = []
        onLog(`[进行] [${i + 1}/${sections.length}] ${section.number} ${section.title}`, 'info')

        try {
            const messages = buildDocSectionPrompt(section, contextSummary, docInfo, previousSummaries.slice(-10))
            const defaultMaxTokens = section.type === 'diagram' ? 4096 : 16384
            const maxTokens = config.maxOutputTokens || defaultMaxTokens
            const temperature = TEMPERATURE_BY_TYPE[section.type] ?? 0.5

            const responseText = await callLlmWithTimeout(
                config, messages,
                { maxTokens, temperature, signal: controller?.signal, jsonMode: false },
                timeoutMs,
            )
            const success = applyDocSectionResult(responseText, section)

            section.generating = false
            if (success) {
                generated++
                section.error = null
                const warnings = evaluateSectionQuality(section, previousSummaries)
                previousSummaries.push({ number: section.number, title: section.title, excerpt: summarizeForContext(section) })
                if (warnings.length > 0) {
                    onLog(`[完成] [${i + 1}/${sections.length}] ${section.number} ${section.title} ⚠ ${warnings.join('；')}`, 'warn')
                } else {
                    onLog(`[完成] [${i + 1}/${sections.length}] ${section.number} ${section.title} ✓`, 'success')
                }
            } else {
                failed++
                section.error = '生成内容为空，请重试'
                onLog(`[警告] [${i + 1}/${sections.length}] ${section.number} ${section.title} - 内容为空`, 'warn')
            }
            onSectionDone(section, i, sections.length)
        } catch (e) {
            section.generating = false
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

function sectionHasContent(section) {
    if (section.type === 'diagram') {
        return !!(section.mermaidCode && section.mermaidCode.trim())
    }
    return !!(section.content && section.content.trim())
}

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

export { createAiController }
