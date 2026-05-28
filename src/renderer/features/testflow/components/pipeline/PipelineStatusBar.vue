<template>
  <div class="pipeline-status-bar">
    <div class="pipeline-status-bar__progress">
      <span class="pipeline-status-bar__label">总进度</span>
      <a-progress
        :percent="(overallProgress ?? 0) / 100"
        size="small"
        :status="failedCount > 0 ? 'danger' : 'normal'"
      />
      <span class="pipeline-status-bar__value">{{ overallProgress ?? 0 }}%</span>
    </div>
    <div class="pipeline-status-bar__stats">
      <span class="pipeline-status-bar__stat">
        已完成 <strong>{{ completedCount }}</strong>/{{ totalSteps }}
      </span>
      <span
        v-if="failedCount > 0"
        class="pipeline-status-bar__stat pipeline-status-bar__stat--failed"
      >
        失败 <strong>{{ failedCount }}</strong>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { StepStatus, type PipelineStepState } from '@types/testflow-pipeline'

const props = defineProps<{
  steps: PipelineStepState[]
  overallProgress?: number
}>()

const totalSteps = computed(() => props.steps.length)
const completedCount = computed(() => props.steps.filter(s => s.status === StepStatus.COMPLETED).length)
const failedCount = computed(() => props.steps.filter(s => s.status === StepStatus.FAILED).length)
</script>

<style scoped>
.pipeline-status-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 8px 12px;
  background: var(--color-fill-1, #f7f8fa); border-radius: 6px;
}
.pipeline-status-bar__progress {
  display: flex; align-items: center; gap: 8px; flex: 1;
}
.pipeline-status-bar__label { font-size: 12px; color: #86909c; white-space: nowrap; }
.pipeline-status-bar__value { font-size: 12px; font-weight: 600; color: #165dff; white-space: nowrap; }
.pipeline-status-bar__stats { display: flex; gap: 12px; }
.pipeline-status-bar__stat { font-size: 12px; color: #86909c; white-space: nowrap; }
.pipeline-status-bar__stat strong { color: #1d2129; }
.pipeline-status-bar__stat--failed strong { color: #f53f3f; }
</style>
