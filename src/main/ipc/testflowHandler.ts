import { BrowserWindow } from 'electron'
import { registerIpcHandler } from './helpers'
import { testFlowPipelineService } from '../services/TestFlowPipelineService'
import { STEP_META_MAP, PipelineStepType, StepStatus } from '../data/types/pipeline'

export function registerTestflowHandler(): void {
  registerIpcHandler('testflow:execute', (params: { projectId: string; activityType: string }) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) throw new Error('No focused window available')
    const stepType = params.activityType as PipelineStepType
    return testFlowPipelineService.executeStep(params.projectId, stepType, win)
  })
  registerIpcHandler('testflow:interrupt', (activityId: string) =>
    testFlowPipelineService.interruptStep(activityId))
  registerIpcHandler('testflow:review', (params: { activityId: string; result: 'approved' | 'rejected'; comment?: string; reviewer?: string }) =>
    testFlowPipelineService.reviewStep(params.activityId, params.result, '', params.comment, params.reviewer))
  registerIpcHandler('testflow:getStatus', (projectId: string) =>
    testFlowPipelineService.getPipelineState(projectId))
}
