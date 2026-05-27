<template>
  <a-layout-header class="top-nav-bar">
    <div class="nav-left">
      <span class="logo-text">OmniTestAgent</span>
    </div>
    <div class="nav-center">
      <ProjectSelector />
    </div>
    <div class="nav-right">
      <a-tooltip content="主题">
        <a-button type="text" size="mini" @click="toggleTheme">
          <template #icon><icon-moon v-if="!isDark" /><icon-sun v-else /></template>
        </a-button>
      </a-tooltip>
    </div>
  </a-layout-header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ProjectSelector from './ProjectSelector.vue'

const isDark = ref(document.body.getAttribute('arco-theme') === 'dark')

function toggleTheme() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.body.setAttribute('arco-theme', 'dark')
  } else {
    document.body.removeAttribute('arco-theme')
  }
}
</script>

<style scoped>
.top-nav-bar {
  height: var(--navbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--color-bg-container);
  border-bottom: 1px solid var(--color-border);
  z-index: 100;
}
.nav-left { display: flex; align-items: center; gap: 8px; }
.logo-text { font-size: 16px; font-weight: 700; color: var(--color-primary); }
.nav-center { flex: 1; display: flex; justify-content: center; }
.nav-right { display: flex; align-items: center; gap: 4px; }
</style>
