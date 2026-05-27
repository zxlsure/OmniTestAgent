// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  PipelineStepType, StepStatus,
  type FlowPipelineState, type PipelineStepState
} from '../../../src/renderer/types/testflow-pipeline'

const mockGetState = vi.fn()
const mockExecuteStep = vi.fn()
const mockRetryStep = vi.fn()
const mockOnProgress = vi.fn()
const mockRemoveProgressListeners = vi.fn()

beforeEach(() => {
  vi.stubGlobal('window', {
    electronAPI: {
      pipeline: {
        getState: mockGetState,
        executeStep: mockExecuteStep,
        retryStep: mockRetryStep,
        onProgress: mockOnProgress,
        removeProgressListeners: mockRemoveProgressListeners,
        interruptStep: vi.fn(),
        reviewStep: vi.fn()
      },
      fileOp: {
        listFiles: vi.fn().mockResolvedValue([]),
        readFileContent: vi.fn().mockResolvedValue({ content: '', fileType: 'text' }),
        uploadFiles: vi.fn(),
        showOpenDialog: vi.fn().mockResolvedValue([])
      }
    }
  })
})

import { useTestFlowPipelineStore } from '../../../src/renderer/store/useTestFlowPipelineStore'

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
  return {
    projectId: 'test-project',
    steps: createInitialSteps(),
    overallProgress: 0,
    lastUpdatedAt: new Date().toISOString(),
    ...overrides
  }
}

describe('useTestFlowPipelineStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetState.mockReset()
    mockExecuteStep.mockReset()
    mockRetryStep.mockReset()
    mockOnProgress.mockReset()
    mockRemoveProgressListeners.mockReset()
  })

  describe('canExecute', () => {
    it('IDLE 且依赖满足时可执行', () => {
      const state = makeState()
      const importStep = state.steps.find(s => s.type === PipelineStepType.REQUIREMENT_IMPORT)!
      importStep.status = StepStatus.COMPLETED

      mockGetState.mockResolvedValue(state)
      const store = useTestFlowPipelineStore()
      store.pipelineState = state

      expect(store.canExecute(PipelineStepType.REQUIREMENT_ANALYSIS)).toBe(true)
    })

    it('RUNNING 状态不可执行', () => {
      const state = makeState()
      const step = state.steps.find(s => s.type === PipelineStepType.REQUIREMENT_ANALYSIS)!
      step.status = StepStatus.RUNNING

      const store = useTestFlowPipelineStore()
      store.pipelineState = state

      expect(store.canExecute(PipelineStepType.REQUIREMENT_ANALYSIS)).toBe(false)
    })

    it('COMPLETED 状态不可执行', () => {
      const state = makeState()
      const step = state.steps.find(s => s.type === PipelineStepType.REQUIREMENT_IMPORT)!
      step.status = StepStatus.COMPLETED

      const store = useTestFlowPipelineStore()
      store.pipelineState = state

      expect(store.canExecute(PipelineStepType.REQUIREMENT_IMPORT)).toBe(false)
    })

    it('依赖未满足时不可执行', () => {
      const state = makeState()
      const store = useTestFlowPipelineStore()
      store.pipelineState = state

      expect(store.canExecute(PipelineStepType.REQUIREMENT_ANALYSIS)).toBe(false)
    })

    it('无依赖步骤在 IDLE 时可执行', () => {
      const state = makeState()
      const store = useTestFlowPipelineStore()
      store.pipelineState = state

      expect(store.canExecute(PipelineStepType.REQUIREMENT_IMPORT)).toBe(true)
      expect(store.canExecute(PipelineStepType.SPEC_IMPORT)).toBe(true)
    })
  })

  describe('canRetry', () => {
    it('FAILED 且 retryCount < 3 可重试', () => {
      const state = makeState()
      const step = state.steps.find(s => s.type === PipelineStepType.REQUIREMENT_ANALYSIS)!
      step.status = StepStatus.FAILED
      step.retryCount = 1

      const store = useTestFlowPipelineStore()
      store.pipelineState = state

      expect(store.canRetry(PipelineStepType.REQUIREMENT_ANALYSIS)).toBe(true)
    })

    it('FAILED 且 retryCount >= 3 不可重试', () => {
      const state = makeState()
      const step = state.steps.find(s => s.type === PipelineStepType.REQUIREMENT_ANALYSIS)!
      step.status = StepStatus.FAILED
      step.retryCount = 3

      const store = useTestFlowPipelineStore()
      store.pipelineState = state

      expect(store.canRetry(PipelineStepType.REQUIREMENT_ANALYSIS)).toBe(false)
    })

    it('非 FAILED 状态不可重试', () => {
      const state = makeState()
      const store = useTestFlowPipelineStore()
      store.pipelineState = state

      expect(store.canRetry(PipelineStepType.REQUIREMENT_ANALYSIS)).toBe(false)
      expect(store.canRetry(PipelineStepType.REQUIREMENT_IMPORT)).toBe(false)
    })
  })

  describe('fetchPipelineState', () => {
    it('成功时更新 pipelineState', async () => {
      const fakeState = makeState()
      mockGetState.mockResolvedValue(fakeState)

      const store = useTestFlowPipelineStore()
      await store.fetchPipelineState('test-project')

      expect(store.pipelineState).toEqual(fakeState)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('失败时设置 error 且 pipelineState 不变', async () => {
      mockGetState.mockRejectedValue(new Error('IPC error'))

      const store = useTestFlowPipelineStore()
      await store.fetchPipelineState('test-project')

      expect(store.error).toBe('IPC error')
      expect(store.loading).toBe(false)
    })
  })

  describe('get_pipeline_status工具返回流水线状态', () => {
    it('返回包含steps和overallProgress的状态', async () => {
      const state = makeState({
        overallProgress: 50,
        steps: createInitialSteps().map((s, i) =>
          i < 4 ? { ...s, status: StepStatus.COMPLETED } : s
        )
      })
      mockGetState.mockResolvedValue(state)

      const store = useTestFlowPipelineStore()
      await store.fetchPipelineState('test-project')

      expect(store.pipelineState).toBeTruthy()
      expect(store.pipelineState?.overallProgress).toBe(50)
      expect(store.pipelineState?.steps).toBeTruthy()
    })
  })
})
