import {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Header,
    HeadingLevel,
    Packer,
    PageBreak,
    PageNumber,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    convertMillimetersToTwip,
} from 'docx'
import JSZip from 'jszip'
import { renderDocSections } from './doc-template/doc-docx-renderer.js'
import { renderSectionsToMarkdown } from './doc-template/ops-md-renderer.js'
import {
    createCopyrightSoftwareDocInfo,
    getSoftwareDocumentOption,
} from './copyright-software-docs.js'

const FONT_NAME = '微软雅黑'

const TABLE_BORDER = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: 'aaaaaa',
}

const TABLE_BORDERS = {
    top: TABLE_BORDER,
    bottom: TABLE_BORDER,
    left: TABLE_BORDER,
    right: TABLE_BORDER,
    insideHorizontal: TABLE_BORDER,
    insideVertical: TABLE_BORDER,
}

export function createDefaultCopyrightProfile() {
    return {
        softwareName: '',
        shortName: '',
        version: '',
        softwareCategory: '',
        classificationCode: '',
        workDescription: '',
        originalSoftwareDescription: '',
        rightsScope: '',
        partialRights: '',
        ownerName: '',
        ownerType: '',
        enterpriseEstablishedDate: '',
        applicantName: '',
        applicantIdNo: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        contactAddress: '',
        developmentMode: '',
        rightAcquisition: '',
        isPublished: false,
        firstPublishDate: '',
        firstPublishPlace: '',
        completionDate: '',
        developmentStartDate: '',
        programmingLanguages: '',
        developmentTools: '',
        developmentHardwareEnv: '',
        runtimeHardwareEnv: '',
        developmentSoftwareEnv: '',
        runtimeSoftwareEnv: '',
        operatingPlatform: '',
        softwareType: '',
        applyScope: '',
        technicalFeatures: '',
        sourceLineCount: '',
        sourcePageCount: '',
        documentTypeId: 'user-manual',
        documentName: '',
        documentPageCount: '',
        programDepositType: '',
        documentDepositType: '',
        sourceMaterialStatus: 'ready_in_code_page',
        documentMaterialType: '',
        includeServer: false,
        isUpgrade: false,
        originalRegistrationNo: '',
        hasAgent: false,
        agentName: '',
        nonJobDevelopment: false,
        hasEntrustContract: false,
        hasCooperationContract: false,
        hasTransferProof: false,
        softwareDescription: '',
        notes: '',
    }
}

export const SOFTWARE_TYPE_OPTIONS = [
    { value: 'desktop', label: '桌面应用软件', platform: 'Windows、macOS、Linux' },
    { value: 'web', label: 'Web 系统/网站后台', platform: '主流浏览器、服务器' },
    { value: 'mobile-app', label: '移动 App', platform: 'Android、iOS' },
    { value: 'mini-program', label: '小程序', platform: '微信小程序、支付宝小程序等宿主平台' },
    { value: 'backend-service', label: '后端服务/API', platform: 'Linux/Windows Server、容器、云服务' },
    { value: 'cloud', label: '云端 SaaS/平台服务', platform: '浏览器、云服务器、API 网关' },
    { value: 'embedded', label: '嵌入式/设备软件', platform: '嵌入式设备、固件运行环境' },
    { value: 'multi-terminal', label: '多端系统', platform: 'Web、移动端、小程序、服务端等' },
]

export const APPLY_SCOPE_OPTIONS = [
    { value: 'desktop', label: '桌面端主程序' },
    { value: 'web', label: 'Web 系统/管理后台' },
    { value: 'mobile-app', label: '移动 App' },
    { value: 'mini-program', label: '小程序' },
    { value: 'backend-service', label: '后端服务/API' },
    { value: 'cloud', label: '云端服务端' },
    { value: 'both', label: '桌面端主程序 + 云端服务' },
    { value: 'multi-terminal', label: '多端一体化系统' },
    { value: 'embedded', label: '嵌入式/设备端软件' },
]

export const EXPORTABLE_DOCS = [
    { id: 'application-info', title: '申请填报信息表', filename: '01_申请填报信息表.docx' },
    { id: 'material-checklist', title: '软著申请材料清单', filename: '02_软著申请材料清单.docx' },
    { id: 'user-manual', title: '软件文档鉴别材料', filename: '03_软件文档鉴别材料.docx' },
    { id: 'ownership-statement', title: '权属说明模板', filename: '04_权属说明模板.docx' },
    { id: 'non-job-guarantee', title: '非职务开发保证书模板', filename: '05_非职务开发保证书模板.docx' },
    { id: 'agency-letter', title: '代理委托书模板', filename: '06_代理委托书模板.docx' },
]

export function getCopyrightMaterialItems(profile = {}) {
    const p = normalizeProfile(profile)
    const docOption = getSoftwareDocumentOption(p.documentTypeId)
    const items = [
        {
            id: 'official-application',
            title: '计算机软件著作权登记申请表',
            required: true,
            source: '官方系统',
            status: 'need_external',
            exportDocId: 'application-info',
            note: '需在登记系统在线填写并打印签章；本页导出的是填表信息备份，不替代官方申请表。',
        },
        {
            id: 'source-code',
            title: '源程序鉴别材料',
            required: true,
            source: '软著代码页',
            status: p.sourceMaterialStatus === 'done' ? 'ready' : 'ready_in_code_page',
            note: '建议从“软著代码”页面导出前后各连续 30 页，排除依赖、构建产物、密钥配置和第三方源码。',
        },
        {
            id: 'document-material',
            title: `${p.documentMaterialType || docOption.label}鉴别材料`,
            required: true,
            source: '软件文档页',
            status: hasGeneratedSoftwareDocument(p) ? 'ready' : 'exportable',
            exportDocId: 'user-manual',
            note: '在“软件文档”菜单选择文档类型并扫描开发目录后，可由 AI 基于代码生成用户手册、操作说明书、需求说明书、设计说明书等；最终页眉软件名和版本号需与申请表一致。',
        },
        {
            id: 'platform-release',
            title: '平台发布/上架辅助材料',
            required: false,
            source: '线下准备',
            status: 'optional',
            note: platformReleaseNote(p),
        },
        {
            id: 'identity-proof',
            title: p.ownerType === 'individual' ? '自然人身份证明' : '主体资格证明',
            required: true,
            source: '线下准备',
            status: 'need_external',
            note: p.ownerType === 'individual'
                ? '提交身份证正反面复印件，并按要求签字。'
                : '提交营业执照/法人证书等有效证明复印件，并按要求加盖公章。',
        },
        {
            id: 'ownership-proof',
            title: '权属证明文件',
            required: needsOwnershipProof(p),
            source: '本页模板/线下合同',
            status: needsOwnershipProof(p) ? 'conditional' : 'optional',
            exportDocId: 'ownership-statement',
            note: ownershipNote(p),
        },
        {
            id: 'non-job',
            title: '非职务软件开发保证书',
            required: p.ownerType === 'individual' && p.nonJobDevelopment,
            source: '本页模板',
            status: p.ownerType === 'individual' && p.nonJobDevelopment ? 'conditional' : 'optional',
            exportDocId: 'non-job-guarantee',
            note: '自然人以非职务开发方式申请时可准备；单位申请通常不需要。',
        },
        {
            id: 'agent-letter',
            title: '代理委托书及代理人身份证明',
            required: p.hasAgent,
            source: '本页模板/线下准备',
            status: p.hasAgent ? 'conditional' : 'optional',
            exportDocId: 'agency-letter',
            note: '委托代理办理时准备，签章主体需与申请表一致。',
        },
        {
            id: 'upgrade-proof',
            title: '升级版本原登记证书复印件',
            required: p.isUpgrade,
            source: '线下准备',
            status: p.isUpgrade ? 'conditional' : 'optional',
            note: p.isUpgrade ? '申请升级版本时建议准备原软件登记证书复印件。' : '非升级版本通常不需要。',
        },
    ]
    return items
}

export async function renderCopyrightDoc(docId, profile = {}) {
    switch (docId) {
        case 'application-info':
            return renderApplicationInfoDocx(profile)
        case 'material-checklist':
            return renderMaterialChecklistDocx(profile)
        case 'user-manual':
            return renderSoftwareDocumentDocx(profile)
        case 'ownership-statement':
            return renderOwnershipStatementDocx(profile)
        case 'non-job-guarantee':
            return renderNonJobGuaranteeDocx(profile)
        case 'agency-letter':
            return renderAgencyLetterDocx(profile)
        default:
            throw new Error(`未知导出类型：${docId}`)
    }
}

export async function renderCopyrightPackageZip(profile = {}) {
    const p = normalizeProfile(profile)
    const zip = new JSZip()
    const folder = zip.folder(safeFilename(`${p.softwareName}_软著申请材料包`))

    for (const doc of EXPORTABLE_DOCS) {
        const bytes = await renderCopyrightDoc(doc.id, p)
        folder.file(doc.id === 'user-manual' ? softwareDocumentFilename(p) : doc.filename, bytes)
    }

    folder.file('00_材料包说明.txt', buildPackageReadme(p))
    folder.file('申请填报信息.json', JSON.stringify(p, null, 2))
    folder.file('材料清单.md', renderMaterialChecklistMarkdown(p))
    folder.file(`${safeFilename(p.documentMaterialType || getSoftwareDocumentOption(p.documentTypeId).label)}.md`, renderSoftwareDocumentMarkdown(p))

    return await zip.generateAsync({ type: 'uint8array' })
}

export function renderMaterialChecklistMarkdown(profile = {}) {
    const p = normalizeProfile(profile)
    const lines = [
        `# ${softwareVersionText(p)} 软著申请材料清单`,
        '',
        '| 材料 | 必要性 | 来源 | 状态 | 备注 |',
        '| --- | --- | --- | --- | --- |',
    ]
    for (const item of getCopyrightMaterialItems(p)) {
        lines.push(`| ${item.title} | ${item.required ? '必需' : '按情况'} | ${item.source} | ${statusLabel(item.status)} | ${item.note} |`)
    }
    lines.push('')
    lines.push('## 注意事项')
    lines.push('')
    lines.push('- 申请表、源程序页眉、文档页眉中的软件名称和版本号需要保持一致。')
    lines.push('- 源程序和文档建议使用 A4、纵向、单面、黑白打印，并按要求标注页码。')
    lines.push('- 官方申请表仍需在登记系统在线填写后打印签章，本材料包仅用于准备和归档。')
    return lines.join('\n')
}

export function renderUserManualTemplateMarkdown(profile = {}) {
    return renderSoftwareDocumentMarkdown(profile)
}

export function renderSoftwareDocumentMarkdown(profile = {}) {
    const p = normalizeProfile(profile)
    const generated = p.generatedSoftwareDocument
    if (generated?.sections?.length && hasGeneratedSoftwareDocument(p)) {
        return renderSectionsToMarkdown(generated.sections, generated.docInfo || createCopyrightSoftwareDocInfo(p, p.documentTypeId))
    }

    const option = getSoftwareDocumentOption(p.documentTypeId)
    const lines = [
        `# ${softwareVersionText(p)} ${option.label}`,
        '',
        '> 尚未基于项目目录生成正文。请在“软件文档鉴别材料”区域选择开发目录并使用 AI 生成后再导出正式材料。',
        '',
        '## 1. 软件概述',
        '',
        p.softwareDescription || '请补充软件用途、目标用户和主要能力。',
        '',
        '## 2. 运行环境',
        '',
        `- 操作系统：${p.operatingPlatform || '请补充'}`,
        `- 软件类型：${p.softwareType || '请补充'}`,
        `- 主要技术：${p.programmingLanguages || '请补充'}`,
        '',
        '## 3. 安装与启动',
        '',
        startupGuideText(p),
        '',
        '## 4. 功能操作说明',
        '',
    ]
    scopeManualSections(p).forEach((sec, index) => {
        lines.push(`### 4.${index + 1} ${sec.title}`)
        lines.push('')
        lines.push(sec.content)
        lines.push('')
    })
    lines.push('## 5. 常见问题')
    lines.push('')
    lines.push(commonTroubleshootingText(p))
    return lines.join('\n')
}

function normalizeProfile(profile = {}) {
    return { ...createDefaultCopyrightProfile(), ...(profile || {}) }
}

function hasGeneratedSoftwareDocument(profile = {}) {
    return hasSectionContent(profile.generatedSoftwareDocument?.sections || [])
}

function hasSectionContent(sections = []) {
    for (const section of sections) {
        if ((section.content && String(section.content).trim())
            || (section.mermaidCode && String(section.mermaidCode).trim())
            || section.imageData) {
            return true
        }
        if (section.children?.length && hasSectionContent(section.children)) return true
    }
    return false
}

function softwareDocumentFilename(profile = {}) {
    const option = getSoftwareDocumentOption(profile.documentTypeId)
    const title = profile.documentMaterialType || option.label
    return `03_${safeFilename(title)}.docx`
}

function needsOwnershipProof(profile) {
    return profile.developmentMode !== 'independent'
        || profile.rightAcquisition !== 'original'
        || profile.hasEntrustContract
        || profile.hasCooperationContract
        || profile.hasTransferProof
}

function ownershipNote(profile) {
    if (profile.developmentMode === 'entrusted' || profile.hasEntrustContract) return '委托开发需准备委托开发合同或权属约定文件。'
    if (profile.developmentMode === 'cooperative' || profile.hasCooperationContract) return '合作开发需准备合作开发合同或共同权属说明。'
    if (profile.rightAcquisition === 'transfer' || profile.hasTransferProof) return '受让取得需准备转让协议或权利转移证明。'
    if (profile.rightAcquisition === 'inherit') return '继承或承受取得需准备继承、承受相关证明。'
    return '原始取得且独立开发时通常无需额外权属合同；如存在单位任务、委托、合作、转让等情况需补充。'
}

function platformReleaseNote(profile) {
    const scope = profile.applyScope
    if (scope === 'mobile-app') return 'App 上架应用市场、应用备案、隐私政策、软著证书上传等属于发布/审核材料，通常不是软著登记本身的必交材料。'
    if (scope === 'mini-program') return '小程序认证、备案、类目资质、隐私保护指引、平台审核截图等属于平台发布材料，通常不是软著登记本身的必交材料。'
    if (scope === 'web' || scope === 'cloud') return '网站/平台可能涉及域名、ICP备案、隐私政策、服务协议等发布运营材料，通常不是软著登记本身的必交材料。'
    if (scope === 'multi-terminal' || scope === 'both') return '多端软件后续发布可能分别需要 App、小程序、网站/云服务的备案、隐私政策和平台审核材料。'
    return '如软件需要上架、上线或对外运营，可另行准备平台审核、备案、隐私政策和服务协议等辅助材料。'
}

function text(value, fallback = '') {
    const v = value == null ? '' : String(value).trim()
    return v || fallback
}

function softwareVersionText(profile) {
    const name = text(profile.softwareName, '待填写软件名称')
    const version = text(profile.version, '')
    return version ? `${name} V${version}` : name
}

function yesNo(value) {
    return value ? '是' : '否'
}

function ownerTypeLabel(value) {
    if (!value) return ''
    return value === 'individual' ? '自然人' : value === 'institution' ? '事业/社团/其他组织' : '企业法人'
}

function developmentModeLabel(value) {
    return {
        independent: '独立开发',
        cooperative: '合作开发',
        entrusted: '委托开发',
        assigned: '下达任务开发',
    }[value] || value || ''
}

function rightAcquisitionLabel(value) {
    return {
        original: '原始取得',
        transfer: '受让取得',
        inherit: '继承/承受取得',
    }[value] || value || ''
}

function workDescriptionLabel(value) {
    return {
        original: '原创',
        modified: '修改',
        composed: '合成',
        translated: '翻译',
    }[value] || value || ''
}

function rightsScopeLabel(profile) {
    if (!profile.rightsScope) return ''
    if (profile.rightsScope === 'partial') return `部分权利：${text(profile.partialRights, '待补充')}`
    return '全部权利'
}

function depositTypeLabel(value) {
    return {
        general: '一般交存',
        exception: '例外交存',
        sealed: '封存',
    }[value] || value || ''
}

function scopeLabel(value) {
    return {
        desktop: '桌面端主程序',
        web: 'Web 系统/管理后台',
        'mobile-app': '移动 App',
        'mini-program': '小程序',
        'backend-service': '后端服务/API',
        cloud: '云端服务端',
        both: '桌面端主程序 + 云端服务',
        'multi-terminal': '多端一体化系统',
        embedded: '嵌入式/设备端软件',
    }[value] || value || ''
}

function startupGuideText(profile) {
    const scope = profile.applyScope
    if (scope === 'mobile-app') return '请补充 Android/iOS 安装、首次打开、权限授权、登录、版本更新和卸载流程，并插入真机界面截图。'
    if (scope === 'mini-program') return '请补充通过微信/支付宝搜索、扫码、分享入口进入小程序的流程，以及授权登录、页面跳转和退出路径，并插入真机或开发者工具截图。'
    if (scope === 'web') return '请补充浏览器访问地址、登录入口、账号权限、菜单导航和退出登录流程，并插入浏览器界面截图。'
    if (scope === 'backend-service') return '请补充服务部署、配置、启动、接口调用、日志查看和异常处理流程；如无用户界面，可改用设计说明书或接口说明书作为文档鉴别材料。'
    if (scope === 'cloud') return '请补充云端服务访问地址、账号登录、服务配置、API Key 管理、用量查看和退出流程，并插入控制台截图。'
    if (scope === 'embedded') return '请补充设备初始化、固件/程序烧录、启动、参数配置、运行状态查看和故障处理流程，并插入设备或控制端截图。'
    if (scope === 'multi-terminal' || scope === 'both') return '请分别补充客户端、Web/云端、移动端或小程序的访问入口、登录方式、核心操作和数据同步流程，并插入各端截图。'
    return '请补充安装包获取、安装步骤、首次启动、升级和卸载流程。'
}

function commonTroubleshootingText(profile) {
    const scope = profile.applyScope
    if (scope === 'mobile-app') return '请补充无法安装、权限拒绝、登录失败、网络异常、推送/定位/相册权限不可用等常见问题处理方式。'
    if (scope === 'mini-program') return '请补充无法搜索进入、授权失败、网络异常、页面加载失败、订阅消息或支付能力异常等常见问题处理方式。'
    if (scope === 'web' || scope === 'cloud') return '请补充浏览器兼容、登录失败、权限不足、接口超时、导出失败等常见问题处理方式。'
    if (scope === 'backend-service') return '请补充配置错误、服务无法启动、接口鉴权失败、数据库连接失败、日志排查等常见问题处理方式。'
    return '请补充代码扫描失败、模型配置错误、文档导出失败等常见问题处理方式。'
}

function scopeManualSections(profile) {
    const scope = profile.applyScope
    if (scope === 'mobile-app') {
        return [
            { title: '注册登录', content: '请补充手机号/账号登录、验证码、第三方登录、密码找回等流程，并插入 App 截图。' },
            { title: '首页与导航', content: '请补充底部导航、首页卡片、消息提醒、个人中心等主要入口。' },
            { title: '核心业务功能', content: '请按模块补充新增、查询、编辑、提交、审核、导出等核心操作。' },
            { title: '设置与权限', content: '请补充通知、定位、相册、相机、文件访问等权限说明和设置入口。' },
        ]
    }
    if (scope === 'mini-program') {
        return [
            { title: '进入小程序', content: '请补充搜索、扫码、分享卡片、公众号菜单等入口，以及首次授权流程。' },
            { title: '页面导航', content: '请补充首页、列表页、详情页、表单页、个人中心等页面路径。' },
            { title: '核心业务功能', content: '请按页面补充查询、填报、提交、审批、支付、分享等主要操作。' },
            { title: '消息与授权', content: '请补充订阅消息、手机号授权、隐私授权、位置授权等小程序特有操作。' },
        ]
    }
    if (scope === 'web') {
        return [
            { title: '登录与权限', content: '请补充账号登录、验证码、角色权限、菜单访问控制和退出登录流程。' },
            { title: '工作台与导航', content: '请补充首页工作台、侧边菜单、顶部工具栏、搜索筛选和面包屑路径。' },
            { title: '核心业务功能', content: '请按模块补充列表、详情、新增、编辑、删除、导入、导出、审批等操作。' },
            { title: '系统设置', content: '请补充用户管理、角色管理、参数配置、日志查看等后台管理功能。' },
        ]
    }
    if (scope === 'backend-service') {
        return [
            { title: '服务架构', content: '请补充服务模块、接口网关、数据库、缓存、消息队列、外部系统依赖等设计说明。' },
            { title: '接口调用', content: '请补充认证方式、请求地址、请求参数、响应格式、错误码和调用示例。' },
            { title: '部署配置', content: '请补充环境变量、配置文件、数据库迁移、启动命令和健康检查接口。' },
            { title: '运维监控', content: '请补充日志路径、监控指标、告警、备份恢复和故障排查流程。' },
        ]
    }
    if (scope === 'cloud') {
        return [
            { title: '云端账号与登录', content: '请补充注册、登录、邮箱/短信验证、二次验证和会话管理流程。' },
            { title: '控制台功能', content: '请补充模型配置、用量统计、API Key、消息公告、工单等云端控制台功能。' },
            { title: 'API 服务调用', content: '请补充接口地址、鉴权、请求示例、响应示例、额度扣减和错误处理。' },
            { title: '安全与审计', content: '请补充权限控制、密钥管理、登录日志、用量审计和风控策略。' },
        ]
    }
    if (scope === 'embedded') {
        return [
            { title: '设备初始化', content: '请补充设备连接、参数配置、固件/程序安装和首次运行流程。' },
            { title: '功能操作', content: '请补充采集、控制、通信、数据同步、状态显示等核心操作。' },
            { title: '运行状态与维护', content: '请补充状态灯/屏幕/控制台含义、日志导出、升级和恢复出厂设置。' },
            { title: '异常处理', content: '请补充断电、断网、设备离线、传感器异常等故障处理流程。' },
        ]
    }
    if (scope === 'multi-terminal' || scope === 'both') {
        return [
            { title: '桌面/客户端操作', content: '请补充客户端安装、登录、项目配置、核心功能和文档导出流程。' },
            { title: 'Web/云端控制台', content: '请补充账号管理、后台配置、数据同步、API Key、用量和工单等功能。' },
            { title: '移动端或小程序', content: '如包含 App 或小程序，请补充入口、授权、核心页面、消息通知和终端截图。' },
            { title: '多端数据流转', content: '请补充各端之间的数据同步、权限边界、异常重试和一致性处理。' },
        ]
    }
    return [
        { title: '软著代码生成', content: '请补充添加代码目录、检测文件类型、预览和导出源程序文档的操作步骤，并插入界面截图。' },
        { title: '接口文档生成', content: '请补充项目扫描、接口解析、AI 补充和 Word/Markdown 导出流程，并插入界面截图。' },
        { title: '数据库文档生成', content: '请补充数据库连接、Schema 读取、表字段说明和导出流程，并插入界面截图。' },
        { title: '需求、设计、运维与测试文档生成', content: '请补充模板选择、代码扫描、参考文件导入、AI 生成、人工编辑和导出流程，并插入界面截图。' },
    ]
}

export function statusLabel(status) {
    return {
        ready: '已具备',
        ready_in_code_page: '可在软著代码页导出',
        exportable: '可由本页导出',
        need_external: '需线下/官方系统补充',
        conditional: '按情况准备',
        optional: '可选',
    }[status] || status || ''
}

function statusTone(status) {
    if (['ready', 'exportable'].includes(status)) return '2f855a'
    if (status === 'ready_in_code_page') return '2563eb'
    if (['conditional', 'optional'].includes(status)) return 'b45309'
    return 'dc2626'
}

function makeText(value, options = {}) {
    return new TextRun({
        text: String(value ?? ''),
        font: { name: options.font || FONT_NAME, eastAsia: FONT_NAME },
        size: options.size || 21,
        bold: !!options.bold,
        color: options.color,
        italics: !!options.italics,
    })
}

function para(value = '', options = {}) {
    return new Paragraph({
        alignment: options.alignment,
        heading: options.heading,
        children: Array.isArray(value) ? value : [makeText(value, options)],
        spacing: {
            before: options.before ?? 0,
            after: options.after ?? 120,
            line: options.line ?? 360,
        },
    })
}

function heading(title, level = 1) {
    const headingLevel = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
    const size = level === 1 ? 32 : level === 2 ? 26 : 22
    return para(title, { heading: headingLevel, size, bold: true, before: level === 1 ? 280 : 180, after: 120 })
}

function cell(content, options = {}) {
    const paragraphs = Array.isArray(content)
        ? content
        : String(content ?? '').split('\n').map(line => para(line || ' ', { size: options.size || 19, bold: options.bold, color: options.color, after: 40, line: 300 }))
    return new TableCell({
        children: paragraphs.length ? paragraphs : [para(' ', { size: options.size || 19 })],
        width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
        shading: options.shading ? { fill: options.shading } : undefined,
        margins: {
            top: 90,
            bottom: 90,
            left: 120,
            right: 120,
        },
    })
}

function table(rows, widths = []) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: rows.map((row, index) => new TableRow({
            children: row.map((value, i) => cell(value, {
                width: widths[i],
                bold: index === 0,
                shading: index === 0 ? 'f1f5f9' : undefined,
            })),
        })),
    })
}

function createHeader(title) {
    return new Header({
        children: [para(title, { alignment: AlignmentType.RIGHT, size: 18, color: '64748b', after: 0 })],
    })
}

function createFooter() {
    return new Footer({
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    makeText('第 ', { size: 18 }),
                    new TextRun({ children: [PageNumber.CURRENT], font: { name: FONT_NAME, eastAsia: FONT_NAME }, size: 18 }),
                    makeText(' 页 共 ', { size: 18 }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], font: { name: FONT_NAME, eastAsia: FONT_NAME }, size: 18 }),
                    makeText(' 页', { size: 18 }),
                ],
            }),
        ],
    })
}

async function packDocument(title, children) {
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertMillimetersToTwip(25),
                        bottom: convertMillimetersToTwip(25),
                        left: convertMillimetersToTwip(28),
                        right: convertMillimetersToTwip(25),
                    },
                },
            },
            headers: { default: createHeader(title) },
            footers: { default: createFooter() },
            children,
        }],
    })
    const blob = await Packer.toBlob(doc)
    return new Uint8Array(await blob.arrayBuffer())
}

function cover(title, profile) {
    const p = normalizeProfile(profile)
    return [
        para('', { after: 900 }),
        para(title, { alignment: AlignmentType.CENTER, size: 44, bold: true, after: 360 }),
        para(softwareVersionText(p), { alignment: AlignmentType.CENTER, size: 28, color: '334155', after: 500 }),
        para('请在提交前核对软件名称、版本号、著作权人和签章信息是否完全一致。', { alignment: AlignmentType.CENTER, size: 18, color: '64748b', after: 900 }),
        para([
            makeText('生成日期：', { bold: true }),
            makeText(new Date().toISOString().slice(0, 10)),
        ], { alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new PageBreak()] }),
    ]
}

async function renderApplicationInfoDocx(profile = {}) {
    const p = normalizeProfile(profile)
    const basicRows = [
        ['字段', '内容'],
        ['软件全称', text(p.softwareName)],
        ['软件简称', text(p.shortName)],
        ['版本号', text(p.version)],
        ['软件分类/分类号', `${text(p.softwareCategory, '待补充')}${p.classificationCode ? ` / ${p.classificationCode}` : ''}`],
        ['软件作品说明', text(workDescriptionLabel(p.workDescription), '待补充')],
        ['修改/合成/翻译说明', text(p.originalSoftwareDescription, p.workDescription === 'original' ? '不适用' : '待补充')],
        ['著作权人', text(p.ownerName, p.applicantName)],
        ['著作权人类型', text(ownerTypeLabel(p.ownerType), '待补充')],
        ['企业成立日期', text(p.enterpriseEstablishedDate, p.ownerType === 'enterprise' ? '待补充' : '不适用')],
        ['申请人/联系人', `${text(p.applicantName)} / ${text(p.contactName)}`],
        ['证件或统一社会信用代码', text(p.applicantIdNo)],
        ['联系电话', text(p.contactPhone)],
        ['电子邮箱', text(p.contactEmail)],
        ['联系地址', text(p.contactAddress)],
    ]
    const rightRows = [
        ['字段', '内容'],
        ['开发方式', text(developmentModeLabel(p.developmentMode), '待补充')],
        ['权利取得方式', text(rightAcquisitionLabel(p.rightAcquisition), '待补充')],
        ['权利范围', text(rightsScopeLabel(p), '待补充')],
        ['开发开始日期', text(p.developmentStartDate)],
        ['开发完成日期', text(p.completionDate, '待补充')],
        ['首次发表状态', p.isPublished ? `已发表，首次发表日期：${text(p.firstPublishDate, '待补充')}，地点：${text(p.firstPublishPlace, '待补充')}` : '未发表'],
        ['软件类型', text(p.softwareType, '待补充')],
        ['申请范围', text(scopeLabel(p.applyScope), '待补充')],
        ['升级版本', yesNo(p.isUpgrade)],
        ['原登记号', text(p.originalRegistrationNo, p.isUpgrade ? '待补充' : '不适用')],
    ]
    const techRows = [
        ['字段', '内容'],
        ['主要开发语言/技术', text(p.programmingLanguages)],
        ['开发工具', text(p.developmentTools, '待补充')],
        ['运行平台', text(p.operatingPlatform)],
        ['开发硬件环境', text(p.developmentHardwareEnv, '待补充')],
        ['运行硬件环境', text(p.runtimeHardwareEnv, '待补充')],
        ['开发软件环境', text(p.developmentSoftwareEnv, '待补充')],
        ['运行软件环境', text(p.runtimeSoftwareEnv, '待补充')],
        ['功能简介', text(p.softwareDescription)],
        ['技术特点', text(p.technicalFeatures, '待补充')],
    ]
    const materialRows = [
        ['字段', '内容'],
        ['源程序代码量', text(p.sourceLineCount, '待按实际统计补充')],
        ['源程序提交页数', p.sourcePageCount ? `${text(p.sourcePageCount)} 页` : '待按软著代码页导出结果补充'],
        ['程序鉴别材料交存方式', text(depositTypeLabel(p.programDepositType), '待补充')],
        ['文档名称/类型', text(p.documentName, p.documentMaterialType)],
        ['文档提交页数', p.documentPageCount ? `${text(p.documentPageCount)} 页` : '待按最终软件文档补充'],
        ['文档鉴别材料交存方式', text(depositTypeLabel(p.documentDepositType), '待补充')],
        ['软件功能简介', text(p.softwareDescription)],
        ['备注', text(p.notes, '无')],
    ]
    const children = [
        ...cover('软著申请填报信息表', p),
        heading('1. 基础填报信息'),
        table(basicRows, [28, 72]),
        heading('2. 权利与发表信息'),
        table(rightRows, [28, 72]),
        heading('3. 软件功能和技术特点'),
        table(techRows, [28, 72]),
        heading('4. 鉴别材料信息'),
        table(materialRows, [28, 72]),
        heading('5. 提交前核对'),
        para('本表用于汇总登记系统填报所需信息，不替代中国版权保护中心统一申请表。正式申请表应以登记系统在线填写并打印的表格为准。'),
        para('申请表、源程序鉴别材料、文档鉴别材料中的软件名称、版本号、著作权人名称应保持一致。'),
    ]
    return packDocument('软著申请填报信息表', children)
}

async function renderMaterialChecklistDocx(profile = {}) {
    const p = normalizeProfile(profile)
    const rows = [
        ['材料', '必要性', '来源', '状态', '备注'],
        ...getCopyrightMaterialItems(p).map(item => [
            item.title,
            item.required ? '必需' : '按情况',
            item.source,
            [para(statusLabel(item.status), { size: 19, bold: true, color: statusTone(item.status), after: 40 })],
            item.note,
        ]),
    ]
    const children = [
        ...cover('软著申请材料清单', p),
        heading('1. 材料清单'),
        table(rows, [23, 12, 14, 15, 36]),
        heading('2. 格式要求提示'),
        para('源程序和文档通常提交前、后各连续 30 页；不足 60 页时提交全部内容。源程序页建议每页不少于 50 行，文档页建议每页不少于 30 行，有图页除外。'),
        para('申请文件建议使用 A4 纸张，纵向、单面、黑白打印，页眉/页脚和页码按受理要求处理。'),
    ]
    return packDocument('软著申请材料清单', children)
}

async function renderSoftwareDocumentDocx(profile = {}) {
    const p = normalizeProfile(profile)
    const generated = p.generatedSoftwareDocument
    if (generated?.sections?.length && hasGeneratedSoftwareDocument(p)) {
        return renderDocSections(
            generated.sections,
            generated.docInfo || createCopyrightSoftwareDocInfo(p, p.documentTypeId),
            { includeCover: true, includeToc: true },
        )
    }

    const option = getSoftwareDocumentOption(p.documentTypeId)
    const children = [
        ...cover(`${p.documentMaterialType || option.label}生成骨架`, p),
        para('尚未基于项目目录生成正文。请在“软件文档鉴别材料”区域选择开发目录并使用 AI 生成后，再导出正式文档鉴别材料。', { color: 'dc2626' }),
        heading('1. 软件概述'),
        para(text(p.softwareDescription, '请补充软件用途、目标用户和主要能力。')),
        heading('2. 运行环境'),
        table([
            ['类别', '说明'],
            ['操作系统', text(p.operatingPlatform, '请补充')],
            ['软件类型', text(p.softwareType, '请补充')],
            ['主要技术', text(p.programmingLanguages, '请补充')],
            ['部署/使用范围', scopeLabel(p.applyScope)],
        ], [28, 72]),
        heading('3. 安装与启动'),
        para(startupGuideText(p)),
        heading('4. 功能操作说明'),
        ...scopeManualSections(p).flatMap((sec, index) => [
            heading(`4.${index + 1} ${sec.title}`, 2),
            para(sec.content),
        ]),
        heading('5. 常见问题'),
        para(commonTroubleshootingText(p)),
    ]
    return packDocument(`${p.documentMaterialType || option.label}生成骨架`, children)
}

async function renderOwnershipStatementDocx(profile = {}) {
    const p = normalizeProfile(profile)
    const owner = text(p.ownerName, p.applicantName || '（著作权人名称）')
    const children = [
        ...cover('权属说明模板', p),
        heading('1. 软件权属说明'),
        para(`${owner}确认：${softwareVersionText(p)} 的开发方式为${text(developmentModeLabel(p.developmentMode), '待补充')}，权利取得方式为${text(rightAcquisitionLabel(p.rightAcquisition), '待补充')}。`),
        para('如本软件涉及委托开发、合作开发、下达任务开发、转让、继承或其他权利承受情形，请在此处列明合同名称、签署主体、签署日期和权利归属条款，并附相应证明文件。'),
        heading('2. 签章区'),
        para('著作权人（签字/盖章）：'),
        para('日期：'),
    ]
    return packDocument('权属说明模板', children)
}

async function renderNonJobGuaranteeDocx(profile = {}) {
    const p = normalizeProfile(profile)
    const owner = text(p.ownerName, p.applicantName || '（申请人姓名）')
    const children = [
        ...cover('非职务软件开发保证书模板', p),
        para(`${owner}保证：${softwareVersionText(p)} 系本人独立完成的软件成果，开发过程未利用任职单位的物质技术条件，未承担任职单位工作任务，软件著作权归本人享有。`, { before: 300 }),
        para('如存在任职单位、项目任务、委托或合作情形，请根据真实情况补充单位证明、合同或其他权属文件。'),
        para('保证人（签字）：', { before: 600 }),
        para('身份证号：'),
        para('日期：'),
    ]
    return packDocument('非职务软件开发保证书模板', children)
}

async function renderAgencyLetterDocx(profile = {}) {
    const p = normalizeProfile(profile)
    const owner = text(p.ownerName, p.applicantName || '（委托人名称）')
    const agent = text(p.agentName, '（代理人/代理机构名称）')
    const children = [
        ...cover('代理委托书模板', p),
        para(`${owner}委托${agent}办理${softwareVersionText(p)} 计算机软件著作权登记相关事项。代理事项包括材料整理、申请提交、补正沟通和证书领取/下载等。`, { before: 300 }),
        para('本模板仅用于准备材料，具体授权范围、期限、签章方式应按实际代理要求调整。'),
        para('委托人（签字/盖章）：', { before: 600 }),
        para('代理人/代理机构（签字/盖章）：'),
        para('日期：'),
    ]
    return packDocument('代理委托书模板', children)
}

function buildPackageReadme(profile = {}) {
    const p = normalizeProfile(profile)
    return [
        `${softwareVersionText(p)} 软著申请材料包`,
        '',
        '本材料包包含：',
        ...EXPORTABLE_DOCS.map(doc => `- ${doc.id === 'user-manual' ? softwareDocumentFilename(p) : doc.filename}`),
        '- 申请填报信息.json',
        '- 材料清单.md',
        `- ${safeFilename(p.documentMaterialType || getSoftwareDocumentOption(p.documentTypeId).label)}.md`,
        '',
        '注意：',
        '1. 官方申请表仍需在登记系统在线填写后打印签章。',
        '2. 源程序鉴别材料请在应用“软著代码”页面按最终代码目录另行导出。',
        '3. 软件文档鉴别材料建议先在本页选择开发目录并由 AI 生成，再人工核对后导出。',
        '4. 身份证明、营业执照、合同、授权委托书等签章材料需按真实主体补充。',
    ].join('\n')
}

function safeFilename(name) {
    return String(name || '软著申请材料包').replace(/[\\/:*?"<>|]/g, '_')
}
