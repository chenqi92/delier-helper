import { createSectionNode } from './doc-template/template-presets.js'
import { createSrsTemplate } from './doc-template/srs-template.js'
import { createSddTemplate } from './doc-template/sdd-template.js'

export const COPYRIGHT_PROFILE_KEY = 'copyright-package-profile'
export const SOFTWARE_DOC_CONFIG_KEY = 'copyright-package-software-doc'

const LEGACY_DEFAULTS = {
    softwareName: '交付助手软件',
    shortName: '交付助手',
    version: '0.4.1',
    softwareCategory: '应用软件',
    workDescription: 'original',
    ownerType: 'enterprise',
    developmentMode: 'independent',
    rightAcquisition: 'original',
    developmentStartDate: '2026-02-11',
    programmingLanguages: 'JavaScript、Vue、Rust、TypeScript',
    developmentTools: 'Visual Studio Code、Rust、Node.js、Tauri CLI',
    developmentHardwareEnv: '通用 PC 或 Mac 开发机',
    runtimeHardwareEnv: '通用 PC 或 Mac 终端设备',
    developmentSoftwareEnv: 'Windows/macOS、Node.js、Rust、Tauri、Vue、Vite',
    runtimeSoftwareEnv: 'Windows 10 及以上、macOS 10.15 及以上',
    operatingPlatform: 'Windows、macOS',
    softwareType: '桌面应用软件',
    applyScope: 'desktop',
    technicalFeatures: '采用 Tauri 2 + Vue 3 构建跨平台桌面应用，Rust 后端负责文件扫描、数据库连接和系统能力调用，前端负责文档配置、预览和导出。',
    sourcePageCount: '60',
    documentName: '用户操作手册',
    documentPageCount: '60',
    programDepositType: 'general',
    documentDepositType: 'general',
    documentMaterialType: '用户操作手册',
    softwareDescription: '一站式软件项目交付文档生成工具，支持软著源程序、接口文档、数据库文档、需求规格说明书、设计说明书、运维手册、测试文档和 PPT 等材料生成。',
}

export function stripLegacyCopyrightDefaults(profile = {}) {
    const next = { ...(profile || {}) }
    for (const [key, legacyValue] of Object.entries(LEGACY_DEFAULTS)) {
        if (next[key] === legacyValue) next[key] = ''
    }
    if (!next.documentTypeId) next.documentTypeId = 'user-manual'
    return next
}

export function inferCopyrightProfileFromScan(scanResult = {}, currentProfile = {}) {
    const partial = {}
    const configs = Array.isArray(scanResult.configs) ? scanResult.configs : []
    const stats = scanResult.stats || {}
    const business = scanResult.business || {}
    const tech = inferTechStack(scanResult)
    const projectMeta = inferProjectMeta(configs)
    const scope = inferScope(scanResult, tech)
    const readmeDescription = inferReadmeDescription(scanResult)

    if (projectMeta.name) {
        partial.shortName = projectMeta.name
        partial.softwareName = /软件$/.test(projectMeta.name) ? projectMeta.name : `${projectMeta.name}软件`
    }
    if (projectMeta.version) partial.version = projectMeta.version
    if (projectMeta.description) partial.softwareDescription = projectMeta.description
    else if (readmeDescription) partial.softwareDescription = readmeDescription
    else if (business.pages?.length || business.apiEndpoints?.length || business.commands?.length) {
        partial.softwareDescription = buildDescriptionFromSignals(scanResult)
    }

    const langs = Object.entries(stats.languages || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([lang]) => lang)
    if (langs.length) partial.programmingLanguages = langs.join('、')

    if (scope.applyScope) partial.applyScope = scope.applyScope
    if (scope.softwareType) partial.softwareType = scope.softwareType
    if (scope.operatingPlatform) partial.operatingPlatform = scope.operatingPlatform
    if (tech.developmentTools.length) partial.developmentTools = tech.developmentTools.join('、')
    if (tech.developmentSoftwareEnv.length) partial.developmentSoftwareEnv = tech.developmentSoftwareEnv.join('、')
    if (tech.runtimeSoftwareEnv.length) partial.runtimeSoftwareEnv = tech.runtimeSoftwareEnv.join('、')
    if (tech.features.length || business.modules?.length || business.pages?.length || business.apiEndpoints?.length) {
        partial.technicalFeatures = buildTechnicalFeatures(scanResult, tech)
    }

    return mergeInferredProfile(currentProfile, partial)
}

function mergeInferredProfile(currentProfile, inferred) {
    const next = { ...stripLegacyCopyrightDefaults(currentProfile) }
    for (const [key, value] of Object.entries(inferred)) {
        if (!value) continue
        if (!next[key] || LEGACY_DEFAULTS[key] === next[key]) next[key] = value
    }
    return next
}

function inferProjectMeta(configs) {
    for (const cfg of configs) {
        if (cfg.name === 'package.json') {
            try {
                const pkg = JSON.parse(cfg.content)
                return {
                    name: pkg.displayName || pkg.productName || pkg.name || '',
                    version: pkg.version || '',
                    description: pkg.description || '',
                }
            } catch (e) {}
        }
        if (cfg.name === 'Cargo.toml') {
            return {
                name: matchFirst(cfg.content, /^\s*name\s*=\s*["']([^"']+)["']/m),
                version: matchFirst(cfg.content, /^\s*version\s*=\s*["']([^"']+)["']/m),
                description: matchFirst(cfg.content, /^\s*description\s*=\s*["']([^"']+)["']/m),
            }
        }
        if (cfg.name === 'go.mod') {
            const moduleName = matchFirst(cfg.content, /^\s*module\s+([^\s]+)/m)
            return { name: moduleName.split('/').pop() || moduleName, version: '', description: '' }
        }
        if (cfg.name === 'pyproject.toml') {
            return {
                name: matchFirst(cfg.content, /^\s*name\s*=\s*["']([^"']+)["']/m),
                version: matchFirst(cfg.content, /^\s*version\s*=\s*["']([^"']+)["']/m),
                description: matchFirst(cfg.content, /^\s*description\s*=\s*["']([^"']+)["']/m),
            }
        }
        if (cfg.name === 'pom.xml') {
            return {
                name: matchFirst(cfg.content, /<artifactId>([^<]+)<\/artifactId>/),
                version: matchFirst(cfg.content, /<version>([^<]+)<\/version>/),
                description: matchFirst(cfg.content, /<description>([^<]+)<\/description>/),
            }
        }
    }
    return { name: '', version: '', description: '' }
}

function inferTechStack(scanResult) {
    const configs = Array.isArray(scanResult.configs) ? scanResult.configs : []
    const langs = scanResult.stats?.languages || {}
    const allConfigText = configs.map(c => `${c.name}\n${c.content || ''}`).join('\n').toLowerCase()
    const integrations = scanResult.business?.integrations?.map(x => String(x.name || '').toLowerCase()) || []
    const has = (keyword) => allConfigText.includes(keyword) || integrations.includes(keyword)
    const tools = []
    const devEnv = []
    const runtimeEnv = []
    const features = []

    if (configs.some(c => c.name === 'package.json') || langs.JavaScript || langs.TypeScript || langs.Vue || langs.React) {
        tools.push('Node.js/npm')
        devEnv.push('Node.js')
        runtimeEnv.push('Node.js 或浏览器运行环境')
    }
    if (has('vite')) { tools.push('Vite'); features.push('前端工程化构建') }
    if (has('vue')) { devEnv.push('Vue'); features.push('Vue 前端界面') }
    if (has('react')) { devEnv.push('React'); features.push('React 前端界面') }
    if (has('tauri')) { tools.push('Tauri CLI'); devEnv.push('Tauri'); runtimeEnv.push('桌面端运行环境'); features.push('桌面端本地能力调用') }
    if (has('electron')) { devEnv.push('Electron'); runtimeEnv.push('桌面端运行环境'); features.push('桌面端应用框架') }
    if (configs.some(c => c.name === 'Cargo.toml') || langs.Rust) { tools.push('Rust/Cargo'); devEnv.push('Rust'); features.push('Rust 后端或本地模块') }
    if (configs.some(c => c.name === 'pom.xml')) { tools.push('Maven'); devEnv.push('Java'); runtimeEnv.push('JVM'); features.push('Java 服务端模块') }
    if (configs.some(c => /^build\.gradle/.test(c.name))) { tools.push('Gradle'); devEnv.push('Java/Kotlin'); runtimeEnv.push('JVM'); features.push('Java/Kotlin 服务端模块') }
    if (configs.some(c => c.name === 'go.mod') || langs.Go) { tools.push('Go'); devEnv.push('Go'); runtimeEnv.push('Go 运行环境'); features.push('Go 服务模块') }
    if (configs.some(c => ['requirements.txt', 'pyproject.toml'].includes(c.name)) || langs.Python) { tools.push('Python'); devEnv.push('Python'); runtimeEnv.push('Python 运行环境'); features.push('Python 服务或脚本模块') }
    if (configs.some(c => /docker/i.test(c.name))) { tools.push('Docker'); runtimeEnv.push('容器运行环境'); features.push('容器化部署') }

    return {
        developmentTools: unique(tools),
        developmentSoftwareEnv: unique(devEnv),
        runtimeSoftwareEnv: unique(runtimeEnv),
        features: unique(features),
    }
}

function inferScope(scanResult, tech) {
    const biz = scanResult.business || {}
    const paths = collectTreePaths(scanResult.trees || []).join('\n').toLowerCase()
    const integrations = biz.integrations?.map(x => String(x.name || '').toLowerCase()) || []
    const hasPages = Array.isArray(biz.pages) && biz.pages.length > 0
    const hasApis = Array.isArray(biz.apiEndpoints) && biz.apiEndpoints.length > 0
    const hasCommands = Array.isArray(biz.commands) && biz.commands.length > 0
    const hasIntegration = (name) => integrations.includes(name) || tech.developmentSoftwareEnv.some(x => x.toLowerCase().includes(name))

    if (/project\.config\.json|app\.json|pages\.json|mini|wechat|wx\./i.test(paths)) {
        return { applyScope: 'mini-program', softwareType: '小程序', operatingPlatform: '微信小程序、支付宝小程序等宿主平台' }
    }
    if (/android|ios|react-native|flutter|uni-app|capacitor/i.test(paths)) {
        return { applyScope: 'mobile-app', softwareType: '移动 App', operatingPlatform: 'Android、iOS' }
    }
    if (hasIntegration('tauri') || hasIntegration('electron') || hasCommands) {
        return { applyScope: 'desktop', softwareType: '桌面应用软件', operatingPlatform: 'Windows、macOS、Linux' }
    }
    if (hasPages && hasApis) {
        return { applyScope: 'web', softwareType: 'Web 系统/网站后台', operatingPlatform: '主流浏览器、服务器' }
    }
    if (hasPages) {
        return { applyScope: 'web', softwareType: 'Web 系统/网站后台', operatingPlatform: '主流浏览器' }
    }
    if (hasApis) {
        return { applyScope: 'backend-service', softwareType: '后端服务/API', operatingPlatform: 'Linux/Windows Server、容器、云服务' }
    }
    return {}
}

function inferReadmeDescription(scanResult) {
    const readme = (scanResult.readmes || []).find(doc => doc.content)
    if (!readme) return ''
    const lines = String(readme.content)
        .split(/\n+/)
        .map(line => line.replace(/^#+\s*/, '').trim())
        .filter(line => line && !/^[-*`>|!\[]/.test(line))
    const picked = lines.find(line => /[\u4e00-\u9fa5A-Za-z]/.test(line) && line.length >= 20) || lines[0] || ''
    return picked.slice(0, 220)
}

function buildDescriptionFromSignals(scanResult) {
    const biz = scanResult.business || {}
    const parts = []
    if (biz.pages?.length) parts.push(`包含 ${biz.pages.slice(0, 5).map(p => p.name).join('、')} 等页面功能`)
    if (biz.apiEndpoints?.length) parts.push(`提供 ${biz.apiEndpoints.length} 个接口调用能力`)
    if (biz.commands?.length) parts.push(`包含 ${biz.commands.slice(0, 5).map(c => c.name).join('、')} 等本地命令能力`)
    return parts.length ? `该软件${parts.join('，')}。` : ''
}

function buildTechnicalFeatures(scanResult, tech) {
    const biz = scanResult.business || {}
    const parts = []
    if (tech.features.length) parts.push(tech.features.join('、'))
    if (biz.pages?.length) parts.push(`识别到 ${biz.pages.length} 个页面/视图`)
    if (biz.apiEndpoints?.length) parts.push(`识别到 ${biz.apiEndpoints.length} 个接口`)
    if (biz.commands?.length) parts.push(`识别到 ${biz.commands.length} 个本地/后台命令`)
    if (biz.domainModels?.length) parts.push(`包含 ${biz.domainModels.length} 个领域对象线索`)
    return parts.length ? parts.join('；') + '。' : ''
}

function collectTreePaths(trees = []) {
    const out = []
    const walk = (node, base = '') => {
        const path = base ? `${base}/${node.name}` : node.name
        out.push(path)
        for (const child of node.children || []) walk(child, path)
    }
    for (const tree of trees) walk(tree)
    return out
}

function matchFirst(text, regex) {
    return String(text || '').match(regex)?.[1]?.trim() || ''
}

function unique(list) {
    return [...new Set(list.filter(Boolean))]
}

export const SOFTWARE_DOCUMENT_OPTIONS = [
    {
        id: 'user-manual',
        label: '用户操作手册',
        docTitle: '用户操作手册',
        filename: '03_用户操作手册.docx',
        description: '面向最终用户，说明安装启动、功能入口、核心操作和常见问题，适合作为有界面软件的文档鉴别材料。',
    },
    {
        id: 'operation-guide',
        label: '软件操作说明书',
        docTitle: '软件操作说明书',
        filename: '03_软件操作说明书.docx',
        description: '按业务流程组织操作步骤，适合后台系统、App、小程序和多端系统提交。',
    },
    {
        id: 'requirements-spec',
        label: '需求说明书',
        docTitle: '软件需求规格说明书',
        filename: '03_软件需求规格说明书.docx',
        description: '描述软件目标、功能需求、非功能需求和运行环境，适合偏后台、服务端或交付验收场景。',
    },
    {
        id: 'design-spec',
        label: '设计说明书',
        docTitle: '软件设计说明书',
        filename: '03_软件设计说明书.docx',
        description: '描述架构、模块、接口、数据和安全设计，适合服务端、平台型或无明显用户界面的软件。',
    },
    {
        id: 'interface-spec',
        label: '接口说明书',
        docTitle: '软件接口说明书',
        filename: '03_软件接口说明书.docx',
        description: '描述接口鉴权、请求响应、错误码和调用示例，适合 API、SDK、云服务和后端服务。',
    },
]

export function getSoftwareDocumentOption(typeId) {
    return SOFTWARE_DOCUMENT_OPTIONS.find(item => item.id === typeId) || SOFTWARE_DOCUMENT_OPTIONS[0]
}

export function createCopyrightSoftwareDocInfo(profile = {}, typeId = 'user-manual') {
    const option = getSoftwareDocumentOption(typeId)
    const version = normalizeVersion(profile.version)
    return {
        docTitle: option.docTitle,
        projectName: profile.softwareName || profile.shortName || '',
        version,
        author: profile.applicantName || profile.contactName || '',
        organization: profile.ownerName || '',
        date: new Date().toISOString().slice(0, 10),
        audience: audienceForType(typeId, profile),
        copyrightDocType: option.label,
    }
}

export function createCopyrightSoftwareDocSections(typeId = 'user-manual', profile = {}) {
    if (typeId === 'requirements-spec') return createSrsTemplate('srs-standard')
    if (typeId === 'design-spec') return createSddTemplate('sdd-standard')
    if (typeId === 'interface-spec') return createInterfaceSpecSections(profile)
    if (typeId === 'operation-guide') return createOperationGuideSections(profile)
    return createUserManualSections(profile)
}

export function buildCopyrightSoftwareDocContext(baseContext, profile = {}, option = getSoftwareDocumentOption(profile.documentTypeId)) {
    const lines = [
        baseContext || '',
        '',
        '## 软著软件文档生成要求',
        `- 文档类型：${option.label}`,
        `- 软件名称：${profile.softwareName || '待识别'}`,
        `- 软件简称：${profile.shortName || '无'}`,
        `- 版本号：${normalizeVersion(profile.version)}`,
        `- 软件类型：${profile.softwareType || '待识别'}`,
        `- 申请范围：${profile.applyScope || '待识别'}`,
        `- 运行平台：${profile.operatingPlatform || '待识别'}`,
        `- 主要开发语言/技术：${profile.programmingLanguages || '待识别'}`,
        `- 功能简介：${profile.softwareDescription || '请从代码和参考文件归纳'}`,
        '',
        '生成原则：',
        '- 内容必须围绕代码库、README、配置文件、页面文案、路由、接口、命令和用户提供的参考文件展开。',
        '- 不输出“请补充”“模板”“占位符”等未完成表达；确实无法从材料判断的信息，用“未在代码中发现明确证据”简述。',
        '- 用户手册和操作说明书要按真实入口、页面、菜单、按钮、流程和导出结果组织，不要泛泛描述。',
        '- 需求说明书和设计说明书要体现代码中的模块、接口、数据对象、依赖和运行环境。',
        '- 可提到截图插入位置，但不要伪造截图内容。',
    ]
    return lines.filter(Boolean).join('\n')
}

function audienceForType(typeId, profile) {
    if (typeId === 'requirements-spec') return '项目负责人、需求评审人员、开发人员、测试人员、验收人员'
    if (typeId === 'design-spec') return '开发人员、架构设计人员、测试人员、运维人员、验收人员'
    if (typeId === 'interface-spec') return '接口调用方、后端开发人员、联调测试人员、运维人员'
    if (profile.applyScope === 'backend-service') return '接口调用方、部署运维人员、验收人员'
    return '最终用户、项目验收方、培训人员、运维支持人员'
}

function normalizeVersion(version) {
    const v = String(version || '').trim()
    if (!v) return ''
    return /^v/i.test(v) ? v : `V${v}`
}

function scopeEntryPrompt(profile) {
    const scope = profile.applyScope
    if (scope === 'mobile-app') return '请从代码中的移动端页面、路由、权限、状态管理和接口调用推断 App 进入方式、权限授权、登录和核心功能入口。'
    if (scope === 'mini-program') return '请从小程序页面、路由、授权 API、业务组件和接口调用推断搜索/扫码进入、授权登录、页面导航和核心业务流程。'
    if (scope === 'web' || scope === 'cloud') return '请从前端路由、菜单、页面组件、登录鉴权和接口调用推断浏览器访问、登录、导航和核心功能入口。'
    if (scope === 'backend-service') return '该软件偏服务端或 API，无典型图形界面时，请把服务启动、接口调用、认证、日志和配置作为操作入口。'
    if (scope === 'embedded') return '请从设备通信、配置、命令、控制逻辑和状态数据推断设备初始化、参数配置、运行和维护流程。'
    if (scope === 'multi-terminal' || scope === 'both') return '请分别覆盖客户端、Web/云端、移动端或小程序入口，并说明多端数据流转关系。'
    return '请从桌面端入口、菜单、命令、页面组件和本地能力调用推断安装启动、项目配置和核心功能操作。'
}

function createUserManualSections(profile) {
    const entryPrompt = scopeEntryPrompt(profile)
    return [
        createSectionNode({
            id: 'copyright-um-1',
            number: '1',
            title: '软件概述',
            type: 'text',
            prompt: `请编写用户操作手册的软件概述。\n要求：\n1. 说明软件用途、目标用户、适用场景和核心能力\n2. 结合代码中的页面、菜单、命令、接口和 README 信息\n3. 300-500 字，避免空泛宣传语`,
        }),
        createSectionNode({
            id: 'copyright-um-2',
            number: '2',
            title: '运行环境',
            type: 'table',
            prompt: `请根据代码库和配置文件生成运行环境表。\n要求：\n1. Markdown 表格，列：类别、要求、说明\n2. 覆盖客户端/宿主平台、操作系统、浏览器或运行时、依赖服务、数据库或外部服务（如有）\n3. 使用代码中能识别的框架和版本，不确定时说明未发现明确版本`,
        }),
        createSectionNode({
            id: 'copyright-um-3',
            number: '3',
            title: '安装与启动',
            type: 'text',
            prompt: `请编写安装与启动步骤。\n${entryPrompt}\n要求：\n1. 按准备、安装/访问、首次启动、登录或授权、退出或卸载组织\n2. 如果是服务端/API，改写为部署配置、启动命令、健康检查和接口调用准备\n3. 使用编号列表，步骤要可执行`,
        }),
        createSectionNode({
            id: 'copyright-um-4',
            number: '4',
            title: '功能总览',
            type: 'table',
            prompt: `请根据代码中的页面、路由、菜单、命令、接口和模块生成软件功能总览。\n要求：\n1. Markdown 表格，列：功能模块、入口/路径、主要操作、输出结果\n2. 至少覆盖 5 个核心功能；不足 5 个时按实际发现列出\n3. 不编造不存在的菜单或接口`,
        }),
        createSectionNode({
            id: 'copyright-um-5',
            number: '5',
            title: '核心功能操作',
            type: 'text',
            prompt: `请编写核心功能操作说明。\n要求：\n1. 按代码识别到的主要功能模块分小节描述\n2. 每个模块写清入口、操作步骤、关键参数、结果查看、异常提示\n3. 面向最终用户，语言具体直接\n4. 800-1400 字`,
        }),
        createSectionNode({
            id: 'copyright-um-6',
            number: '6',
            title: '数据与文件处理',
            type: 'text',
            prompt: `请根据代码中的导入、导出、上传、下载、数据库、缓存或本地文件操作，编写数据与文件处理说明。\n要求：\n1. 描述输入来源、处理过程、输出文档/接口/记录\n2. 如果未发现文件处理功能，说明系统主要数据流转方式\n3. 包含注意事项和权限限制`,
        }),
        createSectionNode({
            id: 'copyright-um-7',
            number: '7',
            title: '常见问题与处理',
            type: 'table',
            prompt: `请根据软件类型和代码功能生成常见问题处理表。\n要求：\n1. Markdown 表格，列：问题现象、可能原因、处理方式\n2. 覆盖登录/授权、网络或服务连接、权限不足、导入导出失败、配置错误等\n3. 每个单元格不超过 80 字`,
        }),
    ]
}

function createOperationGuideSections(profile) {
    const entryPrompt = scopeEntryPrompt(profile)
    return [
        createSectionNode({
            id: 'copyright-og-1',
            number: '1',
            title: '操作说明范围',
            type: 'text',
            prompt: `请编写软件操作说明书的范围说明。\n要求：\n1. 说明本文档覆盖的软件版本、操作对象、角色和主要业务流程\n2. 结合代码库识别到的页面、命令、接口和模块\n3. 200-400 字`,
        }),
        createSectionNode({
            id: 'copyright-og-2',
            number: '2',
            title: '操作前准备',
            type: 'table',
            prompt: `请生成操作前准备清单。\n要求：\n1. Markdown 表格，列：准备项、具体要求、检查方式\n2. 覆盖账号/权限、运行环境、网络或服务、项目目录/数据源/配置项等\n3. ${entryPrompt}`,
        }),
        createSectionNode({
            id: 'copyright-og-3',
            number: '3',
            title: '业务操作流程',
            type: 'diagram',
            prompt: `请根据代码中的主要页面、接口、命令和流程词生成业务操作流程图。\n要求：\n1. 使用 Mermaid flowchart TD 或 LR\n2. 展示从进入系统、选择功能、填写/导入数据、执行处理、查看/导出结果的流程\n3. 仅输出 Mermaid 代码`,
        }),
        createSectionNode({
            id: 'copyright-og-4',
            number: '4',
            title: '主要功能操作步骤',
            type: 'text',
            prompt: `请编写主要功能操作步骤。\n要求：\n1. 按功能模块分节，每个模块包含入口、操作步骤、输入项、处理结果和异常提示\n2. 优先使用代码中的页面标题、按钮文案、路由、命令名或接口名作为证据\n3. 1000-1600 字，适合直接放入交付文档`,
        }),
        createSectionNode({
            id: 'copyright-og-5',
            number: '5',
            title: '结果查看与导出',
            type: 'text',
            prompt: `请根据代码中的结果展示、记录保存、文档导出、接口响应或日志输出功能，编写结果查看与导出说明。\n要求：\n1. 说明用户完成操作后在哪里查看结果\n2. 说明可导出的文件类型、数据格式或接口响应\n3. 说明失败时的提示和重试方式`,
        }),
        createSectionNode({
            id: 'copyright-og-6',
            number: '6',
            title: '操作注意事项',
            type: 'table',
            prompt: `请生成操作注意事项表。\n要求：\n1. Markdown 表格，列：场景、注意事项、错误处理\n2. 覆盖权限、数据完整性、文件大小、网络连接、版本兼容和安全配置\n3. 结合实际技术栈，不要写泛泛提示`,
        }),
    ]
}

function createInterfaceSpecSections() {
    return [
        createSectionNode({
            id: 'copyright-if-1',
            number: '1',
            title: '接口说明概述',
            type: 'text',
            prompt: `请编写接口说明书概述。\n要求：\n1. 说明软件提供的接口能力、调用对象、适用场景\n2. 根据代码中的路由、Controller、invoke 命令、API 客户端或服务方法归纳\n3. 300-500 字`,
        }),
        createSectionNode({
            id: 'copyright-if-2',
            number: '2',
            title: '接口运行环境',
            type: 'table',
            prompt: `请生成接口运行环境表。\n要求：\n1. Markdown 表格，列：类别、内容、说明\n2. 覆盖服务地址/本地命令、协议、鉴权、运行时、数据库/缓存、依赖服务\n3. 未发现明确值时说明未在代码中发现明确证据`,
        }),
        createSectionNode({
            id: 'copyright-if-3',
            number: '3',
            title: '接口清单',
            type: 'table',
            prompt: `请根据代码提取接口清单。\n要求：\n1. Markdown 表格，列：接口/命令、方法、路径或调用名、功能说明、主要参数、返回结果\n2. 覆盖 HTTP API、Tauri invoke 命令、CLI 命令或 SDK 方法\n3. 不编造未在代码中出现的接口`,
        }),
        createSectionNode({
            id: 'copyright-if-4',
            number: '4',
            title: '核心接口调用流程',
            type: 'diagram',
            prompt: `请根据核心接口调用关系生成 Mermaid 时序图。\n要求：\n1. 使用 sequenceDiagram\n2. 展示调用方、前端/客户端、后端服务、数据库或外部系统之间的交互\n3. 仅输出 Mermaid 代码`,
        }),
        createSectionNode({
            id: 'copyright-if-5',
            number: '5',
            title: '请求响应与错误处理',
            type: 'text',
            prompt: `请编写请求响应与错误处理说明。\n要求：\n1. 说明请求参数、响应字段、错误码或异常返回\n2. 如代码中无统一错误码，按已发现的异常处理、日志和提示方式归纳\n3. 给出 2-3 个来自代码证据的调用示例或伪示例`,
        }),
        createSectionNode({
            id: 'copyright-if-6',
            number: '6',
            title: '安全与调用限制',
            type: 'text',
            prompt: `请编写接口安全与调用限制。\n要求：\n1. 说明鉴权、权限、输入校验、敏感信息处理、并发和超时限制\n2. 结合代码中的配置、依赖、拦截器、校验逻辑或命令权限\n3. 300-600 字`,
        }),
    ]
}
