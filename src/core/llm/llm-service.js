/**
 * LLM 大模型服务模块
 * 统一封装大模型 API 调用，占位符收集，Prompt 构建，结果回填
 */
import { invoke } from '@tauri-apps/api/core'
import { load } from '@tauri-apps/plugin-store'

// ==================== 模型提供商预设 ====================

export const LLM_PROVIDERS = [
    {
        id: 'openai',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'],
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        models: ['deepseek-chat', 'deepseek-reasoner'],
    },
    {
        id: 'qwen',
        label: '通义千问 (Qwen)',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long', 'qwen-vl-plus', 'qwen-vl-max', 'qwen2.5-72b-instruct', 'qwen2.5-32b-instruct'],
    },
    {
        id: 'zhipu',
        label: '智谱 (GLM)',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4-plus', 'glm-4', 'glm-4-long', 'glm-4-flash', 'glm-4-flashx', 'glm-3-turbo'],
    },
    {
        id: 'moonshot',
        label: '月之暗面 (Kimi)',
        baseUrl: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    },
    {
        id: 'baichuan',
        label: '百川智能',
        baseUrl: 'https://api.baichuan-ai.com/v1',
        models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan3-Turbo-128k', 'Baichuan2-Turbo'],
    },
    {
        id: 'doubao',
        label: '豆包 (字节)',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        models: ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-32k', 'doubao-lite-128k'],
    },
    {
        id: 'spark',
        label: '讯飞星火',
        baseUrl: 'https://spark-api-open.xf-yun.com/v1',
        models: ['generalv3.5', 'generalv3', 'generalv2', '4.0Ultra'],
    },
    {
        id: 'claude',
        label: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com/v1',
        models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        note: '需通过兼容代理使用',
    },
    {
        id: 'gemini',
        label: 'Google (Gemini)',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    },
    {
        id: 'siliconflow',
        label: 'SiliconFlow',
        baseUrl: 'https://api.siliconflow.cn/v1',
        models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'THUDM/glm-4-9b-chat'],
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-flash', 'deepseek/deepseek-chat'],
    },
    {
        id: 'custom',
        label: '自定义 / 本地部署',
        baseUrl: '',
        models: [],
        note: 'Ollama, vLLM, LM Studio 等',
    },
]

// ==================== 多模型配置持久化 ====================

const STORE_FILE = 'llm-config.json'
let _storeInstance = null

async function getStore() {
    if (!_storeInstance) {
        _storeInstance = await load(STORE_FILE, { autoSave: true })
    }
    return _storeInstance
}

let _configId = 0

/**
 * 生成唯一配置 ID
 */
function nextId() {
    return `cfg_${Date.now()}_${++_configId}`
}

/**
 * 加载所有已保存的模型配置列表
 * @returns {Promise<Array<{id: string, name: string, providerId: string, baseUrl: string, apiKey: string, model: string}>>}
 */
export async function loadAllConfigs() {
    try {
        const store = await getStore()
        const configs = await store.get('configs')
        if (Array.isArray(configs) && configs.length > 0) return configs
        // 兼容旧的单配置格式
        const legacy = await store.get('config')
        if (legacy && legacy.apiKey) {
            const migrated = [{
                id: nextId(),
                name: `${getProviderLabel(legacy.providerId)} - ${legacy.model}`,
                ...legacy,
            }]
            await store.set('configs', migrated)
            await store.set('activeId', migrated[0].id)
            await store.delete('config')
            await store.save()
            return migrated
        }
    } catch (e) {
        console.warn('加载 LLM 配置失败:', e)
    }
    return []
}

/**
 * 加载当前激活的配置 ID
 */
export async function loadActiveConfigId() {
    try {
        const store = await getStore()
        return await store.get('activeId') || null
    } catch (e) {
        return null
    }
}

/**
 * 加载当前激活的配置（供 AI 补充使用）
 */
export async function loadLlmConfig() {
    const configs = await loadAllConfigs()
    if (configs.length === 0) return null
    const activeId = await loadActiveConfigId()
    if (activeId) {
        const found = configs.find(c => c.id === activeId)
        if (found) return found
    }
    return configs[0] // fallback 第一个
}

/**
 * 保存完整配置列表
 */
export async function saveAllConfigs(configs) {
    try {
        const store = await getStore()
        await store.set('configs', configs)
        await store.save()
    } catch (e) {
        console.warn('保存 LLM 配置失败:', e)
    }
}

/**
 * 设置激活的配置 ID
 */
export async function setActiveConfigId(id) {
    try {
        const store = await getStore()
        await store.set('activeId', id)
        await store.save()
    } catch (e) {
        console.warn('保存激活配置 ID 失败:', e)
    }
}

/**
 * 添加或更新一条配置
 */
export async function upsertConfig(config) {
    const configs = await loadAllConfigs()
    const idx = configs.findIndex(c => c.id === config.id)
    if (idx >= 0) {
        configs[idx] = { ...configs[idx], ...config }
    } else {
        config.id = config.id || nextId()
        configs.push(config)
    }
    await saveAllConfigs(configs)
    return config
}

/**
 * 删除一条配置
 */
export async function deleteConfig(id) {
    let configs = await loadAllConfigs()
    configs = configs.filter(c => c.id !== id)
    await saveAllConfigs(configs)
    // 如果删掉的是激活配置，切换到第一个
    const activeId = await loadActiveConfigId()
    if (activeId === id && configs.length > 0) {
        await setActiveConfigId(configs[0].id)
    }
    return configs
}

function getProviderLabel(providerId) {
    const p = LLM_PROVIDERS.find(p => p.id === providerId)
    return p ? p.label : providerId
}

/**
 * 为配置生成显示名
 */
export function generateConfigName(config) {
    const providerLabel = getProviderLabel(config.providerId)
    return `${providerLabel} / ${config.model}`
}

export { nextId }

// ==================== LLM API 调用 ====================

/**
 * 调用 LLM chat completions API
 * 通过 Rust 后端 invoke 发起请求，绕过前端 fetch 的 header 限制
 */
export async function callLlm(config, messages, options = {}) {
    const { baseUrl, apiKey, model, providerId } = config
    const { temperature = 0.3, maxTokens = 4096 } = options

    const base = baseUrl.replace(/\/+$/, '')
    const isGemini = providerId === 'gemini' || base.includes('generativelanguage.googleapis.com')

    const url = `${base}/chat/completions`

    const reqBody = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
    }

    // Gemini 的 OpenAI 兼容模式不一定支持 response_format
    if (!isGemini) {
        reqBody.response_format = { type: 'json_object' }
    }

    // 通过 Rust 后端发起请求（camelCase 字段名匹配 serde rename_all）
    const result = await invoke('llm_request', {
        req: {
            url,
            apiKey,
            body: JSON.stringify(reqBody),
            isGemini,
        }
    })

    if (!result.success) {
        throw new Error(result.error || `LLM API 错误 (${result.status})`)
    }

    if (!result.body || result.body.trim() === '') {
        throw new Error('LLM 返回空响应')
    }

    let data
    try {
        data = JSON.parse(result.body)
    } catch (e) {
        console.error('LLM 响应解析失败, body:', result.body.substring(0, 500))
        throw new Error(`LLM 返回了无效 JSON: ${result.body.substring(0, 200)}`)
    }

    if (!data.choices || data.choices.length === 0) {
        throw new Error('LLM 返回空结果')
    }

    return data.choices[0].message.content
}

/**
 * 测试 LLM 连接
 */
export async function testLlmConnection(config) {
    try {
        const result = await callLlm(config, [
            { role: 'user', content: '请回复一个JSON: {"status":"ok"}' },
        ], { maxTokens: 64 })
        const parsed = JSON.parse(result)
        return { success: true, message: '连接成功', raw: parsed }
    } catch (e) {
        return { success: false, message: String(e) }
    }
}

// ==================== API 文档占位符处理 ====================

const API_PLACEHOLDER_PREFIX = '{{待补充:'
const API_PLACEHOLDER_SUFFIX = '}}'

function isApiPlaceholder(text) {
    return text && typeof text === 'string' &&
        text.startsWith(API_PLACEHOLDER_PREFIX) && text.endsWith(API_PLACEHOLDER_SUFFIX)
}

export function collectApiDocPlaceholders(parseResult) {
    const items = []
    if (!parseResult || !parseResult.modules) return items

    for (const mod of parseResult.modules) {
        for (const api of mod.apis) {
            const apiContext = {
                module: mod.name,
                method: api.method,
                path: api.path,
                methodName: api.methodName,
            }

            // 接口名称（summary）占位符
            if (isApiPlaceholder(api.summary)) {
                items.push({
                    type: 'api_summary',
                    key: `${mod.className}.${api.methodName}.summary`,
                    context: { ...apiContext },
                    currentValue: api.summary,
                    ref: api,
                    field: 'summary',
                    moduleName: mod.name,
                })
            }

            // 接口描述占位符
            if (isApiPlaceholder(api.description)) {
                items.push({
                    type: 'api_description',
                    key: `${mod.className}.${api.methodName}.description`,
                    context: { ...apiContext, summary: api.summary },
                    currentValue: api.description,
                    ref: api,
                    field: 'description',
                    moduleName: mod.name,
                })
            }

            for (const p of api.params) {
                if (isApiPlaceholder(p.description)) {
                    items.push({
                        type: 'param_description',
                        key: `${mod.className}.${api.methodName}.param.${p.name}`,
                        context: { ...apiContext, paramName: p.name, paramType: p.type, paramIn: p.in },
                        currentValue: p.description,
                        ref: p,
                        field: 'description',
                        moduleName: mod.name,
                    })
                }
            }

            if (api.requestBody) {
                for (const f of api.requestBody.fields) {
                    if (isApiPlaceholder(f.description)) {
                        items.push({
                            type: 'request_field_description',
                            key: `${mod.className}.${api.methodName}.requestBody.${f.name}`,
                            context: { ...apiContext, fieldName: f.name, fieldType: f.type, bodyType: api.requestBody.type },
                            currentValue: f.description,
                            ref: f,
                            field: 'description',
                            moduleName: mod.name,
                        })
                    }
                }
            }

            if (api.response) {
                for (const f of api.response.fields) {
                    if (isApiPlaceholder(f.description)) {
                        items.push({
                            type: 'response_field_description',
                            key: `${mod.className}.${api.methodName}.response.${f.name}`,
                            context: { ...apiContext, fieldName: f.name, fieldType: f.type, responseType: api.response.type },
                            currentValue: f.description,
                            ref: f,
                            field: 'description',
                            moduleName: mod.name,
                        })
                    }
                }
            }
        }
    }

    return items
}

export function buildApiDocPrompt(placeholders) {
    const entries = placeholders.map((p, i) => {
        const ctx = p.context
        let desc = `#${i + 1} [${p.type}] key="${p.key}"`
        if (ctx.method) desc += ` | ${ctx.method} ${ctx.path}`
        if (ctx.paramName) desc += ` | 参数: ${ctx.paramName} (${ctx.paramType})`
        if (ctx.fieldName) desc += ` | 字段: ${ctx.fieldName} (${ctx.fieldType})`
        if (ctx.summary) desc += ` | 接口摘要: ${ctx.summary}`
        return desc
    })

    return [
        {
            role: 'system',
            content: `你是一个专业的后端API文档工程师。用户会提供一组需要补充说明的接口/参数/字段信息，你需要根据上下文（接口路径、方法名、参数名、类型等）推断出专业、简洁的中文描述。

输出要求：
1. 返回标准 JSON 格式：{"results": [{"key": "...", "value": "推断的描述"}, ...]}
2. 描述应简洁专业，通常 5-20 个汉字
3. 根据命名惯例推断含义，例如 createTime → 创建时间，userId → 用户ID
4. 不要包含任何额外解释，只返回 JSON`
        },
        {
            role: 'user',
            content: `请为以下 ${placeholders.length} 个占位符推断描述：\n\n${entries.join('\n')}`
        },
    ]
}

// ==================== DB 文档占位符处理 ====================

const DB_PLACEHOLDER_PREFIX = '{{AI_FILL:'
const DB_PLACEHOLDER_SUFFIX = '}}'

function isDbPlaceholderText(text) {
    return text && typeof text === 'string' &&
        text.startsWith(DB_PLACEHOLDER_PREFIX) && text.endsWith(DB_PLACEHOLDER_SUFFIX)
}

export function collectDbDocPlaceholders(schema, getTableComment, getColumnComment) {
    const items = []
    if (!schema) return items

    for (const table of schema.tables) {
        const tableComment = getTableComment(table)

        if (isDbPlaceholderText(tableComment)) {
            items.push({
                type: 'table_comment',
                key: `${table.name}:__TABLE__`,
                context: { tableName: table.name },
                currentValue: tableComment,
                tableName: table.name,
            })
        }

        const cols = schema.columns.filter(c => c.table_name === table.name)
        for (const col of cols) {
            const colComment = getColumnComment(col)
            if (isDbPlaceholderText(colComment)) {
                items.push({
                    type: 'column_comment',
                    key: `${col.table_name}:${col.name}`,
                    context: {
                        tableName: col.table_name,
                        columnName: col.name,
                        columnType: col.full_type,
                        isPrimaryKey: col.is_primary_key,
                        isNullable: col.is_nullable,
                        defaultValue: col.default_value,
                    },
                    currentValue: colComment,
                    tableName: col.table_name,
                    columnName: col.name,
                })
            }
        }
    }

    return items
}

export function buildDbDocPrompt(placeholders) {
    const entries = placeholders.map((p, i) => {
        const ctx = p.context
        if (p.type === 'table_comment') {
            return `#${i + 1} [表注释] key="${p.key}" | 表名: ${ctx.tableName}`
        } else {
            let desc = `#${i + 1} [列注释] key="${p.key}" | 表: ${ctx.tableName} | 列: ${ctx.columnName} (${ctx.columnType})`
            if (ctx.isPrimaryKey) desc += ' [主键]'
            if (ctx.defaultValue) desc += ` 默认值=${ctx.defaultValue}`
            return desc
        }
    })

    return [
        {
            role: 'system',
            content: `你是一个专业的数据库文档工程师。用户会提供一组数据库表和字段信息，你需要根据表名、字段名、字段类型等上下文推断出专业、简洁的中文注释。

输出要求：
1. 返回标准 JSON 格式：{"results": [{"key": "...", "value": "推断的注释"}, ...]}
2. 表注释：简洁说明表的用途，通常 4-10 个汉字，如 "用户信息表"、"订单记录表"
3. 列注释：简洁说明字段含义，通常 2-10 个汉字，如 "创建时间"、"用户ID"、"是否删除"
4. 根据命名惯例推断：create_time → 创建时间, is_deleted → 是否删除, user_name → 用户名
5. 不要包含任何额外解释，只返回 JSON`
        },
        {
            role: 'user',
            content: `请为以下 ${placeholders.length} 个占位符推断注释：\n\n${entries.join('\n')}`
        },
    ]
}

// ==================== 结果解析与回填 ====================

/**
 * 从 LLM 响应中提取 JSON（兼容 markdown 代码块包裹）
 */
function extractJsonFromResponse(text) {
    if (!text || typeof text !== 'string') return null
    let cleaned = text.trim()

    // 去掉 markdown 代码块包裹：```json ... ``` 或 ``` ... ```
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim()
    }

    try {
        return JSON.parse(cleaned)
    } catch (e) {
        // 尝试找到第一个 { 和最后一个 } 之间的内容
        const start = cleaned.indexOf('{')
        const end = cleaned.lastIndexOf('}')
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(cleaned.substring(start, end + 1))
            } catch (e2) {
                // ignore
            }
        }
        console.error('JSON 提取失败:', cleaned.substring(0, 300))
        return null
    }
}

export function applyApiDocResults(responseText, placeholders) {
    const parsed = extractJsonFromResponse(responseText)
    if (!parsed) {
        console.error('API Doc LLM 返回无法解析为 JSON:', responseText?.substring(0, 300))
        return { filled: 0, total: placeholders.length }
    }
    const results = parsed.results || []

    const resultMap = new Map()
    for (const r of results) {
        if (r.key && r.value) resultMap.set(r.key, r.value)
    }

    let filled = 0
    for (const p of placeholders) {
        const value = resultMap.get(p.key)
        if (value) {
            p.ref[p.field] = value
            filled++
        }
    }

    return { filled, total: placeholders.length }
}

export function applyDbDocResults(responseText, placeholders, schema, commentOverrides) {
    const parsed = extractJsonFromResponse(responseText)
    if (!parsed) {
        console.error('DB Doc LLM 返回无法解析为 JSON:', responseText?.substring(0, 300))
        return { filled: 0, total: placeholders.length, newOverrides: commentOverrides }
    }
    const results = parsed.results || []

    const resultMap = new Map()
    for (const r of results) {
        if (r.key && r.value) resultMap.set(r.key, r.value)
    }

    let filled = 0
    const newOverrides = { ...commentOverrides }

    for (const p of placeholders) {
        const value = resultMap.get(p.key)
        if (!value) continue

        filled++
        newOverrides[p.key] = value

        if (p.type === 'table_comment') {
            const table = schema.tables.find(t => t.name === p.tableName)
            if (table) table.comment = value
        } else if (p.type === 'column_comment') {
            const col = schema.columns.find(c => c.table_name === p.tableName && c.name === p.columnName)
            if (col) col.comment = value
        }
    }

    return { filled, total: placeholders.length, newOverrides }
}

// ==================== 批量处理 ====================

const BATCH_SIZE = 50

/**
 * 创建 AI 处理控制器（暂停/继续/取消）
 */
export function createAiController() {
    let _resolveResume = null
    return {
        paused: false,
        cancelled: false,
        pause() {
            this.paused = true
        },
        resume() {
            this.paused = false
            if (_resolveResume) { _resolveResume(); _resolveResume = null }
        },
        cancel() {
            this.cancelled = true
            if (_resolveResume) { _resolveResume(); _resolveResume = null }
        },
        async waitIfPaused() {
            if (!this.paused) return
            await new Promise(resolve => { _resolveResume = resolve })
        },
    }
}

/**
 * 将占位符按模块/表名分批，单组超过 BATCH_SIZE 则子分批
 */
function groupByModule(placeholders) {
    const groups = new Map()
    for (const p of placeholders) {
        const key = p.moduleName || p.tableName || '__default__'
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(p)
    }
    const batches = []
    for (const [name, items] of groups) {
        if (items.length <= BATCH_SIZE) {
            batches.push({ name, items })
        } else {
            for (let i = 0; i < items.length; i += BATCH_SIZE) {
                const chunk = items.slice(i, i + BATCH_SIZE)
                batches.push({ name: `${name} (${Math.floor(i / BATCH_SIZE) + 1})`, items: chunk })
            }
        }
    }
    return batches
}

/**
 * API 文档占位符批量 AI 填充
 * @param {function} onLog - 日志回调 (message, level)
 * @param {function} onBatchDone - 每批完成回调 (batchName, filled, batchTotal)
 * @param {object} controller - createAiController() 返回的控制器
 */
export async function fillApiDocPlaceholders(config, parseResult, onLog = () => { }, onBatchDone = () => { }, controller = null) {
    const allPlaceholders = collectApiDocPlaceholders(parseResult)
    if (allPlaceholders.length === 0) return { filled: 0, total: 0 }

    const batches = groupByModule(allPlaceholders)
    onLog(`📋 发现 ${allPlaceholders.length} 个占位符，${batches.length} 个批次`, 'info')

    let totalFilled = 0
    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
        if (controller?.cancelled) { onLog(`⛔ 已取消`, 'warn'); break }
        if (controller?.paused) {
            onLog(`⏸ 已暂停...`, 'info')
            await controller.waitIfPaused()
            if (controller?.cancelled) break
            onLog(`▶ 已恢复`, 'info')
        }
        const batch = batches[bIdx]
        onLog(`🔄 [${bIdx + 1}/${batches.length}] ${batch.name} (${batch.items.length} 项)`, 'info')
        try {
            const messages = buildApiDocPrompt(batch.items)
            const responseText = await callLlm(config, messages, { maxTokens: 4096 })
            const { filled } = applyApiDocResults(responseText, batch.items)
            totalFilled += filled
            onLog(`✅ [${bIdx + 1}/${batches.length}] ${batch.name} → ${filled}/${batch.items.length} 已填充`, 'success')
            onBatchDone(batch.name, filled, batch.items.length)
        } catch (e) {
            onLog(`❌ [${bIdx + 1}/${batches.length}] ${batch.name} 失败: ${e.message}`, 'error')
        }
    }
    onLog(`🎉 完成: ${totalFilled}/${allPlaceholders.length} 个字段已填充`, 'info')
    return { filled: totalFilled, total: allPlaceholders.length }
}

/**
 * 数据库文档占位符批量 AI 填充
 */
export async function fillDbDocPlaceholders(config, schema, getTableComment, getColumnComment, commentOverrides, onLog = () => { }, onBatchDone = () => { }, controller = null) {
    const allPlaceholders = collectDbDocPlaceholders(schema, getTableComment, getColumnComment)
    if (allPlaceholders.length === 0) return { filled: 0, total: 0, newOverrides: commentOverrides }

    const batches = groupByModule(allPlaceholders)
    onLog(`📋 发现 ${allPlaceholders.length} 个占位符，${batches.length} 个批次`, 'info')

    let totalFilled = 0
    let currentOverrides = { ...commentOverrides }
    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
        if (controller?.cancelled) { onLog(`⛔ 已取消`, 'warn'); break }
        if (controller?.paused) {
            onLog(`⏸ 已暂停...`, 'info')
            await controller.waitIfPaused()
            if (controller?.cancelled) break
            onLog(`▶ 已恢复`, 'info')
        }
        const batch = batches[bIdx]
        onLog(`🔄 [${bIdx + 1}/${batches.length}] ${batch.name} (${batch.items.length} 项)`, 'info')
        try {
            const messages = buildDbDocPrompt(batch.items)
            const responseText = await callLlm(config, messages, { maxTokens: 4096 })
            const { filled, newOverrides } = applyDbDocResults(responseText, batch.items, schema, currentOverrides)
            totalFilled += filled
            currentOverrides = newOverrides
            onLog(`✅ [${bIdx + 1}/${batches.length}] ${batch.name} → ${filled}/${batch.items.length} 已填充`, 'success')
            onBatchDone(batch.name, filled, batch.items.length)
        } catch (e) {
            onLog(`❌ [${bIdx + 1}/${batches.length}] ${batch.name} 失败: ${e.message}`, 'error')
        }
    }
    onLog(`🎉 完成: ${totalFilled}/${allPlaceholders.length} 个注释已填充`, 'info')
    return { filled: totalFilled, total: allPlaceholders.length, newOverrides: currentOverrides }
}

