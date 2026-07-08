/**
 * 图表 SVG 渲染（HTML 预览用）
 *
 * chart 元素：{ type:'chart', chartType, cats:[], series:[{name,values:[]}], colors:[], legend, showValue }
 * 预览端用本文件画 SVG；导出端 ppt-pptx-renderer 走 pptxgenjs 原生 addChart。
 * chartType: bar(竖柱) | barH(横条) | line(折线) | area(面积) | pie(饼) | doughnut(环)
 */

function hx(c) { return '#' + String(c || '000000').replace(/^#/, '') }
function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m])) }

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }

function niceTop(max) {
  if (!(max > 0)) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const n = max / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow * (max / (step * pow) > 0.9 ? 1.25 : 1)
}

function polar(cx, cy, r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)] }

const fmtV = v => (Number.isInteger(v) ? v : +Number(v).toFixed(1))
// 顶部两角圆、底部直角的柱形路径
function barTopPath(x, y, w, h, r) {
  if (h <= 0.5) return `M${x} ${y} h${w} v0.5 h${-w} Z`
  r = Math.max(0, Math.min(r, w / 2, h))
  return `M${x} ${(y + h).toFixed(1)} L${x} ${(y + r).toFixed(1)} Q${x} ${y} ${(x + r).toFixed(1)} ${y} L${(x + w - r).toFixed(1)} ${y} Q${(x + w).toFixed(1)} ${y} ${(x + w).toFixed(1)} ${(y + r).toFixed(1)} L${(x + w).toFixed(1)} ${(y + h).toFixed(1)} Z`
}

/**
 * @returns {string} 完整 <svg>，铺满 wpx × hpx
 */
export function chartSvg(el, wpx, hpx) {
  const w = Math.max(40, wpx), h = Math.max(30, hpx)
  const type = el.chartType || 'bar'
  const colors = (el.colors && el.colors.length ? el.colors : ['6366F1', '22D3EE', 'F59E0B', '34D399', 'F472B6']).map(hx)
  const axis = hx(el.axisColor || '9AA4B2')
  const grid = hx(el.gridColor || 'D9DEE6')
  const valCol = hx(el.valueColor || el.axisColor || '6B7280')
  const font = el.fontFace || 'Calibri'
  const cats = (el.cats || []).map(esc)
  const series = (el.series || []).map(s => ({ name: esc(s.name || ''), values: (s.values || []).map(num) }))
  const fs = Math.max(7, Math.min(13, h / 16))
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${esc(font)},'Microsoft YaHei',sans-serif">`

  if (type === 'pie' || type === 'doughnut') return head + pieChart(el, w, h, colors, valCol, cats, series, fs, type === 'doughnut') + '</svg>'
  if (type === 'barH') return head + barHChart(w, h, colors, axis, grid, valCol, cats, series, fs) + '</svg>'
  if (type === 'line' || type === 'area') return head + lineChart(w, h, colors, axis, grid, valCol, cats, series, fs, type === 'area') + '</svg>'
  return head + barChart(w, h, colors, axis, grid, valCol, cats, series, fs) + '</svg>'
}

function legend(x, y, items, colors, fs, valCol) {
  let s = ''
  let cx = x
  items.forEach((name, i) => {
    s += `<rect x="${cx}" y="${y - fs * 0.8}" width="${fs}" height="${fs}" rx="2" fill="${colors[i % colors.length]}"/>`
    s += `<text x="${cx + fs + 3}" y="${y}" font-size="${fs}" fill="${valCol}">${name}</text>`
    cx += fs + 5 + name.length * fs * 0.62 + 10
  })
  return s
}

function barChart(w, h, colors, axis, grid, valCol, cats, series, fs) {
  const multi = series.length > 1
  const pad = { l: 36, r: 14, t: multi ? fs + 16 : fs + 12, b: 28 }
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b
  const maxV = Math.max(1, ...series.flatMap(s => s.values))
  const top = niceTop(maxV)
  let s = ''
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + ph * (1 - g / 4)
    s += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="${grid}" stroke-width="1" opacity="${g === 0 ? 0.85 : 0.38}"/>`
    s += `<text x="${pad.l - 6}" y="${y + fs * 0.35}" font-size="${fs * 0.8}" fill="${valCol}" text-anchor="end" opacity="0.7">${Math.round(top * g / 4)}</text>`
  }
  const n = Math.max(cats.length, 1)
  const groupW = pw / n
  const bc = Math.max(series.length, 1)
  const bw = Math.min((groupW * 0.6) / bc, 56)
  const radius = Math.min(bw * 0.3, 7)
  cats.forEach((cat, ci) => {
    const gx = pad.l + groupW * ci + groupW / 2
    series.forEach((se, si) => {
      const v = se.values[ci] || 0
      const bh = ph * (v / top)
      const x = gx - (bc * bw) / 2 + si * bw + 1
      const y = pad.t + ph - bh
      s += `<path d="${barTopPath(x, y, bw - 2, bh, radius)}" fill="${colors[si % colors.length]}"/>`
      if (!multi) s += `<text x="${x + (bw - 2) / 2}" y="${y - 5}" font-size="${fs * 0.86}" fill="${valCol}" text-anchor="middle" font-weight="700">${fmtV(v)}</text>`
    })
    s += `<text x="${gx}" y="${pad.t + ph + fs + 5}" font-size="${fs * 0.9}" fill="${valCol}" text-anchor="middle">${cat}</text>`
  })
  if (multi) s += legend(pad.l, fs + 4, series.map(x => x.name), colors, fs, valCol)
  return s
}

function barHChart(w, h, colors, axis, grid, valCol, cats, series, fs) {
  const pad = { l: Math.min(w * 0.28, 120), r: 36, t: 8, b: 8 }
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b
  const vals = (series[0]?.values) || []
  const maxV = Math.max(1, ...vals)
  const n = Math.max(cats.length, 1)
  const rowH = ph / n
  const bh = Math.min(rowH * 0.6, 30)
  let s = ''
  cats.forEach((cat, i) => {
    const v = vals[i] || 0
    const y = pad.t + rowH * i + (rowH - bh) / 2
    s += `<text x="${pad.l - 6}" y="${y + bh / 2 + fs * 0.35}" font-size="${fs * 0.92}" fill="${valCol}" text-anchor="end">${cat}</text>`
    s += `<rect x="${pad.l}" y="${y}" width="${pw}" height="${bh}" rx="${bh / 2}" fill="${grid}" opacity="0.5"/>`
    const bw = pw * (v / maxV)
    s += `<rect x="${pad.l}" y="${y}" width="${Math.max(bh, bw)}" height="${bh}" rx="${bh / 2}" fill="${colors[i % colors.length]}"/>`
    s += `<text x="${pad.l + pw + 5}" y="${y + bh / 2 + fs * 0.35}" font-size="${fs * 0.9}" fill="${valCol}">${v}</text>`
  })
  return s
}

function lineChart(w, h, colors, axis, grid, valCol, cats, series, fs, area) {
  const multi = series.length > 1
  const pad = { l: 34, r: 12, t: multi ? fs + 12 : 12, b: 26 }
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b
  const maxV = Math.max(1, ...series.flatMap(s => s.values))
  const top = niceTop(maxV)
  const n = Math.max(cats.length, 1)
  let s = ''
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + ph * (1 - g / 4)
    s += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="${grid}" stroke-width="1" opacity="${g === 0 ? 0.85 : 0.38}"/>`
    s += `<text x="${pad.l - 6}" y="${y + fs * 0.35}" font-size="${fs * 0.8}" fill="${valCol}" text-anchor="end" opacity="0.7">${Math.round(top * g / 4)}</text>`
  }
  const xOf = (i) => pad.l + (n === 1 ? pw / 2 : pw * i / (n - 1))
  const yOf = (v) => pad.t + ph * (1 - (v || 0) / top)
  series.forEach((se, si) => {
    const col = colors[si % colors.length]
    const pts = cats.map((_, i) => `${xOf(i)},${yOf(se.values[i])}`)
    if (area && si === 0) {
      const gid = `ag${si}_${Math.round(pw)}`
      s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0.30"/><stop offset="1" stop-color="${col}" stop-opacity="0.02"/></linearGradient></defs>`
      s += `<polygon points="${xOf(0)},${pad.t + ph} ${pts.join(' ')} ${xOf(n - 1)},${pad.t + ph}" fill="url(#${gid})"/>`
    }
    s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2.75" stroke-linejoin="round" stroke-linecap="round"/>`
    cats.forEach((_, i) => { s += `<circle cx="${xOf(i)}" cy="${yOf(se.values[i])}" r="3.4" fill="#fff" stroke="${col}" stroke-width="2.2"/>` })
  })
  cats.forEach((cat, i) => { s += `<text x="${xOf(i)}" y="${pad.t + ph + fs + 4}" font-size="${fs * 0.9}" fill="${valCol}" text-anchor="middle">${cat}</text>` })
  if (multi) s += legend(pad.l, fs + 2, series.map(x => x.name), colors, fs, valCol)
  return s
}

function pieChart(el, w, h, colors, valCol, cats, series, fs, donut) {
  const vals = (series[0]?.values) || []
  const tot = vals.reduce((a, b) => a + (b || 0), 0) || 1
  const legendW = Math.min(w * 0.4, 150)
  const cx = (w - legendW) / 2 + 6
  const cy = h / 2
  const R = Math.min((w - legendW) / 2, h / 2) - 6
  const rIn = donut ? R * 0.58 : 0
  const stroke = hx(el.bgColor || 'FFFFFF')
  const sw = vals.length > 1 ? 1.6 : 0
  let s = ''
  let a0 = -Math.PI / 2
  vals.forEach((v, i) => {
    const a1 = a0 + 2 * Math.PI * num(v) / tot
    const [x0, y0] = polar(cx, cy, R, a0), [x1, y1] = polar(cx, cy, R, a1)
    const large = (a1 - a0) > Math.PI ? 1 : 0
    const col = colors[i % colors.length]
    if (donut) {
      const [ix1, iy1] = polar(cx, cy, rIn, a1), [ix0, iy0] = polar(cx, cy, rIn, a0)
      s += `<path d="M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${ix1} ${iy1} A${rIn} ${rIn} 0 ${large} 0 ${ix0} ${iy0} Z" fill="${col}" stroke="${stroke}" stroke-width="${sw}"/>`
    } else {
      s += `<path d="M${cx} ${cy} L${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} Z" fill="${col}" stroke="${stroke}" stroke-width="${sw}"/>`
    }
    a0 = a1
  })
  // 图例
  const lx = w - legendW + 8
  let ly = cy - (cats.length * (fs + 7)) / 2 + fs
  cats.forEach((cat, i) => {
    const pct = Math.round((vals[i] || 0) / tot * 100)
    s += `<rect x="${lx}" y="${ly - fs * 0.8}" width="${fs}" height="${fs}" rx="2" fill="${colors[i % colors.length]}"/>`
    s += `<text x="${lx + fs + 4}" y="${ly}" font-size="${fs * 0.92}" fill="${valCol}">${cat} ${pct}%</text>`
    ly += fs + 7
  })
  return s
}
