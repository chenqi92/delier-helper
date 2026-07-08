/**
 * LLM 大模型服务模块
 * 统一封装大模型 API 调用，占位符收集，Prompt 构建，结果回填
 */
import { invoke } from '@tauri-apps/api/core'
import { load } from '@tauri-apps/plugin-store'

// ==================== 模型提供商预设 ====================

export const LLM_PROVIDERS = [
    {
        id: 'ranzhu-cloud',
        label: '云端账号',
        baseUrl: '',
        apiKeyRequired: false,
        cloudManaged: true,
        note: '通过服务端统一调度模型和额度，不会在客户端保存上游模型 API Key。',
        models: [],
    },
    {
        id: 'openai',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: [
            { id: 'gpt-5.5', label: 'GPT-5.5', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1048576, maxOutputTokens: 131072 },
            { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', capabilities: { multimodal: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1048576 },
            { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', capabilities: { multimodal: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1048576 },
            { id: 'gpt-5-codex', label: 'GPT-5 Codex', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1048576 },
            { id: 'gpt-5', label: 'GPT-5', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true }, contextLength: 400000, maxOutputTokens: 131072 },
            { id: 'gpt-5-mini', label: 'GPT-5 Mini', capabilities: { multimodal: true, codeGen: true, functionCall: true }, contextLength: 400000, maxOutputTokens: 131072 },
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
        note: '支持官方 Anthropic Messages API；OpenAI 兼容代理仍可用自定义厂商接入，最新模型 ID 以官方文档或「检测模型」为准',
        models: [
            { id: 'claude-fable-5', label: 'Claude Fable 5', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1000000, maxOutputTokens: 131072 },
            { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1000000, maxOutputTokens: 131072 },
            { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 1000000 },
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
        apiKeyPlaceholder: 'tp-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        note: '⚠ API Key 必须以 tp- 开头，从控制台复制时不要丢前缀（否则报 401 Invalid API Key）。模型 ID 是小写格式，控制台展示的 CamelCase 仅作显示。兼容 OpenAI；Anthropic 兼容路径为 /anthropic。',
        models: [
            { id: 'mimo-v2.5-pro', label: 'MiMo V2.5 Pro', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'mimo-v2.5', label: 'MiMo V2.5', capabilities: { multimodal: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'mimo-v2-pro', label: 'MiMo V2 Pro', capabilities: { multimodal: true, deepThinking: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'mimo-v2-omni', label: 'MiMo V2 Omni', capabilities: { multimodal: true, codeGen: true, functionCall: true, longContext: true }, contextLength: 131072 },
            { id: 'mimo-v2.5-tts', label: 'MiMo V2.5 TTS', capabilities: {}, contextLength: 8192 },
            { id: 'mimo-v2.5-tts-voiceclone', label: 'MiMo V2.5 TTS 声音克隆', capabilities: {}, contextLength: 8192 },
            { id: 'mimo-v2.5-tts-voicedesign', label: 'MiMo V2.5 TTS 声音设计', capabilities: {}, contextLength: 8192 },
            { id: 'mimo-v2-tts', label: 'MiMo V2 TTS', capabilities: {}, contextLength: 8192 },
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
const CLOUD_PROVIDER_ID = 'cloud_default'

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

export async function loadCloudAccount() {
    try {
        const store = await getStore()
        return await store.get('cloudAccount') || null
    } catch {
        return null
    }
}

export async function saveCloudAccount(account) {
    const store = await getStore()
    await store.set('cloudAccount', account)
    await store.save()
}

export async function clearCloudAccount() {
    const store = await getStore()
    await store.delete('cloudAccount')
    await store.save()
}

export async function getCloudClientId() {
    const store = await getStore()
    let id = await store.get('cloudClientId')
    if (!id) {
        id = `cli_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`
        await store.set('cloudClientId', id)
        await store.save()
    }
    return id
}

export function normalizeCloudServiceUrl(value) {
    const raw = (value || '').trim().replace(/\/+$/, '')
    if (!raw) return ''
    return raw.replace(/\/v1$/, '')
}

function getUrlPathname(value) {
    try {
        return new URL(value).pathname.replace(/\/+$/, '')
    } catch {
        return value.replace(/^https?:\/\/[^/]+/i, '').replace(/\/+$/, '')
    }
}

function shouldAppendV1ForCustom(providerId, baseUrl) {
    if (providerId !== 'custom') return false
    if (!/^https?:\/\//i.test(baseUrl)) return false
    const path = getUrlPathname(baseUrl)
    if (!path || path === '/') return true
    return !/(^|\/)(v\d+(?:beta)?|api\/v\d+|compatible-mode\/v\d+|openai)$/i.test(path)
}

function normalizeOpenAiCompatibleBaseUrl(baseUrl, providerId) {
    const base = (baseUrl || '').trim().replace(/\/+$/, '')
    if (!base) return ''
    return shouldAppendV1ForCustom(providerId, base) ? `${base}/v1` : base
}

const LLM_PROTOCOLS = {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
}

function isAnthropicCompatibleEndpoint(providerId, baseUrl) {
    if (providerId === 'claude') return true
    const raw = (baseUrl || '').trim()
    if (!raw) return false
    try {
        const url = new URL(raw)
        const host = url.hostname.toLowerCase()
        const path = url.pathname.toLowerCase()
        return host === 'api.anthropic.com'
            || host.endsWith('.anthropic.com')
            || /(^|\/)anthropic(\/|$)/.test(path)
    } catch {
        return /(^|\/)anthropic(\/|$)/i.test(raw)
    }
}

function getLlmProtocol(providerId, baseUrl) {
    return isAnthropicCompatibleEndpoint(providerId, baseUrl)
        ? LLM_PROTOCOLS.ANTHROPIC
        : LLM_PROTOCOLS.OPENAI
}

function normalizeAnthropicBaseUrl(baseUrl) {
    let base = (baseUrl || '').trim().replace(/\/+$/, '')
    if (!base) return ''
    base = base.replace(/\/messages$/i, '').replace(/\/v1\/messages$/i, '/v1')

    try {
        const url = new URL(base)
        const host = url.hostname.toLowerCase()
        const path = url.pathname.replace(/\/+$/, '')
        if ((host === 'api.anthropic.com' || host.endsWith('.anthropic.com')) && (!path || path === '/')) {
            url.pathname = '/v1'
            return url.toString().replace(/\/+$/, '')
        }
    } catch {
        // ignore URL parse failures; custom local endpoints can still be valid for reqwest
    }
    return base
}

function normalizeLlmBaseUrl(baseUrl, providerId) {
    const protocol = getLlmProtocol(providerId, baseUrl)
    return protocol === LLM_PROTOCOLS.ANTHROPIC
        ? normalizeAnthropicBaseUrl(baseUrl)
        : normalizeOpenAiCompatibleBaseUrl(baseUrl, providerId)
}

function responsePreview(body, limit = 200) {
    return String(body || '')
        .replace(/\s+/g, ' ')
        .slice(0, limit)
}

function parseJsonBody(body, label = '响应') {
    const raw = String(body || '')
    if (!raw.trim()) throw new Error(`${label}为空`)
    try {
        return JSON.parse(raw)
    } catch (e) {
        const preview = responsePreview(raw)
        if (/�|[\u0000-\u0008\u000e-\u001f]/.test(preview)) {
            throw new Error(`${label}不是可解析 JSON，可能是压缩响应未解码或接口地址不兼容: ${preview}`)
        }
        throw new Error(`${label}不是有效 JSON: ${e.message}. ${preview}`)
    }
}

function parseHttpErrorMessage(result) {
    const raw = result?.error || result?.body || `HTTP ${result?.status || 0}`
    const bodyText = String(raw).replace(/^HTTP \d+:\s*/, '')
    try {
        const body = JSON.parse(bodyText)
        if (typeof body.error === 'string') return body.error
        return body.error?.message
            || body.error?.type
            || body.message
            || raw
    } catch {
        return raw
    }
}

function isModelUnsupportedError(message) {
    const text = String(message || '').toLowerCase()
    return /当前\s*api\s*不支持所选模型|不支持.*模型|模型.*不支持|unsupported.*model|model.*unsupported|model_not_found|model.*not.*found|model.*not.*available|invalid.*model|does not exist/.test(text)
}

function isModelTemporarilyUnavailableError(message) {
    const text = String(message || '').toLowerCase()
    return isModelUnsupportedError(text)
        || /负载.*(上限|过高|繁忙)|达到.*上限|稍后重试|overloaded|temporarily unavailable|currently unavailable|rate[_ -]?limit|too many requests|quota|capacity|busy/.test(text)
}

function isChatModelCandidate(modelId) {
    const id = String(modelId || '').toLowerCase()
    return !!id && !/tts|voice|embedding|rerank|moderation|whisper|image|dall|sora|realtime|audio|transcribe/.test(id)
}

function friendlyModelUnsupportedMessage(message, config = {}) {
    const model = config.model || '当前模型'
    const protocol = config.isAnthropic ? 'Anthropic Messages' : 'OpenAI Chat Completions'
    const parts = [
        `当前 API 返回模型不可用：${message || model}。`,
        `这通常表示模型列表接口虽然展示了 ${model}，但当前账号、路由或接口协议不能实际调用它。`,
        `本次请求使用的是 ${protocol} 协议。`,
    ]
    if (!config.isAnthropic && /^claude-/i.test(model)) {
        parts.push('如果供应商要求 Claude 走 Anthropic 兼容接口，请改用带 Anthropic 路由的 Base URL；否则请换成该 OpenAI 兼容接口实际支持的模型。')
    } else {
        parts.push('请换成该 API 实际支持的模型，或确认供应商套餐与模型权限。')
    }
    return parts.join('')
}

export class CloudApiError extends Error {
    constructor(message, options = {}) {
        super(message)
        this.name = 'CloudApiError'
        this.status = options.status || 0
        this.code = options.code || ''
        this.details = options.details || null
        this.response = options.response || null
    }
}

async function cloudPost(serviceUrl, path, body, apiKey = '', clientId = '') {
    const base = normalizeCloudServiceUrl(serviceUrl)
    const result = await invoke('llm_request', {
        req: {
            url: `${base}${path}`,
            apiKey,
            body: JSON.stringify(body || {}),
            isGemini: false,
            clientId,
        },
    })
    if (!result.success) {
        throw createCloudError(result)
    }
    return parseJsonBody(result.body || '{}', '云端响应')
}

async function cloudGet(serviceUrl, path, apiKey = '', clientId = '') {
    const base = normalizeCloudServiceUrl(serviceUrl)
    const result = await invoke('llm_get_request', {
        req: {
            url: `${base}${path}`,
            apiKey,
            clientId,
        },
    })
    if (!result.success) {
        throw createCloudError(result)
    }
    return parseJsonBody(result.body || '{}', '云端响应')
}

function createCloudError(result) {
    const raw = result.error || result.body || `HTTP ${result.status || 0}`
    const text = String(raw).replace(/^HTTP \d+:\s*/, '')
    try {
        const body = JSON.parse(text)
        const error = body.error || body
        return new CloudApiError(error.message || error.code || raw, {
            status: result.status,
            code: error.code || '',
            details: error.details || null,
            response: body,
        })
    } catch {
        return new CloudApiError(raw, { status: result.status })
    }
}

function nowSec() {
    return Math.floor(Date.now() / 1000)
}

export async function createCloudLoginSession(serviceUrl) {
    const clientId = await getCloudClientId()
    const data = await cloudPost(serviceUrl, '/auth/wechat/session?client=desktop', {})
    return { ...data, clientId, serviceUrl: normalizeCloudServiceUrl(serviceUrl) }
}

async function saveCloudSession(serviceUrl, data, clientId) {
    const account = {
        serviceUrl: normalizeCloudServiceUrl(serviceUrl),
        clientId,
        user: data.user,
        accessToken: data.accessToken || data.token,
        token: data.accessToken || data.token,
        expiresAt: data.expiresAt || (nowSec() + (data.expiresIn || 1800)),
        refreshToken: data.refreshToken,
        refreshExpiresAt: data.refreshExpiresAt || (nowSec() + (data.refreshExpiresIn || 2592000)),
        sessionId: data.sessionId,
        updatedAt: Date.now(),
    }
    await saveCloudAccount(account)
    return account
}

export async function pollCloudLoginSession(serviceUrl, sessionId, pollToken) {
    const clientId = await getCloudClientId()
    const path = `/auth/wechat/session/${encodeURIComponent(sessionId)}?pollToken=${encodeURIComponent(pollToken)}&clientId=${encodeURIComponent(clientId)}`
    const data = await cloudGet(serviceUrl, path)
    if (data.status === 'authenticated') {
        const account = await saveCloudSession(serviceUrl, data, clientId)
        return { ...data, account }
    }
    return data
}

export async function loginCloudAccount(serviceUrl, accountName, password, captchaToken = '') {
    const clientId = await getCloudClientId()
    const data = await cloudPost(serviceUrl, '/auth/login', {
        account: accountName,
        password,
        captchaToken,
        clientId,
        clientName: 'desktop',
    })
    const account = await saveCloudSession(serviceUrl, data, clientId)
    await updateCloudProviderToken(account)
    return { ...data, account }
}

// 兼容旧账号注册参数与新的邮箱验证码注册参数。
// 新格式：{ email, code, password, nickname, captchaToken }。
export async function registerCloudAccount(serviceUrl, accountOrPayload, password = '', nickname = '') {
    const clientId = await getCloudClientId()
    const payload = accountOrPayload && typeof accountOrPayload === 'object'
        ? {
            email: accountOrPayload.email,
            code: accountOrPayload.code,
            password: accountOrPayload.password,
            nickname: accountOrPayload.nickname || '',
            captchaToken: accountOrPayload.captchaToken || '',
        }
        : {
            account: accountOrPayload,
            password,
            nickname,
        }
    const data = await cloudPost(serviceUrl, '/auth/register', {
        ...payload,
        clientId,
        clientName: 'desktop',
    })
    const account = await saveCloudSession(serviceUrl, data, clientId)
    await updateCloudProviderToken(account)
    return { ...data, account }
}

// scene: 'register' | 'login'，用于后台区分注册/登录场景的邮箱验证码。
// captchaToken: Cloudflare Turnstile 令牌，用于防止刷账号 / 刷邮件。
// TODO(后台接口文档): 校对 /auth/email/code 的路径与字段名（email/scene/captchaToken）。
export async function sendCloudEmailCode(serviceUrl, email, captchaToken = '', scene = 'login') {
    return await cloudPost(serviceUrl, '/auth/email/code', { email, scene, captchaToken })
}

// 拉取云端公开配置（Turnstile sitekey 等）。接口不存在/失败时静默返回空对象，
// 客户端据此在“未配置 sitekey”时降级为不强制人机验证。
// TODO(后台接口文档): 校对公开配置接口路径与返回字段（turnstileSiteKey）。
export async function fetchCloudConfig(serviceUrl) {
    try {
        return (await cloudGet(serviceUrl, '/config')) || {}
    } catch {
        return {}
    }
}

export async function loginCloudEmailCode(serviceUrl, email, code) {
    const clientId = await getCloudClientId()
    const data = await cloudPost(serviceUrl, '/auth/email/login', {
        email,
        code,
        clientId,
        clientName: 'desktop',
    })
    const account = await saveCloudSession(serviceUrl, data, clientId)
    await updateCloudProviderToken(account)
    return { ...data, account }
}

export async function refreshCloudAccount(force = false) {
    const account = await loadCloudAccount()
    if (!account?.serviceUrl || !account?.refreshToken || !account?.clientId) return null
    if (!force && account.expiresAt && account.expiresAt > nowSec() + 120) return account
    const data = await cloudPost(account.serviceUrl, '/auth/refresh', {
        refreshToken: account.refreshToken,
        clientId: account.clientId,
    })
    const next = {
        ...account,
        user: data.user || account.user,
        accessToken: data.accessToken || data.token,
        token: data.accessToken || data.token,
        expiresAt: data.expiresAt || (nowSec() + (data.expiresIn || 1800)),
        refreshToken: data.refreshToken,
        refreshExpiresAt: data.refreshExpiresAt || (nowSec() + (data.refreshExpiresIn || 2592000)),
        sessionId: data.sessionId || account.sessionId,
        updatedAt: Date.now(),
    }
    await saveCloudAccount(next)
    await updateCloudProviderToken(next)
    return next
}

export async function ensureCloudAccessToken(force = false) {
    return await refreshCloudAccount(force)
}

export async function logoutCloudAccount() {
    const account = await loadCloudAccount()
    if (account?.serviceUrl && account?.refreshToken) {
        try {
            await cloudPost(account.serviceUrl, '/auth/logout', { refreshToken: account.refreshToken }, account.accessToken || account.token || '', account.clientId || '')
        } catch {
            // 本地仍然清理登录态
        }
    }
    await clearCloudAccount()
    const providers = await loadProviderConfigs()
    const target = providers.find(p => p.id === CLOUD_PROVIDER_ID)
    if (target) {
        target.apiKey = ''
        target.models = []
        target.activeModelId = ''
        await saveProviderConfigs(providers)
    }
}

export async function syncCloudProvider(serviceUrl) {
    let account = await loadCloudAccount()
    if (!account) throw new Error('请先登录云端账号')
    account = await ensureCloudAccessToken()
    const data = await cloudGet(serviceUrl || account.serviceUrl, '/v1/models', account.accessToken || account.token || '', account.clientId || '')
    const detectedModels = Array.isArray(data.data) ? data.data.map(m => ({
        id: m.id,
        label: m.id,
        capabilities: {},
        contextLength: m.context_length || m.contextLength || inferContextLengthFromId(m.id) || 32768,
        isDefault: !!(m.default || m.isDefault),
        ...(m.max_output_tokens || m.maxOutputTokens ? { maxOutputTokens: m.max_output_tokens || m.maxOutputTokens } : {}),
    })) : []
    const models = detectedModels.some(m => m.isDefault) ? detectedModels : promotePreferredDefaultModel(detectedModels)
    const activeModelId = models.find(m => m.isDefault)?.id || models[0]?.id || ''
    const provider = {
        id: CLOUD_PROVIDER_ID,
        providerId: 'ranzhu-cloud',
        label: '云端账号',
        baseUrl: `${normalizeCloudServiceUrl(serviceUrl || account.serviceUrl)}/v1`,
        apiKey: account.accessToken || account.token || '',
        cloudManaged: true,
        clientId: account.clientId || '',
        models,
        activeModelId,
        sortOrder: -100,
    }
    await upsertProviderConfig(provider)
    if (activeModelId) await saveActiveSelection(provider.id, activeModelId)
    return provider
}

export async function checkinCloudAccount() {
    const account = await ensureCloudAccessToken()
    if (!account) throw new Error('请先登录云端账号')
    const data = await cloudPost(account.serviceUrl, '/checkin', {}, account.accessToken || account.token || '', account.clientId || '')
    const next = {
        ...account,
        user: {
            ...(account.user || {}),
            creditBalance: data.balance ?? account.user?.creditBalance,
        },
        updatedAt: Date.now(),
    }
    await saveCloudAccount(next)
    return data
}

async function updateCloudProviderToken(account) {
    const providers = await loadProviderConfigs()
    const target = providers.find(p => p.id === CLOUD_PROVIDER_ID || p.cloudManaged)
    if (!target) return
    target.apiKey = account.accessToken || account.token || ''
    target.clientId = account.clientId || ''
    target.baseUrl = `${normalizeCloudServiceUrl(account.serviceUrl)}/v1`
    await saveProviderConfigs(providers)
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
        providerConfigId: providerCfg.id,
        baseUrl: normalizeLlmBaseUrl(providerCfg.baseUrl, providerCfg.providerId),
        apiKey: providerCfg.apiKey,
        cloudManaged: !!providerCfg.cloudManaged || providerCfg.providerId === 'ranzhu-cloud',
        clientId: providerCfg.clientId || '',
        model: resolvedModelId,
        fallbackModels: (providerCfg.models || [])
            .map(m => m.id)
            .filter(id => id !== resolvedModelId && isChatModelCandidate(id)),
        maxOutputTokens: modelObj?.maxOutputTokens || 0,
    }
}

/**
 * 获取厂商默认模型列表（从 LLM_PROVIDERS）
 */
export function getDefaultModels(providerId) {
    const p = LLM_PROVIDERS.find(p => p.id === providerId)
    return p ? promotePreferredDefaultModel(p.models.map(m => ({ ...m }))) : []
}

/**
 * 从模型 ID/名称推断能力标签
 * 在 API 未提供 capabilities 字段时作为启发式补充
 */
function inferCapabilitiesFromId(modelId, caps = {}) {
    const lower = (modelId || '').toLowerCase()

    // TTS 类模型只做语音合成，不参与 chat completion 推理，能力标签留空
    if (/tts|voiceclone|voicedesign|voice-clone|voice-design/.test(lower)) {
        return caps
    }

    // ===== 深度思考 =====
    if (/\b(r1|o[134]|qwq|thinking|reasoner|reason)\b/.test(lower)) {
        caps.deepThinking = true
    }
    // MiMo Pro 系列含深度思考
    if (/mimo.*-pro/.test(lower)) {
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
    // Llama 3.1/3.2/3.3、Nemotron、Mistral Large、MiMo 等也具备较强代码能力
    if (/llama-?3\.[123]|nemotron|mistral-large|mistral-nemo|mimo-v2/.test(lower)) {
        caps.codeGen = true
    }

    // ===== 多模态 =====
    if (/\b(vision|vl|visual|mm|multimodal|image|pixtral|llava|minicpm-v|omni)\b/.test(lower)) {
        caps.multimodal = true
    }
    // MiMo Pro / Omni 多模态
    if (/mimo-v2(\.5)?(-pro|-omni)?(\b|$)/.test(lower) && !/tts/.test(lower)) {
        caps.multimodal = true
    }

    // ===== 函数调用 =====
    if (/\b(gpt-[345]|claude|gemini|qwen[23]|mistral-large|command-r)\b/.test(lower) && !caps.deepThinking) {
        caps.functionCall = true
    }
    // Llama 3.1+ / Nemotron / MiMo 支持 function calling
    if (/llama-?3\.[123]|nemotron|mimo-v2/.test(lower) && !/tts/.test(lower)) {
        caps.functionCall = true
    }

    // ===== 长上下文（128K+ 模型默认带标记） =====
    if (/llama-?3\.[123]|nemotron|mimo-v2|qwen2\.5|deepseek-(r1|v3|chat)|mistral-large-2|phi-3\.5/.test(lower)) {
        caps.longContext = true
    }

    return caps
}

/**
 * 从模型 ID 推断上下文长度
 * 在 API 未提供 context_length 字段时（如 NVIDIA NIM、SiliconFlow 等）作为智能默认值
 * 返回 0 表示无法推断，由调用方走最终 fallback
 */
function inferContextLengthFromId(modelId) {
    const id = (modelId || '').toLowerCase()

    // ===== 1M 级别 =====
    if (/gpt-5\.[45]|gpt-5.*codex/.test(id)) return 1000000
    if (/gpt-5/.test(id)) return 400000
    if (/gpt-4\.1/.test(id)) return 1000000
    if (/gemini-(2\.5|3)/.test(id)) return 1048576
    if (/qwen.*-long/.test(id) || /qwen-turbo/.test(id)) return 1000000
    if (/glm-4-long/.test(id)) return 1000000

    // ===== 200K 级别 =====
    if (/claude/.test(id) && /(fable-5|sonnet-5|opus-4-[78]|opus.*4\.[78]|opus-4\.[78])/.test(id)) return 1000000
    if (/claude/.test(id)) return 200000
    if (/o[134]\b|o4-mini/.test(id)) return 200000

    // ===== 128K-131K 级别 =====
    if (/llama-?3\.[123]/.test(id)) return 131072
    if (/nemotron/.test(id)) return 131072
    if (/qwen3|qwen2\.5/.test(id)) return 131072
    if (/deepseek.*(r1|v3|chat|reasoner)/.test(id)) return 131072
    if (/mistral-large-2|mistral-large.*2/.test(id)) return 131072
    if (/mixtral.*8x22/.test(id)) return 65536
    if (/phi-3\.5/.test(id)) return 131072
    if (/yi-1\.5.*-32k|yi.*-200k/.test(id)) return 200000
    if (/glm-4(-plus|-flash|-flashx)?(\b|$)/.test(id)) return 131072
    if (/moonshot.*128k|kimi-?k2/.test(id)) return 131072
    if (/doubao.*(pro|seed|1-5|1-6|128k)/.test(id)) return 131072
    if (/spark-pro|spark.*ultra|4\.0ultra/.test(id)) return 131072
    if (/baichuan.*128k|baichuan4/.test(id)) return 131072
    // MiMo V2 / V2.5 (非 TTS) → 128K
    if (/^mimo-v2/.test(id) && !/tts/.test(id)) return 131072
    // MiMo TTS → 8K（语音合成上下文较短）
    if (/^mimo-.*tts/.test(id)) return 8192

    // ===== 64K 级别 =====
    if (/deepseek.*coder/.test(id)) return 65536
    if (/qwen.*coder/.test(id)) return 65536

    // ===== 32K 级别 =====
    if (/llama-?3(\b|-)|llama-?3-instruct/.test(id)) return 8192
    if (/mistral-small|mistral-7b|mistral-nemo/.test(id)) return 32768
    if (/qwen|qwq/.test(id)) return 32768
    if (/codestral/.test(id)) return 32768

    // ===== 16K 以下 =====
    if (/gemma-2/.test(id)) return 8192
    if (/gemma(\b|-)/.test(id)) return 8192
    if (/llama-?2/.test(id)) return 4096
    if (/phi-3(\b|-)/.test(id)) return 4096
    if (/spark-lite/.test(id)) return 8192

    return 0
}

function buildModelEndpointCandidates(base, providerId, isOllama) {
    const candidates = []
    const push = (url, normalizedBaseUrl = base) => {
        if (!candidates.some(item => item.url === url)) {
            candidates.push({ url, normalizedBaseUrl })
        }
    }

    if (isOllama) {
        push(`${base.replace(/\/v1$/, '')}/api/tags`, base)
        return candidates
    }

    push(`${base}/models`, base)
    if (shouldAppendV1ForCustom(providerId, base)) {
        push(`${base}/v1/models`, `${base}/v1`)
    }
    return candidates
}

function buildAnthropicModelEndpointCandidates(base) {
    const candidates = []
    const normalized = normalizeAnthropicBaseUrl(base)
    const push = (url, normalizedBaseUrl) => {
        if (!candidates.some(item => item.url === url)) {
            candidates.push({ url, normalizedBaseUrl })
        }
    }
    push(`${normalized}/models`, normalized)
    if (!/\/v1$/i.test(normalized)) {
        push(`${normalized}/v1/models`, `${normalized}/v1`)
    }
    return candidates
}

function readModelArray(data, isOllama) {
    if (isOllama && Array.isArray(data.models)) return data.models
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.models)) return data.models
    if (Array.isArray(data)) return data
    return []
}

function normalizeDetectedModel(raw) {
    const m = typeof raw === 'string' ? { id: raw } : (raw || {})
    const id = m.id || m.name || m.model || m.slug
    if (!id || typeof id !== 'string') return null

    const arch = m.architecture || {}
    const details = m.details || {}
    const topProvider = m.top_provider || m.topProvider || {}
    const ctx = m.context_length
        || m.contextLength
        || details.context_length
        || details.contextLength
        || m.max_model_len
        || m.maxModelLen
        || m.max_context_length
        || m.maxContextLength
        || m.context_window
        || m.contextWindow
        || m.max_input_tokens
        || m.maxInputTokens
        || m.input_token_limit
        || m.inputTokenLimit
        || arch.context_length
        || arch.max_input_tokens
        || topProvider.context_length
        || inferContextLengthFromId(id)
        || 32768

    const caps = m.capabilities && !Array.isArray(m.capabilities)
        ? { ...m.capabilities }
        : {}

    const modality = String(arch.modality || m.modality || '').toLowerCase()
    const families = Array.isArray(details.families)
        ? details.families.map(v => String(v).toLowerCase())
        : []
    const inputMods = [
        ...(Array.isArray(arch.input_modalities) ? arch.input_modalities : []),
        ...(Array.isArray(m.input_modalities) ? m.input_modalities : []),
        ...(Array.isArray(m.inputModalities) ? m.inputModalities : []),
    ].map(v => String(v).toLowerCase())

    if (modality.includes('image')
        || inputMods.includes('image')
        || inputMods.includes('video')
        || families.some(f => /clip|llava|vision|mllama/i.test(f))) {
        caps.multimodal = true
    }
    inferCapabilitiesFromId(id, caps)
    if (ctx >= 100000) caps.longContext = true

    const outputTokens = m.max_output_tokens
        || m.maxOutputTokens
        || m.output_token_limit
        || m.outputTokenLimit
        || topProvider.max_completion_tokens
        || topProvider.maxCompletionTokens

    const model = {
        id,
        label: m.label || m.display_name || m.displayName || m.name || id,
        capabilities: caps,
        contextLength: ctx,
    }
    if (outputTokens) model.maxOutputTokens = outputTokens
    return model
}

function normalizeDetectedModels(data, isOllama) {
    return readModelArray(data, isOllama)
        .map(normalizeDetectedModel)
        .filter(Boolean)
}

export function scoreModelForDefault(model) {
    const id = String(model?.id || '').toLowerCase()
    const label = String(model?.label || '').toLowerCase()
    const text = `${id} ${label}`
    const caps = model?.capabilities || {}
    let score = 0

    if (caps.deepThinking) score += 120
    if (caps.codeGen) score += 80
    if (caps.functionCall) score += 40
    if (caps.multimodal) score += 30
    if ((model?.contextLength || 0) >= 1000000) score += 45
    else if ((model?.contextLength || 0) >= 200000) score += 25
    else if ((model?.contextLength || 0) >= 100000) score += 10

    const strongPatterns = [
        [/gpt-5\.5/, 900],
        [/claude-fable-5/, 880],
        [/claude-opus-4-8/, 850],
        [/gpt-5(\b|[^.\d])/, 820],
        [/claude-sonnet-5/, 800],
        [/gpt-5.*codex|codex.*gpt-5/, 780],
        [/gemini-2\.5-pro/, 720],
        [/claude-opus-4-7/, 700],
        [/claude-opus-4-6/, 680],
        [/claude-sonnet-4-6|claude-sonnet-4-5/, 650],
        [/o[34](\b|-)/, 600],
        [/deepseek.*reasoner|deepseek.*r1/, 560],
        [/deepseek.*chat|deepseek.*v3/, 520],
        [/qwen.*max|qwen.*plus|qwen.*coder/, 480],
    ]
    let strongScore = 0
    for (const [pattern, value] of strongPatterns) {
        if (pattern.test(text)) strongScore = Math.max(strongScore, value)
    }
    score += strongScore

    if (/latest|pro|max|opus|sonnet|reason|thinking|codex/.test(text)) score += 35
    if (/haiku|mini|nano|lite|flash|turbo|instant|preview|tts|embedding|rerank|audio|image|moderation/.test(text)) score -= 180
    if (/3[-.]5|3-5|2024|legacy|deprecated/.test(text)) score -= 90
    if (/tts|voice|embedding|rerank|moderation|whisper|image|dall|sora/.test(text)) score -= 1000

    return score
}

export function promotePreferredDefaultModel(models) {
    if (!Array.isArray(models) || models.length <= 1) return Array.isArray(models) ? models : []
    let bestIdx = 0
    let bestScore = scoreModelForDefault(models[0])
    for (let i = 1; i < models.length; i++) {
        const score = scoreModelForDefault(models[i])
        if (score > bestScore) {
            bestScore = score
            bestIdx = i
        }
    }
    if (bestIdx <= 0) return models
    const next = [...models]
    const [best] = next.splice(bestIdx, 1)
    next.unshift(best)
    return next
}

/**
 * 自动检测本地 LLM 服务的可用模型列表
 * @param {Object} providerCfg - 包含 providerId, baseUrl, apiKey 的配置
 * @returns {Promise<{success: boolean, models: ModelDef[], message: string}>}
 */
export async function detectModels(providerCfg) {
    if (providerCfg.cloudManaged || providerCfg.providerId === 'ranzhu-cloud') {
        const account = await ensureCloudAccessToken()
        if (account) {
            providerCfg.apiKey = account.accessToken || account.token || providerCfg.apiKey
            providerCfg.clientId = account.clientId || providerCfg.clientId
        }
    }
    const { providerId, baseUrl, apiKey, clientId } = providerCfg
    if (!baseUrl) return { success: false, models: [], message: '请先填写 API 地址' }

    const base = baseUrl.replace(/\/+$/, '')

    const isOllama = providerId === 'ollama' || base.includes(':11434')
    const protocol = getLlmProtocol(providerId, base)
    const isAnthropic = protocol === LLM_PROTOCOLS.ANTHROPIC
    const endpoints = isAnthropic
        ? buildAnthropicModelEndpointCandidates(base)
        : buildModelEndpointCandidates(base, providerId, isOllama)
    const failures = []

    for (const endpoint of endpoints) {
        try {
            const result = await invoke('llm_get_request', {
                req: { url: endpoint.url, apiKey: apiKey || '', isAnthropic, clientId: clientId || '' },
            })

            if (!result.success) {
                failures.push({
                    status: result.status,
                    message: result.error || `连接失败 (${result.status})`,
                })
                continue
            }

            const data = parseJsonBody(result.body, '模型列表响应')
            const models = promotePreferredDefaultModel(normalizeDetectedModels(data, isOllama))

            if (models.length === 0) {
                failures.push({ status: result.status, message: '服务响应正常但未载入任何模型' })
                continue
            }

            const pathNote = endpoint.normalizedBaseUrl !== base
                ? `，已自动使用 ${endpoint.normalizedBaseUrl}`
                : ''
            return {
                success: true,
                models,
                baseUrl: endpoint.normalizedBaseUrl,
                message: `检测到 ${models.length} 个模型${pathNote}`,
            }
        } catch (e) {
            failures.push({ status: 0, message: e.message || String(e) })
        }
    }

    const authFailure = failures.find(f => f.status === 401 || f.status === 403)
    const lastFailure = failures[failures.length - 1]
    return {
        success: false,
        models: [],
        message: `检测失败: ${(authFailure || lastFailure)?.message || '无法解析模型列表响应'}`,
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

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const MAX_RETRIES = 2 // 加上首次共最多 3 次
const RETRY_BACKOFF_MS = [800, 2000, 4500]

function isContextLimitError(body, status) {
    if (status !== 400 && status !== 413) return false
    const text = (body || '').toLowerCase()
    return /context length|context_length_exceeded|maximum context|too many tokens|reduce.*messages|input is too long|max_input_tokens|prompt is too long/.test(text)
}

function friendlyContextLimitMessage(body) {
    return [
        '上下文超出模型限制。可尝试：',
        '1) 在「AI 设置」选用更长上下文的模型（Claude 4.7、Gemini 2.5、GLM-4-Long、Qwen-Long 等）',
        '2) 缩小代码库扫描范围或文档生成的章节粒度',
        '3) 减少 system prompt 中的代码摘要长度',
        '',
        `原始错误片段：${(body || '').slice(0, 300)}`,
    ].join('\n')
}

function textFromMessageContent(content) {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
        return content
            .filter(part => part?.type === 'text')
            .map(part => part.text || '')
            .filter(Boolean)
            .join('\n')
    }
    return content == null ? '' : String(content)
}

function parseDataImageUrl(value) {
    const match = String(value || '').match(/^data:(image\/[\w.+-]+);base64,(.+)$/)
    if (!match) return null
    return { mediaType: match[1], data: match[2] }
}

function toAnthropicContentBlocks(content) {
    if (typeof content === 'string') {
        return content ? [{ type: 'text', text: content }] : [{ type: 'text', text: '' }]
    }
    if (!Array.isArray(content)) {
        return [{ type: 'text', text: content == null ? '' : String(content) }]
    }

    const blocks = []
    for (const part of content) {
        if (!part) continue
        if (part.type === 'text') {
            blocks.push({ type: 'text', text: part.text || '' })
            continue
        }
        if (part.type === 'image_url') {
            const image = parseDataImageUrl(part.image_url?.url || part.url)
            if (image) {
                blocks.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: image.mediaType,
                        data: image.data,
                    },
                })
            }
        }
    }
    return blocks.length ? blocks : [{ type: 'text', text: '' }]
}

function mergeAdjacentAnthropicMessages(messages) {
    const merged = []
    for (const msg of messages) {
        const last = merged[merged.length - 1]
        if (last && last.role === msg.role) {
            last.content = [...last.content, ...msg.content]
        } else {
            merged.push({ ...msg, content: [...msg.content] })
        }
    }
    return merged
}

function buildAnthropicRequestBody(model, messages, { maxTokens }) {
    const systemParts = []
    const anthMessages = []

    for (const msg of messages || []) {
        if (msg.role === 'system') {
            const text = textFromMessageContent(msg.content)
            if (text) systemParts.push(text)
            continue
        }
        if (msg.role !== 'user' && msg.role !== 'assistant') continue
        anthMessages.push({
            role: msg.role,
            content: toAnthropicContentBlocks(msg.content),
        })
    }

    const body = {
        model,
        max_tokens: maxTokens,
        messages: mergeAdjacentAnthropicMessages(anthMessages),
    }
    if (systemParts.length) body.system = systemParts.join('\n\n')
    return body
}

function buildOpenAiRequestBody(model, messages, { temperature, maxTokens, jsonMode, providerId, apiKey, isGemini, deepThinking }) {
    const reqBody = {
        model,
        messages,
        temperature,
    }
    if (Number(maxTokens) > 0) reqBody.max_tokens = maxTokens

    const localIds = ['ollama', 'lmstudio', 'vllm', 'custom']
    const skipJsonFormat = !jsonMode || isGemini || localIds.includes(providerId) || !apiKey
    if (!skipJsonFormat) {
        reqBody.response_format = { type: 'json_object' }
    }

    if (deepThinking) {
        const modelId = String(model || '')
        if (providerId === 'openai' && (modelId.startsWith('o') || modelId.includes('/o'))) {
            reqBody.reasoning_effort = 'high'
        } else {
            reqBody.enable_thinking = true
        }
    }

    return reqBody
}

function toResponsesContent(content) {
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return String(content || '')

    const parts = []
    for (const part of content) {
        if (!part) continue
        if (typeof part === 'string') {
            parts.push({ type: 'input_text', text: part })
            continue
        }
        if (part.type === 'text') {
            parts.push({ type: 'input_text', text: part.text || '' })
            continue
        }
        if (part.type === 'image_url') {
            const imageUrl = part.image_url?.url || part.url || ''
            if (imageUrl) parts.push({ type: 'input_image', image_url: imageUrl })
        }
    }
    return parts.length ? parts : ''
}

function buildOpenAiResponsesRequestBody(model, messages, { temperature, maxTokens, jsonMode, providerId, apiKey, deepThinking }) {
    const input = (messages || [])
        .filter(msg => ['system', 'developer', 'user', 'assistant'].includes(msg.role))
        .map(msg => ({
            role: msg.role,
            content: toResponsesContent(msg.content),
        }))

    const reqBody = {
        model,
        input,
    }
    if (Number(maxTokens) > 0) reqBody.max_output_tokens = Math.max(16, maxTokens)

    if (temperature !== undefined && temperature !== null) reqBody.temperature = temperature

    const localIds = ['ollama', 'lmstudio', 'vllm', 'custom']
    const skipJsonFormat = !jsonMode || localIds.includes(providerId) || !apiKey
    if (!skipJsonFormat) {
        reqBody.text = { format: { type: 'json_object' } }
    }

    if (deepThinking) {
        reqBody.reasoning = { effort: 'high' }
    }

    return reqBody
}

function getResponsesText(data) {
    if (typeof data?.output_text === 'string') return data.output_text
    if (typeof data?.text === 'string') return data.text
    if (typeof data?.response === 'string') return data.response
    if (typeof data?.result === 'string') return data.result
    if (typeof data?.message?.content === 'string') return data.message.content
    if (Array.isArray(data?.choices)) {
        const choice = data.choices[0] || {}
        const msg = choice.message || {}
        if (typeof msg.content === 'string') return msg.content
        if (typeof choice.text === 'string') return choice.text
    }
    const chunks = []
    if (Array.isArray(data?.content)) {
        for (const part of data.content) {
            if (typeof part === 'string') chunks.push(part)
            if (part?.text) chunks.push(part.text)
            if (part?.content) chunks.push(part.content)
        }
    }
    for (const item of data?.output || []) {
        if (typeof item === 'string') {
            chunks.push(item)
            continue
        }
        if (item?.text) chunks.push(item.text)
        if (item?.content && typeof item.content === 'string') chunks.push(item.content)
        if (item?.type !== 'message' || !Array.isArray(item.content)) continue
        for (const part of item.content) {
            if (typeof part === 'string') chunks.push(part)
            if (part?.type === 'output_text' && part.text) chunks.push(part.text)
            if (part?.type === 'text' && part.text) chunks.push(part.text)
            if (part?.type === 'refusal' && part.refusal) chunks.push(part.refusal)
            if (part?.content) chunks.push(part.content)
        }
    }
    return chunks.join('\n')
}

function shouldTryOpenAiResponsesFallback(message, { model, providerId, isGemini }) {
    if (isGemini || ['ollama', 'lmstudio', 'vllm'].includes(providerId)) return false
    const modelId = String(model || '').toLowerCase()
    if (!/(^|[/_-])(gpt-5|o[1-9]|codex)/.test(modelId)) return false
    const text = String(message || '').toLowerCase()
    return isModelUnsupportedError(text)
        || /responses?\s*api|use\s+responses|not\s+compatible.*chat|chat.*not.*supported|max_tokens.*not.*compatible/.test(text)
}

function shouldTryAnthropicMessagesFallback(message, { model, providerId, isGemini }) {
    if (isGemini || ['ollama', 'lmstudio', 'vllm'].includes(providerId)) return false
    if (!/^claude-/i.test(String(model || ''))) return false
    const text = String(message || '').toLowerCase()
    return isModelUnsupportedError(text)
        || /messages?\s*api|anthropic|not\s+compatible.*chat|chat.*not.*supported/.test(text)
}

function isAnthropicOneMillionContextError(message) {
    const text = String(message || '').toLowerCase()
    return /(1m|1\s*m|100w|100万|百万|million).*(context|上下文)|启用.*(1m|100w|100万|百万|million)/.test(text)
}

function getAnthropicTextAndThinking(data) {
    const blocks = Array.isArray(data.content) ? data.content : []
    const text = []
    const thinking = []
    for (const block of blocks) {
        if (!block) continue
        if (block.type === 'text' && block.text) text.push(block.text)
        if ((block.type === 'thinking' || block.type === 'redacted_thinking') && block.thinking) {
            thinking.push(block.thinking)
        }
    }
    return { content: text.join('\n'), thinking: thinking.join('\n') || null }
}

async function callOpenAiResponsesFallback({ base, apiKey, model, providerId, clientId, messages, maxTokens, temperature, jsonMode, deepThinking, signal }) {
    const url = `${base}/responses`
    const reqBody = buildOpenAiResponsesRequestBody(model, messages, {
        temperature,
        maxTokens,
        jsonMode,
        providerId,
        apiKey,
        deepThinking,
    })

    const invokePromise = invoke('llm_request', {
        req: {
            url,
            apiKey,
            body: JSON.stringify(reqBody),
            isGemini: false,
            isAnthropic: false,
            clientId: clientId || '',
        },
    })

    const result = signal
        ? await Promise.race([
            invokePromise,
            new Promise((_, reject) => {
                signal.addEventListener('abort', () => reject(new DOMException('操作已取消', 'AbortError')), { once: true })
            }),
        ])
        : await invokePromise

    if (!result.success) {
        throw new Error(parseHttpErrorMessage(result) || `Responses API 错误 (${result.status})`)
    }
    if (!result.body || result.body.trim() === '') {
        throw new Error('Responses API 返回空响应')
    }

    const data = parseJsonBody(result.body, 'Responses API 响应')
    const content = getResponsesText(data)
    if (!content) throw new Error('Responses API 返回空结果')

    const promptTokens = data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? 0
    const completionTokens = data.usage?.output_tokens ?? data.usage?.completion_tokens ?? 0
    const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens)

    return {
        content,
        thinking: null,
        usage: { promptTokens, completionTokens, totalTokens },
        model: data.model || model,
    }
}

async function callAnthropicMessagesFallback({ base, apiKey, model, clientId, messages, maxTokens, signal }) {
    const url = `${base}/messages`
    const reqBody = buildAnthropicRequestBody(model, messages, { maxTokens: maxTokens || 8192 })
    const send = async (anthropicBeta = '') => {
        const invokePromise = invoke('llm_request', {
            req: {
                url,
                apiKey,
                body: JSON.stringify(reqBody),
                isGemini: false,
                isAnthropic: true,
                anthropicBeta,
                clientId: clientId || '',
            },
        })
        return signal
            ? Promise.race([
                invokePromise,
                new Promise((_, reject) => {
                    signal.addEventListener('abort', () => reject(new DOMException('操作已取消', 'AbortError')), { once: true })
                }),
            ])
            : invokePromise
    }

    let result = await send()
    if (!result.success) {
        const message = parseHttpErrorMessage(result) || `Anthropic Messages API 错误 (${result.status})`
        if (isAnthropicOneMillionContextError(message)) {
            result = await send('context-1m-2025-08-07')
        }
        if (!result.success) {
            throw new Error(parseHttpErrorMessage(result) || message)
        }
    }
    if (!result.body || result.body.trim() === '') {
        throw new Error('Anthropic Messages API 返回空响应')
    }

    const data = parseJsonBody(result.body, 'Anthropic Messages API 响应')
    const parsed = getAnthropicTextAndThinking(data)
    if (!parsed.content) throw new Error('Anthropic Messages API 返回空结果')

    const promptTokens = data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? 0
    const completionTokens = data.usage?.output_tokens ?? data.usage?.completion_tokens ?? 0
    const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens)

    return {
        content: parsed.content,
        thinking: parsed.thinking,
        usage: { promptTokens, completionTokens, totalTokens },
        model: data.model || model,
    }
}

/**
 * 调用 LLM chat completions API
 * 通过 Rust 后端 invoke 发起请求，绕过前端 fetch 的 header 限制
 * @param {object} config - { baseUrl, apiKey, model, providerId }
 * @param {Array} messages - 消息数组
 * @param {object} options - { temperature, maxTokens, signal, returnMeta, jsonMode }
 *   - returnMeta=true 时返回 { content, usage, model }，否则只返回 content 字符串（保持兼容）
 *   - jsonMode=false 时强制不发送 response_format（用于纯文本输出场景）
 */
async function callSingleLlm(config, messages, options = {}) {
    let { baseUrl, apiKey, model, providerId, clientId } = config
    const {
        temperature = 0.3,
        maxTokens,
        signal,
        returnMeta = false,
        jsonMode = true,
        deepThinking = false,
    } = options

    if (config.cloudManaged || providerId === 'ranzhu-cloud') {
        const account = await ensureCloudAccessToken()
        if (account) {
            apiKey = account.accessToken || account.token || apiKey
            clientId = account.clientId || clientId || ''
            if (account.serviceUrl) baseUrl = `${normalizeCloudServiceUrl(account.serviceUrl)}/v1`
        }
    }

    const protocol = getLlmProtocol(providerId, baseUrl)
    const isAnthropic = protocol === LLM_PROTOCOLS.ANTHROPIC
    const base = normalizeLlmBaseUrl(baseUrl, providerId)
    const isGemini = providerId === 'gemini' || base.includes('generativelanguage.googleapis.com')
    const url = isAnthropic ? `${base}/messages` : `${base}/chat/completions`

    const reqBody = isAnthropic
        ? buildAnthropicRequestBody(model, messages, { maxTokens: maxTokens || config.maxOutputTokens || 8192 })
        : buildOpenAiRequestBody(model, messages, {
            temperature,
            maxTokens,
            jsonMode,
            providerId,
            apiKey,
            isGemini,
            deepThinking,
        })

    let result
    let lastErr
    let anthropicBeta = ''
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (signal?.aborted) throw new DOMException('操作已取消', 'AbortError')

        const invokePromise = invoke('llm_request', {
            req: { url, apiKey, body: JSON.stringify(reqBody), isGemini, isAnthropic, anthropicBeta, clientId: clientId || '' },
        })

        try {
            if (signal) {
                const abortPromise = new Promise((_, reject) => {
                    signal.addEventListener('abort', () => reject(new DOMException('操作已取消', 'AbortError')), { once: true })
                })
                result = await Promise.race([invokePromise, abortPromise])
            } else {
                result = await invokePromise
            }
        } catch (e) {
            if (e?.name === 'AbortError') throw e
            lastErr = e
            if (attempt < MAX_RETRIES) {
                await sleep(RETRY_BACKOFF_MS[attempt], signal)
                continue
            }
            throw new Error(`LLM 调用失败（重试 ${MAX_RETRIES} 次后仍失败）: ${e?.message || e}`)
        }

        if (result.success) break

        // 上下文超限：不重试，给出友好提示
        if (isContextLimitError(result.body, result.status)) {
            throw new Error(friendlyContextLimitMessage(result.body))
        }
        const message = parseHttpErrorMessage(result) || `LLM API 错误 (${result.status})`
        if (isAnthropic && !anthropicBeta && isAnthropicOneMillionContextError(message)) {
            anthropicBeta = 'context-1m-2025-08-07'
            continue
        }
        // 可重试的错误
        if (RETRY_STATUS.has(result.status) && attempt < MAX_RETRIES) {
            await sleep(RETRY_BACKOFF_MS[attempt], signal)
            continue
        }
        if (!isAnthropic && shouldTryAnthropicMessagesFallback(message, { model, providerId, isGemini })) {
            try {
                const fallback = await callAnthropicMessagesFallback({
                    base,
                    apiKey,
                    model,
                    clientId,
                    messages,
                    maxTokens: maxTokens || config.maxOutputTokens,
                    signal,
                })
                return returnMeta ? fallback : fallback.content
            } catch (fallbackErr) {
                const fallbackMessage = fallbackErr?.message || String(fallbackErr)
                throw new Error(`${friendlyModelUnsupportedMessage(message, { model, providerId, baseUrl: base, isAnthropic })} 已尝试 Anthropic Messages API 兼容调用但仍失败：${fallbackMessage}`)
            }
        }
        if (!isAnthropic && shouldTryOpenAiResponsesFallback(message, { model, providerId, isGemini })) {
            try {
                const fallback = await callOpenAiResponsesFallback({
                    base,
                    apiKey,
                    model,
                    providerId,
                    clientId,
                    messages,
                    maxTokens,
                    temperature,
                    jsonMode,
                    deepThinking,
                    signal,
                })
                return returnMeta ? fallback : fallback.content
            } catch (fallbackErr) {
                const fallbackMessage = fallbackErr?.message || String(fallbackErr)
                throw new Error(`${friendlyModelUnsupportedMessage(message, { model, providerId, baseUrl: base, isAnthropic })} 已尝试 Responses API 兼容调用但仍失败：${fallbackMessage}`)
            }
        }
        throw new Error(isModelUnsupportedError(message)
            ? friendlyModelUnsupportedMessage(message, { model, providerId, baseUrl: base, isAnthropic })
            : message)
    }

    if (!result.body || result.body.trim() === '') {
        throw new Error('LLM 返回空响应')
    }

    let data
    try {
        data = parseJsonBody(result.body, 'LLM 响应')
    } catch (e) {
        console.error('LLM 响应解析失败, body:', result.body.substring(0, 500))
        throw new Error(`LLM 返回了无效 JSON: ${e.message || e}`)
    }

    let content
    let thinking = null
    if (isAnthropic) {
        const parsed = getAnthropicTextAndThinking(data)
        content = parsed.content
        thinking = parsed.thinking
    } else {
        if (!data.choices || data.choices.length === 0) {
            throw new Error('LLM 返回空结果')
        }

        const msg = data.choices[0].message || {}
        content = msg.content
            || msg.reasoning_content
            || msg.text
            || null
        thinking = msg.reasoning_content || msg.thinking || null
    }

    if (!content) {
        console.warn('LLM content 为空, 完整响应:', result.body.substring(0, 500))
        throw new Error(isAnthropic
            ? 'LLM 返回了空内容，该模型可能不完全兼容 Anthropic Messages API。'
            : 'LLM 返回了空内容，该模型可能不完全兼容 OpenAI Chat API。建议换用 gemini-2.5-flash')
    }

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

    // 上报 token 用量（监听 'llm-usage' 事件的 UI 可累计统计）
    const usage = data.usage || {}
    const promptTokens = usage.prompt_tokens || usage.input_tokens || 0
    const completionTokens = usage.completion_tokens || usage.output_tokens || 0
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens)
    if (typeof window !== 'undefined' && (promptTokens || completionTokens)) {
        window.dispatchEvent(new CustomEvent('llm-usage', {
            detail: {
                providerId,
                model: data.model || model,
                promptTokens,
                completionTokens,
                totalTokens,
                timestamp: Date.now(),
            },
        }))
    }

    if (returnMeta) {
        return {
            content,
            thinking,
            usage: { promptTokens, completionTokens, totalTokens },
            model: data.model || model,
        }
    }
    return content
}

export async function callLlm(config, messages, options = {}) {
    const candidates = [
        config,
        ...((config?.fallbackModels || []).map(model => ({ ...config, model, fallbackModels: [] }))),
    ]
    let lastErr = null
    const tried = []

    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]
        tried.push(candidate.model)
        try {
            const result = await callSingleLlm(candidate, messages, options)
            if (i > 0 && options.returnMeta && result && typeof result === 'object') {
                result.fallbackFrom = config.model
                result.triedModels = tried
            }
            return result
        } catch (e) {
            lastErr = e
            if (options.signal?.aborted || e?.name === 'AbortError') throw e
            const message = e?.message || String(e)
            if (!isModelTemporarilyUnavailableError(message) || i >= candidates.length - 1) break
            console.warn(`模型 ${candidate.model} 暂不可用，自动尝试备用模型 ${candidates[i + 1].model}:`, message)
        }
    }

    throw lastErr
}

function sleep(ms, signal) {
    if (signal?.aborted) return Promise.reject(new DOMException('操作已取消', 'AbortError'))
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup()
            resolve()
        }, ms)
        const onAbort = () => {
            clearTimeout(timer)
            cleanup()
            reject(new DOMException('操作已取消', 'AbortError'))
        }
        const cleanup = () => {
            if (signal) signal.removeEventListener('abort', onAbort)
        }
        if (signal) signal.addEventListener('abort', onAbort, { once: true })
    })
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

    const systemMsg = `你为一份正式的后端接口文档推断接口/参数/字段的中文描述。读者是前端开发与对接方，需要看一眼描述就能正确调用接口。

输出形式：
- 仅输出 JSON：{"results":[{"key":"<原样回传>","value":"<中文描述>"}, ...]}
- 接口名称（api_summary）：动宾结构 4-12 字，如 "查询用户列表"、"创建订单"、"删除指定文件"，避免"接口"二字
- 接口描述（api_description）：8-30 字，说明业务行为与边界条件，如 "按分页查询当前租户下的活跃用户"
- 参数描述（param_description）：5-20 字，标明取值含义；分页字段、排序字段、过滤字段要点明用途
- 字段描述（request/response field）：5-20 字，名词性短语；状态/类型字段要点出可选值含义（如 "订单状态：1待付款 2已付款 3已发货"）
- HTTP 方法语义提示：GET=查询/列表/详情，POST=创建/提交/触发，PUT/PATCH=更新，DELETE=删除
- 路径段语义：/list 或 /page → 列表/分页；/detail 或 /{id} → 详情；/export → 导出；/import → 导入；/batch → 批量
- 名称中含 token / signature / secret / pwd / sk → 描述里点明"敏感"
- 不要写"待补充"、"未知"、"详见代码"等占位文本`

    const fewShot = [
        {
            role: 'user',
            content: `请为以下 5 个占位符推断描述：

#1 [api_summary] key="a1" | GET /api/v1/users/page
#2 [api_description] key="a2" | GET /api/v1/users/page | 接口摘要: 查询用户列表
#3 [param_description] key="p1" | GET /api/v1/users/page | 参数: pageSize (Integer)
#4 [request_field_description] key="f1" | POST /api/v1/orders | 字段: payAmount (BigDecimal)
#5 [response_field_description] key="f2" | GET /api/v1/orders/{id} | 字段: status (Integer)`,
        },
        {
            role: 'assistant',
            content: `{"results":[{"key":"a1","value":"分页查询用户列表"},{"key":"a2","value":"按分页参数查询用户列表，支持关键字与状态过滤"},{"key":"p1","value":"每页条数，默认 10"},{"key":"f1","value":"支付金额，保留两位小数"},{"key":"f2","value":"订单状态：1待付款 2已付款 3已发货 4已完成 5已取消"}]}`,
        },
    ]

    return [
        { role: 'system', content: systemMsg },
        ...fewShot,
        {
            role: 'user',
            content: `请为以下 ${placeholders.length} 个占位符推断描述：\n\n${entries.join('\n')}`,
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

    const systemMsg = `你为后端接口文档生成真实可信的请求/响应 JSON 示例。读者拿到示例后能直接复制到 Postman 调试。

输出形式：
- 仅输出 JSON：{"results":[{"key":"<原样回传>","value":<JSON 对象，不是字符串>}, ...]}
- value 的字段必须与提供的字段一一对应，类型严格匹配

字段值规则：
- String：按字段语义填充常用值。姓名→"张三"/"李四"；邮箱→"zhangsan@example.com"；手机→"13800138000"；身份证→"110101199001011234"；URL→"https://example.com/path"；地址→"北京市朝阳区建国路 88 号"；备注/描述→简短中文一句话
- 时间字段（命名含 time/date/at/timestamp）：String 类型用 "2026-05-27 10:30:00"；Long 类型用毫秒时间戳 1748340600000；Date/LocalDateTime 类型用 ISO "2026-05-27T10:30:00"
- 数字 id 字段：1001 起递增；外键 id 用 2001、3001 与主键拉开区分
- 金额（命名含 amount/money/price/fee/cost）：99.50 / 1280.00 / 6800.00 一类合理金额，保留两位小数
- 状态字段（命名含 status/state/type）：从注释里的可选值取首个有效值；没有注释就填 1
- Boolean：默认 true（除非语义明显是反例，如 isDeleted 默认 false）
- 数组：返回 1-2 个元素的数组；分页响应里 list/records/rows 字段返回 2 个元素
- 嵌套对象：递归按上述规则填充
- 分页响应字段（total/pageNum/pageSize/pages）：total=25、pageNum=1、pageSize=10、pages=3
- 统一响应包装（命名是 code/msg/data/success）：成功响应 code=200、msg="success"、success=true，data 是真正的业务数据

不要写 "string"、"待填"、"xxx" 这类占位值。不要输出解释，只输出 JSON。`

    const fewShot = [
        {
            role: 'user',
            content: `请为以下 1 个接口生成真实可信的示例 JSON：

#1 key="ex1" | GET /api/v1/users/{id} | 查询用户详情
字段:
  - id: Long
  - userName: String (说明: 用户名)
  - email: String
  - status: Integer (说明: 状态：1启用 2禁用)
  - createTime: String
  - balance: BigDecimal
  - tags: List<String>`,
        },
        {
            role: 'assistant',
            content: `{"results":[{"key":"ex1","value":{"id":1001,"userName":"张三","email":"zhangsan@example.com","status":1,"createTime":"2026-05-27 10:30:00","balance":1280.00,"tags":["VIP","活跃用户"]}}]}`,
        },
    ]

    return [
        { role: 'system', content: systemMsg },
        ...fewShot,
        {
            role: 'user',
            content: `请为以下 ${exampleItems.length} 个接口生成真实可信的示例 JSON：\n\n${entries.join('\n\n')}`,
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

    const systemMsg = `你为一份正式的项目交付级数据库设计文档推断表注释与字段注释。读者是项目验收人员和后续维护开发，需要看一眼字段名就知道用途。

输出形式：
- 仅输出 JSON：{"results":[{"key":"<原样回传>","value":"<中文注释>"}, ...]}
- value 风格：表注释 4-12 字，字段注释 2-12 字，名词性短语，不带句号
- 字段为 is_xxx / has_xxx → "是否XXX"；为 *_time / *_at / gmt_* → "XXX时间"；为 *_id 且非主键 → "XXX的ID"
- 复合命名拆词后再翻译：tenant_user_id → "租户用户ID"；order_total_amount → "订单总金额"
- 缩写按行业惯例展开：usr→用户、pwd→密码、cfg→配置、cnt→计数、cnt→次数、qty→数量、addr→地址、acc/acct→账户、tx/txn→交易、del→删除、stat→状态、cat→类别、img→图片、url→链接、ext→扩展
- 类型作为辅助参考：tinyint(1) / bit 强提示布尔（"是否..."）；decimal/money 强提示金额；varchar+name 强提示名称/称呼
- 主键 id 字段统一注释为 "主键ID"
- 不确定时按最常见业务含义推断，不要写"未知"、"待定"、"由系统决定"等占位文本`

    const fewShot = [
        {
            role: 'user',
            content: `请为以下 5 个占位符推断注释：

#1 [表注释] key="t1" | 表名: sys_user
#2 [列注释] key="c1" | 表: sys_user | 列: id (bigint) [主键]
#3 [列注释] key="c2" | 表: sys_user | 列: gmt_create (datetime)
#4 [列注释] key="c3" | 表: sys_user | 列: is_deleted (tinyint(1)) 默认值=0
#5 [列注释] key="c4" | 表: order_info | 列: pay_amount (decimal(18,2))`,
        },
        {
            role: 'assistant',
            content: `{"results":[{"key":"t1","value":"系统用户表"},{"key":"c1","value":"主键ID"},{"key":"c2","value":"创建时间"},{"key":"c3","value":"是否删除"},{"key":"c4","value":"支付金额"}]}`,
        },
    ]

    return [
        { role: 'system', content: systemMsg },
        ...fewShot,
        {
            role: 'user',
            content: `请为以下 ${placeholders.length} 个占位符推断注释：\n\n${entries.join('\n')}`,
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
            if (this.cancelled) return
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
            const responseText = await callLlm(config, messages, { temperature: 0.1, maxTokens: 4096, signal: controller?.signal })
            const { filled } = applyApiDocResults(responseText, batch.items)
            totalFilled += filled
            onLog(`[完成] [${bIdx + 1}/${batches.length}] ${batch.name} → ${filled}/${batch.items.length} 已填充`, 'success')
            onBatchDone(batch.name, filled, batch.items.length)
        } catch (e) {
            if (e.name === 'AbortError') { onLog(`[取消] 用户取消了生成`, 'warn'); break }
            onLog(`[失败] [${bIdx + 1}/${batches.length}] ${batch.name} 失败: ${e.message}`, 'error')
        }
    }
    // ===== 第二阶段：AI 填充示例值 =====
    if (controller?.cancelled) {
        onLog(`[取消] 描述填充已停止: ${totalFilled}/${allPlaceholders.length} 个字段`, 'warn')
        return { filled: totalFilled, total: allPlaceholders.length, cancelled: true }
    }

    onLog(`[完成] 描述填充完成: ${totalFilled}/${allPlaceholders.length} 个字段`, 'info')

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
                const responseText = await callLlm(config, messages, { temperature: 0.3, maxTokens: 8192, signal: controller?.signal })
                const { filled: exFilled } = applyApiExampleResults(responseText, batch)
                onLog(`[完成] 示例值 [${bIdx + 1}/${exBatches.length}] → ${exFilled}/${batch.length} 已填充`, 'success')
            } catch (e) {
                if (e.name === 'AbortError') { onLog(`[取消] 用户取消了生成`, 'warn'); break }
                onLog(`[失败] 示例值 [${bIdx + 1}/${exBatches.length}] 失败: ${e.message}`, 'error')
            }
        }
    }

    if (controller?.cancelled) {
        onLog(`[取消] AI 填充已停止`, 'warn')
    } else {
        onLog(`[完成] AI 填充全部完成`, 'info')
    }
    return { filled: totalFilled, total: allPlaceholders.length, cancelled: !!controller?.cancelled }
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
            const responseText = await callLlm(config, messages, { temperature: 0.1, maxTokens: 4096, signal: controller?.signal })
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
    if (controller?.cancelled) {
        onLog(`[取消] AI 填充已停止: ${totalFilled}/${allPlaceholders.length} 个注释已填充`, 'warn')
    } else {
        onLog(`🎉 完成: ${totalFilled}/${allPlaceholders.length} 个注释已填充`, 'info')
    }
    return { filled: totalFilled, total: allPlaceholders.length, newOverrides: currentOverrides, cancelled: !!controller?.cancelled }
}

