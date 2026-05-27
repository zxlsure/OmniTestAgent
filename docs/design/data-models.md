# OmniTestAgent 数据模型文档

> 更新日期: 2026-05-23

---

## 1. ER 关系总览

```
Project (核心隔离单元)
  ├── TestFlowActivity (流程活动)
  ├── TestCase (测试用例)
  ├── KnowledgeBase (知识库)
  │     └── KnowledgeDocument (知识文档)
  │           └── DocumentChunk (文档分块, 向量存储)
  ├── ChatSession (对话会话)
  │     └── ChatMessage (对话消息)
  └── FlowReviewRecord (审核记录)

LlmConfig (全局单例)
McpConfig (全局单例)
Skill (技能)
ChannelConfig (渠道配置)
```

---

## 2. 项目与流程

### 2.1 Project（项目）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 项目唯一标识 |
| name | TEXT | NOT NULL, UNIQUE | 项目名称 (≤100字符) |
| description | TEXT | - | 项目描述 |
| status | TEXT | NOT NULL, DEFAULT 'active' | 状态: active/archived |
| created_at | TEXT | NOT NULL, ISO8601 | 创建时间 |
| updated_at | TEXT | NOT NULL, ISO8601 | 更新时间 |

**业务规则**：
- 项目名称不可为空且系统内唯一
- 删除操作需二次确认
- 切换项目时所有页面数据基于新项目刷新

### 2.2 TestFlowActivity（测试流程活动）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 活动唯一标识 |
| project_id | TEXT | FK→Project, NOT NULL | 所属项目 |
| activity_type | TEXT | NOT NULL, ENUM | 活动类型 |
| activity_order | INTEGER | NOT NULL | 流程顺序 (1-7) |
| status | TEXT | NOT NULL, DEFAULT 'idle' | 状态: idle/running/completed/failed |
| review_status | TEXT | NULL, ENUM | 审核状态: pending/approved/rejected |
| output | TEXT | - | 活动产出内容 |
| error_message | TEXT | - | 错误信息 |
| started_at | TEXT | - | 开始时间 |
| completed_at | TEXT | - | 完成时间 |
| created_at | TEXT | NOT NULL | 创建时间 |

**activity_type 枚举**：
1. `requirement_import` - 需求导入
2. `requirement_analysis` - 测试需求分析
3. `review_analysis` - 审核（需求分析后）
4. `test_design` - 测试设计
5. `review_design` - 审核（测试设计后）
6. `testcase_design` - 测试用例设计
7. `review_case` - 审核（用例设计后）
8. `script_generation` - 测试脚本生成
9. `script_debug` - 测试脚本调试

**业务规则**：
- 流程活动必须按固定顺序执行
- 审核环节禁止自动通过，必须人工确认
- 执行中活动支持打断，打断后状态回退为 idle，保留中间结果
- running 状态活动在应用重启后回退为 idle（断点恢复）

### 2.3 FlowReviewRecord（审核记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 记录唯一标识 |
| activity_id | TEXT | FK→TestFlowActivity | 关联活动 |
| reviewer | TEXT | NOT NULL | 审核人 (本地用户标识) |
| result | TEXT | NOT NULL | 审核结果: approved/rejected |
| comment | TEXT | - | 审核意见 |
| created_at | TEXT | NOT NULL | 审核时间 |

---

## 3. 测试用例

### 3.1 TestCase（测试用例）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 用例唯一标识 |
| project_id | TEXT | FK→Project, NOT NULL | 所属项目 |
| name | TEXT | NOT NULL | 用例名称 (≤200字符) |
| content | TEXT | NOT NULL | 用例步骤和预期结果 |
| priority | TEXT | NOT NULL, DEFAULT 'P1' | 优先级: P0/P1/P2/P3 |
| test_type | TEXT | DEFAULT 'functional' | 测试类型: functional/performance/security/compatibility/usability/reliability/interface |
| execution_status | TEXT | NOT NULL, DEFAULT 'not_run' | 执行状态: not_run/running/passed/failed/timeout |
| source_activity_id | TEXT | FK→TestFlowActivity | 生成该用例的活动ID |
| execution_log | TEXT | - | 执行日志 |
| created_at | TEXT | NOT NULL | 创建时间 |

---

## 4. 知识库

### 4.1 KnowledgeBase（知识库）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 知识库唯一标识 |
| project_id | TEXT | FK→Project, NOT NULL | 所属项目 |
| name | TEXT | NOT NULL | 知识库名称 (≤100字符) |
| description | TEXT | - | 描述 (≤500字符) |
| is_active | INTEGER | NOT NULL, DEFAULT 1 | 是否激活 |
| doc_count | INTEGER | NOT NULL, DEFAULT 0 | 文档数量 |
| chunk_size | INTEGER | DEFAULT 1000 | 分块大小 |
| chunk_overlap | INTEGER | DEFAULT 200 | 分块重叠 |
| vectorize_status | TEXT | NOT NULL, DEFAULT 'none' | 向量化状态: none/processing/completed/partial_failed |
| created_at | TEXT | NOT NULL | 创建时间 |

**约束**: unique(project_id, name)

### 4.2 KnowledgeDocument（知识文档）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 文档唯一标识 |
| knowledge_base_id | TEXT | FK→KnowledgeBase, NOT NULL | 所属知识库 |
| title | TEXT | NOT NULL | 文档名称 |
| file_path | TEXT | NOT NULL | 本地文件存储路径 |
| document_type | TEXT | NOT NULL, ENUM | 格式: pdf/word/markdown/txt |
| file_size | INTEGER | NOT NULL | 文件大小(字节, ≤50MB) |
| vectorize_status | TEXT | NOT NULL, DEFAULT 'pending' | 状态: pending/processing/completed/failed |
| chunk_count | INTEGER | DEFAULT 0 | 分块数量 |
| word_count | INTEGER | DEFAULT 0 | 字数 |
| created_at | TEXT | NOT NULL | 上传时间 |

### 4.3 DocumentChunk（文档分块）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 分块唯一标识 |
| document_id | TEXT | FK→KnowledgeDocument, NOT NULL | 所属文档 |
| chunk_index | INTEGER | NOT NULL | 分块序号 |
| content | TEXT | NOT NULL | 分块文本内容 |
| vector_id | TEXT | - | 向量数据库中的ID |
| embedding_hash | TEXT | - | 嵌入哈希 (变更检测) |
| start_index | INTEGER | - | 原文起始位置 |
| end_index | INTEGER | - | 原文结束位置 |
| page_number | INTEGER | - | 原文页码 |

**约束**: unique(document_id, chunk_index)

### 4.4 QueryLog（查询日志）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 日志唯一标识 |
| knowledge_base_id | TEXT | FK→KnowledgeBase | 知识库 |
| query | TEXT | NOT NULL | 查询文本 |
| response | TEXT | - | RAG 响应 |
| retrieved_chunks | TEXT | - | JSON: 检索到的文档块ID列表 |
| similarity_scores | TEXT | - | JSON: 相似度分数 |
| retrieval_time | REAL | - | 检索耗时(ms) |
| created_at | TEXT | NOT NULL | 查询时间 |

---

## 5. AI 对话

### 5.1 ChatSession（对话会话）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 会话唯一标识 |
| project_id | TEXT | FK→Project, NULL | 关联项目 |
| title | TEXT | NOT NULL | 会话标题 |
| total_input_tokens | INTEGER | DEFAULT 0 | 累计输入 Token |
| total_output_tokens | INTEGER | DEFAULT 0 | 累计输出 Token |
| request_count | INTEGER | DEFAULT 0 | 请求次数 |
| created_at | TEXT | NOT NULL | 创建时间 |
| updated_at | TEXT | NOT NULL | 更新时间 |

### 5.2 ChatMessage（对话消息）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 消息唯一标识 |
| session_id | TEXT | FK→ChatSession, NOT NULL | 所属会话 |
| role | TEXT | NOT NULL, ENUM | 角色: user/assistant/system/tool |
| content | TEXT | NOT NULL | 消息内容 |
| metadata | TEXT | - | JSON: 额外元数据 (工具调用信息等) |
| is_failed | INTEGER | DEFAULT 0 | 是否发送失败 |
| created_at | TEXT | NOT NULL | 创建时间 |

---

## 6. 配置管理

### 6.1 LlmConfig（LLM配置）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 配置ID (固定单例) |
| config_name | TEXT | NOT NULL | 配置名称 (≤50字符) |
| provider | TEXT | NOT NULL, DEFAULT 'openai_compatible' | 供应商: openai_compatible/qwen/openai/anthropic/azure/local |
| model_name | TEXT | NOT NULL | 模型名称 (≤100字符) |
| api_key | TEXT | NOT NULL, ENCRYPTED | API Key (加密存储) |
| api_url | TEXT | NOT NULL | API URL (必须HTTP/HTTPS) |
| system_prompt | TEXT | - | 系统提示词 |
| context_limit | INTEGER | DEFAULT 128000 | 上下文窗口限制 |
| request_timeout | INTEGER | DEFAULT 120 | 请求超时(秒) |
| max_retries | INTEGER | DEFAULT 3 | 最大重试次数 |
| enable_streaming | INTEGER | DEFAULT 1 | 启用流式 |
| enable_summarization | INTEGER | DEFAULT 0 | 启用上下文压缩 |
| connection_status | TEXT | DEFAULT 'untested' | 连接状态: untested/success/failed |
| updated_at | TEXT | NOT NULL | 更新时间 |

**业务规则**：
- 单例模式，系统中只有一个 LLM 配置
- API Key 加密存储，界面显示脱敏 (仅末尾4位)
- 连接测试未通过时禁止保存

**字段名统一说明**（渲染进程侧 camelCase，主进程侧 snake_case）：
- apiKey（渲染进程）→ 对应加密存储的 API Key
- baseUrl（渲染进程）→ 对应 api_url（数据库字段）
- modelName（渲染进程）→ 对应 model_name（数据库字段）

**Provider 默认 URL 映射**：

| Provider | 默认 URL |
|----------|---------|
| openai | https://api.openai.com/v1 |
| anthropic | https://api.anthropic.com/v1 |
| azure | https://{resource}.openai.azure.com/openai/deployments/{deployment} |
| local | http://localhost:11434/v1 |

### 6.2 McpConfig（MCP配置）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 配置ID (固定单例) |
| service_name | TEXT | NOT NULL | 服务名称 (≤100字符) |
| service_url | TEXT | NOT NULL | 服务URL (必须HTTP/HTTPS) |
| transport | TEXT | DEFAULT 'http_sse' | 传输协议: http_sse/stdio |
| connection_params | TEXT | - | JSON格式连接参数 |
| is_active | INTEGER | DEFAULT 1 | 是否激活 |
| connection_status | TEXT | DEFAULT 'untested' | 连接状态 |
| updated_at | TEXT | NOT NULL | 更新时间 |

**业务规则**：
- 支持连接测试
- 动态发现可用工具

### 6.3 Skill（技能）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK, UUID | 技能唯一标识 |
| name | TEXT | NOT NULL | 技能名称 (≤100字符) |
| description | TEXT | - | 描述 (≤500字符) |
| is_core | INTEGER | NOT NULL, DEFAULT 0 | 是否核心Skill |
| is_enabled | INTEGER | NOT NULL, DEFAULT 1 | 启用状态 |
| source | TEXT | NOT NULL, DEFAULT 'builtin' | 来源: builtin/imported |
| skill_path | TEXT | - | 技能模块路径 |
| config_schema | TEXT | - | JSON格式配置Schema |
| config_data | TEXT | - | JSON格式配置数据 |
| version | TEXT | DEFAULT '1.0.0' | 版本 |
| created_at | TEXT | NOT NULL | 创建时间 |

**业务规则**：
- 核心Skill不可全部同时禁用
- 导入的技能需验证格式
- 技能独立可插拔，启用/禁用不影响其他Skill

### 6.4 ChannelConfig（渠道配置）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 配置ID |
| channel_type | TEXT | NOT NULL, ENUM | 渠道类型: qqbot/welinkbot |
| connection_params | TEXT | NOT NULL | JSON格式连接参数 |
| is_enabled | INTEGER | DEFAULT 0 | 启用状态 |
| connection_status | TEXT | DEFAULT 'untested' | 连接状态 |
| updated_at | TEXT | NOT NULL | 更新时间 |

**业务规则**：
- QQbot 和 Welinkbot 配置相互独立
- 一方配置失败不影响另一方

---

## 7. 索引设计

```sql
-- 项目表索引
CREATE UNIQUE INDEX idx_project_name ON project(name);

-- 流程活动索引
CREATE INDEX idx_flow_activity_project ON test_flow_activity(project_id);
CREATE INDEX idx_flow_activity_type ON test_flow_activity(project_id, activity_type);

-- 测试用例索引
CREATE INDEX idx_test_case_project ON test_case(project_id);
CREATE INDEX idx_test_case_status ON test_case(project_id, execution_status);

-- 知识库索引
CREATE INDEX idx_knowledge_base_project ON knowledge_base(project_id);
CREATE INDEX idx_knowledge_doc_kb ON knowledge_document(knowledge_base_id);
CREATE INDEX idx_knowledge_doc_status ON knowledge_document(vectorize_status);
CREATE INDEX idx_doc_chunk_doc ON document_chunk(document_id);

-- 对话索引
CREATE INDEX idx_chat_session_project ON chat_session(project_id);
CREATE INDEX idx_chat_message_session ON chat_message(session_id);

-- 查询日志索引
CREATE INDEX idx_query_log_kb ON query_log(knowledge_base_id);
```

---

## 8. Agent 运行时数据模型

### 8.1 AgentEvent（Agent 流式事件）

| 字段 | 类型 | 说明 |
|------|------|------|
| type | ENUM | 事件类型：thinking \| content \| tool_call \| tool_result \| done \| error |
| data | object | 事件数据（各类型不同） |

**各类型 data 结构**：

| 事件类型 | data 字段 |
|---------|----------|
| thinking | `{ content: string }` |
| content | `{ content: string }` |
| tool_call | `{ id: string, name: string, args: string }` |
| tool_result | `{ id: string, name: string, result: string, status: 'success' \| 'failed' \| 'rejected' }` |
| done | `{ content: string, rounds: number }` |
| error | `{ code: string, message: string, retryable: boolean }` |

### 8.2 ToolCallStep（工具调用步骤）

| 字段 | 类型 | 说明 |
|------|------|------|
| toolCallId | string | 工具调用 ID |
| toolName | string | 工具名称 |
| parameters | string | JSON 格式参数 |
| status | ENUM | 状态：pending \| executing \| completed \| failed \| rejected |
| result | string? | 执行结果 |
| durationMs | number? | 执行耗时(ms) |

### 8.3 ApprovalPending（审批待决）

| 字段 | 类型 | 说明 |
|------|------|------|
| toolCallId | string | 工具调用 ID |
| toolName | string | 需审批的工具名 |
| parameters | object | 工具参数 |
| requestId | string | 审批请求 ID（格式：sessionId:toolCallId） |
