# OmniTestAgent 关键流程交互设计

> 更新日期: 2026-05-23

---

## 1. AI 对话流程

### 1.1 正常对话流程

```
用户                              Renderer                     Main Process                    LLM Service
 │                                  │                            │                              │
 │──输入消息──→                     │                            │                              │
 │                                  │──llm:streamChat()──→       │                              │
 │                                  │                            │──获取LlmConfig──→            │
 │                                  │                            │←──返回配置──────             │
 │                                  │                            │                              │
 │                                  │                            │──注入项目上下文──→            │
 │                                  │                            │  (ProjectService)            │
 │                                  │                            │                              │
 │                                  │                            │──可选: RAG检索──→            │
 │                                  │                            │  (HybridRetriever)           │
 │                                  │                            │←──返回知识片段──             │
 │                                  │                            │                              │
 │                                  │                            │──构建Prompt──                │
 │                                  │                            │  (system+context+RAG+msg)    │
 │                                  │                            │                              │
 │                                  │                            │──SSE请求──────────────→      │
 │                                  │                            │                              │
 │                                  │                            │←──chunk1(stream)────         │
 │                                  │←──llm:streamChunk──        │                              │
 │←──实时追加渲染──                 │                            │                              │
 │                                  │                            │←──chunk2(stream)────         │
 │                                  │←──llm:streamChunk──        │                              │
 │←──实时追加渲染──                 │                            │                              │
 │                                  │                            │                              │
 │                                  │                            │←──stream_end────────         │
 │                                  │←──llm:streamEnd──          │                              │
 │                                  │                            │──持久化消息──→               │
 │                                  │                            │  (ChatRepo)                  │
 │←──对话完成──                     │                            │                              │
```

### 1.2 LLM未配置场景

```
用户 → 尝试发送消息
  → ChatInput.vue 检查 llmConfigured
  → llmConfigured = false
  → 显示提示 "请先在LLM配置中配置服务"
  → 发送按钮禁用
```

### 1.3 LLM调用失败场景

```
用户 → 发送消息
  → Main Process: LlmService.streamChat()
  → HTTP请求失败 (超时/网络错误)
  → 返回错误信息
  → Renderer: 消息标记为发送失败 (is_failed = 1)
  → 显示 "LLM服务连接失败，请检查配置"
  → 用户消息保留，可重试
```

---

## 2. 测试流程执行流程

### 2.1 正常流程执行

```
测试工程师          Renderer              Main Process          SkillEngine          LLM/MCP
   │                  │                      │                    │                   │
   │──点击执行──→     │                      │                    │                   │
   │                  │──testflow:execute()──→│                    │                   │
   │                  │                      │──校验流程顺序──→   │                   │
   │                  │                      │  (前序活动已完成？) │                   │
   │                  │                      │                    │                   │
   │                  │                      │──更新状态running──→│                   │
   │                  │←──progress事件────   │                    │                   │
   │←──显示运行图标── │                      │                    │                   │
   │                  │                      │                    │                   │
   │                  │                      │──选择Skill──→      │                   │
   │                  │                      │                    │──execute()──→     │
   │                  │                      │                    │──调用LLM/MCP──→   │
   │                  │                      │                    │←──推理结果────    │
   │                  │                      │                    │                   │
   │                  │                      │←──progress事件──   │                   │
   │←──更新进度──     │                      │                    │                   │
   │                  │                      │                    │                   │
   │                  │                      │←──SkillResult──    │                   │
   │                  │                      │──保存产出──→       │                   │
   │                  │                      │──更新状态completed │                   │
   │                  │←──statusChange事件── │                    │                   │
   │←──显示完成图标── │                      │                    │                   │
```

### 2.2 审核流程

```
测试负责人          Renderer              Main Process
   │                  │                      │
   │──查看审核内容──→ │                      │
   │                  │──展示活动产出──      │
   │←──显示产出──     │                      │
   │                  │                      │
   │──审核通过──→     │                      │
   │                  │──testflow:review()──→│
   │                  │                      │──更新审核状态──→
   │                  │                      │──解锁下一活动──→
   │                  │←──statusChange────   │
   │←──下一活动解锁── │                      │
```

```
测试负责人          Renderer              Main Process
   │                  │                      │
   │──审核驳回──→     │                      │
   │                  │──testflow:review()──→│
   │                  │                      │──更新审核状态──→
   │                  │                      │  (保持当前环节)
   │                  │←──statusChange────   │
   │←──提示驳回原因── │                      │
```

### 2.3 打断执行流程

```
测试工程师          Renderer              Main Process          SkillEngine
   │                  │                      │                    │
   │──点击打断──→     │                      │                    │
   │                  │──testflow:interrupt()→│                    │
   │                  │                      │──AbortController──→│
   │                  │                      │                    │──中止执行──
   │                  │                      │←──已中止──────────│
   │                  │                      │──保存中间结果──→   │
   │                  │                      │──状态回退idle──→   │
   │                  │←──statusChange────   │                    │
   │←──活动状态idle── │                      │                    │
   │←──中间结果保留── │                      │                    │
```

### 2.4 流程顺序校验失败

```
用户 → 尝试执行尚未到达顺序位置的活动
  → Main: TestFlowOrchestrator.execute()
  → canExecute() = false
  → 抛出 FlowOrderError
  → Renderer: 显示 "该活动尚未到达执行条件，禁止执行"
```

---

## 3. 知识库管理流程

### 3.1 文档上传与向量化

```
系统管理员        Renderer              Main Process          EmbeddingMgr         VectorStore
   │                │                      │                    │                   │
   │──上传文档──→   │                      │                    │                   │
   │                │──knowledge:upload()──→│                    │                   │
   │                │                      │──校验文件类型──→   │                   │
   │                │                      │  (禁止可执行文件)  │                   │
   │                │                      │──校验文件大小──→   │                   │
   │                │                      │  (≤50MB)           │                   │
   │                │                      │                    │                   │
   │                │                      │──保存文件──→       │                   │
   │                │                      │  (FileStore)       │                   │
   │                │                      │                    │                   │
   │                │                      │──创建Document记录──│                   │
   │                │                      │  (status: pending) │                   │
   │←──上传成功──   │                      │                    │                   │
   │                │                      │                    │                   │
   │                │                      │──触发向量化──→     │                   │
   │                │                      │                    │──文档解析──→      │
   │                │                      │                    │  (PDF/Word/MD)    │
   │                │                      │                    │──文本分块──→      │
   │                │                      │                    │──嵌入生成──→      │
   │                │                      │                    │  (API/本地)       │
   │                │                      │                    │──存入向量库──→    │
   │                │                      │                    │                   │──upsert()──→
   │                │                      │                    │                   │←──OK──────
   │                │                      │                    │←──完成────────    │
   │                │                      │←──向量化完成──     │                   │
   │←──状态更新──   │                      │                    │                   │
```

### 3.2 语义检索流程

```
用户 → 输入检索关键词
  → Renderer: knowledge.search({kbId, query, topK})
  → Main: HybridRetriever.search()
    → 查询嵌入 → EmbeddingManager.embed(query)
    → Dense检索 → VectorStore.search(vector)
    → Sparse检索 → BM25打分
    → RRF融合排序
    → 可选: Reranker精排
    → 返回 Top-K 结果
  → Renderer: SearchResultList.vue 展示结果 (相关度+来源+摘要)
```

### 3.3 文档上传异常场景

```
用户上传超过50MB文件:
  → FileSizeExceedError → 提示 "文件大小超过限制"

用户上传.exe文件:
  → FileTypeForbiddenError → 提示 "不支持该文件类型"

文档内容为空/格式损坏:
  → 向量化失败 → Document.status = failed → 提示 "文档向量化失败，请检查文档内容"
```

---

## 4. LLM/MCP 配置流程

### 4.1 LLM配置与连接测试

```
系统管理员        Renderer              Main Process          LLM Service
   │                │                      │                    │
   │──填写配置──→   │                      │                    │
   │                │                      │                    │
   │──连接测试──→   │                      │                    │
   │                │──llm:testConn()──→   │                    │
   │                │                      │──HTTP测试请求──────→│
   │                │                      │←──连接状态─────────│
   │                │←──testResult──────   │                    │
   │←──显示结果──   │                      │                    │
   │                │                      │                    │
   │  (连接成功)    │                      │                    │
   │──保存配置──→   │                      │                    │
   │                │──llm:saveConfig()──→ │                    │
   │                │                      │──加密API Key──→    │
   │                │                      │──持久化配置──→     │
   │←──保存成功──   │                      │                    │
```

```
连接失败场景:
  → 连接状态 = failed
  → 保存按钮禁用
  → 提示 "连接测试未通过，无法保存"

API Key无效:
  → 连接测试返回认证失败
  → 提示 "API Key无效，请检查后重试"
```

### 4.2 MCP配置与工具发现

```
系统管理员        Renderer              Main Process          MCP Service
   │                │                      │                    │
   │──填写MCP配置──→│                      │                    │
   │──连接测试──→   │                      │                    │
   │                │──mcp:testConn()──→   │                    │
   │                │                      │──HTTP测试──────────→│
   │                │                      │←──连接状态─────────│
   │←──显示结果──   │                      │                    │
   │                │                      │                    │
   │──保存并发现工具→│                      │                    │
   │                │──mcp:listTools()──→  │                    │
   │                │                      │──GET /tools───────→│
   │                │                      │←──工具列表─────────│
   │←──显示工具──   │                      │                    │
```

---

## 5. Skills管理流程

### 5.1 技能启用/禁用

```
系统管理员 → 切换Skill启用状态
  → Renderer: skill.toggle(skillId, enabled)
  → Main: SkillRegistry.toggle()
    → 校验: 若为核心Skill且为最后一个启用的 → 拒绝
    → 更新 Skill.is_enabled
  → Renderer: 刷新列表
```

### 5.2 技能导入

```
系统管理员 → 选择技能文件导入
  → Renderer: skill.importSkill(filePath)
  → Main: SkillLoader.loadImportedSkill()
    → 验证技能格式 (符合ISkill接口)
    → 若格式错误 → 提示 "技能格式错误，导入失败"
    → 注册到 SkillRegistry
    → 创建 Skill 记录 (source: 'imported', is_enabled: 1)
  → Renderer: 刷新列表
```

---

## 6. 渠道配置流程

### 6.1 QQbot配置

```
系统管理员 → 填写QQbot参数
  → Renderer: channel.configure('qqbot', config)
  → Main: ChannelManager.configure('qqbot', config)
    → QqBotClient.configure(config)
    → 持久化 ChannelConfig
  → Renderer: 状态更新
```

### 6.2 配置独立性

```
QQbot配置失败 → 仅影响QQbot，Welinkbot不受影响
Welinkbot配置失败 → 仅影响Welinkbot，QQbot不受影响

配置保存失败:
  → 记录错误日志
  → 不覆盖已有配置
  → 提示 "配置保存失败，请重试"
```

---

## 7. 应用启动与恢复流程

### 7.1 首次启动

```
Electron启动
  → Main Process: main.ts
    → 创建主窗口
    → 初始化SQLite数据库 (执行迁移)
    → 加载LlmConfig/McpConfig
    → 加载SkillRegistry (内置Skills)
    → 恢复ChannelManager (已配置的渠道)

  → Renderer Process: main.ts
    → 创建Vue App
    → useAppStore.initialize()
      → 检查LLM配置状态
      → 加载项目列表
      → 恢复上次选中的项目
    → 渲染首页仪表盘
```

### 7.2 异常重启恢复

```
应用重启
  → Main Process:
    → 数据库完整性检查
    → 断点恢复: running状态活动 → 回退为idle
    → 加载配置和Skills

  → Renderer Process:
    → 恢复项目上下文
    → 恢复对话历史 (ChatSession/ChatMessage)
    → 刷新所有页面数据
```

---

## 8. Agent 执行循环时序图

```
用户                    Renderer                  ChatAgentService          AgentExecutor           LlmService          ToolRegistry
 │                        │                           │                        │                       │                    │
 │──发送消息──→           │                           │                        │                       │                    │
 │                        │──chat:sendMessage──→      │                        │                       │                    │
 │                        │                           │──startChat()──→        │                       │                    │
 │                        │                           │                        │──getLlmClient()──→   │                    │
 │                        │                           │                        │←──client────────      │                    │
 │                        │                           │                        │──streamChat()──→     │                    │
 │                        │                           │                        │                       │                    │
 │                        │                           │                        │←──chunk(reasoning)── │                    │
 │                        │←──agentEvent(thinking)──  │←──yield thinking────  │                       │                    │
 │                        │                           │                        │←──chunk(content)──── │                    │
 │                        │←──agentEvent(content)───  │←──yield content─────  │                       │                    │
 │                        │                           │                        │←──chunk(tool_calls)─ │                    │
 │                        │←──agentEvent(tool_call)── │←──yield tool_call──── │                       │                    │
 │                        │                           │                        │──executeTool()───────────────────────→│
 │                        │                           │                        │←──result─────────────────────────────│
 │                        │←──agentEvent(tool_result)─│←──yield tool_result── │                       │                    │
 │                        │                           │                        │                       │                    │
 │                        │                           │                        │←──finish_reason:stop─│                    │
 │                        │←──agentEvent(done)──────  │←──yield done───────── │                       │                    │
```

---

## 9. Chat↔流水线联动时序图

```
用户                    Renderer                  ChatAgentService          AgentExecutor          ToolRegistry         TestFlowPipelineService
 │                        │                           │                        │                       │                    │
 │──"分析需求"──→        │                           │                        │                       │                    │
 │                        │──chat:sendMessage──→      │                        │                       │                    │
 │                        │                           │──startChat()──→        │                       │                    │
 │                        │                           │                        │──LLM调用─────────→   │                    │
 │                        │                           │                        │←──tool_call──────────│                    │
 │                        │←──agentEvent(tool_call)── │                        │                       │                    │
 │                        │                           │                        │──executeTool()──→    │                    │
 │                        │                           │                        │                       │──getPipelineState()──→│
 │                        │                           │                        │                       │←──state──────────────│
 │                        │                           │                        │←──result─────────────│                    │
 │                        │←──agentEvent(tool_result)─│                        │                       │                    │
 │                        │                           │                        │                       │──updateStepStatus()──→│
 │                        │←──testflow:progress────── │                        │                       │                    │
```

---

## 10. 斜杠命令处理时序图

```
用户                    ChatInput.vue             useSlashCommand         useChatStore           ChatAgentService
 │                        │                           │                       │                       │
 │──输入"/analyze"──→   │                           │                       │                       │
 │                        │──onInputChange()──→       │                       │                       │
 │                        │                           │──显示命令菜单──       │                       │
 │──选择/analyze──→     │                           │                       │                       │
 │                        │──selectCommand()──→       │                       │                       │
 │                        │                           │──parseCommand()──→   │                       │
 │                        │                           │←──mappedTool=analyze_requirement──│            │
 │                        │──sendMessage()──→         │                       │──chat:sendMessage──→ │
 │                        │                           │                       │                       │──LLM调用analyze_requirement──→
```

---

## 11. @文件引用处理时序图

```
用户                    Renderer                  ChatAgentService          AgentExecutor          FileOperationService
 │                        │                           │                        │                       │
 │──"分析 @req.md"──→   │                           │                        │                       │
 │                        │──chat:sendMessage──→      │                        │                       │
 │                        │                           │──startChat()──→        │                       │
 │                        │                           │                        │──resolveFileReferences()──→│
 │                        │                           │                        │                       │──getProjectDir()──→│
 │                        │                           │                        │                       │──findFile("req.md")──→│
 │                        │                           │                        │                       │──readFileSync()──→│
 │                        │                           │                        │←──resolvedMessage────│                       │
 │                        │                           │                        │  (文件内容+原始消息)  │                       │
```

---

## 12. 审批机制时序图

```
用户                    Renderer                  ChatAgentService          AgentExecutor          ToolRegistry
 │                        │                           │                        │                       │
 │                        │                           │                        │──tool_call(需审批)──→│
 │                        │←──approvalRequest──────── │←──requestToolApproval─│                       │
 │                        │                           │                        │  (等待resolve)        │
 │──批准──→              │                           │                       │                       │
 │                        │──approvalResponse(true)──→│                       │                       │
 │                        │                           │──approveToolCall()──→  │←──resolve(true)──────│
 │                        │                           │                        │──executeTool()──→   │
 │                        │←──agentEvent(tool_result)─│←──yield tool_result── │                       │
 │                        │                           │                        │                       │
 │  [或拒绝]              │                           │                       │                       │
 │──拒绝──→              │                           │                       │                       │
 │                        │──approvalResponse(false)─→│                       │                       │
 │                        │                           │──approveToolCall()──→  │←──resolve(false)─────│
 │                        │←──agentEvent(tool_result)─│←──yield tool_result── │  (status: rejected)   │
```
