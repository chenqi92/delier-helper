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
import { listStyles, getStyle, pickRandomStyle, DEFAULT_STYLE_ID, PPT_FONT_PAIRS } from './ppt-styles.js'
import { LAYOUT_MAP, LAYOUT_IDS, layoutMenuForPrompt } from './ppt-layouts.js'

const FONT_PAIR_KEYS = Object.keys(PPT_FONT_PAIRS)

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

function explicitMaxTokens(cfg) {
  const v = Number(cfg?.maxOutputTokens || 0)
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined
}

function creativityModeOf(cfg = {}) {
  const mode = String(cfg?.creativityMode || 'free')
  return ['free', 'balanced', 'strict'].includes(mode) ? mode : 'free'
}

function outlineTemperature(cfg = {}) {
  const mode = creativityModeOf(cfg)
  if (mode === 'strict') return 0.55
  if (mode === 'balanced') return 0.68
  return 0.85
}

function slideTemperature(cfg = {}) {
  const mode = creativityModeOf(cfg)
  if (mode === 'strict') return 0.5
  if (mode === 'balanced') return 0.58
  return 0.68
}

function cleanHex(v) {
  const s = String(v || '').replace(/^#/, '').trim()
  return /^[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : ''
}

function outlineImageRule(imgCount, mode) {
  if (imgCount > 0) {
    const target = Math.min(imgCount, 3)
    if (mode === 'free') {
      return `【配图】有 ${imgCount} 张可用图片。可在合适的 ${target} 页左右自然使用 imageShowcase / imageGrid / textMedia，也可以少用；不要为了用图破坏叙事节奏。`
    }
    return `【可用配图 ${imgCount} 张】请安排 ${target} 页左右用 imageShowcase / imageGrid / textMedia 来展示这些图（系统会自动把图填入）。`
  }
  return `当前没有可用配图，禁止使用 imageShowcase / imageGrid；textMedia 也尽量少用（会显示占位图）。`
}

function outlineModePrompt(mode, pageCount, imgCount) {
  const imageRule = outlineImageRule(imgCount, mode)
  const tocFreeRule = pageCount >= 8
    ? '目录页不是必需；只有当章节明显且目录能帮助阅读时才使用 toc，否则第 2 页可以直接进入观点、场景、问题或故事。'
    : '页数较少通常不要 toc，直接进入核心内容。'
  if (mode === 'strict') {
    return `【编排自由度：结构严谨】
1. ${pageCount >= 8 ? '第 2 页建议 layout="toc"。较长篇幅用 section 分段。' : '页数较少，可不放目录。'}
2. 若上下文包含 mustHaveSlides / sections，请优先覆盖这些关键页，但仍要命中总页数。

【业务表达（重点）】至少 60% 的中间页要从业务角度命名和组织，例如业务全景、用户旅程、核心流程、价值矩阵、风险控制、实施路径。只有 1-2 页可以直接讲技术架构/技术栈。

【高级设计感（重点）】整套 PPT 要有“完整设计稿”的密度：封面/章节/内容页节奏明显，内容页优先使用图示、矩阵、流程、图表、对照结构承载信息；不要大量使用单列 bullets，也不要每页只有标题 + 3 个简单卡片。每页标题要像汇报结论，而不是模块名。

【视觉多样性（重点）】不要整套都是图标卡。卡片网格类版式（iconCards/featureGrid/capabilityGrid）合计不超过 2 页。要主动穿插业务图示类和数据/图示类版式让 PPT 有亮点：
- 讲业务定位/系统全貌时优先用 businessOverview。
- 讲用户操作与服务过程时优先用 userJourney / workflowDiagram。
- 讲交付价值、收益、差异化时优先用 valueMatrix / bigNumbers / compareColumns。
- 讲风险、权限、边界、运维保障时优先用 riskMap / compareTable。
- 有可量化信息时用 barChart / lineTrend / proportion（如代码语言分布、各模块文件数占比、规模对比）或 progressBars（能力/成熟度评分）。
- 讲系统结构时用 architecture（分层架构图），不要只用文字罗列。
- 用 bigNumbers 放关键指标，compareColumns/compareTable 做对照，cycle 表达闭环，quote 提炼金句。
${imageRule}`
  }
  if (mode === 'balanced') {
    return `【编排自由度：平衡】
1. ${pageCount >= 8 ? '第 2 页可使用 toc；如果主题更适合直接开场，也可以不用目录。较长篇幅可用 section 分段。' : '页数较少，可不放目录。'}
2. 若上下文包含 mustHaveSlides / sections，请优先参考这些关键页；可以重组、合并、改写，但不要遗漏最核心的信息。
3. 以业务汇报为主线，但不要机械套用“现状-挑战-方案-流程-价值-路线图”。章节顺序和页标题应根据主题自然生成。
4. 中间页优先从业务角度组织，技术内容作为支撑；不需要机械满足固定比例。
5. 保持设计感和版式变化：图示、矩阵、流程、图表、对照、金句页、章节页可以穿插使用；卡片网格类版式尽量不超过 2-3 页。
6. 每页标题要像汇报结论，而不是模块名。
${imageRule}`
  }
  return `【编排自由度：自由发挥】
1. 不要默认套用“目录-现状-挑战-方案-流程-价值-路线图”的固定汇报结构；除非主题本身确实需要。
2. 可以根据主题自由选择叙事方式：故事开场、问题悬念、反差对照、用户旅程、产品演示、案例拆解、决策备忘录、路线图、能力宣言、风险反推等，也可以混合。
3. 中间页不要求覆盖固定模块，也不要求必须达到业务页比例；优先让每一页都有独立观点，并且前后自然推进。
4. ${tocFreeRule}
5. 若上下文包含 mustHaveSlides / sections，把它们当作素材和灵感；可以重组、合并、改写，不必逐条覆盖。
6. 版式选择服务表达，不要机械优先某几类业务图示；可以大胆使用 quote、bigNumbers、compareColumns、cycle、timeline、architecture、section、textMedia、bullets 等，但避免连续重复。
7. 每页标题要具体、有锋芒、像一条结论；避免“项目背景 / 核心能力 / 价值总结”这种空泛标题连续出现。
${imageRule}`
}

const PPT_FONT_MENU = `可选字体配对 fontPair（择一；中文标题优先 yahei / clean）：
- yahei（微软雅黑，中文通用、稳）
- clean（Calibri，现代无衬线）
- serif（Georgia 标题 + Calibri 正文，稳重经典）
- editorial（Georgia + Arial，杂志编辑感）
- humanist（Trebuchet MS + Calibri，友好人文）
- elegant（Palatino + Garamond，优雅衬线，高端/文创）
- impact（Arial Black + Arial，强冲击发布会）
- geometric（Century Gothic + Calibri，几何现代）`

function designPrinciplesBlock() {
  return `【设计原则（务必落地，避免"只是换个颜色、结构雷同"的平庸感）】
· 主色支配 60-30-10：确定一个支配性背景基调(60%)、一个辅助色域(30%)、一个高辨识强调色(10%)。既不要通篇一个颜色，也不要五颜六色。
· 选定一种配色和谐关系并贯穿全套：单色深浅 / 邻近色 / 互补撞色 / 三角色，任选其一；用第二强调色 accent2 做"记忆点"，仅在关键处点睛（数据高亮、关键卡片、图表次要序列）。
· 明暗由语气驱动：锐利/科技/发布 → 深色 mode=dark；治理/信任/政务/医疗 → 浅底或三明治 sandwich；编辑/文创/品牌 → 浅底大留白。
· 深底要够深、浅底要够浅，正文对比 ≥ 4.5:1；强调色别选到与背景明度接近而"发灰"。
· 渐变造层次：hero 页用"深—本色—强调光晕"斜向渐变（系统据 palette + gradientAngle 自动生成），内容页只做极轻洗色，不喧宾夺主；gradientAngle 给 100-170 之间的角度。
· 字体承载性格：为主题挑一个合适 fontPair，不要所有主题都用同一套字。
· 版面三级层次：标题 / 副信息 / 正文 的字号·字重·颜色分明，重点突出。`
}

function themeDesignPrompt(cfg = {}) {
  const autoTheme = !cfg.styleId || cfg.styleId === 'auto' || cfg.styleId === 'random'
  const principles = designPrinciplesBlock()
  if (!autoTheme) {
    return `【主题设计（已指定风格 —— 保持识别度）】用户已明确选定该风格，请保持它的主色、明暗节奏与母题识别度，不要大改配色。palette 只做贴合主题的轻微校准（微调明度/饱和度，或让强调色更贴主题），可补一个 accent2 点睛色、gradientAngle 与 fontPair 让层次更足，但整体仍要一眼认得出是所选风格。

${principles}

${PPT_FONT_MENU}`
  }
  return `【主题设计（智能编排重点 —— 天马行空、非常美观、拒绝套路）】
你现在是这套 PPT 的艺术总监。目标是做出**有强烈个性、令人眼前一亮**的方案，而不是"换个颜色的通用模板"。

1. 先据主题/受众/业务与大方向，构思一个大胆的视觉概念（editorial 杂志感 / bold 几何撞色 / minimal 瑞士极简 / luxe 高端留白 / kinetic 科技动感 …任选或混搭），让整套有统一而鲜明的气质。theme.concept 一句话点明它；theme.name 像可执行的策展主题；theme.coverKicker 贴主题，别默认"产品"。
2. 配色完全自由：原创一整套 palette（HEX、不带 #）：primary / secondary / accent / accent2 / bgDark / bgLight / inkDark / inkLight / cardBg / cardBgDark。不要照抄风格库默认色，不要一律深蓝/青蓝。style 只作视觉基底，颜色一律以你的 palette 为准。
3. 一并给出 accent2、gradientAngle、fontPair、paletteName，以及 **coverVariant**（封面构图）——按气质选：冲击发布用 fullbleed（满版超大字）、方案对话用 split（左右分屏）、杂志感用 serif、高端用 gold、极简用 hairline、几何撞色用 block。
4. **版式要有戏剧性节奏，但重音要克制**：满版/超大/非对称版式（statement / bigStat / splitFeature / 封面 fullbleed）是"重音"，**全套合计 2-4 页就够，别每页都满版**——它们贵在稀有。
   · statement：把最有锋芒的一句主张做成满版大字（每套 0-1 次）。
   · bigStat：把最关键的一个数字放到超大（有真实数据时用，0-1 次）。
   · splitFeature：讲聚焦重点时用一次非对称左栏分屏。
5. **其余内容页要"饱满"**：用信息密度高的结构化版式把每页讲透，而不是每页只放 3 个短卡片或几行字——
   · 讲方法/支柱用 pillars（3-4 栏，每栏 2-4 条要点）；讲取舍/定位用 quadrant（四象限）。
   · 讲全貌/流程/价值/风险用 businessOverview / workflowDiagram / userJourney / valueMatrix / riskMap / architecture，字段填满、每项写具体。
   · 有可量化信息就上 barChart / lineTrend / proportion / progressBars。
   · 卡片网格类（iconCards/featureGrid/capabilityGrid）合计别超过 2 页。
6. 每页标题像一条结论，有锋芒；避免"项目背景/核心能力/价值总结"这类空泛标题连续出现。

${principles}

${PPT_FONT_MENU}

【配色对比自检】bgDark 足够深、bgLight 足够浅；inkLight 压 bgDark、inkDark 压 bgLight 都要清晰(≥4.5:1)；accent/accent2 压在各自背景上不发灰。系统会再做一层对比度兜底，但请先自检。`
}

function slideExpressionRule(cfg = {}) {
  const mode = creativityModeOf(cfg)
  if (mode === 'free') {
    return '允许更灵活的表达：可以用结论、故事化、对照、演示口吻、风险反推或金句式提炼来组织本页；不要把每页都写成同一种“用户/流程/能力”清单。'
  }
  if (mode === 'balanced') {
    return '面向业务受众表达：优先讲清观点、场景、能力、价值和证据；技术名词只作为支撑，不要把每页写成代码结构说明。'
  }
  return '面向业务受众表达：优先讲用户、场景、流程、能力、价值和风险；技术名词只作为支撑证据。'
}

// ===================== 阶段 A：大纲 =====================

export function buildOutlineMessages(contextSummary, cfg, lastStyleId = null) {
  const pageCount = clampPageCount(cfg.pageCount)
  const language = cfg.language || '中文'
  const styleMenu = listStyles().map(s => `  - ${s.id}（${s.name}，${s.mode === 'dark' ? '全程深底' : s.mode === 'light' ? '全程浅底' : '三明治深浅'}）`).join('\n')
  const styleDirective = (cfg.styleId && cfg.styleId !== 'auto' && cfg.styleId !== 'random')
    ? `已指定风格 id = "${cfg.styleId}"，必须采用它，不要改。`
    : `风格未指定，请从风格库中选一个最契合主题与受众的风格${lastStyleId ? `，且不要选 "${lastStyleId}"（避免与上次重复）` : ''}。`

  const imgCount = Math.max(0, parseInt(cfg.imageCount, 10) || 0)
  const creativityMode = creativityModeOf(cfg)
  const modeRules = outlineModePrompt(creativityMode, pageCount, imgCount)
  const themeRules = themeDesignPrompt(cfg)
  const system = `你是资深业务汇报顾问 + 演示设计师。你拿到的上下文可能包含“业务分析简报”“汇报叙事主线”和“代码证据上下文”。

你的任务是根据业务简报、用户输入和代码证据设计 PPT 的主题概念、大纲、版式节奏和风格；代码、目录、技术栈只能作为证据和支撑，不要把 PPT 做成代码结构说明。不要套用千篇一律的固定结构。

只输出 JSON，结构：
{
  "style": "<风格 id>",
  "theme": {
    "name": "<本套 PPT 的专属主题名>",
    "concept": "<视觉与叙事概念，一句话>",
    "tone": "<表达语气，如 冷静可信 / 锐利发布 / 温暖叙事 / 治理中枢>",
    "coverKicker": "<封面小标签，不要默认写产品>",
    "paletteName": "<调色板名称，例如 海图夜航 / 低空雷达 / 纸面审计>",
    "mode": "dark|light|sandwich",
    "motif": "chip-bar|rule-number|serif-big|rounded|hairline|block|gold-line",
    "signature": "<本套视觉记忆点，例如 航线网格、票据切角、雷达扫描线>",
    "fontPair": "<字体配对 key，见下方菜单>",
    "coverVariant": "<封面构图: chip|serif|block|gold|rule|rounded|hairline|fullbleed|split>",
    "gradientAngle": "<渐变角度数字 100-170>",
    "palette": {
      "primary": "<主色 HEX>",
      "secondary": "<辅助色 HEX>",
      "accent": "<强调色 HEX>",
      "accent2": "<第二强调色 HEX，点睛用，与 accent 有明显色相差>",
      "bgDark": "<深底 HEX>",
      "bgLight": "<浅底 HEX>",
      "inkDark": "<深色文字 HEX>",
      "inkLight": "<浅色文字 HEX>",
      "cardBg": "<浅色卡片 HEX>",
      "cardBgDark": "<深色卡片 HEX>"
    }
  },
  "slides": [ { "layout": "<版式 id>", "title": "<该页标题，含信息量，不空喊>", "intent": "<这页要传达什么，一句话>" } ]
}

可用风格库：
${styleMenu}

可用版式（layout id）：
${layoutMenuForPrompt()}

硬性规则：
1. slides 数量必须正好 ${pageCount} 页（含封面、封底）。
2. 第 1 页必须 layout="cover"，最后 1 页必须 layout="closing"。
3. 相邻两页 layout 不同；整体要有节奏与变化。
4. ${styleDirective}
5. title 用 ${language}，具体、有信息量；intent 描述核心信息。
6. 内容紧扣业务上下文与「内容大方向」，主题由业务分析简报/用户输入确定。

${themeRules}

${modeRules}

不要输出 JSON 以外的任何解释文字。`

  const topicHint = cfg.topic || (contextSummary ? '（未提供，请据代码库自行提炼）' : '（未提供，请自行拟定一个合理的项目 PPT 主题）')

  const user = `# 主题
${topicHint}

# 受众
${cfg.audience || '公司领导 / 客户'}

# 内容大方向
${cfg.direction || '（未提供）'}

# 目标页数
${pageCount}

# 业务分析 / 代码证据上下文
${contextSummary || '（无扫描上下文，请只写该领域通用、可验证、不臆造的内容）'}`

  return [{ role: 'system', content: system }, { role: 'user', content: user }]
}

const ALT_LAYOUTS = ['businessOverview', 'userJourney', 'workflowDiagram', 'valueMatrix', 'riskMap', 'pillars', 'quadrant', 'bullets', 'iconCards', 'featureGrid', 'timeline', 'bigNumbers', 'bigStat', 'splitFeature', 'statement', 'compareColumns', 'barChart', 'architecture', 'progressBars', 'capabilityGrid', 'lineTrend', 'proportion', 'cycle', 'compareTable']

const COVER_VARIANT_IDS = ['chip', 'serif', 'block', 'gold', 'rule', 'rounded', 'hairline', 'fullbleed', 'split']

/** 把模型返回的大纲规整到合法、命中页数、首尾正确、相邻不重复 */
export function normalizeOutline(parsed, cfg, lastStyleId = null) {
  const pageCount = clampPageCount(cfg.pageCount)
  const forced = (cfg.styleId && cfg.styleId !== 'auto' && cfg.styleId !== 'random') ? cfg.styleId : null

  let styleId = forced || (parsed && getStyle(parsed.style)?.id === parsed.style ? parsed.style : null)
  if (!styleId) styleId = pickRandomStyle(lastStyleId).id

  const theme = parsed?.theme && typeof parsed.theme === 'object' ? {
    name: String(parsed.theme.name || '').slice(0, 80),
    concept: String(parsed.theme.concept || '').slice(0, 180),
    tone: String(parsed.theme.tone || '').slice(0, 80),
    coverKicker: String(parsed.theme.coverKicker || '').slice(0, 40),
    paletteName: String(parsed.theme.paletteName || parsed.theme.palette?.name || '').slice(0, 60),
    mode: ['dark', 'light', 'sandwich'].includes(parsed.theme.mode) ? parsed.theme.mode : '',
    motif: ['chip-bar', 'rule-number', 'serif-big', 'rounded', 'hairline', 'block', 'gold-line'].includes(parsed.theme.motif) ? parsed.theme.motif : '',
    signature: String(parsed.theme.signature || '').slice(0, 120),
    fontPair: FONT_PAIR_KEYS.includes(String(parsed.theme.fontPair || '').toLowerCase()) ? String(parsed.theme.fontPair).toLowerCase() : '',
    coverVariant: COVER_VARIANT_IDS.includes(String(parsed.theme.coverVariant || '').toLowerCase()) ? String(parsed.theme.coverVariant).toLowerCase() : '',
    gradientAngle: (() => { const a = Number(parsed.theme.gradientAngle); return Number.isFinite(a) ? ((a % 360) + 360) % 360 : undefined })(),
    palette: (() => {
      const src = parsed.theme.palette && typeof parsed.theme.palette === 'object' ? parsed.theme.palette : {}
      const out = {}
      for (const key of ['primary', 'secondary', 'accent', 'accent2', 'bgDark', 'bgLight', 'inkDark', 'inkLight', 'cardBg', 'cardBgDark']) {
        const val = cleanHex(src[key])
        if (val) out[key] = val
      }
      return out
    })(),
  } : null

  const imgCount = Math.max(0, parseInt(cfg.imageCount, 10) || 0)
  const IMG_LAYOUTS = ['imageShowcase', 'imageGrid']
  let slides = Array.isArray(parsed?.slides) ? parsed.slides.slice() : []
  slides = slides.map(s => {
    let layout = LAYOUT_MAP[s?.layout] ? s.layout : 'bullets'
    if (imgCount === 0 && IMG_LAYOUTS.includes(layout)) layout = 'bullets' // 无配图则不排图片版式
    return { layout, title: String(s?.title || '').slice(0, 60), intent: String(s?.intent || '').slice(0, 200) }
  })

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
  return { styleId, theme, slides }
}

export async function generateOutline(llmConfig, contextSummary, cfg, lastStyleId, opts = {}) {
  const messages = buildOutlineMessages(contextSummary, cfg, lastStyleId)
  const text = await callLlm(llmConfig, messages, {
    maxTokens: explicitMaxTokens(cfg),
    temperature: outlineTemperature(cfg),
    jsonMode: true,
    signal: opts.signal,
  })
  const parsed = robustJsonParse(text)
  return normalizeOutline(parsed, cfg, lastStyleId)
}

// ===================== 项目分析：由代码库推导主题 =====================

export async function generateProjectBrief(llmConfig, contextSummary, opts = {}) {
  const styleMenu = listStyles().map(s => `${s.id}(${s.name})`).join('、')
  const messages = [
    {
      role: 'system',
      content: `分析给定代码库，推断这是什么项目，并为「项目介绍 PPT」拟定方案。只输出 JSON：
{ "topic": "<PPT 主题/标题>", "audience": "<目标受众>", "direction": "<内容大方向，列出该突出的 3-5 个重点>", "styleId": "<最契合的风格 id>", "summary": "<一句话项目定位>" }
可选风格 id：${styleMenu}。基于真实代码结构与技术栈判断，不要臆造业务。只输出 JSON。`,
    },
    { role: 'user', content: contextSummary || '（无扫描上下文）' },
  ]
  const text = await callLlm(llmConfig, messages, { maxTokens: explicitMaxTokens(opts), temperature: 0.5, jsonMode: true, signal: opts.signal })
  const parsed = robustJsonParse(text) || {}
  const styleId = getStyle(parsed.styleId)?.id === parsed.styleId ? parsed.styleId : null
  return {
    topic: String(parsed.topic || '').slice(0, 80),
    audience: String(parsed.audience || '').slice(0, 60),
    direction: String(parsed.direction || '').slice(0, 300),
    styleId,
    summary: String(parsed.summary || '').slice(0, 120),
  }
}

// ===================== 阶段 B：逐页内容 =====================

export function buildSlideMessages(slideOutline, contextSummary, cfg, prevTitles = []) {
  const layout = LAYOUT_MAP[slideOutline.layout] || LAYOUT_MAP.bullets
  const language = cfg.language || '中文'
  const prevBlock = prevTitles.length ? `\n已生成页（避免重复）：\n${prevTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n` : ''
  const expressionRule = slideExpressionRule(cfg)
  const themeBlock = cfg.theme ? `\n# 本套 PPT 主题设计\n主题名：${cfg.theme.name || ''}\n视觉/叙事概念：${cfg.theme.concept || ''}\n语气：${cfg.theme.tone || ''}\n封面标签建议：${cfg.theme.coverKicker || ''}\n` : ''

  const system = `你在为一套业务汇报 PPT 填充【某一页】的内容。该页版式 = "${layout.id}"（${layout.label}）。

只输出 JSON，字段严格遵守该版式定义：
${layout.fields}

参考 JSON 形态（仅示意结构，请用真实内容替换）：
${JSON.stringify(layout.sample)}

规则：
- 用 ${language}，文案精炼：一个要点一句话，标题有信息量。
- 内容必须基于业务分析简报、汇报叙事与代码证据，紧扣本页「意图」；不要凑字数。
- ${expressionRule}
- 若提供了“本套 PPT 主题设计”，所有标题、kicker、措辞和封面副标题都要服从该主题；封面 kicker 优先使用 theme.coverKicker，不要默认写“产品”。
- 对 businessOverview / userJourney / workflowDiagram / valueMatrix / riskMap 这类业务图示页，必须填满主要字段：每个节点要有动作、痛点/约束、收益/控制或触点，不要只给短标题。
- 对 cards/items/steps/stages 这类数组，除非版式另有限制，优先给 4-5 项；描述要具体到业务行为或系统能力。
- 严禁臆造数字、指标、客户名、引用。${layout.id === 'bigNumbers' || layout.id === 'compareTable' ? '若上下文没有真实数据，宁可用定性描述，不要编造数值。' : ''}
- 图标名(icon)从这些英文键里选：database, server, cloud, shield, zap, layers, code, network, lock, users, settings, rocket, bar-chart, check, search, workflow, terminal, globe, smartphone, monitor, gauge, plug, key, folder, file-text, bell, refresh, target, grid, activity, lightbulb, message, clock, flag, star, cpu, git-branch。
- 不要输出 JSON 以外的任何文字。`

  const user = `# 本页标题
${slideOutline.title || ''}

# 本页意图
${slideOutline.intent || ''}

# 主题 / 大方向
${cfg.topic || ''} / ${cfg.direction || ''}
${themeBlock}
${prevBlock}
# 业务分析 / 代码证据上下文
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
    maxTokens: explicitMaxTokens(cfg),
    temperature: slideTemperature(cfg),
    jsonMode: true,
    signal: opts.signal,
  })
  const parsed = robustJsonParse(text)
  return normalizeSlideContent(parsed, slideOutline)
}
