import { ISkill, SkillContext, SkillResult } from '../../services/SkillRegistry'

export class RequirementParserSkill implements ISkill {
  name = 'requirementParser'
  displayName = '需求解析'
  description = '解析需求文档，提取测试点和测试需求'
  isBuiltin = true

  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      const prompt = this.buildPrompt(context)
      if (!context.llmService) {
        return { success: false, error: 'LLM服务不可用' }
      }
      const result = await context.llmService.chat({
        sessionId: `skill-${this.name}-${Date.now()}`,
        message: prompt,
        projectId: context.projectId
      })
      return {
        success: true,
        output: { analysis: result },
        artifacts: [{ type: 'requirement_analysis', content: result }]
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private buildPrompt(context: SkillContext): string {
    return `你是一个专业的测试需求分析师。请分析以下需求，提取关键测试点、功能测试需求和非功能测试需求。

项目ID: ${context.projectId}
输入数据: ${context.inputData ? JSON.stringify(context.inputData) : '无'}

请按以下格式输出：
1. 关键测试点列表
2. 功能测试需求
3. 非功能测试需求（性能、安全、兼容性等）
4. 测试优先级建议`
  }
}
