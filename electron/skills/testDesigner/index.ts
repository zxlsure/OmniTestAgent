import { ISkill, SkillContext, SkillResult } from '../../services/SkillRegistry'

export class TestDesignerSkill implements ISkill {
  name = 'testDesigner'
  displayName = '测试设计'
  description = '基于需求分析结果，生成测试设计方案'
  isBuiltin = true

  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      const prompt = `你是一个专业的测试设计师。请基于以下需求分析结果，生成测试设计方案。

项目ID: ${context.projectId}
输入数据: ${context.inputData ? JSON.stringify(context.inputData) : '无'}

请按以下格式输出：
1. 测试策略（测试类型、测试层级）
2. 测试场景设计
3. 测试数据需求
4. 测试环境需求
5. 风险评估和应对策略`

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
        output: { design: result },
        artifacts: [{ type: 'test_design', content: result }]
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}
