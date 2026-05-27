import { BrowserWindow } from 'electron'
import { testFlowOrchestrator } from './TestFlowOrchestrator'
import { pipelineStatusRepo } from '../data/repositories/PipelineStatusRepo'
import { fileOperationService } from './FileOperationService'
import { flowActivityRepo } from '../data/repositories/FlowActivityRepo'
import { skillEngine } from './SkillEngine'
import { logger } from '../utils/logger'
import {
  PipelineStepType, StepStatus, STEP_META_MAP, STEP_DEPENDENCIES,
  CASCADE_DOWNSTREAM, REVIEW_TO_STEP_MAP,
  type FlowPipelineState, type PipelineStepState, type PipelineProgressEvent
} from '../data/types/pipeline'

const MAX_RETRY_COUNT = 3

function createInitialSteps(): PipelineStepState[] {
  return Object.values(PipelineStepType).map(type => ({
    type,
    status: StepStatus.IDLE,
    updatedAt: '-',
    retryCount: 0,
    errorMessage: null,
    progress: 0,
    streamingContent: ''
  }))
}

function computeOverallProgress(steps: PipelineStepState[]): number {
  const completedCount = steps.filter(s => s.status === StepStatus.COMPLETED).length
  return steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0
}

export class TestFlowPipelineService {
  getPipelineState(projectId: string): FlowPipelineState {
    fileOperationService.ensureProjectDirs(projectId)
    const state = pipelineStatusRepo.read(projectId)
    if (state) {
      this.detectImportStatus(projectId, state)
      state.overallProgress = computeOverallProgress(state.steps)
      return state
    }
    return this.rebuildStateFromDirs(projectId)
  }

  async executeStep(projectId: string, stepType: PipelineStepType, win: BrowserWindow): Promise<void> {
    const meta = STEP_META_MAP[stepType]
    if (meta.isReview) {
      throw new Error('审核环节不可自动执行，请通过审核操作完成')
    }

    const state = this.getPipelineState(projectId)
    if (!this.checkDependencies(stepType, state)) {
      throw new Error(`前置依赖未满足，无法执行 ${meta.label}`)
    }

    const currentStep = state.steps.find(s => s.type === stepType)
    if (currentStep?.status === StepStatus.RUNNING) {
      throw new Error(`${meta.label} 正在执行中`)
    }
    if (currentStep?.status === StepStatus.COMPLETED) {
      throw new Error(`${meta.label} 已完成，无需重复执行`)
    }

    this.updateStepStatus(projectId, stepType, StepStatus.RUNNING)
    win.webContents.send('pipeline:progress', {
      activityType: stepType, status: StepStatus.RUNNING, progress: 0
    } as PipelineProgressEvent)

    try {
      if (meta.isImport) {
        this.updateStepStatus(projectId, stepType, StepStatus.COMPLETED)
        win.webContents.send('pipeline:progress', {
          activityType: stepType, status: StepStatus.COMPLETED, progress: 100
        } as PipelineProgressEvent)
      } else if (meta.skillName) {
        const result = await skillEngine.execute(meta.skillName, { projectId })
        if (result.success) {
          this.updateStepStatus(projectId, stepType, StepStatus.COMPLETED)
          win.webContents.send('pipeline:progress', {
            activityType: stepType, status: StepStatus.COMPLETED, progress: 100, output: result.output
          } as PipelineProgressEvent)
        } else {
          this.updateStepStatus(projectId, stepType, StepStatus.FAILED, result.error)
          win.webContents.send('pipeline:progress', {
            activityType: stepType, status: StepStatus.FAILED, error: result.error
          } as PipelineProgressEvent)
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      this.updateStepStatus(projectId, stepType, StepStatus.FAILED, msg)
      win.webContents.send('pipeline:progress', {
        activityType: stepType, status: StepStatus.FAILED, error: msg
      } as PipelineProgressEvent)
    }
  }

  updateStepStatus(projectId: string, stepType: PipelineStepType, status: StepStatus, errorMessage?: string): void {
    const state = pipelineStatusRepo.read(projectId) || {
      projectId, steps: createInitialSteps(), overallProgress: 0, lastUpdatedAt: new Date().toISOString()
    }
    const step = state.steps.find(s => s.type === stepType)
    if (step) {
      step.status = status
      step.updatedAt = new Date().toISOString()
      step.errorMessage = status === StepStatus.FAILED ? (errorMessage ?? null) : null
      if (status === StepStatus.RUNNING) {
        step.progress = 0
        step.streamingContent = ''
      }
      if (status === StepStatus.COMPLETED) {
        step.progress = 100
        step.retryCount = 0
      }
      if (status === StepStatus.FAILED) {
        step.retryCount += 1
      }
    }
    state.overallProgress = computeOverallProgress(state.steps)
    state.lastUpdatedAt = new Date().toISOString()
    pipelineStatusRepo.write(projectId, state)

    const activity = flowActivityRepo.getByType(projectId, stepType)
    if (activity) {
      flowActivityRepo.updateStatus(activity.id, status)
    }
  }

  checkDependencies(stepType: PipelineStepType, state: FlowPipelineState): boolean {
    const deps = STEP_DEPENDENCIES[stepType]
    return deps.every(depType => {
      const depStep = state.steps.find(s => s.type === depType)
      return depStep?.status === StepStatus.COMPLETED
    })
  }

  detectImportStatus(projectId: string, state: FlowPipelineState): void {
    for (const step of state.steps) {
      const meta = STEP_META_MAP[step.type]
      if (meta.isImport) {
        const hasFiles = fileOperationService.hasFiles(projectId, meta.outputDir)
        const detectedStatus = hasFiles ? StepStatus.COMPLETED : StepStatus.IDLE
        if (step.status !== detectedStatus) {
          step.status = detectedStatus
          step.updatedAt = new Date().toISOString()
        }
      }
    }
  }

  async retryStep(projectId: string, stepType: PipelineStepType, win: BrowserWindow): Promise<void> {
    const state = this.getPipelineState(projectId)
    const step = state.steps.find(s => s.type === stepType)
    if (!step || step.status !== StepStatus.FAILED) {
      throw new Error('只能重试失败的环节')
    }
    if (step.retryCount >= MAX_RETRY_COUNT) {
      throw new Error('重试次数已达上限(3次)，请检查LLM服务配置')
    }
    step.status = StepStatus.IDLE
    step.retryCount = 0
    step.errorMessage = null
    pipelineStatusRepo.write(projectId, state)
    await this.executeStep(projectId, stepType, win)
  }

  interruptStep(activityId: string): void {
    testFlowOrchestrator.interrupt(activityId)
  }

  reviewStep(
    activityId: string,
    result: 'approved' | 'rejected',
    modifiedContent: string,
    comment?: string,
    reviewer?: string
  ): void {
    const activity = flowActivityRepo.getById(activityId)
    if (!activity) throw new Error('Activity not found')

    const existingReviews = flowActivityRepo.getReviews(activityId)
    const reviewRound = existingReviews.length + 1
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    flowActivityRepo.addReview(activityId, result, comment, reviewer)

    const stepType = activity.activity_type as PipelineStepType
    const meta = STEP_META_MAP[stepType]

    if (result === 'approved') {
      flowActivityRepo.updateStatus(activityId, StepStatus.COMPLETED)
      if (meta) {
        fileOperationService.writeFile(
          activity.project_id,
          '07_test_review',
          `${stepType}_approved_v${reviewRound}_${timestamp}.md`,
          modifiedContent
        )
      }
      const state = this.getPipelineState(activity.project_id)
      const step = state.steps.find(s => s.type === stepType)
      if (step) {
        step.status = StepStatus.COMPLETED
        step.updatedAt = new Date().toISOString()
        state.overallProgress = computeOverallProgress(state.steps)
        state.lastUpdatedAt = new Date().toISOString()
        pipelineStatusRepo.write(activity.project_id, state)
      }
    } else {
      if (meta) {
        fileOperationService.writeFile(
          activity.project_id,
          '07_test_review',
          `${stepType}_rejected_v${reviewRound}_${timestamp}.md`,
          comment ?? '审核退回'
        )
      }
      this.cascadeResetDownstream(activity.project_id, stepType)
    }
  }

  recoverOnStartup(projectId: string): void {
    const state = pipelineStatusRepo.read(projectId)
    if (state) {
      for (const step of state.steps) {
        if (step.status === StepStatus.RUNNING) {
          step.status = StepStatus.IDLE
          step.updatedAt = new Date().toISOString()
          const activity = flowActivityRepo.getByType(projectId, step.type)
          if (activity) {
            flowActivityRepo.updateStatus(activity.id, StepStatus.IDLE)
          }
        }
      }
      pipelineStatusRepo.write(projectId, state)
    } else {
      this.rebuildStateFromDirs(projectId)
    }
  }

  rebuildStateFromDirs(projectId: string): FlowPipelineState {
    const steps: PipelineStepState[] = []
    for (const type of Object.values(PipelineStepType)) {
      const meta = STEP_META_MAP[type]
      let status = StepStatus.IDLE
      if (meta.isImport) {
        status = fileOperationService.hasFiles(projectId, meta.outputDir)
          ? StepStatus.COMPLETED
          : StepStatus.IDLE
      } else if (meta.skillName) {
        status = fileOperationService.hasFiles(projectId, meta.outputDir)
          ? StepStatus.COMPLETED
          : StepStatus.IDLE
      }
      steps.push({
        type,
        status,
        updatedAt: status === StepStatus.COMPLETED ? new Date().toISOString() : '-',
        retryCount: 0,
        errorMessage: null,
        progress: status === StepStatus.COMPLETED ? 100 : 0,
        streamingContent: ''
      })
    }
    const overallProgress = computeOverallProgress(steps)
    const state: FlowPipelineState = {
      projectId,
      steps,
      overallProgress,
      lastUpdatedAt: new Date().toISOString()
    }
    pipelineStatusRepo.write(projectId, state)
    return state
  }

  private cascadeResetDownstream(projectId: string, stepType: PipelineStepType): void {
    const downstream = CASCADE_DOWNSTREAM[stepType]
    if (!downstream || downstream.length === 0) return

    const state = pipelineStatusRepo.read(projectId)
    if (!state) return

    for (const type of downstream) {
      const step = state.steps.find(s => s.type === type)
      if (step) {
        step.status = StepStatus.IDLE
        step.updatedAt = new Date().toISOString()
        step.retryCount = 0
        step.errorMessage = null
        step.progress = 0
        step.streamingContent = ''
      }
      const activity = flowActivityRepo.getByType(projectId, type)
      if (activity) {
        flowActivityRepo.updateStatus(activity.id, StepStatus.IDLE)
      }
    }
    state.overallProgress = computeOverallProgress(state.steps)
    state.lastUpdatedAt = new Date().toISOString()
    pipelineStatusRepo.write(projectId, state)
  }
}

export const testFlowPipelineService = new TestFlowPipelineService()
