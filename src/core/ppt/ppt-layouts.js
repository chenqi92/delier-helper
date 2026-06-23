/**
 * 版式构建器（设计系统核心）
 *
 * 每个版式：把「结构化内容 content + 风格 style」编译成定位好的 elements[]。
 * 设计原则落地于此：配色克制(主/辅/强调)、母题重复、明暗节奏、字号层级、统一留白。
 * 生成后 elements[] 完全可编辑；二者（HTML 编辑器 / pptx 导出）共用同一份输出。
 *
 * 注册项结构：
 *   { id, label, role, fields(给 LLM 的内容 JSON 说明), sample(占位/校验), build(content, style, pageNo) }
 */
import { E } from './ppt-elements.js'
import {
  SLIDE_W, SLIDE_H, MARGIN, GUTTER, contentBox, splitCols, gridCells, clamp,
  mix, lighten, darken, pickInk, ensureContrast, hexToHsl, hslToHex,
} from './ppt-geometry.js'
import { slideTheme } from './ppt-styles.js'

const HEADER_BOTTOM = 1.98

// ===================== 共用构件 =====================

function bg(theme) { return { type: 'color', color: theme.bg } }

function chipWidth(text) {
  return Math.max(0.7, Math.min(3.2, 0.13 * String(text || '').length + 0.34))
}

/** 统一页眉：kicker 标签 + 大标题 + 母题分隔 + 页码 */
function headerEls(theme, style, { kicker, title, pageNo }) {
  const els = []
  const top = 0.62
  let titleY = top
  if (kicker) {
    if (style.motif === 'serif-big' || style.motif === 'hairline') {
      els.push(E.text({
        x: MARGIN, y: top, w: 8, h: 0.3, text: String(kicker).toUpperCase(),
        fontFace: style.fonts.body, fontSize: 11, bold: true, color: theme.accent, charSpacing: 3,
      }))
    } else {
      const w = chipWidth(kicker)
      const solid = style.motif === 'chip-bar' || style.motif === 'block'
      els.push(E.roundRect({ x: MARGIN, y: top, w, h: 0.32, radius: 0.16, fill: theme.accent, fillAlpha: solid ? 1 : 0.16 }))
      els.push(E.text({
        x: MARGIN, y: top, w, h: 0.32, text: kicker, align: 'center', valign: 'middle',
        fontFace: style.fonts.body, fontSize: 10.5, bold: true,
        color: solid ? pickInk(theme.accent) : theme.accent,
      }))
    }
    titleY = top + 0.46
  }
  els.push(E.text({
    x: MARGIN, y: titleY, w: SLIDE_W - 2 * MARGIN - 0.9, h: 0.78,
    text: title || '', fontFace: style.fonts.title, fontSize: 27, bold: true,
    color: theme.ink, valign: 'middle', shrink: true,
  }))
  const ruleY = titleY + 0.86
  if (['rule-number', 'hairline', 'gold-line', 'serif-big'].includes(style.motif)) {
    els.push(E.line({ x: MARGIN, y: ruleY, w: SLIDE_W - 2 * MARGIN, h: 0, lineColor: theme.line, lineWidth: style.motif === 'gold-line' ? 1.5 : 1 }))
  } else {
    els.push(E.rect({ x: MARGIN, y: ruleY, w: 0.82, h: 0.06, fill: theme.accent }))
  }
  if (pageNo) {
    els.push(E.text({ x: SLIDE_W - MARGIN - 0.9, y: SLIDE_H - 0.46, w: 0.9, h: 0.3, text: String(pageNo).padStart(2, '0'), align: 'right', fontFace: style.fonts.body, fontSize: 10, color: theme.muted }))
  }
  return els
}

/** 图标圆片（母题）：chip 背景 + 居中图标 */
function chipIcon(cx, cy, d, { icon, glyph, fill, round = true }) {
  const x = +(cx - d / 2).toFixed(3), y = +(cy - d / 2).toFixed(3)
  const shape = round
    ? E.ellipse({ x, y, w: d, h: d, fill })
    : E.roundRect({ x, y, w: d, h: d, radius: 0.08, fill })
  const gd = +(d * 0.56).toFixed(3)
  const ic = E.icon({ x: +(cx - gd / 2).toFixed(3), y: +(cy - gd / 2).toFixed(3), w: gd, h: gd, name: icon, color: glyph, strokeWidth: 2 })
  return [shape, ic]
}

/** 数字徽章（时间线 / 步骤序号） */
function numberBadge(cx, cy, d, fill, ink, n, fontFace) {
  const x = +(cx - d / 2).toFixed(3), y = +(cy - d / 2).toFixed(3)
  return [
    E.ellipse({ x, y, w: d, h: d, fill }),
    E.text({ x, y, w: d, h: d, text: String(n), align: 'center', valign: 'middle', fontFace, fontSize: d > 0.6 ? 18 : 13, bold: true, color: ink }),
  ]
}

/** 图标功能卡（母题感知） */
function featureCard(theme, style, box, { icon, title, desc, accent }) {
  const els = []
  const ac = accent || theme.accent
  const lightBorder = theme.onDark ? null : { color: mix(theme.card, theme.ink, 0.1), width: 1 }
  els.push(E.roundRect({ ...box, radius: style.radius, fill: theme.card, line: lightBorder, shadow: !theme.onDark }))
  let pad = 0.28
  if (style.motif === 'chip-bar') {
    els.push(E.rect({ x: +(box.x + 0.001).toFixed(3), y: box.y + 0.14, w: 0.08, h: box.h - 0.28, fill: ac }))
    pad = 0.36
  } else if (style.motif === 'block') {
    els.push(E.rect({ x: box.x, y: box.y, w: box.w, h: 0.12, fill: ac }))
  }
  const cs = box.x + pad
  const chipD = 0.64
  const cyTop = box.y + pad + chipD / 2
  els.push(...chipIcon(cs + chipD / 2, cyTop, chipD, { icon, glyph: pickInk(ac), fill: ac, round: style.motif !== 'block' }))
  els.push(E.text({
    x: cs, y: box.y + pad + chipD + 0.14, w: box.w - pad - 0.22, h: 0.36,
    text: title || '', fontFace: style.fonts.title, fontSize: 14.5, bold: true, color: theme.cardInk, shrink: true,
  }))
  els.push(E.text({
    x: cs, y: box.y + pad + chipD + 0.52, w: box.w - pad - 0.22, h: box.h - (pad + chipD + 0.62),
    text: desc || '', fontFace: style.fonts.body, fontSize: 11, color: mix(theme.cardInk, theme.card, 0.28), lineSpacing: 14, wrap: true,
  }))
  return els
}

/** hero 类页（封面/章节/封底）的统一装饰 */
function heroDecor(theme, style) {
  const els = []
  els.push(E.rect({ x: 0, y: 0, w: 0.22, h: SLIDE_H, fill: theme.accentText }))
  els.push(E.ellipse({ x: SLIDE_W - 3.2, y: SLIDE_H - 3.4, w: 4.8, h: 4.8, fill: theme.accent, fillAlpha: 0.10, decor: true }))
  if (style.motif === 'gold-line') {
    els.push(E.line({ x: 1.1, y: SLIDE_H - 1.15, w: 3.2, h: 0, lineColor: theme.accent, lineWidth: 1.5 }))
  }
  return els
}

const ACCENTS = (theme, style) => {
  const c = style.colors
  return [theme.accent, c.secondary, c.primary, mix(theme.accent, c.primary, 0.5)]
}

// 图表配色：以品牌强调色打头，其余按色相轮转，保证各数据类别之间也能区分
function chartPalette(theme, style) {
  const baseH = hexToHsl(theme.accent).h
  const offsets = [60, 120, 180, 240, 300]
  const sat = 0.62, lig = theme.onDark ? 0.62 : 0.45
  const out = [theme.accent]
  for (let i = 0; i < offsets.length; i++) out.push(hslToHex(baseH + offsets[i], sat, lig))
  return out.map(col => ensureContrast(col, theme.bg, 1.7))
}

// 右下角页码（无 header 的图表/图片页复用）
function contentZone(hasNote) {
  return { x: MARGIN, y: HEADER_BOTTOM + 0.3, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.3 - (hasNote ? 0.95 : 0.5) }
}

/**
 * 全局视觉精修层：让生成页不只是“干净摆放元素”，而有更完整的版面层次。
 * 装饰元素都放在底层并标记 decor，保留文本/图表/形状的可编辑性。
 */
function visualPolish(layoutId, role, style, pageNo) {
  const t = slideTheme(style, role)
  const els = []
  const ac = t.accentText || t.accent
  const soft = t.onDark ? mix(t.bg, t.ink, 0.08) : mix(t.bg, t.accent, 0.06)
  const softer = t.onDark ? mix(t.bg, t.ink, 0.045) : mix(t.bg, t.primary, 0.035)
  const grid = t.onDark ? mix(t.bg, t.ink, 0.13) : mix(t.bg, t.ink, 0.88)

  if (role === 'cover' || role === 'section' || role === 'closing') {
    els.push(E.rect({ x: SLIDE_W - 0.12, y: 0, w: 0.12, h: SLIDE_H, fill: ac, fillAlpha: 0.75, decor: true }))
    for (let i = 0; i < 9; i++) {
      els.push(E.line({ x: SLIDE_W - 2.6 + i * 0.22, y: 0.28, w: 0.75, h: 0, lineColor: mix(ac, t.bg, 0.58), lineWidth: 0.55, rot: -35, decor: true }))
    }
    return els
  }

  const denseLayouts = new Set(['businessOverview', 'userJourney', 'workflowDiagram', 'valueMatrix', 'riskMap', 'architecture', 'barChart', 'lineTrend', 'proportion'])
  const dense = denseLayouts.has(layoutId)

  if (dense) {
    for (let i = -8; i < 24; i++) {
      els.push(E.line({ x: i * 0.72, y: 0.1, w: 2.9, h: SLIDE_H + 0.6, lineColor: grid, lineWidth: 0.35, rot: -18, decor: true }))
    }
    for (let x = 0.6; x < SLIDE_W; x += 1.2) {
      els.push(E.line({ x, y: 0.95, w: 0, h: SLIDE_H - 1.72, lineColor: grid, lineWidth: 0.28, dash: 'dash', decor: true }))
    }
  }

  els.push(E.rect({ x: 0, y: 0, w: SLIDE_W, h: 0.12, fill: ac, fillAlpha: t.onDark ? 0.45 : 0.25, decor: true }))
  els.push(E.rect({ x: 0, y: SLIDE_H - 0.16, w: SLIDE_W, h: 0.16, fill: soft, decor: true }))
  els.push(E.rect({ x: SLIDE_W - 0.2, y: 0, w: 0.2, h: SLIDE_H, fill: ac, fillAlpha: t.onDark ? 0.14 : 0.09, decor: true }))
  els.push(E.roundRect({ x: SLIDE_W - 2.72, y: 0.42, w: 2.18, h: 0.54, radius: 0.04, fill: soft, decor: true }))
  els.push(E.text({ x: SLIDE_W - 2.62, y: 0.48, w: 1.96, h: 0.34, text: String(pageNo || '').padStart(2, '0'), align: 'right', fontFace: style.fonts.title, fontSize: 18, bold: true, color: mix(t.muted, t.bg, 0.42), decor: true }))
  els.push(E.line({ x: 0.62, y: 1.42, w: SLIDE_W - 1.24, h: 0, lineColor: mix(ac, t.bg, t.onDark ? 0.35 : 0.5), lineWidth: 0.8, dash: 'dash', decor: true }))

  const dotX = dense ? SLIDE_W - 2.55 : SLIDE_W - 2.2
  const dotY = dense ? SLIDE_H - 1.2 : SLIDE_H - 1.05
  const dotCols = dense ? 9 : 7
  const dotRows = dense ? 5 : 4
  for (let r = 0; r < dotRows; r++) {
    for (let c = 0; c < dotCols; c++) {
      els.push(E.ellipse({ x: dotX + c * 0.16, y: dotY + r * 0.14, w: 0.035, h: 0.035, fill: ac, fillAlpha: t.onDark ? 0.32 : 0.22, decor: true }))
    }
  }

  if (style.motif === 'block') {
    els.push(E.rect({ x: -0.6, y: SLIDE_H - 1.65, w: 4.1, h: 0.42, fill: t.secondary, fillAlpha: 0.35, rot: -7, decor: true }))
    els.push(E.rect({ x: SLIDE_W - 4.15, y: 1.28, w: 4.65, h: 0.34, fill: ac, fillAlpha: 0.18, rot: 6, decor: true }))
  } else if (style.motif === 'hairline' || style.motif === 'serif-big') {
    els.push(E.rect({ x: 0.38, y: 0.38, w: SLIDE_W - 0.76, h: SLIDE_H - 0.76, fill: null, line: { color: mix(t.line, t.bg, 0.35), width: 0.55 }, decor: true }))
    els.push(E.line({ x: 0.62, y: SLIDE_H - 0.68, w: 2.0, h: 0, lineColor: mix(ac, t.bg, 0.4), lineWidth: 1.1, decor: true }))
  } else {
    els.push(E.ellipse({ x: SLIDE_W - 2.05, y: SLIDE_H - 1.58, w: 2.9, h: 2.9, fill: softer, decor: true }))
    els.push(E.ellipse({ x: -1.05, y: SLIDE_H - 1.45, w: 2.15, h: 2.15, fill: ac, fillAlpha: t.onDark ? 0.08 : 0.055, decor: true }))
  }

  if (dense) {
    const corner = mix(ac, t.bg, 0.18)
    const cw = 0.48
    ;[
      [0.42, 0.42, 1, 1],
      [SLIDE_W - 0.9, 0.42, -1, 1],
      [0.42, SLIDE_H - 0.9, 1, -1],
      [SLIDE_W - 0.9, SLIDE_H - 0.9, -1, -1],
    ].forEach(([x, y, sx, sy]) => {
      els.push(E.line({ x, y, w: cw * sx, h: 0, lineColor: corner, lineWidth: 1.1, decor: true }))
      els.push(E.line({ x, y, w: 0, h: cw * sy, lineColor: corner, lineWidth: 1.1, decor: true }))
    })
  }

  return els
}

// 媒体占位框（无真实图片时）
function mediaPlaceholder(theme, style, box, icon, caption) {
  const els = []
  const frameBorder = { color: theme.onDark ? mix(theme.bg, theme.ink, 0.3) : mix(theme.card, theme.ink, 0.18), width: 1.25 }
  els.push(E.roundRect({ x: box.x, y: box.y, w: box.w, h: box.h, radius: style.radius, fill: mix(theme.card, theme.bg, theme.onDark ? 0.2 : 0), line: frameBorder, shadow: !theme.onDark }))
  const ic = Math.min(1.4, box.h * 0.4)
  els.push(...chipIcon(box.x + box.w / 2, box.y + box.h / 2, ic, { icon: icon || 'monitor', glyph: pickInk(theme.accent), fill: theme.accent, round: style.motif !== 'block' }))
  return els
}

// ===================== 封面：按母题给出迥异的构图 =====================

// 同母题但不同风格时，用另一套装饰避免「结构雷同」
const ALT_COVER = new Set(['teal-trust', 'forest', 'punk'])

function coverChip(content, style) {
  const c = style.colors, bgc = c.bgDark, ink = c.inkLight, acc = ensureContrast(c.accent, c.bgDark, 3)
  const els = []
  if (ALT_COVER.has(style.id)) {
    for (let i = 1; i <= 4; i++) { const r = i * 0.72; els.push(E.ellipse({ x: SLIDE_W - 0.6 - r, y: 0.4 - r, w: 2 * r, h: 2 * r, fill: null, line: { color: acc, width: 1 }, opacity: 0.5, decor: true })) }
  } else {
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) els.push(E.ellipse({ x: 9.7 + k * 0.46, y: 0.7 + r * 0.46, w: 0.09, h: 0.09, fill: acc, fillAlpha: 0.5, decor: true }))
  }
  els.push(E.ellipse({ x: SLIDE_W - 3.0, y: SLIDE_H - 3.2, w: 4.6, h: 4.6, fill: acc, fillAlpha: 0.1, decor: true }))
  els.push(E.rect({ x: 0, y: 0, w: 0.18, h: SLIDE_H, fill: acc }))
  if (content.kicker) {
    const w = chipWidth(content.kicker)
    els.push(E.roundRect({ x: 1.1, y: 1.9, w, h: 0.4, radius: 0.2, fill: acc }))
    els.push(E.text({ x: 1.1, y: 1.9, w, h: 0.4, text: content.kicker, align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 12, bold: true, color: pickInk(acc) }))
  }
  els.push(E.text({ x: 1.08, y: 2.5, w: 10.5, h: 1.8, text: content.title || '标题', fontFace: style.fonts.title, fontSize: 46, bold: true, color: ink, valign: 'top', shrink: true, lineSpacing: 50 }))
  els.push(E.rect({ x: 1.12, y: 4.45, w: 1.0, h: 0.07, fill: acc }))
  if (content.subtitle) els.push(E.text({ x: 1.12, y: 4.7, w: 9.5, h: 0.9, text: content.subtitle, fontFace: style.fonts.body, fontSize: 17, color: mix(ink, bgc, 0.25), lineSpacing: 23 }))
  if (content.footnote) els.push(E.text({ x: 1.12, y: SLIDE_H - 0.9, w: 9, h: 0.4, text: content.footnote, fontFace: style.fonts.body, fontSize: 12, color: mix(ink, bgc, 0.45) }))
  return { background: { type: 'color', color: bgc }, elements: els }
}

function coverSerif(content, style) {
  const c = style.colors, bgc = c.bgLight, ink = c.inkDark, acc = c.accent
  const els = []
  els.push(E.rect({ x: SLIDE_W - 0.55, y: 0, w: 0.55, h: SLIDE_H, fill: acc }))
  if (content.kicker) els.push(E.text({ x: 1.1, y: 1.4, w: 8, h: 0.4, text: String(content.kicker).toUpperCase(), fontFace: style.fonts.body, fontSize: 13, bold: true, color: acc, charSpacing: 4 }))
  els.push(E.rect({ x: 1.12, y: 1.96, w: 0.7, h: 0.06, fill: ink }))
  els.push(E.text({ x: 1.06, y: 2.2, w: 10.2, h: 3.0, text: content.title || '标题', fontFace: style.fonts.title, fontSize: 62, bold: true, color: ink, valign: 'top', shrink: true, lineSpacing: 64 }))
  if (content.subtitle) els.push(E.text({ x: 1.12, y: 5.5, w: 9.2, h: 0.9, text: content.subtitle, fontFace: style.fonts.body, fontSize: 16, italic: true, color: mix(ink, bgc, 0.35), lineSpacing: 22 }))
  if (content.footnote) els.push(E.text({ x: 1.12, y: SLIDE_H - 0.85, w: 9, h: 0.4, text: content.footnote, fontFace: style.fonts.body, fontSize: 11.5, color: mix(ink, bgc, 0.45) }))
  return { background: { type: 'color', color: bgc }, elements: els }
}

function coverBlock(content, style) {
  const c = style.colors, bgc = c.bgDark, ink = c.inkLight
  const acc = ensureContrast(c.accent, c.bgDark, 3), sec = c.secondary
  const els = []
  els.push(E.rect({ x: 0, y: 4.7, w: SLIDE_W, h: SLIDE_H - 4.7, fill: acc }))
  if (ALT_COVER.has(style.id)) {
    els.push(E.rect({ x: -1.5, y: 0.45, w: 7.5, h: 0.7, fill: sec, rot: -8, decor: true }))
    els.push(E.rect({ x: 8.5, y: 0, w: 0.45, h: 4.7, fill: sec }))
  } else {
    els.push(E.rect({ x: 8.8, y: 0, w: SLIDE_W - 8.8, h: 4.7, fill: mix(bgc, acc, 0.18) }))
    els.push(E.roundRect({ x: 9.7, y: 1.2, w: 2.4, h: 2.4, radius: 0.16, fill: sec, fillAlpha: 0.92, rot: 12, decor: true }))
  }
  if (content.kicker) {
    const w = chipWidth(content.kicker)
    els.push(E.roundRect({ x: 1.1, y: 1.4, w, h: 0.42, radius: 0.08, fill: sec }))
    els.push(E.text({ x: 1.1, y: 1.4, w, h: 0.42, text: content.kicker, align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 12, bold: true, color: pickInk(sec) }))
  }
  els.push(E.text({ x: 1.05, y: 2.0, w: 8.0, h: 2.5, text: content.title || '标题', fontFace: style.fonts.title, fontSize: 52, bold: true, color: ink, valign: 'top', shrink: true, lineSpacing: 54 }))
  if (content.subtitle) els.push(E.text({ x: 1.1, y: 5.0, w: 7.5, h: 1.4, text: content.subtitle, fontFace: style.fonts.body, fontSize: 17, bold: true, color: pickInk(acc), valign: 'middle', lineSpacing: 22 }))
  if (content.footnote) els.push(E.text({ x: 9.0, y: 5.0, w: 3.7, h: 1.4, text: content.footnote, align: 'right', fontFace: style.fonts.body, fontSize: 12, color: pickInk(acc), valign: 'middle' }))
  return { background: { type: 'color', color: bgc }, elements: els }
}

function coverGold(content, style) {
  const c = style.colors, bgc = c.bgDark, ink = c.inkLight, acc = c.accent
  const els = []
  els.push(E.ellipse({ x: SLIDE_W / 2 - 3.3, y: SLIDE_H / 2 - 3.3, w: 6.6, h: 6.6, fill: null, line: { color: acc, width: 0.75 }, decor: true }))
  if (content.kicker) els.push(E.text({ x: 1.5, y: 2.2, w: SLIDE_W - 3, h: 0.4, text: String(content.kicker).toUpperCase(), align: 'center', fontFace: style.fonts.body, fontSize: 13, bold: true, color: acc, charSpacing: 5 }))
  els.push(E.line({ x: SLIDE_W / 2 - 1.0, y: 2.9, w: 2.0, h: 0, lineColor: acc, lineWidth: 1.25 }))
  els.push(E.text({ x: 1.0, y: 3.1, w: SLIDE_W - 2, h: 1.3, text: content.title || '标题', align: 'center', fontFace: style.fonts.title, fontSize: 40, bold: true, color: ink, valign: 'middle', shrink: true }))
  els.push(E.line({ x: SLIDE_W / 2 - 1.0, y: 4.5, w: 2.0, h: 0, lineColor: acc, lineWidth: 1.25 }))
  if (content.subtitle) els.push(E.text({ x: 1.5, y: 4.75, w: SLIDE_W - 3, h: 0.7, text: content.subtitle, align: 'center', fontFace: style.fonts.body, fontSize: 15, color: mix(ink, bgc, 0.3) }))
  if (content.footnote) els.push(E.text({ x: 1.5, y: SLIDE_H - 0.8, w: SLIDE_W - 3, h: 0.4, text: content.footnote, align: 'center', fontFace: style.fonts.body, fontSize: 11.5, color: acc }))
  return { background: { type: 'color', color: bgc }, elements: els }
}

function coverRule(content, style) {
  const c = style.colors, bgc = c.bgDark, ink = c.inkLight, acc = ensureContrast(c.accent, c.bgDark, 3)
  const els = []
  els.push(E.line({ x: 1.1, y: 1.6, w: SLIDE_W - 2.2, h: 0, lineColor: mix(ink, bgc, 0.6), lineWidth: 1 }))
  if (content.kicker) els.push(E.text({ x: 1.1, y: 1.25, w: 8, h: 0.32, text: String(content.kicker).toUpperCase(), fontFace: style.fonts.body, fontSize: 11, bold: true, color: acc, charSpacing: 3 }))
  els.push(E.text({ x: SLIDE_W - 3.1, y: 1.18, w: 2.0, h: 0.32, text: '01', align: 'right', fontFace: style.fonts.title, fontSize: 13, bold: true, color: acc }))
  els.push(E.text({ x: 1.06, y: 2.6, w: 10.5, h: 1.8, text: content.title || '标题', fontFace: style.fonts.title, fontSize: 44, bold: true, color: ink, valign: 'middle', shrink: true }))
  if (content.subtitle) els.push(E.text({ x: 1.12, y: 4.5, w: 9.2, h: 0.9, text: content.subtitle, fontFace: style.fonts.body, fontSize: 16, color: mix(ink, bgc, 0.28), lineSpacing: 22 }))
  els.push(E.line({ x: 1.1, y: SLIDE_H - 1.0, w: SLIDE_W - 2.2, h: 0, lineColor: mix(ink, bgc, 0.6), lineWidth: 1 }))
  if (content.footnote) els.push(E.text({ x: 1.1, y: SLIDE_H - 0.85, w: 9, h: 0.4, text: content.footnote, fontFace: style.fonts.body, fontSize: 11.5, color: mix(ink, bgc, 0.4) }))
  return { background: { type: 'color', color: bgc }, elements: els }
}

function coverRounded(content, style) {
  const c = style.colors, bgc = c.bgLight, ink = c.inkDark, acc = c.accent, sec = c.secondary
  const els = []
  if (ALT_COVER.has(style.id)) {
    els.push(E.ellipse({ x: SLIDE_W - 4.2, y: SLIDE_H - 3.8, w: 5.4, h: 5.4, fill: sec, fillAlpha: 0.45, decor: true }))
    els.push(E.ellipse({ x: -1.2, y: -1.2, w: 3.2, h: 3.2, fill: acc, fillAlpha: 0.16, decor: true }))
    els.push(E.ellipse({ x: SLIDE_W - 1.7, y: 0.9, w: 0.55, h: 0.55, fill: acc, fillAlpha: 0.9, decor: true }))
  } else {
    els.push(E.ellipse({ x: SLIDE_W - 3.4, y: -1.4, w: 4.4, h: 4.4, fill: sec, fillAlpha: 0.5, decor: true }))
    els.push(E.ellipse({ x: SLIDE_W - 2.0, y: SLIDE_H - 2.4, w: 3.4, h: 3.4, fill: acc, fillAlpha: 0.18, decor: true }))
    els.push(E.ellipse({ x: -1.0, y: SLIDE_H - 2.2, w: 3.0, h: 3.0, fill: acc, fillAlpha: 0.12, decor: true }))
  }
  if (content.kicker) {
    const w = chipWidth(content.kicker)
    els.push(E.roundRect({ x: 1.1, y: 1.9, w, h: 0.42, radius: 0.21, fill: acc }))
    els.push(E.text({ x: 1.1, y: 1.9, w, h: 0.42, text: content.kicker, align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 12, bold: true, color: pickInk(acc) }))
  }
  els.push(E.text({ x: 1.08, y: 2.6, w: 9.3, h: 1.8, text: content.title || '标题', fontFace: style.fonts.title, fontSize: 44, bold: true, color: ink, valign: 'top', shrink: true, lineSpacing: 48 }))
  if (content.subtitle) els.push(E.text({ x: 1.12, y: 4.6, w: 8.6, h: 0.9, text: content.subtitle, fontFace: style.fonts.body, fontSize: 16, color: mix(ink, bgc, 0.3), lineSpacing: 22 }))
  if (content.footnote) els.push(E.text({ x: 1.12, y: SLIDE_H - 0.9, w: 9, h: 0.4, text: content.footnote, fontFace: style.fonts.body, fontSize: 12, color: mix(ink, bgc, 0.45) }))
  return { background: { type: 'color', color: bgc }, elements: els }
}

function coverHairline(content, style) {
  const c = style.colors, bgc = c.bgLight, ink = c.inkDark, acc = c.accent
  const els = []
  els.push(E.rect({ x: 0.4, y: 0.4, w: SLIDE_W - 0.8, h: SLIDE_H - 0.8, fill: null, line: { color: mix(ink, bgc, 0.7), width: 1 } }))
  els.push(E.ellipse({ x: 1.2, y: 2.12, w: 0.22, h: 0.22, fill: acc }))
  if (content.kicker) els.push(E.text({ x: 1.62, y: 2.0, w: 8, h: 0.4, text: String(content.kicker).toUpperCase(), fontFace: style.fonts.body, fontSize: 12, bold: true, color: mix(ink, bgc, 0.2), charSpacing: 4, valign: 'middle' }))
  els.push(E.text({ x: 1.2, y: 2.8, w: 10.5, h: 1.6, text: content.title || '标题', fontFace: style.fonts.title, fontSize: 42, bold: true, color: ink, valign: 'top', shrink: true, lineSpacing: 46 }))
  if (content.subtitle) els.push(E.text({ x: 1.22, y: 4.5, w: 9, h: 0.8, text: content.subtitle, fontFace: style.fonts.body, fontSize: 15, color: mix(ink, bgc, 0.35), lineSpacing: 21 }))
  if (content.footnote) els.push(E.text({ x: 1.2, y: SLIDE_H - 1.1, w: 9, h: 0.4, text: content.footnote, fontFace: style.fonts.body, fontSize: 11, color: mix(ink, bgc, 0.45) }))
  return { background: { type: 'color', color: bgc }, elements: els }
}

const COVER_BY_MOTIF = {
  'chip-bar': coverChip, 'serif-big': coverSerif, 'block': coverBlock,
  'gold-line': coverGold, 'rule-number': coverRule, 'rounded': coverRounded, 'hairline': coverHairline,
}

// ===================== 版式注册 =====================

export const LAYOUTS = [
  {
    id: 'cover', label: '封面', role: 'cover',
    fields: 'title(主标题), subtitle(副标题/一句话价值), kicker(顶部小标签，可选), footnote(单位/作者/日期，可选)',
    sample: { kicker: 'PRODUCT', title: '主标题占位', subtitle: '一句话副标题', footnote: '汇报单位 · 2026' },
    build(content, style, pageNo) {
      return (COVER_BY_MOTIF[style.motif] || coverChip)(content, style)
    },
  },

  {
    id: 'section', label: '章节分隔', role: 'section',
    fields: 'number(章节号如 01，可选), title(章节标题), subtitle(本章导语，可选)',
    sample: { number: '01', title: '章节标题', subtitle: '本章导语占位' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'section')
      const els = [...heroDecor(t, style)]
      if (content.number) els.push(E.text({ x: 1.1, y: 1.9, w: 4, h: 1.6, text: String(content.number), fontFace: style.fonts.title, fontSize: 88, bold: true, color: t.accentText, opacity: 0.9 }))
      els.push(E.text({ x: 1.14, y: content.number ? 3.7 : 2.9, w: 10.5, h: 1.2, text: content.title || '', fontFace: style.fonts.title, fontSize: 38, bold: true, color: t.ink, shrink: true }))
      if (content.subtitle) els.push(E.text({ x: 1.16, y: content.number ? 4.9 : 4.1, w: 9.5, h: 0.8, text: content.subtitle, fontFace: style.fonts.body, fontSize: 16, color: mix(t.ink, t.bg, 0.25), lineSpacing: 22 }))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'toc', label: '目录 / 议程', role: 'content',
    fields: 'title(默认"目录"), items(议程条目字符串数组，3-8 项)',
    sample: { title: '目录', items: ['背景与挑战', '总体方案', '核心能力', '实施路径', '价值与展望'] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { title: content.title || '目录', pageNo })
      const items = (content.items || []).slice(0, 8)
      const twoCol = items.length > 4
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.2, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.7 }
      const perCol = twoCol ? Math.ceil(items.length / 2) : items.length
      const cols = twoCol ? splitCols(2, { x: box.x, w: box.w, gutter: 0.8 }) : [{ x: box.x, w: box.w }]
      const rowH = box.h / perCol
      items.forEach((it, i) => {
        const col = twoCol ? Math.floor(i / perCol) : 0
        const row = twoCol ? i % perCol : i
        const cx = cols[col].x, cw = cols[col].w
        const y = box.y + row * rowH
        els.push(E.text({ x: cx, y: y + rowH / 2 - 0.32, w: 0.7, h: 0.64, text: String(i + 1).padStart(2, '0'), fontFace: style.fonts.title, fontSize: 24, bold: true, color: t.accent, valign: 'middle' }))
        els.push(E.text({ x: cx + 0.8, y, w: cw - 0.9, h: rowH, text: it, fontFace: style.fonts.body, fontSize: 16, color: t.ink, valign: 'middle' }))
        els.push(E.line({ x: cx + 0.8, y: y + rowH - 0.06, w: cw - 0.9, h: 0, lineColor: t.line, lineWidth: 0.75 }))
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'businessOverview', label: '业务全景', role: 'content',
    fields: 'kicker, title, positioning(一句话业务定位), users(目标用户/角色数组 2-5 个), capabilities(3-5 项，每项 {icon, name, desc}), value(底部业务价值一句话，可选)',
    sample: { kicker: '业务全景', title: '系统业务定位', positioning: '围绕核心业务流程，提供统一入口、自动化处理与可追溯交付。', users: ['业务人员', '管理人员', '运维人员'], capabilities: [{ icon: 'users', name: '统一入口', desc: '集中承载用户日常操作' }, { icon: 'workflow', name: '流程协同', desc: '串联关键业务步骤' }, { icon: 'bar-chart', name: '结果沉淀', desc: '形成可复用数据资产' }], value: '让业务从分散处理走向标准化、自动化与可度量。' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.25, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.72 }
      const leftW = 4.25
      els.push(E.roundRect({ x: box.x, y: box.y, w: leftW, h: box.h, radius: style.radius, fill: t.onDark ? mix(t.card, t.accent, 0.1) : mix(t.card, t.accent, 0.04), line: { color: t.line, width: 1 }, shadow: !t.onDark }))
      els.push(E.text({ x: box.x + 0.34, y: box.y + 0.35, w: leftW - 0.68, h: 1.25, text: content.positioning || '', fontFace: style.fonts.title, fontSize: 19, bold: true, color: t.cardInk, lineSpacing: 24, shrink: true }))
      const users = (content.users || []).slice(0, 5)
      users.forEach((u, i) => {
        const y = box.y + 1.85 + i * 0.46
        els.push(E.roundRect({ x: box.x + 0.34, y, w: leftW - 0.68, h: 0.34, radius: 0.17, fill: t.accent, fillAlpha: i === 0 ? 1 : 0.14 }))
        els.push(E.text({ x: box.x + 0.5, y, w: leftW - 1.0, h: 0.34, text: u, fontFace: style.fonts.body, fontSize: 11.5, bold: true, color: i === 0 ? pickInk(t.accent) : t.accent, valign: 'middle', shrink: true }))
      })
      if (content.value) els.push(E.text({ x: box.x + 0.34, y: box.y + box.h - 0.85, w: leftW - 0.68, h: 0.5, text: content.value, fontFace: style.fonts.body, fontSize: 12, italic: true, color: t.muted, lineSpacing: 16, shrink: true }))

      const caps = (content.capabilities || []).slice(0, 5)
      const right = { x: box.x + leftW + 0.42, y: box.y, w: box.w - leftW - 0.42, h: box.h }
      const cells = caps.length <= 3
        ? gridCells(right, caps.length || 1, 1, GUTTER)
        : gridCells(right, caps.length === 4 ? 2 : 3, caps.length === 4 ? 2 : 2, GUTTER)
      const accents = ACCENTS(t, style)
      caps.forEach((c, i) => {
        const cell = cells[i]
        if (!cell) return
        const ac = accents[i % accents.length]
        els.push(E.roundRect({ ...cell, radius: style.radius, fill: t.card, line: { color: mix(t.line, ac, 0.25), width: 1 }, shadow: !t.onDark }))
        els.push(...chipIcon(cell.x + 0.48, cell.y + 0.5, 0.58, { icon: c.icon || 'target', glyph: pickInk(ac), fill: ac, round: style.motif !== 'block' }))
        els.push(E.text({ x: cell.x + 0.88, y: cell.y + 0.28, w: cell.w - 1.08, h: 0.42, text: c.name || '', fontFace: style.fonts.title, fontSize: 13.5, bold: true, color: t.cardInk, valign: 'middle', shrink: true }))
        els.push(E.text({ x: cell.x + 0.28, y: cell.y + 0.9, w: cell.w - 0.56, h: cell.h - 1.08, text: c.desc || '', fontFace: style.fonts.body, fontSize: 11.2, color: mix(t.cardInk, t.card, 0.28), lineSpacing: 15, wrap: true }))
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'userJourney', label: '用户旅程', role: 'content',
    fields: 'kicker, title, persona(用户/角色), goal(该角色目标，可选), stages(3-5 个阶段，每项 {name, action, pain, value, touchpoint(触点/系统能力，可选)})',
    sample: { kicker: '用户旅程', title: '关键角色使用路径', persona: '业务人员', stages: [{ name: '进入', action: '选择业务场景', pain: '入口分散', value: '统一入口' }, { name: '处理', action: '完成核心操作', pain: '手工重复', value: '自动化' }, { name: '复核', action: '查看结果与记录', pain: '追踪困难', value: '可追溯' }] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const stages = (content.stages || []).slice(0, 5)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.24, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.72 }
      const accents = ACCENTS(t, style)
      const sideW = 2.38
      const railX = box.x + sideW + 0.34
      const railW = box.w - sideW - 0.34
      const stageCount = Math.max(stages.length, 1)
      const cols = splitCols(stageCount, { x: railX, w: railW, gutter: 0.18 })
      const personaFill = t.onDark ? mix(t.card, t.accent, 0.16) : mix(t.card, t.accent, 0.06)

      els.push(E.roundRect({ x: box.x, y: box.y, w: sideW, h: box.h, radius: style.radius, fill: personaFill, line: { color: mix(t.line, t.accent, 0.35), width: 1.1 }, shadow: !t.onDark }))
      els.push(E.text({ x: box.x + 0.24, y: box.y + 0.25, w: sideW - 0.48, h: 0.28, text: 'PERSONA', fontFace: style.fonts.body, fontSize: 9.5, bold: true, color: t.accent, charSpacing: 2 }))
      els.push(...chipIcon(box.x + sideW / 2, box.y + 0.95, 0.86, { icon: 'users', glyph: pickInk(t.accent), fill: t.accent, round: style.motif !== 'block' }))
      els.push(E.text({ x: box.x + 0.22, y: box.y + 1.48, w: sideW - 0.44, h: 0.46, text: content.persona || '关键角色', align: 'center', fontFace: style.fonts.title, fontSize: 15.5, bold: true, color: t.ink, shrink: true }))
      els.push(E.rect({ x: box.x + 0.32, y: box.y + 2.1, w: sideW - 0.64, h: 0.06, fill: t.accent }))
      els.push(E.text({ x: box.x + 0.26, y: box.y + 2.34, w: sideW - 0.52, h: 0.86, text: content.goal || '围绕核心任务完成业务处理，并获得可追溯的交付结果。', fontFace: style.fonts.body, fontSize: 10.8, color: t.muted, lineSpacing: 14, shrink: true }))
      els.push(E.roundRect({ x: box.x + 0.24, y: box.y + box.h - 0.72, w: sideW - 0.48, h: 0.42, radius: 0.2, fill: t.accent, fillAlpha: 0.14 }))
      els.push(E.text({ x: box.x + 0.34, y: box.y + box.h - 0.72, w: sideW - 0.68, h: 0.42, text: `${stageCount} 个触点闭环`, align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 10.5, bold: true, color: t.accent, shrink: true }))

      const nodeY = box.y + 0.7
      els.push(E.line({ x: cols[0].x + cols[0].w / 2, y: nodeY, w: railW - cols[0].w, h: 0, lineColor: mix(t.line, t.accent, 0.18), lineWidth: 1.2, dash: 'dash' }))
      stages.forEach((s, i) => {
        const col = cols[i]
        const ac = accents[i % accents.length]
        const cx = col.x + col.w / 2
        els.push(E.ellipse({ x: cx - 0.24, y: nodeY - 0.24, w: 0.48, h: 0.48, fill: ac, line: { color: mix(ac, t.bg, 0.12), width: 1.2 }, shadow: !t.onDark }))
        els.push(E.text({ x: cx - 0.24, y: nodeY - 0.24, w: 0.48, h: 0.48, text: String(i + 1), align: 'center', valign: 'middle', fontFace: style.fonts.title, fontSize: 12.5, bold: true, color: pickInk(ac) }))
        els.push(E.text({ x: col.x, y: nodeY + 0.34, w: col.w, h: 0.35, text: s.name || '', align: 'center', fontFace: style.fonts.title, fontSize: 13.2, bold: true, color: t.ink, shrink: true }))

        const laneTop = box.y + 1.48
        const laneH = 0.86
        const laneGap = 0.18
        const rows = [
          { label: '动作', text: s.action || '', icon: 'activity', fill: t.card, color: t.cardInk },
          { label: '痛点', text: s.pain || '待优化', icon: 'bell', fill: t.onDark ? mix(t.card, 'EF4444', 0.08) : mix(t.card, 'EF4444', 0.035), color: t.cardInk },
          { label: '收益', text: s.value || '效率提升', icon: 'check', fill: t.onDark ? mix(t.card, ac, 0.12) : mix(t.card, ac, 0.055), color: t.cardInk },
        ]
        rows.forEach((row, r) => {
          const y = laneTop + r * (laneH + laneGap)
          els.push(E.roundRect({ x: col.x, y, w: col.w, h: laneH, radius: 0.08, fill: row.fill, line: { color: r === 1 ? mix('EF4444', t.line, 0.25) : mix(ac, t.line, 0.25), width: 0.8 }, shadow: !t.onDark && r === 2 }))
          els.push(E.roundRect({ x: col.x + 0.14, y: y + 0.15, w: 0.62, h: 0.25, radius: 0.12, fill: r === 1 ? 'EF4444' : ac, fillAlpha: r === 0 ? 0.16 : 0.2 }))
          els.push(E.text({ x: col.x + 0.18, y: y + 0.15, w: 0.54, h: 0.25, text: row.label, align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 8.5, bold: true, color: r === 1 ? 'F87171' : ac, shrink: true }))
          els.push(E.text({ x: col.x + 0.18, y: y + 0.43, w: col.w - 0.36, h: 0.34, text: row.text, fontFace: style.fonts.body, fontSize: 10.2, color: row.color, lineSpacing: 13, shrink: true }))
        })

        const touch = s.touchpoint || s.value || '系统支撑'
        els.push(E.roundRect({ x: col.x, y: box.y + box.h - 0.52, w: col.w, h: 0.34, radius: 0.16, fill: ac, fillAlpha: 0.18 }))
        els.push(E.text({ x: col.x + 0.12, y: box.y + box.h - 0.52, w: col.w - 0.24, h: 0.34, text: touch, align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 9.6, bold: true, color: ac, shrink: true }))
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'workflowDiagram', label: '业务流程图', role: 'content',
    fields: 'kicker, title, steps(4-6 个步骤，每项 {icon, name, desc, owner, output(产出，可选)}), note(一句流程价值/闭环说明，可选)',
    sample: { kicker: '流程', title: '端到端业务闭环', steps: [{ icon: 'search', name: '采集', desc: '获取业务输入', owner: '用户' }, { icon: 'settings', name: '处理', desc: '自动完成规则处理', owner: '系统' }, { icon: 'check', name: '交付', desc: '输出可追溯结果', owner: '平台' }], note: '流程从输入到交付形成闭环。' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const steps = (content.steps || []).slice(0, 6)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.35, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - (content.note ? 1.08 : 0.72) }
      const cols = splitCols(Math.max(steps.length, 1), { x: box.x, w: box.w, gutter: 0.14 })
      const accents = ACCENTS(t, style)
      const railY = box.y + 0.58
      const panelY = box.y + 1.18
      const panelH = box.h - 1.18
      els.push(E.roundRect({ x: box.x, y: railY - 0.1, w: box.w, h: 0.2, radius: 0.1, fill: t.line, fillAlpha: t.onDark ? 0.55 : 1 }))
      steps.forEach((s, i) => {
        const col = cols[i]
        const ac = accents[i % accents.length]
        const cx = col.x + col.w / 2
        els.push(E.ellipse({ x: cx - 0.34, y: railY - 0.34, w: 0.68, h: 0.68, fill: ac, line: { color: mix(ac, t.bg, 0.08), width: 1.4 }, shadow: !t.onDark }))
        els.push(E.icon({ x: cx - 0.18, y: railY - 0.18, w: 0.36, h: 0.36, name: s.icon || 'workflow', color: pickInk(ac), strokeWidth: 2.2 }))
        if (i < steps.length - 1) {
          els.push(E.text({ x: col.x + col.w - 0.1, y: railY - 0.22, w: 0.42, h: 0.44, text: '>', align: 'center', valign: 'middle', fontFace: style.fonts.title, fontSize: 16, bold: true, color: mix(t.ink, t.bg, 0.42) }))
        }
        els.push(E.roundRect({ x: col.x, y: panelY, w: col.w, h: panelH, radius: style.radius, fill: t.card, line: { color: mix(t.line, ac, 0.32), width: 1 }, shadow: !t.onDark }))
        els.push(E.rect({ x: col.x, y: panelY, w: col.w, h: 0.09, fill: ac }))
        if (s.owner) {
          els.push(E.roundRect({ x: col.x + 0.16, y: panelY + 0.26, w: col.w - 0.32, h: 0.28, radius: 0.14, fill: ac, fillAlpha: 0.14 }))
          els.push(E.text({ x: col.x + 0.22, y: panelY + 0.26, w: col.w - 0.44, h: 0.28, text: s.owner, align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 9.4, bold: true, color: ac, shrink: true }))
        }
        els.push(E.text({ x: col.x + 0.18, y: panelY + 0.68, w: col.w - 0.36, h: 0.42, text: s.name || '', align: 'center', fontFace: style.fonts.title, fontSize: 13.2, bold: true, color: t.cardInk, shrink: true }))
        els.push(E.text({ x: col.x + 0.18, y: panelY + 1.18, w: col.w - 0.36, h: 0.92, text: s.desc || '', align: 'center', fontFace: style.fonts.body, fontSize: 10.2, color: mix(t.cardInk, t.card, 0.25), lineSpacing: 13, shrink: true }))
        els.push(E.line({ x: col.x + 0.22, y: panelY + panelH - 0.76, w: col.w - 0.44, h: 0, lineColor: mix(t.line, ac, 0.25), lineWidth: 0.6 }))
        els.push(E.text({ x: col.x + 0.2, y: panelY + panelH - 0.62, w: col.w - 0.4, h: 0.36, text: s.output || s.name || '阶段产出', align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 9.6, bold: true, color: ac, shrink: true }))
      })
      if (content.note) els.push(E.text({ x: box.x, y: SLIDE_H - 0.92, w: box.w, h: 0.42, text: content.note, fontFace: style.fonts.body, fontSize: 12, italic: true, color: t.muted }))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'valueMatrix', label: '价值矩阵', role: 'content',
    fields: 'kicker, title, items(3-6 项，每项 {value(价值点), forWhom(面向对象), proof(代码/功能证据或实现方式), impact(影响，可定性)}), note(可选)',
    sample: { kicker: '价值', title: '业务价值矩阵', items: [{ value: '提效', forWhom: '业务人员', proof: '自动生成交付材料', impact: '减少重复编写' }, { value: '标准化', forWhom: '项目团队', proof: '统一模板与导出格式', impact: '降低交付偏差' }, { value: '可追溯', forWhom: '管理人员', proof: '保留上下文与结果', impact: '便于复核' }], note: '' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const items = (content.items || []).slice(0, 6)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.28, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - (content.note ? 1.0 : 0.65) }
      const cols = items.length <= 3 ? items.length || 1 : 3
      const rows = Math.ceil(items.length / cols)
      const cells = gridCells(box, cols, rows, 0.24)
      const accents = ACCENTS(t, style)
      items.forEach((it, i) => {
        const cell = cells[i]
        const ac = accents[i % accents.length]
        els.push(E.roundRect({ ...cell, radius: style.radius, fill: t.card, line: { color: mix(t.line, ac, 0.2), width: 1 }, shadow: !t.onDark }))
        els.push(E.rect({ x: cell.x, y: cell.y, w: cell.w, h: 0.1, fill: ac }))
        els.push(E.text({ x: cell.x + 0.22, y: cell.y + 0.28, w: cell.w - 0.44, h: 0.46, text: it.value || '', fontFace: style.fonts.title, fontSize: 15.5, bold: true, color: t.cardInk, shrink: true }))
        if (it.forWhom) els.push(E.text({ x: cell.x + 0.22, y: cell.y + 0.78, w: cell.w - 0.44, h: 0.28, text: it.forWhom, fontFace: style.fonts.body, fontSize: 10.5, bold: true, color: ac, shrink: true }))
        els.push(E.text({ x: cell.x + 0.22, y: cell.y + 1.18, w: cell.w - 0.44, h: 0.72, text: it.proof || '', fontFace: style.fonts.body, fontSize: 10.8, color: mix(t.cardInk, t.card, 0.22), lineSpacing: 14, shrink: true }))
        if (it.impact) {
          els.push(E.roundRect({ x: cell.x + 0.22, y: cell.y + cell.h - 0.55, w: cell.w - 0.44, h: 0.32, radius: 0.16, fill: ac, fillAlpha: 0.13 }))
          els.push(E.text({ x: cell.x + 0.32, y: cell.y + cell.h - 0.55, w: cell.w - 0.64, h: 0.32, text: it.impact, align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 10, bold: true, color: ac, shrink: true }))
        }
      })
      if (content.note) els.push(E.text({ x: box.x, y: SLIDE_H - 0.9, w: box.w, h: 0.36, text: content.note, fontFace: style.fonts.body, fontSize: 11.5, italic: true, color: t.muted }))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'riskMap', label: '风险控制', role: 'content',
    fields: 'kicker, title, items(3-6 项，每项 {risk, control, level(高/中/低 或 high/medium/low)}), note(可选)',
    sample: { kicker: '保障', title: '风险与控制措施', items: [{ risk: '业务规则不完整', control: '依赖用户补充需求文档与截图', level: '中' }, { risk: '数据安全要求', control: '通过权限和本地配置控制访问', level: '高' }, { risk: '生成内容偏差', control: '保留人工编辑与重生成入口', level: '中' }], note: '' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const items = (content.items || []).slice(0, 6)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.26, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - (content.note ? 1.02 : 0.65) }
      const rowH = box.h / Math.max(items.length + 1, 2)
      const cols = [2.05, 4.45, box.w - 2.05 - 4.45]
      const headFill = t.accent
      els.push(E.roundRect({ x: box.x, y: box.y, w: box.w, h: rowH, radius: style.radius, fill: headFill }))
      ;['等级', '风险点', '控制措施'].forEach((h, i) => {
        const x = box.x + cols.slice(0, i).reduce((a, b) => a + b, 0)
        els.push(E.text({ x: x + 0.16, y: box.y, w: cols[i] - 0.24, h: rowH, text: h, valign: 'middle', fontFace: style.fonts.title, fontSize: 12.5, bold: true, color: pickInk(headFill) }))
      })
      items.forEach((it, r) => {
        const y = box.y + rowH * (r + 1)
        const level = String(it.level || '中').toLowerCase()
        const ac = /高|high/.test(level) ? 'EF4444' : /低|low/.test(level) ? '22C55E' : t.accent
        els.push(E.rect({ x: box.x, y, w: box.w, h: rowH, fill: r % 2 ? mix(t.card, t.accent, 0.04) : t.card, fillAlpha: t.onDark ? 0.7 : 1 }))
        els.push(E.roundRect({ x: box.x + 0.18, y: y + rowH / 2 - 0.16, w: 1.18, h: 0.32, radius: 0.16, fill: ac, fillAlpha: 0.16 }))
        els.push(E.text({ x: box.x + 0.18, y: y + rowH / 2 - 0.16, w: 1.18, h: 0.32, text: it.level || '中', align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 10.5, bold: true, color: ac }))
        els.push(E.text({ x: box.x + cols[0] + 0.16, y, w: cols[1] - 0.24, h: rowH, text: it.risk || '', valign: 'middle', fontFace: style.fonts.body, fontSize: 11.5, bold: true, color: t.cardInk, shrink: true }))
        els.push(E.text({ x: box.x + cols[0] + cols[1] + 0.16, y, w: cols[2] - 0.24, h: rowH, text: it.control || '', valign: 'middle', fontFace: style.fonts.body, fontSize: 11.2, color: mix(t.cardInk, t.card, 0.22), shrink: true }))
        els.push(E.line({ x: box.x, y: y + rowH, w: box.w, h: 0, lineColor: t.line, lineWidth: 0.5 }))
      })
      if (content.note) els.push(E.text({ x: box.x, y: SLIDE_H - 0.9, w: box.w, h: 0.36, text: content.note, fontFace: style.fonts.body, fontSize: 11.5, italic: true, color: t.muted }))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'bullets', label: '要点列表', role: 'content',
    fields: 'kicker(小标签), title(标题), bullets(要点字符串数组，3-6 条，每条一句话), note(底部补充，可选)',
    sample: { kicker: '概述', title: '总体定位', bullets: ['要点一占位描述', '要点二占位描述', '要点三占位描述'], note: '' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const items = (content.bullets || []).slice(0, 6)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.25, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - (content.note ? 1.1 : 0.7) }
      const rowH = box.h / Math.max(items.length, 1)
      items.forEach((it, i) => {
        const y = box.y + i * rowH
        els.push(E.rect({ x: box.x, y: y + rowH / 2 - 0.09, w: 0.18, h: 0.18, fill: t.accent }))
        els.push(E.text({ x: box.x + 0.42, y, w: box.w - 0.5, h: rowH, text: it, fontFace: style.fonts.body, fontSize: 15, color: t.ink, valign: 'middle', lineSpacing: 19 }))
      })
      if (content.note) els.push(E.text({ x: box.x, y: SLIDE_H - 0.92, w: box.w, h: 0.42, text: content.note, fontFace: style.fonts.body, fontSize: 11.5, italic: true, color: t.muted }))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'iconCards', label: '图标卡网格', role: 'content',
    fields: 'kicker, title, cards(2-4 张，每张 {icon(英文图标名如 database/shield/zap/cloud/code/users/lock/rocket), title, desc})',
    sample: { kicker: '亮点', title: '核心亮点', cards: [{ icon: 'zap', title: '卡片一', desc: '描述占位文字内容' }, { icon: 'shield', title: '卡片二', desc: '描述占位文字内容' }, { icon: 'database', title: '卡片三', desc: '描述占位文字内容' }, { icon: 'users', title: '卡片四', desc: '描述占位文字内容' }] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const cards = (content.cards || []).slice(0, 4)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.25, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.7 }
      const n = cards.length
      const cols = n <= 2 ? n : 2
      const rows = Math.ceil(n / cols)
      const cells = gridCells(box, cols, rows, GUTTER)
      const accents = ACCENTS(t, style)
      cards.forEach((c, i) => els.push(...featureCard(t, style, cells[i], { ...c, accent: accents[i % accents.length] })))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'featureGrid', label: '亮点网格(3/5)', role: 'content',
    fields: 'kicker, title, cards(3 或 5 张，每张 {icon, title, desc})',
    sample: { kicker: '能力', title: '五大核心能力', cards: [{ icon: 'cpu', title: '能力一', desc: '描述占位' }, { icon: 'database', title: '能力二', desc: '描述占位' }, { icon: 'shield', title: '能力三', desc: '描述占位' }, { icon: 'workflow', title: '能力四', desc: '描述占位' }, { icon: 'gauge', title: '能力五', desc: '描述占位' }] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const cards = (content.cards || []).slice(0, 6)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.25, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.7 }
      const n = cards.length
      const cols = n <= 3 ? n : 3
      const rows = Math.ceil(n / cols)
      const cells = gridCells(box, cols, rows, GUTTER)
      const accents = ACCENTS(t, style)
      cards.forEach((c, i) => els.push(...featureCard(t, style, cells[i], { ...c, accent: accents[i % accents.length] })))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'capabilityGrid', label: '能力地图', role: 'content',
    fields: 'kicker, title, items(4-10 项，每项 {icon, label} 短标签)',
    sample: { kicker: '能力地图', title: '功能全景', items: [{ icon: 'users', label: '用户管理' }, { icon: 'lock', label: '权限控制' }, { icon: 'database', label: '数据存储' }, { icon: 'bar-chart', label: '统计分析' }, { icon: 'bell', label: '消息通知' }, { icon: 'workflow', label: '流程引擎' }] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const items = (content.items || []).slice(0, 10)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.25, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.7 }
      const cols = items.length <= 4 ? items.length : (items.length <= 6 ? 3 : Math.ceil(items.length / 2))
      const rows = Math.ceil(items.length / cols)
      const cells = gridCells(box, cols, rows, 0.28)
      const accents = ACCENTS(t, style)
      items.forEach((it, i) => {
        const cell = cells[i]; const ac = accents[i % accents.length]
        const lightBorder = t.onDark ? null : { color: mix(t.card, t.ink, 0.1), width: 1 }
        els.push(E.roundRect({ ...cell, radius: style.radius, fill: t.card, line: lightBorder, shadow: !t.onDark }))
        const chipD = Math.min(0.7, cell.h - 0.5)
        els.push(...chipIcon(cell.x + 0.32 + chipD / 2, cell.y + cell.h / 2, chipD, { icon: it.icon, glyph: pickInk(ac), fill: ac, round: style.motif !== 'block' }))
        els.push(E.text({ x: cell.x + 0.4 + chipD, y: cell.y, w: cell.w - 0.5 - chipD, h: cell.h, text: it.label || '', fontFace: style.fonts.body, fontSize: 13, bold: true, color: t.cardInk, valign: 'middle', shrink: true }))
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'timeline', label: '流程 / 时间线', role: 'content',
    fields: 'kicker, title, steps(3-6 步，每步 {title, desc})',
    sample: { kicker: '路径', title: '实施步骤', steps: [{ title: '阶段一', desc: '描述占位' }, { title: '阶段二', desc: '描述占位' }, { title: '阶段三', desc: '描述占位' }, { title: '阶段四', desc: '描述占位' }] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const steps = (content.steps || []).slice(0, 6)
      const n = steps.length || 1
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.4, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 1.0 }
      const lineY = box.y + 0.7
      els.push(E.line({ x: box.x + 0.3, y: lineY, w: box.w - 0.6, h: 0, lineColor: t.line, lineWidth: 1.5 }))
      const slot = box.w / n
      const accents = ACCENTS(t, style)
      steps.forEach((s, i) => {
        const cx = box.x + slot * i + slot / 2
        const ac = accents[i % accents.length]
        els.push(...numberBadge(cx, lineY, 0.6, ac, pickInk(ac), i + 1, style.fonts.title))
        els.push(E.text({ x: cx - slot / 2 + 0.12, y: lineY + 0.5, w: slot - 0.24, h: 0.4, text: s.title || '', align: 'center', fontFace: style.fonts.title, fontSize: 14, bold: true, color: t.ink, shrink: true }))
        els.push(E.text({ x: cx - slot / 2 + 0.12, y: lineY + 0.92, w: slot - 0.24, h: box.h - 1.5, text: s.desc || '', align: 'center', fontFace: style.fonts.body, fontSize: 10.5, color: t.muted, lineSpacing: 13 }))
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'bigNumbers', label: '关键数据', role: 'content',
    fields: 'kicker, title, stats(2-4 个，每个 {value(数字/短文), unit(单位，可选), label(说明)})。无真实数据时不要编造',
    sample: { kicker: '成效', title: '关键指标', stats: [{ value: '99.9', unit: '%', label: '可用性' }, { value: '< 200', unit: 'ms', label: '平均响应' }, { value: '10', unit: 'x', label: '效率提升' }] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const stats = (content.stats || []).slice(0, 4)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.35, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.9 }
      const cells = gridCells(box, stats.length || 1, 1, GUTTER)
      const accents = ACCENTS(t, style)
      stats.forEach((s, i) => {
        const cell = cells[i]; const ac = accents[i % accents.length]
        const lightBorder = t.onDark ? null : { color: mix(t.card, t.ink, 0.1), width: 1 }
        els.push(E.roundRect({ ...cell, radius: style.radius, fill: t.card, line: lightBorder, shadow: !t.onDark }))
        els.push(E.rect({ x: cell.x + cell.w / 2 - 0.3, y: cell.y + cell.h - 0.42, w: 0.6, h: 0.06, fill: ac }))
        els.push(E.text({
          x: cell.x + 0.1, y: cell.y + cell.h * 0.2, w: cell.w - 0.2, h: cell.h * 0.42,
          align: 'center', valign: 'middle', fontFace: style.fonts.title, color: ensureContrast(ac, t.card, 3), shrink: true,
          paragraphs: [{ text: String(s.value ?? ''), fontSize: 48, bold: true }, ...(s.unit ? [{ text: ' ' + s.unit, fontSize: 22, bold: true }] : [])],
        }))
        els.push(E.text({ x: cell.x + 0.1, y: cell.y + cell.h * 0.66, w: cell.w - 0.2, h: cell.h * 0.28, align: 'center', text: s.label || '', fontFace: style.fonts.body, fontSize: 13, color: t.cardInk }))
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'compareColumns', label: '双栏对照', role: 'content',
    fields: 'kicker, title, left{title, points[]}, right{title, points[]}',
    sample: { kicker: '对照', title: '方案对比', left: { title: '传统方式', points: ['痛点一', '痛点二', '痛点三'] }, right: { title: '本方案', points: ['优势一', '优势二', '优势三'] } },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.25, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.7 }
      const cols = splitCols(2, { x: box.x, w: box.w, gutter: 0.5 })
      const panels = [{ d: content.left || {}, ac: mix(t.muted, t.bg, 0.2), head: t.muted }, { d: content.right || {}, ac: t.accent, head: t.accent }]
      panels.forEach((p, ci) => {
        const cx = cols[ci].x, cw = cols[ci].w
        const lightBorder = t.onDark ? null : { color: mix(t.card, t.ink, 0.1), width: 1 }
        els.push(E.roundRect({ x: cx, y: box.y, w: cw, h: box.h, radius: style.radius, fill: t.card, line: lightBorder, shadow: !t.onDark }))
        els.push(E.rect({ x: cx, y: box.y, w: cw, h: 0.62, fill: p.head }))
        els.push(E.text({ x: cx + 0.2, y: box.y, w: cw - 0.4, h: 0.62, text: p.d.title || '', valign: 'middle', fontFace: style.fonts.title, fontSize: 16, bold: true, color: pickInk(p.head) }))
        const pts = (p.d.points || []).slice(0, 6)
        const innerY = box.y + 0.85
        const rowH = (box.h - 1.05) / Math.max(pts.length, 1)
        pts.forEach((pt, i) => {
          const y = innerY + i * rowH
          els.push(E.ellipse({ x: cx + 0.28, y: y + rowH / 2 - 0.06, w: 0.12, h: 0.12, fill: p.ac }))
          els.push(E.text({ x: cx + 0.52, y, w: cw - 0.74, h: rowH, text: pt, fontFace: style.fonts.body, fontSize: 12.5, color: t.cardInk, valign: 'middle', lineSpacing: 15 }))
        })
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'compareTable', label: '对比表', role: 'content',
    fields: 'kicker, title, headers(列名数组), rows(每行单元格字符串数组，与 headers 对齐)',
    sample: { kicker: '对比', title: '能力对比', headers: ['维度', '传统方案', '本方案'], rows: [['部署', '手动', '一键'], ['扩展', '困难', '弹性'], ['成本', '高', '低']] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const headers = content.headers || []
      const rows = (content.rows || []).slice(0, 8)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.25, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.7 }
      const ncol = headers.length || (rows[0] ? rows[0].length : 1)
      const colW = box.w / ncol
      const headH = 0.56
      const bodyRowH = (box.h - headH) / Math.max(rows.length, 1)
      els.push(E.rect({ x: box.x, y: box.y, w: box.w, h: headH, fill: t.accent }))
      headers.forEach((h, c) => els.push(E.text({ x: box.x + c * colW + 0.16, y: box.y, w: colW - 0.24, h: headH, text: h, valign: 'middle', fontFace: style.fonts.title, fontSize: 12.5, bold: true, color: pickInk(t.accent) })))
      rows.forEach((row, r) => {
        const y = box.y + headH + r * bodyRowH
        if (r % 2 === 1) els.push(E.rect({ x: box.x, y, w: box.w, h: bodyRowH, fill: mix(t.card, t.bg, 0.0), fillAlpha: t.onDark ? 0.5 : 1 }))
        else els.push(E.rect({ x: box.x, y, w: box.w, h: bodyRowH, fill: mix(t.card, t.accent, 0.04) }))
        row.slice(0, ncol).forEach((cell, c) => els.push(E.text({ x: box.x + c * colW + 0.16, y, w: colW - 0.24, h: bodyRowH, text: String(cell), valign: 'middle', fontFace: style.fonts.body, fontSize: 11.5, bold: c === 0, color: t.cardInk })))
        els.push(E.line({ x: box.x, y: y + bodyRowH, w: box.w, h: 0, lineColor: t.line, lineWidth: 0.5 }))
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'quote', label: '引用 / 金句', role: 'section',
    fields: 'quote(金句正文，一句话), author(出处/作者，可选)',
    sample: { quote: '把复杂留给系统，把简单交给用户。', author: '产品理念' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'section')
      const els = [...heroDecor(t, style)]
      els.push(E.text({ x: 1.0, y: 1.4, w: 2, h: 1.6, text: '“', fontFace: style.fonts.title, fontSize: 120, bold: true, color: t.accentText, opacity: 0.55 }))
      els.push(E.text({ x: 1.3, y: 2.7, w: 10.7, h: 2.6, text: content.quote || '', fontFace: style.fonts.title, fontSize: 30, bold: true, color: t.ink, valign: 'middle', lineSpacing: 40, shrink: true }))
      if (content.author) {
        els.push(E.rect({ x: 1.35, y: 5.5, w: 0.5, h: 0.05, fill: t.accent }))
        els.push(E.text({ x: 2.0, y: 5.3, w: 8, h: 0.4, text: content.author, fontFace: style.fonts.body, fontSize: 14, color: t.muted }))
      }
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'cycle', label: '闭环 / 飞轮', role: 'content',
    fields: 'kicker, title, nodes(3-6 个环形节点字符串数组), center(中心词，可选)',
    sample: { kicker: '闭环', title: '增长飞轮', nodes: ['采集', '分析', '决策', '执行', '反馈'], center: '数据驱动' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const nodes = (content.nodes || []).slice(0, 6)
      const cx = SLIDE_W / 2, cy = HEADER_BOTTOM + (SLIDE_H - HEADER_BOTTOM) / 2 + 0.05
      const R = 1.95
      els.push(E.ellipse({ x: cx - R - 0.05, y: cy - R - 0.05, w: 2 * R + 0.1, h: 2 * R + 0.1, fill: null, line: { color: t.line, width: 1, dash: 'dash' } }))
      if (content.center) {
        const cd = 1.7
        els.push(E.ellipse({ x: cx - cd / 2, y: cy - cd / 2, w: cd, h: cd, fill: t.accent, fillAlpha: 0.14 }))
        els.push(E.text({ x: cx - cd / 2, y: cy - cd / 2, w: cd, h: cd, text: content.center, align: 'center', valign: 'middle', fontFace: style.fonts.title, fontSize: 16, bold: true, color: t.accent, shrink: true }))
      }
      const accents = ACCENTS(t, style)
      const nd = 1.35
      nodes.forEach((nx, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI / nodes.length)
        const px = cx + R * Math.cos(ang), py = cy + R * Math.sin(ang)
        const ac = accents[i % accents.length]
        els.push(E.ellipse({ x: px - nd / 2, y: py - nd / 2, w: nd, h: nd, fill: t.card, line: { color: ac, width: 1.5 }, shadow: !t.onDark }))
        els.push(E.text({ x: px - nd / 2, y: py - nd / 2, w: nd, h: nd, text: nx, align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 12, bold: true, color: t.cardInk, shrink: true }))
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'textMedia', label: '图文 / 左文右图', role: 'content',
    fields: 'kicker, title, body(一段正文，3-5 行), bullets(可选要点数组), mediaIcon(右侧占位图标名，可选), caption(图注，可选)',
    sample: { kicker: '详解', title: '功能详解', body: '这里是一段功能说明的占位正文，描述模块职责与关键流程。', bullets: ['要点一', '要点二', '要点三'], mediaIcon: 'monitor', caption: '界面示意' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.25, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.7 }
      const leftW = box.w * 0.5 - 0.25
      const rightX = box.x + box.w * 0.5 + 0.25, rightW = box.w * 0.5 - 0.25
      if (content.body) els.push(E.text({ x: box.x, y: box.y, w: leftW, h: 1.7, text: content.body, fontFace: style.fonts.body, fontSize: 14, color: t.ink, lineSpacing: 20, valign: 'top' }))
      const bullets = (content.bullets || []).slice(0, 5)
      const by = box.y + (content.body ? 1.85 : 0.1)
      const rowH = Math.min(0.5, (box.y + box.h - by) / Math.max(bullets.length, 1))
      bullets.forEach((b, i) => {
        const y = by + i * rowH
        els.push(E.rect({ x: box.x, y: y + rowH / 2 - 0.08, w: 0.16, h: 0.16, fill: t.accent }))
        els.push(E.text({ x: box.x + 0.38, y, w: leftW - 0.42, h: rowH, text: b, fontFace: style.fonts.body, fontSize: 13, color: t.ink, valign: 'middle' }))
      })
      // 右侧媒体：有真实图片则用图片框，否则占位
      const mediaBox = { x: rightX, y: box.y, w: rightW, h: box.h - 0.4 }
      if (content.mediaSrc) {
        els.push(E.image({ x: mediaBox.x, y: mediaBox.y, w: mediaBox.w, h: mediaBox.h, src: content.mediaSrc, sizing: 'cover', radius: style.radius, frame: true, frameColor: t.onDark ? mix(t.bg, t.ink, 0.3) : mix(t.card, t.ink, 0.2) }))
      } else {
        els.push(...mediaPlaceholder(t, style, mediaBox, content.mediaIcon || 'monitor'))
      }
      els.push(E.text({ x: rightX, y: box.y + box.h - 0.35, w: rightW, h: 0.3, text: content.caption || '示意图', align: 'center', fontFace: style.fonts.body, fontSize: 10.5, italic: true, color: t.muted }))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'barChart', label: '柱状图', role: 'content',
    fields: 'kicker, title, cats(类别字符串数组 3-6 个), series(1-2 组，每组 {name, values(与 cats 等长的数字)}), note(一句洞察，可选)。尽量用上下文里的真实数字（如语言分布、各模块文件数）',
    sample: { kicker: '数据', title: '模块规模对比', cats: ['前端', '服务', '数据', '工具'], series: [{ name: '文件数', values: [42, 35, 18, 12] }], note: '' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const box = contentZone(!!content.note)
      els.push(E.chart({ x: box.x, y: box.y, w: box.w, h: box.h, chartType: 'bar', cats: content.cats || [], series: content.series || [], colors: chartPalette(t, style), legend: (content.series || []).length > 1, axisColor: t.muted, gridColor: t.line, valueColor: t.muted, fontFace: style.fonts.body, bgColor: t.bg }))
      if (content.note) els.push(E.text({ x: box.x, y: SLIDE_H - 0.92, w: box.w, h: 0.42, text: content.note, fontFace: style.fonts.body, fontSize: 12, italic: true, color: t.muted }))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'lineTrend', label: '趋势折线图', role: 'content',
    fields: 'kicker, title, cats(时间/阶段字符串数组), series(1-2 组，每组 {name, values}), note(可选)。无真实趋势数据时不要编造',
    sample: { kicker: '趋势', title: '增长趋势', cats: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: '指标', values: [20, 38, 55, 80] }], note: '' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const box = contentZone(!!content.note)
      els.push(E.chart({ x: box.x, y: box.y, w: box.w, h: box.h, chartType: 'area', cats: content.cats || [], series: content.series || [], colors: chartPalette(t, style), legend: (content.series || []).length > 1, axisColor: t.muted, gridColor: t.line, valueColor: t.muted, fontFace: style.fonts.body, bgColor: t.bg }))
      if (content.note) els.push(E.text({ x: box.x, y: SLIDE_H - 0.92, w: box.w, h: 0.42, text: content.note, fontFace: style.fonts.body, fontSize: 12, italic: true, color: t.muted }))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'proportion', label: '占比环形图', role: 'content',
    fields: 'kicker, title, cats(分类名数组), values(与 cats 等长的数字), note(可选)。可用代码语言分布等真实占比',
    sample: { kicker: '构成', title: '技术栈构成', cats: ['后端', '前端', '数据', '配置'], values: [45, 30, 15, 10], note: '' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const box = contentZone(!!content.note)
      els.push(E.chart({ x: box.x, y: box.y, w: box.w, h: box.h, chartType: 'doughnut', cats: content.cats || [], series: [{ name: '', values: content.values || [] }], colors: chartPalette(t, style), legend: true, showValue: true, axisColor: t.muted, gridColor: t.line, valueColor: t.cardInk, fontFace: style.fonts.body, bgColor: t.bg }))
      if (content.note) els.push(E.text({ x: box.x, y: SLIDE_H - 0.92, w: box.w, h: 0.42, text: content.note, fontFace: style.fonts.body, fontSize: 12, italic: true, color: t.muted }))
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'progressBars', label: '能力评分条', role: 'content',
    fields: 'kicker, title, items(3-6 项，每项 {label, value(0-100 的数字)})',
    sample: { kicker: '评估', title: '能力成熟度', items: [{ label: '自动化', value: 85 }, { label: '可观测性', value: 70 }, { label: '安全合规', value: 92 }, { label: '弹性扩展', value: 60 }] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const items = (content.items || []).slice(0, 6)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.3, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.8 }
      const rowH = box.h / Math.max(items.length, 1)
      const labW = 2.4, trackX = box.x + labW, trackW = box.w - labW - 0.8
      const accents = ACCENTS(t, style)
      items.forEach((it, i) => {
        const cy = box.y + i * rowH + rowH / 2
        const ac = accents[i % accents.length]
        const v = clamp(Number(it.value) || 0, 0, 100)
        els.push(E.text({ x: box.x, y: cy - 0.24, w: labW - 0.2, h: 0.48, text: it.label || '', valign: 'middle', fontFace: style.fonts.body, fontSize: 13.5, bold: true, color: t.ink, shrink: true }))
        els.push(E.roundRect({ x: trackX, y: cy - 0.12, w: trackW, h: 0.24, radius: 0.12, fill: t.line, fillAlpha: t.onDark ? 0.5 : 1 }))
        els.push(E.roundRect({ x: trackX, y: cy - 0.12, w: Math.max(0.24, trackW * v / 100), h: 0.24, radius: 0.12, fill: ac }))
        els.push(E.text({ x: trackX + trackW + 0.12, y: cy - 0.24, w: 0.66, h: 0.48, text: v + '%', valign: 'middle', fontFace: style.fonts.title, fontSize: 14, bold: true, color: ensureContrast(ac, t.bg, 3) }))
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'architecture', label: '架构分层图', role: 'content',
    fields: 'kicker, title, layers(2-5 层，从上到下，每层 {name(层名), items(模块名字符串数组 2-5 个)})。常见分层：接入层/应用层/服务层/数据层/基础设施',
    sample: { kicker: '架构', title: '系统总体架构', layers: [{ name: '接入层', items: ['Web', '移动端', 'API 网关'] }, { name: '服务层', items: ['用户服务', '订单服务', '支付服务'] }, { name: '数据层', items: ['MySQL', 'Redis', '对象存储'] }] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const layers = (content.layers || []).slice(0, 5)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.3, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.7 }
      const gap = 0.2
      const bandH = (box.h - gap * Math.max(layers.length - 1, 0)) / Math.max(layers.length, 1)
      const accents = ACCENTS(t, style)
      const labW = 1.8
      layers.forEach((L, i) => {
        const y = box.y + i * (bandH + gap)
        const ac = accents[i % accents.length]
        els.push(E.roundRect({ x: box.x, y, w: box.w, h: bandH, radius: style.radius, fill: t.onDark ? mix(t.card, ac, 0.14) : mix('FFFFFF', ac, 0.07), line: t.onDark ? null : { color: mix('FFFFFF', t.ink, 0.1), width: 1 } }))
        els.push(E.roundRect({ x: box.x, y, w: labW, h: bandH, radius: style.radius, fill: ac }))
        els.push(E.text({ x: box.x, y, w: labW, h: bandH, text: L.name || '', align: 'center', valign: 'middle', fontFace: style.fonts.title, fontSize: 13, bold: true, color: pickInk(ac), shrink: true }))
        const items = (L.items || []).slice(0, 5)
        const ix = box.x + labW + 0.28, iw = box.w - labW - 0.56
        const cw = (iw - 0.2 * Math.max(items.length - 1, 0)) / Math.max(items.length, 1)
        items.forEach((it, k) => {
          const cx = ix + k * (cw + 0.2)
          els.push(E.roundRect({ x: cx, y: y + bandH * 0.2, w: cw, h: bandH * 0.6, radius: 0.06, fill: t.onDark ? mix(t.bg, 'FFFFFF', 0.08) : 'FFFFFF', line: { color: ac, width: 1 } }))
          els.push(E.text({ x: cx, y: y + bandH * 0.2, w: cw, h: bandH * 0.6, text: it, align: 'center', valign: 'middle', fontFace: style.fonts.body, fontSize: 11, color: t.onDark ? t.ink : t.cardInk, shrink: true }))
        })
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'imageShowcase', label: '大图展示', role: 'content',
    fields: 'kicker, title, bullets(右侧 2-4 条要点), caption(图注，可选)。配图由系统注入',
    sample: { kicker: '界面', title: '核心界面', bullets: ['要点一占位', '要点二占位', '要点三占位'], caption: '系统主界面' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.25, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.55 }
      const imgW = box.w * 0.6
      const imgBox = { x: box.x, y: box.y, w: imgW, h: box.h - 0.32 }
      if (content.imageSrc) els.push(E.image({ x: imgBox.x, y: imgBox.y, w: imgBox.w, h: imgBox.h, src: content.imageSrc, sizing: 'cover', radius: style.radius, frame: true, frameColor: t.onDark ? mix(t.bg, t.ink, 0.3) : mix(t.card, t.ink, 0.2) }))
      else els.push(...mediaPlaceholder(t, style, imgBox, 'monitor'))
      els.push(E.text({ x: imgBox.x, y: box.y + box.h - 0.28, w: imgW, h: 0.28, text: content.caption || '示意图', align: 'center', fontFace: style.fonts.body, fontSize: 10.5, italic: true, color: t.muted }))
      const rx = box.x + imgW + 0.45, rw = box.w - imgW - 0.45
      const bullets = (content.bullets || []).slice(0, 4)
      const rowH = box.h / Math.max(bullets.length, 1)
      bullets.forEach((b, i) => {
        const y = box.y + i * rowH
        els.push(E.rect({ x: rx, y: y + rowH / 2 - 0.09, w: 0.18, h: 0.18, fill: t.accent }))
        els.push(E.text({ x: rx + 0.4, y, w: rw - 0.44, h: rowH, text: b, fontFace: style.fonts.body, fontSize: 14, color: t.ink, valign: 'middle', lineSpacing: 19 }))
      })
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'imageGrid', label: '图集', role: 'content',
    fields: 'kicker, title, captions(2-4 条图注)。配图由系统注入',
    sample: { kicker: '界面', title: '功能一览', captions: ['列表页', '详情页', '统计页', '设置页'] },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'content')
      const els = headerEls(t, style, { kicker: content.kicker, title: content.title || '', pageNo })
      const caps = content.captions || []
      const srcs = content.imageSrcs || []
      const n = Math.max(Math.min(Math.max(srcs.length, caps.length, 2), 4), 1)
      const box = { x: MARGIN, y: HEADER_BOTTOM + 0.25, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - HEADER_BOTTOM - 0.6 }
      const cols = n <= 2 ? n : 2
      const rows = Math.ceil(n / cols)
      const cells = gridCells(box, cols, rows, GUTTER)
      for (let i = 0; i < n; i++) {
        const cell = cells[i]
        const imgBox = { x: cell.x, y: cell.y, w: cell.w, h: cell.h - 0.3 }
        if (srcs[i]) els.push(E.image({ x: imgBox.x, y: imgBox.y, w: imgBox.w, h: imgBox.h, src: srcs[i], sizing: 'cover', radius: style.radius, frame: true, frameColor: t.onDark ? mix(t.bg, t.ink, 0.3) : mix(t.card, t.ink, 0.2) }))
        else els.push(...mediaPlaceholder(t, style, imgBox, 'monitor'))
        els.push(E.text({ x: cell.x, y: cell.y + cell.h - 0.28, w: cell.w, h: 0.26, text: caps[i] || '示意图', align: 'center', fontFace: style.fonts.body, fontSize: 10.5, italic: true, color: t.muted }))
      }
      return { background: bg(t), elements: els }
    },
  },

  {
    id: 'closing', label: '封底', role: 'closing',
    fields: 'title(如"谢谢观看"), subtitle(可选), contact(联系方式/单位，可选)',
    sample: { title: '谢谢观看', subtitle: '欢迎交流与指正', contact: '联系方式占位' },
    build(content, style, pageNo) {
      const t = slideTheme(style, 'closing')
      const els = [...heroDecor(t, style)]
      els.push(E.text({ x: 1.12, y: 2.7, w: 11, h: 1.6, text: content.title || '谢谢观看', fontFace: style.fonts.title, fontSize: 52, bold: true, color: t.ink, shrink: true }))
      if (content.subtitle) els.push(E.text({ x: 1.16, y: 4.4, w: 10, h: 0.7, text: content.subtitle, fontFace: style.fonts.body, fontSize: 18, color: mix(t.ink, t.bg, 0.25) }))
      if (content.contact) els.push(E.text({ x: 1.16, y: SLIDE_H - 0.95, w: 10, h: 0.4, text: content.contact, fontFace: style.fonts.body, fontSize: 12, color: t.muted }))
      return { background: bg(t), elements: els }
    },
  },
]

export const LAYOUT_MAP = Object.fromEntries(LAYOUTS.map(l => [l.id, l]))

/** 用某版式构建一页完整 slide 对象 */
export function buildSlide(layoutId, content, style, pageNo) {
  const layout = LAYOUT_MAP[layoutId] || LAYOUT_MAP.bullets
  let out
  try {
    out = layout.build(content || {}, style, pageNo)
  } catch (e) {
    out = LAYOUT_MAP.bullets.build({ title: content?.title || '内容', bullets: ['（该页渲染失败，请重试或编辑）'] }, style, pageNo)
  }
  const polish = visualPolish(layout.id, layout.role, style, pageNo)
  return {
    id: `sld_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e5).toString(36)}`,
    role: layout.role,
    layout: layoutId,
    title: content?.title || layout.label,
    content: content || {},
    background: out.background,
    elements: [...polish, ...(out.elements || [])],
    notes: content?.notes || '',
  }
}

/** 供 LLM 大纲阶段选择版式的菜单文本 */
export function layoutMenuForPrompt() {
  return LAYOUTS.map(l => `- ${l.id}（${l.label}）：内容字段 ${l.fields}`).join('\n')
}

/** 版式 id 列表（校验用） */
export const LAYOUT_IDS = LAYOUTS.map(l => l.id)
