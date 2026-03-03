/**
 * Spring Boot 项目解析器
 * 解析 Controller 类，提取接口信息
 */

import { buildTypeIndex, resolveTypeFields, generateExampleValue, extractGenericType, isPrimitiveType } from './java-type-resolver.js'

/**
 * 占位符前缀，便于 AI 模型识别和替换
 */
export const PLACEHOLDER_PREFIX = '{{待补充:'
export const PLACEHOLDER_SUFFIX = '}}'

export function makePlaceholder(type, context) {
    return `${PLACEHOLDER_PREFIX}${type}${context ? ':' + context : ''}${PLACEHOLDER_SUFFIX}`
}

export function isPlaceholder(text) {
    return text && typeof text === 'string' && text.startsWith(PLACEHOLDER_PREFIX) && text.endsWith(PLACEHOLDER_SUFFIX)
}

/**
 * HTTP 方法映射注解
 */
const MAPPING_ANNOTATIONS = {
    'RequestMapping': null,  // method 需从参数中提取
    'GetMapping': 'GET',
    'PostMapping': 'POST',
    'PutMapping': 'PUT',
    'DeleteMapping': 'DELETE',
    'PatchMapping': 'PATCH',
}

/**
 * 从注解参数中提取 value/path
 * @param {string} annotationContent - 注解括号内内容
 * @returns {string}
 */
function extractPath(annotationContent) {
    if (!annotationContent) return ''

    // value = "/path" 或 path = "/path"
    const valueMatch = annotationContent.match(/(?:value|path)\s*=\s*"([^"]*)"/)
    if (valueMatch) return valueMatch[1]

    // 直接 "/path"
    const directMatch = annotationContent.match(/^\s*"([^"]*)"/)
    if (directMatch) return directMatch[1]

    // value = {"/path1", "/path2"} 取第一个
    const arrayMatch = annotationContent.match(/(?:value|path)\s*=\s*\{\s*"([^"]*)"/)
    if (arrayMatch) return arrayMatch[1]

    // {"/path"} 直接数组
    const directArray = annotationContent.match(/^\s*\{\s*"([^"]*)"/)
    if (directArray) return directArray[1]

    return ''
}

/**
 * 从 RequestMapping 注解中提取 HTTP Method
 */
function extractMethodFromRequestMapping(annotationContent) {
    if (!annotationContent) return 'GET'
    const methodMatch = annotationContent.match(/method\s*=\s*(?:RequestMethod\.)?(\w+)/)
    if (methodMatch) return methodMatch[1].toUpperCase()
    // 如果有多个 method = {GET, POST}，取第一个
    const arrayMethodMatch = annotationContent.match(/method\s*=\s*\{\s*(?:RequestMethod\.)?(\w+)/)
    if (arrayMethodMatch) return arrayMethodMatch[1].toUpperCase()
    return 'GET'
}

/**
 * 提取方法上方的 Javadoc 注释
 * @param {string} content - 方法声明前的代码段
 * @returns {{ summary: string, paramDocs: Map<string, string>, returnDoc: string }}
 */
function parseJavadoc(content) {
    const result = { summary: '', paramDocs: new Map(), returnDoc: '' }

    const javadocMatch = content.match(/\/\*\*([\s\S]*?)\*\//)
    if (!javadocMatch) return result

    const lines = javadocMatch[1]
        .split('\n')
        .map(l => l.replace(/^\s*\*\s?/, '').trim())
        .filter(l => l.length > 0)

    const summaryLines = []
    for (const line of lines) {
        if (line.startsWith('@')) break
        summaryLines.push(line)
    }
    result.summary = summaryLines.join(' ')

    // @param paramName description
    const paramRegex = /@param\s+(\w+)\s+(.*)/g
    let pm
    while ((pm = paramRegex.exec(javadocMatch[1])) !== null) {
        result.paramDocs.set(pm[1], pm[2].trim())
    }

    // @return description
    const returnMatch = javadocMatch[1].match(/@returns?\s+(.*)/)
    if (returnMatch) result.returnDoc = returnMatch[1].trim()

    return result
}

/**
 * 提取方法的注解块（方法声明前的所有注解和注释）
 * @param {string} fileContent - 完整文件内容
 * @param {number} methodStartIdx - 方法声明的起始位置
 * @returns {string}
 */
function getAnnotationBlock(fileContent, methodStartIdx) {
    // 从方法声明位置往前找，直到遇到上一个方法结束（}）或类开始之后
    let searchStart = methodStartIdx
    // 向前搜索最多 2000 字符
    const lookback = Math.max(0, methodStartIdx - 2000)
    const prefix = fileContent.substring(lookback, methodStartIdx)

    // 找到最后一个 } 或 { 的位置
    const lastBrace = Math.max(prefix.lastIndexOf('}'), prefix.lastIndexOf('{'))
    if (lastBrace >= 0) {
        return prefix.substring(lastBrace + 1)
    }
    return prefix
}

/**
 * 解析方法参数
 * @param {string} paramString - 方法的参数列表字符串
 * @param {string} annotationBlock - 方法的注解块
 * @returns {{ params: Array, requestBodyType: string|null }}
 */
function parseMethodParams(paramString, annotationBlock) {
    if (!paramString || !paramString.trim()) return { params: [], requestBodyType: null }

    const params = []
    let requestBodyType = null

    // 按逗号分割参数（注意泛型中的逗号）
    const paramParts = splitParams(paramString)

    for (const part of paramParts) {
        const trimmed = part.trim()
        if (!trimmed) continue

        // 跳过 HttpServletRequest / HttpServletResponse / Model 等
        if (/HttpServlet|Model\b|BindingResult|MultipartFile|HttpSession|Authentication/.test(trimmed)) continue

        // @RequestBody
        if (/@RequestBody/.test(trimmed)) {
            const typeMatch = trimmed.match(/(?:@\w+(?:\([^)]*\))?\s+)*(\w+(?:<[^>]+>)?)\s+(\w+)\s*$/)
            if (typeMatch) {
                requestBodyType = typeMatch[1]
            }
            continue
        }

        // @RequestParam
        const requestParamMatch = trimmed.match(/@RequestParam(?:\(\s*(.*?)\s*\))?/)
        if (requestParamMatch) {
            const typeMatch = trimmed.match(/(?:@\w+(?:\([^)]*\))?\s+)*(\w+(?:<[^>]+>)?)\s+(\w+)\s*$/)
            if (typeMatch) {
                const paramAnnotation = requestParamMatch[1] || ''
                const nameOverride = paramAnnotation.match(/(?:value|name)\s*=\s*"([^"]*)"/)
                const required = !/required\s*=\s*false/.test(paramAnnotation)
                params.push({
                    name: nameOverride ? nameOverride[1] : typeMatch[2],
                    type: typeMatch[1],
                    required,
                    description: '',
                    in: 'query',
                })
            }
            continue
        }

        // @PathVariable
        const pathVarMatch = trimmed.match(/@PathVariable(?:\(\s*(.*?)\s*\))?/)
        if (pathVarMatch) {
            const typeMatch = trimmed.match(/(?:@\w+(?:\([^)]*\))?\s+)*(\w+(?:<[^>]+>)?)\s+(\w+)\s*$/)
            if (typeMatch) {
                const varAnnotation = pathVarMatch[1] || ''
                const nameOverride = varAnnotation.match(/(?:value|name)\s*=\s*"([^"]*)"/)
                params.push({
                    name: nameOverride ? nameOverride[1] : typeMatch[2],
                    type: typeMatch[1],
                    required: true,
                    description: '',
                    in: 'path',
                })
            }
            continue
        }

        // @RequestHeader
        if (/@RequestHeader/.test(trimmed)) {
            const typeMatch = trimmed.match(/(?:@\w+(?:\([^)]*\))?\s+)*(\w+(?:<[^>]+>)?)\s+(\w+)\s*$/)
            if (typeMatch) {
                params.push({
                    name: typeMatch[2],
                    type: typeMatch[1],
                    required: true,
                    description: '',
                    in: 'header',
                })
            }
            continue
        }

        // 无注解参数（简单类型自动当 query param）
        const simpleMatch = trimmed.match(/^(\w+(?:<[^>]+>)?)\s+(\w+)$/)
        if (simpleMatch && isPrimitiveType(simpleMatch[1])) {
            params.push({
                name: simpleMatch[2],
                type: simpleMatch[1],
                required: false,
                description: '',
                in: 'query',
            })
        }
    }

    return { params, requestBodyType }
}

/**
 * 按顶层逗号分割参数列表（不在尖括号/圆括号嵌套内）
 */
function splitParams(str) {
    const parts = []
    let depth = 0
    let current = ''

    for (let i = 0; i < str.length; i++) {
        const ch = str[i]
        if (ch === '<' || ch === '(') depth++
        else if (ch === '>' || ch === ')') depth--
        else if (ch === ',' && depth === 0) {
            parts.push(current)
            current = ''
            continue
        }
        current += ch
    }
    if (current.trim()) parts.push(current)

    return parts
}

/**
 * 从文件相对路径中提取 Maven/Gradle 模块名
 * 例如: "user-service/src/main/java/com/xxx/UserController.java" → "user-service"
 *       "module-api/src/main/java/com/xxx/UserVO.java" → "module-api"
 *       "src/main/java/com/xxx/UserController.java" → "" (单模块项目)
 */
export function extractModuleName(relativePath) {
    if (!relativePath) return ''
    const normalized = relativePath.replace(/\\/g, '/')
    // 匹配 src/main/java 之前的部分
    const match = normalized.match(/^(.+?)\/src\/main\/java\//)
    if (match) {
        const modulePath = match[1]
        // 取最后一段作为模块名（处理 parent/child-module 的情况）
        const parts = modulePath.split('/')
        return parts[parts.length - 1] || ''
    }
    // 如果没有标准 src/main/java 结构，取第一级目录
    const parts = normalized.split('/')
    if (parts.length > 1) return parts[0]
    return ''
}

/**
 * 解析整个 Spring Boot 项目（异步分片，保持 UI 响应）
 * @param {Array<{name: string, relative_path: string, content: string}>} javaFiles
 * @param {function} [onProgress] - 进度回调 (message: string, percent: number) => void
 * @returns {Promise<{ modules: Array }>}
 */
export async function parseSpringBootProject(javaFiles, onProgress) {
    const log = onProgress || (() => { })

    // 1. 构建全局类型索引
    log(`正在构建类型索引 (${javaFiles.length} 个 Java 文件)...`, 10)
    const typeIndex = buildTypeIndex(javaFiles)
    log(`类型索引构建完成，共索引 ${typeIndex.size} 个类`, 20)

    // 2. 找到所有 Controller 类
    const controllers = javaFiles.filter(f =>
        /@(?:Rest)?Controller\b/.test(f.content)
    )
    log(`发现 ${controllers.length} 个 Controller 类`, 25)

    const modules = []

    for (let i = 0; i < controllers.length; i++) {
        const controller = controllers[i]
        const pct = 25 + Math.round((i / controllers.length) * 70)
        log(`正在解析 Controller (${i + 1}/${controllers.length}): ${controller.name}`, pct)

        try {
            const methodLog = (msg) => log(msg, pct)
            const module = await parseController(controller, typeIndex, methodLog)
            if (module && module.apis.length > 0) {
                modules.push(module)
            }
        } catch (e) {
            log(`⚠️ 解析 ${controller.name} 失败: ${e.message}`, pct)
            console.error(`[api-doc] 解析 Controller 失败: ${controller.name}`, e)
        }

        // 每解析 1 个 Controller yield 一次，让 UI 更新
        if (i % 1 === 0) {
            await new Promise(r => setTimeout(r, 0))
        }
    }

    // 后处理：为缺失描述的接口和参数填充占位符
    for (const mod of modules) {
        for (const api of mod.apis) {
            // 接口描述占位符
            if (!api.description) {
                api.description = makePlaceholder('接口说明', api.methodName)
            }

            // 参数描述占位符
            for (const p of api.params) {
                if (!p.description) {
                    p.description = makePlaceholder('参数说明', p.name)
                }
            }

            // 请求体字段描述占位符
            if (api.requestBody) {
                for (const f of api.requestBody.fields) {
                    if (!f.description) {
                        f.description = makePlaceholder('字段说明', f.name)
                    }
                }
            }

            // 返回数据字段描述占位符
            if (api.response) {
                for (const f of api.response.fields) {
                    if (!f.description) {
                        f.description = makePlaceholder('字段说明', f.name)
                    }
                }
            }
        }
    }

    log(`解析完成！共 ${modules.length} 个模块`, 100)
    return { modules }
}

/**
 * 解析单个 Controller 文件
 */
async function parseController(file, typeIndex, log) {
    const content = file.content

    // 提取类名
    const classNameMatch = content.match(/(?:public\s+)?class\s+(\w+)/)
    if (!classNameMatch) return null

    const className = classNameMatch[1]

    // 检测所属模块路径（多模块/微服务支持）
    const modulePath = extractModuleName(file.relative_path)

    // 类级别路径前缀（使用 [^)]* 避免回溯）
    const classMappingMatch = content.match(/@RequestMapping\(\s*([^)]*)\)/)
    const basePath = classMappingMatch ? extractPath(classMappingMatch[1]) : ''

    // 模块名称提取
    let moduleName = className.replace(/Controller$/, '')

    // Swagger 2: @Api(tags = "xxx")
    const apiMatch = content.match(/@Api\(\s*([^)]*)\)/)
    if (apiMatch) {
        const tagsMatch = apiMatch[1].match(/tags\s*=\s*"([^"]*)"/) ||
            apiMatch[1].match(/tags\s*=\s*\{\s*"([^"]*)"/) ||
            apiMatch[1].match(/value\s*=\s*"([^"]*)"/)
        if (tagsMatch) moduleName = tagsMatch[1]
    }

    // OpenAPI 3: @Tag(name = "xxx")
    const tagMatch = content.match(/@Tag\(\s*name\s*=\s*"([^"]*)"/)
    if (tagMatch) moduleName = tagMatch[1]

    // 类级 Javadoc
    const classDocMatch = content.match(/\/\*\*([\s\S]*?)\*\/\s*(?:@\w+[^)]*\)\s*)*\s*(?:public\s+)?class\s/)
    if (classDocMatch && !apiMatch && !tagMatch) {
        const docSummary = classDocMatch[1]
            .split('\n')
            .map(l => l.replace(/^\s*\*\s?/, '').trim())
            .filter(l => l && !l.startsWith('@'))
        if (docSummary[0]) {
            moduleName = docSummary[0]
        }
    }

    if (modulePath) {
        moduleName = `[${modulePath}] ${moduleName}`
    }

    // 解析方法（async，传递 log）
    const apis = await parseControllerMethods(content, basePath, typeIndex, log)

    return {
        name: moduleName,
        className,
        basePath,
        modulePath,
        file: file.relative_path || file.name,
        apis,
    }
}

/**
 * 解析 Controller 中的所有接口方法（异步 + 逐行扫描）
 */
async function parseControllerMethods(content, basePath, typeIndex, log) {
    const apis = []
    const lines = content.split('\n')
    const MAPPING_KEYS = Object.keys(MAPPING_ANNOTATIONS)

    // 预计算行偏移量（避免 O(n²)）
    const lineOffsets = new Array(lines.length)
    let offset = 0
    for (let k = 0; k < lines.length; k++) {
        lineOffsets[k] = offset
        offset += lines[k].length + 1 // +1 for \n
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // 查找 @XxxMapping 注解行
        let mappingAnnotation = null
        let annotationContent = ''

        for (const annotation of MAPPING_KEYS) {
            if (line === `@${annotation}` || line.startsWith(`@${annotation}(`)) {
                mappingAnnotation = annotation

                if (line.includes('(')) {
                    let raw = line.substring(line.indexOf('(') + 1)
                    if (!raw.includes(')')) {
                        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                            raw += ' ' + lines[j].trim()
                            if (raw.includes(')')) break
                        }
                    }
                    const closeIdx = raw.indexOf(')')
                    annotationContent = closeIdx >= 0 ? raw.substring(0, closeIdx) : raw
                }
                break
            }
        }

        if (!mappingAnnotation) continue

        const defaultMethod = MAPPING_ANNOTATIONS[mappingAnnotation]

        // 从 Mapping 行向下搜索方法签名
        let methodLineIdx = -1
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            if (/(?:public|protected|private)\s+\S/.test(lines[j])) {
                methodLineIdx = j
                break
            }
        }
        if (methodLineIdx < 0) continue

        const sigMatch = lines[methodLineIdx].trim().match(
            /(?:public|protected|private)\s+([\w<>\[\],\s?]+?)\s+(\w+)\s*\((.*)/
        )
        if (!sigMatch) continue

        const returnType = sigMatch[1].trim()
        const methodName = sigMatch[2]

        // 提取完整参数列表
        let paramString = sigMatch[3]
        if (!paramString.includes(')')) {
            for (let j = methodLineIdx + 1; j < Math.min(methodLineIdx + 20, lines.length); j++) {
                paramString += ' ' + lines[j].trim()
                if (lines[j].includes(')')) break
            }
        }
        const parenEnd = paramString.indexOf(')')
        if (parenEnd >= 0) paramString = paramString.substring(0, parenEnd)

        if (apis.find(a => a.methodName === methodName)) continue

        const methodPath = extractPath(annotationContent)
        const fullPath = normalizePath(basePath, methodPath)
        const httpMethod = defaultMethod || extractMethodFromRequestMapping(annotationContent)

        // 使用预计算偏移量
        const charOffset = lineOffsets[i] || 0
        const annotationBlock = getAnnotationBlock(content, charOffset)

        // 接口描述
        let summary = ''
        let description = ''

        const apiOpMatch = annotationBlock.match(/@ApiOperation\(\s*([^)]*)\)/)
        if (apiOpMatch) {
            const valMatch = apiOpMatch[1].match(/value\s*=\s*"([^"]*)"/) || apiOpMatch[1].match(/^\s*"([^"]*)"/)
            if (valMatch) summary = valMatch[1]
            const noteMatch = apiOpMatch[1].match(/notes\s*=\s*"([^"]*)"/)
            if (noteMatch) description = noteMatch[1]
        }

        const opMatch = annotationBlock.match(/@Operation\(\s*([^)]*)\)/)
        if (opMatch) {
            const summaryMatch = opMatch[1].match(/summary\s*=\s*"([^"]*)"/)
            if (summaryMatch) summary = summaryMatch[1]
            const descMatch = opMatch[1].match(/description\s*=\s*"([^"]*)"/)
            if (descMatch) description = descMatch[1]
        }

        const javadoc = parseJavadoc(annotationBlock)
        if (!summary) summary = javadoc.summary
        if (!summary) summary = methodName

        if (log) log(`  → ${httpMethod} ${fullPath} (${summary})`)

        // 参数
        const { params, requestBodyType } = parseMethodParams(paramString, annotationBlock)
        for (const p of params) {
            if (!p.description && javadoc.paramDocs.has(p.name)) {
                p.description = javadoc.paramDocs.get(p.name)
            }
        }

        // 请求体（容错）
        let requestBody = null
        if (requestBodyType) {
            try {
                requestBody = {
                    type: requestBodyType,
                    fields: resolveTypeFields(requestBodyType, typeIndex),
                    example: generateExampleValue(requestBodyType, typeIndex),
                }
            } catch (e) {
                requestBody = { type: requestBodyType, fields: [], example: null }
            }
        }

        // 返回类型（容错）
        let response = null
        const cleanReturn = returnType.replace(/ResponseEntity<(.+)>/, '$1')
        if (cleanReturn && cleanReturn !== 'void' && cleanReturn !== 'Void') {
            try {
                response = {
                    type: cleanReturn,
                    fields: resolveTypeFields(cleanReturn, typeIndex),
                    example: generateExampleValue(cleanReturn, typeIndex),
                }
            } catch (e) {
                response = { type: cleanReturn, fields: [], example: null }
            }
        }

        apis.push({
            method: httpMethod,
            path: fullPath,
            summary,
            description,
            methodName,
            params,
            requestBody,
            response,
        })

        // 每个方法后 yield 一次让 UI 更新
        await new Promise(r => setTimeout(r, 0))
    }

    return apis
}

/**
 * 合并路径
 */
function normalizePath(base, method) {
    let path = ''
    if (base) path += base.startsWith('/') ? base : '/' + base
    if (method) path += method.startsWith('/') ? method : '/' + method
    if (!path) path = '/'
    // 去重斜杠
    return path.replace(/\/+/g, '/')
}
