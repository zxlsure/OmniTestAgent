<template>
  <transition name="step-fade" mode="out-in">
    <div
      class="compact-step-card"
      :class="[
        `compact-step-card--${step.status}`,
        { 'compact-step-card--selected': isSelected },
        { 'compact-step-card--disabled': !isEnabled }
      ]"
      :key="step.status"
      @click="$emit('select')"
    >
      <div class="compact-step-card__header">
        <span class="compact-step-card__icon" :style="{ color: statusColor }">
          <template v-if="step.status === StepStatus.COMPLETED">✓</template>
          <template v-else-if="step.status === StepStatus.RUNNING">
            <span class="compact-step-card__spin">⟳</span>
          </template>
          <template v-else-if="step.status === StepStatus.FAILED">✗</template>
          <template v-else-if="isEnabled">○</template>
          <template v-else>—</template>
        </span>
        <span class="compact-step-card__title">{{ meta.label }}</span>
        <a-tag :color="tagColor" size="small">{{ statusLabel }}</a-tag>
      </div>
      <div v-if="step.status === StepStatus.RUNNING" class="compact-step-card__progress">
        <a-progress :percent="step.progress / 100" size="small" status="normal" />
      </div>
      <div v-if="step.errorMessage" class="compact-step-card__error">{{ step.errorMessage }}</div>
      <div class="compact-step-card__actions" @click.stop>
        <template v-if="meta.isImport && canExecute">
          <a-button type="text" size="mini" @click="$emit('start')">
            <template #icon><icon-upload /></template>
          </a-button>
        </template>
        <template v-else-if="!meta.isReview">
          <a-button
            v-if="canExecute"
            type="text"
            size="mini"
            :disabled="step.status === StepStatus.RUNNING"
            @click="$emit('start')"
          >
            <template #icon><icon-play-arrow /></template>
          </a-button>
          <a-button
            v-if="canRetry"
            type="text"
            status="danger"
            size="mini"
            @click="$emit('retry')"
          >
            <template #icon><icon-refresh /></template>
          </a-button>
        </template>
        <template v-else>
          <a-button
            v-if="canExecute"
            type="text"
            size="mini"
            @click="$emit('review')"
          >
            <template #icon><icon-check-circle /></template>
          </a-button>
        </template>
      </div>
      <div v-if="fileCount && fileCount > 0" class="compact-step-card__files">
        <icon-file /> {{ fileCount }}
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { StepStatus, STEP_META_MAP, type PipelineStepState } from '@types/testflow-pipeline'
import { ACTIVITY_STATUS_MAP } from '@utils/constants'

const props = defineProps<{
  step: PipelineStepState
  isSelected: boolean
  canExecute: boolean
  canRetry: boolean
  fileCount?: number
}>()

defineEmits<{
  select: []
  start: []
  retry: []
  review: []
}>()

const meta = computed(() => STEP_META_MAP[props.step.type])
const isEnabled = computed(() => props.canExecute || props.step.status === StepStatus.RUNNING || props.step.status === StepStatus.COMPLETED)

const statusColor = computed(() => {
  const map: Record<string, string> = {
    [StepStatus.COMPLETED]: '#00b42a',
    [StepStatus.RUNNING]: '#165dff',
    [StepStatus.FAILED]: '#f53f3f',
    [StepStatus.IDLE]: props.canExecute ? '#86909c' : '#c9cdd4'
  }
  return map[props.step.status] ?? '#86909c'
})

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
.compact-step-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px 12px; border: 1px solid #e5e6eb; border-radius: 8px;
  background: #fff; cursor: pointer; transition: all 0.25s ease;
  min-width: 120px; max-width: 180px; position: relative;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.compact-step-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px);
}
.compact-step-card--selected {
  border-color: var(--color-primary-6, #165dff);
  border-width: 2px;
  background: linear-gradient(135deg, #fff 85%, #e8f3ff 100%);
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.15);
}
.compact-step-card--selected::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--color-primary-6, #165dff);
  border-radius: 3px 0 0 3px;
}
.compact-step-card--completed {
  border-color: #00b42a;
  background: linear-gradient(135deg, #fff 85%, #e8ffea 100%);
}
.compact-step-card--running {
  border-color: #165dff;
  background: linear-gradient(135deg, #fff 85%, #e8f3ff 100%);
}
.compact-step-card--failed {
  border-color: #f53f3f;
  background: linear-gradient(135deg, #fff 85%, #ffece8 100%);
}
.compact-step-card--disabled { opacity: 0.5; cursor: default; }
.compact-step-card--disabled:hover { box-shadow: 0 1px 2px rgba(0,0,0,0.04); transform: none; }
.compact-step-card__header { display: flex; align-items: center; gap: 6px; }
.compact-step-card__icon { font-size: 16px; font-weight: bold; flex-shrink: 0; }
.compact-step-card__spin { display: inline-block; animation: step-spin 1s linear infinite; }
@keyframes step-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.step-fade-enter-active, .step-fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.step-fade-enter-from { opacity: 0; transform: scale(0.96); }
.step-fade-leave-to { opacity: 0; transform: scale(1.02); }
.compact-step-card__title {
  font-weight: 600; font-size: 12px; flex: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.compact-step-card__progress { margin-top: 2px; }
.compact-step-card__error { font-size: 10px; color: #f53f3f; line-height: 1.3; }
.compact-step-card__actions { display: flex; gap: 4px; }
.compact-step-card__files { font-size: 10px; color: #86909c; display: flex; align-items: center; gap: 3px; }
</style>
