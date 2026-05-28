<template>
  <div class="step-content-header">
    <div class="step-content-header__left">
      <span class="step-content-header__name">{{ stepMeta.label }}</span>
      <a-tag :color="tagColor" size="small">{{ statusLabel }}</a-tag>
      <a-progress
        v-if="step.status === StepStatus.RUNNING"
        :percent="step.progress / 100"
        size="small"
        status="normal"
        style="width: 120px"
      />
      <span
        v-if="step.status === StepStatus.RUNNING"
        class="step-content-header__progress-text"
      >{{ step.progress }}%</span>
    </div>
    <div class="step-content-header__right">
      <slot name="actions" />
    </div>
    <div v-if="step.errorMessage" class="step-content-header__error">
      {{ step.errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { StepStatus, type PipelineStepState, type StepMeta } from '@types/testflow-pipeline'
import { ACTIVITY_STATUS_MAP } from '@utils/constants'

const props = defineProps<{
  step: PipelineStepState
  stepMeta: StepMeta
}>()

const tagColor = computed(() => {
  const map: Record<string, string> = {
    [StepStatus.COMPLETED]: 'green',
    [StepStatus.RUNNING]: 'blue',
    [StepStatus.FAILED]: 'red',
    [StepStatus.IDLE]: 'gray'
  }
  return map[props.step.status] ?? 'gray'
})

const statusLabel = computed(() => ACTIVITY_STATUS_MAP[props.step.status]?.label ?? '未知')
</script>

<style scoped>
.step-content-header {
  display: flex; flex-wrap: wrap; align-items: center;
  justify-content: space-between; gap: 8px;
  padding: 8px 12px; border-bottom: 1px solid var(--color-border, #e5e6eb);
  background: #fff;
}
.step-content-header__left { display: flex; align-items: center; gap: 8px; }
.step-content-header__name { font-size: 14px; font-weight: 600; }
.step-content-header__progress-text { font-size: 12px; color: #165dff; font-weight: 500; }
.step-content-header__right { display: flex; align-items: center; gap: 8px; }
.step-content-header__error {
  width: 100%; font-size: 12px; color: #f53f3f; padding-top: 4px;
}
</style>
