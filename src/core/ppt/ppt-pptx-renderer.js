/**
 * pptx 导出器
 *
 * 把 deck.slides[].elements[] 逐元素映射为 pptxgenjs 形状/文本/图片，产出真·可编辑 .pptx。
 * 与 HTML 预览共用同一份 elements[]，所见即所得。
 * 图标先用离屏 canvas 光栅化为 PNG，避免 SVG 在 PowerPoint 中渲染不稳定。
 */
import pptxgen from 'pptxgenjs'
import { SLIDE_W, SLIDE_H } from './ppt-geometry.js'
import { textParagraphs, resolveShadow } from './ppt-elements.js'
import { iconSvg, svgToPngDataUrl } from './ppt-icons.js'
import { backgroundPngDataUrl, backgroundSolid } from './ppt-background.js'

function hx(c) { return String(c == null ? '000000' : c).replace(/^#/, '').toUpperCase().slice(0, 6).padEnd(6, '0') }

function dashType(d) {
  if (d === 'dash') return 'dash'
  if (d === 'dot') return 'sysDot'
  return 'solid'
}

function shadowObj(shadow) {
  const s = resolveShadow(shadow)
  return s ? { type: 'outer', color: hx(s.color), blur: s.blur, offset: s.offset, angle: s.angle, opacity: s.opacity } : undefined
}

function fillFor(el) {
  if (el.fill == null) return { color: 'FFFFFF', transparency: 100 }
  const transparency = Math.round((1 - (el.fillAlpha == null ? 1 : el.fillAlpha)) * 100)
  return { color: hx(el.fill), transparency }
}

function renderText(slide, el) {
  const paras = textParagraphs(el)
  const runs = paras.map((p) => ({
    text: p.text || '',
    options: {
      fontSize: p.fontSize,
      bold: !!p.bold,
      italic: !!p.italic,
      color: hx(p.color),
      align: p.align || 'left',
      bullet: p.bullet ? { indent: 14 } : false,
      breakLine: true,
      ...(p.spaceAfter ? { paraSpaceAfter: p.spaceAfter } : {}),
      ...(p.lineSpacing ? { lineSpacing: p.lineSpacing } : {}),
    },
  }))
  slide.addText(runs.length ? runs : [{ text: '', options: { breakLine: true } }], {
    x: el.x, y: el.y, w: el.w, h: el.h,
    valign: el.valign || 'top', align: el.align || 'left',
    fontFace: el.fontFace || 'Calibri', color: hx(el.color), fontSize: el.fontSize || 14, bold: !!el.bold, italic: !!el.italic,
    charSpacing: el.charSpacing || 0,
    ...(el.lineSpacing ? { lineSpacing: el.lineSpacing } : {}),
    fit: el.shrink ? 'shrink' : 'none', wrap: el.wrap !== false,
    rotate: el.rot || 0, shadow: shadowObj(el.shadow), margin: 0,
  })
}

function renderShape(slide, el, pptx) {
  const map = { rect: pptx.ShapeType.rect, roundRect: pptx.ShapeType.roundRect, ellipse: pptx.ShapeType.ellipse }
  const opts = {
    x: el.x, y: el.y, w: el.w, h: el.h,
    fill: fillFor(el),
    rotate: el.rot || 0,
    shadow: shadowObj(el.shadow),
  }
  if (el.line) opts.line = { color: hx(el.line.color), width: el.line.width || 1, dashType: dashType(el.line.dash) }
  if (el.type === 'roundRect') opts.rectRadius = el.radius || 0
  slide.addShape(map[el.type], opts)
}

function renderLine(slide, el, pptx) {
  slide.addShape(pptx.ShapeType.line, {
    x: el.x, y: el.y, w: el.w, h: el.h,
    line: { color: hx(el.lineColor), width: el.lineWidth || 1, dashType: dashType(el.dash) },
    rotate: el.rot || 0,
  })
}

function renderImage(slide, el) {
  if (!el.src) return
  const opts = { x: el.x, y: el.y, w: el.w, h: el.h, rotate: el.rot || 0, sizing: { type: el.sizing || 'contain', w: el.w, h: el.h } }
  if (String(el.src).startsWith('data:')) opts.data = el.src
  else opts.path = el.src
  if (el.frame) opts.shadow = shadowObj('lg')
  slide.addImage(opts)
}

const DEFAULT_CHART_COLORS = ['6366F1', '22D3EE', 'F59E0B', '34D399', 'F472B6', '818CF8']

function renderChart(slide, el, pptx) {
  const cats = el.cats || []
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
  const series = (el.series || []).map(s => ({ name: s.name || '系列', labels: cats, values: (s.values || []).map(num) }))
  if (!series.length || !cats.length) return
  const colors = (el.colors && el.colors.length ? el.colors : DEFAULT_CHART_COLORS).map(hx)
  const t = el.chartType || 'bar'
  const typeStr = (t === 'barH') ? 'bar' : (t === 'pie') ? 'pie' : (t === 'doughnut') ? 'doughnut' : (t === 'area') ? 'area' : (t === 'line') ? 'line' : 'bar'
  const data = (typeStr === 'pie' || typeStr === 'doughnut') ? [series[0]] : series
  const opts = {
    x: el.x, y: el.y, w: el.w, h: el.h,
    chartColors: colors,
    showLegend: !!el.legend, legendPos: 'b', legendColor: hx(el.valueColor || '6B7280'), legendFontSize: 9,
    showValue: !!el.showValue,
    showTitle: false,
    dataLabelColor: hx(el.valueColor || '6B7280'), dataLabelFontSize: 9,
    catAxisLabelColor: hx(el.axisColor || '9AA4B2'), valAxisLabelColor: hx(el.axisColor || '9AA4B2'),
    catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
  }
  if (typeStr === 'bar') {
    opts.barDir = (t === 'barH') ? 'bar' : 'col'
    opts.barGapWidthPct = 40
    opts.valGridLine = { color: hx(el.gridColor || 'D9DEE6'), size: 1 }
    opts.catGridLine = { style: 'none' }
  } else if (typeStr === 'line' || typeStr === 'area') {
    opts.lineSize = 2.4
    opts.valGridLine = { color: hx(el.gridColor || 'D9DEE6'), size: 1 }
    opts.catGridLine = { style: 'none' }
  } else if (typeStr === 'doughnut') {
    opts.holeSize = 58
    opts.showValue = false
    opts.showPercent = !!el.showValue
  } else if (typeStr === 'pie') {
    opts.showPercent = !!el.showValue
  }
  slide.addChart(typeStr, data, opts)
}

function renderIcon(slide, el, pptx, iconCache) {
  let gx = el.x, gy = el.y, gw = el.w, gh = el.h
  if (el.chip) {
    const map = el.chipRound ? pptx.ShapeType.ellipse : pptx.ShapeType.roundRect
    const o = { x: el.x, y: el.y, w: el.w, h: el.h, fill: { color: hx(el.chipColor), transparency: Math.round((1 - (el.chipAlpha == null ? 1 : el.chipAlpha)) * 100) } }
    if (!el.chipRound) o.rectRadius = 0.08
    slide.addShape(map, o)
    const g = Math.min(el.w, el.h) * 0.56
    gx = el.x + (el.w - g) / 2; gy = el.y + (el.h - g) / 2; gw = g; gh = g
  }
  const png = iconCache.get(`${el.name}|${hx(el.color)}`)
  if (png) slide.addImage({ data: png, x: gx, y: gy, w: gw, h: gh, rotate: el.rot || 0 })
}

/**
 * @param {Object} deck
 * @returns {Promise<Uint8Array>} pptx 二进制
 */
export async function renderDeckToPptx(deck) {
  const pptx = new pptxgen()
  pptx.defineLayout({ name: 'PPTW', width: SLIDE_W, height: SLIDE_H })
  pptx.layout = 'PPTW'
  pptx.author = '交付助手'
  pptx.company = '交付助手'
  pptx.title = deck.meta?.topic || 'PPT'

  // 预光栅化所有图标
  const iconCache = new Map()
  for (const s of deck.slides || []) {
    for (const el of s.elements || []) {
      if (el.type !== 'icon') continue
      const key = `${el.name}|${hx(el.color)}`
      if (!iconCache.has(key)) {
        try { iconCache.set(key, await svgToPngDataUrl(iconSvg(el.name, hx(el.color), el.strokeWidth || 2), 256)) }
        catch (e) { iconCache.set(key, null) }
      }
    }
  }

  for (const s of deck.slides || []) {
    const slide = pptx.addSlide()
    // 渐变背景：光栅化为 PNG 铺满整页；无 canvas 时退化为纯色
    const bgPng = s.background?.type === 'gradient' ? backgroundPngDataUrl(s.background) : null
    slide.background = bgPng ? { data: bgPng } : { color: hx(backgroundSolid(s.background)) }
    for (const el of s.elements || []) {
      if (el.opacity === 0) continue
      try {
        switch (el.type) {
          case 'text': renderText(slide, el); break
          case 'rect': case 'roundRect': case 'ellipse': renderShape(slide, el, pptx); break
          case 'line': renderLine(slide, el, pptx); break
          case 'image': renderImage(slide, el); break
          case 'icon': renderIcon(slide, el, pptx, iconCache); break
          case 'chart': renderChart(slide, el, pptx); break
        }
      } catch (e) { /* 单元素失败不阻断整套导出 */ }
    }
    if (s.notes) slide.addNotes(String(s.notes))
  }

  const buf = await pptx.write({ outputType: 'arraybuffer' })
  return new Uint8Array(buf)
}
