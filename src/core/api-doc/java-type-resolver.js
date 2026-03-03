/**
 * Java 类型解析器
 * 解析 DTO/VO/Entity 类的字段信息，提取 Swagger / Schema / Javadoc 描述
 */

/**
 * Java 基础类型到示例值的映射
 */
const TYPE_DEFAULTS = {
    'String': '""',
    'string': '""',
    'int': '0',
    'Integer': '0',
    'long': '0',
    'Long': '0',
    'float': '0.0',
    'Float': '0.0',
    'double': '0.0',
    'Double': '0.0',
    'boolean': 'false',
    'Boolean': 'false',
    'BigDecimal': '0.00',
    'Date': '"2026-01-01 00:00:00"',
    'LocalDate': '"2026-01-01"',
    'LocalDateTime': '"2026-01-01 00:00:00"',
    'LocalTime': '"00:00:00"',
    'Byte': '0',
    'byte': '0',
    'Short': '0',
    'short': '0',
    'char': '""',
    'Character': '""',
}

/**
 * 判断是否为集合类型
 */
function isCollectionType(type) {
    return /^(List|Set|Collection|ArrayList|LinkedList|HashSet)</.test(type)
}

/**
 * 判断是否为 Map 类型
 */
function isMapType(type) {
    return /^(Map|HashMap|LinkedHashMap|TreeMap)</.test(type)
}

/**
 * 提取泛型内部类型
 * List<UserVO> -> UserVO
 * CommonResult<UserVO> -> UserVO
 * Map<String, Object> -> { key: 'String', value: 'Object' }
 */
export function extractGenericType(type) {
    const match = type.match(/^(\w+)<(.+)>$/)
    if (!match) return null

    const outer = match[1]
    const inner = match[2]

    if (isMapType(type)) {
        // 简单处理 Map，找第一个逗号分隔
        const commaIdx = findTopLevelComma(inner)
        if (commaIdx >= 0) {
            return {
                outer,
                isMap: true,
                key: inner.substring(0, commaIdx).trim(),
                value: inner.substring(commaIdx + 1).trim(),
            }
        }
    }

    return { outer, isMap: false, inner: inner.trim() }
}

/**
 * 找到顶层逗号（不在尖括号嵌套内的逗号）
 */
function findTopLevelComma(str) {
    let depth = 0
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '<') depth++
        else if (str[i] === '>') depth--
        else if (str[i] === ',' && depth === 0) return i
    }
    return -1
}

/**
 * 判断是否为基础类型（不需要递归解析字段）
 */
export function isPrimitiveType(type) {
    const clean = type.replace(/\[\]$/, '') // 去掉数组标记
    return TYPE_DEFAULTS.hasOwnProperty(clean) || clean === 'Object' || clean === 'void' || clean === 'Void'
}

/**
 * 解析单个 Java 类文件，提取字段信息
 * @param {string} content - Java 文件内容
 * @returns {{ className: string, fields: Array, superClass: string|null }}
 */
export function parseJavaClass(content) {
    // 提取类名
    const classMatch = content.match(/(?:public\s+)?class\s+(\w+)(?:\s+extends\s+(\w+(?:<[^>]+>)?))?/)
    if (!classMatch) return null

    const className = classMatch[1]
    const superClass = classMatch[2] || null

    const fields = []

    // 解析字段：支持多种注解格式
    // 先按行分割，然后逐袒扫描字段声明
    const lines = content.split('\n')
    let pendingAnnotations = ''
    let pendingJavadoc = ''
    let inJavadoc = false
    let javadocBuffer = ''

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // 跟踪 Javadoc 块
        if (line.startsWith('/**')) {
            inJavadoc = true
            javadocBuffer = line
            if (line.endsWith('*/')) {
                inJavadoc = false
                pendingJavadoc = javadocBuffer
                pendingAnnotations = ''
            }
            continue
        }
        if (inJavadoc) {
            javadocBuffer += '\n' + line
            if (line.endsWith('*/') || line.includes('*/')) {
                inJavadoc = false
                pendingJavadoc = javadocBuffer
                pendingAnnotations = ''
            }
            continue
        }

        // 收集注解行
        if (line.startsWith('@')) {
            pendingAnnotations += '\n' + line
            continue
        }

        // 尝试匹配字段声明（支持 private/protected/public 和 Lombok 类的无修饰符字段）
        const fieldMatch = line.match(/^(?:private|protected|public)?\s*([\w<>,\s\[\]?]+?)\s+(\w+)\s*[;=]/)
        if (fieldMatch && !line.startsWith('//') && !line.startsWith('*')) {
            const fieldType = fieldMatch[1].trim()
            const fieldName = fieldMatch[2]

            // 跳过 static / final 常量 / 方法类型
            if (/\bstatic\b/.test(line) || /\bfinal\s+static\b/.test(line)) {
                pendingAnnotations = ''
                pendingJavadoc = ''
                continue
            }
            // 跳过类声明、方法声明
            if (/^(class|interface|enum|return|if|for|while|switch|try)\b/.test(fieldType)) {
                pendingAnnotations = ''
                pendingJavadoc = ''
                continue
            }

            const annotationBlock = pendingJavadoc + '\n' + pendingAnnotations
            const field = extractFieldInfo(fieldName, fieldType, annotationBlock, line)
            if (field) fields.push(field)

            pendingAnnotations = ''
            pendingJavadoc = ''
            continue
        }

        // 空行或其他内容重置注解缓存
        if (line === '' || line.startsWith('//')) {
            // 保留 Javadoc，只清空注解（Javadoc 可能和字段间有空行）
        } else if (!line.startsWith('@') && !line.startsWith('*')) {
            pendingAnnotations = ''
            pendingJavadoc = ''
        }
    }

    return { className, fields, superClass }
}

/**
 * 从注解块中提取字段信息
 */
function extractFieldInfo(fieldName, fieldType, annotationBlock, rawLine) {
    const field = {
        name: fieldName,
        type: fieldType,
        required: false,
        description: '',
    }

    // 1. Swagger 2: @ApiModelProperty（支持多行注解）
    const apiModelProp = annotationBlock.match(/@ApiModelProperty\(([\s\S]*?)\)(?:\s*$|\s*\n)/m)
    if (apiModelProp) {
        const propContent = apiModelProp[1]
        const valueMatch = propContent.match(/value\s*=\s*"([^"]*)"/) || propContent.match(/^\s*"([^"]*)"/)
        if (valueMatch) field.description = valueMatch[1]
        if (/required\s*=\s*true/.test(propContent)) field.required = true
    }

    // 2. OpenAPI 3: @Schema（支持多行注解）
    const schemaMatch = annotationBlock.match(/@Schema\(([\s\S]*?)\)(?:\s*$|\s*\n)/m)
    if (schemaMatch) {
        const schemaContent = schemaMatch[1]
        const descMatch = schemaContent.match(/description\s*=\s*"([^"]*)"/) || schemaContent.match(/title\s*=\s*"([^"]*)"/)
        if (descMatch && !field.description) field.description = descMatch[1]
        if (/required\s*=\s*true/.test(schemaContent) || /requiredMode\s*=\s*\S*REQUIRED/.test(schemaContent)) {
            field.required = true
        }
    }

    // 3. Javadoc 注释
    if (!field.description) {
        const javadocMatch = annotationBlock.match(/\/\*\*\s*([\s\S]*?)\s*\*\//)
        if (javadocMatch) {
            const docText = javadocMatch[1]
                .replace(/^\s*\*\s?/gm, '')
                .replace(/@\w+.*$/gm, '')
                .trim()
            if (docText) field.description = docText.split('\n')[0].trim()
        }
    }

    // 4. 行尾注释 // xxx
    if (!field.description) {
        const lineComment = rawLine.match(/\/\/\s*(.+)$/)
        if (lineComment) field.description = lineComment[1].trim()
    }

    // 5. 验证注解推断 required
    if (/@NotNull|@NotBlank|@NotEmpty/.test(annotationBlock)) {
        field.required = true
    }

    // 6. @Excel / @TableField 注解中的 name/value 作为描述备选
    if (!field.description) {
        const excelMatch = annotationBlock.match(/@Excel\(\s*name\s*=\s*"([^"]*)"/)
        if (excelMatch) field.description = excelMatch[1]
    }
    if (!field.description) {
        const tableFieldMatch = annotationBlock.match(/@TableField\(\s*(?:value\s*=\s*)?"([^"]*)"/)
        if (tableFieldMatch) field.description = tableFieldMatch[1]
    }

    return field
}

/**
 * 构建类型索引（类名 -> 解析结果）
 * @param {Array<{name: string, content: string}>} javaFiles - Java 文件列表
 * @returns {Map<string, { className: string, fields: Array, superClass: string|null }>}
 */
export function buildTypeIndex(javaFiles) {
    const index = new Map()

    for (const file of javaFiles) {
        // 一个文件可能有内部类，但主要关注主类
        const parsed = parseJavaClass(file.content)
        if (parsed) {
            index.set(parsed.className, parsed)
        }
    }

    return index
}

/**
 * 解析类型的完整字段列表（含继承和泛型展开）
 * @param {string} typeName - 类型名
 * @param {Map} typeIndex - 类型索引
 * @param {Set} visited - 已访问集合（防循环引用）
 * @returns {Array<{ name: string, type: string, required: boolean, description: string }>}
 */
export function resolveTypeFields(typeName, typeIndex, visited = new Set(), depth = 0) {
    if (!typeName || isPrimitiveType(typeName) || visited.has(typeName) || depth > 8) return []
    visited.add(typeName)

    // 处理泛型
    const generic = extractGenericType(typeName)
    if (generic) {
        if (isCollectionType(typeName)) {
            return resolveTypeFields(generic.inner, typeIndex, visited, depth + 1)
        }
        if (generic.isMap) {
            return [{ name: 'key', type: generic.key, required: false, description: 'Map 键' },
            { name: 'value', type: generic.value, required: false, description: 'Map 值' }]
        }
        // CommonResult<T> -> 解析外层 + 内层
        const outerFields = resolveTypeFields(generic.outer, typeIndex, new Set(visited), depth + 1)
        const innerTypeName = generic.inner
        if (!isPrimitiveType(innerTypeName) && typeIndex.has(innerTypeName)) {
            const dataField = outerFields.find(f => f.type === 'T' || f.type === innerTypeName || f.name === 'data')
            if (dataField) {
                dataField.type = innerTypeName
                dataField._children = resolveTypeFields(innerTypeName, typeIndex, new Set(visited), depth + 1)
            }
        }
        return outerFields
    }

    // 普通类型
    const classDef = typeIndex.get(typeName)
    if (!classDef) return []

    let fields = classDef.fields.slice(0, 50) // 截断过多字段
    fields = [...fields]

    // 处理继承
    if (classDef.superClass) {
        const superName = classDef.superClass.replace(/<.*>$/, '')
        const superFields = resolveTypeFields(superName, typeIndex, new Set(visited), depth + 1)
        fields = [...superFields, ...fields]
    }

    return fields
}

/**
 * 根据类型生成示例 JSON 值
 * @param {string} typeName - 类型名
 * @param {Map} typeIndex - 类型索引
 * @param {Set} visited - 已访问集合
 * @returns {*} JSON 值
 */
export function generateExampleValue(typeName, typeIndex, visited = new Set(), depth = 0) {
    if (!typeName) return null
    if (depth > 6) return {} // 防止过深递归

    // 去数组标记
    const isArray = typeName.endsWith('[]')
    const cleanType = typeName.replace(/\[\]$/, '')

    // 基础类型
    if (TYPE_DEFAULTS[cleanType]) {
        const val = JSON.parse(TYPE_DEFAULTS[cleanType])
        return isArray ? [val] : val
    }

    if (cleanType === 'Object') return isArray ? [{}] : {}
    if (cleanType === 'void' || cleanType === 'Void') return null

    if (visited.has(cleanType)) return isArray ? [{}] : {}
    visited.add(cleanType)

    // 泛型
    const generic = extractGenericType(cleanType)
    if (generic) {
        if (isCollectionType(cleanType)) {
            const innerVal = generateExampleValue(generic.inner, typeIndex, new Set(visited), depth + 1)
            return [innerVal]
        }
        if (generic.isMap) {
            return {}
        }
        // 包装类型如 CommonResult<UserVO>
        const outerExample = generateExampleValue(generic.outer, typeIndex, new Set(visited), depth + 1)
        if (outerExample && typeof outerExample === 'object') {
            const innerExample = generateExampleValue(generic.inner, typeIndex, new Set(visited), depth + 1)
            if (outerExample.hasOwnProperty('data')) {
                outerExample.data = innerExample
            }
        }
        return isArray ? [outerExample] : outerExample
    }

    // 对象类型
    const classDef = typeIndex.get(cleanType)
    if (!classDef) return isArray ? [{}] : {}

    const obj = {}
    const fieldSlice = classDef.fields.slice(0, 30) // 截断过多字段
    for (const field of fieldSlice) {
        obj[field.name] = generateExampleValue(field.type, typeIndex, new Set(visited), depth + 1)
    }

    return isArray ? [obj] : obj
}
