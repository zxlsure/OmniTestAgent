import { ISkill, SkillContext, SkillResult } from '../../services/SkillRegistry'

export class ScriptGeneratorSkill implements ISkill {
  name = 'scriptGenerator'
  displayName = '脚本生成'
  description = '基于测试用例，生成可执行测试脚本'
  isBuiltin = true

  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      const prompt = `你是一个专业的测试自动化工程师。请基于以下测试用例，生成可执行的自动化测试脚本。

项目ID: ${context.projectId}
输入数据: ${context.inputData ? JSON.stringify(context.inputData) : '无'}

请生成Python pytest格式的测试脚本，包含：
- 必要的import语句
- fixture定义
- 每个测试用例对应的测试函数
- 断言语句
- 注释说明`

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
        output: { script: result },
        artifacts: [{ type: 'test_script', content: result }]
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}
