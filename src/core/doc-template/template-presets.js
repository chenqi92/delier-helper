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
        {
            id: 'srs-gov',
            name: '政企交付版',
            description: '参照政企项目实际交付标准，含用户角色、遵循标准规范、功能架构图、非功能需求细分和验收标准',
            sections: [
                {
                    id: 'srs-g-1', number: '1', title: '引言', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-g-1-1', number: '1.1', title: '目的', type: 'text', prompt: '请编写本需求规格说明书的编写目的。\n要求：\n1. 详细说明文档在项目各阶段的作用（需求确认、概要设计指导、开发参考、测试依据、实施辅助、验收依据）\n2. 明确读者对象\n3. 300-500字', children: [] },
                        { id: 'srs-g-1-2', number: '1.2', title: '适用范围', type: 'text', prompt: '请描述本文档的适用范围。\n1. 适用的系统和版本\n2. 适用的组织和人员\n3. 100-200字', children: [] },
                        { id: 'srs-g-1-3', number: '1.3', title: '术语和缩略语', type: 'table', prompt: '请列出项目中的术语和缩略语，Markdown 表格格式，列：术语/缩略语、全称、说明，至少 10 条。', children: [] },
                        { id: 'srs-g-1-4', number: '1.4', title: '参考资料', type: 'text', prompt: '请列出参考资料，编号列表格式，包括国家标准、行业规范和技术文档。', children: [] },
                        { id: 'srs-g-1-5', number: '1.5', title: '需求描述约定', type: 'text', prompt: '请描述本文档的需求描述约定。\n要求：\n1. 需求编号规则说明\n2. 优先级定义（高/中/低）\n3. 需求状态定义（草案/已确认/已变更等）\n4. 100-200字', children: [] },
                    ],
                },
                {
                    id: 'srs-g-2', number: '2', title: '项目概述', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-g-2-1', number: '2.1', title: '项目背景', type: 'text', prompt: '请描述项目的建设背景和需求来源。\n1. 项目来源和立项背景\n2. 行业/业务背景\n3. 当前痛点和建设必要性\n4. 300-500字', children: [] },
                        { id: 'srs-g-2-2', number: '2.2', title: '项目目标', type: 'text', prompt: '请描述项目建设目标。\n1. 总体目标\n2. 分项目标（3-5 个）\n3. 预期效果\n4. 300-500字', children: [] },
                        { id: 'srs-g-2-3', number: '2.3', title: '用户角色', type: 'table', prompt: '请根据项目代码中的权限/角色定义，列出系统的用户角色。\nMarkdown 表格格式，列：角色名称、角色描述、主要权限、用户数量估算。\n至少 3-5 个角色。', children: [] },
                        {
                            id: 'srs-g-2-4', number: '2.4', title: '遵循标准与规范', type: 'text', prompt: '',
                            children: [
                                { id: 'srs-g-2-4-1', number: '2.4.1', title: '国家法律法规', type: 'text', prompt: '请列出系统需遵循的国家法律法规，编号列表格式。', children: [] },
                                { id: 'srs-g-2-4-2', number: '2.4.2', title: '行业标准', type: 'text', prompt: '请列出系统需遵循的行业标准（如 GB/T 等），编号列表格式。', children: [] },
                                { id: 'srs-g-2-4-3', number: '2.4.3', title: '安全与隐私规范', type: 'text', prompt: '请列出安全和隐私保护相关规范（等保、数据安全法等）。', children: [] },
                                { id: 'srs-g-2-4-4', number: '2.4.4', title: '管理体系认证', type: 'text', prompt: '请列出涉及的管理体系认证标准（ISO 等）。', children: [] },
                            ],
                        },
                        {
                            id: 'srs-g-2-5', number: '2.5', title: '功能总体设计', type: 'text', prompt: '',
                            children: [
                                { id: 'srs-g-2-5-1', number: '2.5.1', title: '功能架构图', type: 'diagram', prompt: '请根据代码目录结构和模块划分，生成系统功能架构的 Mermaid 图（graph TD），展示各功能模块的层级关系，仅输出 Mermaid 代码。', children: [] },
                                { id: 'srs-g-2-5-2', number: '2.5.2', title: '功能列表', type: 'table', prompt: '请根据代码中的 Controller/Router/Handler，列出系统的完整功能列表。\nMarkdown 表格格式，列：功能编号、功能模块、功能名称、功能描述、优先级。', children: [] },
                            ],
                        },
                    ],
                },
                {
                    id: 'srs-g-3', number: '3', title: '功能性需求', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-g-3-0', number: '3.0', title: '功能需求概述', type: 'text', prompt: '请根据代码结构概述系统的功能需求分类和组织方式，说明功能编号规则，100-200字。', children: [] },
                        { id: 'srs-g-3-1', number: '3.1', title: '（由 AI 根据代码生成模块名）', type: 'text', prompt: '请根据代码中的第一个核心业务模块，详细描述该模块的功能需求。\n要求：\n1. 模块名称和编号\n2. 模块概述（50-100字）\n3. 子功能需求列表，每个子功能含：功能编号、名称、详细描述（含输入/处理/输出）、优先级\n4. 业务规则和约束条件', children: [] },
                        { id: 'srs-g-3-2', number: '3.2', title: '（由 AI 根据代码生成模块名）', type: 'text', prompt: '请根据代码中的第二个核心业务模块，详细描述其功能需求（格式同上）。', children: [] },
                        { id: 'srs-g-3-3', number: '3.3', title: '（由 AI 根据代码生成模块名）', type: 'text', prompt: '请根据代码中的第三个核心业务模块，详细描述其功能需求（格式同上）。', children: [] },
                        { id: 'srs-g-3-n', number: '3.N', title: '系统管理模块', type: 'text', prompt: '请描述系统管理模块的功能需求，含用户管理、角色管理、权限管理、菜单管理、日志管理等，按功能编号格式组织。', children: [] },
                    ],
                },
                {
                    id: 'srs-g-4', number: '4', title: '非功能性需求', type: 'text', prompt: '',
                    children: [
                        {
                            id: 'srs-g-4-1', number: '4.1', title: '质量需求', type: 'text', prompt: '',
                            children: [
                                { id: 'srs-g-4-1-1', number: '4.1.1', title: '可用性', type: 'text', prompt: '请描述系统可用性需求（输入校验、操作反馈、错误提示、用户引导等），200-300字。', children: [] },
                                { id: 'srs-g-4-1-2', number: '4.1.2', title: '可靠性和健壮性', type: 'text', prompt: '请描述系统可靠性需求。\n1. 可靠性量化指标（可用性 99.x%、故障容忍、缺陷密度）\n2. 健壮性设计要求（操作容错、持续运行保障）\n3. 300-500字', children: [] },
                                { id: 'srs-g-4-1-3', number: '4.1.3', title: '可维护性', type: 'text', prompt: '请描述系统可维护性需求（标准化架构、模块化设计、日志规范、运维工具等），200-300字。', children: [] },
                                { id: 'srs-g-4-1-4', number: '4.1.4', title: '安全性', type: 'text', prompt: '请描述系统安全性需求（身份认证、访问控制、数据加密、防攻击、审计日志等），300-500字。', children: [] },
                            ],
                        },
                        { id: 'srs-g-4-2', number: '4.2', title: '约束条件', type: 'text', prompt: '请根据项目类型描述系统的约束条件（兼容硬件设备型号、第三方系统集成限制、技术栈约束等），200-400字。', children: [] },
                        { id: 'srs-g-4-3', number: '4.3', title: '接口需求', type: 'text', prompt: '请描述系统的外部接口需求（第三方 API 集成、数据交换接口、硬件接口等），列出每个接口的名称、方向、协议、数据格式。', children: [] },
                        {
                            id: 'srs-g-4-4', number: '4.4', title: '技术需求', type: 'text', prompt: '',
                            children: [
                                { id: 'srs-g-4-4-1', number: '4.4.1', title: '软硬件环境需求', type: 'table', prompt: '请描述系统运行的软硬件环境需求。\nMarkdown 表格格式，分类列出：服务器配置（CPU/内存/存储/网络）、软件环境（OS/中间件/数据库/运行时）、客户端要求。', children: [] },
                                { id: 'srs-g-4-4-2', number: '4.4.2', title: '运行保障需求', type: 'text', prompt: '请描述系统运行保障需求。\n1. 硬件保障要求（故障响应、容量规划）\n2. 软件保障要求（问题响应时效、维护要求）\n3. 运维支撑要求（监控、备份）\n4. 300-500字', children: [] },
                            ],
                        },
                    ],
                },
                {
                    id: 'srs-g-5', number: '5', title: '验收标准', type: 'text', prompt: '',
                    children: [
                        { id: 'srs-g-5-1', number: '5.1', title: '功能验收标准', type: 'table', prompt: '请根据功能需求编写功能验收标准。\nMarkdown 表格，列：序号、验收项、验收标准、验证方式、通过条件。', children: [] },
                        { id: 'srs-g-5-2', number: '5.2', title: '性能验收标准', type: 'table', prompt: '请编写性能验收标准。\nMarkdown 表格，列：序号、指标名称、期望值、测试方法、通过条件。', children: [] },
                        { id: 'srs-g-5-3', number: '5.3', title: '交付物清单', type: 'table', prompt: '请列出项目交付物清单。\nMarkdown 表格，列：序号、交付物名称、交付形式、数量、备注。', children: [] },
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
        {
            id: 'sdd-functional',
            name: '功能细化版',
            description: '参照政企项目交付标准，第 4 章按功能编号体系深层嵌套模块设计，含标准规范、接口规范、数据架构和可靠性章节',
            sections: [
                {
                    id: 'sdd-f-1', number: '1', title: '引言', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-f-1-1', number: '1.1', title: '目的', type: 'text', prompt: '请编写本软件设计文档的编写目的。\n要求：\n1. 说明文档在项目中的定位\n2. 明确文档的预期读者（开发团队、项目管理者、测试人员、甲方验收人员）\n3. 200-400字', children: [] },
                        { id: 'sdd-f-1-2', number: '1.2', title: '范围', type: 'text', prompt: '请描述本文档涵盖的系统范围和边界，200-300字。', children: [] },
                        { id: 'sdd-f-1-3', number: '1.3', title: '读者对象', type: 'text', prompt: '请列出本文档的目标读者及各自关注点，以列表格式输出。', children: [] },
                        { id: 'sdd-f-1-4', number: '1.4', title: '术语与缩略语', type: 'table', prompt: '请列出项目中使用的术语和缩略语，Markdown 表格格式，列：术语/缩略语、全称、说明，至少 10 条。', children: [] },
                        { id: 'sdd-f-1-5', number: '1.5', title: '参考资料', type: 'text', prompt: '请列出相关参考资料，编号列表格式，包括国家标准、行业规范和框架文档。', children: [] },
                    ],
                },
                {
                    id: 'sdd-f-2', number: '2', title: '系统概述', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-f-2-1', number: '2.1', title: '系统简介', type: 'text', prompt: '请描述系统的总体定位和核心功能概述，200-400字。', children: [] },
                        { id: 'sdd-f-2-2', number: '2.2', title: '项目目标', type: 'text', prompt: '请描述系统建设的总体目标和 3-5 个分阶段目标，300-500字。', children: [] },
                        { id: 'sdd-f-2-3', number: '2.3', title: '架构原则', type: 'text', prompt: '请总结系统设计遵循的 5-8 条架构原则（如高内聚低耦合、可扩展性等），结合实际技术框架说明。', children: [] },
                        {
                            id: 'sdd-f-2-4', number: '2.4', title: '遵循标准与规范', type: 'text', prompt: '',
                            children: [
                                { id: 'sdd-f-2-4-1', number: '2.4.1', title: '国家法律法规', type: 'text', prompt: '请列出系统需遵循的国家法律法规，编号列表格式。', children: [] },
                                { id: 'sdd-f-2-4-2', number: '2.4.2', title: '行业标准', type: 'text', prompt: '请列出系统需遵循的行业标准（如 GB/T、IEEE 等），编号列表格式。', children: [] },
                                { id: 'sdd-f-2-4-3', number: '2.4.3', title: '安全与隐私规范', type: 'text', prompt: '请列出系统需遵循的安全和隐私保护规范（等保、GDPR 等）。', children: [] },
                                { id: 'sdd-f-2-4-4', number: '2.4.4', title: '质量认证标准', type: 'text', prompt: '请列出系统可能涉及的质量认证标准（ISO 9001、CMMI 等）。', children: [] },
                            ],
                        },
                    ],
                },
                {
                    id: 'sdd-f-3', number: '3', title: '系统架构', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-f-3-1', number: '3.1', title: '总体架构图', type: 'diagram', prompt: '请根据代码结构生成系统总体架构 Mermaid 图（graph TD），展示分层关系，仅输出 Mermaid 代码。', children: [] },
                        { id: 'sdd-f-3-1d', number: '3.1.1', title: '架构说明', type: 'text', prompt: '请为架构图编写文字说明，描述各层职责、技术选型和数据流向，300-500字。', children: [] },
                        { id: 'sdd-f-3-2', number: '3.2', title: '技术选型', type: 'table', prompt: '请以 Markdown 表格列出技术栈，列：类别、技术、版本、用途说明。', children: [] },
                    ],
                },
                {
                    id: 'sdd-f-4', number: '4', title: '模块细化设计', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-f-4-0', number: '4.0', title: '模块设计说明', type: 'text', prompt: '请根据代码结构分析系统的所有功能模块，以表格列出：模块编号、模块名称、核心职责描述，并说明编号规则。', children: [] },
                        { id: 'sdd-f-4-1', number: '4.1', title: '（由 AI 根据代码生成模块名）', type: 'text', prompt: '请根据代码中的第一个核心业务模块编写设计说明。\n要求：\n1. 模块名称和功能编号\n2. 模块职责描述（100-200字）\n3. 子功能列表（含功能编号、名称、说明）\n4. 核心类/组件列表\n5. 模块依赖关系', children: [] },
                        { id: 'sdd-f-4-2', number: '4.2', title: '（由 AI 根据代码生成模块名）', type: 'text', prompt: '请根据代码中的第二个核心业务模块编写设计说明（格式同上）。', children: [] },
                        { id: 'sdd-f-4-3', number: '4.3', title: '（由 AI 根据代码生成模块名）', type: 'text', prompt: '请根据代码中的第三个核心业务模块编写设计说明（格式同上）。', children: [] },
                        { id: 'sdd-f-4-n', number: '4.N', title: '系统管理模块', type: 'text', prompt: '请编写系统管理模块设计说明，含用户管理、角色管理、菜单管理、部门管理、字典管理等子模块，按功能编号格式组织。', children: [] },
                    ],
                },
                {
                    id: 'sdd-f-5', number: '5', title: '接口设计规范', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-f-5-1', number: '5.1', title: '设计原则', type: 'text', prompt: '请描述 API 接口设计原则（RESTful、幂等性、版本管理、错误码规范等），300-500字。', children: [] },
                        { id: 'sdd-f-5-2', number: '5.2', title: '统一响应格式', type: 'text', prompt: '请描述统一响应格式规范，给出成功和错误响应的 JSON 示例，说明状态码规则。', children: [] },
                        { id: 'sdd-f-5-3', number: '5.3', title: '核心接口示例', type: 'table', prompt: '请列出 5-10 个核心接口示例，Markdown 表格，列：路径、方法、描述、请求参数、响应说明。', children: [] },
                    ],
                },
                {
                    id: 'sdd-f-6', number: '6', title: '数据架构设计', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-f-6-1', number: '6.1', title: '数据流设计', type: 'diagram', prompt: '请生成数据流向 Mermaid 图（flowchart），展示数据从输入到存储的流转，仅输出 Mermaid 代码。', children: [] },
                        { id: 'sdd-f-6-2', number: '6.2', title: '数据库设计原则', type: 'text', prompt: '请描述数据库设计原则和规范（命名规范、索引策略、分表策略、备份方案等），300-500字。', children: [] },
                        { id: 'sdd-f-6-3', number: '6.3', title: '核心表结构', type: 'text', prompt: '请列出核心表结构设计，每张表含：表名、用途、主要字段列表（含类型和说明）。', children: [] },
                        { id: 'sdd-f-6-4', number: '6.4', title: 'ER 图', type: 'diagram', prompt: '请生成 ER 图（erDiagram 语法），仅输出 Mermaid 代码。', children: [] },
                    ],
                },
                {
                    id: 'sdd-f-7', number: '7', title: '系统性能与可靠性', type: 'text', prompt: '',
                    children: [
                        { id: 'sdd-f-7-1', number: '7.1', title: '性能指标', type: 'table', prompt: '请编写性能指标表格，列：指标名称、期望值、测试方法，含响应时间、并发、吞吐量、可用性等。', children: [] },
                        { id: 'sdd-f-7-2', number: '7.2', title: '可靠性设计', type: 'text', prompt: '请描述可靠性设计方案（容错、故障恢复、数据备份、监控告警、高可用架构），300-500字。', children: [] },
                    ],
                },
            ],
        },
    ]
}

// ==================== OPS 预设（从独立文件重新导出） ====================

export { getOpsPresets } from './ops-template.js'

// ==================== 测试用例预设 ====================

export function getTestCasePresets() {
    return [
        {
            id: 'tc-standard',
            name: 'GB/T 15532 标准版',
            description: '参照国标的完整测试用例文档，涵盖功能、性能、安全、兼容性测试',
            sections: [
                {
                    id: 'tc-1', number: '1', title: '引言', type: 'text', prompt: '',
                    children: [
                        { id: 'tc-1-1', number: '1.1', title: '编写目的', type: 'text', prompt: '请编写测试用例文档的编写目的。\n说明：本文档的目标、适用范围和预期读者。200-300字。', children: [] },
                        { id: 'tc-1-2', number: '1.2', title: '测试范围', type: 'text', prompt: '请根据项目信息，描述本次测试覆盖的功能范围和模块。\n列出测试对象、测试类型和不在测试范围内的内容。200-400字。', children: [] },
                        { id: 'tc-1-3', number: '1.3', title: '术语定义', type: 'table', prompt: '请列出测试相关的术语和缩略语。\nMarkdown 表格，列：术语、全称、说明。至少 8 条。', children: [] },
                        { id: 'tc-1-4', number: '1.4', title: '参考资料', type: 'text', prompt: '请列出测试相关的参考资料，包括需求文档、设计文档、行业标准（GB/T 15532、GB/T 25000 等）。', children: [] },
                    ],
                },
                {
                    id: 'tc-2', number: '2', title: '测试环境', type: 'text', prompt: '',
                    children: [
                        { id: 'tc-2-1', number: '2.1', title: '硬件环境', type: 'table', prompt: '请列出测试所需的硬件环境。\nMarkdown 表格，列：设备类型、配置要求、数量、用途。', children: [] },
                        { id: 'tc-2-2', number: '2.2', title: '软件环境', type: 'table', prompt: '请根据项目技术栈，列出测试所需的软件环境。\nMarkdown 表格，列：软件名称、版本、用途。', children: [] },
                        { id: 'tc-2-3', number: '2.3', title: '网络环境', type: 'text', prompt: '请描述测试所需的网络环境要求，包括网络拓扑、带宽要求、安全配置等。100-200字。', children: [] },
                    ],
                },
                {
                    id: 'tc-3', number: '3', title: '功能测试用例', type: 'text', prompt: '',
                    children: [
                        { id: 'tc-3-1', number: '3.1', title: '用户管理模块', type: 'table', prompt: '请编写用户管理相关的功能测试用例。\nMarkdown 表格，列：用例编号、用例名称、前置条件、测试步骤、预期结果、优先级。\n至少 5 条用例，涵盖正常流程和异常场景。', children: [] },
                        { id: 'tc-3-2', number: '3.2', title: '核心业务模块', type: 'table', prompt: '请根据项目代码中的核心业务逻辑，编写功能测试用例。\nMarkdown 表格，列：用例编号、用例名称、前置条件、测试步骤、预期结果、优先级。\n至少 8 条用例。', children: [] },
                        { id: 'tc-3-3', number: '3.3', title: '数据管理模块', type: 'table', prompt: '请编写数据增删改查相关的测试用例。\nMarkdown 表格，列：用例编号、用例名称、前置条件、测试步骤、预期结果、优先级。\n至少 5 条用例。', children: [] },
                    ],
                },
                {
                    id: 'tc-4', number: '4', title: '性能测试用例', type: 'table',
                    prompt: '请编写性能测试用例。\nMarkdown 表格，列：用例编号、测试场景、并发用户数、持续时间、性能指标、通过标准。\n包含：页面响应时间、接口吞吐量、并发处理、数据库查询等场景，至少 5 条。',
                    children: [],
                },
                {
                    id: 'tc-5', number: '5', title: '安全测试用例', type: 'table',
                    prompt: '请编写安全测试用例。\nMarkdown 表格，列：用例编号、用例名称、测试类别、测试步骤、预期结果。\n涵盖：SQL 注入、XSS、CSRF、越权访问、敏感信息泄露等，至少 6 条。',
                    children: [],
                },
                {
                    id: 'tc-6', number: '6', title: '兼容性测试用例', type: 'table',
                    prompt: '请编写兼容性测试用例。\nMarkdown 表格，列：用例编号、测试环境、浏览器/设备、测试项、预期结果。\n涵盖主流浏览器和设备兼容性，至少 5 条。',
                    children: [],
                },
            ],
        },
        {
            id: 'tc-simple',
            name: '精简版',
            description: '适用于中小项目的精简测试用例文档',
            sections: [
                { id: 'tc-s-1', number: '1', title: '测试概述', type: 'text', prompt: '请编写测试概述，包含测试目的、测试范围、测试方法。300-500字。', children: [] },
                {
                    id: 'tc-s-2', number: '2', title: '测试环境', type: 'table',
                    prompt: '请列出测试环境信息。\nMarkdown 表格，列：类别、名称、版本/配置、说明。包含硬件和软件环境。',
                    children: [],
                },
                {
                    id: 'tc-s-3', number: '3', title: '功能测试用例', type: 'table',
                    prompt: '请根据项目功能，编写功能测试用例。\nMarkdown 表格，列：编号、功能模块、用例名称、测试步骤、预期结果、优先级。\n至少 15 条，覆盖主要功能。',
                    children: [],
                },
                {
                    id: 'tc-s-4', number: '4', title: '异常测试用例', type: 'table',
                    prompt: '请编写异常场景的测试用例。\nMarkdown 表格，列：编号、异常场景、测试步骤、预期结果。\n包含：输入校验、边界值、网络异常、权限控制等，至少 8 条。',
                    children: [],
                },
            ],
        },
        {
            id: 'tc-acceptance',
            name: '验收测试版',
            description: '面向验收阶段的测试用例文档',
            sections: [
                { id: 'tc-a-1', number: '1', title: '验收测试目的', type: 'text', prompt: '请编写验收测试的目的和背景。说明验收标准依据和验收流程。200-300字。', children: [] },
                {
                    id: 'tc-a-2', number: '2', title: '验收标准', type: 'text',
                    prompt: '请编写系统验收的总体标准，包括功能完整性、性能达标、安全合规、文档齐全等方面的要求。300-500字。',
                    children: [],
                },
                {
                    id: 'tc-a-3', number: '3', title: '功能验收用例', type: 'table',
                    prompt: '请编写功能验收用例。\nMarkdown 表格，列：编号、验收项、验收内容、验收标准、验证方式。\n至少 10 条。',
                    children: [],
                },
                {
                    id: 'tc-a-4', number: '4', title: '性能验收用例', type: 'table',
                    prompt: '请编写性能验收用例。\nMarkdown 表格，列：编号、指标名称、期望值、测试方法、通过条件。\n至少 5 条。',
                    children: [],
                },
                {
                    id: 'tc-a-5', number: '5', title: '验收结论模板', type: 'text',
                    prompt: '请编写验收结论模板，包含验收结果汇总、遗留问题、改进建议、验收意见等部分。留出签字区域占位。300-500字。',
                    children: [],
                },
            ],
        },
    ]
}

// ==================== 测试记录预设 ====================

export function getTestRecordPresets() {
    return [
        {
            id: 'tr-standard',
            name: '标准版',
            description: '完整的测试执行记录文档，包含执行记录、缺陷汇总和统计分析',
            sections: [
                {
                    id: 'tr-1', number: '1', title: '引言', type: 'text', prompt: '',
                    children: [
                        { id: 'tr-1-1', number: '1.1', title: '测试目的', type: 'text', prompt: '请编写本次测试的目的和背景。说明测试阶段、测试类型和验证目标。200-300字。', children: [] },
                        { id: 'tr-1-2', number: '1.2', title: '测试范围', type: 'text', prompt: '请描述本次测试覆盖的功能模块和测试类型。150-250字。', children: [] },
                    ],
                },
                {
                    id: 'tr-2', number: '2', title: '测试环境', type: 'table',
                    prompt: '请列出本次测试使用的环境配置。\nMarkdown 表格，列：类别、名称、版本/配置。包含服务器、操作系统、数据库、浏览器等。',
                    children: [],
                },
                {
                    id: 'tr-3', number: '3', title: '测试执行记录', type: 'table',
                    prompt: '请根据导入的测试数据，生成测试执行记录表格。\nMarkdown 表格，列：编号、用例名称、执行时间、测试人员、实际结果、是否通过、备注。\n如果有导入的 Excel 数据，请基于实际数据填写。',
                    children: [],
                },
                {
                    id: 'tr-4', number: '4', title: '缺陷汇总', type: 'table',
                    prompt: '请根据测试执行中发现的问题，生成缺陷汇总表格。\nMarkdown 表格，列：缺陷编号、严重程度（致命/严重/一般/轻微）、缺陷描述、所属模块、状态（已修复/待修复/暂不处理）。',
                    children: [],
                },
                {
                    id: 'tr-5', number: '5', title: '测试统计', type: 'text', prompt: '',
                    children: [
                        { id: 'tr-5-1', number: '5.1', title: '用例执行统计', type: 'text', prompt: '请根据测试执行记录，统计用例执行情况。包含：总用例数、通过数、失败数、未执行数、通过率。以数据概览方式呈现。', children: [] },
                        { id: 'tr-5-2', number: '5.2', title: '缺陷分布分析', type: 'text', prompt: '请分析缺陷分布情况，包括：按严重程度分布、按功能模块分布。给出分析结论。', children: [] },
                    ],
                },
                {
                    id: 'tr-6', number: '6', title: '测试结论', type: 'text',
                    prompt: '请根据测试执行结果，编写测试结论。包含：总体评价、质量评估、遗留问题、风险分析和发布建议。300-500字。',
                    children: [],
                },
            ],
        },
        {
            id: 'tr-simple',
            name: '精简版',
            description: '适用于快速记录的精简测试报告',
            sections: [
                { id: 'tr-s-1', number: '1', title: '测试概述', type: 'text', prompt: '请编写测试概述，包含测试目的、范围、环境和方法。300-400字。', children: [] },
                {
                    id: 'tr-s-2', number: '2', title: '测试执行记录', type: 'table',
                    prompt: '请根据导入的测试数据生成测试执行记录。\nMarkdown 表格，列：编号、测试项、实际结果、是否通过、备注。',
                    children: [],
                },
                {
                    id: 'tr-s-3', number: '3', title: '测试结论', type: 'text',
                    prompt: '请编写测试结论。包含通过率统计、主要问题、质量评估和建议。200-400字。',
                    children: [],
                },
            ],
        },
    ]
}

