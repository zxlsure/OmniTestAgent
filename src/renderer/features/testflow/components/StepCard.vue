<template>
  <transition name="step-fade" mode="out-in">
    <div
      class="step-card"
      :class="[`step-card--${step.status}`, { 'step-card--disabled': !isEnabled }]"
      :key="step.status"
      @click="$emit('select')"
    >
      <div class="step-card__header">
        <span class="step-card__icon" :style="{ color: statusColor }">
          <template v-if="step.status === StepStatus.COMPLETED">
            <span class="step-card__completed-pulse">✓</span>
          </template>
          <template v-else-if="step.status === StepStatus.RUNNING">
            <span class="step-card__spin">⟳</span>
          </template>
          <template v-else-if="step.status === StepStatus.FAILED">✗</template>
          <template v-else-if="isEnabled">○</template>
          <template v-else>—</template>
        </span>
        <span class="step-card__title">{{ meta.label }}</span>
        <a-tag :color="tagColor" size="small">{{ statusLabel }}</a-tag>
      </div>
      <div class="step-card__desc">{{ meta.description }}</div>
      <div v-if="step.status === StepStatus.RUNNING" class="step-card__progress">
        <a-progress :percent="step.progress / 100" size="small" status="normal" />
        <span class="step-card__progress-text">{{ step.progress }}%</span>
      </div>
      <div v-if="step.errorMessage" class="step-card__error">{{ step.errorMessage }}</div>
      <div class="step-card__actions" @click.stop>
        <template v-if="meta.isImport && canExecute">
          <a-button type="text" size="small" @click="$emit('start')">
            <template #icon><icon-upload /></template>
            上传
          </a-button>
        </template>
        <template v-else-if="!meta.isReview">
          <a-button
            v-if="canExecute"
            type="primary"
            size="small"
            :disabled="step.status === StepStatus.RUNNING"
            @click="$emit('start')"
          >开始</a-button>
          <a-button
            v-if="canRetry"
            type="outline"
            status="danger"
            size="small"
            @click="$emit('retry')"
          >重试</a-button>
        </template>
        <template v-else>
          <a-button
            v-if="canExecute"
            type="primary"
            size="small"
            @click="$emit('review')"
          >审核</a-button>
        </template>
      </div>
      <div v-if="fileCount > 0" class="step-card__files">
        <icon-file /> {{ fileCount }} 个文件
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
  canExecute: boolean
  canRetry: boolean
  fileCount?: number
}>()

defineEmits<{
  start: []
  retry: []
  review: []
  select: []
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
.step-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px 18px; border: 1px solid #e5e6eb; border-radius: 10px;
  background: #fff; cursor: pointer; transition: all 0.25s ease;
  min-width: 150px; max-width: 200px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.step-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px); }
.step-card--completed { border-color: #00b42a; background: linear-gradient(135deg, #fff 85%, #e8ffea 100%); }
.step-card--running { border-color: #165dff; background: linear-gradient(135deg, #fff 85%, #e8f3ff 100%); }
.step-card--failed { border-color: #f53f3f; background: linear-gradient(135deg, #fff 85%, #ffece8 100%); }
.step-card--disabled { opacity: 0.5; cursor: default; }
.step-card--disabled:hover { box-shadow: 0 1px 2px rgba(0,0,0,0.04); transform: none; }
.step-card__header { display: flex; align-items: center; gap: 8px; }
.step-card__icon { font-size: 20px; font-weight: bold; flex-shrink: 0; }
.step-card__spin { display: inline-block; animation: step-spin 1s linear infinite; }
@keyframes step-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.step-card__completed-pulse { display: inline-block; animation: completed-pulse 2s ease-in-out infinite; }
@keyframes completed-pulse {
  0%, 100% { opacity: 1; text-shadow: 0 0 0 rgba(0,180,42,0); }
  50% { opacity: 0.85; text-shadow: 0 0 6px rgba(0,180,42,0.4); }
}
.step-fade-enter-active, .step-fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.step-fade-enter-from { opacity: 0; transform: scale(0.96); }
.step-fade-leave-to { opacity: 0; transform: scale(1.02); }
.step-card__title { font-weight: 600; font-size: 13px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.step-card__desc { font-size: 11px; color: #86909c; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.step-card__progress { margin-top: 2px; display: flex; align-items: center; gap: 6px; }
.step-card__progress-text { font-size: 11px; color: #165dff; font-weight: 500; white-space: nowrap; }
.step-card__error { font-size: 11px; color: #f53f3f; line-height: 1.4; }
.step-card__actions { display: flex; gap: 6px; margin-top: 2px; }
.step-card__files { font-size: 11px; color: #86909c; display: flex; align-items: center; gap: 4px; }
</style>
