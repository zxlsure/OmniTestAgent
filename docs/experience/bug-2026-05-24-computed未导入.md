# BUG-003: ProjectSelector computed 未导入

## 现象
ProjectSelector 组件运行时 `computed is not defined` 错误。

## 根因分析
`ProjectSelector.vue` 的 `<script setup>` 中使用了 `computed(() => ...)` 但未从 `vue` 导入 `computed`。Vue 3 的 `<script setup>` 不会自动导入组合式 API（与 Vue 2 的 Options API 不同）。

## 修复方案
```typescript
// 修复前
import { ref, onMounted } from 'vue'
// 修复后
import { ref, computed, onMounted } from 'vue'
```

## 经验教训
1. **`<script setup>` 不提供自动导入**：所有使用的 Vue API 必须显式导入
2. **代码审查应检查导入完整性**：使用变量/函数前确认其在导入列表中
3. **考虑使用 unplugin-auto-import**：可自动导入 Vue API，但需额外配置

## 影响范围
- 文件：`src/renderer/components/layout/ProjectSelector.vue`
