/**
 * 运维手册专用 LLM 服务
 * 构建包含服务器扫描信息的上下文，供 AI 生成运维手册内容
 */
import { renderTreeAsText } from './codebase-scanner.js'
import { fillDocSections, createAiController } from './doc-llm-service.js'
import { callLlm } from '../llm/llm-service.js'

/**
 * 为运维手册章节构建 LLM prompt
 */
export function buildOpsSectionPrompt(section, contextSummary, docInfo = {}) {
    const systemMsg = `你是一个资深的 Linux 服务器运维工程师，正在编写「${docInfo.docTitle || '服务器运维手册'}」。
请根据用户提供的项目代码结构、服务器扫描信息（包括运行中的服务、端口、软件版本等），为文档的指定章节生成专业的运维内容。

输出要求：
1. 使用正式的技术文档语言，适合运维人员阅读
2. 直接输出章节内容，不要带章节编号和标题前缀（用户已有标题）
3. 如果是表格类型，使用标准 Markdown 表格格式：
   - 每个单元格内容必须在一行内完成，绝对不要在单元格中使用换行
   - 每个单元格内容不超过 80 字，保持简洁
   - 单元格中不要嵌入代码块（\`\`\`），如需命令请用行内代码 \`command\`
   - 不要在表格单元格中使用编号列表
   - 严禁在单元格内容中使用 | 管道符号，多个值请用顿号（、）或逗号分隔
4. 代码块请使用 \`\`\`bash 或对应语言的代码块格式（仅在非表格内容中使用）
5. 命令行操作使用 bash 代码块
6. 不要输出任何解释性前言或总结（例如"以下是..."）
7. 严禁使用任何 HTML 标签（如 <br>、<code>、<strong> 等），只使用纯 Markdown 格式
8. 内容要紧凑，避免不必要的空行和冗余说明
9. 保持内容实用、可操作，运维人员可以直接照做

安全规则（必须严格遵守）：
- 内网 IP（10.x.x.x、172.16-31.x.x、192.168.x.x）和端口可以正常出现在文档中
- 在「访问地址」「对外服务地址」「Web 管理界面地址」等场景中，外网/公网 IP 可以正常出现
- 在服务器配置总览、硬件环境等内部管理表格中，不要列出外网 IP 列
- 严禁出现密码、API Key、Token、Secret 等敏感信息，一律使用 \`********\` 占位
- 严禁出现数据库连接密码、SSH 密码、登录凭证等
- 不要在文档中放置完整的 SSH 登录参数（IP+端口+账号+密码的组合）
- 用户名可以保留（如 root、admin），但密码必须屏蔽`

    const userMsg = `${contextSummary}

---

## 当前章节
- 编号：${section.number}
- 标题：${section.title}
- 类型：${section.type === 'table' ? '表格（请输出 Markdown 表格）' : section.type === 'diagram' ? '流程图/架构图（请输出 Mermaid 代码）' : '正文'}

## 生成要求
${section.prompt}`

    return [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
    ]
}

/**
 * 构建运维手册上下文摘要
 * 除代码扫描结果外，额外注入服务器扫描信息
 *
 * @param {Object|null} scanResult - 代码库扫描结果（可为 null）
 * @param {Array} serverInfos - 服务器扫描结果列表 [{alias, host, port, serverData}]
 * @param {Object} docInfo - 文档信息
 * @param {Array} referenceFiles - 辅助参考文件
 */
export function buildOpsContextSummary(scanResult, serverInfos = [], docInfo = {}, referenceFiles = []) {
    const parts = []

    // 项目基本信息
    if (docInfo.projectName) {
        parts.push(`## 项目信息`)
        parts.push(`- 项目名称: ${docInfo.projectName}`)
        if (docInfo.version) parts.push(`- 版本: ${docInfo.version}`)
        if (docInfo.author) parts.push(`- 编写人: ${docInfo.author}`)
        if (docInfo.organization) parts.push(`- 编写单位: ${docInfo.organization}`)
        parts.push('')
    }

    // 代码目录结构
    if (scanResult && scanResult.trees && scanResult.trees.length > 0) {
        parts.push('## 代码目录结构')
        parts.push('```')
        parts.push(renderTreeAsText(scanResult.trees, 150))
        parts.push('```\n')

        // 文件统计
        parts.push('## 文件统计')
        parts.push(`- 总文件数: ${scanResult.stats.totalFiles}`)
        parts.push(`- 总目录数: ${scanResult.stats.totalDirs}`)
        const langEntries = Object.entries(scanResult.stats.languages).sort((a, b) => b[1] - a[1])
        if (langEntries.length > 0) {
            parts.push('- 语言分布:')
            for (const [lang, count] of langEntries.slice(0, 10)) {
                parts.push(`  - ${lang}: ${count} 个文件`)
            }
        }
        parts.push('')

        // 发现的模块
        if (scanResult.modules && scanResult.modules.length > 0) {
            parts.push('## 发现的模块')
            for (const mod of scanResult.modules) {
                parts.push(`- **${mod.name}** (${mod.type}): ${mod.path} (${mod.fileCount} 个文件)`)
            }
            parts.push('')
        }

        // 配置文件
        if (scanResult.configs && scanResult.configs.length > 0) {
            parts.push('## 配置文件')
            for (const cfg of scanResult.configs.slice(0, 5)) {
                parts.push(`### ${cfg.name} (${cfg.path})`)
                parts.push('```')
                parts.push(cfg.content)
                parts.push('```\n')
            }
        }
    }

    // 服务器扫描信息（关键增量）
    if (serverInfos && serverInfos.length > 0) {
        parts.push('## 服务器扫描信息')
        parts.push(`共扫描 ${serverInfos.length} 台服务器：\n`)

        for (const server of serverInfos) {
            const d = server.serverData
            if (!d) continue

            parts.push(`### 服务器: ${server.alias || d.hostname || server.host}`)
            parts.push(`- **主机**: ${server.host}:${server.port}`)

            if (d.hostname) parts.push(`- **主机名**: ${d.hostname}`)
            if (d.uptime) parts.push(`- **运行时间**: ${d.uptime}`)

            // OS 信息
            if (d.osInfo) {
                const prettyName = d.osInfo.match(/PRETTY_NAME="(.+?)"/)?.[1]
                parts.push(`- **操作系统**: ${prettyName || d.osInfo.split('\n')[0]}`)
            }

            // 硬件信息
            if (d.cpuInfo) {
                const cpuCount = d.cpuInfo.split('\n')[0]?.trim()
                const cpuModel = d.cpuInfo.match(/model name\s*:\s*(.+)/)?.[1]
                parts.push(`- **CPU**: ${cpuCount} 核${cpuModel ? ' (' + cpuModel.trim() + ')' : ''}`)
            }
            if (d.memoryInfo) {
                const memLine = d.memoryInfo.split('\n').find(l => l.startsWith('Mem:'))
                if (memLine) parts.push(`- **内存**: ${memLine}`)
            }

            // 磁盘
            if (d.diskInfo) {
                parts.push('\n**磁盘信息**:')
                parts.push('```')
                parts.push(d.diskInfo.split('\n').slice(0, 10).join('\n'))
                parts.push('```')
            }

            // LVM 磁盘布局
            if (d.lvmInfo && d.lvmInfo.trim() && !d.lvmInfo.includes('command not found')) {
                parts.push('\n**LVM 磁盘布局**:')
                parts.push('```')
                parts.push(d.lvmInfo.trim())
                parts.push('```')
            }

            // 网络接口
            if (d.networkInterfaces && d.networkInterfaces.trim()) {
                parts.push('\n**网络接口**:')
                parts.push('```')
                parts.push(d.networkInterfaces.trim().split('\n').slice(0, 30).join('\n'))
                parts.push('```')
            }

            // 软件版本
            if (d.softwareVersions) {
                const versions = d.softwareVersions
                const installed = Object.entries(versions)
                    .filter(([, v]) => v && !v.includes('not installed') && v.trim() !== '')
                if (installed.length > 0) {
                    parts.push('\n**已安装软件**:')
                    for (const [name, version] of installed) {
                        parts.push(`- ${name}: ${version}`)
                    }
                }
            }

            // 软件安装路径
            if (d.softwarePaths && d.softwarePaths.trim()) {
                parts.push('\n**软件安装路径**:')
                parts.push('```')
                parts.push(d.softwarePaths.trim())
                parts.push('```')
            }

            // JAR/WAR 应用文件
            if (d.appFiles && d.appFiles.trim()) {
                parts.push('\n**发现的应用文件 (JAR/WAR)**:')
                parts.push('```')
                parts.push(d.appFiles.trim())
                parts.push('```')
            }

            // 部署脚本
            if (d.deployScripts && d.deployScripts.trim()) {
                parts.push('\n**部署/启动脚本**:')
                parts.push('```')
                parts.push(d.deployScripts.trim())
                parts.push('```')
            }

            // systemd 服务
            if (d.systemdServices && d.systemdServices.trim()) {
                parts.push('\n**运行中的 systemd 服务**:')
                parts.push('```')
                parts.push(d.systemdServices.trim().split('\n').slice(0, 30).join('\n'))
                parts.push('```')
            }

            // systemd 服务配置详情
            if (d.systemdServiceConfigs && d.systemdServiceConfigs.trim()) {
                parts.push('\n**自定义 systemd 服务配置**:')
                parts.push('```ini')
                parts.push(d.systemdServiceConfigs.trim().split('\n').slice(0, 100).join('\n'))
                parts.push('```')
            }

            // 关键进程运行参数
            if (d.javaProcesses && d.javaProcesses.trim()) {
                parts.push('\n**关键进程运行参数**:')
                parts.push('```')
                parts.push(d.javaProcesses.trim())
                parts.push('```')
            }

            // Docker 容器
            if (d.dockerContainers && d.dockerContainers.trim()) {
                parts.push('\n**Docker 容器**:')
                parts.push('```')
                parts.push(d.dockerContainers.trim())
                parts.push('```')
            }

            // docker-compose 配置文件路径
            if (d.dockerComposeConfigs && d.dockerComposeConfigs.trim()) {
                parts.push('\n**Docker Compose 配置文件**:')
                parts.push('```')
                parts.push(d.dockerComposeConfigs.trim())
                parts.push('```')
            }

            // 监听端口
            if (d.listeningPorts && d.listeningPorts.trim()) {
                parts.push('\n**监听端口**:')
                parts.push('```')
                parts.push(d.listeningPorts.trim().split('\n').slice(0, 30).join('\n'))
                parts.push('```')
            }

            // Nginx 配置
            if (d.nginxConfig && d.nginxConfig.trim()) {
                parts.push('\n**Nginx 配置摘要**:')
                parts.push('```nginx')
                parts.push(d.nginxConfig.trim().split('\n').slice(0, 100).join('\n'))
                parts.push('```')
            }

            // 定时任务
            if (d.crontabInfo && d.crontabInfo.trim()) {
                parts.push('\n**定时任务**:')
                parts.push('```')
                parts.push(d.crontabInfo.trim())
                parts.push('```')
            }

            // 防火墙规则
            if (d.firewallRules && d.firewallRules.trim() && !d.firewallRules.includes('no firewall detected')) {
                parts.push('\n**防火墙规则**:')
                parts.push('```')
                parts.push(d.firewallRules.trim().split('\n').slice(0, 30).join('\n'))
                parts.push('```')
            }

            // 目录结构
            if (d.dirStructure && d.dirStructure.trim()) {
                parts.push('\n**部署目录结构**:')
                parts.push('```')
                parts.push(d.dirStructure.trim().split('\n').slice(0, 50).join('\n'))
                parts.push('```')
            }

            parts.push('')
        }
    }

    // 辅助参考文件
    if (referenceFiles && referenceFiles.length > 0) {
        const validFiles = referenceFiles.filter(f => f.content && !f.error)
        if (validFiles.length > 0) {
            parts.push('## 参考文档')
            parts.push('以下是用户提供的参考文档内容，请在生成运维文档时参考这些内容，确保生成的内容与参考文档保持一致：\n')
            for (const file of validFiles) {
                parts.push(`### ${file.name}`)
                parts.push(file.content)
                parts.push('')
            }
        }
    }

    return parts.join('\n')
}

// 重新导出便捷引用
export { fillDocSections, createAiController }
