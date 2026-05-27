import type { SkillContext, SkillResult } from '../services/SkillRegistry'

export abstract class BaseSkill {
  abstract name: string
  abstract displayName: string
  abstract description: string
  isBuiltin = true

  async execute(context: SkillContext): Promise<SkillResult> {
    if (!context.llmService) {
      return { success: false, error: 'LLM服务不可用' }
    }
    try {
      const prompt = this.buildPrompt(context)
      const result = await context.llmService.chat({
        sessionId: `skill-${this.name}-${Date.now()}`,
        message: prompt,
        projectId: context.projectId
      })
      return {
        success: true,
        output: this.buildOutput(result),
        artifacts: [{ type: this.getArtifactType(), data: result }]
      }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  protected readPreStepOutputs(context: SkillContext): string {
    if (!context.preStepOutputs || context.preStepOutputs.length === 0) {
      return '（无前置步骤产出）'
    }
    return context.preStepOutputs
      .map(item => `## 目录: ${item.dir}\n${item.content}`)
      .join('\n\n')
  }

  protected abstract buildPrompt(context: SkillContext): string
  protected abstract getArtifactType(): string
  protected abstract buildOutput(result: string): unknown
}
