import { generateExampleValue, resolveTypeFields } from './java-type-resolver.js'

const SIMPLE_EXAMPLES = {
    String: '', string: '', int: 0, Integer: 0, long: 0, Long: 0,
    float: 0, Float: 0, double: 0, Double: 0, BigDecimal: 0,
    boolean: false, Boolean: false,
    Date: '2026-01-01 00:00:00', LocalDate: '2026-01-01',
    LocalDateTime: '2026-01-01 00:00:00', LocalTime: '00:00:00',
}

function exampleFromFields(fields = [], depth = 0, budget = { remaining: 80 }) {
    if (depth > 4 || budget.remaining <= 0) return {}
    const result = {}
    for (const field of fields.slice(0, 12)) {
        if (budget.remaining <= 0) break
        budget.remaining -= 1
        const type = String(field.type || 'Object').replace(/\?$/, '')
        const clean = type.replace(/\[\]$/, '').replace(/^(?:List|Set|Collection)<(.+)>$/, '$1')
        let value
        if (Array.isArray(field._children) && field._children.length > 0) {
            value = exampleFromFields(field._children, depth + 1, budget)
        } else if (Object.prototype.hasOwnProperty.call(SIMPLE_EXAMPLES, clean)) {
            value = SIMPLE_EXAMPLES[clean]
        } else {
            value = {}
        }
        result[field.name] = /\[\]$|^(?:List|Set|Collection)</.test(type) ? [value] : value
    }
    return result
}

/**
 * 为接口文档提供按类型共享、按需生成的字段与示例访问器。
 * 紧凑解析结果直接复用 body.fields；兼容旧结果时也可从 typeIndex 延迟解析。
 */
export function createApiSchemaAccessor(parseResult = null, options = {}) {
    const typeIndex = parseResult?.typeIndex instanceof Map ? parseResult.typeIndex : null
    const maxExampleCache = Math.max(20, Number(options.maxExampleCache) || 200)
    const fieldCache = new Map()
    const exampleCache = new Map()

    const touchExample = (key, value) => {
        if (exampleCache.has(key)) exampleCache.delete(key)
        exampleCache.set(key, value)
        while (exampleCache.size > maxExampleCache) {
            exampleCache.delete(exampleCache.keys().next().value)
        }
        return value
    }

    return {
        getFields(body) {
            if (!body) return []
            if (Array.isArray(body.fields)) return body.fields
            if (!typeIndex || !body.type) return []
            if (!fieldCache.has(body.type)) {
                fieldCache.set(body.type, resolveTypeFields(body.type, typeIndex))
            }
            return fieldCache.get(body.type)
        },

        getExample(body) {
            if (!body) return null
            if (body.example !== undefined && body.example !== null) return body.example
            if (!body.type) return null
            if (exampleCache.has(body.type)) {
                return touchExample(body.type, exampleCache.get(body.type))
            }
            const example = typeIndex
                ? generateExampleValue(body.type, typeIndex)
                : exampleFromFields(this.getFields(body))
            return touchExample(body.type, example)
        },

        clearExamples() {
            exampleCache.clear()
        },
    }
}
