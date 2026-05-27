import { join } from 'path'
import { fileOperationRepo } from './FileOperationRepo'
import {
  PipelineStepType, StepStatus, STEP_META_MAP, STATUS_MARK_MAP, STATUS_FROM_MARK,
  STATUS_FILE_NAME,
  type FlowPipelineState, type PipelineStepState
} from '../types/pipeline'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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

export class PipelineStatusRepo {
  private getFilePath(projectId: string): string {
    return join(fileOperationRepo.getTestDesignDir(projectId), STATUS_FILE_NAME)
  }

  read(projectId: string): FlowPipelineState | null {
    const filePath = this.getFilePath(projectId)
    if (!fileOperationRepo.exists(filePath)) return null
    try {
      const content = fileOperationRepo.readTextFile(filePath)
      return this.parseFromMarkdown(projectId, content)
    } catch {
      return null
    }
  }

  write(projectId: string, state: FlowPipelineState): void {
    const filePath = this.getFilePath(projectId)
    const content = this.serializeToMarkdown(state)
    fileOperationRepo.writeTextFile(filePath, content)
  }

  init(projectId: string): void {
    const dir = fileOperationRepo.getTestDesignDir(projectId)
    fileOperationRepo.ensureDir(dir)
    const steps = createInitialSteps()
    const state: FlowPipelineState = {
      projectId,
      steps,
      overallProgress: 0,
      lastUpdatedAt: new Date().toISOString()
    }
    this.write(projectId, state)
  }

  exists(projectId: string): boolean {
    return fileOperationRepo.exists(this.getFilePath(projectId))
  }

  private serializeToMarkdown(state: FlowPipelineState): string {
    const completedCount = state.steps.filter(s => s.status === StepStatus.COMPLETED).length
    const total = state.steps.length
    const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0

    let md = `# 测试设计流程状态\n\n`
    md += `> 自动生成，请勿手动修改\n`
    md += `> 最后更新：${formatDateTime(state.lastUpdatedAt)}\n\n`
    md += `## 流水线进展\n\n`
    md += `**整体进度**：${progress}% (${completedCount}/${total})\n\n`
    md += `## 环节状态\n\n`
    md += `| # | 环节 | 状态 | 更新时间 | 备注 |\n`
    md += `|---|------|------|----------|------|\n`

    state.steps.forEach((step, index) => {
      const label = STEP_META_MAP[step.type].label
      const statusMark = STATUS_MARK_MAP[step.status]
      const time = step.updatedAt && step.updatedAt !== '-' ? formatDateTime(step.updatedAt) : '-'
      const note = step.errorMessage ?? ''
      md += `| ${index + 1} | ${label} | ${statusMark} | ${time} | ${note} |\n`
    })

    return md
  }

  private parseFromMarkdown(projectId: string, content: string): FlowPipelineState | null {
    try {
      const steps: PipelineStepState[] = []
      const lines = content.split('\n')
      const tableLineRegex = /^\|\s*\d+\s*\|/
      const allStepTypes = Object.values(PipelineStepType)

      for (const line of lines) {
        if (!tableLineRegex.test(line)) continue
        const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0)
        if (cells.length < 3) continue

        const labelCell = cells[1]
        const statusCell = cells[2]
        const timeCell = cells.length > 3 ? cells[3] : '-'

        const matchedType = allStepTypes.find(t => STEP_META_MAP[t].label === labelCell)
        if (!matchedType) continue

        const status = STATUS_FROM_MARK[statusCell] ?? StepStatus.IDLE
        steps.push({
          type: matchedType,
          status,
          updatedAt: timeCell === '-' ? '-' : new Date().toISOString(),
          retryCount: 0,
          errorMessage: null,
          progress: status === StepStatus.COMPLETED ? 100 : 0,
          streamingContent: ''
        })
      }

      if (steps.length === 0) return null

      const completedCount = steps.filter(s => s.status === StepStatus.COMPLETED).length
      const overallProgress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

      return {
        projectId,
        steps,
        overallProgress,
        lastUpdatedAt: new Date().toISOString()
      }
    } catch {
      return null
    }
  }
}

export const pipelineStatusRepo = new PipelineStatusRepo()
