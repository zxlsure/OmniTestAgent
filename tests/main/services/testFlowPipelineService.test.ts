// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PipelineStepType, StepStatus,
  type FlowPipelineState, type PipelineStepState
} from '../../../src/main/data/types/pipeline'

vi.mock('../../../src/main/data/repositories/PipelineStatusRepo', () => ({
  pipelineStatusRepo: {
    read: vi.fn(),
    write: vi.fn(),
    exists: vi.fn(),
    init: vi.fn()
  }
}))

vi.mock('../../../src/main/services/FileOperationService', () => ({
  fileOperationService: {
    hasFiles: vi.fn(),
    writeFile: vi.fn(),
    ensureProjectDirs: vi.fn()
  }
}))

vi.mock('../../../src/main/data/repositories/FlowActivityRepo', () => ({
  flowActivityRepo: {
    getByType: vi.fn(),
    updateStatus: vi.fn(),
    getById: vi.fn(),
    addReview: vi.fn(),
    getReviews: vi.fn()
  }
}))

vi.mock('../../../src/main/services/SkillEngine', () => ({
  skillEngine: {
    execute: vi.fn()
  }
}))

vi.mock('../../../src/main/services/TestFlowOrchestrator', () => ({
  testFlowOrchestrator: {
    interrupt: vi.fn()
  }
}))

vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: vi.fn() }
}))

vi.mock('../../../src/main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { pipelineStatusRepo } from '../../../src/main/data/repositories/PipelineStatusRepo'
import { fileOperationService } from '../../../src/main/services/FileOperationService'
import { flowActivityRepo } from '../../../src/main/data/repositories/FlowActivityRepo'
import { TestFlowPipelineService } from '../../../src/main/services/TestFlowPipelineService'

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

function makeState(overrides?: Partial<FlowPipelineState>): FlowPipelineState {
  const steps = createInitialSteps()
  return {
    projectId: 'test-project',
    steps,
    overallProgress: 0,
    lastUpdatedAt: new Date().toISOString(),
    ...overrides
  }
}

function setStepStatus(state: FlowPipelineState, type: PipelineStepType, status: StepStatus, extra?: Partial<PipelineStepState>): void {
  const step = state.steps.find(s => s.type === type)
  if (step) {
    step.status = status
    step.updatedAt = new Date().toISOString()
    if (extra) Object.assign(step, extra)
  }
}

describe('TestFlowPipelineService', () => {
  let service: TestFlowPipelineService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TestFlowPipelineService()
    pipelineStatusRepo.read = vi.fn().mockReturnValue(null)
    pipelineStatusRepo.write = vi.fn().mockReturnValue(undefined)
    fileOperationService.hasFiles = vi.fn().mockReturnValue(false)
    flowActivityRepo.getByType = vi.fn().mockReturnValue(null)
    flowActivityRepo.getById = vi.fn().mockReturnValue(null)
  })

  describe('状态机流转', () => {
    it('idle -> running -> completed 流转正确', () => {
      const state = makeState()
      pipelineStatusRepo.read = vi.fn().mockReturnValue(state)

      service.updateStepStatus('test-project', PipelineStepType.REQUIREMENT_IMPORT, StepStatus.RUNNING)
      expect(pipelineStatusRepo.write).toHaveBeenCalled()
      const writtenState1 = (pipelineStatusRepo.write as ReturnType<typeof vi.fn>).mock.calls[0][1] as FlowPipelineState
      const step1 = writtenState1.steps.find(s => s.type === PipelineStepType.REQUIREMENT_IMPORT)
      expect(step1?.status).toBe(StepStatus.RUNNING)
      expect(step1?.progress).toBe(0)

      pipelineStatusRepo.read = vi.fn().mockReturnValue(writtenState1)
      service.updateStepStatus('test-project', PipelineStepType.REQUIREMENT_IMPORT, StepStatus.COMPLETED)
      const writtenState2 = (pipelineStatusRepo.write as ReturnType<typeof vi.fn>).mock.calls[1][1] as FlowPipelineState
      const step2 = writtenState2.steps.find(s => s.type === PipelineStepType.REQUIREMENT_IMPORT)
      expect(step2?.status).toBe(StepStatus.COMPLETED)
      expect(step2?.progress).toBe(100)
      expect(step2?.retryCount).toBe(0)
    })

    it('idle -> running -> failed 流转正确', () => {
      const state = makeState()
      pipelineStatusRepo.read = vi.fn().mockReturnValue(state)

      service.updateStepStatus('test-project', PipelineStepType.REQUIREMENT_ANALYSIS, StepStatus.RUNNING)
      const writtenState1 = (pipelineStatusRepo.write as ReturnType<typeof vi.fn>).mock.calls[0][1] as FlowPipelineState
      const step1 = writtenState1.steps.find(s => s.type === PipelineStepType.REQUIREMENT_ANALYSIS)
      expect(step1?.status).toBe(StepStatus.RUNNING)

      pipelineStatusRepo.read = vi.fn().mockReturnValue(writtenState1)
      service.updateStepStatus('test-project', PipelineStepType.REQUIREMENT_ANALYSIS, StepStatus.FAILED, '解析失败')
      const writtenState2 = (pipelineStatusRepo.write as ReturnType<typeof vi.fn>).mock.calls[1][1] as FlowPipelineState
      const step2 = writtenState2.steps.find(s => s.type === PipelineStepType.REQUIREMENT_ANALYSIS)
      expect(step2?.status).toBe(StepStatus.FAILED)
      expect(step2?.errorMessage).toBe('解析失败')
      expect(step2?.retryCount).toBe(1)
    })
  })

  describe('前置依赖检查', () => {
    it('依赖未完成时 checkDependencies 返回 false', () => {
      const state = makeState()
      const result = service.checkDependencies(PipelineStepType.REQUIREMENT_ANALYSIS, state)
      expect(result).toBe(false)
    })

    it('依赖已完成时 checkDependencies 返回 true', () => {
      const state = makeState()
      setStepStatus(state, PipelineStepType.REQUIREMENT_IMPORT, StepStatus.COMPLETED)
      const result = service.checkDependencies(PipelineStepType.REQUIREMENT_ANALYSIS, state)
      expect(result).toBe(true)
    })

    it('无依赖的步骤始终返回 true', () => {
      const state = makeState()
      expect(service.checkDependencies(PipelineStepType.REQUIREMENT_IMPORT, state)).toBe(true)
      expect(service.checkDependencies(PipelineStepType.SPEC_IMPORT, state)).toBe(true)
    })

    it('多依赖步骤需全部完成', () => {
      const state = makeState()
      setStepStatus(state, PipelineStepType.REQUIREMENT_ANALYSIS, StepStatus.COMPLETED)
      expect(service.checkDependencies(PipelineStepType.TEST_DESIGN, state)).toBe(true)
    })
  })

  describe('级联恢复逻辑', () => {
    it('recoverOnStartup 将 RUNNING 状态重置为 IDLE', () => {
      const state = makeState()
      setStepStatus(state, PipelineStepType.REQUIREMENT_ANALYSIS, StepStatus.RUNNING)
      pipelineStatusRepo.read = vi.fn().mockReturnValue(state)
      flowActivityRepo.getByType = vi.fn().mockReturnValue({ id: 'act-1', activity_type: PipelineStepType.REQUIREMENT_ANALYSIS })

      service.recoverOnStartup('test-project')

      const writtenState = (pipelineStatusRepo.write as ReturnType<typeof vi.fn>).mock.calls[0][1] as FlowPipelineState
      const step = writtenState.steps.find(s => s.type === PipelineStepType.REQUIREMENT_ANALYSIS)
      expect(step?.status).toBe(StepStatus.IDLE)
    })

    it('recoverOnStartup 保留非 RUNNING 状态不变', () => {
      const state = makeState()
      setStepStatus(state, PipelineStepType.REQUIREMENT_IMPORT, StepStatus.COMPLETED)
      setStepStatus(state, PipelineStepType.REQUIREMENT_ANALYSIS, StepStatus.FAILED)
      pipelineStatusRepo.read = vi.fn().mockReturnValue(state)

      service.recoverOnStartup('test-project')

      const writtenState = (pipelineStatusRepo.write as ReturnType<typeof vi.fn>).mock.calls[0][1] as FlowPipelineState
      const completedStep = writtenState.steps.find(s => s.type === PipelineStepType.REQUIREMENT_IMPORT)
      const failedStep = writtenState.steps.find(s => s.type === PipelineStepType.REQUIREMENT_ANALYSIS)
      expect(completedStep?.status).toBe(StepStatus.COMPLETED)
      expect(failedStep?.status).toBe(StepStatus.FAILED)
    })
  })

  describe('导入状态自动检测', () => {
    it('目录有文件时导入步骤标记为 COMPLETED', () => {
      const state = makeState()
      pipelineStatusRepo.read = vi.fn().mockReturnValue(state)
      fileOperationService.hasFiles = vi.fn().mockReturnValue(true)

      service.detectImportStatus('test-project', state)

      const importStep = state.steps.find(s => s.type === PipelineStepType.REQUIREMENT_IMPORT)
      expect(importStep?.status).toBe(StepStatus.COMPLETED)
    })

    it('目录无文件时导入步骤标记为 IDLE', () => {
      const state = makeState()
      setStepStatus(state, PipelineStepType.REQUIREMENT_IMPORT, StepStatus.COMPLETED)
      pipelineStatusRepo.read = vi.fn().mockReturnValue(state)
      fileOperationService.hasFiles = vi.fn().mockReturnValue(false)

      service.detectImportStatus('test-project', state)

      const importStep = state.steps.find(s => s.type === PipelineStepType.REQUIREMENT_IMPORT)
      expect(importStep?.status).toBe(StepStatus.IDLE)
    })

    it('非导入步骤不受影响', () => {
      const state = makeState()
      setStepStatus(state, PipelineStepType.REQUIREMENT_ANALYSIS, StepStatus.RUNNING)
      fileOperationService.hasFiles = vi.fn().mockReturnValue(true)

      service.detectImportStatus('test-project', state)

      const analysisStep = state.steps.find(s => s.type === PipelineStepType.REQUIREMENT_ANALYSIS)
      expect(analysisStep?.status).toBe(StepStatus.RUNNING)
    })
  })

  describe('getPipelineState', () => {
    it('状态文件不存在时通过目录重建', () => {
      pipelineStatusRepo.read = vi.fn().mockReturnValue(null)
      fileOperationService.hasFiles = vi.fn().mockReturnValue(false)

      const result = service.getPipelineState('test-project')

      expect(result.projectId).toBe('test-project')
      expect(result.steps).toHaveLength(Object.values(PipelineStepType).length)
      expect(pipelineStatusRepo.write).toHaveBeenCalled()
    })

    it('状态文件存在时自动检测导入状态', () => {
      const state = makeState()
      pipelineStatusRepo.read = vi.fn().mockReturnValue(state)
      fileOperationService.hasFiles = vi.fn().mockReturnValue(true)

      const result = service.getPipelineState('test-project')

      const importStep = result.steps.find(s => s.type === PipelineStepType.REQUIREMENT_IMPORT)
      expect(importStep?.status).toBe(StepStatus.COMPLETED)
    })
  })
})
