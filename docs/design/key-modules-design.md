# OmniTestAgent 关键模块设计详解

> 更新日期: 2026-05-23

---

## 1. LLM 集成架构 (LlmService)

### 1.1 模块概述

LLM 集成是 AI 对话和测试流程活动的核心驱动，负责构建 Prompt、调用 LLM 服务、管理流式响应和 Token 统计。

### 1.2 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                      LlmService (Main Process)                   │
│                                                                 │
│  ┌─────────────────┐    ┌───────────────────────────────────┐  │
│  │  PromptBuilder   │    │       LlmClient (OpenAI Compatible) │  │
│  │  - system prompt │    │  - chat(params) → ChatResponse    │  │
│  │  - context inject│    │  - streamChat(params) → SSE      │  │
│  │  - RAG inject    │    │  - testConnection() → TestResult │  │
│  │  - history inject│    └───────────────────────────────────┘  │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────┐    ┌───────────────────────────────────┐  │
│  │  ContextManager  │    │      TokenCounter                 │  │
│  │  - project info  │    │  - inputTokens: number            │  │
│  │  - knowledge RAG │    │  - outputTokens: number           │  │
│  │  - flow state    │    │  - totalTokens: number            │  │
│  └─────────────────┘    └───────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  ConfigManager   │                                            │
│  │  - getActive()   │                                            │
│  │  - testConn()    │                                            │
│  │  - save()        │                                            │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│          External LLM Service            │
│  (OpenAI / Qwen / DeepSeek / Custom)    │
│  API: POST /v1/chat/completions (SSE)   │
└─────────────────────────────────────────┘
```

### 1.3 核心接口

```typescript
class LlmService {
  // 同步对话
  async chat(params: ChatParams): Promise<ChatResponse>

  // 流式对话 (SSE)
  async streamChat(params: ChatParams, onChunk: (chunk: StreamChunk) => void): Promise<void>

  // 连接测试
  async testConnection(config: LlmConfig): Promise<TestResult>

  // 获取激活配置
  async getActiveConfig(): Promise<LlmConfig | null>

  // 保存配置 (含连接测试前置校验)
  async saveConfig(config: LlmConfig): Promise<void>
}

interface ChatParams {
  sessionId: string
  messages: ChatMessage[]
  projectId?: string          // 项目上下文
  knowledgeBaseId?: string    // RAG 检索目标
  systemPrompt?: string       // 自定义系统提示词
  temperature?: number
  maxTokens?: number
}

interface StreamChunk {
  type: 'token' | 'tool_call' | 'tool_result' | 'error' | 'end'
  content: string
  metadata?: Record<string, unknown>
}
```

### 1.4 Prompt 构建策略

```
最终 Prompt = SystemPrompt + 知识库RAG结果 + 项目上下文 + 对话历史 + 用户当前消息

SystemPrompt 构成:
  ├── 角色定义 (测试工程师助手)
  ├── 能力说明 (可执行的测试活动)
  └── 输出格式要求 (结构化输出)

项目上下文注入:
  ├── 项目名称和描述
  ├── 当前测试流程状态
  └── 已完成的流程活动产出摘要

知识库 RAG 注入:
  ├── 语义检索 Top-K 结果
  └── 格式化为 [知识片段] 标记块
```

### 1.5 流式响应处理

```
LlmService.streamChat()
  → fetch SSE endpoint
  → for each chunk:
      → parse SSE data
      → onChunk({type: 'token', content: chunk.delta})
      → BrowserWindow.webContents.send('llm:streamChunk', chunk)
  → on stream end:
      → onChunk({type: 'end'})
      → BrowserWindow.webContents.send('llm:streamEnd')
      → ChatRepo.saveMessage() 持久化完整响应
      → TokenCounter 记录用量
```

---

## 2. 知识库架构 (KnowledgeService + EmbeddingManager + HybridRetriever)

### 2.1 模块概述

知识库系统实现文档管理、自动分块、向量嵌入、混合检索 (Dense+Sparse) 和 RAG 查询，为 AI 对话和测试流程提供知识增强。

### 2.2 架构设计

```
┌──────────────────────────────────────────────────────────────────┐
│                     知识库系统架构                                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                KnowledgeService (业务编排)                  │  │
│  │  - createKnowledgeBase()                                   │  │
│  │  - uploadDocument() → 触发向量化                            │  │
│  │  - deleteDocument() → 清理向量                              │  │
│  │  - search() → HybridRetriever.search()                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────┼───────────────────────────────┐ │
│  │              Document Processing Pipeline                   │ │
│  │                                                            │ │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │ │
│  │  │ DocParser    │ → │ TextSplitter │ → │ EmbeddingMgr │  │ │
│  │  │ - PDF        │   │ - Recursive  │   │ - OpenAI API │  │ │
│  │  │ - Word       │   │ - chunk_size │   │ - Local      │  │ │
│  │  │ - Markdown   │   │ - overlap    │   │ - Xinference │  │ │
│  │  │ - TXT        │   └──────────────┘   └──────────────┘  │ │
│  │  └──────────────┘                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                               │                                  │
│  ┌────────────────────────────┼───────────────────────────────┐ │
│  │                HybridRetriever (混合检索)                   │ │
│  │                                                            │ │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │ │
│  │  │ Dense检索    │   │ Sparse检索   │   │ RRF融合排序  │  │ │
│  │  │ (向量相似度) │   │ (BM25)       │   │ + Reranker   │  │ │
│  │  └──────────────┘   └──────────────┘   └──────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                               │                                  │
│  ┌────────────────────────────┼───────────────────────────────┐ │
│  │                  Vector Store Layer                         │ │
│  │  ┌──────────────┐   ┌──────────────────────────────────┐ │ │
│  │  │ Qdrant Client│   │ Local Vector Store (降级方案)    │ │ │
│  │  │ (远程优先)   │   │ (SQLite + 简单向量索引)         │ │ │
│  │  └──────────────┘   └──────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 文档向量化流程

```
上传文档 → KnowledgeService.uploadDocument()
  1. 校验文件类型 (禁止 .exe/.bat/.sh 等可执行文件)
  2. 校验文件大小 (≤ 50MB)
  3. 保存文件到 FileStore ({userData}/knowledge/{kbId}/{docId})
  4. 创建 Document 记录 (status: pending)
  5. 触发异步向量化:

向量化 → EmbeddingManager.vectorize(docId)
  1. 更新 Document.status = processing
  2. 文档解析 → DocParser.parse(filePath, type)
     - PDF: pdf-parse / pypdf
     - Word: mammoth
     - Markdown: markdown-it
     - TXT: 直接读取
  3. 文本分块 → TextSplitter.split(text, {chunkSize, overlap})
     - RecursiveCharacterTextSplitter
     - chunkSize: 默认 1000 字符
     - overlap: 默认 200 字符
  4. 嵌入生成 → EmbeddingManager.generateEmbeddings(chunks)
     - 优先: API 调用 (OpenAI/Xinference)
     - 降级: 本地嵌入模型 (onnxruntime)
  5. 存入向量数据库 → VectorStore.upsert(collection, vectors)
     - 优先: Qdrant (远程)
     - 降级: LocalVectorStore (本地)
  6. 创建 DocumentChunk 记录
  7. 更新 Document.status = completed
```

### 2.4 混合检索流程

```
查询 → HybridRetriever.search(query, {kbId, topK: 5})
  1. Dense 检索 (向量相似度):
     - 查询嵌入 → EmbeddingManager.embed(query)
     - Qdrant.search(collection, vector, {limit: topK * 2})

  2. Sparse 检索 (BM25):
     - 关键词提取
     - BM25 打分排序

  3. RRF 融合排序:
     - score = Σ 1/(k + rank_i)  (k=60)
     - 合并 Dense 和 Sparse 排序结果

  4. 可选 Reranker 精排:
     - 将 Top-K 候选送入 Reranker API
     - 按精排分数重新排序

  5. 返回 Top-K 结果:
     - {content, score, source, pageNumber}
```

### 2.5 嵌入服务配置

| 服务类型 | 配置项 | 说明 |
|---------|--------|------|
| openai | api_base_url, api_key, model_name | OpenAI 兼容 API |
| xinference | api_base_url, model_name | Xinference 本地服务 |
| local | model_path | 本地 ONNX 模型 (降级) |

---

## 3. Skills/MCP 框架设计

### 3.1 Skills 执行引擎

#### 架构设计

```
┌──────────────────────────────────────────────────────────────────┐
│                     SkillEngine (Skills 执行引擎)                 │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  SkillRegistry   │    │         SkillLoader                 │ │
│  │  - register()    │    │  - loadBuiltinSkills()              │ │
│  │  - unregister()  │    │  - loadImportedSkill(path)          │ │
│  │  - get(name)     │    │  - validateSkillFormat()            │ │
│  │  - list()        │    │  - resolveDependencies()             │ │
│  │  - toggle()      │    └─────────────────────────────────────┘ │
│  └─────────────────┘                                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    SkillExecutor                              │ │
│  │  - execute(skillId, context) → SkillResult                   │ │
│  │  - 构建执行上下文                                            │ │
│  │  - 调用 LLM (通过 LlmService)                               │ │
│  │  - 调用 MCP 工具 (通过 McpService)                           │ │
│  │  - 管理执行进度                                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    SkillContext                               │ │
│  │  - project: Project          // 当前项目                     │ │
│  │  - knowledgeBase: KnowledgeBase  // 知识库                   │ │
│  │  - llmService: LlmService    // LLM 服务                    │ │
│  │  - mcpService: McpService    // MCP 服务                    │ │
│  │  - flowState: FlowState      // 流程状态                    │ │
│  │  - previousOutput: any       // 前序活动产出                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

#### Skill 接口定义

```typescript
interface ISkill {
  // 技能元信息
  id: string
  name: string
  description: string
  isCore: boolean                // 是否核心 Skill
  version: string

  // 配置 Schema
  configSchema?: JsonSchema

  // 依赖的其他服务
  requiresLLM: boolean
  requiresMCP: boolean
  requiresKnowledge: boolean

  // 执行方法
  execute(context: SkillContext, config?: SkillConfig): Promise<SkillResult>
}

interface SkillResult {
  success: boolean
  output: any                   // 活动产出
  error?: string
  tokenUsage?: TokenUsage
  duration?: number             // 执行耗时(ms)
}
```

#### 内置技能清单

| Skill | 对应流程活动 | 依赖 LLM | 依赖 MCP | 依赖知识库 | 说明 |
|-------|------------|---------|---------|----------|------|
| RequirementParser | 测试需求分析 | ✅ | ❌ | ✅ | 解析需求文档，提取测试点 |
| TestDesigner | 测试设计 | ✅ | ❌ | ✅ | 生成测试设计方案 |
| TestCaseGenerator | 测试用例设计 | ✅ | ❌ | ✅ | 生成测试用例集 |
| ScriptGenerator | 测试脚本生成 | ✅ | ❌ | ❌ | 生成可执行测试脚本 |
| ScriptDebugger | 测试脚本调试 | ✅ | ✅ | ❌ | 通过 MCP 调试脚本 |

### 3.2 MCP 客户端架构

```
┌──────────────────────────────────────────────────────────────────┐
│                      McpService (MCP 客户端)                      │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  McpConnection   │    │       McpToolRegistry               │ │
│  │  - connect()     │    │  - discoverTools()                  │ │
│  │  - disconnect()  │    │  - listTools() → McpTool[]          │ │
│  │  - testConn()    │    │  - getTool(name) → McpTool          │ │
│  │  - isConnected() │    │  - callTool(name, params) → Result  │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    通信协议适配                              │ │
│  │  - HTTP/SSE Transport (远程 MCP 服务)                       │ │
│  │  - Stdio Transport (本地 MCP 进程)                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│          MCP Server (外部)               │
│  - 测试执行调度                          │
│  - 测试报告生成                          │
│  - 环境管理                              │
└─────────────────────────────────────────┘
```

#### MCP 工具调用流程

```
1. 配置 MCP 服务连接 → McpService.saveConfig(config)
2. 连接测试 → McpService.testConnection(config)
   → HTTP GET {mcpUrl}/health 或 Stdio ping
3. 发现工具 → McpService.discoverTools()
   → HTTP GET {mcpUrl}/tools 或 Stdio list_tools
   → 返回 McpTool[] (name, description, inputSchema)
4. 调用工具 → McpService.callTool(toolName, params)
   → HTTP POST {mcpUrl}/tools/{toolName}/call
   → 或 Stdio call_tool
   → 返回 ToolResult
5. 实时回传 → Main Process 通过 IPC 事件推送结果到 Renderer
```

---

## 4. 测试流程编排器 (TestFlowOrchestrator)

### 4.1 模块概述

编排器管理测试全流程的状态转换、活动调度、审核门禁和断点恢复。

### 4.2 流程状态机

```
需求导入 ──→ 测试需求分析 ──→ [审核] ──→ 测试设计 ──→ [审核]
  idle         idle           pending     idle         pending
  │            │              │          │            │
  running ──→ running ──→  reviewing ──→ running ──→ reviewing
  │            │              │          │            │
  completed ──→ completed     │          completed     │
                              │                        │
               ┌──────────────┤          ┌─────────────┤
               │ approved     │          │ approved    │
               │ rejected     │          │ rejected    │
               └──────────────┘          └─────────────┘

→ 测试用例设计 ──→ [审核] ──→ 测试脚本生成 ──→ 测试脚本调试
     idle           pending        idle               idle
     │              │              │                  │
     running ──→  reviewing ──→  running ──→       running
     │              │              │                  │
     completed      │              completed          completed
                    │
     ┌──────────────┤
     │ approved     │
     │ rejected     │
     └──────────────┘
```

### 4.3 编排器核心逻辑

```typescript
class TestFlowOrchestrator {
  // 执行流程活动
  async execute(projectId: string, activityType: ActivityType): Promise<void> {
    // 1. 获取流程状态
    const flowStatus = await this.getFlowStatus(projectId)

    // 2. 校验流程顺序
    if (!this.canExecute(flowStatus, activityType)) {
      throw new FlowOrderError('前序活动尚未完成或审核未通过')
    }

    // 3. 更新活动状态为 running
    await this.updateActivityStatus(projectId, activityType, 'running')
    this.notifyProgress(projectId, { activityType, status: 'running' })

    // 4. 选择并执行 Skill
    const skill = this.skillRegistry.get(this.getSkillForActivity(activityType))
    const context = await this.buildSkillContext(projectId, activityType)
    const result = await this.skillEngine.execute(skill, context)

    // 5. 处理执行结果
    if (result.success) {
      await this.saveActivityOutput(projectId, activityType, result.output)
      await this.updateActivityStatus(projectId, activityType, 'completed')
    } else {
      await this.updateActivityStatus(projectId, activityType, 'failed', result.error)
    }

    // 6. 通知 Renderer
    this.notifyProgress(projectId, { activityType, status: result.success ? 'completed' : 'failed' })
  }

  // 提交审核
  async review(projectId: string, activityType: ActivityType, result: ReviewResult): Promise<void> {
    // 1. 校验当前活动是否处于审核等待状态
    // 2. 更新审核状态
    // 3. 若通过 → 解锁下一活动
    // 4. 若驳回 → 保持当前环节
  }

  // 打断执行
  async interrupt(projectId: string, activityType: ActivityType): Promise<void> {
    // 1. 中止当前 Skill 执行 (AbortController)
    // 2. 保存已有中间结果
    // 3. 状态回退为 idle
  }
}
```

### 4.4 断点恢复机制

```
应用重启 → TestFlowOrchestrator.recover()
  1. 查询所有项目的 FlowActivity 记录
  2. 识别 running 状态的活动 (异常中断)
  3. 将 running 状态回退为 idle (保留已保存的中间结果)
  4. 通知 Renderer 刷新流程状态
```

---

## 5. 渠道管理 (ChannelManager)

### 5.1 架构设计

```
┌──────────────────────────────────────────────────────────────────┐
│                    ChannelManager (渠道管理)                       │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  MessageRouter   │    │       ChannelClients                │ │
│  │  - route()       │    │  ┌──────────┐ ┌──────────────────┐│ │
│  │  - broadcast()   │    │  │QqBotClient│ │WelinkBotClient  ││ │
│  │  - format()      │    │  │- send()  │ │- send()         ││ │
│  └─────────────────┘    │  │- onMsg() │ │- onMsg()        ││ │
│                          │  └──────────┘ └──────────────────┘│ │
│  ┌─────────────────┐    └─────────────────────────────────────┘ │
│  │  MessageTemplate │                                            │
│  │  - testProgress  │    消息类型:                               │
│  │  - testReport    │    - 测试进展通知                           │
│  │  - reviewPending │    - 测试报告推送                           │
│  │  - errorAlert    │    - 审核待办提醒                           │
│  └─────────────────┘    - 异常告警                               │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 配置独立性

QQbot 和 Welinkbot 配置相互独立：
- 各自独立的 `ChannelConfig` 记录
- 连接测试互不影响
- 一方配置失败不阻塞另一方
- 消息发送失败仅影响对应渠道，不影响主流程

---

## 6. 数据持久化层设计

### 6.1 SQLite 数据库

使用 `better-sqlite3` 作为本地数据库，同步 API 高性能。

```typescript
class Database {
  private db: betterSqlite3.Database

  constructor(dbPath: string) {
    this.db = new betterSqlite3(dbPath)
    this.enableWAL()        // WAL 模式提升并发读性能
    this.enableForeignKeys() // 启用外键约束
    this.runMigrations()    // 执行数据库迁移
  }

  // 事务支持
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }
}
```

### 6.2 Repository 模式

每个数据模型对应一个 Repository，封装 CRUD 操作：

```typescript
class ProjectRepo {
  findAll(): Project[]
  findById(id: string): Project | null
  findByName(name: string): Project | null
  create(project: CreateProjectParams): Project
  update(id: string, data: Partial<Project>): Project
  delete(id: string): void
}
```

### 6.3 加密存储 (SecureStore)

使用 `electron-store` 配合加密存储敏感数据：

```typescript
class SecureStore {
  // 加密存储 API Key
  async saveApiKey(service: string, key: string): Promise<void>

  // 读取 API Key (解密)
  async getApiKey(service: string): Promise<string | null>

  // 脱敏显示 (仅显示末尾4位)
  maskApiKey(key: string): string  // → "****abcd"
}
```

### 6.4 文件存储 (FileStore)

知识库文档以文件形式存储在用户数据目录：

```
{app.getPath('userData')}/
  └── knowledge/
      └── {knowledgeBaseId}/
          └── {documentId}.{ext}
```

### 6.5 数据库迁移策略

```typescript
// migrations/001_initial.ts
export function up(db: Database): void {
  db.exec(`
    CREATE TABLE project (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE test_flow_activity (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES project(id),
      activity_type TEXT NOT NULL,
      activity_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      review_status TEXT,
      output TEXT,
      error_message TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    );

    -- ... 其他表
  `)
}
```

---

## 7. ChatAgent 模块 (ChatAgentService + AgentExecutor + ToolRegistry + PromptBuilder)

### 7.1 模块概述

ChatAgent 是 AI 对话核心引擎，基于 LLM + 工具调用 + 知识库 RAG 实现多轮推理与执行。通过 AsyncGenerator 驱动 Agent 执行循环，产出 6 种流式事件。

### 7.2 整体架构图

```
ChatAgentService（会话管理）
  → AgentExecutor（执行循环，AsyncGenerator）
    → LlmService（流式 LLM 调用）
    → ToolRegistry（工具注册与执行）
    → PromptBuilder（8层 Prompt 注入）
```

### 7.3 PromptBuilder 8 层注入设计

| 层序 | 层名 | 职责 | 注入条件 |
|------|------|------|---------|
| 1 | role | 角色、核心能力、行为准则 | 始终注入 |
| 2 | knowledge | 知识库 RAG 检索结果 | knowledgeBaseId 存在 |
| 3 | project | 项目信息、需求/Spec文件列表 | projectId 存在 |
| 4 | tool | 可用工具 Schema + 使用指南 | 始终注入 |
| 5 | behavior | 输出格式、交互规范 | 始终注入 |
| 6 | thinking_protocol | 思考过程展示协议 | 始终注入 |
| 7 | pipeline | 流水线状态 | projectId + pipelineState 存在 |
| 8 | skill | 启用的 Skill 列表 | enabledSkills 非空 |

上下文压缩：当 estimatedTokens > maxTokens * 0.3 时，trimPrompt 按预算裁剪非必要层，保留 role(0) + tool(3) 必需层。

### 7.4 ToolRegistry 9 工具注册

| 工具名 | Skill 映射 | 自动审批 | 说明 |
|--------|-----------|---------|------|
| analyze_requirement | requirementParser | 否 | 分析需求文档 |
| design_test | testDesigner | 否 | 设计测试方案 |
| generate_cases | caseGenerator | 否 | 生成测试用例 |
| generate_script | scriptGenerator | 否 | 生成测试脚本 |
| search_knowledge | - | 是 | 知识库检索 |
| read_file | - | 是 | 读取文件 |
| list_files | - | 是 | 列出文件 |
| get_pipeline_status | - | 是 | 获取流水线状态 |
| review_artifact | - | 否 | 审核流水线产出 |

MANUAL_APPROVAL_TOOLS = {analyze_requirement, design_test, generate_cases, generate_script, review_artifact}

### 7.5 Agent 执行循环

- 驱动方式：AsyncGenerator，每轮 yield AgentEvent
- 最大轮次：MAX_AGENT_ROUNDS = 10
- 流式事件类型：thinking | content | tool_call | tool_result | done | error
- 工具执行超时：TOOL_TIMEOUT_MS = 60,000ms
- 参数解析：parseToolArguments，非法 JSON 返回 {}

### 7.6 审批机制

- 需审批工具：MANUAL_APPROVAL_TOOLS 集合中的工具
- 双端通信：requestToolApproval 向渲染进程推送审批请求 → resolveApproval 接收审批结果
- 超时：120,000ms 未响应自动拒绝
- ChatAgentService.approveToolCall(sessionId, toolCallId, approved) 转发到 resolveApproval

### 7.7 @文件引用

- 正则：`/@([\w./\-]+\.[\w]+)/g`，匹配 @filename 格式
- 解析流程：resolveFileReferences → 在项目目录递归查找文件 → 读取内容注入到消息前
- 文件不存在：注入 `[文件未找到]`

---

## 8. LLM 多 Provider 配置

### 8.1 Provider 类型枚举

```typescript
type LlmProvider = 'openai' | 'anthropic' | 'azure' | 'local'
```

### 8.2 默认 URL 映射表

| Provider | 默认 URL |
|----------|---------|
| openai | https://api.openai.com/v1 |
| anthropic | https://api.anthropic.com/v1 |
| azure | https://{resource}.openai.azure.com/openai/deployments/{deployment} |
| local | http://localhost:11434/v1 |

### 8.3 字段名统一

渲染进程侧统一字段名（camelCase），主进程侧保持数据库字段名（snake_case）：

| 统一字段名 | 旧字段名 | 说明 |
|-----------|---------|------|
| apiKey | - | 加密存储，界面脱敏显示 |
| baseUrl | api_url | API 服务地址 |
| modelName | model_name | 模型名称 |

### 8.4 白名单校验

```typescript
const ALLOWED_PROVIDERS: LlmProvider[] = ['openai', 'anthropic', 'azure', 'local']
```

配置保存时校验 provider 是否在白名单内，非法值拒绝保存。
