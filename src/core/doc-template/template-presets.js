/**
 * 模板预设定义
 * SRS 和 SDD 各提供多套预置章节模板
 *
 * 预设骨架只定义章节结构（id/number/title/type/prompt/children），
 * 使用 instantiateTemplate() 将骨架转化为运行时节点（补充 content/mermaidCode 等字段）
 */

// ==================== 节点工厂 ====================

/**
 * 创建一个完整的运行时章节节点
 */
export function createSectionNode(overrides = {}) {
    return {
        id: overrides.id || `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        number: overrides.number || '',
        title: overrides.title || '新章节',
        type: overrides.type || 'text',
        prompt: overrides.prompt || '',
        content: overrides.content || '',
        mermaidCode: overrides.mermaidCode || '',
        imageData: overrides.imageData || null,
        editable: overrides.editable !== false,
        enabled: overrides.enabled !== false,
        children: (overrides.children || []).map(c => createSectionNode(c)),
    }
}

/**
 * 将预设骨架转化为运行时章节树
 */
export function instantiateTemplate(preset) {
    if (!preset || !preset.sections) return []
    return preset.sections.map(s => createSectionNode(s))
}

/**
 * 将运行时章节树简化为骨架（用于持久化存储）
 */
export function toTemplateSkeleton(sections) {
    return sections.map(s => ({
        id: s.id,
        number: s.number,
        title: s.title,
        type: s.type,
        prompt: s.prompt,
        children: s.children && s.children.length > 0 ? toTemplateSkeleton(s.children) : [],
    }))
}

// ==================== SRS 预设 ====================

export function getSrsPresets() {
    return [
        {
            id: 'srs-standard',
            name: 'GB/T 8567 标准版',
            description: '参照国标 GB/T 8567 的完整需求规格说明书，4 大章节，适用于正式项目交付',
            sections: [
                {
                    id: 'srs-1', number: '1', title: '引言', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-1-1', number: '1.1', title: '编写目的', type: 'text', prompt: '请根据以下项目信息，编写"系统需求规格说明书"的"编写目的"章节。\n要求：\n1. 说明编写本文档的目的\n2. 说明文档的预期读者（开发人员、测试人员、项目管理者等）\n3. 使用正式的技术文档语言\n4. 200-400字', children: [] },
                        { id: 'srs-1-2', number: '1.2', title: '项目背景', type: 'text', prompt: '请根据以下项目信息，编写"项目背景"章节。\n要求：\n1. 说明项目名称和开发单位\n2. 简述项目的来源和背景\n3. 描述项目将实现的核心业务目标\n4. 200-400字', children: [] },
                        { id: 'srs-1-3', number: '1.3', title: '定义和缩略语', type: 'table', prompt: '请根据以下代码结构和项目配置，列出本项目中使用的专业术语和缩略语。\n要求：\n1. 以 Markdown 表格格式输出，列：术语/缩略语、全称、说明\n2. 从代码中提取框架名称、技术术语、业务术语\n3. 至少列出 8-15 条', children: [] },
                        { id: 'srs-1-4', number: '1.4', title: '参考资料', type: 'text', prompt: '请根据项目使用的技术栈，列出相关的参考资料。\n要求：\n1. 以编号列表格式输出\n2. 包括使用的框架官方文档、行业标准（如 GB/T 8567）、相关规范\n3. 格式：[编号] 资料名称, 版本/日期', children: [] },
                    ],
                },
                {
                    id: 'srs-2', number: '2', title: '任务概述', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-2-1', number: '2.1', title: '目标', type: 'text', prompt: '请根据以下代码结构和项目配置，编写系统开发的目标。\n要求：\n1. 描述系统要达成的总体目标\n2. 列出 3-5 个具体的子目标\n3. 使用正式技术文档语言\n4. 300-500字', children: [] },
                        { id: 'srs-2-2', number: '2.2', title: '运行环境', type: 'text', prompt: '请根据以下项目配置（package.json / pom.xml / Cargo.toml 等），推断系统的运行环境。\n要求：\n1. 描述硬件环境（服务器配置建议、客户端配置要求）\n2. 描述软件环境（操作系统、中间件、数据库、浏览器等）\n3. 描述网络环境要求\n4. 以分类列表格式输出', children: [] },
                        { id: 'srs-2-3', number: '2.3', title: '条件与限制', type: 'text', prompt: '请根据项目的技术栈和结构，分析系统开发和运行的条件与限制。\n要求：\n1. 列出开发条件（开发工具、技术栈要求）\n2. 列出运营限制（并发限制、数据量限制、兼容性限制等）\n3. 200-400字', children: [] },
                    ],
                },
                {
                    id: 'srs-3', number: '3', title: '需求规定', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-3-1', number: '3.1', title: '功能需求', type: 'text', prompt: '请根据以下代码目录结构和模块信息，详细分析并列出系统的功能需求。\n要求：\n1. 按功能模块分组描述\n2. 每个功能需求包含：编号、名称、描述、优先级（高/中/低）\n3. 从代码的 Controller / Router / Handler 中推断业务功能\n4. 从配置文件中推断系统功能\n5. 输出格式为结构化列表，每个功能需求 50-100 字描述', children: [] },
                        { id: 'srs-3-1-diagram', number: '3.1.1', title: '系统用例图', type: 'diagram', prompt: '请根据上述功能需求，生成一个 Mermaid 格式的系统用例图。\n要求：\n1. 使用 Mermaid 的 flowchart 或 graph 语法模拟用例图\n2. 标出主要参与者（Actor）\n3. 展示核心用例及其关系\n4. 仅输出 Mermaid 代码，不要解释', children: [] },
                        { id: 'srs-3-2', number: '3.2', title: '性能需求', type: 'text', prompt: '请根据项目的技术栈和系统类型，编写合理的性能需求。\n要求：\n1. 响应时间要求（页面加载、接口响应）\n2. 并发处理能力要求\n3. 数据处理能力（存储容量、吞吐量）\n4. 系统可用性要求（如 99.9%）\n5. 以需求条目格式编写，每条包含指标和预期值', children: [] },
                        { id: 'srs-3-3', number: '3.3', title: '输入输出需求', type: 'text', prompt: '请根据代码中的接口定义和数据模型，描述系统的输入输出需求。\n要求：\n1. 输入数据描述（数据来源、格式、校验规则）\n2. 输出数据描述（输出目标、格式、展示方式）\n3. 数据传输协议和格式（REST/WebSocket、JSON 等）\n4. 300-500字', children: [] },
                        { id: 'srs-3-4', number: '3.4', title: '数据管理需求', type: 'text', prompt: '请根据项目的数据库配置和数据模型，描述数据管理需求。\n要求：\n1. 数据存储方式（关系型数据库、缓存、文件存储等）\n2. 数据备份和恢复策略\n3. 数据安全和隐私保护要求\n4. 数据生命周期管理\n5. 300-500字', children: [] },
                        { id: 'srs-3-5', number: '3.5', title: '故障处理需求', type: 'text', prompt: '请根据项目的技术架构，描述系统的故障处理需求。\n要求：\n1. 异常处理机制\n2. 日志记录要求\n3. 故障恢复策略\n4. 告警机制\n5. 200-400字', children: [] },
                        { id: 'srs-3-6', number: '3.6', title: '安全性需求', type: 'text', prompt: '请根据项目的技术栈和业务类型，描述系统的安全性需求。\n要求：\n1. 身份认证和授权机制\n2. 数据加密传输要求\n3. 输入校验和防注入措施\n4. 审计日志要求\n5. 合规性要求\n6. 300-500字', children: [] },
                    ],
                },
                {
                    id: 'srs-4', number: '4', title: '运行环境规定', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-4-1', number: '4.1', title: '设备', type: 'text', prompt: '请根据项目类型和技术栈，描述系统运行所需的硬件设备。\n要求：\n1. 服务器配置要求（CPU、内存、存储、网络）\n2. 客户端设备要求\n3. 网络设备要求\n4. 以表格或列表格式输出', children: [] },
                        { id: 'srs-4-2', number: '4.2', title: '支撑软件', type: 'table', prompt: '请根据项目的依赖配置文件，列出系统运行所需的支撑软件。\n要求：\n1. 以 Markdown 表格输出，列：软件名称、版本要求、用途说明\n2. 包括操作系统、运行时环境、数据库、中间件、第三方服务等\n3. 从 package.json / pom.xml 等提取实际版本信息', children: [] },
                        { id: 'srs-4-3', number: '4.3', title: '接口', type: 'text', prompt: '请根据代码中的接口定义，描述系统的外部接口。\n要求：\n1. 用户接口（前端界面描述）\n2. 硬件接口（如有）\n3. 软件接口（第三方 API、数据库连接等）\n4. 通信接口（协议、端口等）\n5. 200-400字', children: [] },
                        { id: 'srs-4-4', number: '4.4', title: '控制', type: 'text', prompt: '请描述系统的运行控制方式。\n要求：\n1. 系统启动和停止控制\n2. 运行状态监控\n3. 系统配置管理\n4. 版本控制策略\n5. 150-300字', children: [] },
                    ],
                },
            ],
        },
        {
            id: 'srs-simple',
            name: '精简版',
            description: '去掉运行环境细节，仅保留引言、任务概述、核心需求三大章，适用于内部项目',
            sections: [
                {
                    id: 'srs-s-1', number: '1', title: '引言', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-s-1-1', number: '1.1', title: '编写目的', type: 'text', prompt: '请编写"系统需求规格说明书"的编写目的，100-200字，说明文档目标和读者。', children: [] },
                        { id: 'srs-s-1-2', number: '1.2', title: '项目背景', type: 'text', prompt: '请简述项目名称、背景和核心目标，100-200字。', children: [] },
                    ],
                },
                {
                    id: 'srs-s-2', number: '2', title: '系统概述', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-s-2-1', number: '2.1', title: '系统目标', type: 'text', prompt: '请描述系统的总体目标和关键子目标，200-400字。', children: [] },
                        { id: 'srs-s-2-2', number: '2.2', title: '技术架构概览', type: 'diagram', prompt: '请根据代码结构生成系统技术架构的 Mermaid 图（graph TD），仅输出 Mermaid 代码。', children: [] },
                    ],
                },
                {
                    id: 'srs-s-3', number: '3', title: '功能需求', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-s-3-1', number: '3.1', title: '功能列表', type: 'text', prompt: '请根据代码结构列出系统的主要功能需求，按模块分组，每个功能 30-60 字。', children: [] },
                        { id: 'srs-s-3-2', number: '3.2', title: '非功能需求', type: 'text', prompt: '请简要描述系统的性能、安全性和可用性需求，200-400字。', children: [] },
                    ],
                },
            ],
        },
        {
            id: 'srs-enterprise',
            name: '企业交付版',
            description: '在标准版基础上增加验收标准、项目里程碑、风险分析章节，适用于正式合同交付',
            sections: [
                {
                    id: 'srs-e-1', number: '1', title: '引言', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-e-1-1', number: '1.1', title: '编写目的', type: 'text', prompt: '请编写正式的"系统需求规格说明书"编写目的，说明文档在项目交付中的定位和读者，200-400字。', children: [] },
                        { id: 'srs-e-1-2', number: '1.2', title: '项目背景', type: 'text', prompt: '请编写项目背景，包含项目来源、建设单位、承建单位和项目定位，200-400字。', children: [] },
                        { id: 'srs-e-1-3', number: '1.3', title: '定义和缩略语', type: 'table', prompt: '请列出项目中使用的专业术语和缩略语，Markdown 表格格式，至少 10 条。', children: [] },
                        { id: 'srs-e-1-4', number: '1.4', title: '参考资料', type: 'text', prompt: '请列出相关参考资料，包括国家标准、行业规范和框架文档。', children: [] },
                    ],
                },
                {
                    id: 'srs-e-2', number: '2', title: '任务概述', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-e-2-1', number: '2.1', title: '目标', type: 'text', prompt: '请描述系统建设的总体目标和分阶段目标，300-500字。', children: [] },
                        { id: 'srs-e-2-2', number: '2.2', title: '运行环境', type: 'text', prompt: '请推断并描述系统运行环境（硬件、软件、网络），以分类列表格式输出。', children: [] },
                    ],
                },
                {
                    id: 'srs-e-3', number: '3', title: '需求规定', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-e-3-1', number: '3.1', title: '功能需求', type: 'text', prompt: '请根据代码结构详细列出系统功能需求，按模块分组，每个功能需求包含编号、名称、描述、优先级。', children: [] },
                        { id: 'srs-e-3-2', number: '3.2', title: '性能需求', type: 'text', prompt: '请编写系统性能需求，包含响应时间、并发、可用性等指标。', children: [] },
                        { id: 'srs-e-3-3', number: '3.3', title: '安全性需求', type: 'text', prompt: '请描述系统安全性需求，包含认证、授权、加密、防攻击措施，300-500字。', children: [] },
                        { id: 'srs-e-3-4', number: '3.4', title: '数据需求', type: 'text', prompt: '请描述数据管理需求，包含存储、备份、隐私保护策略，300-500字。', children: [] },
                    ],
                },
                {
                    id: 'srs-e-4', number: '4', title: '验收标准', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-e-4-1', number: '4.1', title: '功能验收标准', type: 'table', prompt: '请根据功能需求，编写功能验收标准表格。\n列：序号、验收项、验收标准、验证方式。', children: [] },
                        { id: 'srs-e-4-2', number: '4.2', title: '性能验收标准', type: 'table', prompt: '请编写性能验收标准表格。\n列：序号、指标名称、期望值、测试方法。', children: [] },
                    ],
                },
                {
                    id: 'srs-e-5', number: '5', title: '项目里程碑', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-e-5-1', number: '5.1', title: '开发计划', type: 'table', prompt: '请根据项目规模，编写合理的开发里程碑计划。\n列：阶段、起止时间、交付物、负责人。', children: [] },
                        { id: 'srs-e-5-2', number: '5.2', title: '风险分析', type: 'text', prompt: '请分析项目可能面临的技术风险和管理风险，列出 3-5 个风险点及应对措施。', children: [] },
                    ],
                },
            ],
        },
    ]
}

// ==================== SDD 预设 ====================

export function getSddPresets() {
    return [
        {
            id: 'sdd-standard',
            name: '标准设计文档',
            description: '完整的软件设计文档，覆盖架构、模块、数据库、接口、安全和性能设计',
            sections: [
                {
                    id: 'sdd-1', number: '1', title: '引言', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-1-1', number: '1.1', title: '编写目的', type: 'text', prompt: '请编写"软件设计文档"的编写目的，说明文档定位和读者对象，200-400字。', children: [] },
                        { id: 'sdd-1-2', number: '1.2', title: '项目背景', type: 'text', prompt: '请简述项目名称、开发背景和系统定位，200-300字。', children: [] },
                        { id: 'sdd-1-3', number: '1.3', title: '定义和缩略语', type: 'table', prompt: '请列出本项目中使用的技术术语和缩略语，Markdown 表格格式，至少 8-15 条。', children: [] },
                        { id: 'sdd-1-4', number: '1.4', title: '参考资料', type: 'text', prompt: '请列出与本软件设计相关的参考资料，编号列表格式。', children: [] },
                    ],
                },
                {
                    id: 'sdd-2', number: '2', title: '系统概述', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-2-1', number: '2.1', title: '系统目标', type: 'text', prompt: '请描述系统的设计目标（总体目标、技术目标、业务目标），300-500字。', children: [] },
                        { id: 'sdd-2-2', number: '2.2', title: '设计原则', type: 'text', prompt: '请分析并总结系统设计遵循的 5-8 条设计原则，结合实际框架和模式。', children: [] },
                        { id: 'sdd-2-3', number: '2.3', title: '系统架构', type: 'diagram', prompt: '请根据代码目录结构和技术栈，生成系统架构的 Mermaid 图（graph TD），仅输出 Mermaid 代码。', children: [] },
                        { id: 'sdd-2-3-desc', number: '2.3.1', title: '架构说明', type: 'text', prompt: '请为系统架构图编写文字说明，描述各层职责和数据流向，300-500字。', children: [] },
                    ],
                },
                {
                    id: 'sdd-3', number: '3', title: '模块设计', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-3-1', number: '3.1', title: '模块划分', type: 'diagram', prompt: '请根据代码目录结构，生成模块划分的 Mermaid 图（graph），仅输出 Mermaid 代码。', children: [] },
                        { id: 'sdd-3-2', number: '3.2', title: '模块详细描述', type: 'text', prompt: '请详细描述每个模块，包含模块名称、职责描述、核心类/文件列表、对外接口概述，每个模块 100-200 字。', children: [] },
                        { id: 'sdd-3-3', number: '3.3', title: '模块接口', type: 'text', prompt: '请描述模块间的接口和交互方式，列出主要调用关系和数据传递方式，300-500字。', children: [] },
                    ],
                },
                {
                    id: 'sdd-4', number: '4', title: '数据库设计', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-4-1', number: '4.1', title: '数据库概述', type: 'text', prompt: '请描述数据库设计概述，包含数据库类型、设计原则、存储策略，200-400字。', children: [] },
                        { id: 'sdd-4-2', number: '4.2', title: '表结构设计', type: 'text', prompt: '请根据代码中的实体类/模型定义，列出主要表结构设计，Markdown 表格格式。', children: [] },
                        { id: 'sdd-4-3', number: '4.3', title: 'ER 图', type: 'diagram', prompt: '请根据数据模型生成 ER 图的 Mermaid 代码（erDiagram 语法），仅输出 Mermaid 代码。', children: [] },
                    ],
                },
                {
                    id: 'sdd-5', number: '5', title: '接口设计', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-5-1', number: '5.1', title: '内部接口', type: 'text', prompt: '请描述系统内部主要接口设计，包含模块间调用接口和事件通信机制，300-500字。', children: [] },
                        { id: 'sdd-5-2', number: '5.2', title: '外部接口', type: 'text', prompt: '请根据 API 定义描述系统外部接口设计，包含 RESTful 规范、认证机制，300-500字。', children: [] },
                        { id: 'sdd-5-3', number: '5.3', title: '接口交互流程', type: 'diagram', prompt: '请根据核心业务流程生成接口交互时序图（sequenceDiagram 语法），仅输出 Mermaid 代码。', children: [] },
                    ],
                },
                {
                    id: 'sdd-6', number: '6', title: '系统安全设计', type: 'text',
                    prompt: '请描述系统安全设计方案，包含认证授权、数据加密、防攻击措施、审计日志，400-600字。', children: [],
                },
                {
                    id: 'sdd-7', number: '7', title: '系统性能设计', type: 'text',
                    prompt: '请描述系统性能设计方案，包含缓存策略、数据库优化、并发处理、前端性能优化，400-600字。', children: [],
                },
            ],
        },
        {
            id: 'sdd-simple',
            name: '精简版',
            description: '仅保留核心设计章节（架构、模块、数据库），适用于小型项目',
            sections: [
                {
                    id: 'sdd-s-1', number: '1', title: '概述', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-s-1-1', number: '1.1', title: '项目简介', type: 'text', prompt: '请简述项目背景和本文档目的，100-200字。', children: [] },
                        { id: 'sdd-s-1-2', number: '1.2', title: '技术选型', type: 'table', prompt: '请以 Markdown 表格列出项目使用的技术栈，列：技术、版本、用途。', children: [] },
                    ],
                },
                {
                    id: 'sdd-s-2', number: '2', title: '系统设计', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-s-2-1', number: '2.1', title: '架构设计', type: 'diagram', prompt: '请生成系统架构 Mermaid 图（graph TD），仅输出 Mermaid 代码。', children: [] },
                        { id: 'sdd-s-2-2', number: '2.2', title: '模块划分', type: 'text', prompt: '请描述系统的模块划分和各模块职责，300-500字。', children: [] },
                    ],
                },
                {
                    id: 'sdd-s-3', number: '3', title: '数据设计', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-s-3-1', number: '3.1', title: '数据模型', type: 'text', prompt: '请描述核心数据模型和表结构设计。', children: [] },
                        { id: 'sdd-s-3-2', number: '3.2', title: 'ER 图', type: 'diagram', prompt: '请生成 ER 图（erDiagram 语法），仅输出 Mermaid 代码。', children: [] },
                    ],
                },
            ],
        },
        {
            id: 'sdd-microservice',
            name: '微服务架构版',
            description: '针对微服务架构项目，增加服务拆分、API 网关、服务治理、部署方案章节',
            sections: [
                {
                    id: 'sdd-m-1', number: '1', title: '引言', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-m-1-1', number: '1.1', title: '编写目的', type: 'text', prompt: '请编写微服务架构软件设计文档的编写目的，200-300字。', children: [] },
                        { id: 'sdd-m-1-2', number: '1.2', title: '定义和缩略语', type: 'table', prompt: '请列出微服务相关的术语和缩略语（含 RPC、网关、注册中心等），Markdown 表格格式。', children: [] },
                    ],
                },
                {
                    id: 'sdd-m-2', number: '2', title: '总体架构', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-m-2-1', number: '2.1', title: '架构概览', type: 'diagram', prompt: '请生成微服务总体架构的 Mermaid 图（graph TD），展示各服务、网关、注册中心的关系，仅输出 Mermaid 代码。', children: [] },
                        { id: 'sdd-m-2-2', number: '2.2', title: '设计原则', type: 'text', prompt: '请描述微服务架构的设计原则（服务自治、API 优先、弹性设计等），300-500字。', children: [] },
                    ],
                },
                {
                    id: 'sdd-m-3', number: '3', title: '服务设计', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-m-3-1', number: '3.1', title: '服务拆分', type: 'text', prompt: '请根据代码结构分析服务拆分方案，每个服务包含名称、职责、技术栈、对外接口。', children: [] },
                        { id: 'sdd-m-3-2', number: '3.2', title: '服务交互', type: 'diagram', prompt: '请生成服务间交互的时序图（sequenceDiagram），展示核心业务流程，仅输出 Mermaid 代码。', children: [] },
                        { id: 'sdd-m-3-3', number: '3.3', title: 'API 网关设计', type: 'text', prompt: '请描述 API 网关的设计，包含路由规则、鉴权、限流、负载均衡策略，300-500字。', children: [] },
                    ],
                },
                {
                    id: 'sdd-m-4', number: '4', title: '数据设计', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-m-4-1', number: '4.1', title: '数据库隔离策略', type: 'text', prompt: '请描述微服务数据库隔离策略（每服务独立数据库 vs 共享），200-400字。', children: [] },
                        { id: 'sdd-m-4-2', number: '4.2', title: '数据一致性方案', type: 'text', prompt: '请描述分布式数据一致性方案（Saga、事件驱动等），200-400字。', children: [] },
                    ],
                },
                {
                    id: 'sdd-m-5', number: '5', title: '服务治理', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-m-5-1', number: '5.1', title: '服务注册与发现', type: 'text', prompt: '请描述服务注册与发现机制（Nacos/Consul/Eureka 等），200-300字。', children: [] },
                        { id: 'sdd-m-5-2', number: '5.2', title: '熔断降级', type: 'text', prompt: '请描述熔断降级策略（Sentinel/Hystrix 等），200-300字。', children: [] },
                        { id: 'sdd-m-5-3', number: '5.3', title: '链路追踪', type: 'text', prompt: '请描述分布式链路追踪方案，200-300字。', children: [] },
                    ],
                },
                {
                    id: 'sdd-m-6', number: '6', title: '部署方案', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-m-6-1', number: '6.1', title: '容器化部署', type: 'diagram', prompt: '请生成容器化部署架构的 Mermaid 图，展示 Docker/K8s 部署拓扑，仅输出 Mermaid 代码。', children: [] },
                        { id: 'sdd-m-6-2', number: '6.2', title: 'CI/CD 流程', type: 'text', prompt: '请描述 CI/CD 持续集成和部署流程，200-400字。', children: [] },
                    ],
                },
            ],
        },
    ]
}
