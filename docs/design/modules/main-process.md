# 主进程模块设计

## 修改历史

| 日期       | 版本  | 描述         | 作者  |
| ---------- | ----- | ------------ | ----- |
| 2026-05-24 | v1.0  | 初始版本     | CodeArts |

---

## 1. 入口和生命周期管理

### 1.1 入口文件 `main.ts`

主进程入口负责应用的完整生命周期管理：

```typescript
// src/main/main.ts 核心流程
app.whenReady().then(async () => {
  await initDatabase()        // 1. 初始化 sql.js 数据库
  await initSecureStore()     // 2. 初始化加密存储
  registerAllIpcHandlers()    // 3. 注册 IPC 处理器
  createWindow()              // 4. 创建主窗口
  createTray()                // 5. 创建系统托盘
})
```

### 1.2 BrowserWindow 配置

```typescript
new BrowserWindow({
  width: 1400, height: 900,
  minWidth: 1024, minHeight: 680,
  show: false,                           // 延迟显示，等 ready-to-show
  titleBarStyle: 'hidden',               // 自定义标题栏
  titleBarOverlay: { color: '#ffffff', height: 40, symbolColor: '#333333' },
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,                      // Preload 需要 Node API
    contextIsolation: true,              // 安全隔离
    nodeIntegration: false               // 禁止渲染进程直接使用 Node
  }
})
```

### 1.3 窗口加载策略

| 环境         | 加载方式                                       |
| ------------ | ---------------------------------------------- |
| 开发模式     | `mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)` |
| 生产模式     | `mainWindow.loadFile(join(__dirname, '../renderer/index.html'))` |

### 1.4 托盘菜单

- **显示窗口**：`mainWindow?.show()`
- **退出**：`app.quit()`
- **点击托盘**：显示窗口

### 1.5 平台适配

- `window-all-closed`：非 macOS 时 `app.quit()`
- `activate`：macOS 无窗口时重新创建

---

## 2. data/ 模块设计

### 2.1 database.ts — 数据库初始化与持久化

**核心职责**：sql.js 的加载、初始化、定时持久化、关闭清理。

```typescript
// 关键接口
export function getDatabase(): SqlJsDatabase     // 获取数据库实例（未初始化时抛错）
export async function initDatabase(): Promise<void>  // 初始化：加载sql.js→打开/创建DB→迁移→定时保存
export function closeDatabase(): void            // 关闭：清理定时器→保存磁盘→关闭DB
```

**持久化机制**：
- 数据库路径：`app.getPath('userData')/omni-test-agent.db`
- 定时保存：每 30 秒调用 `saveToDisk()`（`db.export()` → `fs.writeFileSync`）
- 关闭保存：`closeDatabase()` 时立即保存

**PRAGMA 配置**：
```sql
PRAGMA foreign_keys = ON     -- 启用外键约束
PRAGMA journal_mode = WAL    -- WAL 模式（sql.js 中仅设置，实际效果有限）
```

### 2.2 dbAdapter.ts — 泛型 SQL 适配器

`DbAdapter` 封装 sql.js 的底层 API，提供统一的 CRUD 操作接口：

```typescript
class DbAdapter {
  run(sql: string, params?: any[]): { changes: number }       // 执行写操作，返回影响行数
  get(sql: string, params?: any[]): DbRow | null              // 查询单行
  all(sql: string, params?: any[]): DbRow[]                   // 查询多行
  exec(sql: string): void                                     // 执行原始 SQL
  prepare(sql: string): { run, get, all }                     // 预编译语句
}

// 工厂函数，每次调用创建新实例
export function db(): DbAdapter
```

**设计说明**：
- `DbAdapter` 通过 `getDatabase()` 获取全局 sql.js 实例
- 使用 `stmt.prepare()/bind()/step()/getAsObject()/free()` 的 sql.js 原生 API
- `run()` 方法使用 `db.getRowsModified()` 获取影响行数
- 每次调用 `db()` 创建新实例，避免状态污染

### 2.3 migrations/001_initial.ts — 初始迁移

创建 13 张表和 8 个索引：

| 表名                   | 用途             | 关键约束                              |
| ---------------------- | ---------------- | ------------------------------------- |
| `project`              | 项目             | id PK, name UNIQUE                    |
| `test_flow_activity`   | 测试流程活动     | project_id FK→project CASCADE         |
| `flow_review_record`   | 审核记录         | activity_id FK→test_flow_activity CASCADE |
| `test_case`            | 测试用例         | project_id FK→project CASCADE         |
| `knowledge_base`       | 知识库           | project_id FK→project CASCADE         |
| `knowledge_document`   | 知识库文档       | kb_id FK→knowledge_base CASCADE       |
| `document_chunk`       | 文档分块         | document_id FK→knowledge_document CASCADE |
| `query_log`            | 查询日志         | kb_id (无 FK)                         |
| `chat_session`         | 对话会话         | project_id FK→project SET NULL        |
| `chat_message`         | 对话消息         | session_id FK→chat_session CASCADE    |
| `llm_config`           | LLM 配置         | is_active 标记活跃配置                |
| `mcp_config`           | MCP 配置         | is_active 标记活跃配置                |
| `skill`                | Skill 记录       | name UNIQUE, is_builtin/is_enabled    |
| `channel_config`       | 渠道配置         | type 唯一标识渠道类型                 |

**迁移特点**：
- 使用 `CREATE TABLE IF NOT EXISTS`，保证幂等
- 统一时间字段：`datetime('now', 'localtime')`
- 迁移函数签名为 `runMigrations(db: any): void`

### 2.4 Repository 模式

所有 Repository 遵循统一模式：

```typescript
// 通用 Repository 模式
import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface Entity { /* ... */ }

export class XxxRepo {
  create(...args): Entity { /* INSERT + SELECT */ }
  getById(id: string): Entity | null { /* SELECT by PK */ }
  list(): Entity[] { /* SELECT ALL */ }
  update(id: string, data: Partial<Entity>): Entity | null { /* UPDATE + SELECT */ }
  delete(id: string): boolean { /* DELETE, return changes > 0 */ }
}

export const xxxRepo = new XxxRepo()  // 单例导出
```

**9 个 Repository 详表**：

| Repository           | 关键方法                                                   | 特殊逻辑                       |
| -------------------- | ---------------------------------------------------------- | ------------------------------ |
| `ProjectRepo`        | create/getById/list/update/delete/getStats                 | getStats 聚合关联表计数       |
| `FlowActivityRepo`   | create/listByProject/getByType/updateStatus/addReview/getReviews/resetRunningToIdle | 活动状态机转换              |
| `KnowledgeRepo`      | createBase/listBases/deleteBase/createDocument/listDocuments/updateDocumentStatus/createChunk/logQuery | 文档状态流转               |
| `ChatRepo`           | createSession/listSessions/deleteSession/addMessage/getMessages | addMessage 自动更新 session.updated_at |
| `LlmConfigRepo`      | getActive/save                                             | save upsert 模式，始终保持单条活跃 |
| `McpConfigRepo`      | getActive/save                                             | 同 LlmConfigRepo 的 upsert 模式 |
| `SkillRepo`          | list/getByName/create/toggle                               | toggle 核心Skill不可全部禁用  |
| `ChannelConfigRepo`  | getByType/save                                             | 按 type upsert               |
| `TestCaseRepo`       | create/getById/listByProject/update/delete                 | update 动态字段拼接          |

### 2.5 secureStore.ts — 加密存储

```typescript
// 核心接口
export async function initSecureStore(): Promise<void>  // 初始化 electron-store
export function saveApiKey(service: string, apiKey: string): void  // 加密保存 API Key
export function getApiKey(service: string): string | null          // 解密获取 API Key
export function deleteApiKey(service: string): void               // 删除 API Key
export function saveConfig(key: string, value: any): void         // 通用配置保存
export function getConfig(key: string): any                       // 通用配置获取
export function deleteConfig(key: string): void                   // 通用配置删除
```

**实现细节**：
- 使用 `electron-store`，文件名 `secure-config`，内置加密密钥
- API Key 存储路径：`apiKeys.{service}`
- 加密/解密使用 `utils/crypto.ts` 的 AES-256-GCM
- 初始化失败时提供空操作 fallback，保证应用不崩溃

---

## 3. services/ 模块设计

### 3.1 Service 层通用模式

所有 Service 采用单例模式导出：

```typescript
export class XxxService {
  // 业务方法
}
export const xxxService = new XxxService()
```

### 3.2 ProjectService

```typescript
class ProjectService {
  list(): Project[]
  create(name: string, description?: string): Project
  update(id: string, data: Partial<Pick<Project, 'name' | 'description'>>): Project | null
  delete(id: string): boolean
  getStats(id: string): Record<string, number>
  getById(id: string): Project | null
}
```

**职责**：纯委托型 Service，直接转发到 ProjectRepo。

### 3.3 LlmService

```typescript
class LlmService {
  private client: any  // OpenAI 客户端实例（懒加载）

  async chat(params: ChatParams): Promise<string>         // 同步对话
  async streamChat(params: ChatParams, win: BrowserWindow): Promise<void>  // 流式对话
  async testConnection(modelName, apiUrl, apiKey): Promise<{ success, error? }>
  saveConfig(modelName, apiUrl, apiKey, temperature, maxTokens): void
  getConfig(): any  // 返回配置 + 脱敏 API Key
  resetClient(): void  // 重置客户端（配置变更后）
}
```

**关键设计**：
- OpenAI 客户端懒加载：首次调用 `getClient()` 时创建
- 流式输出通过 `BrowserWindow.webContents.send('llm:streamChunk')` 推送
- 消息构建：系统提示 + 历史消息 + 当前消息
- API Key 脱敏：`maskApiKey()` 仅保留后 4 位

### 3.4 KnowledgeService

```typescript
class KnowledgeService {
  listBases(projectId): KnowledgeBase[]
  createBase(projectId, name, description?): KnowledgeBase
  deleteBase(id): boolean
  listDocuments(kbId): KnowledgeDocument[]
  async uploadDocument(kbId, projectId, filePath, fileName): Promise<KnowledgeDocument>
  async vectorize(docId, kbId, projectId): Promise<void>
  search(kbId, query, topK?): any[]
}
```

**关键流程**：
- `uploadDocument`：复制文件到 `userData/knowledge-bases/{projectId}/{kbId}/documents/`
- `vectorize`：解析文档 → 分块 → 写入 document_chunk 表 → 更新状态
- `search`：当前使用 LIKE 模糊匹配（非向量检索），返回固定 score=0.8

### 3.5 McpService

```typescript
class McpService {
  private connection: McpConnection | null  // MCP 连接（http/stdio）

  async connect(): Promise<void>             // 建立 MCP 连接
  async listTools(): Promise<McpTool[]>      // 发现可用工具
  async callTool(toolName, params): Promise<any>  // 调用工具
  async testConnection(config): Promise<{ success, error? }>
  saveConfig(name, transportType, url?, command?, args?): void
  getConfig(): any
}
```

**传输协议**：
- `http`：基于 URL 的 HTTP 连接
- `stdio`：基于 `child_process.spawn` 的标准输入输出连接

### 3.6 SkillRegistry + SkillEngine

**SkillRegistry**：Skill 注册表

```typescript
interface ISkill {
  name: string
  displayName: string
  description: string
  isBuiltin: boolean
  execute(context: SkillContext): Promise<SkillResult>
}

class SkillRegistry {
  private skills: Map<string, ISkill>
  register(skill: ISkill): void       // 注册并同步到 DB
  get(name: string): ISkill | undefined
  list(): ISkill[]
  listDbRecords(): SkillRecord[]      // 从 DB 查询
  toggle(id, enabled): Promise<boolean>
  isSkillEnabled(name): boolean
}
```

**SkillEngine**：Skill 执行引擎

```typescript
class SkillEngine {
  async execute(skillName, context): Promise<SkillResult> {
    // 1. 从 Registry 获取 Skill
    // 2. 检查启用状态
    // 3. 注入 llmService/knowledgeService/mcpService 到 context
    // 4. 执行 skill.execute(enrichedContext)
  }
}
```

### 3.7 TestFlowOrchestrator

**9 步活动序列**：

```
requirement_import → requirement_analysis → requirement_review →
test_design → design_review → case_generation → case_review →
script_generation → script_debug
```

**Activity-Skill 映射**：

| 活动类型               | Skill              |
| ---------------------- | ------------------ |
| `requirement_analysis` | `requirementParser` |
| `test_design`          | `testDesigner`     |
| `case_generation`      | `caseGenerator`    |
| `script_generation`    | `scriptGenerator`  |

**审核活动**：`requirement_review`、`design_review`、`case_review`（不可自动执行）

**执行逻辑**：
1. 校验活动类型合法性
2. 审核活动不可自动执行
3. 前序活动必须完成（审核活动需 approved）
4. 更新状态为 `running`，推送进度
5. 映射 Skill 执行，更新状态为 `completed/failed`
6. 推送最终进度

**恢复机制**：`recover()` 将所有 `running` 状态重置为 `idle`

### 3.8 ChannelManager

```typescript
class ChannelManager {
  configure(type, config, isEnabled): void  // 配置渠道并持久化
  getConfig(type): any                      // 获取配置
  async test(type): Promise<{ success, error? }>  // 测试连接
  async send(type, message): Promise<{ success, error? }>  // 发送消息
}
```

路由策略：根据 `type` 分发到 `qqBotClient` 或 `welinkBotClient`。

### 3.9 ChatAgentService

```typescript
class ChatAgentService {
  startChat(sessionId, message, projectId, win, knowledgeBaseId?): Promise<void>
  abortChat(sessionId): void
  approveToolCall(sessionId, toolCallId, approved): void
  isExecuting(sessionId): boolean
}
```

- 管理 `executingSessions` Set 和 `abortControllers` Map
- `startChat` 构建 PromptContext（pipelineState + enabledSkills），调用 `buildSystemPrompt` + `executeAgentLoop`
- 每轮事件通过 `win.webContents.send('chat:agentEvent', { sessionId, event })` 推送

### 3.10 AgentExecutor

`executeAgentLoop(request, win, abortSignal): AsyncGenerator<AgentEvent>`

- 驱动 LLM 流式调用 + 工具执行循环
- 最大 10 轮，工具超时 60s
- 支持 6 种事件类型输出
- `parseToolArguments`：JSON 解析，非法 JSON 返回 {}
- `resolveFileReferences`：正则 `@([\w./\-]+\.[\w]+)` 解析文件引用
- `requestToolApproval` / `resolveApproval`：审批双端通信，超时 120s

### 3.11 ToolRegistry

9 工具 Schema 定义 + 执行路由：Skill 工具 → SkillEngine，文件工具 → FileOperationService，流水线工具 → TestFlowPipelineService

`MANUAL_APPROVAL_TOOLS` = {analyze_requirement, design_test, generate_cases, generate_script, review_artifact}

### 3.12 PromptBuilder

`buildSystemPrompt(context: PromptContext): Promise<string>`

8 层注入：role → knowledge → project → tool → behavior → thinking_protocol → pipeline → skill

上下文压缩：`trimPrompt` 保留 role(0) + tool(3) 必需层，裁剪超出 Token 预算的非必要层。

---

## 4. ipc/ 模块设计

### 4.1 注册机制

```typescript
// ipc/index.ts — 统一注册入口
function registerAllIpcHandlers(): void {
  const handlers = [
    () => import('./projectHandler').then(m => m.registerProjectHandler()),
    () => import('./llmHandler').then(m => m.registerLlmHandler()),
    // ... 8 个 Handler
  ]
  for (const register of handlers) {
    try { register() } catch (error) { logger.error(...) }
  }
}
```

### 4.2 通用辅助 `helpers.ts`

```typescript
// 统一 IPC Handler 注册（含错误处理）
function registerIpcHandler(channel: string, handler: (...args) => any): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try { return await handler(...args) }
    catch (error) { logger.error(`IPC handler error [${channel}]:`, error); throw error }
  })
}

// IPC 事件监听注册
function registerIpcEventListener(channel: string, listener: (...args) => void): void {
  ipcMain.on(channel, (_event, ...args) => {
    try { listener(...args) } catch (error) { logger.error(...) }
  })
}
```

### 4.3 通道命名规范

格式：`domain:action`

| 域         | 通道                                                          |
| ---------- | ------------------------------------------------------------- |
| project    | `project:list`, `project:create`, `project:update`, `project:delete`, `project:switch`, `project:getStats` |
| llm        | `llm:chat`, `llm:streamChat`, `llm:testConnection`, `llm:getConfig`, `llm:saveConfig` |
| knowledge  | `knowledge:listBases`, `knowledge:createBase`, `knowledge:deleteBase`, `knowledge:uploadDoc`, `knowledge:vectorize`, `knowledge:search`, `knowledge:listDocuments` |
| mcp        | `mcp:callTool`, `mcp:testConnection`, `mcp:listTools`, `mcp:getConfig`, `mcp:saveConfig` |
| skill      | `skill:list`, `skill:toggle`, `skill:import`, `skill:execute` |
| channel    | `channel:configure`, `channel:test`, `channel:send`, `channel:getConfig` |
| testflow   | `testflow:execute`, `testflow:interrupt`, `testflow:review`, `testflow:getStatus` |
| store      | `store:get`, `store:set`, `store:delete`                      |

---

## 5. skills/ 模块设计

### 5.1 ISkill 接口

```typescript
interface ISkill {
  name: string           // 唯一标识
  displayName: string    // 显示名称
  description: string    // 描述
  isBuiltin: boolean     // 是否内置
  execute(context: SkillContext): Promise<SkillResult>
}

interface SkillContext {
  projectId: string
  inputData?: any
  llmService?: any       // 由 SkillEngine 注入
  knowledgeService?: any // 由 SkillEngine 注入
  mcpService?: any       // 由 SkillEngine 注入
}

interface SkillResult {
  success: boolean
  output?: any
  error?: string
  artifacts?: any[]      // 产出物
}
```

### 5.2 四个内置 Skill

| Skill                | name               | 描述                     | LLM Prompt 模式            |
| -------------------- | ------------------ | ------------------------ | --------------------------- |
| `RequirementParserSkill` | `requirementParser` | 解析需求文档，提取测试点 | 专业测试需求分析师         |
| `TestDesignerSkill`  | `testDesigner`     | 生成测试设计方案         | 专业测试设计师             |
| `CaseGeneratorSkill` | `caseGenerator`    | 生成详细测试用例         | 专业测试用例设计专家       |
| `ScriptGeneratorSkill` | `scriptGenerator`  | 生成 pytest 测试脚本     | 专业测试自动化工程师       |

**执行流程**（以 RequirementParserSkill 为例）：

```typescript
async execute(context: SkillContext): Promise<SkillResult> {
  const prompt = this.buildPrompt(context)  // 构建 prompt
  const result = await context.llmService.chat({  // 调用 LLM
    sessionId: `skill-${this.name}-${Date.now()}`,
    message: prompt,
    projectId: context.projectId
  })
  return { success: true, output: { analysis: result }, artifacts: [...] }
}
```

---

## 6. channels/ 模块设计

### 6.1 渠道体系

```
ChannelManager (路由)
  ├── QqBotClient     — QQ 机器人
  └── WelinkBotClient — WeLink 机器人
```

### 6.2 QqBotClient

```typescript
class QqBotClient {
  private config: BotConfig | null  // { webhookUrl, token, secret }
  configure(config: BotConfig): void
  async send(message: string): Promise<{ success, error? }>   // POST webhook + Bearer token
  async testConnection(): Promise<{ success, error? }>        // GET webhook (5s timeout)
}
```

### 6.3 WelinkBotClient

```typescript
class WelinkBotClient {
  private config: WelinkConfig | null  // { webhookUrl, appId, appSecret }
  configure(config: WelinkConfig): void
  async send(message: string): Promise<{ success, error? }>   // POST webhook (msg_type: 'text')
  async testConnection(): Promise<{ success, error? }>        // GET webhook (5s timeout)
}
```

---

## 7. utils/ 模块设计

### 7.1 crypto.ts — AES-256-GCM 加解密

```typescript
// 算法：AES-256-GCM
// 密钥派生：scryptSync(password, salt, 32)
// 输出格式：iv:authTag:encrypted (hex编码)

export function encrypt(text: string, secret?: string): string
export function decrypt(encryptedText: string, secret?: string): string
export function maskApiKey(apiKey: string): string  // 脱敏：****abcd
```

### 7.2 documentParser.ts — 文档解析与分块

```typescript
export async function parseDocument(filePath: string): Promise<ParsedDocument>
// 支持：.txt, .md, .pdf (pdf-parse), .doc/.docx (mammoth)

export function splitTextIntoChunks(text: string, chunkSize?: number, overlap?: number): string[]
// 默认：chunkSize=500, overlap=50
```

### 7.3 fileHelper.ts — 文件操作

```typescript
export function ensureDir(dirPath: string): void
export function getKnowledgeBaseDir(projectId: string): string   // userData/knowledge-bases/{projectId}
export function getDocumentDir(projectId: string, kbId: string): string
export function writeFile/readFile/deleteFile/deleteDir/listFiles/getFileSize
export function validateFileUpload(fileName, fileSize): { valid, error? }  // 禁止可执行文件，50MB上限
```

### 7.4 logger.ts — 日志系统

```typescript
// 日志级别：debug / info / warn / error
// 输出：文件 + 控制台双写
// 文件路径：userData/logs/app-{date}.log
// 格式：[timestamp] [LEVEL] message

export const logger: Logger  // 全局单例
```

### 7.5 machineId.ts — 机器标识

```typescript
export function getMachineId(): string  // 跨平台获取机器 UUID
// Win32: wmic csproduct get UUID
// macOS: ioreg IOPlatformUUID
// Linux: /etc/machine-id
```

---

## 8. 分层约束规则

```
┌─────────────────────────────────────────────────────┐
│  允许的依赖方向（单向，从上到下）                    │
│                                                     │
│  main.ts → ipc → services → data/repositories → db  │
│          → data/database                            │
│          → data/secureStore                         │
│  services → skills                                  │
│  services → channels                                │
│  services → utils                                   │
│  skills → services (仅通过 SkillContext 注入)       │
│                                                     │
│  禁止：                                             │
│  - Repository 直接访问 Service                      │
│  - IPC 直接访问 Repository                          │
│  - 渲染进程直接访问主进程模块                        │
│  - 跨域 Service 直接调用（通过 SkillContext 注入）  │
└─────────────────────────────────────────────────────┘
```

---

## 9. 资源管理（初始化/释放配对）

| 资源             | 初始化                          | 释放                           | 配对关系 |
| ---------------- | ------------------------------- | ------------------------------ | -------- |
| sql.js Database  | `initDatabase()`                | `closeDatabase()`              | ✅       |
| 定时保存器       | `setInterval(saveToDisk, 30000)` | `clearInterval(saveTimer)`    | ✅       |
| electron-store   | `initSecureStore()`             | (自动管理)                     | ✅       |
| OpenAI Client    | `getClient()` (懒加载)          | `resetClient()`                | ✅       |
| MCP Connection   | `mcpService.connect()`          | `this.connection = null`       | ✅       |
| MCP stdio 进程   | `spawn(command, args)`          | (进程跟随 app 生命周期)        | ⚠️      |
| BrowserWindow    | `createWindow()`                | `window-all-closed` → quit     | ✅       |
| Tray             | `createTray()`                  | (跟随 app 生命周期)            | ✅       |
| Logger Stream    | `logger.init()` (未在 main 调用) | `logger.destroy()`            | ⚠️      |
| Stream Listeners | `ipcRenderer.on(...)`           | `removeAllListeners(...)`      | ✅       |

⚠️ 标记项需注意：MCP stdio 进程和 Logger Stream 的清理未在 `app.on('before-quit')` 中显式处理。
