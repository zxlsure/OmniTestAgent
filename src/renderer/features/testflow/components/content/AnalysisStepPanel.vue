<template>
  <div class="analysis-step-panel">
    <StepContentHeader :step="step" :step-meta="stepMeta">
      <template #actions>
        <a-button
          v-if="canExecute"
          type="primary"
          size="small"
          :disabled="step.status === StepStatus.RUNNING"
          @click="onStart"
        >开始</a-button>
        <a-button
          v-if="canRetry"
          type="outline"
          status="danger"
          size="small"
          @click="onRetry"
        >重试</a-button>
      </template>
    </StepContentHeader>
    <div class="analysis-step-panel__body">
      <ResourceExplorer
        :files="files"
        :selected-file-name="selectedFileName"
        :loading="filesLoading"
        @select="onFileSelect"
      />
      <DocumentEmbedPreview
        :file-name="selectedFileName"
        :content="fileContent"
        :file-type="fileRenderType"
        :project-id="projectId"
        :dir-name="stepMeta.outputDir"
        :content-loading="contentLoading"
        :load-error="contentLoadError"
        @save="onFileSave"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  StepStatus, STEP_META_MAP,
  type PipelineStepType, type PipelineStepState, type FileInfo
} from '@types/testflow-pipeline'
import { useTestFlowPipelineStore } from '@store/useTestFlowPipelineStore'
import { getFileRenderType, type FileRenderType } from '../../constants/file-render'
import StepContentHeader from './StepContentHeader.vue'
import ResourceExplorer from './ResourceExplorer.vue'
import DocumentEmbedPreview from './DocumentEmbedPreview.vue'

const props = defineProps<{
  stepType: PipelineStepType
  step: PipelineStepState
  projectId: string
  canExecute: boolean
  canRetry: boolean
}>()

const emit = defineEmits<{
  start: []
  retry: []
}>()

const store = useTestFlowPipelineStore()
const stepMeta = computed(() => STEP_META_MAP[props.stepType])

const files = computed(() => store.currentFiles)
const filesLoading = computed(() => store.loading)

const selectedFileName = ref<string | null>(null)
const fileContent = ref('')
const fileRenderType = ref<FileRenderType>('text')
const contentLoading = ref(false)
const contentLoadError = ref(false)

async function loadFileList() {
  if (!props.projectId) return
  await store.fetchFiles(props.projectId, stepMeta.value.outputDir)
}

watch(() => props.stepType, () => {
  selectedFileName.value = null
  fileContent.value = ''
  contentLoadError.value = false
  loadFileList()
}, { immediate: true })

async function onFileSelect(file: FileInfo) {
  selectedFileName.value = file.name
  fileRenderType.value = getFileRenderType(file.name)
  contentLoading.value = true
  contentLoadError.value = false
  try {
    await store.fetchFileContent(props.projectId, stepMeta.value.outputDir, file.name)
    fileContent.value = store.previewContent?.content ?? ''
  } catch (e: unknown) {
    contentLoadError.value = true
    console.error('Failed to load file content:', e)
  } finally {
    contentLoading.value = false
  }
}

function onStart() { emit('start') }
function onRetry() { emit('retry') }

async function onFileSave(fileName: string, content: string) {
  try {
    await window.electronAPI.fileOp.writeFile({
      projectId: props.projectId,
      dirName: stepMeta.value.outputDir,
      fileName,
      content
    })
  } catch (e: unknown) {
    console.error('File save failed:', e)
  }
}
</script>

<style scoped>
.analysis-step-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.analysis-step-panel__body {
  display: flex; flex: 1; min-height: 0; overflow: hidden;
}
</style>
