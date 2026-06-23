/**
 * 图标库（line 风格，24×24 viewBox）
 *
 * - HTML 预览：iconSvg() 返回内联 SVG，随风格重新着色
 * - pptx 导出：svgToPngDataUrl() 用离屏 canvas 光栅化为高分辨率 PNG，保证缩放不糊
 *
 * 仅含简单几何 / path，保证 SVG 合法、跨端一致。
 */

const ICONS = {
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5"/><line x1="12" y1="12" x2="12" y2="21"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><line x1="9" y1="2.5" x2="9" y2="5"/><line x1="15" y1="2.5" x2="15" y2="5"/><line x1="9" y1="19" x2="9" y2="21.5"/><line x1="15" y1="19" x2="15" y2="21.5"/><line x1="2.5" y1="9" x2="5" y2="9"/><line x1="2.5" y1="15" x2="5" y2="15"/><line x1="19" y1="9" x2="21.5" y2="9"/><line x1="19" y1="15" x2="21.5" y2="15"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><line x1="7" y1="7.5" x2="7.02" y2="7.5"/><line x1="7" y1="16.5" x2="7.02" y2="16.5"/>',
  cloud: '<path d="M6.5 18a4 4 0 1 1 .8-7.95 5 5 0 0 1 9.6 1.45A3.5 3.5 0 0 1 17 18H6.5z"/>',
  shield: '<path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6l8-3z"/>',
  zap: '<polygon points="13 2.5 4 14 11 14 10 21.5 20 9.5 13 9.5 13 2.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
  code: '<polyline points="9 8 5 12 9 16"/><polyline points="15 8 19 12 15 16"/>',
  'git-branch': '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  network: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v3"/><path d="M12 11H5v5"/><path d="M12 11h7v5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7"/><path d="M21 20a6 6 0 0 0-4-5.6"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  rocket: '<path d="M5 15c-1 1-1.5 4-1.5 4s3-.5 4-1.5"/><path d="M9 15l-3-3c3-7 8-9 12-9 0 4-2 9-9 12z"/><circle cx="14.5" cy="9.5" r="1.5"/>',
  'bar-chart': '<line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="9"/>',
  check: '<circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>',
  workflow: '<rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="15" width="6" height="5" rx="1"/><path d="M9 6.5h4a2 2 0 0 1 2 2V15"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><polyline points="7 9 10 12 7 15"/><line x1="12" y1="15" x2="16" y2="15"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 2.5 15 0 18"/><path d="M12 3c-2.5 2.5-2.5 15 0 18"/>',
  smartphone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><line x1="11" y1="18.5" x2="13" y2="18.5"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/>',
  gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><line x1="12" y1="16" x2="15" y2="10"/>',
  plug: '<path d="M9 2v6M15 2v6"/><path d="M7 8h10v3a5 5 0 0 1-10 0V8z"/><line x1="12" y1="16" x2="12" y2="22"/>',
  key: '<circle cx="8" cy="14" r="4"/><line x1="10.8" y1="11.2" x2="21" y2="1"/><line x1="17" y1="5" x2="20" y2="8"/><line x1="14.5" y1="7.5" x2="17.5" y2="10.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  'file-text': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  refresh: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8"/><polyline points="20 3 20 8 15 8"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16"/><polyline points="4 21 4 16 9 16"/>',
  'arrow-right': '<line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  activity: '<polyline points="3 12 8 12 11 4 14 20 17 12 21 12"/>',
  lightbulb: '<path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/><line x1="9" y1="19" x2="15" y2="19"/><line x1="10" y1="21.5" x2="14" y2="21.5"/>',
  message: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>',
  flag: '<line x1="5" y1="22" x2="5" y2="4"/><path d="M5 4h11l-2 3 2 3H5"/>',
  star: '<polygon points="12 3 14.6 8.6 21 9.3 16 13.6 17.5 20 12 16.5 6.5 20 8 13.6 3 9.3 9.4 8.6 12 3"/>',
}

export const ICON_NAMES = Object.keys(ICONS)

export function hasIcon(name) {
  return !!ICONS[name]
}

/** 把任意名归一化到库内已有图标，找不到回退 box */
export function resolveIcon(name) {
  if (!name) return 'box'
  const key = String(name).toLowerCase().replace(/_/g, '-')
  if (ICONS[key]) return key
  // 常见别名映射
  const alias = {
    api: 'plug', interface: 'plug', service: 'server', backend: 'server',
    frontend: 'monitor', ui: 'monitor', web: 'globe', mobile: 'smartphone',
    data: 'database', db: 'database', storage: 'database', sql: 'database',
    auth: 'lock', security: 'shield', permission: 'key', user: 'users',
    speed: 'zap', performance: 'gauge', fast: 'zap', deploy: 'rocket',
    module: 'grid', component: 'grid', architecture: 'layers', stack: 'layers',
    flow: 'workflow', process: 'workflow', chart: 'bar-chart', report: 'bar-chart',
    cloud: 'cloud', ai: 'cpu', model: 'cpu', config: 'settings', setting: 'settings',
    notify: 'bell', alert: 'bell', sync: 'refresh', time: 'clock', goal: 'target',
    idea: 'lightbulb', chat: 'message', doc: 'file-text', file: 'file-text',
  }
  return alias[key] || 'box'
}

/** 返回完整内联 SVG 字符串 */
export function iconSvg(name, color = '111827', strokeWidth = 2, sizePx = null) {
  const key = resolveIcon(name)
  const c = '#' + String(color).replace(/^#/, '')
  const dim = sizePx ? ` width="${sizePx}" height="${sizePx}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg"${dim} viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>`
}

/** 离屏 canvas 光栅化为 PNG dataURL（仅浏览器/导出时可用） */
export function svgToPngDataUrl(svg, sizePx = 256) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = sizePx
          canvas.height = sizePx
          const ctx = canvas.getContext('2d')
          ctx.clearRect(0, 0, sizePx, sizePx)
          ctx.drawImage(img, 0, 0, sizePx, sizePx)
          resolve(canvas.toDataURL('image/png'))
        } catch (e) { reject(e) }
      }
      img.onerror = reject
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    } catch (e) { reject(e) }
  })
}
