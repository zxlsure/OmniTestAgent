# Bug: vitest vi.mock 路径层级错误导致 mock 未生效

**日期**: 2026-05-26
**严重度**: 高（导致真实模块被加载，触发 Database not initialized 错误）

## 现象

`vi.mock` 指定了模块路径，但路径层级不对，导致 mock 未替换真实模块。真实模块被加载时执行模块级 side-effect（`new XxxRepo()` → `db()` → `getDatabase()` 抛出 "Database not initialized" 错误）。

## 根因

测试文件位于 `tests/main/services/XxxService.test.ts`，需要往上 **3级** 到项目根目录，然后 `src/main/...`。但错误地使用了 4 级（`../../../../src/main/...`），导致路径解析到 `D:/zxl/src/main/...`，mock 未命中。

而 `tests/main/services/chat/` 下的文件需要 **4级**（`../../../../src/main/...`），因为多了一层 `chat/` 目录。

## 修复

根据测试文件所在目录深度计算正确的相对路径：

| 测试文件目录 | 到项目根的级数 | mock 路径前缀 |
|---|---|---|
| `tests/main/services/` | 3 | `../../../src/main/...` |
| `tests/main/services/chat/` | 4 | `../../../../src/main/...` |
| `tests/main/utils/` | 3 | `../../../src/main/...` |
| `tests/renderer/store/` | 3 | `../../../src/renderer/...` |

## 经验

- 写 `vi.mock` 路径前，先确认测试文件到项目根的相对级数
- 可用 `path.resolve(path.dirname(testFilePath), mockPath)` 验证路径是否正确
- 路径错误时 vitest 不报错，只是 mock 不生效，真实模块被加载
