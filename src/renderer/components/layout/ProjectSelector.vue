<template>
  <a-select
    v-model="currentProjectId"
    placeholder="选择项目"
    allow-search
    style="width: 240px"
    @change="onProjectChange"
  >
    <a-option v-for="p in projects" :key="p.id" :value="p.id" :label="p.name" />
  </a-select>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@store/useProjectStore'

const projectStore = useProjectStore()
const router = useRouter()
const projects = computed(() => projectStore.projects)
const currentProjectId = ref<string>('')

onMounted(async () => {
  await projectStore.fetchProjects()
  if (projectStore.currentProject) {
    currentProjectId.value = projectStore.currentProject.id
  }
})

watch(() => projectStore.currentProject, (newProject) => {
  if (newProject) {
    currentProjectId.value = newProject.id
  }
})

async function onProjectChange(id: string) {
  await projectStore.switchProject(id)
  const currentRoute = router.currentRoute.value
  await router.replace({ path: currentRoute.path, query: { ...currentRoute.query, _t: String(Date.now()) } })
}
</script>
