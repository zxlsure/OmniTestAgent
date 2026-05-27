import { flowActivityRepo, FlowActivity } from '../data/repositories/FlowActivityRepo'
import { testCaseRepo } from '../data/repositories/TestCaseRepo'
import { skillEngine } from './SkillEngine'
import { BrowserWindow } from 'electron'
import { logger } from '../utils/logger'

export const ACTIVITY_SEQUENCE = [
  'requirement_import',
  'requirement_analysis',
  'requirement_review',
  'test_design',
  'design_review',
  'case_generation',
  'case_review',
  'script_generation',
  'script_debug'
] as const

export type ActivityType = typeof ACTIVITY_SEQUENCE[number]

const ACTIVITY_SKILL_MAP: Record<string, string> = {
  requirement_analysis: 'requirementParser',
  test_design: 'testDesigner',
  case_generation: 'caseGenerator',
  script_generation: 'scriptGenerator'
}

const REVIEW_ACTIVITIES = new Set(['requirement_review', 'design_review', 'case_review'])

/**
 * @deprecated 使用 TestFlowPipelineService 替代。此类将在后续版本中移除。
 */
export class TestFlowOrchestrator {
  /**
   * @deprecated 使用 testFlowPipelineService.getPipelineState 替代
   */
  getStatus(projectId: string): FlowActivity[] {
    const activities = flowActivityRepo.listByProject(projectId)
    if (activities.length === 0) {
      for (const type of ACTIVITY_SEQUENCE) {
        flowActivityRepo.create(projectId, type)
      }
      return flowActivityRepo.listByProject(projectId)
    }
    return activities
  }

  /**
   * @deprecated 使用 testFlowPipelineService.executeStep 替代
   */
  async execute(projectId: string, activityType: string, win: BrowserWindow): Promise<void> {
    const index = ACTIVITY_SEQUENCE.indexOf(activityType as any)
    if (index < 0) throw new Error(`Invalid activity type: ${activityType}`)

    if (REVIEW_ACTIVITIES.has(activityType)) {
      throw new Error('审核活动不可自动执行，请通过审核操作完成')
    }

    if (index > 0) {
      const prevType = ACTIVITY_SEQUENCE[index - 1]
      const prevActivity = flowActivityRepo.getByType(projectId, prevType)
      if (!prevActivity || prevActivity.status !== 'completed') {
        throw new Error(`前序活动 ${prevType} 尚未完成，无法执行当前活动`)
      }
      if (REVIEW_ACTIVITIES.has(prevType) && prevActivity.status === 'completed') {
        const reviews = flowActivityRepo.getReviews(prevActivity.id)
        const approved = reviews.some(r => r.result === 'approved')
        if (!approved) throw new Error(`前序审核 ${prevType} 尚未通过，无法执行当前活动`)
      }
    }

    const activity = flowActivityRepo.getByType(projectId, activityType)
    if (!activity) throw new Error(`Activity not found: ${activityType}`)
    if (activity.status === 'running') throw new Error('活动正在执行中')

    flowActivityRepo.updateStatus(activity.id, 'running')
    win.webContents.send('testflow:progress', {
      activityId: activity.id, activityType, status: 'running', progress: 0
    })

    try {
      const skillName = ACTIVITY_SKILL_MAP[activityType]
      if (skillName) {
        const result = await skillEngine.execute(skillName, {
          projectId,
          inputData: activity.input_data ? (() => { try { return JSON.parse(activity.input_data) } catch (e) { logger.error(`Failed to parse input_data for activity ${activity.id}:`, e); return null } })() : null
        })

        if (result.success) {
          flowActivityRepo.updateStatus(activity.id, 'completed', {
            outputData: JSON.stringify(result.output)
          })
          win.webContents.send('testflow:progress', {
            activityId: activity.id, activityType, status: 'completed', progress: 100, output: result.output
          })
        } else {
          flowActivityRepo.updateStatus(activity.id, 'failed')
          win.webContents.send('testflow:progress', {
            activityId: activity.id, activityType, status: 'failed', error: result.error
          })
        }
      } else {
        flowActivityRepo.updateStatus(activity.id, 'completed')
        win.webContents.send('testflow:progress', {
          activityId: activity.id, activityType, status: 'completed', progress: 100
        })
      }
    } catch (error: any) {
      flowActivityRepo.updateStatus(activity.id, 'failed')
      win.webContents.send('testflow:progress', {
        activityId: activity.id, activityType, status: 'failed', error: error.message
      })
    }
  }

  /**
   * @deprecated 使用 testFlowPipelineService.interruptStep 替代
   */
  interrupt(activityId: string): void {
    const activity = flowActivityRepo.getById(activityId)
    if (!activity) throw new Error('Activity not found')
    if (activity.status !== 'running') throw new Error('只能打断正在执行的活动')
    flowActivityRepo.updateStatus(activityId, 'idle')
    logger.info(`Activity interrupted: ${activityId}`)
  }

  /**
   * @deprecated 使用 testFlowPipelineService.reviewStep 替代
   */
  review(activityId: string, result: 'approved' | 'rejected', comment?: string, reviewer?: string): void {
    const activity = flowActivityRepo.getById(activityId)
    if (!activity) throw new Error('Activity not found')
    if (!REVIEW_ACTIVITIES.has(activity.activity_type)) {
      throw new Error('当前活动不是审核环节')
    }
    flowActivityRepo.addReview(activityId, result, comment, reviewer)
    if (result === 'approved') {
      flowActivityRepo.updateStatus(activityId, 'completed')
    }
    logger.info(`Review ${result} for activity: ${activityId}`)
  }

  recover(projectId: string): void {
    const count = flowActivityRepo.resetRunningToIdle(projectId)
    if (count > 0) {
      logger.info(`Recovered ${count} running activities to idle for project: ${projectId}`)
    }
  }
}

export const testFlowOrchestrator = new TestFlowOrchestrator()
