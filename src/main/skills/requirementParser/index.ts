import { BaseSkill } from '../baseSkill'
import type { SkillContext } from '../../services/SkillRegistry'

export class RequirementParserSkill extends BaseSkill {
  name = 'requirementParser'
  displayName = '需求解析'
  description = '解析需求文档，提取测试点和测试需求'

  protected buildPrompt(context: SkillContext): string {
    const preOutputs = this.readPreStepOutputs(context)
    return `你是一个专业的测试需求分析师。请分析以下需求，提取关键测试点、功能测试需求和非功能测试需求。

项目ID: ${context.projectId}
输入数据: ${context.inputData ? JSON.stringify(context.inputData) : '无'}

## 前置步骤产出
${preOutputs}

请按以下格式输出：
1. 关键测试点列表
2. 功能测试需求
3. 非功能测试需求（性能、安全、兼容性等）
4. 测试优先级建议`
  }

  protected getArtifactType(): string {
    return 'requirement_analysis'
  }

  protected buildOutput(result: string): unknown {
    return { analysis: result }
  }
}
