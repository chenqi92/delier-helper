/**
 * 代码库扫描器
 * 扫描项目目录结构，提取关键信息供 LLM 生成文档
 *
 * 通过 Tauri invoke 调用文件系统 API
 */
import { invoke } from '@tauri-apps/api/core'
import { readDir, readTextFile, stat } from '@tauri-apps/plugin-fs'

/**
 * 需要读取的配置文件名
 */
const CONFIG_FILES = [
    'package.json', 'pom.xml', 'build.gradle', 'build.gradle.kts',
    'Cargo.toml', 'go.mod', 'requirements.txt', 'pyproject.toml',
    'composer.json', 'Gemfile', 'pubspec.yaml',
    'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
    '.env.example', 'application.yml', 'application.yaml', 'application.properties',
    'tsconfig.json', 'vite.config.js', 'vite.config.ts',
    'webpack.config.js', 'next.config.js',
]

/**
 * 代码文件扩展名 → 语言映射
 */
const LANG_MAP = {
    '.java': 'Java', '.kt': 'Kotlin',
    '.js': 'JavaScript', '.ts': 'TypeScript', '.jsx': 'React', '.tsx': 'React TSX', '.vue': 'Vue',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.cs': 'C#',
    '.cpp': 'C++', '.c': 'C', '.h': 'C/C++ Header',
    '.swift': 'Swift',
    '.dart': 'Dart',
    '.sql': 'SQL',
    '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.less': 'Less',
    '.xml': 'XML', '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
    '.md': 'Markdown',
    '.sh': 'Shell', '.bat': 'Batch', '.ps1': 'PowerShell',
}

/**
 * 忽略的目录名
 */
const IGNORE_DIRS = new Set([
    'node_modules', '.git', '.svn', '.hg',
    'dist', 'build', 'out', 'target',
    '.idea', '.vscode', '.vs',
    '__pycache__', '.pytest_cache', '.tox',
    'vendor', 'venv', '.venv', 'env',
    '.gradle', '.mvn', '.cargo',
    'coverage', '.nyc_output',
    'tmp', 'temp', 'logs',
])

/**
 * 最大扫描深度
 */
const MAX_DEPTH = 6

/**
 * 最大读取目录文件数量（避免大仓库卡死）
 */
const MAX_FILES = 2000

/**
 * 扫描单个代码库目录
 * @param {string} dirPath - 目录绝对路径
 * @returns {Promise<ScanResult>}
 */
export async function scanCodebase(dirPaths) {
    const results = {
        trees: [],           // 目录树 [{name, path, children[], isDir}]
        stats: {             // 文件统计
            totalFiles: 0,
            totalDirs: 0,
            languages: {},   // { lang: fileCount }
        },
        configs: [],         // 配置文件内容 [{name, path, content}]
        modules: [],         // 发现的模块 [{name, path, description}]
        codeSnippets: [],    // 关键代码片段（供 LLM 分析）
    }

    for (const dirPath of (Array.isArray(dirPaths) ? dirPaths : [dirPaths])) {
        try {
            const tree = await scanDirectory(dirPath, '', 0, results)
            results.trees.push({
                name: dirPath.split(/[/\\]/).pop(),
                path: dirPath,
                children: tree,
                isDir: true,
            })
        } catch (e) {
            console.warn(`扫描目录失败: ${dirPath}`, e)
        }
    }

    // 发现模块（根据目录结构推断）
    discoverModules(results)

    return results
}

/**
 * 递归扫描目录
 */
async function scanDirectory(basePath, relativePath, depth, results) {
    if (depth > MAX_DEPTH) return []
    if (results.stats.totalFiles > MAX_FILES) return []

    const fullPath = relativePath ? `${basePath}/${relativePath}` : basePath
    let entries
    try {
        entries = await readDir(fullPath)
    } catch (e) {
        return []
    }

    const tree = []

    // 排序：目录在前，文件在后
    const sorted = [...entries].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
    })

    for (const entry of sorted) {
        if (results.stats.totalFiles > MAX_FILES) break

        const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
        const entryFullPath = `${basePath}/${entryRelPath}`

        if (entry.isDirectory) {
            if (IGNORE_DIRS.has(entry.name)) continue

            results.stats.totalDirs++
            const children = await scanDirectory(basePath, entryRelPath, depth + 1, results)
            tree.push({
                name: entry.name,
                path: entryRelPath,
                children,
                isDir: true,
            })
        } else {
            results.stats.totalFiles++

            // 语言统计
            const ext = getExtension(entry.name)
            if (ext && LANG_MAP[ext]) {
                const lang = LANG_MAP[ext]
                results.stats.languages[lang] = (results.stats.languages[lang] || 0) + 1
            }

            // 配置文件读取
            if (CONFIG_FILES.includes(entry.name)) {
                try {
                    const content = await readTextFile(entryFullPath)
                    // 截断过长的配置文件
                    results.configs.push({
                        name: entry.name,
                        path: entryRelPath,
                        content: content.length > 3000 ? content.substring(0, 3000) + '\n... (已截断)' : content,
                    })
                } catch (e) {
                    // 忽略无法读取的文件
                }
            }

            tree.push({
                name: entry.name,
                path: entryRelPath,
                isDir: false,
            })
        }
    }

    return tree
}

/**
 * 根据目录结构发现模块
 */
function discoverModules(results) {
    for (const tree of results.trees) {
        if (!tree.children) continue
        for (const child of tree.children) {
            if (!child.isDir) continue
            // Java/Spring Boot 模块发现
            if (['controller', 'controllers', 'service', 'services', 'repository', 'repositories',
                'model', 'models', 'entity', 'entities', 'config', 'mapper', 'mappers',
                'handler', 'handlers', 'api', 'router', 'routes', 'middleware',
                'utils', 'util', 'common', 'core', 'module', 'modules',
                'components', 'views', 'pages', 'stores', 'composables', 'hooks',
            ].includes(child.name.toLowerCase())) {
                results.modules.push({
                    name: child.name,
                    path: `${tree.name}/${child.path}`,
                    type: guessModuleType(child.name),
                    fileCount: countFiles(child),
                })
            }
            // 多模块项目（每个子目录可能是独立模块）
            if (child.children && child.children.some(c => CONFIG_FILES.includes(c.name))) {
                results.modules.push({
                    name: child.name,
                    path: `${tree.name}/${child.path}`,
                    type: 'subproject',
                    fileCount: countFiles(child),
                })
            }
        }
    }
}

/**
 * 猜测模块角色类型
 */
function guessModuleType(name) {
    const lower = name.toLowerCase()
    if (['controller', 'controllers', 'handler', 'handlers', 'api', 'router', 'routes'].includes(lower)) return 'controller'
    if (['service', 'services'].includes(lower)) return 'service'
    if (['repository', 'repositories', 'mapper', 'mappers', 'dao'].includes(lower)) return 'data-access'
    if (['model', 'models', 'entity', 'entities', 'dto'].includes(lower)) return 'model'
    if (['config', 'configuration'].includes(lower)) return 'config'
    if (['views', 'pages', 'components'].includes(lower)) return 'ui'
    if (['utils', 'util', 'common', 'core'].includes(lower)) return 'utility'
    return 'module'
}

/**
 * 统计目录下的文件数量
 */
function countFiles(node) {
    if (!node.isDir) return 1
    if (!node.children) return 0
    return node.children.reduce((sum, c) => sum + countFiles(c), 0)
}

/**
 * 获取文件扩展名
 */
function getExtension(filename) {
    const dot = filename.lastIndexOf('.')
    if (dot < 0) return null
    return filename.substring(dot).toLowerCase()
}

/**
 * 将目录树渲染为文本表示（供 LLM prompt 使用）
 */
export function renderTreeAsText(trees, maxLines = 200) {
    const lines = []

    function walk(nodes, indent, remaining) {
        for (let i = 0; i < nodes.length && remaining[0] > 0; i++) {
            const node = nodes[i]
            const isLast = i === nodes.length - 1
            const prefix = indent + (isLast ? '└── ' : '├── ')
            const childIndent = indent + (isLast ? '    ' : '│   ')

            if (node.isDir) {
                lines.push(`${prefix}${node.name}/`)
                remaining[0]--
                if (node.children && node.children.length > 0) {
                    walk(node.children, childIndent, remaining)
                }
            } else {
                lines.push(`${prefix}${node.name}`)
                remaining[0]--
            }
        }
    }

    const remaining = [maxLines]
    for (const tree of trees) {
        lines.push(`📁 ${tree.name}/`)
        remaining[0]--
        if (tree.children) {
            walk(tree.children, '', remaining)
        }
    }

    if (remaining[0] <= 0) {
        lines.push('... (目录树过大，已截断)')
    }

    return lines.join('\n')
}

/**
 * 构建上下文摘要（供 LLM 使用）
 * @param {Object} scanResult - 代码库扫描结果
 * @param {Object} docInfo - 文档基本信息
 * @param {Array} referenceFiles - 辅助参考文件解析结果 [{name, content}]
 */
export function buildContextSummary(scanResult, docInfo = {}, referenceFiles = []) {
    const parts = []

    // 项目基本信息
    if (docInfo.projectName) {
        parts.push(`## 项目信息\n- 项目名称: ${docInfo.projectName}`)
        if (docInfo.version) parts.push(`- 版本: ${docInfo.version}`)
        if (docInfo.author) parts.push(`- 编写人: ${docInfo.author}`)
        parts.push('')
    }

    // 目录结构
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
    if (scanResult.modules.length > 0) {
        parts.push('## 发现的模块')
        for (const mod of scanResult.modules) {
            parts.push(`- **${mod.name}** (${mod.type}): ${mod.path} (${mod.fileCount} 个文件)`)
        }
        parts.push('')
    }

    // 配置文件内容
    if (scanResult.configs.length > 0) {
        parts.push('## 配置文件')
        for (const cfg of scanResult.configs.slice(0, 5)) {
            parts.push(`### ${cfg.name} (${cfg.path})`)
            parts.push('```')
            parts.push(cfg.content)
            parts.push('```\n')
        }
    }

    // 辅助参考文件
    if (referenceFiles && referenceFiles.length > 0) {
        const validFiles = referenceFiles.filter(f => f.content && !f.error)
        if (validFiles.length > 0) {
            parts.push('## 参考文档')
            parts.push('以下是用户提供的参考文档内容，请在生成文档时参考这些内容，确保生成的内容与参考文档保持一致：\n')
            for (const file of validFiles) {
                parts.push(`### ${file.name}`)
                parts.push(file.content)
                parts.push('')
            }
        }
    }

    return parts.join('\n')
}
