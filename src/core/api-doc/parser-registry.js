/**
 * 解析器注册中心
 * 根据项目特征文件自动识别项目语言，调度对应解析器
 */

/**
 * 项目语言检测特征
 */
const PROJECT_SIGNATURES = [
    {
        id: 'spring-boot',
        label: 'Spring Boot',
        icon: '☕',
        // 特征文件（存在任一即匹配）
        markers: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
        // 二次验证关键词（在特征文件中搜索）
        keywords: ['spring-boot', 'org.springframework'],
        // 源码目录约定
        sourceRoots: ['src/main/java'],
        sourceExt: '.java',
    },
    // 后续扩展：
    // { id: 'express', label: 'Express.js', markers: ['package.json'], keywords: ['express'], ... },
    // { id: 'flask', label: 'Flask', markers: ['requirements.txt'], keywords: ['flask'], ... },
]

/**
 * 检测项目语言
 * @param {string[]} fileList - 项目根目录下的文件名列表
 * @param {Object} fileContents - { filename: content } 特征文件内容（可选）
 * @returns {{ id: string, label: string, icon: string, sourceRoots: string[], sourceExt: string } | null}
 */
export function detectProjectLanguage(fileList, fileContents = {}) {
    for (const sig of PROJECT_SIGNATURES) {
        const hasMarker = sig.markers.some(m => fileList.includes(m))
        if (!hasMarker) continue

        // 如果提供了文件内容，做二次验证
        if (sig.keywords.length > 0 && Object.keys(fileContents).length > 0) {
            const markerFile = sig.markers.find(m => fileContents[m])
            if (markerFile) {
                const content = fileContents[markerFile]
                const hasKeyword = sig.keywords.some(kw => content.includes(kw))
                if (hasKeyword) {
                    return { id: sig.id, label: sig.label, icon: sig.icon, sourceRoots: sig.sourceRoots, sourceExt: sig.sourceExt }
                }
            }
        }

        // 没有内容可验证时，仅凭特征文件匹配
        return { id: sig.id, label: sig.label, icon: sig.icon, sourceRoots: sig.sourceRoots, sourceExt: sig.sourceExt }
    }
    return null
}

/**
 * 获取所有支持的项目类型
 */
export function getSupportedLanguages() {
    return PROJECT_SIGNATURES.map(s => ({ id: s.id, label: s.label, icon: s.icon }))
}
