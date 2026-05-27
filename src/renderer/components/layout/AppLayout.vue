<template>
  <a-layout class="app-layout">
    <TopNavBar />
    <a-layout>
      <SideMenu />
      <a-layout-content class="main-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import TopNavBar from './TopNavBar.vue'
import SideMenu from './SideMenu.vue'
</script>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
}
.main-content {
  padding: 16px;
  overflow-y: auto;
  background: var(--color-bg);
}
</style>
