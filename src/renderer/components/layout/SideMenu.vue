<template>
  <a-layout-sider class="side-menu" :width="220">
    <div class="menu-group">
      <div class="group-label">业务功能</div>
      <a-menu :selected-keys="selectedKeys" @menu-item-click="onMenuClick" auto-open>
        <a-menu-item v-for="item in businessItems" :key="item.name">
          <template #icon><component :is="item.icon" /></template>
          {{ item.label }}
        </a-menu-item>
      </a-menu>
    </div>
    <div class="menu-group">
      <div class="group-label">系统配置</div>
      <a-menu :selected-keys="selectedKeys" @menu-item-click="onMenuClick">
        <a-menu-item v-for="item in systemItems" :key="item.name">
          <template #icon><component :is="item.icon" /></template>
          {{ item.label }}
        </a-menu-item>
      </a-menu>
    </div>
  </a-layout-sider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

interface MenuItem {
  name: string
  label: string
  icon: string
  group: string
}

const router = useRouter()
const route = useRoute()

const menuItems = computed<MenuItem[]>(() => {
  return router.getRoutes()
    .filter(r => r.meta?.group && r.meta?.title && r.meta?.icon && r.name)
    .map(r => ({
      name: r.name as string,
      label: r.meta!.title as string,
      icon: r.meta!.icon as string,
      group: r.meta!.group as string
    }))
})

const businessItems = computed(() => menuItems.value.filter(i => i.group === 'business'))
const systemItems = computed(() => menuItems.value.filter(i => i.group === 'system'))
const selectedKeys = computed(() => [route.name as string])

function onMenuClick(key: string) {
  router.push({ name: key })
}
</script>

<style scoped>
.side-menu {
  background: var(--color-bg-container);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
}
.menu-group { padding: 8px 0; }
.group-label {
  padding: 8px 20px;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}
</style>
