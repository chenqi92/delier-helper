# 交付助手 (Deliver Helper)

> 一站式软件项目交付文档生成工具 — 软著代码、接口文档、数据库文档、需求文档、设计文档，一键搞定

基于 **Tauri 2 + Vue 3** 构建的跨平台桌面应用，支持 **Windows / macOS**。集成 AI 大模型辅助能力，让文档生成更智能、更高效。

---

## ✨ 功能全景

### 📄 软著代码生成

生成符合软件著作权申请规范的 Word 源代码文档。

- **多目录扫描** — 支持添加多个源代码目录，按比例分配代码行数
- **智能文件检测** — 自动检测目录中的文件类型分布，一键筛选代码文件
- **代码清洗** — 移除注释、空行、行尾空白、import 语句、版权声明
- **精确分页** — 使用 PageBreak 精确控制每页代码行数，支持自定义字体和字号
- **Word 预览** — 实时分页预览，模拟 Word 文档效果（页眉、页脚、页码）
- **前后截取** — 超过最大页数时，自动截取前 N 页 + 后 N 页
- **忽略规则** — 支持 .gitignore 和自定义忽略模式
- **智能排序** — 文件按语言类型和目录结构智能排序

### 🔌 接口文档生成

自动解析项目源码，生成规范的 API 接口文档（Word 格式）。

- **多语言解析** — 支持 Spring Boot (Java)、Go、Python、Rust 四种语言/框架
- **智能识别** — 自动提取路由、请求方法、参数、返回值等 API 元信息
- **Java 类型解析** — 深度解析 Spring Boot 注解、DTO 字段、泛型类型
- **文档渲染** — 生成包含完整目录、接口详情的专业 Word 文档

### 🗄️ 数据库文档生成

连接数据库，自动生成数据库设计文档（Word 格式）。

- **双数据库支持** — 支持 MySQL 和 PostgreSQL
- **在线连接** — 直接连接数据库读取 Schema，支持连接测试
- **完整提取** — 表结构、字段信息、主键/外键、索引、字段注释一应俱全
- **多数据库选择** — 连接后可切换不同数据库生成文档
- **AI 增强** — 可通过 AI 补充字段说明和表描述

### 📋 需求规格说明书 (SRS)

基于模板和 AI 辅助，生成符合国标的软件需求规格说明书。

- **模板系统** — 内置多套行业模板预设，支持自定义模板
- **章节编辑** — 可视化章节编辑器，支持增删改排序
- **AI 填充** — 基于项目信息，AI 自动填充各章节内容
- **参考文件** — 支持上传参考文件（Word / PDF / Excel），辅助 AI 更精准生成
- **Word 导入** — 从已有 Word 文档导入模板结构
- **多格式导出** — 导出为标准 Word 文档

### 📐 系统设计说明书 (SDD)

基于模板和 AI 辅助，生成软件系统设计说明书。

- 与 SRS 共享同一套模板与编辑体系
- 内置系统设计文档专用模板
- AI 辅助生成架构设计、模块设计、接口设计等内容

### 🤖 AI 大模型集成

内置丰富的 LLM 大模型提供商支持，用于辅助文档生成。

- **云端厂商** — OpenAI、DeepSeek、通义千问 (Qwen)、智谱 (GLM)、月之暗面 (Kimi)、百川、豆包 (字节)、讯飞星火、Anthropic (Claude)、Google (Gemini)、OpenRouter
- **本地部署** — 支持 Ollama、LM Studio、vLLM 等本地模型
- **自定义接入** — 支持任意 OpenAI 兼容 API 接入
- **多配置管理** — 每个厂商独立配置 API Key、Base URL、模型选择
- **AI 侧边栏** — 全局 AI 对话侧边栏，随时提问辅助
- **Markdown 渲染** — AI 回复自动渲染 Markdown 和 Mermaid 图表

---

## 🖥️ 通用特性

- **深色 / 浅色主题** — 支持一键切换
- **新手引导** — 内置操作引导，帮助快速上手
- **配置持久化** — AI 配置、模板配置本地持久化存储
- **Rust 后端** — 文件 I/O、数据库连接、LLM API 请求均通过 Rust 后端处理，高性能且安全

---

## 📸 截图

![软著截图](https://nas.allbs.cn:8888/cloudpic/2026/03/459ec3f808031e79a4ad477096079f6a.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/3fa396c4f7c789b37e5138f83d155cf0.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/012586f94fc223024694f8f416479f67.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/260cd6c952c34abae81685732e694a5f.png)

![](https://nas.allbs.cn:8888/cloudpic/2026/03/3a089694f95271e5f1b9dcdaa0995f73.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/b732f1d5e60e47b8fff50f855929005a.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/8db22101854f8367f5bdcb3adfb414c0.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/96c915da1cc9ce9c2e8a19c543a10901.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/b732f1d5e60e47b8fff50f855929005a.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/48d41411dfd8299781453ece5b55c1e4.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/2d27ac1b2bc6b41da79e03d3b5e333f7.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/eeb21590ead37816c6413ce91401fc4f.png)
![](https://nas.allbs.cn:8888/cloudpic/2026/03/1f592d61bf5cf8786d7c135e677c9056.png)

---

## 🚀 快速开始

### 环境要求

| 依赖 | 版本要求 |
|------|---------|
| [Node.js](https://nodejs.org/) | >= 18 |
| [Rust](https://www.rust-lang.org/tools/install) | >= 1.70 |
| [Tauri 2 CLI](https://v2.tauri.app/start/prerequisites/) | 最新版 |
| [pnpm](https://pnpm.io/) | >= 8 (推荐) |

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm tauri:dev
```

> 自动检测可用端口（从 51420 开始），避免端口冲突。

### 构建发布

```bash
pnpm tauri:build
```

---

## 📦 项目结构

```
deliver-helper/
├── src/                          # 前端源码 (Vue 3)
│   ├── App.vue                   # 根组件，包含导航和布局
│   ├── views/                    # 页面视图
│   │   ├── CopyrightGenerator.vue    # 软著代码生成
│   │   ├── ApiDocGenerator.vue       # 接口文档生成
│   │   ├── DbDocGenerator.vue        # 数据库文档生成
│   │   ├── SrsGenerator.vue          # 需求规格说明书
│   │   ├── SddGenerator.vue          # 系统设计说明书
│   │   └── AiSettings.vue            # AI 模型配置
│   ├── components/               # 共享组件
│   │   ├── AiSidebar.vue             # AI 对话侧边栏
│   │   ├── GuideTour.vue             # 新手引导
│   │   ├── ReferenceFiles.vue        # 参考文件上传
│   │   ├── SectionEditor.vue         # 章节编辑器
│   │   └── TemplateSelector.vue      # 模板选择器
│   ├── core/                     # 核心逻辑
│   │   ├── docx-generator.js         # Word 文档生成 (docx 库)
│   │   ├── ratio-allocator.js        # 代码行分配算法
│   │   ├── code-cleaner.js           # 代码清洗
│   │   ├── comment-remover.js        # 注释移除（多语言）
│   │   ├── file-sorter.js            # 文件智能排序
│   │   ├── llm/
│   │   │   └── llm-service.js        # LLM 服务封装（多厂商）
│   │   ├── api-doc/                  # API 文档解析
│   │   │   ├── spring-boot-parser.js # Spring Boot 解析器
│   │   │   ├── go-parser.js          # Go 解析器
│   │   │   ├── python-parser.js      # Python 解析器
│   │   │   ├── rust-parser.js        # Rust 解析器
│   │   │   ├── java-type-resolver.js # Java 类型解析
│   │   │   ├── parser-registry.js    # 解析器注册中心
│   │   │   └── api-doc-renderer.js   # API 文档渲染
│   │   ├── db-doc/
│   │   │   └── db-doc-renderer.js    # 数据库文档渲染
│   │   └── doc-template/             # 文档模板系统
│   │       ├── template-presets.js       # 内置模板预设
│   │       ├── template-store.js         # 模板持久化
│   │       ├── template-from-doc.js      # 从 Word 导入模板
│   │       ├── doc-docx-renderer.js      # 通用文档渲染
│   │       ├── doc-llm-service.js        # 文档 AI 填充服务
│   │       ├── codebase-scanner.js       # 代码库扫描
│   │       ├── file-parser.js            # 文件解析
│   │       ├── srs-template.js           # SRS 模板定义
│   │       └── sdd-template.js           # SDD 模板定义
│   └── styles/
│       └── index.css              # 全局样式（深色/浅色主题）
├── src-tauri/                     # Rust 后端
│   ├── src/
│   │   ├── main.rs                # 应用入口
│   │   ├── lib.rs                 # Tauri 插件注册
│   │   ├── commands.rs            # Tauri 命令（文件扫描、LLM 请求）
│   │   ├── scanner.rs             # 文件扫描引擎（递归、忽略规则、编码处理）
│   │   └── db_connector.rs        # 数据库连接器（MySQL / PostgreSQL）
│   ├── tauri.conf.json            # Tauri 应用配置
│   └── Cargo.toml                 # Rust 依赖管理
├── scripts/                       # 工具脚本
│   ├── tauri-dev.mjs              # 自动端口检测启动脚本
│   ├── generate-icons.mjs         # 应用图标生成
│   └── bump-version.mjs           # 版本号管理（patch/minor/major）
└── .github/workflows/
    └── version-release.yml        # CI/CD：多平台构建与发布
```

---

## 🔧 配置说明

### 软著代码生成配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 字体 | 微软雅黑 | 支持中文字体、英文字体、等宽字体 |
| 字号 | 五号 (10.5pt) | 支持初号到八号及常用磅值 |
| 每页行数 | 50 | 通过 PageBreak 精确控制 |
| 最大页数 | 80 | 超出时自动前后截取 |
| 页面边距 | 上下 25.4mm / 左右 31.8mm | A4 标准边距 |

### 数据库连接配置

| 配置项 | 说明 |
|--------|------|
| 数据库类型 | MySQL / PostgreSQL |
| 主机地址 | 数据库服务器地址 |
| 端口 | MySQL 默认 3306，PostgreSQL 默认 5432 |
| 用户名 / 密码 | 数据库认证信息 |
| 数据库名 | 目标数据库名称 |

### AI 模型配置

在 **AI 设置** 页面中管理，每个厂商独立配置：

- API Key
- Base URL（可自定义代理地址）
- 模型选择

---

## 📋 发布流程

### 自动发布（推荐）

使用版本管理脚本快速发布：

```bash
# 补丁版本 (0.1.4 → 0.1.5)
pnpm release:patch

# 次要版本 (0.1.4 → 0.2.0)
pnpm release:minor

# 主要版本 (0.1.4 → 1.0.0)
pnpm release:major
```

脚本会自动：

1. 更新 `package.json`、`tauri.conf.json`、`Cargo.toml` 中的版本号
2. 提交变更并推送
3. 创建 `v{version}` tag 并推送

推送 tag 后，GitHub Actions 会自动：

1. 创建 GitHub Release（草稿）
2. 多平台并行构建 (Windows x86_64 / macOS ARM64 / macOS x86_64)
3. macOS 自动签名与公证 (Developer ID)
4. 上传安装包并发布 Release

### 构建产物

| 平台 | 架构 | 安装包格式 |
|------|------|-----------|
| Windows | x86_64 | `.exe` (NSIS 安装包) |
| macOS | Apple Silicon (ARM64) | `.dmg` |
| macOS | Intel (x86_64) | `.dmg` |

---

## 🛠️ 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 桌面框架 | Tauri 2 | 跨平台桌面应用框架 |
| 前端框架 | Vue 3 | 用户界面 |
| 图标库 | Lucide Vue | UI 图标 |
| 文档生成 | docx | Word 文档生成 |
| 文档解析 | mammoth / pdfjs-dist | Word / PDF 文件解析 |
| 电子表格 | xlsx (SheetJS) | Excel 文件读取 |
| 压缩 | JSZip | 文件打包 |
| Markdown | marked / mermaid | AI 回复渲染 |
| 后端语言 | Rust | 高性能后端逻辑 |
| 数据库驱动 | sqlx (MySQL / PostgreSQL) | 数据库连接与查询 |
| HTTP 客户端 | reqwest | LLM API 请求 |
| 持久化 | tauri-plugin-store | 本地配置存储 |

---

## 📄 License

MIT
