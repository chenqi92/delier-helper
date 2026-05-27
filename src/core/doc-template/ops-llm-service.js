/**
 * 运维手册专用 LLM 服务
 * 构建包含服务器扫描信息的上下文，供 AI 生成运维手册内容
 */
import { renderTreeAsText } from './codebase-scanner.js'
import { fillDocSections, createAiController } from './doc-llm-service.js'
import { callLlm } from '../llm/llm-service.js'

const OPS_FEW_SHOT_PROSE = `## 示例（运维正文）
错误：本系统部署在 Linux 服务器上，运行稳定，性能良好。
正确：应用以 systemd 服务方式运行于 192.168.10.21，服务名 \`app-order\`，启动后驻留进程 1 个，监听 0.0.0.0:8081；日志写入 /var/log/app-order/，按天滚动保留 30 天。日常巡检关注三项：systemd 状态、端口监听、磁盘剩余空间（阈值 20%）。`

const OPS_FEW_SHOT_TABLE = `## 示例（运维表格）
| 服务名 | 端口 | 启动方式 | 日志路径 | 巡检命令 |
| --- | --- | --- | --- | --- |
| app-order | 8081 | systemd | /var/log/app-order/ | \`systemctl status app-order\` |
| nginx | 80、443 | systemd | /var/log/nginx/ | \`nginx -t\` |
| redis | 6379 | systemd | /var/log/redis/ | \`redis-cli ping\` |`

/**
 * 为运维手册章节构建 LLM prompt
 */
export function buildOpsSectionPrompt(section, contextSummary, docInfo = {}, previousSummaries = []) {
    const docTitle = docInfo.docTitle || '服务器运维手册'
    const audience = '甲方运维团队、值班工程师、故障应急人员'
    const sectionType = section.type === 'table' ? '表格（Markdown 表格）'
        : section.type === 'diagram' ? '流程图/架构图（Mermaid 代码）'
        : '正文'
    const fewShot = section.type === 'table' ? OPS_FEW_SHOT_TABLE
        : section.type === 'diagram' ? `## 示例（部署架构图）
flowchart TB
  subgraph 内网 192.168.10.0/24
    LB[Nginx<br>192.168.10.20:443]
    APP[(应用集群<br>192.168.10.21-23:8081)]
    DB[(MySQL<br>192.168.10.30:3306)]
    REDIS[(Redis<br>192.168.10.31:6379)]
  end
  USER[运维终端] --SSH--> LB
  LB --> APP
  APP --> DB
  APP --> REDIS`
        : OPS_FEW_SHOT_PROSE

    const previousBlock = previousSummaries.length > 0
        ? `\n## 已生成章节（避免重复展开）\n${previousSummaries.map(s => `- ${s.number} ${s.title}：${s.excerpt}`).join('\n')}\n`
        : ''

    const systemMsg = `你正在编写《${docTitle}》。读者：${audience}。读者拿到手册就要能照着做日常巡检、配置变更、故障应急，不能停留在概念层面。

内容原则（用正例理解）：
- 引用具体的服务名、端口、路径、命令、阈值；避免"运行稳定"、"性能良好"这种没有信息量的形容
- 操作步骤给可复制的 shell 命令，命令前给一句话说明什么场景下用
- 状态/异常排查给出可观察的判据（"日志出现 OutOfMemory 字样"、"端口 8081 无监听"等）

输出格式：
- 类型为「正文」：直接输出 Markdown，可用列表与代码块（\`\`\`bash / \`\`\`shell / \`\`\`yaml 等）；**不**输出章节标题
- 类型为「表格」：Markdown 表格，单元格一行内、≤ 80 字、不嵌入 \`\`\` 代码块、不用编号列表、不用 \`|\` 字符（多值用顿号、逗号）；表格外可以接 1-2 段补充正文
- 类型为「流程图/架构图」：仅输出 Mermaid 主体，不要 \`\`\`mermaid 包裹

通用约束：
- 严禁 HTML 标签（\`<br>\` \`<code>\` \`<strong>\` 等）；只用纯 Markdown
- 不要输出 "以下是..."、"综上所述" 这类开场和总结
- 内容必须基于用户提供的服务器扫描数据，不要凭空捏造服务名、端口、路径

安全规则（必须严格遵守）：
- 内网 IP（10.x、172.16-31.x、192.168.x）、内网端口可以正常出现
- "访问地址"、"对外服务地址"、"Web 管理界面" 等场景可以出现公网 IP
- "服务器硬件总览"、"内部管理表格" 中不要列公网 IP 列
- 密码、API Key、Token、Secret、JDBC 密码、SSH 密码 → 一律 \`********\` 占位，绝不输出明文
- 不要在文档里把"IP + 端口 + 用户名 + 密码"完整拼成一行（哪怕密码是占位）
- root、admin 等用户名可保留

${fewShot}`

    const userMsg = `${contextSummary}
${previousBlock}
---

## 当前章节
- 编号：${section.number}
- 标题：${section.title}
- 类型：${sectionType}

## 章节要求
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
