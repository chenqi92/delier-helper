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
        models: [
            { id: 'gpt-5', label: 'GPT-5', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true }, contextLength: 128000 },
            { id: 'gpt-5-mini', label: 'GPT-5 Mini', capabilities: { multimodal: true, codeGen: true, functionCall: true }, contextLength: 128000 },
            { id: 'gpt-4.1', label: 'GPT-4.1', capabilities: { multimodal: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1048576 },
            { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', capabilities: { multimodal: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1048576 },
            { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', capabilities: { codeGen: true, longContext: true }, contextLength: 1048576 },
            { id: 'o3', label: 'o3', capabilities: { deepThinking: true, codeGen: true, functionCall: true }, contextLength: 200000 },
            { id: 'o4-mini', label: 'o4 Mini', capabilities: { deepThinking: true, multimodal: true, codeGen: true, functionCall: true }, contextLength: 200000 },
        ],
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        models: [
            { id: 'deepseek-chat', label: 'DeepSeek V3.2', capabilities: { codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'deepseek-reasoner', label: 'DeepSeek R1', capabilities: { deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
        ],
    },
    {
        id: 'qwen',
        label: '通义千问 (Qwen)',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: [
            { id: 'qwen3-max', label: 'Qwen3 Max', capabilities: { deepThinking: true, codeGen: true, functionCall: true }, contextLength: 131072 },
            { id: 'qwen3.5-plus', label: 'Qwen3.5 Plus', capabilities: { multimodal: true, codeGen: true, functionCall: true }, contextLength: 131072 },
            { id: 'qwen3-coder-plus', label: 'Qwen3 Coder Plus', capabilities: { codeGen: true, functionCall: true }, contextLength: 131072 },
            { id: 'qwen-max-latest', label: 'Qwen Max', capabilities: { codeGen: true, functionCall: true }, contextLength: 32768 },
            { id: 'qwen-plus-latest', label: 'Qwen Plus', capabilities: { codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'qwen-turbo-latest', label: 'Qwen Turbo', capabilities: { longContext: true }, contextLength: 1000000 },
            { id: 'qwen3-235b-a22b', label: 'Qwen3 235B', capabilities: { deepThinking: true, codeGen: true }, contextLength: 131072 },
            { id: 'qwq-32b', label: 'QwQ 32B', capabilities: { deepThinking: true }, contextLength: 131072 },
            { id: 'qwen-long', label: 'Qwen Long', capabilities: { longContext: true }, contextLength: 10000000 },
        ],
    },
    {
        id: 'zhipu',
        label: '智谱 (GLM)',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: [
            { id: 'glm-5', label: 'GLM-5', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true }, contextLength: 32768 },
            { id: 'glm-4-plus', label: 'GLM-4 Plus', capabilities: { multimodal: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 128000 },
            { id: 'glm-4-long', label: 'GLM-4 Long', capabilities: { longContext: true }, contextLength: 1000000 },
            { id: 'glm-4-flash', label: 'GLM-4 Flash', capabilities: { functionCall: true, longContext: true }, contextLength: 128000 },
            { id: 'glm-4-flashx', label: 'GLM-4 FlashX', capabilities: { functionCall: true, longContext: true }, contextLength: 128000 },
            { id: 'glm-z1-air', label: 'GLM Z1 Air', capabilities: { deepThinking: true }, contextLength: 32768 },
            { id: 'glm-z1-flash', label: 'GLM Z1 Flash', capabilities: { deepThinking: true }, contextLength: 32768 },
        ],
    },
    {
        id: 'moonshot',
        label: '月之暗面 (Kimi)',
        baseUrl: 'https://api.moonshot.cn/v1',
        models: [
            { id: 'kimi-k2.5', label: 'Kimi K2.5', capabilities: { multimodal: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 262144 },
            { id: 'kimi-k2.5-thinking', label: 'Kimi K2.5 Thinking', capabilities: { deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 262144 },
            { id: 'moonshot-v1-128k', label: 'Moonshot 128K (旧)', capabilities: { longContext: true }, contextLength: 131072 },
        ],
    },
    {
        id: 'baichuan',
        label: '百川智能',
        baseUrl: 'https://api.baichuan-ai.com/v1',
        models: [
            { id: 'Baichuan4-Turbo', label: 'Baichuan4 Turbo', capabilities: { codeGen: true, functionCall: true }, contextLength: 32768 },
            { id: 'Baichuan4', label: 'Baichuan 4', capabilities: { codeGen: true }, contextLength: 32768 },
            { id: 'Baichuan3-Turbo-128k', label: 'Baichuan 3 128K', capabilities: { longContext: true }, contextLength: 131072 },
        ],
    },
    {
        id: 'doubao',
        label: '豆包 (字节)',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        models: [
            { id: 'doubao-seed-1-8', label: '豆包 Seed 1.8', capabilities: { deepThinking: true, multimodal: true, codeGen: true, functionCall: true }, contextLength: 131072 },
            { id: 'doubao-1-5-thinking-pro', label: '豆包 1.5 思考 Pro', capabilities: { deepThinking: true, multimodal: true, codeGen: true }, contextLength: 131072 },
            { id: 'doubao-pro-32k', label: '豆包 Pro 32K', capabilities: { codeGen: true, functionCall: true }, contextLength: 32768 },
            { id: 'doubao-pro-128k', label: '豆包 Pro 128K', capabilities: { codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'doubao-lite-32k', label: '豆包 Lite 32K', capabilities: {}, contextLength: 32768 },
        ],
    },
    {
        id: 'spark',
        label: '讯飞星火',
        baseUrl: 'https://spark-api-open.xf-yun.com/v1',
        models: [
            { id: '4.0Ultra', label: '星火 4.0 Ultra', capabilities: { codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'spark-x1', label: '星火 X1', capabilities: { deepThinking: true, codeGen: true }, contextLength: 131072 },
            { id: 'spark-max-32k', label: '星火 Max 32K', capabilities: { codeGen: true }, contextLength: 32768 },
            { id: 'spark-pro-128k', label: '星火 Pro 128K', capabilities: { longContext: true }, contextLength: 131072 },
            { id: 'spark-lite', label: '星火 Lite (免费)', capabilities: {}, contextLength: 8192 },
        ],
    },
    {
        id: 'claude',
        label: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com/v1',
        note: 'OpenAI 兼容请用代理；最新模型 ID 以官方文档为准，或点「检测模型」拉取',
        models: [
            { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1000000 },
            { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true }, contextLength: 200000 },
            { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', capabilities: { multimodal: true, codeGen: true, functionCall: true }, contextLength: 200000 },
        ],
    },
    {
        id: 'gemini',
        label: 'Google (Gemini)',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        models: [
            { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1048576 },
            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1048576 },
            { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', capabilities: { multimodal: true, longContext: true }, contextLength: 1048576 },
        ],
    },
    {
        id: 'xiaomimimo',
        label: '小米 MiMo',
        baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
        note: '兼容 OpenAI；Anthropic 兼容路径为 /anthropic。建议用「检测模型」拉取当前账户实际可用列表。',
        models: [
            { id: 'MiMo-V2.5-Pro', label: 'MiMo V2.5 Pro', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'MiMo-V2.5', label: 'MiMo V2.5', capabilities: { multimodal: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'MiMo-V2-Pro', label: 'MiMo V2 Pro', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true }, contextLength: 131072 },
            { id: 'MiMo-V2-Omni', label: 'MiMo V2 Omni', capabilities: { multimodal: true, codeGen: true, functionCall: true }, contextLength: 131072 },
            { id: 'MiMo-V2.5-TTS', label: 'MiMo V2.5 TTS', capabilities: {}, contextLength: 8192 },
            { id: 'MiMo-V2.5-TTS-VoiceClone', label: 'MiMo V2.5 TTS 声音克隆', capabilities: {}, contextLength: 8192 },
            { id: 'MiMo-V2.5-TTS-VoiceDesign', label: 'MiMo V2.5 TTS 声音设计', capabilities: {}, contextLength: 8192 },
            { id: 'MiMo-V2-TTS', label: 'MiMo V2 TTS', capabilities: {}, contextLength: 8192 },
        ],
    },
    {
        id: 'nvidia',
        label: 'NVIDIA NIM',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        note: 'NVIDIA 托管 100+ 模型（Llama / Nemotron / DeepSeek / Mistral / Qwen 等），强烈建议点「检测模型」获取完整最新列表',
        models: [
            { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', capabilities: { codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'meta/llama-3.1-405b-instruct', label: 'Llama 3.1 405B', capabilities: { codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Nemotron 70B', capabilities: { codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'nvidia/nemotron-4-340b-instruct', label: 'Nemotron 4 340B', capabilities: { codeGen: true, functionCall: true }, contextLength: 4096 },
            { id: 'deepseek-ai/deepseek-r1', label: 'DeepSeek R1', capabilities: { deepThinking: true, codeGen: true, longContext: true }, contextLength: 131072 },
            { id: 'mistralai/mistral-large-2-instruct', label: 'Mistral Large 2', capabilities: { codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'qwen/qwen2.5-coder-32b-instruct', label: 'Qwen2.5 Coder 32B', capabilities: { codeGen: true, longContext: true }, contextLength: 131072 },
            { id: 'google/gemma-2-27b-it', label: 'Gemma 2 27B', capabilities: { codeGen: true }, contextLength: 8192 },
        ],
    },
    {
        id: 'siliconflow',
        label: 'SiliconFlow',
        baseUrl: 'https://api.siliconflow.cn/v1',
        models: [
            { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3', capabilities: { codeGen: true, functionCall: true }, contextLength: 65536 },
            { id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1', capabilities: { deepThinking: true, codeGen: true }, contextLength: 65536 },
            { id: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3 235B', capabilities: { deepThinking: true, codeGen: true }, contextLength: 131072 },
            { id: 'Qwen/QwQ-32B', label: 'QwQ 32B', capabilities: { deepThinking: true }, contextLength: 32768 },
        ],
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        models: [
            { id: 'openai/gpt-5', label: 'GPT-5', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true }, contextLength: 128000 },
            { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true }, contextLength: 200000 },
            { id: 'anthropic/claude-opus-4.7', label: 'Claude Opus 4.7', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1000000 },
            { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1048576 },
            { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3', capabilities: { codeGen: true, functionCall: true }, contextLength: 65536 },
        ],
    },
    {
        id: 'ollama',
        label: 'Ollama (本地)',
        baseUrl: 'http://localhost:11434/v1',
        local: true,
        apiKeyRequired: false,
        modelsApi: '/api/tags',
        models: [],
    },
    {
        id: 'lmstudio',
        label: 'LM Studio (本地)',
        baseUrl: 'http://localhost:1234/v1',
        local: true,
        apiKeyRequired: false,
        modelsApi: '/v1/models',
        models: [],
    },
    {
        id: 'vllm',
        label: 'vLLM (本地)',
        baseUrl: 'http://localhost:8000/v1',
        local: true,
        apiKeyRequired: false,
        modelsApi: '/v1/models',
        models: [],
    },
    {
        id: 'custom',
        label: '自定义 / 其他兼容',
        baseUrl: '',
        apiKeyRequired: false,
        models: [],
    },
]

// ==================== 厂商级配置持久化 ====================

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
export function nextId() {
    return `cfg_${Date.now()}_${++_configId}`
}

/**
 * 厂商配置数据结构:
 * {
 *   id: string,
 *   providerId: string,     // LLM_PROVIDERS 中的 id
 *   label: string,          // 自定义显示名
 *   baseUrl: string,
 *   apiKey: string,
 *   models: ModelDef[],     // 该厂商下的可用模型列表
 *   activeModelId: string,  // 默认选中的模型
 * }
 *
 * ModelDef:
 * { id: string, label: string, capabilities: { multimodal?: bool, deepThinking?: bool }, contextLength: number, custom?: bool }
 */

/**
 * 加载所有厂商配置
 */
export async function loadProviderConfigs() {
    try {
        const store = await getStore()
        const providers = await store.get('providerConfigs')
        if (Array.isArray(providers) && providers.length > 0) {
            providers.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
            return providers
        }

        // === 兼容旧数据迁移 ===
        const oldConfigs = await store.get('configs')
        if (Array.isArray(oldConfigs) && oldConfigs.length > 0) {
            // 按 providerId + apiKey 分组合并
            const grouped = new Map()
            for (const cfg of oldConfigs) {
                const key = `${cfg.providerId}__${cfg.apiKey}`
                if (!grouped.has(key)) {
                    const providerDef = LLM_PROVIDERS.find(p => p.id === cfg.providerId)
                    grouped.set(key, {
                        id: nextId(),
                        providerId: cfg.providerId,
                        label: cfg.name || (providerDef ? providerDef.label : cfg.providerId),
                        baseUrl: cfg.baseUrl,
                        apiKey: cfg.apiKey,
                        models: providerDef ? providerDef.models.map(m => ({ ...m })) : [],
                        activeModelId: cfg.model,
                    })
                }
            }
            const migrated = Array.from(grouped.values())
            await store.set('providerConfigs', migrated)
            if (migrated.length > 0) {
                await store.set('activeProviderId', migrated[0].id)
                await store.set('activeModelId', migrated[0].activeModelId || (migrated[0].models[0]?.id || ''))
            }
            await store.save()
            return migrated
        }
    } catch (e) {
        console.warn('加载 LLM 配置失败:', e)
    }
    return []
}

/**
 * 保存所有厂商配置
 */
export async function saveProviderConfigs(providers) {
    try {
        const store = await getStore()
        await store.set('providerConfigs', providers)
        await store.save()
    } catch (e) {
        console.warn('保存 LLM 配置失败:', e)
    }
}

/**
 * 添加或更新厂商配置
 */
export async function upsertProviderConfig(providerCfg) {
    const providers = await loadProviderConfigs()
    const idx = providers.findIndex(p => p.id === providerCfg.id)
    if (idx >= 0) {
        providers[idx] = { ...providers[idx], ...providerCfg }
    } else {
        providerCfg.id = providerCfg.id || nextId()
        providers.push(providerCfg)
    }
    await saveProviderConfigs(providers)
    return providerCfg
}

/**
 * 删除厂商配置
 */
export async function deleteProviderConfig(id) {
    let providers = await loadProviderConfigs()
    providers = providers.filter(p => p.id !== id)
    await saveProviderConfigs(providers)
    return providers
}

/**
 * 加载/保存全局选中状态（厂商 + 模型）
 */
export async function loadActiveSelection() {
    try {
        const store = await getStore()
        const providerId = await store.get('activeProviderId') || null
        const modelId = await store.get('activeModelId') || null
        return { providerId, modelId }
    } catch (e) {
        return { providerId: null, modelId: null }
    }
}

export async function saveActiveSelection(providerId, modelId) {
    try {
        const store = await getStore()
        await store.set('activeProviderId', providerId)
        await store.set('activeModelId', modelId)
        await store.save()
    } catch (e) {
        console.warn('保存激活选择失败:', e)
    }
}

/**
 * 从厂商配置 + 模型 ID 构建可调用的 config 对象
 * 供 callLlm / fillApiDocPlaceholders 等使用
 */
export function getResolvedConfig(providerCfg, modelId) {
    if (!providerCfg) return null
    const resolvedModelId = modelId || providerCfg.activeModelId || (providerCfg.models[0]?.id || '')
    const modelObj = providerCfg.models.find(m => m.id === resolvedModelId)
    return {
        providerId: providerCfg.providerId,
        baseUrl: providerCfg.baseUrl,
        apiKey: providerCfg.apiKey,
        model: resolvedModelId,
        maxOutputTokens: modelObj?.maxOutputTokens || 0,
    }
}

/**
 * 获取厂商默认模型列表（从 LLM_PROVIDERS）
 */
export function getDefaultModels(providerId) {
    const p = LLM_PROVIDERS.find(p => p.id === providerId)
    return p ? p.models.map(m => ({ ...m })) : []
}

/**
 * 从模型 ID/名称推断能力标签
 * 在 API 未提供 capabilities 字段时作为启发式补充
 */
function inferCapabilitiesFromId(modelId, caps = {}) {
    const lower = (modelId || '').toLowerCase()

    // ===== 深度思考 =====
    if (/\b(r1|o[134]|qwq|thinking|reasoner|reason)\b/.test(lower)) {
        caps.deepThinking = true
    }

    // ===== 代码生成 =====
    if (/\b(code|coder|codestral|starcoder|codellama|deepcoder|devstral)\b/.test(lower)) {
        caps.codeGen = true
    }
    // 通用强模型默认具备代码能力
    if (/\b(gpt-[45]|claude|gemini-2|deepseek-(v3|chat)|qwen3?-\d+b)\b/.test(lower)) {
        caps.codeGen = true
    }

    // ===== 多模态 =====
    if (/\b(vision|vl|visual|mm|multimodal|image|pixtral|llava|minicpm-v)\b/.test(lower)) {
        caps.multimodal = true
    }

    // ===== 函数调用 =====
    if (/\b(gpt-[345]|claude|gemini|qwen[23]|mistral-large|command-r)\b/.test(lower) && !caps.deepThinking) {
        caps.functionCall = true
    }

    return caps
}

/**
 * 自动检测本地 LLM 服务的可用模型列表
 * @param {Object} providerCfg - 包含 providerId, baseUrl, apiKey 的配置
 * @returns {Promise<{success: boolean, models: ModelDef[], message: string}>}
 */
export async function detectModels(providerCfg) {
    const { providerId, baseUrl, apiKey } = providerCfg
    if (!baseUrl) return { success: false, models: [], message: '请先填写 API 地址' }

    const base = baseUrl.replace(/\/+$/, '')
    const preset = LLM_PROVIDERS.find(p => p.id === providerId)

    // Ollama 使用 /api/tags 接口
    const isOllama = providerId === 'ollama' || base.includes(':11434')
    const modelsUrl = isOllama
        ? base.replace(/\/v1$/, '') + '/api/tags'
        : base + '/models'

    try {
        const result = await invoke('llm_get_request', {
            req: { url: modelsUrl, apiKey: apiKey || '' },
        })

        if (!result.success) {
            return { success: false, models: [], message: result.error || `连接失败 (${result.status})` }
        }

        const data = JSON.parse(result.body)
        let models = []

        if (isOllama && Array.isArray(data.models)) {
            // Ollama 格式: { models: [{ name, size, details: { families, ... }, ... }] }
            models = data.models.map(m => {
                const id = m.name || m.model
                const details = m.details || {}
                const families = Array.isArray(details.families) ? details.families : []
                const caps = {}
                // Ollama families 中包含 'clip' 或 'llava' 表示多模态
                if (families.some(f => /clip|llava|vision|mllama/i.test(f))) {
                    caps.multimodal = true
                }
                // 从模型名推断能力
                inferCapabilitiesFromId(id, caps)
                return {
                    id,
                    label: id.split(':')[0],
                    capabilities: caps,
                    contextLength: details.context_length || m.context_length || 32768,
                }
            })
        } else if (Array.isArray(data.data)) {
            // OpenAI 兼容格式: { data: [{ id, context_length?, architecture?, ... }] }
            models = data.data.map(m => {
                const caps = {}
                const ctx = m.context_length || m.max_model_len || 32768

                // OpenRouter / 部分平台返回 architecture.modality
                const arch = m.architecture || {}
                const modality = (arch.modality || '').toLowerCase()
                const inputMods = Array.isArray(arch.input_modalities) ? arch.input_modalities : []

                // 多模态检测
                if (modality.includes('image') || inputMods.includes('image') || inputMods.includes('video')) {
                    caps.multimodal = true
                }

                // 从模型 ID 推断更多能力
                inferCapabilitiesFromId(m.id, caps)

                // 长上下文标记
                if (ctx >= 100000) {
                    caps.longContext = true
                }

                return {
                    id: m.id,
                    label: m.id,
                    capabilities: caps,
                    contextLength: ctx,
                }
            })
        } else {
            return { success: false, models: [], message: '无法解析模型列表响应' }
        }

        if (models.length === 0) {
            return { success: false, models: [], message: '服务响应正常但未载入任何模型' }
        }

        return { success: true, models, message: `检测到 ${models.length} 个模型` }
    } catch (e) {
        return { success: false, models: [], message: `检测失败: ${e.message || e}` }
    }
}

// === 兼容旧 API（供未迁移的代码使用）===

/** @deprecated 使用 loadProviderConfigs */
export async function loadAllConfigs() {
    const providers = await loadProviderConfigs()
    // 转换为旧格式
    return providers.map(p => ({
        id: p.id,
        name: p.label,
        providerId: p.providerId,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        model: p.activeModelId || (p.models[0]?.id || ''),
    }))
}

/** @deprecated */
export async function loadActiveConfigId() {
    const { providerId } = await loadActiveSelection()
    return providerId
}

/** @deprecated */
export async function loadLlmConfig() {
    const providers = await loadProviderConfigs()
    if (providers.length === 0) return null
    const { providerId, modelId } = await loadActiveSelection()
    const found = providers.find(p => p.id === providerId)
    const target = found || providers[0]
    return getResolvedConfig(target, modelId)
}

/**
 * 保存完整配置列表
 * @deprecated 使用 saveProviderConfigs
 */
export async function saveAllConfigs(configs) {
    // This function is deprecated and its behavior is not directly mapped to the new provider-level configs.
    // For now, we'll just log a warning. If actual migration logic is needed, it should be added here.
    console.warn('saveAllConfigs is deprecated. Use saveProviderConfigs instead.')
    // A more robust migration would involve trying to update existing provider configs
    // or creating new ones based on the 'configs' array, but that's complex without clear rules.
    // For now, we'll do nothing to avoid data corruption.
}

/**
 * 设置激活的配置 ID
 * @deprecated 使用 saveActiveSelection
 */
export async function setActiveConfigId(id) {
    // This function is deprecated. The new system uses activeProviderId and activeModelId.
    // We can try to infer the providerId from the old config ID if it still exists.
    const providers = await loadProviderConfigs();
    const provider = providers.find(p => p.id === id);
    if (provider) {
        await saveActiveSelection(provider.id, provider.activeModelId || (provider.models[0]?.id || ''));
    } else {
        console.warn(`setActiveConfigId is deprecated. Could not find provider with ID ${id}.`);
    }
}

/**
 * 添加或更新一条配置
 * @deprecated 使用 upsertProviderConfig
 */
export async function upsertConfig(config) {
    console.warn('upsertConfig is deprecated. Use upsertProviderConfig instead.')
    // This would require converting the old config format to a new providerCfg format.
    // For simplicity in this deprecation, we'll just return the original config.
    return config;
}

/**
 * 删除一条配置
 * @deprecated 使用 deleteProviderConfig
 */
export async function deleteConfig(id) {
    console.warn('deleteConfig is deprecated. Use deleteProviderConfig instead.')
    // This would require mapping the old config ID to a provider config ID.
    // For simplicity, we'll just call the new deleteProviderConfig if we can find a match.
    await deleteProviderConfig(id);
    return await loadAllConfigs(); // Return in old format for compatibility
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

// ==================== LLM API 调用 ====================

/**
 * 调用 LLM chat completions API
 * 通过 Rust 后端 invoke 发起请求，绕过前端 fetch 的 header 限制
 * @param {object} config - { baseUrl, apiKey, model, providerId }
 * @param {Array} messages - 消息数组
 * @param {object} options - { temperature, maxTokens, signal }
 */
export async function callLlm(config, messages, options = {}) {
    const { baseUrl, apiKey, model, providerId } = config
    const { temperature = 0.3, maxTokens = 4096, signal } = options

    const base = baseUrl.replace(/\/+$/, '')
    const isGemini = providerId === 'gemini' || base.includes('generativelanguage.googleapis.com')

    const url = `${base}/chat/completions`

    const reqBody = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
    }

    // response_format 仅云端厂商支持，本地部署（Ollama/LM Studio/vLLM）和 Gemini 不支持
    const localIds = ['ollama', 'lmstudio', 'vllm', 'custom']
    const skipJsonFormat = isGemini || localIds.includes(providerId) || !apiKey
    if (!skipJsonFormat) {
        reqBody.response_format = { type: 'json_object' }
    }

    // 通过 Rust 后端发起请求（camelCase 字段名匹配 serde rename_all）
    const invokePromise = invoke('llm_request', {
        req: {
            url,
            apiKey,
            body: JSON.stringify(reqBody),
            isGemini,
        }
    })

    // 支持取消：使用 Promise.race 与 abort 信号竞争
    let result
    if (signal) {
        const abortPromise = new Promise((_, reject) => {
            if (signal.aborted) reject(new DOMException('操作已取消', 'AbortError'))
            signal.addEventListener('abort', () => reject(new DOMException('操作已取消', 'AbortError')), { once: true })
        })
        result = await Promise.race([invokePromise, abortPromise])
    } else {
        result = await invokePromise
    }

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

    const msg = data.choices[0].message || {}
    // 部分模型 (Gemini Pro) 可能返回 content 为 null（使用了 thinking/reasoning 模式）
    // 尝试多种字段获取内容
    let content = msg.content
        || msg.reasoning_content  // DeepSeek R1 等
        || msg.text               // 某些兼容端点
        || null

    if (!content) {
        // 最后尝试从原始 body 中提取可用文本
        console.warn('LLM content 为空, 完整响应:', result.body.substring(0, 500))
        throw new Error('LLM 返回了空内容，该模型可能不完全兼容 OpenAI Chat API。建议换用 gemini-2.5-flash')
    }

    // 当设置了 response_format: json_object 时，模型可能将内容包裹为 {"content": "..."} 的 JSON
    // 自动检测并提取内部文本
    if (typeof content === 'string' && content.trimStart().startsWith('{')) {
        try {
            const parsed = JSON.parse(content)
            if (parsed.content && typeof parsed.content === 'string') {
                content = parsed.content
            }
        } catch (_) {
            // 不是 JSON，保持原样
        }
    }

    return content
}

/**
 * 测试 LLM 连接
 */
export async function testLlmConnection(config) {
    try {
        const result = await callLlm(config, [
            { role: 'user', content: '请回复一个JSON: {"status":"ok"}' },
        ], { maxTokens: 64 })
        const parsed = extractJsonFromResponse(result)
        if (parsed) {
            return { success: true, message: '连接成功', raw: parsed }
        }
        // 即使 JSON 解析失败，只要有返回就算连接成功
        return { success: true, message: '连接成功（响应非标准 JSON）' }
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

// ==================== API 示例值 AI 填充 ====================

/**
 * 收集需要 AI 填充示例值的接口
 */
function collectApiExampleItems(parseResult) {
    const items = []
    if (!parseResult || !parseResult.modules) return items

    for (const mod of parseResult.modules) {
        for (const api of mod.apis) {
            // 请求体示例
            if (api.requestBody && api.requestBody.example) {
                items.push({
                    key: `${mod.className}.${api.methodName}.requestExample`,
                    type: 'request_example',
                    method: api.method,
                    path: api.path,
                    summary: api.summary,
                    fields: api.requestBody.fields.map(f => ({ name: f.name, type: f.type, description: f.description || '' })),
                    ref: api.requestBody,
                    moduleName: mod.name,
                })
            }
            // 返回示例
            if (api.response && api.response.example) {
                items.push({
                    key: `${mod.className}.${api.methodName}.responseExample`,
                    type: 'response_example',
                    method: api.method,
                    path: api.path,
                    summary: api.summary,
                    fields: api.response.fields.map(f => ({ name: f.name, type: f.type, description: f.description || '' })),
                    ref: api.response,
                    moduleName: mod.name,
                })
            }
        }
    }
    return items
}

/**
 * 构建示例值 AI 填充 prompt
 */
function buildApiExamplePrompt(exampleItems) {
    const entries = exampleItems.map((item, i) => {
        const fieldsDesc = item.fields.slice(0, 20).map(f => {
            let s = `  - ${f.name}: ${f.type}`
            if (f.description) s += ` (说明: ${f.description})`
            return s
        }).join('\n')
        return `#${i + 1} key="${item.key}" | ${item.method} ${item.path} | ${item.summary}\n字段:\n${fieldsDesc}`
    })

    return [
        {
            role: 'system',
            content: `你是一个专业的后端API文档工程师。用户会提供接口的字段信息，你需要根据接口的功能、路径、字段名称和类型，生成真实可信的 JSON 示例值。

要求：
1. 返回 JSON：{"results": [{"key": "...", "value": {示例JSON对象}}, ...]}
2. value 是一个完整的 JSON 对象（不是字符串），字段名和类型必须与提供的字段一致
3. String 类型填充真实可信的示例值（如姓名用"张三"、邮箱用"zhangsan@example.com"、日期用"2026-01-15 10:30:00"）
4. 数字类型填充合理的示例值（如 id 用 1001、金额用 99.50、年龄用 28）
5. Boolean 填 true 或 false
6. 如果字段是数组类型，返回包含 1-2 个元素的数组
7. 不要包含任何额外解释，只返回 JSON`
        },
        {
            role: 'user',
            content: `请为以下 ${exampleItems.length} 个接口生成真实可信的示例 JSON：\n\n${entries.join('\n\n')}`
        },
    ]
}

/**
 * 应用 AI 生成的示例值
 */
function applyApiExampleResults(responseText, exampleItems) {
    const parsed = extractJsonFromResponse(responseText)
    if (!parsed) return { filled: 0, total: exampleItems.length }
    const results = parsed.results || []

    const resultMap = new Map()
    for (const r of results) {
        if (r.key && r.value != null) resultMap.set(r.key, r.value)
    }

    let filled = 0
    for (const item of exampleItems) {
        const value = resultMap.get(item.key)
        if (value && typeof value === 'object') {
            item.ref.example = value
            filled++
        }
    }
    return { filled, total: exampleItems.length }
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

    // 去掉可能的前后多余内容，只保留 JSON 对象
    const firstBrace = cleaned.indexOf('{')
    if (firstBrace > 0) {
        cleaned = cleaned.substring(firstBrace)
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

        // 尝试修复截断的 JSON（LLM 输出被 maxTokens 截断）
        if (start >= 0) {
            let truncated = cleaned.substring(start)
            // 去掉最后不完整的字符串值
            truncated = truncated.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '')
            truncated = truncated.replace(/,\s*"[^"]*$/, '')
            // 补全缺少的闭合括号
            const opens = (truncated.match(/[{\[]/g) || []).length
            const closes = (truncated.match(/[}\]]/g) || []).length
            const missing = opens - closes
            for (let i = 0; i < missing; i++) {
                // 根据最后一个开括号类型补全
                const lastOpen = truncated.lastIndexOf('[')
                const lastObj = truncated.lastIndexOf('{')
                truncated += lastOpen > lastObj ? ']' : '}'
            }
            try {
                return JSON.parse(truncated)
            } catch (e3) {
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
 * 内含 AbortController，cancel 时同时中断正在进行的 HTTP 请求
 */
export function createAiController() {
    const ac = new AbortController()
    let _resolveResume = null
    return {
        paused: false,
        cancelled: false,
        signal: ac.signal,
        pause() {
            this.paused = true
        },
        resume() {
            this.paused = false
            if (_resolveResume) { _resolveResume(); _resolveResume = null }
        },
        cancel() {
            this.cancelled = true
            ac.abort()
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
    onLog(`[信息] 发现 ${allPlaceholders.length} 个占位符，${batches.length} 个批次`, 'info')

    let totalFilled = 0
    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
        if (controller?.cancelled) { onLog(`[取消] 已取消`, 'warn'); break }
        if (controller?.paused) {
            onLog(`⏸ 已暂停...`, 'info')
            await controller.waitIfPaused()
            if (controller?.cancelled) break
            onLog(`▶ 已恢复`, 'info')
        }
        const batch = batches[bIdx]
        onLog(`[进行] [${bIdx + 1}/${batches.length}] ${batch.name} (${batch.items.length} 项)`, 'info')
        try {
            const messages = buildApiDocPrompt(batch.items)
            const responseText = await callLlm(config, messages, { maxTokens: 4096, signal: controller?.signal })
            const { filled } = applyApiDocResults(responseText, batch.items)
            totalFilled += filled
            onLog(`[完成] [${bIdx + 1}/${batches.length}] ${batch.name} → ${filled}/${batch.items.length} 已填充`, 'success')
            onBatchDone(batch.name, filled, batch.items.length)
        } catch (e) {
            if (e.name === 'AbortError') { onLog(`[取消] 用户取消了生成`, 'warn'); break }
            onLog(`[失败] [${bIdx + 1}/${batches.length}] ${batch.name} 失败: ${e.message}`, 'error')
        }
    }
    onLog(`[完成] 描述填充完成: ${totalFilled}/${allPlaceholders.length} 个字段`, 'info')

    // ===== 第二阶段：AI 填充示例值 =====
    if (controller?.cancelled) return { filled: totalFilled, total: allPlaceholders.length }

    const exampleItems = collectApiExampleItems(parseResult)
    if (exampleItems.length > 0) {
        onLog(`[信息] 开始填充示例值，共 ${exampleItems.length} 个接口`, 'info')
        const exBatches = []
        for (let i = 0; i < exampleItems.length; i += 10) {
            exBatches.push(exampleItems.slice(i, i + 10))
        }
        for (let bIdx = 0; bIdx < exBatches.length; bIdx++) {
            if (controller?.cancelled) break
            if (controller?.paused) {
                await controller.waitIfPaused()
                if (controller?.cancelled) break
            }
            const batch = exBatches[bIdx]
            onLog(`[进行] 示例值 [${bIdx + 1}/${exBatches.length}] (${batch.length} 个接口)`, 'info')
            try {
                const messages = buildApiExamplePrompt(batch)
                const responseText = await callLlm(config, messages, { maxTokens: 8192, signal: controller?.signal })
                const { filled: exFilled } = applyApiExampleResults(responseText, batch)
                onLog(`[完成] 示例值 [${bIdx + 1}/${exBatches.length}] → ${exFilled}/${batch.length} 已填充`, 'success')
            } catch (e) {
                if (e.name === 'AbortError') { onLog(`[取消] 用户取消了生成`, 'warn'); break }
                onLog(`[失败] 示例值 [${bIdx + 1}/${exBatches.length}] 失败: ${e.message}`, 'error')
            }
        }
    }

    onLog(`[完成] AI 填充全部完成`, 'info')
    return { filled: totalFilled, total: allPlaceholders.length }
}

/**
 * 数据库文档占位符批量 AI 填充
 */
export async function fillDbDocPlaceholders(config, schema, getTableComment, getColumnComment, commentOverrides, onLog = () => { }, onBatchDone = () => { }, controller = null) {
    const allPlaceholders = collectDbDocPlaceholders(schema, getTableComment, getColumnComment)
    if (allPlaceholders.length === 0) return { filled: 0, total: 0, newOverrides: commentOverrides }

    const batches = groupByModule(allPlaceholders)
    onLog(`[信息] 发现 ${allPlaceholders.length} 个占位符，${batches.length} 个批次`, 'info')

    let totalFilled = 0
    let currentOverrides = { ...commentOverrides }
    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
        if (controller?.cancelled) { onLog(`[取消] 已取消`, 'warn'); break }
        if (controller?.paused) {
            onLog(`⏸ 已暂停...`, 'info')
            await controller.waitIfPaused()
            if (controller?.cancelled) break
            onLog(`▶ 已恢复`, 'info')
        }
        const batch = batches[bIdx]
        onLog(`[进行] [${bIdx + 1}/${batches.length}] ${batch.name} (${batch.items.length} 项)`, 'info')
        try {
            const messages = buildDbDocPrompt(batch.items)
            const responseText = await callLlm(config, messages, { maxTokens: 4096, signal: controller?.signal })
            const { filled, newOverrides } = applyDbDocResults(responseText, batch.items, schema, currentOverrides)
            totalFilled += filled
            currentOverrides = newOverrides
            onLog(`[完成] [${bIdx + 1}/${batches.length}] ${batch.name} → ${filled}/${batch.items.length} 已填充`, 'success')
            onBatchDone(batch.name, filled, batch.items.length)
        } catch (e) {
            if (e.name === 'AbortError') { onLog(`[取消] 用户取消了生成`, 'warn'); break }
            onLog(`[失败] [${bIdx + 1}/${batches.length}] ${batch.name} 失败: ${e.message}`, 'error')
        }
    }
    onLog(`🎉 完成: ${totalFilled}/${allPlaceholders.length} 个注释已填充`, 'info')
    return { filled: totalFilled, total: allPlaceholders.length, newOverrides: currentOverrides }
}

