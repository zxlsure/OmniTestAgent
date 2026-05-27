# Bug 经验汇总

## 2026-05-24 批次

### [BUG-001] 渲染进程白屏
- 文件：[bug-2026-05-24-白屏问题.md](./bug-2026-05-24-白屏问题.md)
- 根因：index.html 中 script src 路径与 Vite root 配置不匹配
- 教训：Vite root 改变后必须同步修改 index.html 的相对路径

### [BUG-002] Arco Design 图标不显示
- 文件：[bug-2026-05-24-图标未导入.md](./bug-2026-05-24-图标未导入.md)
- 根因：未全局注册 `@arco-design/web-vue/es/icon` 图标包
- 教训：Arco Design Vue 图标组件需单独注册，不会随主包自动全局注册

### [BUG-003] ProjectSelector computed 未导入
- 文件：[bug-2026-05-24-computed未导入.md](./bug-2026-05-24-computed未导入.md)
- 根因：使用了 `computed` 但未从 vue 导入
- 教训：Vue 3 `<script setup>` 不会自动导入组合式 API

### [BUG-004] dev.js 端口检测失败导致双启动
- 文件：[bug-2026-05-24-dev端口检测.md](./bug-2026-05-24-dev端口检测.md)
- 根因：Vite 输出含 ANSI 转义码，URL 正则匹配失败；超时回退未检查 Electron 是否已启动
- 教训：解析终端输出时必须剥离 ANSI 转义码；防重入需要标志位

---

## 架构审查发现（2026-05-24）

### [BUG-005] 重构后 preload 路径错误导致 electronAPI undefined
- 文件：[bug-2026-05-24-preload路径错误.md](./bug-2026-05-24-preload路径错误.md)
- 根因：tsc 编译后 __dirname 指向 dist/main/，preload 路径上溯层级应基于 dist 目录结构
- 教训：编译后路径与源码路径不同，重构目录结构后必须重新验证相对路径

---

## 架构审查发现（2026-05-24）

### [ARCH-001] any 类型泛滥
- 文件：[arch-2026-05-24-any类型泛滥.md](./arch-2026-05-24-any类型泛滥.md)
- 主进程 40+ 处 any，渲染进程 20+ 处 any
- 核心：useIpc.ts 全局 any 污染整个调用链

### [ARCH-002] 分层架构被破坏
- 文件：[arch-2026-05-24-分层破坏.md](./arch-2026-05-24-分层破坏.md)
- IPC->Data 跨层、Service->Data 跨层、Repository 跨领域

### [ARCH-003] 资源泄漏
- 文件：[arch-2026-05-24-资源泄漏.md](./arch-2026-05-24-资源泄漏.md)
- closeDatabase() 从未调用、logger.init() 从未调用、子进程无清理

### [ARCH-004] 重复代码
- 文件：[arch-2026-05-24-重复代码.md](./arch-2026-05-24-重复代码.md)
- 4个Skill模板重复、2个Bot客户端重复、3个ConfigRepo upsert重复

### [ARCH-005] 异常处理缺失
- 文件：[arch-2026-05-24-异常处理缺失.md](./arch-2026-05-24-异常处理缺失.md)
- 几乎所有 Store 的 IPC 调用无 try/catch，主进程多处非空断言

---

## 2026-05-26 批次

### [BUG-006] 菜单图标 icon-thunderbolt 未导入
- 文件：[bug-2026-05-26-图标未导入-thunderbolt.md](./bug-2026-05-26-图标未导入-thunderbolt.md)
- 根因：icon-thunderbolt 不在 Arco Design Vue 默认图标集中，需按需导入
- 教训：非常用 Arco 图标必须确认注册方式，推荐全量注册或按需显式导入

### [BUG-007] vitest vi.mock 工厂函数引用外部变量导致 hoisting 顺序错误
- 文件：[bug-2026-05-26-vitest-mock-hoisting.md](./bug-2026-05-26-vitest-mock-hoisting.md)
- 根因：`vi.mock` 工厂函数被 hoisted 到文件顶部，引用的 `const mockXxx = vi.fn()` 初始化顺序无法保证
- 教训：必须用 `vi.hoisted()` 声明 mock 函数，不能在 `vi.mock` 工厂中引用同文件的 `const` 变量

### [BUG-008] vitest vi.mock 路径层级错误导致 mock 未生效
- 文件：[bug-2026-05-26-vitest-mock-path.md](./bug-2026-05-26-vitest-mock-path.md)
- 根因：测试文件目录深度不同，`vi.mock` 路径层级计算错误，mock 未命中真实模块
- 教训：写 `vi.mock` 路径前先确认测试文件到项目根的相对级数，可用 `path.resolve()` 验证
