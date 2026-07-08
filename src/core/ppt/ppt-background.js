/**
 * 页面背景渲染（纯色 / 渐变）—— HTML 预览与 pptx 导出共用同一份 background 描述。
 *
 * background 形态：
 *   { type: 'color', color: 'HEX' }
 *   { type: 'gradient', color: 'HEX'(纯色兜底), angle: <CSS 角度 deg>, stops: [{ color, pos(0..100) }] }
 *
 * pptxgenjs 4.x 不支持形状/背景渐变，故导出时把渐变离屏光栅化为小 PNG，
 * 再作为 slide.background 图片写入（PowerPoint 会拉伸铺满整页）。无 canvas 环境退化为纯色。
 */
import { normHex, clamp } from './ppt-geometry.js'

/** 供 HTML 预览用的 CSS background 值 */
export function backgroundCss(bg) {
  if (!bg) return '#FFFFFF'
  if (bg.type === 'gradient' && Array.isArray(bg.stops) && bg.stops.length) {
    const stops = bg.stops
      .map(s => `#${normHex(s.color)} ${clamp(Number(s.pos) || 0, 0, 100)}%`)
      .join(', ')
    return `linear-gradient(${Number(bg.angle) || 160}deg, ${stops})`
  }
  return '#' + normHex(bg.color || 'FFFFFF')
}

/** 纯色兜底（供需要单色的场景：取值/取反色/缩略图） */
export function backgroundSolid(bg) {
  if (!bg) return 'FFFFFF'
  if (bg.color) return normHex(bg.color)
  if (bg.type === 'gradient' && bg.stops?.length) return normHex(bg.stops[Math.floor(bg.stops.length / 2)].color)
  return 'FFFFFF'
}

// CSS 角度(deg) → canvas 线性渐变端点。CSS 0deg 指向上方(100% 在顶部)，180deg 向下。
function angleToLine(angle, w, h) {
  const rad = ((Number(angle) || 160)) * Math.PI / 180
  const dx = Math.sin(rad), dy = -Math.cos(rad)
  const halfLen = (Math.abs(w * dx) + Math.abs(h * dy)) / 2
  const cx = w / 2, cy = h / 2
  return { x0: cx - dx * halfLen, y0: cy - dy * halfLen, x1: cx + dx * halfLen, y1: cy + dy * halfLen }
}

/**
 * 把背景光栅化为 PNG dataURL（仅浏览器）。渐变较柔和，低分辨率即可，体积很小。
 * @returns {string|null} dataURL 或 null（无 canvas / 非渐变）
 */
export function backgroundPngDataUrl(bg, w = 480, h = 270) {
  if (typeof document === 'undefined' || !bg || bg.type !== 'gradient' || !bg.stops?.length) return null
  try {
    const cv = document.createElement('canvas')
    cv.width = w; cv.height = h
    const ctx = cv.getContext('2d')
    const { x0, y0, x1, y1 } = angleToLine(bg.angle, w, h)
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    const stops = bg.stops.slice().sort((a, b) => (a.pos || 0) - (b.pos || 0))
    stops.forEach(s => g.addColorStop(clamp((Number(s.pos) || 0) / 100, 0, 1), '#' + normHex(s.color)))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    return cv.toDataURL('image/png')
  } catch (e) {
    return null
  }
}
