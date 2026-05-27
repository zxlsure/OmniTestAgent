import { BrowserWindow } from 'electron'
import { registerIpcHandler } from './helpers'
import { testFlowPipelineService } from '../services/TestFlowPipelineService'
import type { PipelineStepType, ReviewResult } from '../data/types/pipeline'

export function registerPipelineHandler(): void {
  registerIpcHandler('pipeline:getState', (projectId: string) =>
    testFlowPipelineService.getPipelineState(projectId))

  registerIpcHandler('pipeline:executeStep',
    (params: { projectId: string; stepType: PipelineStepType }) => {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) throw new Error('No focused window available')
      return testFlowPipelineService.executeStep(params.projectId, params.stepType, win)
    })

  registerIpcHandler('pipeline:interruptStep', (activityId: string) =>
    testFlowPipelineService.interruptStep(activityId))

  registerIpcHandler('pipeline:reviewStep',
    (params: { activityId: string; result: ReviewResult; modifiedContent: string; comment?: string; reviewer?: string }) =>
      testFlowPipelineService.reviewStep(
        params.activityId, params.result, params.modifiedContent, params.comment, params.reviewer))

  registerIpcHandler('pipeline:retryStep',
    (params: { projectId: string; stepType: PipelineStepType }) => {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) throw new Error('No focused window available')
      return testFlowPipelineService.retryStep(params.projectId, params.stepType, win)
    })
}
