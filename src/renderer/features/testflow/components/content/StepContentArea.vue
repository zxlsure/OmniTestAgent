<template>
  <div class="step-content-area">
    <div v-if="!stepType" class="step-content-area__guide">
      请选择流水线步骤查看详情
    </div>
    <template v-else>
      <component
        :is="panelComponent"
        v-if="panelComponent && currentStep"
        :key="stepType"
        :step-type="stepType"
        :step="currentStep"
        :project-id="projectId"
        :can-execute="canExecuteVal"
        :can-retry="canRetryVal"
        @start="onStart"
        @retry="onRetry"
        @review="onReview"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  StepStatus, STEP_META_MAP, getStepPanelType, StepPanelType,
  type PipelineStepType, type PipelineStepState
} from '@types/testflow-pipeline'
import { useTestFlowPipelineStore } from '@store/useTestFlowPipelineStore'
import ImportStepPanel from './ImportStepPanel.vue'
import AnalysisStepPanel from './AnalysisStepPanel.vue'
import ReviewStepPanel from './ReviewStepPanel.vue'

const props = defineProps<{
  stepType: PipelineStepType | null
  projectId: string
}>()

const emit = defineEmits<{
  start: [stepType: PipelineStepType]
  retry: [stepType: PipelineStepType]
  review: [stepType: PipelineStepType]
}>()

const store = useTestFlowPipelineStore()

const currentStep = computed<PipelineStepState | undefined>(() => {
  if (!props.stepType) return undefined
  return store.getStepState(props.stepType) ?? {
    type: props.stepType, status: StepStatus.IDLE, updatedAt: '',
    retryCount: 0, errorMessage: null, progress: 0, streamingContent: ''
  }
})

const canExecuteVal = computed(() => {
  if (!props.stepType) return false
  return store.canExecute(props.stepType)
})

const canRetryVal = computed(() => {
  if (!props.stepType) return false
  return store.canRetry(props.stepType)
})

const panelComponent = computed(() => {
  if (!props.stepType) return null
  const panelType = getStepPanelType(props.stepType)
  switch (panelType) {
    case StepPanelType.IMPORT: return ImportStepPanel
    case StepPanelType.ANALYSIS: return AnalysisStepPanel
    case StepPanelType.REVIEW: return ReviewStepPanel
    default: return AnalysisStepPanel
  }
})

function onStart() {
  if (props.stepType) emit('start', props.stepType)
}

function onRetry() {
  if (props.stepType) emit('retry', props.stepType)
}

function onReview() {
  if (props.stepType) emit('review', props.stepType)
}
</script>

<style scoped>
.step-content-area {
  display: flex; flex-direction: column; flex: 1;
  min-height: 0; background: #fff; border-radius: 8px;
  border: 1px solid var(--color-border, #e5e6eb); overflow: hidden;
}
.step-content-area__guide {
  display: flex; align-items: center; justify-content: center;
  flex: 1; font-size: 14px; color: #c9cdd4;
}
</style>
