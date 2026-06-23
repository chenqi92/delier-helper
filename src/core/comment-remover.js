/**
 * 注释移除引擎 - 支持多种编程语言
 */

const COMMENT_RULES = {
    'c-style': { single: '//', multiStart: '/*', multiEnd: '*/', strings: ['"', "'", '`'] },
    'python': { single: '#', docstrings: ['"""', "'''"], strings: ['"', "'"] },
    'html': { multiStart: '<!--', multiEnd: '-->', strings: ['"', "'"] },
    'css': { multiStart: '/*', multiEnd: '*/', strings: ['"', "'"] },
    'scss': { single: '//', multiStart: '/*', multiEnd: '*/', strings: ['"', "'"] },
    'sql': { single: '--', multiStart: '/*', multiEnd: '*/', strings: ["'"] },
    'shell': { single: '#', strings: ['"', "'"] },
    'ruby': { single: '#', multiStart: '=begin', multiEnd: '=end', strings: ['"', "'"] },
    'lua': { single: '--', multiStart: '--[[', multiEnd: ']]', strings: ['"', "'"] },
    'php': { single: '//', single2: '#', multiStart: '/*', multiEnd: '*/', strings: ['"', "'"] },
    'haskell': { single: '--', multiStart: '{-', multiEnd: '-}', strings: ['"'] },
    'clojure': { single: ';', strings: ['"'] },
    'erlang': { single: '%', strings: ['"'] },
}

const EXT_TO_RULE = {
    '.js': 'c-style', '.jsx': 'c-style', '.ts': 'c-style', '.tsx': 'c-style',
    '.java': 'c-style', '.c': 'c-style', '.cpp': 'c-style', '.cc': 'c-style',
    '.cxx': 'c-style', '.h': 'c-style', '.hpp': 'c-style',
    '.cs': 'c-style', '.go': 'c-style', '.rs': 'c-style',
    '.swift': 'c-style', '.kt': 'c-style', '.kts': 'c-style',
    '.scala': 'c-style', '.dart': 'c-style',
    '.m': 'c-style', '.mm': 'c-style',
    '.groovy': 'c-style', '.gradle': 'c-style',
    '.prisma': 'c-style', '.proto': 'c-style',
    '.py': 'python',
    '.html': 'html', '.htm': 'html', '.xml': 'html', '.wxml': 'html',
    '.css': 'css', '.wxss': 'css',
    '.scss': 'scss', '.sass': 'scss', '.less': 'scss',
    '.sql': 'sql',
    '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
    '.bat': 'shell', '.cmd': 'shell', '.ps1': 'shell',
    '.r': 'shell', '.R': 'shell',
    '.pl': 'shell', '.pm': 'shell',
    '.ex': 'shell', '.exs': 'shell',
    '.tf': 'shell', '.graphql': 'shell', '.gql': 'shell',
    '.rb': 'ruby',
    '.lua': 'lua',
    '.php': 'php',
    '.erl': 'erlang', '.hrl': 'erlang',
    '.hs': 'haskell',
    '.clj': 'clojure', '.cljs': 'clojure',
    '.ml': 'c-style', '.fs': 'c-style', '.fsx': 'c-style',
}

export function removeComments(code, ext) {
    if (['.vue', '.svelte', '.astro'].includes(ext)) {
        return removeComponentComments(code)
    }

    const ruleName = EXT_TO_RULE[ext]
    if (!ruleName) return code

    if (ruleName === 'python') {
        return removePythonComments(code)
    }
    return removeGenericComments(code, COMMENT_RULES[ruleName])
}

function removeGenericComments(code, rule) {
    const lines = code.split('\n')
    const result = []
    let inMulti = false

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i]
        if (inMulti) {
            const idx = line.indexOf(rule.multiEnd)
            if (idx !== -1) {
                inMulti = false
                line = line.substring(idx + rule.multiEnd.length)
                if (line.trim()) {
                    const processed = processLine(line, rule)
                    if (processed !== null) result.push(processed)
                }
            }
            continue
        }
        const processed = processLine(line, rule)
        if (processed !== null) result.push(processed)
    }
    return result.join('\n')

    function processLine(line, rule) {
        let out = '', inStr = false, strCh = '', j = 0
        while (j < line.length) {
            if (!inStr && rule.strings) {
                let found = false
                for (const d of rule.strings) {
                    if (line.substring(j).startsWith(d)) {
                        inStr = true; strCh = d; out += d; j += d.length; found = true; break
                    }
                }
                if (found) continue
            }
            if (inStr) {
                if (line[j] === '\\') { out += line[j] + (line[j + 1] || ''); j += 2; continue }
                if (line.substring(j).startsWith(strCh)) { out += strCh; j += strCh.length; inStr = false; continue }
                out += line[j]; j++; continue
            }
            if (rule.multiStart && line.substring(j).startsWith(rule.multiStart)) {
                const end = line.indexOf(rule.multiEnd, j + rule.multiStart.length)
                if (end !== -1) { j = end + rule.multiEnd.length; continue }
                inMulti = true; break
            }
            if (rule.single && line.substring(j).startsWith(rule.single)) break
            if (rule.single2 && line.substring(j).startsWith(rule.single2)) break
            out += line[j]; j++
        }
        return out.length > 0 || (!inMulti && line.trim() === '') ? out : null
    }
}

function removePythonComments(code) {
    const lines = code.split('\n')
    const result = []
    let inDoc = false, docDelim = ''
    for (const line of lines) {
        if (inDoc) {
            const idx = line.indexOf(docDelim)
            if (idx !== -1) { inDoc = false; const rest = line.substring(idx + 3); if (rest.trim()) result.push(rest) }
            continue
        }
        let processed = line
        for (const d of ['"""', "'''"]) {
            const idx = processed.indexOf(d)
            if (idx !== -1) {
                const close = processed.indexOf(d, idx + 3)
                if (close !== -1) {
                    processed = processed.substring(0, idx) + processed.substring(close + 3)
                } else {
                    processed = processed.substring(0, idx)
                    inDoc = true; docDelim = d
                }
                break
            }
        }
        if (!inDoc) {
            let inStr = false, sc = ''
            for (let i = 0; i < processed.length; i++) {
                if (inStr) { if (processed[i] === '\\') { i++; continue }; if (processed[i] === sc) inStr = false; continue }
                if (processed[i] === '"' || processed[i] === "'") { inStr = true; sc = processed[i]; continue }
                if (processed[i] === '#') { processed = processed.substring(0, i); break }
            }
        }
        result.push(processed)
    }
    return result.join('\n')
}

function removeComponentComments(code) {
    code = code.replace(/<!--[\s\S]*?-->/g, '')
    code = code.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, content) => {
        return match.replace(content, removeGenericComments(content, COMMENT_RULES['c-style']))
    })
    code = code.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, content) => {
        const r = match.includes('lang="scss"') ? COMMENT_RULES['scss'] : COMMENT_RULES['css']
        return match.replace(content, removeGenericComments(content, r))
    })
    return code
}
