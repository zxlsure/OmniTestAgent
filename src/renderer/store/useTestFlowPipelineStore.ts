import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  PipelineStepType, StepStatus, STEP_DEPENDENCIES, STEP_META_MAP,
  type FlowPipelineState, type PipelineStepState, type FileInfo, type ReviewRecord, type PipelineProgressEvent
} from '../types/testflow-pipeline'

export const useTestFlowPipelineStore = defineStore('testFlowPipeline', () => {
  const pipelineState = ref<FlowPipelineState | null>(null)
  const selectedStepType = ref<PipelineStepType | null>(null)
  const currentFiles = ref<FileInfo[]>([])
  const previewContent = ref<{ content: string; fileType: string } | null>(null)
  const reviewContent = ref<string>('')
  const reviewRecords = ref<ReviewRecord[]>([])
  const loading = ref(false)
  const uploading = ref(false)
  const error = ref<string | null>(null)

  const getStepState = computed(() =>
    (type: PipelineStepType): PipelineStepState | undefined =>
      pipelineState.value?.steps.find(s => s.type === type))

  const canExecute = computed(() =>
    (type: PipelineStepType): boolean => {
      const step = getStepState.value(type)
      if (!step) return false
      if (step.status === StepStatus.RUNNING || step.status === StepStatus.COMPLETED) return false
      const deps = STEP_DEPENDENCIES[type]
      return deps.every(dep => {
        const depStep = getStepState.value(dep)
        return depStep?.status === StepStatus.COMPLETED
      })
    })

  const canRetry = computed(() =>
    (type: PipelineStepType): boolean => {
      const step = getStepState.value(type)
      return step?.status === StepStatus.FAILED && step.retryCount < 3
    })

  const selectedStep = computed(() =>
    selectedStepType.value
      ? getStepState.value(selectedStepType.value)
      : undefined)

  const allSteps = computed(() => pipelineState.value?.steps ?? [])

  async function fetchPipelineState(projectId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      pipelineState.value = await window.electronAPI.pipeline.getState(projectId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      console.error('Failed to fetch pipeline state:', e)
    } finally {
      loading.value = false
    }
  }

  async function executeStep(projectId: string, stepType: PipelineStepType): Promise<void> {
    error.value = null
    try {
      await window.electronAPI.pipeline.executeStep({ projectId, stepType })
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      console.error('Failed to execute step:', e)
    }
  }

  async function interruptStep(activityId: string): Promise<void> {
    error.value = null
    try {
      await window.electronAPI.pipeline.interruptStep(activityId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      console.error('Failed to interrupt step:', e)
    }
  }

  async function reviewStep(
    activityId: string,
    result: 'approved' | 'rejected',
    modifiedContent: string,
    comment?: string
  ): Promise<void> {
    error.value = null
    try {
      await window.electronAPI.pipeline.reviewStep({
        activityId, result, modifiedContent, comment
      })
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      console.error('Failed to review step:', e)
    }
  }

  async function retryStep(projectId: string, stepType: PipelineStepType): Promise<void> {
    error.value = null
    try {
      await window.electronAPI.pipeline.retryStep({ projectId, stepType })
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      console.error('Failed to retry step:', e)
    }
  }

  async function fetchFiles(projectId: string, dirName: string): Promise<void> {
    try {
      currentFiles.value = await window.electronAPI.fileOp.listFiles({ projectId, dirName })
    } catch (e: unknown) {
      console.error('Failed to fetch files:', e)
    }
  }

  async function fetchFileContent(projectId: string, dirName: string, fileName: string): Promise<void> {
    try {
      previewContent.value = await window.electronAPI.fileOp.readFileContent({ projectId, dirName, fileName })
    } catch (e: unknown) {
      console.error('Failed to fetch file content:', e)
    }
  }

  async function uploadFiles(projectId: string, targetDir: string, filePaths: string[]): Promise<void> {
    uploading.value = true
    try {
      await window.electronAPI.fileOp.uploadFiles({ projectId, targetDir, filePaths })
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      console.error('Failed to upload files:', e)
    } finally {
      uploading.value = false
    }
  }

  async function openAndUpload(projectId: string, targetDir: string): Promise<void> {
    try {
      const filePaths = await window.electronAPI.fileOp.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Documents', extensions: ['md', 'txt', 'pdf', 'doc', 'docx'] }]
      })
      if (filePaths && filePaths.length > 0) {
        await uploadFiles(projectId, targetDir, filePaths)
      }
    } catch (e: unknown) {
      console.error('Failed to open and upload:', e)
    }
  }

  function setupProgressListener(): void {
    window.electronAPI.pipeline.onProgress((_event, progress: PipelineProgressEvent) => {
      if (!pipelineState.value) return
      const step = pipelineState.value.steps.find(s => s.type === progress.activityType)
      if (step) {
        step.status = progress.status
        step.progress = progress.progress
        if (progress.streamingContent !== undefined) {
          step.streamingContent = progress.streamingContent
        }
        if (progress.error) {
          step.errorMessage = progress.error
        }
        step.updatedAt = new Date().toISOString()
      }
      if (progress.status === StepStatus.COMPLETED || progress.status === StepStatus.FAILED) {
        const completedCount = pipelineState.value.steps.filter(s => s.status === StepStatus.COMPLETED).length
        pipelineState.value.overallProgress = Math.round((completedCount / pipelineState.value.steps.length) * 100)
      }
    })
  }

  function cleanupProgressListener(): void {
    window.electronAPI.pipeline.removeProgressListeners()
  }

  return {
    pipelineState, selectedStepType, currentFiles, previewContent,
    reviewContent, reviewRecords, loading, uploading, error,
    getStepState, canExecute, canRetry, selectedStep, allSteps,
    fetchPipelineState, executeStep, interruptStep, reviewStep, retryStep,
    fetchFiles, fetchFileContent, uploadFiles, openAndUpload,
    setupProgressListener, cleanupProgressListener
  }
})
