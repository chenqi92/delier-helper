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
import { mix, ensureContrast } from './ppt-geometry.js'

export const STYLE_LIBRARY = [
  {
    id: 'tech-dark', name: '暗黑科技',
    mode: 'dark', motif: 'chip-bar', radius: 0.12,
    fonts: { title: 'Microsoft YaHei', body: 'Microsoft YaHei' },
    colors: {
      primary: '0A1733', secondary: '2A4684', accent: '35D6EE',
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
      primary: '1E2761', secondary: 'CADCFC', accent: '2E5BFF',
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
      primary: '111111', secondary: 'F2F2F2', accent: 'E63946',
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
      primary: 'B85042', secondary: 'E7E8D1', accent: '8AA399',
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
      primary: '2C5F2D', secondary: '97BC62', accent: '5A8A00',
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
      primary: '36454F', secondary: 'E9ECEE', accent: '111827',
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
      primary: '028090', secondary: '00A896', accent: '02C39A',
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
      primary: '2F3C7E', secondary: 'F9E795', accent: 'F96167',
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
      primary: '14342B', secondary: '1B5E20', accent: 'C9A227',
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
      primary: '0D0D0D', secondary: 'FAFAFA', accent: 'FFE600',
      bgDark: '0D0D0D', bgLight: '141414',
      inkDark: '0D0D0D', inkLight: 'FAFAFA',
      cardBg: 'F0F0F0', cardBgDark: '1A1A1A',
    },
  },
]

export const DEFAULT_STYLE_ID = 'tech-dark'

export function getStyle(id) {
  return STYLE_LIBRARY.find(s => s.id === id) || STYLE_LIBRARY[0]
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

  let bg, onDark
  if (style.mode === 'dark') { bg = isHero ? c.bgDark : c.bgLight; onDark = true }
  else if (style.mode === 'light') { bg = isHero ? c.primary : c.bgLight; onDark = isHero ? true : false }
  else { bg = isHero ? c.bgDark : c.bgLight; onDark = isHero }

  const ink = onDark ? c.inkLight : c.inkDark
  const muted = onDark ? mix(ink, bg, 0.42) : mix(ink, bg, 0.38)
  const card = onDark ? c.cardBgDark : c.cardBg
  const cardInk = luminanceLight(card) ? c.inkDark : c.inkLight
  const line = onDark ? mix(ink, bg, 0.62) : mix(ink, bg, 0.78)

  return {
    bg, ink, muted, card, cardInk, onDark, line,
    accent: c.accent, primary: c.primary, secondary: c.secondary,
    // 强调色当「文字/细线」压在本页背景上时的对比安全版（fill 仍用 accent）
    accentText: ensureContrast(c.accent, bg, 3),
  }
}

// 卡片底色是否偏亮（决定卡内文字色）
function luminanceLight(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150
}
