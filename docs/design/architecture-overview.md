# OmniTestAgent 总体架构设计

> 版本: v1.0.0 | 更新日期: 2026-05-23

---

## 1. 项目概述

**OmniTestAgent** 是一个基于 Electron + Vue 3 的桌面应用，核心能力是通过 LLM + 知识库 + Skills/MCP 框架驱动测试需求分析到测试报告输出的端到端自动化。

### 核心定位

- **桌面应用**: Electron 封装，支持 Windows 和 macOS
- **AI 驱动**: LLM 智能生成测试需求分析、测试设计、测试用例、测试脚本；ChatAgent 引擎驱动多轮工具调用，支持多 Provider（openai/anthropic/azure/local）
- **全流程覆盖**: 需求导入 → 测试需求分析 → 审核 → 测试设计 → 审核 → 用例设计 → 审核 → 脚本生成 → 脚本调试
- **知识增强**: 文档向量化 + 语义检索 (Dense+Sparse 混合检索)
- **Skills/MCP 框架**: 可插拔技能系统 + MCP 工具调用协议
- **多渠道通知**: QQ Bot + Welink Bot 消息推送
- **斜杠命令**: /analyze、/design、/cases、/script 快捷触发 Skill 工具
- **@文件引用**: 消息中 @filename 自动解析并注入文件内容
- **审批机制**: MANUAL_APPROVAL_TOOLS 集合，人工审批工具执行，超时 120s 自动拒绝

---

## 2. 技术栈总览

### 2.1 桌面端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 33+ | 桌面应用框架 |
| Vue 3 | 3.5.x | 渲染进程前端框架 |
| TypeScript | 5.8.x | 全栈类型安全 |
| Pinia | 3.x | 渲染进程状态管理 |
| Vue Router 4 | 4.x | 路由管理 |
| Vite | 6.x | 渲染进程开发服务器 + 构建 |
| electron-vite | - | Electron + Vite 集成构建 |
| Arco Design Vue | 2.x | UI 组件库 |
| Tailwind CSS 4 | 4.x | 原子化 CSS |
| ECharts | - | 数据可视化 |

### 2.2 主进程技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20+ | 主进程运行时 |
| better-sqlite3 | - | 本地 SQLite 数据库 |
| openai | - | LLM API 客户端 (OpenAI 兼容) |
| @qdrant/qdrant-client | - | 向量数据库客户端 |
| sharp | - | 文档处理辅助 |

### 2.3 基础设施

| 技术 | 用途 |
|------|------|
| SQLite (better-sqlite3) | 本地业务数据存储 |
| Qdrant / 本地向量存储 | 向量数据库 (支持远程/本地) |
| electron-store | 加密配置存储 |
| Node.js fs | 文件系统 (文档/知识库存储) |

---

## 3. 系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OmniTestAgent (Electron App)                      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                  Renderer Process (Chromium)                   │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                    Vue 3 Application                     │  │  │
│  │  │                                                         │  │  │
│  │  │  ┌───────────┐  ┌───────────┐  ┌─────────────────────┐ │  │  │
│  │  │  │  Router   │  │  Pinia    │  │   Composables       │ │  │  │
│  │  │  │  (4.x)    │  │  Stores   │  │   (useIpc, ...)     │ │  │  │
│  │  │  └───────────┘  └───────────┘  └─────────────────────┘ │  │  │
│  │  │                                                         │  │  │
│  │  │  ┌─────────────────────────────────────────────────────┐│  │  │
│  │  │  │               Feature Modules                       ││  │  │
│  │  │  │  project | testflow | chat | knowledge              ││  │  │
│  │  │  │  execution | llm-config | mcp-config               ││  │  │
│  │  │  │  skills | channels | dashboard                     ││  │  │
│  │  │  └─────────────────────────────────────────────────────┘│  │  │
│  │  │                                                         │  │  │
│  │  │  ┌─────────────────────────────────────────────────────┐│  │  │
│  │  │  │  Shared: Components | Layouts | Utils | Types       ││  │  │
│  │  │  └─────────────────────────────────────────────────────┘│  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              ↕ IPC (contextBridge)                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      Main Process (Node.js)                    │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │WindowManager│  │ IPC Handlers │  │  Service Layer      │  │  │
│  │  │- mainWindow │  │- llm:*      │  │  - LlmService       │  │  │
│  │  │- trayIcon   │  │- knowledge:*│  │  - KnowledgeService │  │  │
│  │  │- menuBar    │  │- mcp:*      │  │  - McpService       │  │  │
│  │  └─────────────┘  │- skill:*    │  │  - SkillEngine      │  │  │
│  │                    │- channel:*  │  │  - ChannelManager   │  │  │
│  │  ┌─────────────┐  │- project:* │  │  - TestFlowOrchestr │  │  │
│  │  │  Data Layer  │  │- testflow:*│  │  - ProjectService   │  │  │
│  │  │- SQLite DB  │  │- store:*   │  │  - EmbeddingManager │  │  │
│  │  │- SecureStore│  │- system:*  │  │  - HybridRetriever  │  │  │
│  │  │- FileStore  │  │- chatAgent:│  │  - ChatAgentService │  │  │
│  │  │             │  │  *         │  │  - AgentExecutor    │  │  │
│  │  │             │  │           │  │  - ToolRegistry     │  │  │
│  │  │             │  │           │  │  - PromptBuilder    │  │  │
│  │  │             │  └─────────────┘  └─────────────────────┘  │  │
│  │  └─────────────┘                                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  LLM Service  │ │  MCP Service  │ │  Vector DB   │ │  IM Channels │
│ (OpenAI API)  │ │ (MCP Server)  │ │ (Qdrant/     │ │ (QQ/Welink)  │
│  SSE/HTTP     │ │ HTTP/Stdio    │ │  Local)      │ │ HTTP/WS      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### 3.2 请求处理流程

```
用户操作 (Renderer)
  → Vue Component
  → Pinia Action
  → window.electronAPI.xxx (preload contextBridge)
  → ipcRenderer.invoke() / ipcRenderer.on()
  → Main Process IPC Handler
  → Service Layer (业务逻辑)
  → Data Layer / External Service
  → 返回结果 (IPC响应/事件)
  → Pinia State更新
  → Vue 响应式UI更新
```

### 3.3 流式通信流程 (SSE/Event)

```
用户发送对话消息 (Renderer)
  → ipcRenderer.invoke('llm:streamChat', params)
  → Main Process: LlmService.streamChat()
  → 构建 Prompt (项目上下文 + 知识库 RAG)
  → HTTP 请求 LLM 服务 (SSE)
  → LLM 流式返回 token
  → Main Process: 逐 chunk 通过 ipcRenderer.send('llm:streamChunk', chunk)
  → Renderer: ipcRenderer.on('llm:streamChunk', callback)
  → ChatMessageArea 追加渲染
  → 流式结束: ipcRenderer.send('llm:streamEnd')
  → 持久化完整对话到 SQLite
```

---

## 4. 项目目录结构

```
OmniTestAgent/
├── electron/                     # [主进程] Electron Main Process
│   ├── main.ts                   #   主进程入口
│   ├── preload.ts                #   Preload 脚本 (contextBridge)
│   ├── services/                 #   业务服务层
│   │   ├── LlmService.ts         #     LLM 对话和配置服务
│   │   ├── KnowledgeService.ts   #     知识库管理服务
│   │   ├── McpService.ts         #     MCP 工具调度服务
│   │   ├── SkillEngine.ts        #     Skills 执行引擎
│   │   ├── SkillRegistry.ts      #     Skills 注册表
│   │   ├── SkillLoader.ts        #     Skills 动态加载器
│   │   ├── ChannelManager.ts     #     渠道管理 (QQ/Welink)
│   │   ├── TestFlowOrchestrator.ts #  测试流程编排器
│   │   ├── ProjectService.ts     #     项目管理服务
│   │   ├── EmbeddingManager.ts   #     文档嵌入管理
│   │   └── HybridRetriever.ts   #     混合检索引擎
│   ├── ipc/                      #   IPC 处理器注册
│   │   ├── index.ts              #     IPC 注册入口
│   │   ├── llmHandler.ts         #     LLM 领域 IPC 处理
│   │   ├── knowledgeHandler.ts   #     知识库领域 IPC 处理
│   │   ├── mcpHandler.ts         #     MCP 领域 IPC 处理
│   │   ├── skillHandler.ts       #     Skills 领域 IPC 处理
│   │   ├── channelHandler.ts     #     渠道领域 IPC 处理
│   │   ├── projectHandler.ts     #     项目领域 IPC 处理
│   │   ├── testflowHandler.ts    #     测试流程 IPC 处理
│   │   └── storeHandler.ts       #     数据存储 IPC 处理
│   ├── data/                     #   数据层
│   │   ├── database.ts           #     SQLite 数据库初始化
│   │   ├── migrations/           #     数据库迁移脚本
│   │   │   ├── 001_initial.ts
│   │   │   └── ...
│   │   ├── repositories/         #     数据访问层
│   │   │   ├── ProjectRepo.ts
│   │   │   ├── TestCaseRepo.ts
│   │   │   ├── KnowledgeRepo.ts
│   │   │   ├── ChatRepo.ts
│   │   │   ├── FlowActivityRepo.ts
│   │   │   ├── LlmConfigRepo.ts
│   │   │   ├── McpConfigRepo.ts
│   │   │   ├── SkillRepo.ts
│   │   │   └── ChannelConfigRepo.ts
│   │   └── secureStore.ts        #     加密存储 (API Key等)
│   ├── vector/                   #   向量数据库层
│   │   ├── qdrantClient.ts       #     Qdrant 客户端封装
│   │   ├── localVectorStore.ts   #     本地向量存储降级
│   │   └── embeddingWorker.ts    #     嵌入计算 Worker
│   ├── skills/                   #   内置技能模块
│   │   ├── requirementParser/    #     需求解析技能
│   │   │   ├── index.ts
│   │   │   └── prompt.ts
│   │   ├── testDesigner/         #     测试设计技能
│   │   │   ├── index.ts
│   │   │   └── prompt.ts
│   │   ├── caseGenerator/        #     用例生成技能
│   │   │   ├── index.ts
│   │   │   └── prompt.ts
│   │   ├── scriptGenerator/      #     脚本生成技能
│   │   │   ├── index.ts
│   │   │   └── prompt.ts
│   │   └── skillInterface.ts     #     技能接口定义
│   ├── channels/                 #   渠道客户端
│   │   ├── qqBotClient.ts        #     QQ Bot 客户端
│   │   └── welinkBotClient.ts    #     Welink Bot 客户端
│   └── utils/                    #   主进程工具
│       ├── logger.ts             #     日志工具
│       ├── crypto.ts             #     加密/脱敏工具
│       ├── fileHelper.ts         #     文件操作辅助
│       └── documentParser.ts     #     文档解析 (PDF/Word/MD/TXT)
│
├── src/                          # [渲染进程] Vue 3 SPA
│   ├── main.ts                   #   应用入口
│   ├── App.vue                   #   根组件
│   ├── router/                   #   路由配置
│   │   └── index.ts              #     路由定义 + 守卫
│   ├── store/                    #   Pinia 状态管理
│   │   ├── useProjectStore.ts    #     项目状态
│   │   ├── useChatStore.ts       #     对话状态
│   │   ├── useTestFlowStore.ts   #     测试流程状态
│   │   ├── useKnowledgeStore.ts  #     知识库状态
│   │   ├── useLlmConfigStore.ts  #     LLM 配置状态
│   │   ├── useMcpConfigStore.ts  #     MCP 配置状态
│   │   ├── useSkillStore.ts      #     Skills 状态
│   │   ├── useChannelStore.ts    #     渠道配置状态
│   │   └── useAppStore.ts        #     全局应用状态
│   ├── features/                 #   功能模块 (按领域划分)
│   │   ├── project/              #     项目管理
│   │   │   ├── views/
│   │   │   ├── components/
│   │   │   ├── types/
│   │   │   └── composables/
│   │   ├── testflow/             #     测试设计流程
│   │   │   ├── views/
│   │   │   ├── components/
│   │   │   ├── types/
│   │   │   └── composables/
│   │   ├── chat/                 #     AI 对话
│   │   │   ├── views/
│   │   │   ├── components/
│   │   │   ├── types/
│   │   │   └── composables/
│   │   ├── knowledge/            #     知识库管理
│   │   │   ├── views/
│   │   │   ├── components/
│   │   │   ├── types/
│   │   │   └── composables/
│   │   ├── execution/            #     测试执行
│   │   │   ├── views/
│   │   │   ├── components/
│   │   │   ├── types/
│   │   │   └── composables/
│   │   ├── llm-config/           #     LLM 配置
│   │   │   ├── views/
│   │   │   ├── components/
│   │   │   └── types/
│   │   ├── mcp-config/           #     MCP 配置
│   │   │   ├── views/
│   │   │   ├── components/
│   │   │   └── types/
│   │   ├── skills/               #     Skills 管理
│   │   │   ├── views/
│   │   │   ├── components/
│   │   │   └── types/
│   │   ├── channels/             #     Channels 配置
│   │   │   ├── views/
│   │   │   ├── components/
│   │   │   └── types/
│   │   └── dashboard/            #     首页仪表盘
│   │       ├── views/
│   │       ├── components/
│   │       └── composables/
│   ├── components/               #   共享组件
│   │   ├── layout/               #     布局组件
│   │   │   ├── AppLayout.vue     #       主布局 (导航+侧边+内容)
│   │   │   ├── TopNavBar.vue     #       顶部导航栏
│   │   │   ├── SideMenu.vue      #       左侧菜单
│   │   │   └── ProjectSelector.vue #     项目选择器
│   │   ├── common/               #     通用组件
│   │   │   ├── StatusIcon.vue    #       状态图标
│   │   │   ├── ConfirmDialog.vue #       确认弹窗
│   │   │   ├── LoadingOverlay.vue #      加载遮罩
│   │   │   └── EmptyState.vue    #       空状态
│   │   └── markdown/             #     Markdown 渲染
│   │       └── MarkdownRenderer.vue
│   ├── composables/              #   全局 Composables
│   │   ├── useIpc.ts             #     IPC 调用封装
│   │   ├── useNotification.ts    #     通知提示
│   │   └── useLoading.ts         #     加载状态
│   ├── utils/                    #   工具函数
│   │   ├── formatter.ts          #     格式化工具
│   │   ├── validator.ts          #     校验工具
│   │   └── constants.ts          #     常量定义
│   └── types/                    #   全局类型定义
│       ├── project.ts
│       ├── chat.ts
│       ├── testflow.ts
│       ├── knowledge.ts
│       ├── llm.ts
│       ├── mcp.ts
│       ├── skill.ts
│       └── channel.ts
│
├── resources/                    # [资源] 应用静态资源
│   ├── icon.png                  #   应用图标
│   └── tray-icon.png             #   托盘图标
│
├── docs/                         # [文档]
│   └── design/                   #   设计文档目录
│
├── electron.vite.config.ts       # electron-vite 构建配置
├── package.json                  # 项目依赖
├── tsconfig.json                 # TypeScript 配置
└── tailwind.config.ts            # Tailwind CSS 配置
```

---

## 5. 核心设计原则

### 5.1 Electron 双进程隔离

- **Main Process**: 负责系统级操作、服务调用、数据存储、外部通信
- **Renderer Process**: 仅负责 UI 渲染和用户交互，通过 contextBridge 安全访问主进程能力
- **Preload**: 最小化暴露 API 面积，按领域通道划分

### 5.2 项目级数据隔离

`Project` 是数据隔离核心。所有业务数据（TestFlowActivity、TestCase、KnowledgeBase、ChatSession等）通过 `project_id` 外键关联，确保项目间数据隔离。

### 5.3 Feature-Based 模块化 (前端)

前端按功能域组织代码，每个 feature 模块内含完整的 views/components/types/composables 层次，实现高内聚低耦合。

### 5.4 本地优先数据架构

- 业务数据: SQLite (better-sqlite3)，零配置、高性能
- 敏感数据: electron-store 加密存储 (API Key等)
- 文件数据: 本地文件系统 (知识库文档等)
- 向量数据: Qdrant (远程优先) / 本地向量存储 (降级)

### 5.5 IPC 领域通道模式

IPC 通信按业务领域划分通道，每个领域有独立的 Handler，避免全局通信混乱：

```
llm:*       → LlmHandler    → LlmService
knowledge:* → KnowledgeHandler → KnowledgeService
mcp:*       → McpHandler    → McpService
skill:*     → SkillHandler  → SkillEngine
...
```

### 5.6 单例配置模式

多个全局配置采用单例模式，保证系统中只有一个激活实例：
- `LlmConfig`: 全局唯一激活的 LLM 配置
- `McpConfig`: 全局唯一激活的 MCP 配置

---

## 6. 关键数据流

### 6.1 AI 对话流

```
用户输入 → ChatInput.vue
  → useChatStore.sendMessage()
  → window.electronAPI.llm.streamChat({sessionId, message, projectId})
  → Main: LlmHandler → LlmService.streamChat()
    → 获取 LlmConfig (单例激活)
    → 注入项目上下文 (ProjectService.getProjectContext)
    → 可选: 知识库 RAG 检索 (HybridRetriever.search)
    → 构建 Prompt (系统提示词 + 上下文 + RAG结果 + 用户消息)
    → HTTP SSE 请求 LLM 服务
    → 逐 chunk: BrowserWindow.webContents.send('llm:streamChunk', chunk)
  → Renderer: ipcRenderer.on('llm:streamChunk', appendMessage)
  → ChatMessageArea 实时追加渲染
  → 流结束: ChatRepo.saveMessage() 持久化
```

### 6.2 测试流程执行流

```
用户触发活动 → FlowActivityCard.vue
  → useTestFlowStore.executeActivity(type)
  → window.electronAPI.testflow.execute({projectId, activityType})
  → Main: TestFlowHandler → TestFlowOrchestrator.execute()
    → 校验流程顺序 (前序活动必须完成且审核通过)
    → 更新活动状态为 running
    → 根据活动类型选择 Skill
    → SkillEngine.execute(skill, context)
      → Skill 构建 Prompt → LlmService.streamChat()
      → 可选: McpService.callTool() (如脚本调试)
    → 实时回传进度: BrowserWindow.webContents.send('testflow:progress', progress)
    → 活动完成 → 保存产出 → 状态变更为 completed
    → 若为审核环节 → 等待人工审核
  → Renderer: ipcRenderer.on('testflow:progress', updateUI)
  → 审核操作 → TestFlowOrchestrator.review() → 解锁下一活动
```

### 6.3 知识库 RAG 流

```
文档上传 → DocumentUploader.vue
  → window.electronAPI.knowledge.uploadDoc({kbId, file})
  → Main: KnowledgeHandler → KnowledgeService.uploadDocument()
    → 文件保存到本地 FileStore
    → 记录 Document 元数据到 SQLite
    → 触发向量化: EmbeddingManager.vectorize()
      → 文档解析 (PDF/Word/MD/TXT)
      → 文本分块 (RecursiveCharacterTextSplitter)
      → 嵌入生成 (API调用 / 本地模型)
      → 存入 Qdrant / 本地向量存储
      → 更新 Document 状态为 completed

RAG 查询 → SemanticSearchBar.vue
  → window.electronAPI.knowledge.search({kbId, query, topK})
  → Main: KnowledgeHandler → HybridRetriever.search()
    → Dense 向量相似度检索
    + Sparse BM25 稀疏检索
    → RRF (Reciprocal Rank Fusion) 融合排序
    → 可选: Reranker 精排
    → 返回 Top-K 结果
  → Renderer: SearchResultList.vue 展示结果
```

### 6.4 MCP 工具调用流

```
测试执行 → ExecutionPanel.vue
  → window.electronAPI.mcp.callTool({toolName, params})
  → Main: McpHandler → McpService.callTool()
    → 获取 McpConfig (激活配置)
    → 连接 MCP 服务
    → 调用指定工具
    → 返回 ToolResult
  → Renderer: 更新用例执行状态和日志
```

---

## 7. 模块依赖关系

```
Main Process:
  AppCore (Window + IPC注册)
    ├── ProjectService (项目管理, 核心依赖)
    │     ├── TestFlowOrchestrator (流程编排)
    │     │     ├── SkillEngine (技能执行)
    │     │     │     ├── LlmService (LLM调用)
    │     │     │     ├── McpService (MCP调用)
    │     │     │     └── HybridRetriever (知识检索)
    │     │     │           └── EmbeddingManager (嵌入管理)
    │     │     └── FlowActivityRepo (流程数据)
    │     └── ChatRepo (对话数据)
    ├── LlmService (LLM核心)
    ├── KnowledgeService (知识库核心)
    │     ├── EmbeddingManager
    │     └── HybridRetriever
    ├── McpService (MCP核心)
    ├── ChannelManager (渠道核心)
    └── SecureStore (加密存储)

Renderer Process:
  App (Vue 3)
    ├── Router (路由守卫: 项目上下文注入)
    ├── Pinia Stores
    │     ├── useProjectStore (核心: 项目上下文)
    │     ├── useChatStore (依赖: useProjectStore)
    │     ├── useTestFlowStore (依赖: useProjectStore)
    │     ├── useKnowledgeStore (依赖: useProjectStore)
    │     ├── useLlmConfigStore
    │     ├── useMcpConfigStore
    │     ├── useSkillStore
    │     └── useChannelStore
    └── Feature Modules (各自独立)
```
