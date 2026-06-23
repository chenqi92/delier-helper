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

const README_FILES = new Set([
    'README.md', 'README.MD', 'readme.md', 'Readme.md',
    'README.zh-CN.md', 'README_CN.md', 'CHANGELOG.md',
])

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

const MAX_README_FILES = 6
const MAX_KEY_FILES = 90
const MAX_BUSINESS_ITEMS = 120
const MAX_SOURCE_CHARS = 14000
const MAX_SNIPPET_CHARS = 4200

const SOURCE_EXTS = new Set([
    '.java', '.kt', '.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.go', '.rs',
    '.php', '.cs', '.sql', '.xml', '.yaml', '.yml', '.json',
])

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
        readmes: [],         // README / 说明文档摘要
        business: {
            pages: [],           // 前端页面 / 菜单 / 视图线索
            routes: [],          // 前端路由 / 页面路径
            apiEndpoints: [],    // 后端接口 / HTTP 路由
            commands: [],        // Tauri / CLI / 后台命令
            domainModels: [],    // 领域对象 / DTO / Entity
            databaseTables: [],  // 数据库表
            workflows: [],       // 从命名和文案中抽取的流程词
            integrations: [],    // 外部依赖 / 中间件 / 第三方集成
            keyFiles: [],        // 对业务判断有贡献的文件
        },
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
    normalizeBusinessSignals(results)

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

            await collectBusinessSignal(entryRelPath, entryFullPath, entry.name, ext, results)

            tree.push({
                name: entry.name,
                path: entryRelPath,
                isDir: false,
            })
        }
    }

    return tree
}

async function collectBusinessSignal(relativePath, fullPath, fileName, ext, results) {
    const isReadme = README_FILES.has(fileName) || /^readme(\.|$)/i.test(fileName)

    if (isReadme && results.readmes.length < MAX_README_FILES) {
        try {
            const content = await readTextFile(fullPath)
            results.readmes.push({
                name: fileName,
                path: relativePath,
                content: trimText(content, MAX_SNIPPET_CHARS),
            })
        } catch (e) {}
    }

    if (!shouldInspectBusinessFile(relativePath, fileName, ext)) return
    if (results.business.keyFiles.length >= MAX_KEY_FILES) return

    let content = ''
    try {
        content = await readTextFile(fullPath)
    } catch (e) {
        return
    }

    const limited = trimText(content, MAX_SOURCE_CHARS)
    const signal = analyzeBusinessFile(relativePath, fileName, ext, limited)
    if (!hasBusinessSignal(signal)) return

    pushUniqueObject(results.business.keyFiles, {
        path: relativePath,
        role: signal.role,
        signals: signal.summary,
    }, 'path', MAX_KEY_FILES)

    for (const item of signal.pages) pushUniqueObject(results.business.pages, item, 'key', MAX_BUSINESS_ITEMS)
    for (const item of signal.routes) pushUniqueObject(results.business.routes, item, 'key', MAX_BUSINESS_ITEMS)
    for (const item of signal.apiEndpoints) pushUniqueObject(results.business.apiEndpoints, item, 'key', MAX_BUSINESS_ITEMS)
    for (const item of signal.commands) pushUniqueObject(results.business.commands, item, 'key', MAX_BUSINESS_ITEMS)
    for (const item of signal.domainModels) pushUniqueObject(results.business.domainModels, item, 'key', MAX_BUSINESS_ITEMS)
    for (const item of signal.databaseTables) pushUniqueObject(results.business.databaseTables, item, 'key', MAX_BUSINESS_ITEMS)
    for (const item of signal.workflows) pushUniqueObject(results.business.workflows, item, 'key', MAX_BUSINESS_ITEMS)
    for (const item of signal.integrations) pushUniqueObject(results.business.integrations, item, 'key', MAX_BUSINESS_ITEMS)

    results.codeSnippets.push({
        path: relativePath,
        language: LANG_MAP[ext] || ext?.replace('.', '').toUpperCase() || 'Text',
        reason: signal.role,
        content: trimText(content, MAX_SNIPPET_CHARS),
    })
}

function shouldInspectBusinessFile(relativePath, fileName, ext) {
    const lower = relativePath.toLowerCase()
    if (README_FILES.has(fileName) || /^readme(\.|$)/i.test(fileName)) return true
    if (CONFIG_FILES.includes(fileName)) return true
    if (!SOURCE_EXTS.has(ext)) return false
    if (/\.(lock|min\.js|min\.css|map)$/i.test(fileName)) return false
    if (/(^|\/)(test|tests|spec|__tests__|mock|mocks)(\/|$)/i.test(lower)) return false
    return /(router|route|routes|menu|nav|view|views|page|pages|screen|controller|service|entity|entities|model|models|dto|vo|po|mapper|repository|schema|migration|sql|command|commands|api|store|workflow|process|permission|role|user|account|order|task|project|device|alarm|report|dashboard|manage|management|system|tauri|main|lib)/i.test(lower)
}

function analyzeBusinessFile(path, fileName, ext, content) {
    const lower = path.toLowerCase()
    const role = guessBusinessFileRole(path, fileName)
    const labels = extractLabels(content)
    const routes = extractRoutes(content, path)
    const apiEndpoints = extractApiEndpoints(content, path)
    const commands = extractCommands(content, path)
    const domainModels = extractDomainModels(content, path)
    const databaseTables = extractDatabaseTables(content, path)
    const integrations = extractIntegrations(content, path, fileName)
    const workflows = extractWorkflowWords(content, path, labels)
    const pages = []

    if (/\.(vue|tsx|jsx|html)$/i.test(fileName) || /(views|pages|screen|dashboard)/i.test(lower)) {
        const pageName = bestPageName(path, labels)
        if (pageName) {
            pages.push({
                key: `${path}|${pageName}`,
                name: pageName,
                path,
                evidence: labels.slice(0, 5),
            })
        }
    }

    const summary = [
        labels.length ? `页面/文案: ${labels.slice(0, 4).join('、')}` : '',
        routes.length ? `路由: ${routes.slice(0, 3).map(r => r.path).join('、')}` : '',
        apiEndpoints.length ? `接口: ${apiEndpoints.slice(0, 3).map(a => `${a.method} ${a.path}`).join('、')}` : '',
        domainModels.length ? `对象: ${domainModels.slice(0, 4).map(m => m.name).join('、')}` : '',
        databaseTables.length ? `数据表: ${databaseTables.slice(0, 4).map(t => t.name).join('、')}` : '',
        commands.length ? `命令: ${commands.slice(0, 4).map(c => c.name).join('、')}` : '',
    ].filter(Boolean)

    return { role, labels, pages, routes, apiEndpoints, commands, domainModels, databaseTables, workflows, integrations, summary }
}

function guessBusinessFileRole(path, fileName) {
    const lower = path.toLowerCase()
    if (/readme/i.test(fileName)) return '项目说明'
    if (/package\.json|pom\.xml|cargo\.toml|go\.mod|requirements\.txt|pyproject\.toml/i.test(fileName)) return '依赖与技术栈'
    if (/(router|route|routes|menu|nav)/i.test(lower)) return '路由与菜单'
    if (/(view|views|page|pages|screen|dashboard)/i.test(lower)) return '用户界面'
    if (/(controller|handler|api|router|routes)/i.test(lower)) return '业务接口'
    if (/(service|workflow|process)/i.test(lower)) return '业务流程'
    if (/(entity|entities|model|models|dto|vo|po|schema)/i.test(lower)) return '领域模型'
    if (/(mapper|repository|dao|migration|sql)/i.test(lower)) return '数据访问'
    if (/(command|commands|tauri|main|lib)/i.test(lower)) return '本地能力/命令'
    return '关键业务文件'
}

function extractLabels(content) {
    const labels = []
    const patterns = [
        /(?:title|label|name|menuName|displayName|text|caption)\s*[:=]\s*['"`]([^'"`\n]{2,40})['"`]/g,
        /<h[1-4][^>]*>([^<]{2,40})<\/h[1-4]>/g,
        />([\u4e00-\u9fa5][^<>{}\n]{1,28})</g,
    ]
    for (const re of patterns) {
        let m
        while ((m = re.exec(content)) && labels.length < 40) {
            const v = cleanLabel(m[1])
            if (v && isBusinessLabel(v)) labels.push(v)
        }
    }
    return uniqueStrings(labels).slice(0, 30)
}

function extractRoutes(content, path) {
    const routes = []
    const patterns = [
        /path\s*:\s*['"`]([^'"`\n]+)['"`]/g,
        /(?:router|routes)\.(?:push|addRoute)\s*\(\s*['"`]([^'"`\n]+)['"`]/g,
        /(?:navigateTo|useNavigate)\s*\(\s*['"`]([^'"`\n]+)['"`]/g,
    ]
    for (const re of patterns) {
        let m
        while ((m = re.exec(content)) && routes.length < 50) {
            const route = normalizeRoute(m[1])
            if (route) routes.push({ key: `${path}|${route}`, path: route, source: path })
        }
    }
    return routes
}

function extractApiEndpoints(content, path) {
    const endpoints = []
    const patterns = [
        { type: 'spring-method', re: /@(Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']*)["']/g },
        { type: 'spring-request', re: /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']*)["']/g },
        { type: 'node-route', re: /(?:router|app|server)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi },
        { type: 'flask-route', re: /@(?:app|bp)\.route\s*\(\s*['"`]([^'"`\n]+)['"`](?:[^)]*methods\s*=\s*\[([^\]]+)\])?/g },
        { type: 'fetch', re: /fetch\s*\(\s*['"`]([^'"`\n]+)['"`]/g },
        { type: 'http-client', re: /(?:axios|http|request)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`\n]+)['"`]/gi },
    ]

    for (const { type, re } of patterns) {
        let m
        while ((m = re.exec(content)) && endpoints.length < 80) {
            let method = 'GET'
            let route = ''
            if (type === 'spring-request') {
                route = m[1]
            } else if (type === 'flask-route') {
                route = m[1]
                method = (m[2] || 'GET').replace(/['"\s]/g, '').split(',')[0] || 'GET'
            } else if (type === 'fetch') {
                route = m[1]
            } else if (m[2]) {
                method = m[1] || 'GET'
                route = m[2]
            } else {
                route = m[1]
            }
            route = normalizeRoute(route)
            if (route) endpoints.push({ key: `${String(method).toUpperCase()} ${route}|${path}`, method: String(method).toUpperCase(), path: route, source: path })
        }
    }
    return endpoints
}

function extractCommands(content, path) {
    const commands = []
    let m
    const tauriRe = /#\[tauri::command\][\s\S]{0,180}?\b(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)/g
    while ((m = tauriRe.exec(content)) && commands.length < 40) {
        commands.push({ key: `${path}|${m[1]}`, name: m[1], type: 'tauri-command', source: path })
    }
    const invokeRe = /invoke\s*\(\s*['"`]([A-Za-z_][\w-]*)['"`]/g
    while ((m = invokeRe.exec(content)) && commands.length < 60) {
        commands.push({ key: `${path}|${m[1]}`, name: m[1], type: 'invoke', source: path })
    }
    return commands
}

function extractDomainModels(content, path) {
    const models = []
    const modelPath = /(entity|entities|model|models|dto|vo|po|schema|domain)/i.test(path)
    const patterns = [
        /\b(?:class|interface|type|enum)\s+([A-Z][A-Za-z0-9_]{2,})/g,
        /\b(?:struct|enum)\s+([A-Z][A-Za-z0-9_]{2,})/g,
    ]
    for (const re of patterns) {
        let m
        while ((m = re.exec(content)) && models.length < 50) {
            const name = m[1]
            if (modelPath || /(Entity|DTO|Dto|VO|PO|Model|Record|Schema|Config|Request|Response)$/.test(name)) {
                models.push({ key: `${path}|${name}`, name, source: path })
            }
        }
    }
    return models
}

function extractDatabaseTables(content, path) {
    const tables = []
    const patterns = [
        /create\s+table\s+(?:if\s+not\s+exists\s+)?[`"\[]?([A-Za-z_][\w.-]*)[`"\]]?/gi,
        /@Table\s*\(\s*name\s*=\s*["']([^"']+)["']/g,
        /tableName\s*[:=]\s*['"`]([^'"`\n]+)['"`]/g,
    ]
    for (const re of patterns) {
        let m
        while ((m = re.exec(content)) && tables.length < 50) {
            const name = String(m[1] || '').trim()
            if (name) tables.push({ key: `${path}|${name}`, name, source: path })
        }
    }
    return tables
}

function extractIntegrations(content, path, fileName) {
    const integrations = []
    if (fileName === 'package.json') {
        try {
            const pkg = JSON.parse(content)
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
            for (const name of Object.keys(deps).slice(0, 40)) {
                integrations.push({ key: `npm|${name}`, name, type: 'npm', source: path })
            }
        } catch (e) {}
    }
    if (fileName === 'Cargo.toml') {
        for (const name of content.matchAll(/^\s*([A-Za-z0-9_-]+)\s*=\s*["{]/gm)) {
            integrations.push({ key: `cargo|${name[1]}`, name: name[1], type: 'cargo', source: path })
        }
    }
    const serviceRe = /\b(mysql|postgres|postgresql|oracle|redis|mongodb|rabbitmq|kafka|elasticsearch|minio|s3|oss|docker|nginx|grpc|websocket|tauri|electron)\b/gi
    let m
    while ((m = serviceRe.exec(content)) && integrations.length < 80) {
        integrations.push({ key: `${m[1].toLowerCase()}|${path}`, name: m[1], type: 'service', source: path })
    }
    return integrations
}

function extractWorkflowWords(content, path, labels) {
    const words = []
    const joined = `${labels.join(' ')} ${path} ${content.slice(0, 5000)}`
    const cnRe = /([\u4e00-\u9fa5]{2,12}(?:管理|审核|审批|配置|生成|导出|导入|扫描|分析|查询|统计|监控|告警|登录|认证|授权|同步|发布|验收|巡检|调度|派发|处理|归档|备份|恢复))/g
    let m
    while ((m = cnRe.exec(joined)) && words.length < 50) {
        const name = cleanLabel(m[1])
        if (name) words.push({ key: `${path}|${name}`, name, source: path })
    }
    return words
}

function hasBusinessSignal(signal) {
    return [
        signal.pages, signal.routes, signal.apiEndpoints, signal.commands,
        signal.domainModels, signal.databaseTables, signal.workflows, signal.integrations,
    ].some(arr => arr && arr.length > 0)
}

function normalizeBusinessSignals(results) {
    const biz = results.business
    for (const key of Object.keys(biz)) {
        if (Array.isArray(biz[key])) biz[key] = biz[key].slice(0, MAX_BUSINESS_ITEMS)
    }
}

function pushUniqueObject(arr, item, keyProp, limit) {
    if (!item || arr.length >= limit) return
    const key = item[keyProp]
    if (key && arr.some(x => x[keyProp] === key)) return
    arr.push(item)
}

function uniqueStrings(list) {
    const seen = new Set()
    const out = []
    for (const item of list) {
        const v = String(item || '').trim()
        if (!v || seen.has(v)) continue
        seen.add(v)
        out.push(v)
    }
    return out
}

function trimText(text, max) {
    const s = String(text || '').replace(/\r\n/g, '\n')
    return s.length > max ? s.slice(0, max) + '\n... (已截断)' : s
}

function cleanLabel(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .replace(/[{}[\]();,]/g, '')
        .trim()
        .slice(0, 50)
}

function isBusinessLabel(v) {
    if (!v || v.length < 2) return false
    if (/^(true|false|null|undefined|default|index|class|style|click|submit|cancel|ok)$/i.test(v)) return false
    if (/^[A-Za-z0-9_-]{1,3}$/.test(v)) return false
    if (/^https?:\/\//i.test(v)) return false
    return true
}

function normalizeRoute(route) {
    const r = String(route || '').trim()
    if (!r || r === '*' || r.includes('${')) return ''
    if (/^(https?:)?\/\//i.test(r)) return ''
    return r.length > 120 ? r.slice(0, 120) : r
}

function bestPageName(path, labels) {
    const firstLabel = labels.find(x => /[\u4e00-\u9fa5]/.test(x)) || labels[0]
    if (firstLabel) return firstLabel
    const base = path.split(/[\\/]/).pop().replace(/\.[^.]+$/, '')
    return humanizeName(base)
}

function humanizeName(name) {
    return String(name || '')
        .replace(/[-_]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim()
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

    // README / 项目说明
    if (scanResult.readmes && scanResult.readmes.length > 0) {
        parts.push('## README / 项目说明')
        for (const doc of scanResult.readmes.slice(0, 3)) {
            parts.push(`### ${doc.name} (${doc.path})`)
            parts.push(doc.content)
            parts.push('')
        }
    }

    // 业务线索
    if (scanResult.business) {
        const biz = scanResult.business
        parts.push('## 自动提取的业务线索')
        if (biz.pages?.length) {
            parts.push('### 页面 / 菜单 / 视图')
            for (const p of biz.pages.slice(0, 25)) {
                parts.push(`- ${p.name} (${p.path})${p.evidence?.length ? `；文案: ${p.evidence.join('、')}` : ''}`)
            }
            parts.push('')
        }
        if (biz.routes?.length) {
            parts.push('### 前端路由')
            for (const r of biz.routes.slice(0, 30)) parts.push(`- ${r.path} (${r.source})`)
            parts.push('')
        }
        if (biz.apiEndpoints?.length) {
            parts.push('### 接口 / API')
            for (const api of biz.apiEndpoints.slice(0, 40)) parts.push(`- ${api.method} ${api.path} (${api.source})`)
            parts.push('')
        }
        if (biz.commands?.length) {
            parts.push('### 本地命令 / 后台能力')
            for (const cmd of biz.commands.slice(0, 25)) parts.push(`- ${cmd.name} [${cmd.type}] (${cmd.source})`)
            parts.push('')
        }
        if (biz.domainModels?.length) {
            parts.push('### 领域对象')
            for (const m of biz.domainModels.slice(0, 35)) parts.push(`- ${m.name} (${m.source})`)
            parts.push('')
        }
        if (biz.databaseTables?.length) {
            parts.push('### 数据表')
            for (const t of biz.databaseTables.slice(0, 35)) parts.push(`- ${t.name} (${t.source})`)
            parts.push('')
        }
        if (biz.workflows?.length) {
            parts.push('### 流程 / 动作词')
            for (const w of biz.workflows.slice(0, 30)) parts.push(`- ${w.name} (${w.source})`)
            parts.push('')
        }
        if (biz.integrations?.length) {
            parts.push('### 依赖 / 集成线索')
            for (const dep of biz.integrations.slice(0, 35)) parts.push(`- ${dep.name} [${dep.type}] (${dep.source})`)
            parts.push('')
        }
        if (biz.keyFiles?.length) {
            parts.push('### 关键业务证据文件')
            for (const f of biz.keyFiles.slice(0, 35)) parts.push(`- ${f.path}: ${f.role}${f.signals?.length ? `；${f.signals.join('；')}` : ''}`)
            parts.push('')
        }
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
