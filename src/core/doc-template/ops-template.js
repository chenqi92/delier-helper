/**
 * 运维手册模板预设定义
 */
import { createSectionNode, toTemplateSkeleton } from './template-presets.js'
import { renumberSections } from './srs-template.js'

/**
 * 创建默认运维手册模板
 */
export function createOpsTemplate() {
    return getOpsPresets()[0].sections.map(s => createSectionNode(s))
}

/**
 * 运维手册预设列表
 */
export function getOpsPresets() {
    return [
        {
            id: 'ops-standard',
            name: '标准运维手册',
            description: '完整的服务器运维手册，含系统架构、基础设施、应用运维、部署更新、日志管理、故障排查等章节',
            sections: [
                {
                    id: 'ops-1', number: '1', title: '前言', type: 'text', prompt: '请根据项目信息编写运维手册前言。\n要求：\n1. 目的：为规范本系统服务器的运维操作，明确运维流程、标准及注意事项\n2. 适用范围：适用于负责该系统服务器运维的所有工作人员\n3. 责任说明：运维人员需严格按照手册规定执行操作\n4. 200-400字',
                    children: [],
                },
                {
                    id: 'ops-2', number: '2', title: '系统架构', type: 'text', prompt: '',
                    children: [
                        {
                            id: 'ops-2-1', number: '2.1', title: '架构概述', type: 'table',
                            prompt: '请根据代码结构和服务器信息，编写系统架构概述。\n要求：\n1. 以 Markdown 表格格式输出，列：项目、详情\n2. 包含行：项目名称、版本、核心功能、适用场景\n3. 描述系统的整体架构模式（如 B/S 架构、微服务等）\n4. 表格之前加一段 50-100 字的概述文字',
                            children: [],
                        },
                        {
                            id: 'ops-2-2', number: '2.2', title: '核心组件', type: 'table',
                            prompt: '请根据代码结构和服务器扫描信息，列出系统核心组件。\n要求：\n1. Markdown 表格，列：组件类型、具体内容及说明\n2. 分行列出：前端组件、后端组件、数据库组件、中间件、对象存储（如有）\n3. 每行描述技术栈、版本和功能',
                            children: [],
                        },
                        {
                            id: 'ops-2-3', number: '2.3', title: '运行环境', type: 'text', prompt: '',
                            children: [
                                {
                                    id: 'ops-2-3-1', number: '2.3.1', title: '硬件环境', type: 'table',
                                    prompt: '请根据服务器扫描信息，列出系统的硬件部署环境。\n要求：\n1. Markdown 表格，列：服务器角色、内网 IP、SSH 端口、操作系统、备注\n2. 列出所有服务器及其功能角色\n3. 备注中说明安装的核心服务和基础目录',
                                    children: [],
                                },
                                {
                                    id: 'ops-2-3-2', number: '2.3.2', title: '软件环境', type: 'table',
                                    prompt: '请根据服务器扫描到的软件版本信息，列出系统依赖的软件环境。\n要求：\n1. Markdown 表格，列：软件、版本、说明\n2. 包括所有中间件、运行时、数据库等',
                                    children: [],
                                },
                            ],
                        },
                    ],
                },
                {
                    id: 'ops-3', number: '3', title: '基础设施配置', type: 'text', prompt: '',
                    children: [
                        {
                            id: 'ops-3-1', number: '3.1', title: '服务配置总览', type: 'table',
                            prompt: '请根据服务器上检测到的服务、端口和安装路径，生成服务配置总览表。\n要求：\n1. Markdown 表格，列：服务器 IP、服务名称、版本、端口、安装目录\n2. 列出所有检测到的服务（后端微服务、中间件、前端等）\n3. 版本信息从服务器扫描结果中提取\n4. 不要包含登录账号密码信息',
                            children: [],
                        },
                        {
                            id: 'ops-3-2', number: '3.2', title: '目录配备与硬盘挂载', type: 'text',
                            prompt: '请根据服务器扫描的目录结构和磁盘信息，描述目录配备和硬盘挂载情况。\n要求：\n1. 列出基础目录\n2. 用树形结构展示目录层级（使用代码块）\n3. 如有逻辑卷，说明扩容方法\n4. 300-600字',
                            children: [],
                        },
                    ],
                },
                {
                    id: 'ops-4', number: '4', title: '应用运维', type: 'text', prompt: '',
                    children: [
                        {
                            id: 'ops-4-1', number: '4.1', title: '微服务管理', type: 'text',
                            prompt: '请根据服务器扫描到的 systemd 服务和 Docker 容器信息，编写微服务管理章节。\n要求：\n1. 列出所有后端微服务表格（编号、服务名称、端口、说明）\n2. 判断服务管理方式（systemd/docker/手动启动脚本）\n3. 提供启动、停止、重启、查看状态的命令示例\n4. 如使用 systemd，提供开机自启管理命令\n5. 如使用 systemd，给出服务配置示例\n6. 使用 bash 代码块展示命令',
                            children: [],
                        },
                        {
                            id: 'ops-4-2', number: '4.2', title: '部署管理脚本', type: 'text',
                            prompt: '请根据代码库中的部署脚本（deploy 目录下的 .sh/.ps1 文件），描述部署管理脚本的使用方式。\n要求：\n1. 列出脚本位置和运行方式\n2. 如有菜单式脚本，列出功能菜单表格\n3. 说明推荐的操作流程\n4. 如没有检测到部署脚本，生成通用的部署脚本建议',
                            children: [],
                        },
                        {
                            id: 'ops-4-3', number: '4.3', title: 'Nginx 管理', type: 'text',
                            prompt: '请根据服务器 Nginx 配置信息，编写 Nginx 管理章节。\n要求：\n1. 重启和重新加载配置的命令（使用 bash 代码块）\n2. 配置文件检查命令\n3. 补充说明和注意事项\n4. 如未检测到 Nginx，跳过或生成通用内容',
                            children: [],
                        },
                        {
                            id: 'ops-4-4', number: '4.4', title: '数据库管理', type: 'text',
                            prompt: '请根据服务器上的数据库信息（MySQL/PostgreSQL/MongoDB 等），编写数据库管理章节。\n要求：\n1. 说明数据库部署位置和端口\n2. 提供重启、连接命令（本地和远程）\n3. 使用 bash 代码块展示命令\n4. 添加注意事项（备份建议等）',
                            children: [],
                        },
                        {
                            id: 'ops-4-5', number: '4.5', title: '缓存服务管理', type: 'text',
                            prompt: '请根据服务器上的 Redis 或其他缓存服务信息，编写缓存服务管理章节。\n要求：\n1. 说明部署位置和端口\n2. 提供重启、状态检查、连接命令\n3. 如未检测到缓存服务，省略或生成建议',
                            children: [],
                        },
                        {
                            id: 'ops-4-6', number: '4.6', title: '其他中间件管理', type: 'text',
                            prompt: '请根据服务器扫描结果，列出其他检测到的中间件（如 EMQX、Nacos、SRS、MinIO、RabbitMQ、Kafka 等），并为每个编写管理操作。\n要求：\n1. 每个中间件说明部署位置、端口\n2. 提供启动/停止/重启命令\n3. 提供 Web 管理界面访问地址（如有）\n4. 如未检测到额外中间件，简要说明',
                            children: [],
                        },
                    ],
                },
                {
                    id: 'ops-5', number: '5', title: '部署更新', type: 'text', prompt: '',
                    children: [
                        {
                            id: 'ops-5-1', number: '5.1', title: '后端服务更新', type: 'text',
                            prompt: '请根据项目类型（Java JAR/Go/Node.js/Docker 等）和部署方式，编写后端服务更新步骤。\n要求：\n1. 提供自动化脚本方式（如有检测到部署脚本）\n2. 提供手动更新步骤（停止→备份→上传→赋权→启动→检查）\n3. 使用 bash 代码块展示命令',
                            children: [],
                        },
                        {
                            id: 'ops-5-2', number: '5.2', title: '前端更新', type: 'text',
                            prompt: '请根据前端部署路径和 Nginx 配置，编写前端更新步骤。\n要求：\n1. 说明前端部署路径和访问路径\n2. 提供更新步骤（备份→上传→重载 Nginx）\n3. 使用 bash 代码块展示命令',
                            children: [],
                        },
                        {
                            id: 'ops-5-3', number: '5.3', title: '版本回滚', type: 'text',
                            prompt: '请编写版本回滚操作步骤。\n要求：\n1. 使用脚本回滚（如有）\n2. 手动回滚步骤（停止→查看备份→恢复→启动）\n3. 使用 bash 代码块展示命令',
                            children: [],
                        },
                    ],
                },
                {
                    id: 'ops-6', number: '6', title: '访问地址与 Nginx 配置', type: 'text', prompt: '',
                    children: [
                        {
                            id: 'ops-6-1', number: '6.1', title: '访问地址汇总', type: 'table',
                            prompt: '请根据 Nginx 配置，汇总所有访问地址。\n要求：\n1. Markdown 表格，列：用途、访问地址\n2. 列出所有对外服务地址（管理后台、大屏、API、文档等）\n3. 访问地址中可以包含外网 IP 和端口',
                            children: [],
                        },
                        {
                            id: 'ops-6-2', number: '6.2', title: '配置详情', type: 'text',
                            prompt: '请根据服务器上读取到的 Nginx 配置内容，提取并整理关键配置块。\n要求：\n1. 按端口/功能分组展示（如后台管理端、大屏展示端、API 代理等）\n2. 使用 nginx 代码块展示配置\n3. 说明每个 upstream 和 location 的用途',
                            children: [],
                        },
                    ],
                },
                {
                    id: 'ops-7', number: '7', title: '日志管理', type: 'text', prompt: '',
                    children: [
                        {
                            id: 'ops-7-1', number: '7.1', title: '日志配置', type: 'text',
                            prompt: '请根据项目类型推断日志配置方案。\n要求：\n1. 描述日志框架（logback/log4j2/winston 等）\n2. 说明日志分割、压缩、保留策略\n3. 说明日志分类（全部日志、错误日志、警告日志）\n4. 200-400字',
                            children: [],
                        },
                        {
                            id: 'ops-7-2', number: '7.2', title: '日志目录结构', type: 'text',
                            prompt: '请根据服务器扫描的目录结构，描述日志目录结构。使用代码块展示目录树。',
                            children: [],
                        },
                        {
                            id: 'ops-7-3', number: '7.3', title: '日志查看', type: 'text',
                            prompt: '请编写日志查看的常用命令。\n要求：\n1. 实时日志查看（tail -f）\n2. 错误日志查看\n3. journalctl 方式（如使用 systemd）\n4. 使用 bash 代码块展示命令',
                            children: [],
                        },
                        {
                            id: 'ops-7-4', number: '7.4', title: '日志清理', type: 'text',
                            prompt: '请编写日志清理命令和策略。\n要求：\n1. 清理超过指定天数的历史日志\n2. 查看日志占用空间\n3. 使用 bash 代码块展示命令',
                            children: [],
                        },
                    ],
                },
                {
                    id: 'ops-8', number: '8', title: '运维规范', type: 'text', prompt: '',
                    children: [
                        {
                            id: 'ops-8-1', number: '8.1', title: '运维注意事项', type: 'text',
                            prompt: '请编写运维注意事项。\n要求包含以下方面：\n1. 权限管理\n2. 操作记录\n3. 数据备份\n4. 日志管理\n5. 安全防护\n6. 故障处理\n每项 50-100 字，使用列表格式',
                            children: [],
                        },
                        {
                            id: 'ops-8-2', number: '8.2', title: '定期检查项目', type: 'table',
                            prompt: '请编写定期检查项目表格。\n要求：\n1. Markdown 表格，列：检查项、频率、操作\n2. 包含：服务状态（每日）、磁盘空间（每周）、日志清理（每月）、数据库备份（每日）、系统安全（每月）、证书有效期（每季度）',
                            children: [],
                        },
                    ],
                },
                {
                    id: 'ops-9', number: '9', title: '常见故障排查', type: 'table',
                    prompt: '请根据系统架构和使用的技术栈，编写常见故障排查表。\n要求：\n1. Markdown 表格，列：故障现象、排查步骤、解决方案\n2. 每个单元格内容简洁，不超过 80 字，不要使用换行\n3. 覆盖：Nginx 无法启动、数据库连接失败、后端应用无法启动、端口未监听、前端页面白屏、磁盘空间不足等\n4. 根据实际使用的中间件增加对应的故障排查项',
                    children: [],
                },
                {
                    id: 'ops-10', number: '10', title: '附则', type: 'text',
                    prompt: '请编写运维手册附则。\n要求：\n1. 手册生效说明\n2. 修订和完善说明\n3. 问题反馈说明\n4. 以编号列表格式输出，3 条即可',
                    children: [],
                },
            ],
        },
        {
            id: 'ops-simple',
            name: '精简运维手册',
            description: '保留核心运维章节，去掉 Nginx 配置细节和运维规范，适用于简单部署项目',
            sections: [
                {
                    id: 'ops-s-1', number: '1', title: '前言', type: 'text',
                    prompt: '请编写精简版运维手册前言，100-200字。',
                    children: [],
                },
                {
                    id: 'ops-s-2', number: '2', title: '系统架构', type: 'text', prompt: '',
                    children: [
                        { id: 'ops-s-2-1', number: '2.1', title: '架构概述', type: 'text', prompt: '请简要描述系统架构和技术栈，200-300字。', children: [] },
                        {
                            id: 'ops-s-2-2', number: '2.2', title: '运行环境', type: 'text', prompt: '',
                            children: [
                                { id: 'ops-s-2-2-1', number: '2.2.1', title: '硬件环境', type: 'table', prompt: '请根据服务器扫描信息，列出硬件部署环境表格。\n列：服务器角色、内网 IP、SSH 端口、操作系统、备注', children: [] },
                                { id: 'ops-s-2-2-2', number: '2.2.2', title: '软件环境', type: 'table', prompt: '请根据服务器扫描到的软件版本信息，列出软件环境表格。\n列：软件、版本、说明', children: [] },
                            ],
                        },
                    ],
                },
                {
                    id: 'ops-s-3', number: '3', title: '服务配置', type: 'text', prompt: '',
                    children: [
                        { id: 'ops-s-3-1', number: '3.1', title: '服务列表', type: 'table', prompt: '请列出服务配置总览表格，列：服务名、端口、安装目录。', children: [] },
                        { id: 'ops-s-3-2', number: '3.2', title: '目录结构', type: 'text', prompt: '请说明服务器目录结构。', children: [] },
                    ],
                },
                {
                    id: 'ops-s-4', number: '4', title: '应用运维', type: 'text', prompt: '',
                    children: [
                        { id: 'ops-s-4-1', number: '4.1', title: '服务管理', type: 'text', prompt: '请编写服务的启动、停止、重启命令。', children: [] },
                        { id: 'ops-s-4-2', number: '4.2', title: '部署更新', type: 'text', prompt: '请编写服务更新和前端更新步骤。', children: [] },
                    ],
                },
                {
                    id: 'ops-s-5', number: '5', title: '故障排查', type: 'table',
                    prompt: '请编写 5-8 条常见故障排查表格，列：故障现象、排查步骤、解决方案。每个单元格内容简洁不超过 80 字。',
                    children: [],
                },
            ],
        },
    ]
}
