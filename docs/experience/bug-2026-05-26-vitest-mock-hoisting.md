# Bug: vitest vi.mock 工厂函数引用外部变量导致 hoisting 顺序错误

**日期**: 2026-05-26
**严重度**: 高（导致整个测试文件0 test collected）

## 现象

`vi.mock` 的工厂函数中引用了 `const mockXxx = vi.fn()` 声明的变量，运行时报：

```
ReferenceError: Cannot access 'mockAddMessage' before initialization
```

导致整个测试文件 0 test collected。

## 根因

`vi.mock` 调用会被 vitest hoisted 到文件顶部（在所有 import 之前），但 `const mockXxx = vi.fn()` 虽然也会被 hoisted，其初始化顺序无法保证在 `vi.mock` 工厂函数执行之前。

## 修复

使用 `vi.hoisted()` 声明 mock 函数，确保它们在 `vi.mock` 工厂函数执行前已经初始化：

```ts
// 错误写法
const mockAddMessage = vi.fn()
vi.mock('./ChatRepo', () => ({ chatRepo: { addMessage: mockAddMessage } }))

// 正确写法
const { mockAddMessage } = vi.hoisted(() => ({
  mockAddMessage: vi.fn()
}))
vi.mock('./ChatRepo', () => ({ chatRepo: { addMessage: mockAddMessage } }))
```

## 影响文件

- `tests/main/services/chat/agentExecutor.test.ts`
- `tests/main/services/chat/chatAgentService.test.ts`
- `tests/main/services/KnowledgeService.test.ts`
- `tests/main/services/LlmService.test.ts`

## 经验

- `vi.mock` 工厂函数中**不能**引用同文件用 `const`/`let`/`var` 声明的变量
- 必须用 `vi.hoisted()` 包裹 mock 函数声明
- 此规则适用于 vitest 2.x+ 版本
