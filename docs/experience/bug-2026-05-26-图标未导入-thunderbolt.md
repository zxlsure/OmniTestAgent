# [BUG-006] 菜单图标 icon-thunderbolt 未导入

## 现象

左侧菜单中「测试执行」菜单项使用 `icon-thunderbolt` 图标，但 Arco Design Vue 图标包中未注册该图标，导致显示为空白方块。

## 根因分析

Arco Design Vue 的图标组件需单独注册（`app.use(ArcoVueIcon)`），但 `icon-thunderbolt` 不在默认图标集中，需要手动按需导入：

```typescript
import { IconThunderbolt } from '@arco-design/web-vue/es/icon'
app.component('IconThunderbolt', IconThunderbolt)
```

## 修复方案

1. 在 `src/renderer/main.ts` 中添加 `IconThunderbolt` 的按需导入
2. 或者在 `SideMenu.vue` 的 `<script setup>` 中局部导入

## 经验教训

- Arco Design Vue 图标库包含 300+ 图标，非所有图标都在默认注册范围内
- 使用非常见图标时必须确认其在 `@arco-design/web-vue/es/icon` 中的存在性
- 推荐做法：在 `main.ts` 中统一注册所有使用的非常见图标，或使用 `@arco-design/web-vue/es/icon` 的全量注册

## 影响范围

- 影响组件：`SideMenu.vue`
- 影响页面：所有页面的左侧菜单
- 修复优先级：P2（功能不受影响，仅视觉异常）
