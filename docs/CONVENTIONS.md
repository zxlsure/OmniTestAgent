# OmniTestAgent 项目规范

## 文档规范

### 设计文档（docs/design）
- 每次架构调整或优化后，必须同步刷新 `docs/design/` 下的设计文档
- 整体架构文档：`docs/design/architecture.md` — 包含目录结构、分层设计、模块职责、依赖关系
- 模块设计文档：`docs/design/modules/*.md` — 每个关键模块的详细设计（接口、数据流、错误处理）
- 文档需包含：设计意图、模块划分、关键接口定义、数据流向图

### Bug经验文档（docs/experience）
- 每个bug修复单独一个文件：`docs/experience/bug-YYYY-MM-DD-简述.md`
- 文件内容包含：现象、根因分析、修复方案、经验教训、影响范围
- 汇总目录：`docs/experience/README.md` — 列出所有bug修复记录，便于查询和渐进加载
- 每次bug修复后必须同步更新汇总目录

## 测试规范

### 测试代码（tests/）
- 每次优化或新增功能后，必须同步编写或更新测试代码
- 测试目录结构：
  - `tests/main/` — 主进程测试
  - `tests/renderer/` — 渲染进程测试
  - `tests/integration/` — 集成测试
- 每次优化后必须执行全部测试，确保无回归
- 测试命令：`npm test`

## 代码规范

### 分层架构
- IPC层 -> Service层 -> Repository层 -> Database层，严格单向依赖，禁止跨层调用
- 组件 -> Store -> IPC，渲染进程严格单向数据流

### 类型安全
- 禁止 `any` 类型，必须使用具体类型或泛型
- 禁止非空断言 `!`，必须使用显式空值检查
- IPC 参数和返回值必须定义请求/响应类型

### 异常处理
- 所有异步操作必须 try/catch
- Store 中的 IPC 调用必须通过统一的异常封装
- 资源（数据库、日志、子进程）必须在应用退出时正确释放

### 代码质量
- 单文件不超过 150 行（模板代码除外）
- 重复逻辑必须抽象为公共函数/类
- 死代码必须删除
- 业务规则不得放在数据层

## LLM 多 Provider 配置规范

### Provider 白名单

合法 Provider 值：`openai` | `anthropic` | `azure` | `local`

配置保存时必须校验 provider 是否在白名单内，非法值拒绝保存。

### 字段命名约定

- **渲染进程侧（camelCase）**：apiKey、baseUrl、modelName
- **主进程侧/数据库（snake_case）**：api_key、api_url、model_name
- 禁止在渲染进程侧使用 snake_case 字段名

### 默认 URL 映射规则

| Provider | 默认 URL |
|----------|---------|
| openai | https://api.openai.com/v1 |
| anthropic | https://api.anthropic.com/v1 |
| azure | https://{resource}.openai.azure.com/openai/deployments/{deployment} |
| local | http://localhost:11434/v1 |

新建 LLM 配置时，选择 Provider 后自动填充默认 URL，用户可修改。
