/**
 * PPT 风格库
 *
 * 每个风格定义：主色 / 辅助 / 强调 / 深底 / 浅底 / 文字色 / 卡片底 / 字体 / 母题 / 明暗节奏。
 * 母题(motif)与节奏(mode)由版式构建器(ppt-layouts)统一消费，保证整套一致。
 *
 * mode：
 *   'dark'     —— 全程深底，走高级感
 *   'light'    —— 全程浅底（封面/章节用主色块）
 *   'sandwich' —— 封面/章节/封底深底，内容页浅底（三明治结构）
 *
 * motif：卡片与标题的标志性处理
 *   'chip-bar'    图标圆片 + 卡片左侧彩色竖条
 *   'rule-number' 细分隔线 + 序号大字
 *   'serif-big'   超大衬线标题 + 单强调色块
 *   'rounded'     圆角卡 + 有机色块
 *   'hairline'    大量留白 + 细线
 *   'block'       大色块拼贴 + 粗体数字
 *   'gold-line'   金线点缀
 */
import { mix, ensureContrast, hexToHsl, hslToHex, luminance } from './ppt-geometry.js'

/**
 * PowerPoint 内置安全字体配对（AI 可按 key 选择）。
 * 中文标题优先 'yahei' / 'clean'；拉丁展示字体用于英文/数字为主的主题。
 */
export const PPT_FONT_PAIRS = {
  yahei: { title: 'Microsoft YaHei', body: 'Microsoft YaHei' },
  clean: { title: 'Calibri', body: 'Calibri' },
  serif: { title: 'Georgia', body: 'Calibri' },
  editorial: { title: 'Georgia', body: 'Arial' },
  humanist: { title: 'Trebuchet MS', body: 'Calibri' },
  elegant: { title: 'Palatino Linotype', body: 'Garamond' },
  impact: { title: 'Arial Black', body: 'Arial' },
  geometric: { title: 'Century Gothic', body: 'Calibri' },
}

export function resolveFontPair(key) {
  return PPT_FONT_PAIRS[String(key || '').toLowerCase()] || null
}

export const STYLE_LIBRARY = [
  {
    id: 'tech-dark', name: '暗黑科技',
    mode: 'dark', motif: 'chip-bar', radius: 0.12,
    fonts: { title: 'Microsoft YaHei', body: 'Microsoft YaHei' },
    colors: {
      primary: '0A1733', secondary: '2A4684', accent: '35D6EE', accent2: '9B7CFF',
      bgDark: '0A1733', bgLight: '0E1C3D',
      inkDark: '0A1733', inkLight: 'E8EEF7',
      cardBg: '15264C', cardBgDark: '15264C',
    },
  },
  {
    id: 'business-clean', name: '商务简洁',
    mode: 'sandwich', motif: 'rule-number', radius: 0.06,
    fonts: { title: 'Georgia', body: 'Calibri' },
    colors: {
      primary: '1E2761', secondary: 'CADCFC', accent: '2E5BFF', accent2: '17C3B2',
      bgDark: '1E2761', bgLight: 'FFFFFF',
      inkDark: '1A2238', inkLight: 'FFFFFF',
      cardBg: 'F4F7FE', cardBgDark: '2A356B',
    },
  },
  {
    id: 'magazine', name: '杂志编辑风',
    mode: 'sandwich', motif: 'serif-big', radius: 0.0,
    fonts: { title: 'Georgia', body: 'Arial' },
    colors: {
      primary: '111111', secondary: 'F2F2F2', accent: 'E63946', accent2: '2A9D8F',
      bgDark: '111111', bgLight: 'FFFFFF',
      inkDark: '141414', inkLight: 'F7F7F7',
      cardBg: 'F4F4F4', cardBgDark: '1C1C1C',
    },
  },
  {
    id: 'warm-brand', name: '暖色品牌',
    mode: 'sandwich', motif: 'rounded', radius: 0.16,
    fonts: { title: 'Palatino Linotype', body: 'Garamond' },
    colors: {
      primary: 'B85042', secondary: 'E7E8D1', accent: '8AA399', accent2: 'D0864F',
      bgDark: '5A2A22', bgLight: 'FBF6EE',
      inkDark: '3A2620', inkLight: 'FBF6EE',
      cardBg: 'FFFFFF', cardBgDark: '6E332A',
    },
  },
  {
    id: 'forest', name: '森林自然',
    mode: 'sandwich', motif: 'rounded', radius: 0.14,
    fonts: { title: 'Trebuchet MS', body: 'Calibri' },
    colors: {
      primary: '2C5F2D', secondary: '97BC62', accent: '5A8A00', accent2: 'C0842E',
      bgDark: '1E3F1F', bgLight: 'F4F7EE',
      inkDark: '23351F', inkLight: 'F4F7EE',
      cardBg: 'FFFFFF', cardBgDark: '274A28',
    },
  },
  {
    id: 'mono', name: '极简灰度',
    mode: 'light', motif: 'hairline', radius: 0.04,
    fonts: { title: 'Arial', body: 'Calibri' },
    colors: {
      primary: '36454F', secondary: 'E9ECEE', accent: '111827', accent2: '3B82F6',
      bgDark: '22282C', bgLight: 'FAFAFA',
      inkDark: '1F2933', inkLight: 'FAFAFA',
      cardBg: 'FFFFFF', cardBgDark: '2C3338',
    },
  },
  {
    id: 'teal-trust', name: '青蓝信任',
    mode: 'sandwich', motif: 'chip-bar', radius: 0.12,
    fonts: { title: 'Calibri', body: 'Calibri' },
    colors: {
      primary: '028090', secondary: '00A896', accent: '02C39A', accent2: 'FF8A5B',
      bgDark: '023E48', bgLight: 'F0FBFA',
      inkDark: '113A3C', inkLight: 'F0FBFA',
      cardBg: 'FFFFFF', cardBgDark: '035561',
    },
  },
  {
    id: 'coral', name: '活力珊瑚',
    mode: 'sandwich', motif: 'block', radius: 0.1,
    fonts: { title: 'Arial Black', body: 'Arial' },
    colors: {
      primary: '2F3C7E', secondary: 'F9E795', accent: 'F96167', accent2: '2EC4B6',
      bgDark: '2F3C7E', bgLight: 'FFF8F0',
      inkDark: '2A2A33', inkLight: 'FFFFFF',
      cardBg: 'FFFFFF', cardBgDark: '3A2A44',
    },
  },
  {
    id: 'deep-green-luxe', name: '高端深绿',
    mode: 'dark', motif: 'gold-line', radius: 0.06,
    fonts: { title: 'Georgia', body: 'Calibri' },
    colors: {
      primary: '14342B', secondary: '1B5E20', accent: 'C9A227', accent2: '3E9E75',
      bgDark: '0F2A22', bgLight: '14342B',
      inkDark: '1B2B24', inkLight: 'F0EAD6',
      cardBg: 'FFFFFF', cardBgDark: '17392E',
    },
  },
  {
    id: 'punk', name: '朋克高对比',
    mode: 'dark', motif: 'block', radius: 0.0,
    fonts: { title: 'Arial Black', body: 'Arial' },
    colors: {
      primary: '0D0D0D', secondary: 'FAFAFA', accent: 'FFE600', accent2: 'FF2E88',
      bgDark: '0D0D0D', bgLight: '141414',
      inkDark: '0D0D0D', inkLight: 'FAFAFA',
      cardBg: 'F0F0F0', cardBgDark: '1A1A1A',
    },
  },
]

export const DEFAULT_STYLE_ID = 'tech-dark'

const COLOR_KEYS = ['primary', 'secondary', 'accent', 'accent2', 'bgDark', 'bgLight', 'inkDark', 'inkLight', 'cardBg', 'cardBgDark']
const MOTIFS = new Set(['chip-bar', 'rule-number', 'serif-big', 'rounded', 'hairline', 'block', 'gold-line'])
const MODES = new Set(['dark', 'light', 'sandwich'])
// 与 ppt-layouts 的 COVER_VARIANTS 对应（此处独立列出以避免循环依赖）
const COVER_VARIANTS = new Set(['chip', 'serif', 'block', 'gold', 'rule', 'rounded', 'hairline', 'fullbleed', 'split'])

function cleanHex(v) {
  const s = String(v || '').replace(/^#/, '').trim()
  return /^[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : ''
}

function cloneStyle(style) {
  return {
    ...style,
    fonts: { ...(style.fonts || {}) },
    colors: { ...(style.colors || {}) },
  }
}

export function getStyle(id) {
  if (id && typeof id === 'object' && id.colors) return id
  return STYLE_LIBRARY.find(s => s.id === id) || STYLE_LIBRARY[0]
}

export function createThemeStyle(baseStyleId = DEFAULT_STYLE_ID, theme = {}) {
  const palette = theme?.palette && typeof theme.palette === 'object' ? theme.palette : null
  if (!palette) return null

  const base = cloneStyle(getStyle(baseStyleId))
  let changed = false
  for (const key of COLOR_KEYS) {
    const val = cleanHex(palette[key])
    if (!val) continue
    base.colors[key] = val
    changed = true
  }
  if (!changed) return null

  const mode = MODES.has(theme.mode) ? theme.mode : base.mode
  const motif = MOTIFS.has(theme.motif) ? theme.motif : base.motif
  const radius = Number.isFinite(Number(theme.radius)) ? Math.max(0, Math.min(0.18, Number(theme.radius))) : base.radius
  const coverVariant = COVER_VARIANTS.has(String(theme.coverVariant || '')) ? String(theme.coverVariant) : (base.coverVariant || null)

  // 字体：优先按配对 key，其次接受合法的 {title, body} 覆盖
  const fontPair = resolveFontPair(theme.fontPair)
  const fonts = fontPair
    ? { ...fontPair }
    : (theme.fonts && typeof theme.fonts === 'object'
      ? { title: String(theme.fonts.title || base.fonts.title), body: String(theme.fonts.body || base.fonts.body) }
      : base.fonts)

  // 渐变：默认开启；gradient===false 关闭；gradient/gradientAngle 为角度时覆盖
  const gradient = theme.gradient === false ? false : (base.gradient !== false)
  const gaRaw = Number(theme.gradientAngle ?? (typeof theme.gradient === 'number' ? theme.gradient : NaN))
  const gradientAngle = Number.isFinite(gaRaw) ? ((gaRaw % 360) + 360) % 360 : base.gradientAngle

  return {
    ...base,
    id: `ai-${base.id}`,
    name: theme.paletteName || theme.name || `AI ${base.name}`,
    mode,
    motif,
    radius,
    fonts,
    gradient,
    gradientAngle,
    coverVariant,
    aiGenerated: true,
    sourceStyleId: base.id,
  }
}

/** 缺省第二强调色：与主强调色互补偏移的高辨识度色 */
function deriveAccent2(accent) {
  const { h, s, l } = hexToHsl(accent)
  return hslToHex(h + 150, Math.min(0.85, Math.max(0.45, s)), Math.min(0.62, Math.max(0.42, l)))
}

/** 按角色构建页面背景填充（渐变／纯色）。hero 页深—浅—强调光晕；内容页极轻洗色。 */
function buildBgFill(style, role, bg, onDark, accent, primary) {
  if (style.gradient === false) return { type: 'color', color: bg }
  const isHero = role === 'cover' || role === 'section' || role === 'closing'
  if (isHero) {
    const angle = Number.isFinite(Number(style.gradientAngle)) ? Number(style.gradientAngle) : 125
    const deep = mix(bg, '000000', onDark ? 0.18 : 0.05)
    const glow = mix(bg, accent, onDark ? 0.22 : 0.14)
    return { type: 'gradient', color: bg, angle, stops: [
      { color: deep, pos: 0 }, { color: bg, pos: 52 }, { color: glow, pos: 100 },
    ] }
  }
  const tint = onDark ? accent : primary
  const amt = onDark ? 0.10 : 0.05
  const c0 = mix(bg, '000000', onDark ? 0.05 : 0.012)
  const c2 = mix(bg, tint, amt)
  return { type: 'gradient', color: bg, angle: 160, stops: [
    { color: c0, pos: 0 }, { color: bg, pos: 48 }, { color: c2, pos: 100 },
  ] }
}

export function resolveStyle(styleId, styleDef = null) {
  return styleDef?.colors ? styleDef : getStyle(styleId)
}

export function listStyles() {
  return STYLE_LIBRARY.map(s => ({ id: s.id, name: s.name, mode: s.mode, accent: s.colors.accent, primary: s.colors.primary }))
}

/**
 * 随机挑一个与 excludeId 不同的风格（实现「风格迥异」）
 * 注意：调用方需自行传入随机数，避免在确定性环境中出错。
 */
export function pickRandomStyle(excludeId, rnd = Math.random()) {
  const pool = STYLE_LIBRARY.filter(s => s.id !== excludeId)
  if (pool.length === 0) return STYLE_LIBRARY[0]
  return pool[Math.floor(rnd * pool.length) % pool.length]
}

/**
 * 根据风格的明暗节奏 + 页面角色，解析出该页的背景/文字/卡片配色。
 * role: 'cover' | 'section' | 'content' | 'closing'
 * 返回 { bg, ink, muted, card, cardInk, onDark, accent, primary, secondary, line }
 */
export function slideTheme(style, role = 'content') {
  const c = style.colors
  const isHero = role === 'cover' || role === 'section' || role === 'closing'

  let bg
  if (style.mode === 'dark') bg = isHero ? c.bgDark : c.bgLight
  else if (style.mode === 'light') bg = isHero ? c.primary : c.bgLight
  else bg = isHero ? c.bgDark : c.bgLight
  // onDark 由背景实际明度决定，兼容 AI 自由配色中 mode 与 bg 明暗不一致的情况（避免文字与底色撞色）
  const onDark = luminance(bg) < 0.5

  const ink = onDark ? c.inkLight : c.inkDark
  const muted = onDark ? mix(ink, bg, 0.42) : mix(ink, bg, 0.38)
  const card = onDark ? c.cardBgDark : c.cardBg
  const cardInk = luminanceLight(card) ? c.inkDark : c.inkLight
  const line = onDark ? mix(ink, bg, 0.62) : mix(ink, bg, 0.78)
  const accent2 = c.accent2 || deriveAccent2(c.accent)

  return {
    bg, ink, muted, card, cardInk, onDark, line,
    accent: c.accent, accent2, primary: c.primary, secondary: c.secondary,
    // 强调色当「文字/细线」压在本页背景上时的对比安全版（fill 仍用 accent）
    accentText: ensureContrast(c.accent, bg, 3),
    accent2Text: ensureContrast(accent2, bg, 3),
    // 页面背景填充（渐变优先，含纯色兜底 color）
    bgFill: buildBgFill(style, role, bg, onDark, c.accent, c.primary),
  }
}

// 卡片底色是否偏亮（决定卡内文字色）
function luminanceLight(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150
}
