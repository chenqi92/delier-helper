/**
 * PPT 生成 LLM 服务（两阶段）
 *
 * 阶段 A —— 大纲：选定风格 + 版式序列 + 每页标题/意图
 * 阶段 B —— 逐页：按该版式的字段产出结构化内容 JSON，再交给 buildSlide 编译成元素
 *
 * 设计约束（来自参考系统 Prompt）：命中目标页数、相邻页版式不重复、三明治节奏、
 * 不臆造数字/客户名/指标、文案精炼一句话一个要点。
 */
import { callLlm, createAiController } from '../llm/llm-service.js'
import { listStyles, getStyle, pickRandomStyle, DEFAULT_STYLE_ID } from './ppt-styles.js'
import { LAYOUT_MAP, LAYOUT_IDS, layoutMenuForPrompt } from './ppt-layouts.js'

export { createAiController }

// ===== JSON 容错解析 =====
export function robustJsonParse(text) {
  if (!text || typeof text !== 'string') return null
  const raw = text.trim()
  // 1) 先直接解析（最常见：本就是纯 JSON）
  try { return JSON.parse(raw) } catch (e) {}
  // 2) 若整体被 ``` 围栏包裹，剥掉最外层（用最后一个 ``` 收尾，避免值内代码块把 JSON 截断）
  let s = raw
  if (s.startsWith('```')) {
    const firstNl = s.indexOf('\n')
    const lastFence = s.lastIndexOf('```')
    if (firstNl >= 0 && lastFence > firstNl) {
      s = s.slice(firstNl + 1, lastFence).trim()
      try { return JSON.parse(s) } catch (e) {}
    }
  }
  // 3) 截取第一个 { 或 [ 到对应的最后一个 } 或 ]
  const firstObj = s.indexOf('{'), firstArr = s.indexOf('[')
  let start = -1, close = '}'
  if (firstArr >= 0 && (firstObj < 0 || firstArr < firstObj)) { start = firstArr; close = ']' }
  else if (firstObj >= 0) { start = firstObj }
  if (start < 0) return null
  const end = s.lastIndexOf(close)
  if (end <= start) return null
  let cand = s.slice(start, end + 1)
  try { return JSON.parse(cand) } catch (e) {}
  // 去掉尾随逗号再试
  cand = cand.replace(/,\s*([}\]])/g, '$1')
  try { return JSON.parse(cand) } catch (e) { return null }
}

function clampPageCount(n) {
  const v = parseInt(n, 10)
  if (!Number.isFinite(v)) return 12
  return Math.max(3, Math.min(40, v))
}

// ===================== 阶段 A：大纲 =====================

export function buildOutlineMessages(contextSummary, cfg, lastStyleId = null) {
  const pageCount = clampPageCount(cfg.pageCount)
  const language = cfg.language || '中文'
  const styleMenu = listStyles().map(s => `  - ${s.id}（${s.name}，${s.mode === 'dark' ? '全程深底' : s.mode === 'light' ? '全程浅底' : '三明治深浅'}）`).join('\n')
  const styleDirective = (cfg.styleId && cfg.styleId !== 'auto' && cfg.styleId !== 'random')
    ? `已指定风格 id = "${cfg.styleId}"，必须采用它，不要改。`
    : `风格未指定，请从风格库中选一个最契合主题与受众的风格${lastStyleId ? `，且不要选 "${lastStyleId}"（避免与上次重复）` : ''}。`

  const system = `你是资深演示设计师 + 演示文稿工程师。现在为一套「项目/代码库」生成 PPT 的【大纲】。

只输出 JSON，结构：
{
  "style": "<风格 id>",
  "slides": [ { "layout": "<版式 id>", "title": "<该页标题，含信息量，不空喊>", "intent": "<这页要传达什么，一句话>" } ]
}

可用风格库：
${styleMenu}

可用版式（layout id）：
${layoutMenuForPrompt()}

硬性规则：
1. slides 数量必须正好 ${pageCount} 页（含封面、封底）。
2. 第 1 页必须 layout="cover"（封面），最后 1 页必须 layout="closing"（封底）。
3. ${pageCount >= 8 ? '第 2 页建议 layout="toc"（目录）。较长篇幅用 section（章节分隔）把内容分段。' : '页数较少，可不放目录。'}
4. 相邻两页的 layout 不要相同；根据内容在版式菜单里挑最合适的，整体有节奏。
5. ${styleDirective}
6. title 用 ${language}，要具体、有信息量；intent 描述该页核心信息。
7. 内容必须围绕用户提供的代码库/项目上下文，紧扣主题与「内容大方向」。

不要输出 JSON 以外的任何解释文字。`

  const user = `# 主题
${cfg.topic || '（未提供，请据代码库自行提炼）'}

# 受众
${cfg.audience || '公司领导 / 客户'}

# 内容大方向
${cfg.direction || '（未提供）'}

# 目标页数
${pageCount}

# 代码库 / 项目上下文
${contextSummary || '（无扫描上下文，请只写该领域通用、可验证、不臆造的内容）'}`

  return [{ role: 'system', content: system }, { role: 'user', content: user }]
}

const ALT_LAYOUTS = ['bullets', 'iconCards', 'featureGrid', 'timeline', 'bigNumbers', 'compareColumns', 'textMedia', 'capabilityGrid', 'cycle', 'compareTable']

/** 把模型返回的大纲规整到合法、命中页数、首尾正确、相邻不重复 */
export function normalizeOutline(parsed, cfg, lastStyleId = null) {
  const pageCount = clampPageCount(cfg.pageCount)
  const forced = (cfg.styleId && cfg.styleId !== 'auto' && cfg.styleId !== 'random') ? cfg.styleId : null

  let styleId = forced || (parsed && getStyle(parsed.style)?.id === parsed.style ? parsed.style : null)
  if (!styleId) styleId = pickRandomStyle(lastStyleId).id

  let slides = Array.isArray(parsed?.slides) ? parsed.slides.slice() : []
  slides = slides.map(s => ({
    layout: LAYOUT_MAP[s?.layout] ? s.layout : 'bullets',
    title: String(s?.title || '').slice(0, 60),
    intent: String(s?.intent || '').slice(0, 200),
  }))

  if (slides.length === 0) slides = [{ layout: 'cover', title: cfg.topic || '标题', intent: '封面' }]
  // 首页封面
  slides[0] = { ...slides[0], layout: 'cover' }
  // 命中页数
  if (slides.length > pageCount) {
    const middle = slides.slice(1, slides.length - 1).slice(0, pageCount - 2)
    slides = [slides[0], ...middle, slides[slides.length - 1]]
  } else {
    while (slides.length < pageCount) {
      slides.splice(Math.max(1, slides.length - 1), 0, { layout: 'bullets', title: '要点', intent: '' })
    }
  }
  // 末页封底
  slides[slides.length - 1] = { ...slides[slides.length - 1], layout: 'closing' }

  // 中间页禁止出现 hero 版式（cover/closing）；toc 仅保留第一处（section 可重复）
  let tocSeen = false
  for (let i = 1; i < slides.length - 1; i++) {
    if (slides[i].layout === 'cover' || slides[i].layout === 'closing') {
      slides[i] = { ...slides[i], layout: 'bullets' }
    }
    if (slides[i].layout === 'toc') {
      if (tocSeen) slides[i] = { ...slides[i], layout: 'bullets' }
      else tocSeen = true
    }
  }

  // 相邻去重（首尾固定）
  for (let i = 1; i < slides.length - 1; i++) {
    if (slides[i].layout === slides[i - 1].layout) {
      const next = slides[i + 1]?.layout
      const alt = ALT_LAYOUTS.find(a => a !== slides[i - 1].layout && a !== next) || 'bullets'
      slides[i] = { ...slides[i], layout: alt }
    }
  }
  return { styleId, slides }
}

export async function generateOutline(llmConfig, contextSummary, cfg, lastStyleId, opts = {}) {
  const messages = buildOutlineMessages(contextSummary, cfg, lastStyleId)
  const text = await callLlm(llmConfig, messages, {
    maxTokens: llmConfig.maxOutputTokens || 8192,
    temperature: 0.6,
    jsonMode: true,
    signal: opts.signal,
  })
  const parsed = robustJsonParse(text)
  return normalizeOutline(parsed, cfg, lastStyleId)
}

// ===================== 阶段 B：逐页内容 =====================

export function buildSlideMessages(slideOutline, contextSummary, cfg, prevTitles = []) {
  const layout = LAYOUT_MAP[slideOutline.layout] || LAYOUT_MAP.bullets
  const language = cfg.language || '中文'
  const prevBlock = prevTitles.length ? `\n已生成页（避免重复）：\n${prevTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n` : ''

  const system = `你在为一套 PPT 填充【某一页】的内容。该页版式 = "${layout.id}"（${layout.label}）。

只输出 JSON，字段严格遵守该版式定义：
${layout.fields}

参考 JSON 形态（仅示意结构，请用真实内容替换）：
${JSON.stringify(layout.sample)}

规则：
- 用 ${language}，文案精炼：一个要点一句话，标题有信息量。
- 内容必须基于代码库/项目上下文，紧扣本页「意图」；不要凑字数。
- 严禁臆造数字、指标、客户名、引用。${layout.id === 'bigNumbers' || layout.id === 'compareTable' ? '若上下文没有真实数据，宁可用定性描述，不要编造数值。' : ''}
- 图标名(icon)从这些英文键里选：database, server, cloud, shield, zap, layers, code, network, lock, users, settings, rocket, bar-chart, check, search, workflow, terminal, globe, smartphone, monitor, gauge, plug, key, folder, file-text, bell, refresh, target, grid, activity, lightbulb, message, clock, flag, star, cpu, git-branch。
- 不要输出 JSON 以外的任何文字。`

  const user = `# 本页标题
${slideOutline.title || ''}

# 本页意图
${slideOutline.intent || ''}

# 主题 / 大方向
${cfg.topic || ''} / ${cfg.direction || ''}
${prevBlock}
# 代码库 / 项目上下文
${contextSummary || '（无）'}`

  return [{ role: 'system', content: system }, { role: 'user', content: user }]
}

export function normalizeSlideContent(parsed, slideOutline) {
  const layout = LAYOUT_MAP[slideOutline.layout] || LAYOUT_MAP.bullets
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...(layout.sample || {}), title: slideOutline.title || layout.sample?.title }
  }
  if (!parsed.title && slideOutline.title) parsed.title = slideOutline.title
  return parsed
}

export async function generateSlideContent(llmConfig, slideOutline, contextSummary, cfg, prevTitles, opts = {}) {
  const messages = buildSlideMessages(slideOutline, contextSummary, cfg, prevTitles)
  const text = await callLlm(llmConfig, messages, {
    maxTokens: llmConfig.maxOutputTokens || 4096,
    temperature: 0.55,
    jsonMode: true,
    signal: opts.signal,
  })
  const parsed = robustJsonParse(text)
  return normalizeSlideContent(parsed, slideOutline)
}
