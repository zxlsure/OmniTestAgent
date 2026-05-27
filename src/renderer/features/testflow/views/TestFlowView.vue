<template>
  <div class="test-flow-view">
    <div class="test-flow-view__header">
      <h2>测试设计流水线</h2>
    </div>

    <a-spin :loading="store.loading" class="test-flow-view__pipeline">
      <div class="pipeline-area" ref="pipelineAreaRef">
        <PipelineConnectors
          :positions="stepPositions"
          :width="pipelineAreaWidth"
          :height="pipelineAreaHeight"
          :edges="pipelineEdges"
          :step-states="stepStatesMap"
        />
        <div class="pipeline-row">
          <StepCard
            v-for="stepType in row1Steps"
            :key="stepType"
            :ref="(el: any) => setStepRef(stepType, el)"
            :step="getStep(stepType)"
            :can-execute="store.canExecute(stepType)"
            :can-retry="store.canRetry(stepType)"
            :file-count="fileCountMap[stepType] ?? 0"
            @start="onStart(stepType)"
            @retry="onRetry(stepType)"
            @review="onReview(stepType)"
            @select="store.selectedStepType = stepType"
          />
        </div>
        <div class="pipeline-row">
          <StepCard
            v-for="stepType in row2Steps"
            :key="stepType"
            :ref="(el: any) => setStepRef(stepType, el)"
            :step="getStep(stepType)"
            :can-execute="store.canExecute(stepType)"
            :can-retry="store.canRetry(stepType)"
            :file-count="fileCountMap[stepType] ?? 0"
            @start="onStart(stepType)"
            @retry="onRetry(stepType)"
            @review="onReview(stepType)"
            @select="store.selectedStepType = stepType"
          />
        </div>

        <FileUploader
          v-if="showUploader && projectId"
          :step-type="store.selectedStepType!"
          :project-id="projectId"
          @uploaded="onUploaded"
        />
      </div>

      <div class="test-flow-view__bottom">
        <div class="file-list-area" v-if="store.selectedStepType">
          <h4>{{ selectedMeta?.label }} - 文件列表</h4>
          <a-list :data="store.currentFiles" size="small">
            <template #item="{ item }">
              <a-list-item @click="onFileClick(item as FileInfo)">
                <a-list-item-meta :title="(item as FileInfo).name">
                  <template #icon><icon-file /></template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </div>
        <div class="preview-area" v-if="store.previewContent">
          <FilePreview
            :visible="previewVisible"
            :file-name="previewFileName"
            :content="store.previewContent.content"
            @update:visible="previewVisible = $event"
            @save="onFileSave"
          />
        </div>
        <div class="status-summary">
          <div class="status-summary__stats">
            <a-statistic title="总进度" :value="store.pipelineState?.overallProgress ?? 0" suffix="%" />
            <a-statistic title="已完成" :value="completedCount" :suffix="`/ ${totalSteps}`" />
            <a-statistic title="失败" :value="failedCount" :value-style="failedCount > 0 ? { color: '#f53f3f' } : undefined" />
          </div>
        </div>
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  PipelineStepType, StepStatus, STEP_META_MAP,
  type PipelineStepState, type FileInfo
} from '@types/testflow-pipeline'
import { useTestFlowPipelineStore } from '@store/useTestFlowPipelineStore'
import { useProjectStore } from '@store/useProjectStore'
import StepCard from '../components/StepCard.vue'
import FileUploader from '../components/FileUploader.vue'
import FilePreview from '../components/FilePreview.vue'
import ReviewPanel from '../components/ReviewPanel.vue'
import PipelineConnectors from '../components/PipelineConnectors.vue'

const store = useTestFlowPipelineStore()
const projectStore = useProjectStore()

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

const pipelineAreaRef = ref<HTMLElement | null>(null)
const stepRefs = ref<Record<string, HTMLElement>>({})
const fileCountMap = ref<Record<string, number>>({})
const previewVisible = ref(false)
const previewFileName = ref('')
const reviewVisible = ref(false)
const reviewStepType = ref<PipelineStepType | null>(null)
const pipelineAreaWidth = ref(800)
const pipelineAreaHeight = ref(300)
const stepPositions = ref<Record<string, { x: number; y: number; width: number; height: number }>>({})

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

const stepStatesMap = computed(() => {
  const map: Record<string, PipelineStepState> = {}
  for (const step of store.pipelineState?.steps ?? []) {
    map[step.type] = step
  }
  return map
})

const projectId = computed(() => projectStore.currentProject?.id ?? '')
const totalSteps = computed(() => store.pipelineState?.steps.length ?? 9)
const completedCount = computed(() => store.pipelineState?.steps.filter(s => s.status === StepStatus.COMPLETED).length ?? 0)
const failedCount = computed(() => store.pipelineState?.steps.filter(s => s.status === StepStatus.FAILED).length ?? 0)
const selectedMeta = computed(() => store.selectedStepType ? STEP_META_MAP[store.selectedStepType] : null)
const showUploader = computed(() => {
  if (!store.selectedStepType) return false
  const meta = STEP_META_MAP[store.selectedStepType]
  return meta.isImport
})

function getStep(type: PipelineStepType): PipelineStepState {
  return store.getStepState(type) ?? {
    type, status: StepStatus.IDLE, updatedAt: '', retryCount: 0,
    errorMessage: null, progress: 0, streamingContent: ''
  }
}

function setStepRef(type: string, el: any) {
  if (el?.$el) stepRefs.value[type] = el.$el as HTMLElement
}

function updateStepPositions() {
  if (!pipelineAreaRef.value) return
  const areaRect = pipelineAreaRef.value.getBoundingClientRect()
  pipelineAreaWidth.value = areaRect.width
  pipelineAreaHeight.value = areaRect.height
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

async function loadFileCounts() {
  if (!projectId.value) return
  const allSteps = [...row1Steps, ...row2Steps]
  for (const st of allSteps) {
    try {
      await store.fetchFiles(projectId.value, STEP_META_MAP[st].outputDir)
      fileCountMap.value[st] = store.currentFiles.length
    } catch (e: unknown) { console.error('Fetch file count failed:', e); fileCountMap.value[st] = 0 }
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

async function onUploaded() {
  if (!projectId.value) return
  await store.fetchPipelineState(projectId.value)
  await loadFileCounts()
}

async function onFileClick(file: FileInfo) {
  if (!projectId.value || !store.selectedStepType) return
  const meta = STEP_META_MAP[store.selectedStepType]
  previewFileName.value = file.name
  await store.fetchFileContent(projectId.value, meta.outputDir, file.name)
  previewVisible.value = true
}

async function onFileSave(fileName: string, content: string) {
  if (!projectId.value || !store.selectedStepType) return
  const meta = STEP_META_MAP[store.selectedStepType]
  try {
    await window.electronAPI.fileOp.writeFile({
      projectId: projectId.value,
      dirName: meta.outputDir,
      fileName,
      content
    })
    previewVisible.value = false
  } catch (e: unknown) {
    console.error('File save failed:', e)
  }
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
  if (projectId.value) {
    await store.fetchPipelineState(projectId.value)
    await loadFileCounts()
  }
  nextTick(updateStepPositions)
  window.addEventListener('resize', updateStepPositions)
})

onUnmounted(() => {
  store.cleanupProgressListener()
  window.removeEventListener('resize', updateStepPositions)
})
</script>

<style scoped>
.test-flow-view { display: flex; flex-direction: column; gap: 20px; padding: 20px; height: 100%; }
.test-flow-view__header { display: flex; justify-content: space-between; align-items: center; }
.test-flow-view__header h2 { margin: 0; font-size: 18px; font-weight: 600; }
.test-flow-view__pipeline { flex: 1; }
.pipeline-area {
  display: flex; flex-direction: column; gap: 20px;
  padding: 28px 32px; background: linear-gradient(135deg, #f7f8fa 0%, #f2f3f5 100%);
  border-radius: 12px; position: relative; border: 1px solid #e5e6eb;
}
.pipeline-row {
  display: flex; gap: 12px; align-items: center; justify-content: center; flex-wrap: wrap;
}
.pipeline-row + .pipeline-row { margin-top: 8px; }
.test-flow-view__bottom { display: flex; gap: 16px; margin-top: 8px; }
.file-list-area { flex: 0 0 280px; }
.file-list-area h4 { margin-bottom: 8px; font-size: 14px; font-weight: 600; }
.preview-area { flex: 1; }
.status-summary { flex: 1; }
.status-summary__stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
}
@media (max-width: 720px) {
  .pipeline-row { flex-direction: column; gap: 10px; }
  .status-summary__stats { grid-template-columns: 1fr; }
  .pipeline-area { padding: 16px; }
}
</style>
