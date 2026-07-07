import { saveGenerationHistory } from './db.js'

export const HISTORY_TYPES = [
  { id: 'copyright', label: '软著代码' },
  { id: 'api-doc', label: '接口文档' },
  { id: 'db-doc', label: '数据库文档' },
  { id: 'srs-doc', label: '需求文档' },
  { id: 'sdd-doc', label: '设计文档' },
  { id: 'ops-doc', label: '运维手册' },
  { id: 'tc-doc', label: '测试用例' },
  { id: 'tr-doc', label: '测试记录' },
  { id: 'ppt', label: 'PPT' },
]

export function historyTypeLabel(type) {
  return HISTORY_TYPES.find(t => t.id === type)?.label || type || '未知类型'
}

const IMAGE_KEY_RE = /(imageData|dataUrl|dataURL|base64|src)$/i

function isSensitiveKey(key = '') {
  const k = String(key).toLowerCase()
  return /^(password|passwd|pwd|authorization|api[_-]?key|apikey|secret|secret[_-]?key|access[_-]?key|token)$/.test(k)
    || /(^|[_-])(token|secret)([_-]|$)/.test(k)
}

export function sanitizeForHistory(value, options = {}) {
  const maxString = options.maxString || 50000
  const maxArray = options.maxArray || 800
  const maxDepth = options.maxDepth || 10
  const seen = new WeakSet()

  const walk = (v, key = '', depth = 0) => {
    if (v == null) return v
    if (typeof v === 'string') {
      if (isSensitiveKey(key)) return '***'
      if (IMAGE_KEY_RE.test(key) && /^data:image\//i.test(v)) return `[图片数据已省略，长度 ${v.length}]`
      if (/^data:image\//i.test(v)) return `[图片数据已省略，长度 ${v.length}]`
      return v.length > maxString ? `${v.slice(0, maxString)}\n...[内容已截断，原长度 ${v.length}]` : v
    }
    if (typeof v === 'number' || typeof v === 'boolean') return v
    if (typeof v !== 'object') return String(v)
    if (seen.has(v)) return '[循环引用已省略]'
    if (depth >= maxDepth) return '[层级过深已省略]'
    seen.add(v)

    if (Array.isArray(v)) {
      const arr = v.slice(0, maxArray).map(item => walk(item, key, depth + 1))
      if (v.length > maxArray) arr.push({ __truncated: true, omitted: v.length - maxArray })
      return arr
    }

    const out = {}
    for (const [k, val] of Object.entries(v)) {
      if (isSensitiveKey(k)) {
        out[k] = '***'
        continue
      }
      if (['generating', 'pending'].includes(k)) continue
      out[k] = walk(val, k, depth + 1)
    }
    return out
  }

  return walk(value)
}

export function modelSnapshot(provider, modelId, resolvedConfig = null) {
  if (!provider && !resolvedConfig) return {}
  const model = provider?.models?.find(m => m.id === modelId || m.id === resolvedConfig?.model)
  return sanitizeForHistory({
    providerId: provider?.id || resolvedConfig?.providerId || '',
    providerLabel: provider?.label || provider?.name || '',
    modelId: resolvedConfig?.model || modelId || '',
    modelLabel: model?.label || resolvedConfig?.model || modelId || '',
    baseUrl: resolvedConfig?.baseUrl || provider?.baseUrl || '',
  })
}

export function scanSourceSnapshot(projectDirs = [], scanResult = null, referenceFiles = []) {
  const modules = Array.isArray(scanResult?.modules)
    ? scanResult.modules.slice(0, 80).map(m => ({
      name: m.name,
      path: m.path,
      fileCount: m.files?.length || 0,
      apiCount: m.apis?.length || 0,
    }))
    : []
  const configs = Array.isArray(scanResult?.configs)
    ? scanResult.configs.slice(0, 30).map(c => ({ name: c.name, path: c.path }))
    : []
  return sanitizeForHistory({
    directories: projectDirs,
    stats: scanResult?.stats || null,
    modules,
    configs,
    referenceFiles: referenceFiles.map(f => ({
      name: f.name || f.path || '参考文件',
      type: f.type || '',
      size: f.size || 0,
    })),
  })
}

export function excelSourceSnapshot(excelData = null) {
  if (!excelData) return null
  return sanitizeForHistory({
    sheets: (excelData.sheets || []).map(s => ({
      name: s.name,
      totalRows: s.totalRows,
      headers: s.headers,
      imageCount: s.imageCount || s.images?.length || 0,
    })),
  })
}

export function sectionsArtifact(sections = [], docInfo = {}) {
  return sanitizeForHistory({
    kind: 'sections',
    docInfo,
    sections,
  })
}

export function apiArtifact(parseResult = null, docModules = []) {
  return sanitizeForHistory({
    kind: 'api-doc',
    docModules,
    modules: parseResult?.modules || [],
  })
}

export function dbArtifact(schema = null, exportOptions = {}, commentOverrides = {}) {
  return sanitizeForHistory({
    kind: 'db-doc',
    exportOptions,
    commentOverrides,
    schema,
  })
}

export function pptArtifact(deck = null, cfg = {}, template = null, styleId = '') {
  return sanitizeForHistory({
    kind: 'ppt',
    cfg,
    template: template ? { id: template.id, name: template.name, mode: template.mode, styleId: template.styleId } : null,
    styleId,
    deck,
  }, { maxArray: 1200, maxDepth: 12 })
}

export async function saveHistoryRecord(record) {
  try {
    return await saveGenerationHistory(sanitizeForHistory(record, { maxArray: 1500, maxDepth: 12 }))
  } catch (e) {
    console.warn('保存生成历史失败:', e)
    return null
  }
}
