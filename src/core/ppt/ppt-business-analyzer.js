/**
 * PPT 业务分析 Agent 链路
 *
 * 目标：把代码扫描上下文转换成面向汇报的业务简报和叙事主线。
 * 后续 PPT 生成只消费这份业务上下文，避免退回到“目录/技术栈介绍”。
 */
import { callLlm } from '../llm/llm-service.js'
import { getStyle, listStyles } from './ppt-styles.js'

function robustJsonParse(text) {
  if (!text || typeof text !== 'string') return null
  const raw = text.trim()
  try { return JSON.parse(raw) } catch (e) {}
  let s = raw
  if (s.startsWith('```')) {
    const firstNl = s.indexOf('\n')
    const lastFence = s.lastIndexOf('```')
    if (firstNl >= 0 && lastFence > firstNl) {
      s = s.slice(firstNl + 1, lastFence).trim()
      try { return JSON.parse(s) } catch (e) {}
    }
  }
  const firstObj = s.indexOf('{')
  const firstArr = s.indexOf('[')
  let start = -1, close = '}'
  if (firstArr >= 0 && (firstObj < 0 || firstArr < firstObj)) { start = firstArr; close = ']' }
  else if (firstObj >= 0) start = firstObj
  if (start < 0) return null
  const end = s.lastIndexOf(close)
  if (end <= start) return null
  let cand = s.slice(start, end + 1)
  try { return JSON.parse(cand) } catch (e) {}
  cand = cand.replace(/,\s*([}\]])/g, '$1')
  try { return JSON.parse(cand) } catch (e) { return null }
}

function text(v, max = 200) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function list(v, max = 8) {
  if (!Array.isArray(v)) return []
  const out = []
  const seen = new Set()
  for (const item of v) {
    const s = text(typeof item === 'string' ? item : item?.name || item?.title || item?.label, 90)
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

function objects(v, normalizer, max = 8) {
  if (!Array.isArray(v)) return []
  return v.map(normalizer).filter(Boolean).slice(0, max)
}

function evidence(v, max = 5) {
  if (!Array.isArray(v)) return []
  return v.map(x => text(x, 120)).filter(Boolean).slice(0, max)
}

function normalizeCapability(item) {
  if (!item) return null
  if (typeof item === 'string') return { name: text(item, 60), desc: '', value: '', evidence: [] }
  const name = text(item.name || item.title || item.capability, 60)
  if (!name) return null
  return {
    name,
    desc: text(item.desc || item.description || item.summary, 180),
    value: text(item.value || item.businessValue || item.outcome, 160),
    icon: text(item.icon || '', 30),
    evidence: evidence(item.evidence || item.sources || item.files),
  }
}

function normalizeWorkflow(item) {
  if (!item) return null
  if (typeof item === 'string') return { name: text(item, 60), stages: [], value: '', evidence: [] }
  const name = text(item.name || item.title || item.workflow, 60)
  if (!name) return null
  return {
    name,
    stages: list(item.stages || item.steps || item.nodes, 8),
    value: text(item.value || item.outcome || item.desc, 180),
    evidence: evidence(item.evidence || item.sources || item.files),
  }
}

function normalizeBrief(parsed = {}, cfg = {}) {
  const styleId = getStyle(parsed.styleId)?.id === parsed.styleId ? parsed.styleId : null
  return {
    topic: text(parsed.topic || cfg.topic, 80),
    audience: text(parsed.audience || cfg.audience || '公司领导 / 客户', 80),
    summary: text(parsed.summary, 160),
    projectType: text(parsed.projectType, 80),
    businessDomain: text(parsed.businessDomain, 80),
    targetUsers: list(parsed.targetUsers, 8),
    businessCapabilities: objects(parsed.businessCapabilities || parsed.capabilities, normalizeCapability, 9),
    coreWorkflows: objects(parsed.coreWorkflows || parsed.workflows, normalizeWorkflow, 6),
    dataObjects: list(parsed.dataObjects, 12),
    integrations: list(parsed.integrations, 12),
    businessValue: list(parsed.businessValue || parsed.values, 8),
    differentiators: list(parsed.differentiators || parsed.highlights, 8),
    risksOrLimits: list(parsed.risksOrLimits || parsed.risks, 8),
    styleId,
    confidence: text(parsed.confidence || 'medium', 20),
  }
}

function normalizeStoryline(parsed = {}, cfg = {}) {
  return {
    narrative: text(parsed.narrative || parsed.story || '', 240),
    audienceTakeaway: text(parsed.audienceTakeaway || parsed.takeaway || '', 180),
    openingAngle: text(parsed.openingAngle || '', 160),
    sections: objects(parsed.sections, (s) => {
      if (!s) return null
      if (typeof s === 'string') return { title: text(s, 60), goal: '' }
      const title = text(s.title || s.name, 60)
      if (!title) return null
      return { title, goal: text(s.goal || s.intent || s.desc, 160) }
    }, 8),
    mustHaveSlides: objects(parsed.mustHaveSlides || parsed.slides, (s) => {
      if (!s) return null
      if (typeof s === 'string') return { title: text(s, 60), intent: '', preferredLayout: '' }
      const title = text(s.title || s.name, 60)
      if (!title) return null
      return {
        title,
        intent: text(s.intent || s.goal || s.desc, 180),
        preferredLayout: text(s.preferredLayout || s.layout, 40),
      }
    }, Math.max(6, Number(cfg.pageCount) || 12)),
    proofPoints: list(parsed.proofPoints, 10),
  }
}

export function buildBusinessBriefMessages(contextSummary, cfg = {}) {
  const styleMenu = listStyles().map(s => `${s.id}(${s.name})`).join('、')
  const system = `你是“代码业务分析 Agent”。你的任务不是写 PPT，而是阅读代码扫描结果，推断这个系统实际服务的业务、用户、流程和价值。

只输出 JSON，结构如下：
{
  "topic": "<适合 PPT 封面的业务化标题>",
  "audience": "<建议受众>",
  "summary": "<一句话项目定位>",
  "projectType": "<系统类型>",
  "businessDomain": "<业务领域>",
  "targetUsers": ["<用户/角色>"],
  "businessCapabilities": [
    { "name": "<业务能力>", "desc": "<能力说明>", "value": "<业务价值>", "icon": "<英文图标名>", "evidence": ["<文件/接口/页面证据>"] }
  ],
  "coreWorkflows": [
    { "name": "<流程名>", "stages": ["<步骤>"], "value": "<流程价值>", "evidence": ["<证据>"] }
  ],
  "dataObjects": ["<业务对象/数据对象>"],
  "integrations": ["<集成/依赖/外部系统>"],
  "businessValue": ["<业务价值点>"],
  "differentiators": ["<差异化亮点>"],
  "risksOrLimits": ["<从代码能看出的限制/风险；不确定就写需要业务补充>"],
  "styleId": "<风格 id>",
  "confidence": "high|medium|low"
}

规则：
1. 必须基于扫描上下文中的 README、页面、路由、接口、模型、数据表、命令和关键文件证据推断。
2. 不要编造客户名、合同金额、真实运行指标、上线时间、市场份额。
3. 能从代码证明的内容写得具体；证据不足的内容要保守表达。
4. 输出面向业务汇报，不要把“Vue/Tauri/JavaScript 文件”当成核心价值。
5. styleId 从这些可选项中选择：${styleMenu}。
6. 只输出 JSON，不要解释。`

  const user = `# 用户填写
主题：${cfg.topic || '未填写，请你根据代码判断'}
受众：${cfg.audience || '未填写'}
内容大方向：${cfg.direction || '未填写'}

# 代码扫描上下文
${contextSummary || '（无扫描上下文）'}`

  return [{ role: 'system', content: system }, { role: 'user', content: user }]
}

export async function generateBusinessBrief(llmConfig, contextSummary, cfg = {}, opts = {}) {
  const messages = buildBusinessBriefMessages(contextSummary, cfg)
  const textOut = await callLlm(llmConfig, messages, {
    maxTokens: llmConfig.maxOutputTokens || 8192,
    temperature: 0.35,
    jsonMode: true,
    signal: opts.signal,
  })
  return normalizeBrief(robustJsonParse(textOut) || {}, cfg)
}

export function buildStorylineMessages(businessBrief, contextSummary, cfg = {}) {
  const system = `你是“PPT 汇报叙事 Agent”。基于业务简报，为项目 PPT 设计一条业务汇报主线。

只输出 JSON：
{
  "narrative": "<整套 PPT 的叙事主线>",
  "audienceTakeaway": "<希望受众最后记住什么>",
  "openingAngle": "<开场角度>",
  "sections": [ { "title": "<章节名>", "goal": "<该章节要解决的问题>" } ],
  "mustHaveSlides": [ { "title": "<建议页标题>", "intent": "<这一页要证明什么>", "preferredLayout": "<可选版式 id>" } ],
  "proofPoints": ["<可证明的论据>"]
}

规则：
1. 站在业务视角组织内容：用户/场景/流程/能力/价值/实施与风险。
2. 技术架构只能服务业务价值，不要把技术栈铺成主线。
3. mustHaveSlides 只给关键页，不需要凑满页数；后续大纲 Agent 会扩展。
4. 不要编造数字和客户案例。只输出 JSON。`

  const user = `# 目标
页数：${cfg.pageCount || 12}
受众：${cfg.audience || businessBrief?.audience || '公司领导 / 客户'}
内容大方向：${cfg.direction || ''}

# 业务简报
${JSON.stringify(businessBrief || {}, null, 2)}

# 代码证据摘要
${contextSummary || ''}`

  return [{ role: 'system', content: system }, { role: 'user', content: user }]
}

export async function generateStoryline(llmConfig, businessBrief, contextSummary, cfg = {}, opts = {}) {
  const messages = buildStorylineMessages(businessBrief, contextSummary, cfg)
  const textOut = await callLlm(llmConfig, messages, {
    maxTokens: llmConfig.maxOutputTokens || 4096,
    temperature: 0.45,
    jsonMode: true,
    signal: opts.signal,
  })
  return normalizeStoryline(robustJsonParse(textOut) || {}, cfg)
}

export function buildPptBusinessContext({ scanContext = '', businessBrief = null, storyline = null, cfg = {} } = {}) {
  const parts = []
  if (businessBrief) {
    parts.push('## 业务分析简报（PPT 生成优先依据）')
    parts.push(JSON.stringify(businessBrief, null, 2))
  }
  if (storyline) {
    parts.push('## 汇报叙事主线（PPT 大纲优先遵循）')
    parts.push(JSON.stringify(storyline, null, 2))
  }
  if (cfg.topic || cfg.audience || cfg.direction) {
    parts.push('## 用户指定约束')
    if (cfg.topic) parts.push(`- 主题：${cfg.topic}`)
    if (cfg.audience) parts.push(`- 受众：${cfg.audience}`)
    if (cfg.direction) parts.push(`- 内容大方向：${cfg.direction}`)
  }
  if (scanContext) {
    parts.push('## 代码证据上下文（用于核验，不要逐字照搬成 PPT）')
    parts.push(scanContext)
  }
  return parts.join('\n\n')
}

export function briefDirectionText(brief) {
  if (!brief) return ''
  const values = brief.businessValue?.slice(0, 3).join('；')
  const caps = brief.businessCapabilities?.slice(0, 4).map(c => c.name).join('、')
  const workflows = brief.coreWorkflows?.slice(0, 2).map(w => w.name).join('、')
  return [
    brief.summary,
    caps ? `核心能力：${caps}` : '',
    workflows ? `关键流程：${workflows}` : '',
    values ? `业务价值：${values}` : '',
  ].filter(Boolean).join('\n')
}
