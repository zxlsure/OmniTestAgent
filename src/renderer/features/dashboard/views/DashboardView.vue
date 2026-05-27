<template>
  <div class="dashboard-view">
    <a-row :gutter="16" class="stats-row">
      <a-col :span="6"><a-card><a-statistic title="项目数" :value="stats.projectCount" /></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="知识库数" :value="stats.kbCount" /></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="用例数" :value="stats.caseCount" /></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="执行次数" :value="stats.executionCount" /></a-card></a-col>
    </a-row>
    <a-row :gutter="16" style="margin-top: 16px">
      <a-col :span="12">
        <a-card title="测试流程进度">
          <a-empty v-if="!flowActivities.length" />
          <a-steps v-else :current="flowStepCurrent" small>
            <a-step v-for="act in flowActivities" :key="act.id" :title="act.activity_type" :status="getStepStatus(act.status)" />
          </a-steps>
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card title="最近活动">
          <a-empty v-if="!flowActivities.length" description="暂无活动记录" />
          <a-list v-else :data="flowActivities" size="small">
            <template #item="{ item }">
              <a-list-item>
                <a-list-item-meta :title="(item as any).activity_type" :description="(item as any).status">
                  <template #avatar>
                    <a-tag :color="(item as any).status === 'completed' ? 'green' : (item as any).status === 'running' ? 'blue' : (item as any).status === 'failed' ? 'red' : 'gray'" size="small">
                      {{ (item as any).status }}
                    </a-tag>
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProjectStore } from '@store/useProjectStore'

const projectStore = useProjectStore()
const stats = ref({ projectCount: 0, kbCount: 0, caseCount: 0, executionCount: 0 })
const flowActivities = ref<any[]>([])
const flowStepCurrent = ref(0)

function getStepStatus(status: string) {
  if (status === 'running') return 'process'
  if (status === 'completed') return 'finish'
  if (status === 'failed') return 'error'
  return 'wait'
}

onMounted(async () => {
  await projectStore.fetchProjects()
  if (projectStore.currentProject) {
    try {
      const result = await projectStore.getStats(projectStore.currentProject.id)
      stats.value = { projectCount: result.projectCount, kbCount: result.kbCount, caseCount: result.caseCount, executionCount: result.executionCount }
    } catch (e: unknown) {
      console.error('Failed to load project stats:', e)
      stats.value.projectCount = projectStore.projects.length
    }
    try {
      const activities = await window.electronAPI.testflow.getStatus(projectStore.currentProject.id)
      flowActivities.value = activities || []
      if (flowActivities.value.length > 0) {
        const completedCount = flowActivities.value.filter(a => a.status === 'completed').length
        flowStepCurrent.value = completedCount
      }
    } catch (e: unknown) {
      console.error('Failed to load flow status:', e)
    }
  } else {
    stats.value.projectCount = projectStore.projects.length
  }
})
</script>

<style scoped>
.dashboard-view { height: 100%; }
.stats-row { margin-bottom: 16px; }
</style>
