<template>
  <div class="test-flow-view">
    <a-spin :loading="store.loading" class="test-flow-view__spin">
      <div class="test-flow-view__overview" :style="overviewStyle">
        <PipelineOverview
          :steps="store.pipelineState?.steps ?? []"
          :selected-step-type="store.selectedStepType"
          :file-count-map="fileCountMap"
          :can-execute="(type: PipelineStepType) => store.canExecute(type)"
          :can-retry="(type: PipelineStepType) => store.canRetry(type)"
          :overall-progress="store.pipelineState?.overallProgress"
          @select="onStepSelect"
          @start="onStart"
          @retry="onRetry"
          @review="onReview"
        />
      </div>
      <div class="test-flow-view__divider"></div>
      <div class="test-flow-view__content" :style="contentStyle">
        <StepContentArea
          :step-type="store.selectedStepType"
          :project-id="projectId"
          @start="onStart"
          @retry="onRetry"
          @review="onReview"
        />
      </div>
    </a-spin>

    <ReviewPanel
      v-if="reviewStepType && projectId"
      :step-type="reviewStepType"
      :project-id="projectId"
      :visible="reviewVisible"
      @update:visible="reviewVisible = $event"
      @approved="onReviewApproved"
      @rejected="onReviewRejected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  PipelineStepType, StepStatus, STEP_META_MAP,
  type PipelineStepState
} from '@types/testflow-pipeline'
import { useTestFlowPipelineStore } from '@store/useTestFlowPipelineStore'
import { useProjectStore } from '@store/useProjectStore'
import { LAYOUT_CONFIG } from '../constants/layout-config'
import PipelineOverview from '../components/pipeline/PipelineOverview.vue'
import StepContentArea from '../components/content/StepContentArea.vue'
import ReviewPanel from '../components/ReviewPanel.vue'

const store = useTestFlowPipelineStore()
const projectStore = useProjectStore()

const fileCountMap = ref<Record<string, number>>({})
const reviewVisible = ref(false)
const reviewStepType = ref<PipelineStepType | null>(null)
const windowHeight = ref(window.innerHeight)

const projectId = computed(() => projectStore.currentProject?.id ?? '')

const isHeightInsufficient = computed(() => windowHeight.value < LAYOUT_CONFIG.MIN_PAGE_HEIGHT)

const overviewStyle = computed(() => {
  if (isHeightInsufficient.value) {
    return { flex: `0 0 ${LAYOUT_CONFIG.OVERVIEW_MIN_HEIGHT}px`, maxHeight: 'none' }
  }
  return { flex: '0 0 auto', maxHeight: `${LAYOUT_CONFIG.OVERVIEW_MAX_RATIO * 100}vh` }
})

const contentStyle = computed(() => {
  if (isHeightInsufficient.value) {
    return { flex: '1 1 auto', minHeight: '0', overflowY: 'auto' as const }
  }
  return { flex: '1 1 auto', minHeight: `${LAYOUT_CONFIG.CONTENT_MIN_RATIO * 100}vh` }
})

function onStepSelect(stepType: PipelineStepType) {
  store.selectedStepType = stepType
}

async function loadFileCounts() {
  if (!projectId.value) return
  const allTypes = Object.values(PipelineStepType)
  for (const st of allTypes) {
    try {
      await store.fetchFiles(projectId.value, STEP_META_MAP[st].outputDir)
      fileCountMap.value[st] = store.currentFiles.length
    } catch (e: unknown) {
      console.error('Fetch file count failed:', e)
      fileCountMap.value[st] = 0
    }
  }
}

async function onStart(stepType: PipelineStepType) {
  if (!projectId.value) return
  const meta = STEP_META_MAP[stepType]
  if (meta.isImport) {
    await store.openAndUpload(projectId.value, meta.outputDir)
    await store.fetchPipelineState(projectId.value)
    await loadFileCounts()
    if (store.selectedStepType) {
      const selectedMeta = STEP_META_MAP[store.selectedStepType]
      await store.fetchFiles(projectId.value, selectedMeta.outputDir)
    }
    return
  }
  await store.executeStep(projectId.value, stepType)
}

async function onRetry(stepType: PipelineStepType) {
  if (!projectId.value) return
  await store.retryStep(projectId.value, stepType)
}

function onReview(stepType: PipelineStepType) {
  reviewStepType.value = stepType
  reviewVisible.value = true
}

async function onReviewApproved() {
  if (!projectId.value || !reviewStepType.value) return
  const step = store.getStepState(reviewStepType.value)
  if (step) {
    await store.reviewStep(step.type, 'approved', store.reviewContent)
    await store.fetchPipelineState(projectId.value)
  }
  reviewStepType.value = null
}

async function onReviewRejected() {
  if (!projectId.value || !reviewStepType.value) return
  const step = store.getStepState(reviewStepType.value)
  if (step) {
    await store.reviewStep(step.type, 'rejected', store.reviewContent)
    await store.fetchPipelineState(projectId.value)
  }
  reviewStepType.value = null
}

function onWindowResize() {
  windowHeight.value = window.innerHeight
}

watch(() => store.selectedStepType, async (type) => {
  if (!type || !projectId.value) return
  const meta = STEP_META_MAP[type]
  await store.fetchFiles(projectId.value, meta.outputDir)
})

watch(projectId, async (id) => {
  if (!id) return
  await store.fetchPipelineState(id)
  await loadFileCounts()
})

onMounted(async () => {
  store.setupProgressListener()
  window.addEventListener('resize', onWindowResize)
  if (projectId.value) {
    await store.fetchPipelineState(projectId.value)
    await loadFileCounts()
  }
})

onUnmounted(() => {
  store.cleanupProgressListener()
  window.removeEventListener('resize', onWindowResize)
})
</script>

<style scoped>
.test-flow-view {
  display: flex; flex-direction: column;
  height: 100%; padding: 16px; gap: 0;
}
.test-flow-view__spin {
  display: flex; flex-direction: column; flex: 1; min-height: 0;
}
.test-flow-view__overview {
  overflow: hidden;
}
.test-flow-view__divider {
  height: 1px; background: var(--color-border, #e5e6eb);
  margin: 8px 0; flex-shrink: 0;
}
.test-flow-view__content {
  display: flex; flex-direction: column; min-height: 0;
}
@media (max-width: 720px) {
  .test-flow-view { padding: 8px; }
}
</style>
