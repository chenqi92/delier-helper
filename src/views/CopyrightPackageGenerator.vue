<template>
  <div class="copyright-package-view">
    <div class="view-header">
      <div class="header-title">
        <PackageCheck :size="16" />
        <span>软著材料</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary btn-sm" @click="exportPackage" :disabled="exporting">
          <FileArchive :size="14" /> {{ exporting ? '导出中...' : '导出整包 ZIP' }}
        </button>
        <button class="btn btn-secondary btn-sm" @click="exportDoc('application-info')">
          <FileText :size="14" /> 申请信息
        </button>
        <button class="btn btn-secondary btn-sm" @click="exportDoc('material-checklist')">
          <ListChecks :size="14" /> 材料清单
        </button>
        <button class="btn btn-secondary btn-sm" @click="exportChecklistMarkdown">
          <FileDown :size="14" /> 清单 MD
        </button>
      </div>
    </div>

    <div class="app-body">
      <aside class="config-panel">
        <div class="card">
          <div class="card-header"><h3><BadgeInfo :size="14" /> 软件信息</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">软件全称</label>
              <input class="form-input" v-model="profile.softwareName" placeholder="例：XXX管理系统软件" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">软件简称</label>
                <input class="form-input" v-model="profile.shortName" placeholder="例：XXX系统" />
              </div>
              <div class="form-group">
                <label class="form-label">版本号</label>
                <input class="form-input" v-model="profile.version" placeholder="例：1.0.0" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">软件类型</label>
                <select class="form-input" v-model="profile.softwareType" @change="syncPlatformFromType">
                  <option value="">扫描后自动识别或手动选择</option>
                  <option v-for="type in softwareTypeOptions" :key="type.value" :value="type.label">{{ type.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">申请范围</label>
                <select class="form-input" v-model="profile.applyScope" @change="syncTypeFromScope">
                  <option value="">扫描后自动识别或手动选择</option>
                  <option v-for="scope in applyScopeOptions" :key="scope.value" :value="scope.value">{{ scope.label }}</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">主要开发语言/技术</label>
              <input class="form-input" v-model="profile.programmingLanguages" />
            </div>
            <div class="form-group">
              <label class="form-label">运行平台</label>
              <input class="form-input" v-model="profile.operatingPlatform" />
            </div>
            <div class="form-group">
              <label class="form-label">软件功能简介</label>
              <textarea class="form-input package-textarea" v-model="profile.softwareDescription"></textarea>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3><Layers :size="14" /> 分类与权利</h3></div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">软件分类</label>
                <input class="form-input" v-model="profile.softwareCategory" placeholder="例：应用软件" />
              </div>
              <div class="form-group">
                <label class="form-label">分类号</label>
                <input class="form-input" v-model="profile.classificationCode" placeholder="按官方系统选择后填写" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">软件作品说明</label>
                <select class="form-input" v-model="profile.workDescription">
                  <option value="">请选择</option>
                  <option value="original">原创</option>
                  <option value="modified">修改</option>
                  <option value="composed">合成</option>
                  <option value="translated">翻译</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">权利范围</label>
                <select class="form-input" v-model="profile.rightsScope">
                  <option value="">请选择</option>
                  <option value="all">全部权利</option>
                  <option value="partial">部分权利</option>
                </select>
              </div>
            </div>
            <div class="form-group" v-if="profile.workDescription && profile.workDescription !== 'original'">
              <label class="form-label">修改/合成/翻译说明</label>
              <textarea class="form-input package-textarea-sm" v-model="profile.originalSoftwareDescription" placeholder="说明原软件、修改内容、授权或权利来源"></textarea>
            </div>
            <div class="form-group" v-if="profile.rightsScope === 'partial'">
              <label class="form-label">部分权利明细</label>
              <input class="form-input" v-model="profile.partialRights" placeholder="例：复制权、信息网络传播权" />
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3><CalendarDays :size="14" /> 开发与发表</h3></div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">开发开始日期</label>
                <input class="form-input" type="date" v-model="profile.developmentStartDate" />
              </div>
              <div class="form-group">
                <label class="form-label">开发完成日期</label>
                <input class="form-input" type="date" v-model="profile.completionDate" />
              </div>
            </div>
            <label class="checkbox-label package-checkline">
              <input type="checkbox" v-model="profile.isPublished" /> 已首次发表
            </label>
            <div class="form-group" v-if="profile.isPublished">
              <label class="form-label">首次发表日期</label>
              <input class="form-input" type="date" v-model="profile.firstPublishDate" />
            </div>
            <div class="form-group" v-if="profile.isPublished">
              <label class="form-label">首次发表地点</label>
              <input class="form-input" v-model="profile.firstPublishPlace" placeholder="国家/城市或线上发布平台" />
            </div>
            <label class="checkbox-label package-checkline">
              <input type="checkbox" v-model="profile.isUpgrade" /> 升级版本申请
            </label>
            <div class="form-group" v-if="profile.isUpgrade">
              <label class="form-label">原登记号</label>
              <input class="form-input" v-model="profile.originalRegistrationNo" placeholder="已有证书编号" />
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3><Building2 :size="14" /> 申请主体</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">著作权人名称</label>
              <input class="form-input" v-model="profile.ownerName" placeholder="企业全称或个人姓名" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">主体类型</label>
                <select class="form-input" v-model="profile.ownerType">
                  <option value="">请选择</option>
                  <option value="enterprise">企业法人</option>
                  <option value="individual">自然人</option>
                  <option value="institution">事业/社团/其他组织</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">证件/统一社会信用代码</label>
                <input class="form-input" v-model="profile.applicantIdNo" />
              </div>
            </div>
            <div class="form-group" v-if="profile.ownerType === 'enterprise'">
              <label class="form-label">企业成立日期</label>
              <input class="form-input" type="date" v-model="profile.enterpriseEstablishedDate" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">申请人</label>
                <input class="form-input" v-model="profile.applicantName" />
              </div>
              <div class="form-group">
                <label class="form-label">联系人</label>
                <input class="form-input" v-model="profile.contactName" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">联系电话</label>
                <input class="form-input" v-model="profile.contactPhone" />
              </div>
              <div class="form-group">
                <label class="form-label">电子邮箱</label>
                <input class="form-input" type="email" v-model="profile.contactEmail" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">联系地址</label>
              <input class="form-input" v-model="profile.contactAddress" />
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3><FileCheck2 :size="14" /> 权属与代理</h3></div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">开发方式</label>
                <select class="form-input" v-model="profile.developmentMode">
                  <option value="">请选择</option>
                  <option value="independent">独立开发</option>
                  <option value="cooperative">合作开发</option>
                  <option value="entrusted">委托开发</option>
                  <option value="assigned">下达任务开发</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">权利取得</label>
                <select class="form-input" v-model="profile.rightAcquisition">
                  <option value="">请选择</option>
                  <option value="original">原始取得</option>
                  <option value="transfer">受让取得</option>
                  <option value="inherit">继承/承受取得</option>
                </select>
              </div>
            </div>
            <label class="checkbox-label package-checkline">
              <input type="checkbox" v-model="profile.hasEntrustContract" /> 有委托开发合同/任务书
            </label>
            <label class="checkbox-label package-checkline">
              <input type="checkbox" v-model="profile.hasCooperationContract" /> 有合作开发合同
            </label>
            <label class="checkbox-label package-checkline">
              <input type="checkbox" v-model="profile.hasTransferProof" /> 有转让/继受证明
            </label>
            <label class="checkbox-label package-checkline" v-if="profile.ownerType === 'individual'">
              <input type="checkbox" v-model="profile.nonJobDevelopment" /> 非职务开发
            </label>
            <label class="checkbox-label package-checkline">
              <input type="checkbox" v-model="profile.hasAgent" /> 委托代理办理
            </label>
            <div class="form-group" v-if="profile.hasAgent">
              <label class="form-label">代理人/代理机构</label>
              <input class="form-input" v-model="profile.agentName" />
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3><Cpu :size="14" /> 技术与鉴别材料</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">开发工具</label>
              <input class="form-input" v-model="profile.developmentTools" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">开发硬件环境</label>
                <input class="form-input" v-model="profile.developmentHardwareEnv" />
              </div>
              <div class="form-group">
                <label class="form-label">运行硬件环境</label>
                <input class="form-input" v-model="profile.runtimeHardwareEnv" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">开发软件环境</label>
                <input class="form-input" v-model="profile.developmentSoftwareEnv" />
              </div>
              <div class="form-group">
                <label class="form-label">运行软件环境</label>
                <input class="form-input" v-model="profile.runtimeSoftwareEnv" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">技术特点</label>
              <textarea class="form-input package-textarea-sm" v-model="profile.technicalFeatures"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">源程序代码量</label>
                <input class="form-input" v-model="profile.sourceLineCount" placeholder="例：29585 行" />
              </div>
              <div class="form-group">
                <label class="form-label">源程序页数</label>
                <input class="form-input" v-model="profile.sourcePageCount" placeholder="例：60" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">程序交存方式</label>
                <select class="form-input" v-model="profile.programDepositType">
                  <option value="">请选择</option>
                  <option value="general">一般交存</option>
                  <option value="exception">例外交存</option>
                  <option value="sealed">封存</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">文档交存方式</label>
                <select class="form-input" v-model="profile.documentDepositType">
                  <option value="">请选择</option>
                  <option value="general">一般交存</option>
                  <option value="exception">例外交存</option>
                  <option value="sealed">封存</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">文档名称/类型</label>
                <input class="form-input" v-model="profile.documentName" placeholder="例：用户操作手册" />
              </div>
              <div class="form-group">
                <label class="form-label">文档页数</label>
                <input class="form-input" v-model="profile.documentPageCount" placeholder="例：60" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main class="content-panel">
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">{{ materialStats.total }}</div><div class="stat-label">材料项</div></div>
          <div class="stat-card"><div class="stat-value">{{ materialStats.exportable }}</div><div class="stat-label">可导出</div></div>
          <div class="stat-card"><div class="stat-value">{{ materialStats.external }}</div><div class="stat-label">需补充</div></div>
          <div class="stat-card"><div class="stat-value">{{ exportableDocs.length }}</div><div class="stat-label">单项文档</div></div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3><ClipboardList :size="14" /> 申请信息摘要</h3>
            <button class="btn btn-secondary btn-sm" @click="resetProfile"><RotateCcw :size="14" /> 重置</button>
          </div>
          <div class="card-body">
            <div class="package-summary-grid">
              <div><span>软件</span><strong>{{ profile.softwareName || '待填写' }} V{{ profile.version || '待填写' }}</strong></div>
              <div><span>主体</span><strong>{{ profile.ownerName || profile.applicantName || '待填写' }}</strong></div>
              <div><span>开发</span><strong>{{ developmentModeText }} / {{ rightText }}</strong></div>
              <div><span>发表</span><strong>{{ profile.isPublished ? (profile.firstPublishDate || '已发表，日期待填') : '未发表' }}</strong></div>
            </div>
            <div class="package-note">
              官方申请表仍需在登记系统在线填写后打印签章；本页导出的“申请信息表”用于填报前核对和归档。
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3><ListChecks :size="14" /> 软著材料清单</h3></div>
          <div class="card-body">
            <div class="material-list">
              <div v-for="item in materialItems" :key="item.id" class="material-row">
                <div class="material-main">
                  <div class="material-title">
                    <span>{{ item.title }}</span>
                    <span :class="['badge', item.required ? 'badge-warning' : 'badge-primary']">{{ item.required ? '必需' : '按情况' }}</span>
                  </div>
                  <div class="material-meta">
                    <span>{{ item.source }}</span>
                    <span :class="statusClass(item.status)">{{ statusText(item.status) }}</span>
                  </div>
                  <p>{{ item.note }}</p>
                </div>
                <button v-if="item.exportDocId" class="btn btn-secondary btn-sm" @click="exportDoc(item.exportDocId)">
                  <FileDown :size="14" /> 导出
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3><Files :size="14" /> 单项导出</h3></div>
          <div class="card-body">
            <div class="export-grid">
              <button v-for="doc in exportableDocs" :key="doc.id" class="export-tile" @click="exportDoc(doc.id)">
                <FileText :size="18" />
                <span>{{ doc.title }}</span>
              </button>
              <button class="export-tile" @click="exportProfileJson">
                <Braces :size="18" />
                <span>申请信息 JSON</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import {
  BadgeInfo, Braces, Building2, CalendarDays, ClipboardList, FileArchive,
  Bot, Check, ChevronRight, Cpu, FileCheck2, FileDown, FileText, Files,
  FolderOpen, Layers, ListChecks, PackageCheck, RotateCcw, Search, X
} from 'lucide-vue-next'
import { getRecentProjects, loadPageConfig, savePageConfig, saveRecentProject } from '../core/db.js'
import { scanCodebase, buildContextSummary } from '../core/doc-template/codebase-scanner.js'
import { renderDocSections } from '../core/doc-template/doc-docx-renderer.js'
import { renderSectionsToMarkdown } from '../core/doc-template/ops-md-renderer.js'
import {
  applyDocSectionResult,
  buildDocSectionPrompt,
  createAiController,
  evaluateSectionQuality,
  fillDocSections,
} from '../core/doc-template/doc-llm-service.js'
import { callLlm, getResolvedConfig } from '../core/llm/llm-service.js'
import { findSectionById, getEnabledLeafSections } from '../core/doc-template/srs-template.js'
import {
  EXPORTABLE_DOCS,
  APPLY_SCOPE_OPTIONS,
  SOFTWARE_TYPE_OPTIONS,
  createDefaultCopyrightProfile,
  getCopyrightMaterialItems,
  renderCopyrightDoc,
  renderCopyrightPackageZip,
  renderMaterialChecklistMarkdown,
  statusLabel,
} from '../core/copyright-package-renderer.js'
import {
  COPYRIGHT_PROFILE_KEY,
  SOFTWARE_DOC_CONFIG_KEY,
  SOFTWARE_DOCUMENT_OPTIONS,
  buildCopyrightSoftwareDocContext,
  createCopyrightSoftwareDocInfo,
  createCopyrightSoftwareDocSections,
  getSoftwareDocumentOption,
  inferCopyrightProfileFromScan,
  stripLegacyCopyrightDefaults,
} from '../core/copyright-software-docs.js'
import { modelSnapshot, saveHistoryRecord, scanSourceSnapshot, sectionsArtifact } from '../core/generation-history.js'
import SectionEditor from '../components/SectionEditor.vue'
import ReferenceFiles from '../components/ReferenceFiles.vue'

const PROFILE_KEY = COPYRIGHT_PROFILE_KEY
const SOFTWARE_DOC_KEY = SOFTWARE_DOC_CONFIG_KEY
const SECTION_TEMPERATURE = { diagram: 0.1, table: 0.35, text: 0.55 }

export default {
  name: 'CopyrightPackageGenerator',
  components: {
    BadgeInfo, Braces, Building2, CalendarDays, ClipboardList, FileArchive,
    Bot, Check, ChevronRight, Cpu, FileCheck2, FileDown, FileText, Files,
    FolderOpen, Layers, ListChecks, PackageCheck, ReferenceFiles, RotateCcw,
    Search, SectionEditor, X
  },
  inject: ['showToast', 'globalStore'],
  data() {
    return {
      profile: createDefaultCopyrightProfile(),
      applyScopeOptions: APPLY_SCOPE_OPTIONS,
      softwareTypeOptions: SOFTWARE_TYPE_OPTIONS,
      documentOptions: SOFTWARE_DOCUMENT_OPTIONS,
      softwareDocSections: createCopyrightSoftwareDocSections('user-manual', createDefaultCopyrightProfile()),
      expandedSections: new Set(),
      projectDirs: [],
      recentProjects: [],
      scanning: false,
      scanResult: null,
      referenceFiles: [],
      aiProcessing: false,
      aiProgressText: '',
      aiController: null,
      selectedProviderId: null,
      selectedModelId: null,
      exporting: false,
      loaded: false,
    }
  },
  computed: {
    exportableDocs() {
      return EXPORTABLE_DOCS
    },
    providerConfigs() {
      return this.globalStore?.providerConfigs || []
    },
    projectDirsSafe() {
      return Array.isArray(this.projectDirs) ? this.projectDirs : []
    },
    recentProjectsSafe() {
      return Array.isArray(this.recentProjects) ? this.recentProjects : []
    },
    softwareDocSectionsSafe() {
      return Array.isArray(this.softwareDocSections) ? this.softwareDocSections : []
    },
    currentProviderModels() {
      const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      return provider?.models || []
    },
    softwareDocOption() {
      return getSoftwareDocumentOption(this.profile.documentTypeId)
    },
    softwareDocInfo() {
      return createCopyrightSoftwareDocInfo(this.profile, this.profile.documentTypeId)
    },
    softwareDocLeafSections() {
      return getEnabledLeafSections(this.softwareDocSectionsSafe)
    },
    softwareDocSectionTotal() {
      return this.softwareDocLeafSections.length
    },
    generatedSoftwareDocCount() {
      return this.softwareDocLeafSections.filter(s => (s.content && s.content.trim()) || (s.mermaidCode && s.mermaidCode.trim()) || s.imageData).length
    },
    hasGeneratedSoftwareDoc() {
      return this.generatedSoftwareDocCount > 0
    },
    materialItems() {
      return getCopyrightMaterialItems(this.exportProfile())
    },
    materialStats() {
      const items = this.materialItems
      return {
        total: items.length,
        exportable: items.filter(i => i.exportDocId || ['ready', 'ready_in_code_page', 'exportable'].includes(i.status)).length,
        external: items.filter(i => ['need_external', 'conditional'].includes(i.status) && i.required).length,
      }
    },
    developmentModeText() {
      return {
        independent: '独立开发',
        cooperative: '合作开发',
        entrusted: '委托开发',
        assigned: '下达任务开发',
      }[this.profile.developmentMode] || ''
    },
    rightText() {
      return {
        original: '原始取得',
        transfer: '受让取得',
        inherit: '继承/承受取得',
      }[this.profile.rightAcquisition] || ''
    },
  },
  watch: {
    profile: {
      deep: true,
      handler() {
        if (!this.loaded) return
        this.persistProfile()
      },
    },
    softwareDocSections: {
      deep: true,
      handler() {
        if (!this.loaded) return
        this.persistSoftwareDoc()
      },
    },
  },
  async created() {
    const saved = await loadPageConfig(PROFILE_KEY).catch(() => null)
    if (saved) {
      this.profile = { ...createDefaultCopyrightProfile(), ...stripLegacyCopyrightDefaults(saved) }
    } else {
      const copyrightConfig = await loadPageConfig('copyright-config').catch(() => null)
      if (copyrightConfig) {
        this.profile.softwareName = copyrightConfig.softwareName || this.profile.softwareName
        this.profile.version = copyrightConfig.version || this.profile.version
      }
    }
    this.profile.documentTypeId = this.profile.documentTypeId || 'user-manual'
    this.syncDocumentNameFromType(false)
    const savedDoc = await loadPageConfig(SOFTWARE_DOC_KEY).catch(() => null)
    if (Array.isArray(savedDoc?.sections) && savedDoc.sections.length && savedDoc.documentTypeId === this.profile.documentTypeId) {
      this.softwareDocSections = savedDoc.sections
    } else {
      this.resetSoftwareDocSections()
    }
    this.expandedSections = new Set(this.softwareDocSectionsSafe.map(s => s.id))
    this.syncSelectionFromStore()
    this.loadRecentProjects()
    this.loaded = true
  },
  activated() {
    if (!this.loaded) return
    this.reloadSharedData().catch(() => {})
  },
  methods: {
    async reloadSharedData() {
      const saved = await loadPageConfig(PROFILE_KEY).catch(() => null)
      if (saved) {
        this.profile = { ...createDefaultCopyrightProfile(), ...stripLegacyCopyrightDefaults(saved) }
        this.profile.documentTypeId = this.profile.documentTypeId || 'user-manual'
        this.syncDocumentNameFromType(false)
      }
      const savedDoc = await loadPageConfig(SOFTWARE_DOC_KEY).catch(() => null)
      if (Array.isArray(savedDoc?.sections) && savedDoc.sections.length && savedDoc.documentTypeId === this.profile.documentTypeId) {
        this.softwareDocSections = savedDoc.sections
      }
    },
    persistProfile() {
      savePageConfig(PROFILE_KEY, this.profile).catch(() => {})
    },
    persistSoftwareDoc() {
      savePageConfig(SOFTWARE_DOC_KEY, {
        documentTypeId: this.profile.documentTypeId,
        sections: this.softwareDocSections,
      }).catch(() => {})
    },
    exportProfile() {
      const option = this.softwareDocOption
      return {
        ...this.profile,
        documentMaterialType: option.label,
        documentName: option.label,
        generatedSoftwareDocument: {
          typeId: option.id,
          title: option.label,
          docInfo: this.softwareDocInfo,
          sections: this.softwareDocSections,
          generatedSections: this.generatedSoftwareDocCount,
        },
      }
    },
    resetSoftwareDocSections() {
      this.softwareDocSections = createCopyrightSoftwareDocSections(this.profile.documentTypeId, this.profile)
      this.expandedSections = new Set(this.softwareDocSectionsSafe.map(s => s.id))
    },
    syncDocumentNameFromType(persist = true) {
      const option = getSoftwareDocumentOption(this.profile.documentTypeId)
      this.profile.documentMaterialType = option.label
      this.profile.documentName = option.label
      if (persist) this.persistProfile()
    },
    onSoftwareDocTypeChange() {
      if (this.aiProcessing) {
        this.showToast('AI 正在生成中，请先停止生成再切换文档类型', 'warning')
        return
      }
      this.syncDocumentNameFromType()
      this.resetSoftwareDocSections()
      this.persistSoftwareDoc()
      this.showToast(`已切换为${this.softwareDocOption.label}`, 'success')
    },
    async addProjectDir() {
      const dir = await open({ directory: true, multiple: false, title: '选择软件开发目录' })
      if (!dir) return
      if (this.projectDirs.includes(dir)) {
        this.showToast('该目录已添加', 'warning')
        return
      }
      this.projectDirs.push(dir)
      saveRecentProject(dir, 'copyright-package').catch(() => {})
    },
    removeDir(index) {
      this.projectDirs.splice(index, 1)
      if (this.projectDirs.length === 0) this.scanResult = null
    },
    async startScan() {
      if (this.projectDirs.length === 0) {
        this.showToast('请先选择软件开发目录', 'warning')
        return
      }
      this.scanning = true
      this.addLog('开始扫描软件开发目录...')
      try {
        this.scanResult = await scanCodebase(this.projectDirs)
        const { totalFiles, totalDirs, languages } = this.scanResult.stats
        const langList = Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([lang]) => lang).join('、')
        this.addLog(`[完成] 扫描完成: ${totalFiles} 个文件, ${totalDirs} 个目录${langList ? `, 主要语言: ${langList}` : ''}`, 'success')
        this.showToast(`扫描完成，发现 ${totalFiles} 个文件`, 'success')
        this.fillProfileFromScan()
      } catch (e) {
        this.addLog('[失败] 扫描失败: ' + String(e), 'error')
        this.showToast('扫描失败: ' + String(e), 'error')
      } finally {
        this.scanning = false
      }
    },
    fillProfileFromScan() {
      if (!this.scanResult) return
      this.profile = inferCopyrightProfileFromScan(this.scanResult, this.profile)
      this.syncDocumentNameFromType(false)
      this.persistProfile()
    },
    onUpdateReferenceFiles(files) {
      this.referenceFiles = files
    },
    toggleSection(id) {
      const next = new Set(this.expandedSections)
      next.has(id) ? next.delete(id) : next.add(id)
      this.expandedSections = next
    },
    onContentUpdate({ sectionId, content, mermaidCode }) {
      const section = findSectionById(this.softwareDocSections, sectionId)
      if (!section) return
      if (content !== undefined) section.content = content
      if (mermaidCode !== undefined) section.mermaidCode = mermaidCode
      this.softwareDocSections = [...this.softwareDocSections]
    },
    onImageUpload({ sectionId, imageData }) {
      const section = findSectionById(this.softwareDocSections, sectionId)
      if (!section) return
      section.imageData = imageData
      this.softwareDocSections = [...this.softwareDocSections]
    },
    onProviderSelect() {
      const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (provider?.models?.length) this.selectedModelId = provider.activeModelId || provider.models[0].id
    },
    async startAiGenerate() {
      if (this.aiProcessing) return
      if (!this.scanResult) {
        this.showToast('请先选择开发目录并扫描代码库', 'warning')
        return
      }
      const provider = this.requireProvider()
      if (!provider) return
      const config = getResolvedConfig(provider, this.selectedModelId)
      if (!config?.model) {
        this.showToast('请选择模型', 'warning')
        return
      }

      const controller = createAiController()
      this.aiProcessing = true
      window.dispatchEvent(new Event('ai-fill-start'))
      this.aiController = controller
      const modelLabel = provider.models.find(m => m.id === config.model)?.label || config.model
      this.aiProgressText = `使用 ${provider.label} / ${modelLabel}...`

      try {
        const context = this.buildSoftwareDocContext()
        const sections = getEnabledLeafSections(this.softwareDocSections)
        await fillDocSections(
          config,
          sections,
          context,
          this.softwareDocInfo,
          (msg, level) => {
            this.addLog(msg, level)
            this.aiProgressText = msg
          },
          () => {
            this.softwareDocSections = [...this.softwareDocSections]
          },
          controller,
        )

        if (controller.cancelled) {
          this.showToast('已停止生成', 'info')
        } else {
          await this.saveSoftwareDocHistory(provider, config)
          this.persistSoftwareDoc()
          this.showToast(`${this.softwareDocOption.label}生成完成`, 'success')
        }
      } catch (e) {
        if (e?.name === 'AbortError' || controller.cancelled) this.showToast('已停止生成', 'info')
        else this.showToast('生成失败: ' + String(e), 'error')
      } finally {
        if (this.aiController === controller) {
          this.aiProcessing = false
          this.aiProgressText = ''
          this.aiController = null
        }
      }
    },
    async generateSingle(sectionId) {
      if (this.aiProcessing) return
      if (!this.scanResult) {
        this.showToast('请先扫描开发目录', 'warning')
        return
      }
      const provider = this.requireProvider()
      if (!provider) return
      const config = getResolvedConfig(provider, this.selectedModelId)
      const section = findSectionById(this.softwareDocSections, sectionId)
      if (!section || !config?.model) return

      const controller = createAiController()
      this.aiProcessing = true
      this.aiController = controller
      section.generating = true
      section.error = null
      this.softwareDocSections = [...this.softwareDocSections]
      this.aiProgressText = `生成 ${section.number} ${section.title}...`
      this.addLog(`[进行] 单独生成: ${section.number} ${section.title}`)
      try {
        const messages = buildDocSectionPrompt(section, this.buildSoftwareDocContext(), this.softwareDocInfo)
        const defaultMaxTokens = section.type === 'diagram' ? 4096 : 16384
        const maxTokens = config.maxOutputTokens || defaultMaxTokens
        const temperature = SECTION_TEMPERATURE[section.type] ?? 0.5
        const responseText = await callLlm(config, messages, { maxTokens, temperature, jsonMode: false, signal: controller.signal })
        applyDocSectionResult(responseText, section)
        section.error = null
        const warnings = evaluateSectionQuality(section)
        if (warnings.length) this.addLog(`[完成] ${section.number} ${section.title} ⚠ ${warnings.join('；')}`, 'warn')
        else this.addLog(`[完成] ${section.number} ${section.title} ✓`, 'success')
        this.persistSoftwareDoc()
        this.showToast(`${section.number} ${section.title} 生成完成`, 'success')
      } catch (e) {
        if (e?.name === 'AbortError' || controller.cancelled) {
          this.showToast('已停止生成', 'info')
        } else {
          section.error = e.message || String(e)
          this.addLog(`[失败] ${section.number} ${section.title}: ${section.error}`, 'error')
          this.showToast('生成失败: ' + String(e), 'error')
        }
      } finally {
        section.generating = false
        this.softwareDocSections = [...this.softwareDocSections]
        if (this.aiController === controller) {
          this.aiProcessing = false
          this.aiProgressText = ''
          this.aiController = null
        }
      }
    },
    toggleAiPause() {
      if (!this.aiController) return
      this.aiController.paused ? this.aiController.resume() : this.aiController.pause()
    },
    cancelAi() {
      if (!this.aiController) return
      this.aiController.cancel()
      this.aiProcessing = false
      this.aiProgressText = '已停止'
    },
    requireProvider() {
      if (this.providerConfigs.length === 0) {
        this.showToast('请先在「AI 设置」标签页配置模型', 'warning')
        return null
      }
      const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (!provider) {
        this.showToast('请先选择 AI 厂商和模型', 'warning')
        return null
      }
      return provider
    },
    buildSoftwareDocContext() {
      const base = buildContextSummary(this.scanResult, this.softwareDocInfo, this.referenceFiles)
      return buildCopyrightSoftwareDocContext(base, this.profile, this.softwareDocOption)
    },
    async exportSoftwareDocWord() {
      const path = await save({
        title: `导出${this.softwareDocOption.label}`,
        defaultPath: `${this.profile.softwareName || '软件'}_${this.softwareDocOption.label}.docx`,
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      })
      if (!path) return
      try {
        const bytes = await renderDocSections(this.softwareDocSections, this.softwareDocInfo)
        await writeFile(path, bytes)
        this.showToast(`${this.softwareDocOption.label}已导出`, 'success')
      } catch (e) {
        this.showToast('导出失败: ' + String(e), 'error')
      }
    },
    async exportSoftwareDocMarkdown() {
      const path = await save({
        title: `导出${this.softwareDocOption.label} Markdown`,
        defaultPath: `${this.profile.softwareName || '软件'}_${this.softwareDocOption.label}.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })
      if (!path) return
      try {
        await writeTextFile(path, renderSectionsToMarkdown(this.softwareDocSections, this.softwareDocInfo))
        this.showToast(`${this.softwareDocOption.label} Markdown 已导出`, 'success')
      } catch (e) {
        this.showToast('导出失败: ' + String(e), 'error')
      }
    },
    async saveSoftwareDocHistory(provider, config) {
      await saveHistoryRecord({
        type: 'copyright-package',
        title: `${this.profile.softwareName || '未命名软件'} ${this.softwareDocOption.label}`,
        summary: `${this.generatedSoftwareDocCount}/${this.softwareDocLeafSections.length} 个章节已生成，${this.projectDirs.length} 个目录`,
        providerId: provider.id,
        modelId: config.model,
        source: scanSourceSnapshot(this.projectDirs, this.scanResult, this.referenceFiles),
        settings: {
          profile: this.profile,
          documentType: this.softwareDocOption,
          model: modelSnapshot(provider, this.selectedModelId, config),
        },
        result: {
          generatedSections: this.generatedSoftwareDocCount,
          totalSections: this.softwareDocLeafSections.length,
        },
        artifact: sectionsArtifact(this.softwareDocSections, this.softwareDocInfo),
      })
    },
    addLog(msg, level = 'info') {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      window.dispatchEvent(new CustomEvent('ai-log', { detail: { time, msg, level } }))
    },
    syncSelectionFromStore() {
      if (this.providerConfigs.length > 0 && !this.selectedProviderId) {
        this.selectedProviderId = this.globalStore?.activeProviderId || this.providerConfigs[0].id
        const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId)
        this.selectedModelId = this.globalStore?.activeModelId || provider?.activeModelId || (provider?.models[0]?.id || '')
      }
    },
    async loadRecentProjects() {
      try {
        this.recentProjects = (await getRecentProjects('copyright-package')).map(r => r.path)
      } catch { /* ignore */ }
    },
    addRecentDir(path) {
      if (this.projectDirs.includes(path)) return
      this.projectDirs.push(path)
    },
    statusText(status) {
      return statusLabel(status)
    },
    statusClass(status) {
      return {
        'material-status': true,
        ready: ['ready', 'exportable'].includes(status),
        info: status === 'ready_in_code_page',
        warning: ['conditional', 'optional'].includes(status),
        danger: status === 'need_external',
      }
    },
    docMeta(docId) {
      return EXPORTABLE_DOCS.find(d => d.id === docId)
    },
    syncPlatformFromType() {
      const opt = this.softwareTypeOptions.find(item => item.label === this.profile.softwareType)
      if (!opt) return
      const knownPlatforms = this.softwareTypeOptions.map(item => item.platform)
      if (!this.profile.operatingPlatform || knownPlatforms.includes(this.profile.operatingPlatform)) {
        this.profile.operatingPlatform = opt.platform
      }
    },
    syncTypeFromScope() {
      const typeByScope = {
        desktop: '桌面应用软件',
        web: 'Web 系统/网站后台',
        'mobile-app': '移动 App',
        'mini-program': '小程序',
        'backend-service': '后端服务/API',
        cloud: '云端 SaaS/平台服务',
        both: '多端系统',
        'multi-terminal': '多端系统',
        embedded: '嵌入式/设备软件',
      }
      const nextType = typeByScope[this.profile.applyScope]
      const knownTypes = this.softwareTypeOptions.map(item => item.label)
      if (nextType && (!this.profile.softwareType || knownTypes.includes(this.profile.softwareType))) {
        this.profile.softwareType = nextType
        this.syncPlatformFromType()
      }
    },
    async exportDoc(docId) {
      const meta = this.docMeta(docId)
      const defaultPath = docId === 'user-manual'
        ? `${this.profile.softwareName || '软件'}_${this.softwareDocOption.label}.docx`
        : (meta?.filename || '软著材料.docx')
      const path = await save({
        title: `导出${meta?.title || '软著材料'}`,
        defaultPath,
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      })
      if (!path) return
      try {
        const bytes = await renderCopyrightDoc(docId, this.exportProfile())
        await writeFile(path, bytes)
        this.showToast(`${meta?.title || '文档'}已导出`, 'success')
      } catch (e) {
        this.showToast(String(e), 'error')
      }
    },
    async exportPackage() {
      const path = await save({
        title: '导出软著申请材料包',
        defaultPath: `${this.profile.softwareName || '软件'}_软著申请材料包.zip`,
        filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
      })
      if (!path) return
      this.exporting = true
      try {
        const payload = this.exportProfile()
        const bytes = await renderCopyrightPackageZip(payload)
        await writeFile(path, bytes)
        await saveHistoryRecord({
          type: 'copyright-package',
          title: `${this.profile.softwareName || '未命名软件'} 软著材料包`,
          summary: `${EXPORTABLE_DOCS.length} 个单项文档，${this.materialItems.length} 个材料项`,
          settings: payload,
          result: { outputPath: path, materialCount: this.materialItems.length, documentCount: EXPORTABLE_DOCS.length },
          artifact: { kind: 'copyright-package', profile: payload, materials: this.materialItems },
        })
        this.showToast('软著材料包已导出', 'success')
      } catch (e) {
        this.showToast(String(e), 'error')
      }
      this.exporting = false
    },
    async exportChecklistMarkdown() {
      const path = await save({
        title: '导出材料清单 Markdown',
        defaultPath: '软著申请材料清单.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })
      if (!path) return
      await writeTextFile(path, renderMaterialChecklistMarkdown(this.exportProfile()))
      this.showToast('材料清单 Markdown 已导出', 'success')
    },
    async exportProfileJson() {
      const path = await save({
        title: '导出申请信息 JSON',
        defaultPath: '软著申请填报信息.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!path) return
      await writeTextFile(path, JSON.stringify(this.exportProfile(), null, 2))
      this.showToast('申请信息 JSON 已导出', 'success')
    },
    resetProfile() {
      this.profile = createDefaultCopyrightProfile()
      this.resetSoftwareDocSections()
      this.persistProfile()
      this.persistSoftwareDoc()
      this.showToast('已重置软著材料信息', 'success')
    },
  },
}
</script>

<style scoped>
.copyright-package-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.copyright-package-view .view-header {
  justify-content: space-between;
  gap: 12px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.package-textarea {
  min-height: 86px;
  resize: vertical;
  line-height: 1.5;
}

.package-textarea-sm {
  min-height: 64px;
  resize: vertical;
  line-height: 1.5;
}

.package-checkline {
  margin: 8px 0;
}

.package-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.package-summary-grid > div {
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
}

.package-summary-grid span {
  display: block;
  margin-bottom: 5px;
  color: var(--text-muted);
  font-size: 11px;
}

.package-summary-grid strong {
  display: block;
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
}

.package-note {
  margin-top: 10px;
  padding: 8px 10px;
  border-left: 3px solid var(--primary-500);
  background: rgba(99, 102, 241, 0.08);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.material-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.material-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
}

.material-main {
  flex: 1;
  min-width: 0;
}

.material-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.material-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 11px;
}

.material-row p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
  user-select: text;
}

.material-status {
  font-weight: 600;
}

.material-status.ready {
  color: var(--success-500);
}

.material-status.info {
  color: var(--info-500);
}

.material-status.warning {
  color: var(--warning-500);
}

.material-status.danger {
  color: var(--danger-500);
}

.export-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 8px;
}

.export-tile {
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}

.export-tile:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.software-doc-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
  gap: 12px;
  align-items: start;
  margin-bottom: 12px;
}

.software-doc-source .card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.software-doc-desc {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  user-select: text;
}

.package-readonly-field {
  min-height: 34px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-secondary);
  font-size: 12px;
}

.package-scan-status,
.package-scan-ready {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.package-scan-status {
  color: var(--text-secondary);
}

.package-scan-ready {
  color: var(--success-500);
}

.dir-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.software-doc-actions,
.software-doc-ai-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.software-doc-ai-row {
  padding-top: 2px;
}

.package-ai-progress {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: 11px;
}

.package-recent-dirs {
  margin-top: 0;
}

.software-doc-preview-card {
  margin-bottom: 12px;
}

.software-doc-preview-card .card-body {
  padding: 0;
}

.software-doc-empty {
  min-height: 170px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  text-align: center;
  padding: 24px;
}

.software-doc-empty svg {
  opacity: 0.35;
}

.software-doc-empty p {
  max-width: 560px;
  font-size: 13px;
  line-height: 1.5;
}

.software-doc-preview-scroll {
  max-height: 620px;
  overflow-y: auto;
  padding: 18px 22px;
}

.doc-h1 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 18px 0 8px;
  padding: 8px 10px;
  border-left: 4px solid var(--primary-500);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
}

.doc-h1:first-child {
  margin-top: 0;
}

.doc-h1:hover {
  background: var(--bg-tertiary);
}

.doc-h2 {
  margin: 14px 0 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.doc-section-content {
  padding: 6px 0 14px;
}

.chevron-expanded {
  transform: rotate(90deg);
  transition: transform 0.15s;
}

@media (max-width: 1180px) {
  .package-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .software-doc-layout {
    grid-template-columns: 1fr;
  }
}
</style>
