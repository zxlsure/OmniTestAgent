import { BrowserWindow } from 'electron'
import { registerIpcHandler } from './helpers'
import { testFlowOrchestrator } from '../services/TestFlowOrchestrator'

export function registerTestflowHandler(): void {
  registerIpcHandler('testflow:execute', (params: any) => {
    const win = BrowserWindow.getFocusedWindow()!
    return testFlowOrchestrator.execute(params.projectId, params.activityType, win)
  })
  registerIpcHandler('testflow:interrupt', (activityId: string) => testFlowOrchestrator.interrupt(activityId))
  registerIpcHandler('testflow:review', (params: any) =>
    testFlowOrchestrator.review(params.activityId, params.result, params.comment, params.reviewer))
  registerIpcHandler('testflow:getStatus', (projectId: string) => testFlowOrchestrator.getStatus(projectId))
}
