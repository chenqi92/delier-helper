/**
 * PPT 几何与颜色基础工具
 *
 * 单一事实来源：所有坐标以「英寸」存储，基于 16:9 画幅 13.333 × 7.5 英寸。
 * - HTML 预览：英寸 → 像素（scale = 画布像素宽 / SLIDE_W）
 * - pptx 导出：英寸 1:1 直接写入 pptxgenjs
 * 字号统一以「磅(pt)」存储；HTML 预览换算 px = pt * scale / 72。
 */

export const SLIDE_W = 13.333
export const SLIDE_H = 7.5
export const MARGIN = 0.62
export const GUTTER = 0.3

// ===== 颜色工具（HEX 一律 6 位、不带 #） =====

export function normHex(c) {
  if (!c) return '000000'
  let h = String(c).trim().replace(/^#/, '').toUpperCase()
  if (h.length === 3) h = h.split('').map(x => x + x).join('')
  return h.slice(0, 6).padEnd(6, '0')
}

export function hexToRgb(hex) {
  const h = normHex(hex)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex(r, g, b) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return (f(r) + f(g) + f(b)).toUpperCase()
}

/** 两色按比例 t(0..1) 混合，t=0 取 a，t=1 取 b */
export function mix(a, b, t) {
  const c1 = hexToRgb(a), c2 = hexToRgb(b)
  return rgbToHex(c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t)
}

export function lighten(hex, t = 0.2) { return mix(hex, 'FFFFFF', t) }
export function darken(hex, t = 0.2) { return mix(hex, '000000', t) }

/** 相对亮度 0..1（sRGB 近似） */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG 对比度 (a 与 b)，范围 1..21 */
export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** 给定背景色，挑选对比更高的文字色（深字 vs 浅字取较优者） */
export function pickInk(bgHex, light = 'FFFFFF', dark = '111827') {
  return contrastRatio(dark, bgHex) >= contrastRatio(light, bgHex) ? dark : light
}

/**
 * 把前景色 color 调整到与背景 bg 至少 min 对比度（用于「强调色当文字」）。
 * 已达标则原样返回；否则朝远离背景的明度方向逐步调整，仍不行则回退黑/白。
 */
export function ensureContrast(color, bg, min = 3) {
  if (contrastRatio(color, bg) >= min) return color
  const dirs = luminance(bg) < 0.4 ? ['light', 'dark'] : ['dark', 'light']
  for (const dir of dirs) {
    for (let t = 0.12; t <= 1.0001; t += 0.12) {
      const c = dir === 'light' ? lighten(color, t) : darken(color, t)
      if (contrastRatio(c, bg) >= min) return c
    }
  }
  return pickInk(bg)
}

/** HEX → CSS rgba 字符串（供预览半透明） */
export function rgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ===== 版式数学：把内容区切成行 / 列 / 网格 =====

/** 内容安全区（去掉页边距） */
export function contentBox({ top = 1.7, bottom = MARGIN } = {}) {
  return { x: MARGIN, y: top, w: SLIDE_W - 2 * MARGIN, h: SLIDE_H - top - bottom }
}

/** 把 [x,w] 横向切成 n 等列，返回每列 {x,w} */
export function splitCols(n, { x = MARGIN, w = SLIDE_W - 2 * MARGIN, gutter = GUTTER } = {}) {
  const colW = (w - gutter * (n - 1)) / n
  return Array.from({ length: n }, (_, i) => ({ x: +(x + i * (colW + gutter)).toFixed(3), w: +colW.toFixed(3) }))
}

/** 把 [y,h] 纵向切成 n 等行，返回每行 {y,h} */
export function splitRows(n, { y = MARGIN, h = SLIDE_H - 2 * MARGIN, gutter = GUTTER } = {}) {
  const rowH = (h - gutter * (n - 1)) / n
  return Array.from({ length: n }, (_, i) => ({ y: +(y + i * (rowH + gutter)).toFixed(3), h: +rowH.toFixed(3) }))
}

/** 在 box 内排 cols×rows 网格，返回逐格 {x,y,w,h}（行优先） */
export function gridCells(box, cols, rows, gutter = GUTTER) {
  const cw = (box.w - gutter * (cols - 1)) / cols
  const ch = (box.h - gutter * (rows - 1)) / rows
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        x: +(box.x + c * (cw + gutter)).toFixed(3),
        y: +(box.y + r * (ch + gutter)).toFixed(3),
        w: +cw.toFixed(3),
        h: +ch.toFixed(3),
      })
    }
  }
  return cells
}

/** 数值裁剪 */
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
