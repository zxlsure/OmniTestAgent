# BUG-005: 重构后 preload 脚本未加载导致 electronAPI undefined

## 现象
重构后应用启动，渲染进程报错 `Cannot read properties of undefined (reading 'project')`，`window.electronAPI` 为 undefined。左侧菜单栏仅显示分组标题但无菜单项。

## 根因分析
`main.ts` 中 preload 路径使用了错误的上溯层级：

```typescript
// 错误：从 dist/main/ 上溯两级到项目根目录，然后找 preload/
preload: join(__dirname, '../../preload/index.js')
// 实际解析为：D:/zxl/OmniTestAgent/preload/index.js（不存在）

// 正确：从 dist/main/ 上溯一级到 dist/，然后找 preload/
preload: join(__dirname, '../preload/index.js')
// 实际解析为：D:/zxl/OmniTestAgent/dist/preload/index.js（正确）
```

`__dirname` 在编译后的 `dist/main/main.js` 中指向 `dist/main/` 目录，而非 `src/main/`。

同样的问题也存在于：
- `loadFile` 路径：`../../renderer/index.html` → `../renderer/index.html`
- `tray-icon` 路径：`../../../resources/` → `../../resources/`

## 修复方案
将所有相对路径的上溯层级从源码目录结构调整为编译输出目录结构：
- `../../preload/` → `../preload/`
- `../../renderer/` → `../renderer/`
- `../../../resources/` → `../../resources/`

## 经验教训
1. **编译后路径与源码路径不同**：tsc 编译后 `__dirname` 指向 `dist/main/`，不是 `src/main/`，计算相对路径必须基于 dist 目录结构
2. **重构时容易忽略路径问题**：目录结构变化后必须重新验证所有相对路径
3. **preload 不加载时症状**：`window.electronAPI` 为 undefined，所有 IPC 调用崩溃，但窗口仍能显示（因为 Vite dev server 正常返回 HTML）
4. **预防措施**：可以在 `createWindow` 后添加调试代码检查 preload 是否加载成功

## 影响范围
- 文件：`src/main/main.ts`（修复点）
- 影响：所有依赖 `window.electronAPI` 的功能
