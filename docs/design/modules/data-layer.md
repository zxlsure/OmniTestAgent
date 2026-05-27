# 数据层设计

## 修改历史

| 日期       | 版本  | 描述         | 作者  |
| ---------- | ----- | ------------ | ----- |
| 2026-05-24 | v1.0  | 初始版本     | CodeArts |

---

## 1. sql.js 适配方案

### 1.1 为什么选择 sql.js

sql.js 是 SQLite 编译为 WebAssembly 的版本，优势：

| 特性           | 说明                                                    |
| -------------- | ------------------------------------------------------- |
| 零原生依赖     | 纯 WASM，无需系统安装 SQLite                            |
| Electron 友好  | 无需处理原生模块编译（native addon）                     |
| 事务支持       | 完整的 SQLite 特性（外键、WAL、索引）                   |
| 单文件存储     | `omni-test-agent.db` 一个文件，便于备份和迁移            |
| 同步 API       | sql.js 原生同步 API，简化主进程代码                     |

### 1.2 初始化流程

```typescript
// src/main/data/database.ts
export async function initDatabase(): Promise<void> {
  // 1. 确定数据库路径
  dbPath = join(app.getPath('userData'), 'omni-test-agent.db')

  // 2. 加载 sql.js WASM
  const SQL = await initSqlJs()

  // 3. 从磁盘加载或新建
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)    // 从文件恢复
  } else {
    db = new SQL.Database()              // 新建空数据库
  }

  // 4. 设置 PRAGMA
  db.run('PRAGMA foreign_keys = ON')     // 启用外键约束
  db.run('PRAGMA journal_mode = WAL')    // WAL 日志模式

  // 5. 运行迁移
  runMigrations(db)

  // 6. 启动定时持久化
  saveTimer = setInterval(saveToDisk, 30000)  // 每 30 秒
}
```

### 1.3 持久化机制

sql.js 在 **内存** 中运行，需要定期写回磁盘：

```typescript
function saveToDisk(): void {
  if (!db) return
  const data = db.export()             // 导出为 Uint8Array
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)     // 同步写入磁盘
}
```

| 时机         | 触发方式                    |
| ------------ | --------------------------- |
| 定时保存     | `setInterval(saveToDisk, 30000)` |
| 应用关闭     | `closeDatabase()` → `saveToDisk()` → `db.close()` |
| 异常防护     | 内存数据库，崩溃最多丢失 30s 数据 |

### 1.4 关闭清理

```typescript
export function closeDatabase(): void {
  if (saveTimer) { clearInterval(saveTimer); saveTimer = null }
  if (db) { saveToDisk(); db.close(); db = null }
}
```

---

## 2. DbAdapter 泛型接口

### 2.1 类定义

```typescript
interface DbRow { [key: string]: any }

class DbAdapter {
  private db: any  // sql.js Database 实例

  constructor() {
    this.db = getDatabase()  // 获取全局数据库实例
  }

  run(sql: string, params: any[] = []): { changes: number }
  get(sql: string, params: any[] = []): DbRow | null
  all(sql: string, params: any[] = []): DbRow[]
  exec(sql: string): void
  prepare(sql: string): PreparedStatement
}

// 工厂函数
function db(): DbAdapter
```

### 2.2 方法详解

#### `run(sql, params)` — 执行写操作

```typescript
run(sql: string, params: any[] = []): { changes: number } {
  this.db.run(sql, params)
  return { changes: this.db.getRowsModified() }
}
```

- 用于 INSERT / UPDATE / DELETE
- 返回 `changes` 表示影响行数
- 通过 `getRowsModified()` 获取影响行数（sql.js 原生 API）

#### `get(sql, params)` — 查询单行

```typescript
get(sql: string, params: any[] = []): DbRow | null {
  const stmt = this.db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row
  }
  stmt.free()
  return null
}
```

- 返回第一条结果或 `null`
- 使用 `prepare → bind → step → getAsObject → free` 流程

#### `all(sql, params)` — 查询多行

```typescript
all(sql: string, params: any[] = []): DbRow[] {
  const stmt = this.db.prepare(sql)
  stmt.bind(params)
  const rows: DbRow[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}
```

- 返回所有结果行
- `while (stmt.step())` 循环遍历

#### `prepare(sql)` — 预编译语句

```typescript
prepare(sql: string): {
  run: (...params: any[]) => { changes: number }
  get: (...params: any[]) => DbRow | null
  all: (...params: any[]) => DbRow[]
}
```

- 返回绑定 SQL 的便捷对象，可多次调用不同参数

### 2.3 使用示例

```typescript
// Repository 中的典型用法
import { db } from '../dbAdapter'

// INSERT
db().run('INSERT INTO project (id, name) VALUES (?, ?)', [id, name])

// SELECT 单行
const project = db().get('SELECT * FROM project WHERE id = ?', [id]) as Project | null

// SELECT 多行
const projects = db().all('SELECT * FROM project ORDER BY updated_at DESC') as Project[]

// UPDATE
const changes = db().run('DELETE FROM project WHERE id = ?', [id]).changes
```

---

## 3. Repository 模式

### 3.1 设计原则

- 每个 Repository 对应一张数据库表
- Repository 只包含纯数据访问逻辑，不含业务逻辑
- 所有 Repository 导出单例实例（`export const xxxRepo = new XxxRepo()`）
- 通过 `db()` 工厂函数获取 DbAdapter 实例

### 3.2 通用 Repository 模板

```typescript
import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface Entity {
  id: string
  // ...其他字段
}

export class EntityRepo {
  create(...args: any[]): Entity {
    const id = randomUUID()
    const now = new Date().toISOString()
    db().run('INSERT INTO table (id, ...) VALUES (?, ...)', [id, ...])
    return this.getById(id)!
  }

  getById(id: string): Entity | null {
    return db().get('SELECT * FROM table WHERE id = ?', [id]) as Entity | null
  }

  list(): Entity[] {
    return db().all('SELECT * FROM table ORDER BY ...') as Entity[]
  }

  update(id: string, data: Partial<Entity>): Entity | null {
    // 动态拼接 SET 子句
    db().run(`UPDATE table SET ${fields.join(', ')} WHERE id = ?`, values)
    return this.getById(id)
  }

  delete(id: string): boolean {
    return db().run('DELETE FROM table WHERE id = ?', [id]).changes > 0
  }
}

export const entityRepo = new EntityRepo()
```

### 3.3 9 个 Repository 详解

#### ProjectRepo

```typescript
interface Project {
  id: string; name: string; description: string | null
  created_at: string; updated_at: string
}

class ProjectRepo {
  create(name: string, description?: string): Project
  getById(id: string): Project | null
  list(): Project[]                              // ORDER BY updated_at DESC
  update(id, data: Partial<Pick<Project, 'name' | 'description'>>): Project | null
  delete(id: string): boolean
  getStats(id: string): Record<string, number>   // 聚合: testCaseCount, activityCount, kbCount
}
```

#### FlowActivityRepo

```typescript
interface FlowActivity {
  id: string; project_id: string; activity_type: string; status: string
  input_data: string | null; output_data: string | null
  started_at: string | null; completed_at: string | null
  created_at: string; updated_at: string
}

interface FlowReviewRecord {
  id: string; activity_id: string; result: string
  comment: string | null; reviewer: string | null; reviewed_at: string
}

class FlowActivityRepo {
  create(projectId, activityType): FlowActivity
  getById(id): FlowActivity | null
  listByProject(projectId): FlowActivity[]        // ORDER BY created_at ASC
  getByType(projectId, activityType): FlowActivity | null
  updateStatus(id, status, extra?: { outputData?; inputData? }): void
  addReview(activityId, result, comment?, reviewer?): FlowReviewRecord
  getReviews(activityId): FlowReviewRecord[]
  resetRunningToIdle(projectId): number           // 恢复异常状态
}
```

**状态机**：`idle` → `running` → `completed` | `failed`

**updateStatus 逻辑**：
- `running`：设置 `started_at`
- `completed` / `failed`：设置 `completed_at`
- 其他：仅更新 `status`

#### KnowledgeRepo

```typescript
interface KnowledgeBase { id; project_id; name; description; doc_count; created_at; updated_at }
interface KnowledgeDocument { id; kb_id; file_name; file_path; file_size; file_type; chunk_count; status; error_message; created_at; updated_at }
interface DocumentChunk { id; document_id; content; chunk_index; embedding_status; created_at }
interface QueryLog { id; kb_id; query; result_count; created_at }

class KnowledgeRepo {
  createBase(projectId, name, description?): KnowledgeBase
  listBases(projectId): KnowledgeBase[]
  deleteBase(id): boolean
  createDocument(kbId, fileName, filePath, fileSize, fileType): KnowledgeDocument
  listDocuments(kbId): KnowledgeDocument[]
  updateDocumentStatus(id, status, errorMessage?): void
  createChunk(documentId, content, chunkIndex): DocumentChunk
  logQuery(kbId, query, resultCount): void
}
```

**文档状态流转**：`pending` → `processing` → `completed` | `failed`

#### ChatRepo

```typescript
interface ChatSession { id; project_id; title; created_at; updated_at }
interface ChatMessage { id; session_id; role; content; token_count; created_at }

class ChatRepo {
  createSession(projectId?, title): ChatSession
  listSessions(projectId?): ChatSession[]
  deleteSession(id): boolean
  addMessage(sessionId, role, content, tokenCount?): ChatMessage  // 自动更新 session.updated_at
  getMessages(sessionId): ChatMessage[]
}
```

#### LlmConfigRepo — Upsert 模式

```typescript
interface LlmConfig { id; model_name; api_url; is_active; temperature; max_tokens; created_at; updated_at }

class LlmConfigRepo {
  getActive(): LlmConfig | null       // WHERE is_active = 1 LIMIT 1
  save(modelName, apiUrl, temperature?, maxTokens?): LlmConfig  // 存在则 UPDATE，否则 INSERT
}
```

**设计**：始终保持单条活跃配置（`is_active = 1`）。

#### McpConfigRepo — Upsert 模式

```typescript
interface McpConfig { id; name; transport_type; url; command; args; is_active; created_at; updated_at }

class McpConfigRepo {
  getActive(): McpConfig | null
  save(name, transportType, url?, command?, args?): McpConfig
}
```

#### SkillRepo

```typescript
interface SkillRecord { id; name; display_name; description; is_builtin; is_enabled; config; created_at; updated_at }

class SkillRepo {
  list(): SkillRecord[]              // ORDER BY is_builtin DESC, name ASC
  getByName(name): SkillRecord | null
  create(name, displayName, description?, isBuiltin?): SkillRecord
  toggle(id, enabled): boolean       // 核心Skill不可全部禁用
}
```

**toggle 保护**：当禁用内置 Skill 时，检查是否为最后一个启用的内置 Skill，是则抛错。

#### ChannelConfigRepo — 按 type Upsert

```typescript
interface ChannelConfig { id; type; config; is_enabled; created_at; updated_at }

class ChannelConfigRepo {
  getByType(type): ChannelConfig | null
  save(type, config, isEnabled?): ChannelConfig
}
```

#### TestCaseRepo

```typescript
interface TestCase {
  id; project_id; title; description; priority; steps; expected_result; script_path; status
  created_at; updated_at
}

class TestCaseRepo {
  create(data: Partial<TestCase> & { project_id; title }): TestCase
  getById(id): TestCase | null
  listByProject(projectId): TestCase[]
  update(id, data: Partial<TestCase>): boolean
  delete(id): boolean
}
```

**update** 动态拼接：仅更新 `['title','description','priority','steps','expected_result','script_path','status']` 中的字段。

---

## 4. BaseConfigRepo 基类模式

LlmConfigRepo、McpConfigRepo、ChannelConfigRepo 三个配置 Repository 共享 **Upsert 模式**：

```typescript
// 通用 Upsert 模式
save(...args): Config {
  const existing = db().get('SELECT id FROM config_table WHERE condition')
  if (existing) {
    db().run('UPDATE config_table SET ... WHERE id = ?', [..., existing.id])
    return db().get('SELECT * FROM config_table WHERE id = ?', [existing.id])
  }
  const id = randomUUID()
  const now = new Date().toISOString()
  db().run('INSERT INTO config_table (...) VALUES (...)', [id, ...])
  return db().get('SELECT * FROM config_table WHERE id = ?', [id])
}
```

当前实现为各 Repo 独立实现此模式，未抽取公共基类。**提取 BaseConfigRepo 基类** 是潜在的优化方向：

```typescript
// 建议的 BaseConfigRepo（当前未实现）
abstract class BaseConfigRepo<T> {
  abstract tableName: string
  abstract activeCondition: string

  getActive(): T | null {
    return db().get(`SELECT * FROM ${this.tableName} WHERE ${this.activeCondition} LIMIT 1`) as T | null
  }

  save(data: Partial<T>, condition: string, conditionParams: any[]): T {
    const existing = db().get(`SELECT id FROM ${this.tableName} WHERE ${condition}`, conditionParams)
    if (existing) { /* UPDATE */ }
    else { /* INSERT */ }
  }
}
```

---

## 5. 迁移机制

### 5.1 当前实现

```typescript
// src/main/data/migrations/001_initial.ts
export function runMigrations(db: any): void {
  const MIGRATIONS = [
    'CREATE TABLE IF NOT EXISTS project (...)',
    'CREATE TABLE IF NOT EXISTS test_flow_activity (...)',
    // ... 13 张表 + 8 个索引
  ]

  for (const sql of MIGRATIONS) {
    db.run(sql)   // 顺序执行
  }
}
```

### 5.2 迁移特点

| 特点         | 说明                                                    |
| ------------ | ------------------------------------------------------- |
| 幂等性       | `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` |
| 顺序执行     | 按 MIGRATIONS 数组顺序依次执行                          |
| 无版本追踪   | 未使用迁移版本表，依赖 `IF NOT EXISTS` 保证安全         |
| 同步执行     | sql.js 同步 API，无 async                                |
| 单文件       | 所有迁移集中在 `001_initial.ts`                         |

### 5.3 数据库 Schema 总览

```sql
-- 业务表
project (id PK, name UNIQUE, description, created_at, updated_at)
test_flow_activity (id PK, project_id FK→project, activity_type, status, input_data, output_data, started_at, completed_at, ...)
flow_review_record (id PK, activity_id FK→test_flow_activity, result, comment, reviewer, reviewed_at)
test_case (id PK, project_id FK→project, title, description, priority, steps, expected_result, script_path, status, ...)

-- 知识库表
knowledge_base (id PK, project_id FK→project, name, description, doc_count, ...)
knowledge_document (id PK, kb_id FK→knowledge_base, file_name, file_path, file_size, file_type, chunk_count, status, error_message, ...)
document_chunk (id PK, document_id FK→knowledge_document, content, chunk_index, embedding_status, ...)
query_log (id PK, kb_id, query, result_count, created_at)

-- 对话表
chat_session (id PK, project_id FK→project SET NULL, title, ...)
chat_message (id PK, session_id FK→chat_session, role, content, token_count, ...)

-- 配置表
llm_config (id PK, model_name, api_url, is_active, temperature, max_tokens, ...)
mcp_config (id PK, name, transport_type, url, command, args, is_active, ...)
skill (id PK, name UNIQUE, display_name, description, is_builtin, is_enabled, config, ...)
channel_config (id PK, type, config, is_enabled, ...)

-- 索引
idx_flow_activity_project ON test_flow_activity(project_id, activity_type)
idx_test_case_project ON test_case(project_id)
idx_knowledge_base_project ON knowledge_base(project_id)
idx_knowledge_doc_kb ON knowledge_document(kb_id)
idx_document_chunk_doc ON document_chunk(document_id)
idx_chat_session_project ON chat_session(project_id)
idx_chat_message_session ON chat_message(session_id)
idx_channel_config_type ON channel_config(type)
```

---

## 6. 加密存储

### 6.1 双层加密架构

```
┌─────────────────────────────────────────────┐
│  第一层：electron-store                      │
│  - 文件加密：encryptionKey 配置              │
│  - 存储路径：userData/secure-config.json     │
│  - 所有数据文件级加密                        │
├─────────────────────────────────────────────┤
│  第二层：AES-256-GCM                        │
│  - 字段级加密（API Key 等）                  │
│  - 由 crypto.ts 的 encrypt/decrypt 实现     │
│  - 密钥按 service 隔离                      │
└─────────────────────────────────────────────┘
```

### 6.2 electron-store 初始化

```typescript
async function initSecureStore(): Promise<void> {
  const ElectronStore = (await import('electron-store')).default
  store = new ElectronStore({
    name: 'secure-config',                      // 文件名
    encryptionKey: 'omni-test-agent-secure-key-v1'  // 文件加密密钥
  })
}
```

**Fallback**：初始化失败时提供空操作 stub，保证应用不崩溃。

### 6.3 AES-256-GCM 加密实现

```typescript
// src/main/utils/crypto.ts

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

// 密钥派生：scrypt
function deriveKey(password: string): Buffer {
  const salt = 'omni-test-agent-salt-v1'
  return scryptSync(password, salt, KEY_LENGTH)
}

// 加密
function encrypt(text: string, secret?: string): string {
  const key = deriveKey(secret)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  let encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

// 解密
function decrypt(encryptedText: string, secret?: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
  const key = deriveKey(secret)
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8')
}
```

**密文格式**：`iv(hex):authTag(hex):encrypted(hex)`

### 6.4 API Key 存储流程

```
保存 API Key:
  saveApiKey('llm', 'sk-xxxxx')
    → encrypt('sk-xxxxx', 'llm')          // 以 service 名为密钥
    → secureStore.set('apiKeys.llm', encrypted)

读取 API Key:
  getApiKey('llm')
    → secureStore.get('apiKeys.llm')       // 获取密文
    → decrypt(encrypted, 'llm')            // 以 service 名解密
    → 'sk-xxxxx'

脱敏显示:
  maskApiKey('sk-xxxxx')
    → '*****xxxx'                          // 仅保留后4位
```

### 6.5 通用配置存储

```typescript
// 非敏感配置直接存取（仅 electron-store 文件加密）
saveConfig(key: string, value: any): void   // e.g. saveConfig('ui.theme', 'dark')
getConfig(key: string): any                 // e.g. getConfig('ui.theme')
deleteConfig(key: string): void
```

这些操作通过 `store:get` / `store:set` / `store:delete` IPC 通道暴露给渲染进程。
