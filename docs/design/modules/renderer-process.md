# 渲染进程模块设计

## 修改历史

| 日期       | 版本  | 描述         | 作者  |
| ---------- | ----- | ------------ | ----- |
| 2026-05-24 | v1.0  | 初始版本     | CodeArts |

---

## 1. Vue 应用架构

### 1.1 应用入口 `main.ts`

```typescript
const app = createApp(App)
app.use(createPinia())      // 状态管理
app.use(router)             // 路由
app.use(ArcoVue)            // Arco Design 组件库
app.use(ArcoVueIcon)        // Arco Design 图标
app.mount('#app')
```

### 1.2 根组件 `App.vue`

```vue
<template>
  <router-view />
</template>
```

仅作为路由出口，布局由 `AppLayout.vue` 在路由配置中提供。

### 1.3 技术选型

| 技术             | 用途                     |
| ---------------- | ------------------------ |
| Vue 3            | Composition API + SFC    |
| Pinia            | 状态管理（Setup 风格）  |
| Vue Router       | Hash 模式路由            |
| Arco Design Vue  | UI 组件库 + 图标库       |
| TailwindCSS v4   | 原子化 CSS              |
| ECharts          | 图表（Dashboard）       |
| marked           | Markdown 渲染            |
| highlight.js     | 代码高亮                 |

---

## 2. 路由设计

### 2.1 路由配置

路由采用 **Hash 模式** + **嵌套路由** 结构，外层 `AppLayout` 提供全局布局：

```typescript
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@components/layout/AppLayout.vue'),
    children: [ /* 11 条子路由 */ ]
  }
]
```

### 2.2 路由表（即菜单数据源）

| 路径           | name          | 标题         | 图标                | 分组       |
| -------------- | ------------- | ------------ | ------------------- | ---------- |
| `/`            | `dashboard`   | 首页         | `icon-dashboard`    | business   |
| `/project`     | `project`     | 项目管理     | `icon-apps`         | business   |
| `/chat`        | `chat`        | AI对话       | `icon-message`      | business   |
| `/testflow`    | `testflow`    | 测试设计     | `icon-thunder`      | business   |
| `/execution`   | `execution`   | 测试执行     | `icon-play-circle`  | business   |
| `/knowledge`   | `knowledge`   | 知识库管理   | `icon-book`         | business   |
| `/llm-config`  | `llm-config`  | LLM配置      | `icon-bulb`         | system     |
| `/mcp-config`  | `mcp-config`  | MCP配置      | `icon-link`         | system     |
| `/skills`      | `skills`      | Skills管理    | `icon-mind-mapping` | system     |
| `/channels`    | `channels`    | Channels配置 | `icon-notification` | system     |
| `/:pathMatch(.*)*` | `not-found` | 404 (fallback to Dashboard) | — | — |

**设计要点**：
- `meta.group` 分为 `business`（业务功能）和 `system`（系统配置），驱动 `SideMenu` 分组渲染
- `meta.icon` 对应 Arco Design 图标名，驱动菜单图标
- 404 路由 fallback 到 DashboardView
- 所有路由均为懒加载（`() => import(...)`）

---

## 3. Store 设计

9 个 Pinia Store，全部使用 **Composition API (Setup) 风格**：

```typescript
export const useXxxStore = defineStore('xxx', () => {
  // ref() → state
  // function → action
  // computed → getter
  return { /* 暴露的 API */ }
})
```

### 3.1 Store 清单

| Store               | 模块名       | 状态                              | 关键 Action                                       |
| ------------------- | ------------ | --------------------------------- | ------------------------------------------------- |
| `useAppStore`       | `app`        | `initialized`, `llmConnected`     | `initialize()` — 检查 LLM 连接状态               |
| `useProjectStore`   | `project`    | `projects[]`, `currentProject`    | `fetchProjects`, `createProject`, `deleteProject`, `switchProject`, `getStats` |
| `useChatStore`      | `chat`       | `sessions[]`, `currentSessionId`, `messages[]`, `streaming` | `fetchSessions`, `sendMessage`, `createSession` |
| `useKnowledgeStore` | `knowledge`  | `bases[]`, `currentBaseId`, `documents[]`, `searchResults[]` | `fetchBases`, `fetchDocuments`, `createBase`, `search` |
| `useLlmConfigStore` | `llmConfig`  | `config`, `testing`, `testResult` | `fetchConfig`, `testConnection`, `saveConfig`     |
| `useMcpConfigStore` | `mcpConfig`  | `config`, `tools[]`               | `fetchConfig`, `fetchTools`, `testConnection`, `saveConfig` |
| `useSkillStore`     | `skill`      | `skills[]`                        | `fetchSkills`, `toggleSkill`                      |
| `useChannelStore`   | `channel`    | `qqConfig`, `welinkConfig`        | `fetchConfig`, `configure`, `test`                |
| `useTestFlowStore`  | `testFlow`   | `activities[]`, `selectedActivityId`, `loading` | `fetchStatus`, `executeActivity`, `interruptActivity`, `reviewActivity` |

### 3.2 Store 通信模式

```
Vue Component
  → Store.action(params)
    → window.electronAPI.domain.method(params)  // IPC 调用
    → 更新 Store state                           // 响应式更新
    → Vue Component 自动重渲染
```

### 3.3 ChatStore 流式对话机制

```typescript
async function sendMessage(sessionId, content) {
  streaming.value = true
  // 1. 添加用户消息
  messages.value.push({ role: 'user', content })
  // 2. 监听流式 chunk
  window.electronAPI.llm.onStreamChunk((_event, chunk) => {
    // 追加到 assistant 消息
  })
  // 3. 监听流式结束
  window.electronAPI.llm.onStreamEnd(() => {
    window.electronAPI.llm.removeStreamListeners()
  })
  // 4. 发起流式请求
  await window.electronAPI.llm.streamChat({ sessionId, message: content })
  streaming.value = false
}
```

### 3.4 useChatStore Agent 事件处理

`handleAgentEvent(event: AgentEvent)` 处理 6 种 Agent 事件：

| 事件类型 | 处理逻辑 |
|---------|---------|
| thinking | 追加到 `msg.thinking`，`agentPhase = 'thinking'` |
| content | 追加到 `msg.content`，`agentPhase = 'result_organize'` |
| tool_call | 创建 `ToolCallStep` 追加到 `msg.toolCalls`，`agentPhase = 'tool_call'` |
| tool_result | 更新对应 `ToolCallStep` 的 result/status/durationMs |
| done | `msg.status = 'completed'`，`streaming = false`，`agentPhase = 'done'` |
| error | `msg.status = 'error'`，设置 error 消息，`streaming = false` |

流式超时检测：5s 无新事件触发，`msg.status = 'error'`，`error = '流式响应中断'`

### 3.5 useLlmConfigStore 多 Provider 配置

```typescript
const useLlmConfigStore = defineStore('llmConfig', () => {
  config: ref<LlmConfig | null>(null)
  testing: ref(false)
  testResult: ref<{ success: boolean; error?: string } | null>(null)
  fetchConfig()    // → window.electronAPI.llm.getConfig()
  testConnection(cfg)  // → window.electronAPI.llm.testConnection(cfg)
  saveConfig(cfg)   // → window.electronAPI.llm.saveConfig(cfg) + fetchConfig()
})
```

### 3.6 useSlashCommand composable

4 个斜杠命令（/analyze → analyze_requirement, /design → design_test, /cases → generate_cases, /script → generate_script），支持模糊过滤、键盘导航、命令解析。

---

## 4. 组件体系

### 4.1 布局组件

```
AppLayout.vue
├── TopNavBar.vue       — 顶部导航栏（标题栏覆盖层下）
├── SideMenu.vue        — 侧边菜单（由路由 meta 驱动）
└── <router-view />     — 页面内容区
```

**AppLayout.vue**：
```vue
<a-layout class="app-layout">
  <TopNavBar />
  <a-layout>
    <SideMenu />
    <a-layout-content class="main-content">
      <router-view />
    </a-layout-content>
  </a-layout>
</a-layout>
```

### 4.2 功能组件（10 个页面）

| 组件                          | 路由          | 功能         |
| ----------------------------- | ------------- | ------------ |
| `DashboardView.vue`           | `/`           | 首页仪表盘  |
| `ProjectManagementView.vue`   | `/project`    | 项目管理     |
| `ChatView.vue`                | `/chat`       | AI 对话      |
| `TestFlowView.vue`            | `/testflow`   | 测试设计流程 |
| `TestExecutionView.vue`       | `/execution`  | 测试执行     |
| `KnowledgeView.vue`           | `/knowledge`  | 知识库管理   |
| `LlmConfigView.vue`           | `/llm-config` | LLM 配置     |
| `McpConfigView.vue`           | `/mcp-config` | MCP 配置     |
| `SkillsView.vue`              | `/skills`     | Skills 管理  |
| `ChannelsView.vue`            | `/channels`   | Channels 配置 |

### 4.3 通用组件

| 组件                | 用途         |
| ------------------- | ------------ |
| `ConfirmDialog.vue` | 确认对话框   |
| `StatusIcon.vue`    | 状态图标     |

### 4.4 目录组织原则

功能组件按 **业务域** 组织在 `features/` 目录下：

```
features/
├── dashboard/views/DashboardView.vue
├── chat/views/ChatView.vue
├── testflow/views/TestFlowView.vue
└── ...每个功能一个目录，views/ 下放页面组件
```

---

## 5. Composables

### 5.1 useIpcCall

**用途**：封装 IPC 调用的 loading/error 状态管理。

```typescript
function useIpcCall<T>() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function execute(fn: () => Promise<T>): Promise<T | undefined> {
    loading.value = true
    error.value = null
    try { return await fn() }
    catch (e: unknown) { error.value = e instanceof Error ? e.message : String(e); return undefined }
    finally { loading.value = false }
  }

  return { loading, error, execute }
}
```

**使用示例**：
```typescript
const { loading, error, execute } = useIpcCall<Project[]>()
const projects = await execute(() => window.electronAPI.project.list())
```

### 5.2 useLoading

**用途**：通用的异步操作 loading/error 管理（不限定 IPC）。

```typescript
function useLoading() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function withLoading<T>(fn: () => Promise<T>): Promise<T | undefined> {
    loading.value = true; error.value = null
    try { return await fn() }
    catch (e: any) { error.value = e.message; return undefined }
    finally { loading.value = false }
  }

  return { loading, error, withLoading }
}
```

### 5.3 useNotification

**用途**：基于 Arco Design `Message` 的通知封装。

```typescript
function useNotification() {
  function success(content: string) { Message.success(content) }
  function error(content: string)   { Message.error(content) }
  function warning(content: string) { Message.warning(content) }
  function info(content: string)    { Message.info(content) }
  return { success, error, warning, info }
}
```

---

## 6. 类型系统

### 6.1 electron-api.d.ts — IPC 类型根基

该文件通过 `declare global` 扩展 `Window` 接口，为 `window.electronAPI` 提供完整类型定义：

```typescript
declare global {
  interface Window {
    electronAPI: {
      project: { list, create, update, delete, switch, getStats }
      llm:     { chat, streamChat, onStreamChunk, onStreamEnd, removeStreamListeners, testConnection, getConfig, saveConfig }
      knowledge: { listBases, createBase, deleteBase, uploadDoc, vectorize, search, listDocuments }
      mcp:     { callTool, testConnection, listTools, getConfig, saveConfig }
      skill:   { list, toggle, import, execute }
      channel: { configure, test, send, getConfig }
      testflow: { execute, interrupt, review, getStatus, onProgress, removeProgressListeners }
      store:   { get, set, delete }
    }
  }
}
```

**类型三角**：`electron-api.d.ts` → 引用各业务类型文件 → 业务类型文件与主进程 Repository 接口保持一致。

### 6.2 业务类型文件

| 文件           | 导出类型                                      | 对应主进程         |
| -------------- | --------------------------------------------- | ------------------ |
| `project.ts`   | `Project`                                     | `ProjectRepo`      |
| `chat.ts`      | `ChatSession`, `ChatMessage`                  | `ChatRepo`         |
| `knowledge.ts` | `KnowledgeBase`, `KnowledgeDocument`, `SearchResult` | `KnowledgeRepo` |
| `llm.ts`       | `LlmConfig`                                   | `LlmConfigRepo`    |
| `mcp.ts`       | `McpConfig`, `McpTool`                        | `McpConfigRepo`    |
| `skill.ts`     | `SkillRecord`                                 | `SkillRepo`        |
| `channel.ts`   | `ChannelConfig`                               | `ChannelConfigRepo`|
| `testflow.ts`  | `FlowActivity`, `ACTIVITY_TYPES`              | `FlowActivityRepo` |

### 6.3 类型一致性保证

渲染进程的类型定义与主进程 Repository 导出的 interface 保持字段一致，确保 IPC 传输的类型安全。两端需人工同步维护。

---

## 7. 工具函数

### 7.1 constants.ts

```typescript
export const ACTIVITY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  idle: { label: '未启动', color: '#86909c' },
  running: { label: '执行中', color: '#165dff' },
  completed: { label: '已完成', color: '#00b42a' },
  failed: { label: '失败', color: '#f53f3f' }
}
export const MAX_FILE_SIZE = 50 * 1024 * 1024          // 50MB
export const SUPPORTED_FILE_TYPES = ['.pdf', '.doc', '.docx', '.md', '.txt']
export const FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.dll', '.so', '.app']
```

### 7.2 formatter.ts

```typescript
export function formatDate(date: string | Date): string      // → zh-CN 格式
export function formatFileSize(bytes: number): string        // → B/KB/MB
export function formatNumber(n: number): string              // → zh-CN 千分位
export function formatDuration(ms: number): string           // → ms/s/m s
```

### 7.3 validator.ts

```typescript
export function validateRequired(value, label): string | null   // 必填校验
export function validateNameUnique(name, existingNames): string | null  // 唯一性校验
export function validateUrl(url): string | null                 // URL 格式校验
export function validateApiKey(key): string | null              // API Key 格式校验
```

---

## 8. 异常处理策略

### 8.1 渲染进程异常处理层级

```
┌─────────────────────────────────────────────────────┐
│ 1. Composable 层                                    │
│    useIpcCall / useLoading 捕获异步异常             │
│    → 设置 error ref，返回 undefined                 │
├─────────────────────────────────────────────────────┤
│ 2. Store 层                                         │
│    每个 action 内 try/catch 包裹 IPC 调用           │
│    → console.error 记录，不向上抛出                 │
│    → 操作失败时返回 undefined                       │
├─────────────────────────────────────────────────────┤
│ 3. 通知层                                           │
│    useNotification 向用户展示错误消息               │
│    → 基于 Arco Design Message.error()               │
└─────────────────────────────────────────────────────┘
```

### 8.2 主进程异常处理层级

```
┌─────────────────────────────────────────────────────┐
│ 1. IPC helpers 层                                   │
│    registerIpcHandler 统一 try/catch                 │
│    → logger.error 记录                              │
│    → throw error（返回给渲染进程）                   │
├─────────────────────────────────────────────────────┤
│ 2. Service 层                                       │
│    业务异常直接抛出 Error                           │
│    → 含业务语义的错误消息（中文）                    │
├─────────────────────────────────────────────────────┤
│ 3. 应用启动层                                       │
│    main.ts 的 app.whenReady() 包裹 try/catch        │
│    → 启动失败时 app.quit()                          │
└─────────────────────────────────────────────────────┘
```

### 8.3 流式通信异常处理

- LLM 流式输出：`streamChat` 内异常由 Service 层处理，流中断后渲染进程 `finally` 块清理监听器
- TestFlow 进度推送：`execute` 内异常更新状态为 `failed`，推送错误进度
- 渲染进程 `removeStreamListeners` / `removeProgressListeners` 确保监听器不泄漏
