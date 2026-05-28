<template>
  <div class="pipeline-overview">
    <div class="pipeline-overview__title">
      <h3>测试设计流水线</h3>
    </div>
    <div class="pipeline-overview__cards" ref="cardsAreaRef">
      <PipelineConnectors
        :positions="stepPositions"
        :width="areaWidth"
        :height="areaHeight"
        :edges="pipelineEdges"
        :step-states="stepStatesMap"
      />
      <div class="pipeline-overview__row">
        <CompactStepCard
          v-for="stepType in row1Steps"
          :key="stepType"
          :ref="(el: any) => setStepRef(stepType, el)"
          :step="getStep(stepType)"
          :is-selected="stepType === selectedStepType"
          :can-execute="canExecute(stepType)"
          :can-retry="canRetry(stepType)"
          :file-count="fileCountMap[stepType] ?? 0"
          @select="$emit('select', stepType)"
          @start="$emit('start', stepType)"
          @retry="$emit('retry', stepType)"
          @review="$emit('review', stepType)"
        />
      </div>
      <div class="pipeline-overview__row">
        <CompactStepCard
          v-for="stepType in row2Steps"
          :key="stepType"
          :ref="(el: any) => setStepRef(stepType, el)"
          :step="getStep(stepType)"
          :is-selected="stepType === selectedStepType"
          :can-execute="canExecute(stepType)"
          :can-retry="canRetry(stepType)"
          :file-count="fileCountMap[stepType] ?? 0"
          @select="$emit('select', stepType)"
          @start="$emit('start', stepType)"
          @retry="$emit('retry', stepType)"
          @review="$emit('review', stepType)"
        />
      </div>
    </div>
    <PipelineStatusBar
      :steps="steps"
      :overall-progress="overallProgress"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  PipelineStepType, StepStatus, STEP_META_MAP,
  type PipelineStepState
} from '@types/testflow-pipeline'
import CompactStepCard from './CompactStepCard.vue'
import PipelineConnectors from '../PipelineConnectors.vue'
import PipelineStatusBar from './PipelineStatusBar.vue'

const props = defineProps<{
  steps: PipelineStepState[]
  selectedStepType: PipelineStepType | null
  fileCountMap: Record<string, number>
  canExecute: (type: PipelineStepType) => boolean
  canRetry: (type: PipelineStepType) => boolean
  overallProgress?: number
}>()

defineEmits<{
  select: [stepType: PipelineStepType]
  start: [stepType: PipelineStepType]
  retry: [stepType: PipelineStepType]
  review: [stepType: PipelineStepType]
}>()

const row1Steps = [
  PipelineStepType.REQUIREMENT_IMPORT,
  PipelineStepType.REQUIREMENT_ANALYSIS,
  PipelineStepType.REQUIREMENT_REVIEW
]

const row2Steps = [
  PipelineStepType.SPEC_IMPORT,
  PipelineStepType.TEST_DESIGN,
  PipelineStepType.DESIGN_REVIEW,
  PipelineStepType.CASE_GENERATION,
  PipelineStepType.CASE_REVIEW,
  PipelineStepType.SCRIPT_GENERATION
]

const pipelineEdges = [
  { from: PipelineStepType.REQUIREMENT_IMPORT, to: PipelineStepType.REQUIREMENT_ANALYSIS },
  { from: PipelineStepType.REQUIREMENT_ANALYSIS, to: PipelineStepType.REQUIREMENT_REVIEW },
  { from: PipelineStepType.REQUIREMENT_REVIEW, to: PipelineStepType.SPEC_IMPORT },
  { from: PipelineStepType.SPEC_IMPORT, to: PipelineStepType.TEST_DESIGN },
  { from: PipelineStepType.TEST_DESIGN, to: PipelineStepType.DESIGN_REVIEW },
  { from: PipelineStepType.DESIGN_REVIEW, to: PipelineStepType.CASE_GENERATION },
  { from: PipelineStepType.CASE_GENERATION, to: PipelineStepType.CASE_REVIEW },
  { from: PipelineStepType.CASE_REVIEW, to: PipelineStepType.SCRIPT_GENERATION }
]

const cardsAreaRef = ref<HTMLElement | null>(null)
const stepRefs = ref<Record<string, HTMLElement>>({})
const areaWidth = ref(800)
const areaHeight = ref(300)
const stepPositions = ref<Record<string, { x: number; y: number; width: number; height: number }>>({})

const stepStatesMap = computed(() => {
  const map: Record<string, PipelineStepState> = {}
  for (const step of props.steps) {
    map[step.type] = step
  }
  return map
})

function getStep(type: PipelineStepType): PipelineStepState {
  const found = props.steps.find(s => s.type === type)
  return found ?? {
    type, status: StepStatus.IDLE, updatedAt: '', retryCount: 0,
    errorMessage: null, progress: 0, streamingContent: ''
  }
}

function setStepRef(type: string, el: any) {
  if (el?.$el) stepRefs.value[type] = el.$el as HTMLElement
}

function updateStepPositions() {
  if (!cardsAreaRef.value) return
  const areaRect = cardsAreaRef.value.getBoundingClientRect()
  areaWidth.value = areaRect.width
  areaHeight.value = areaRect.height
  const positions: Record<string, { x: number; y: number; width: number; height: number }> = {}
  for (const [type, el] of Object.entries(stepRefs.value)) {
    const rect = el.getBoundingClientRect()
    positions[type] = {
      x: rect.left - areaRect.left,
      y: rect.top - areaRect.top,
      width: rect.width,
      height: rect.height
    }
  }
  stepPositions.value = positions
}

onMounted(() => {
  nextTick(updateStepPositions)
  window.addEventListener('resize', updateStepPositions)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateStepPositions)
})

watch(() => props.steps, () => nextTick(updateStepPositions), { deep: true })
</script>

<style scoped>
.pipeline-overview {
  display: flex; flex-direction: column; gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f7f8fa 0%, #f2f3f5 100%);
  border-radius: 10px; border: 1px solid #e5e6eb;
}
.pipeline-overview__title { display: flex; align-items: center; }
.pipeline-overview__title h3 { margin: 0; font-size: 15px; font-weight: 600; }
.pipeline-overview__cards {
  display: flex; flex-direction: column; gap: 10px;
  position: relative; padding: 8px 0;
}
.pipeline-overview__row {
  display: flex; gap: 10px; align-items: center;
  justify-content: center; flex-wrap: wrap;
}
</style>
