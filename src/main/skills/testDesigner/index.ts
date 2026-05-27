import { BaseSkill } from '../baseSkill'
import type { SkillContext } from '../../services/SkillRegistry'

export class TestDesignerSkill extends BaseSkill {
  name = 'testDesigner'
  displayName = '测试设计'
  description = '基于需求分析结果，生成测试设计方案'

  protected buildPrompt(context: SkillContext): string {
    const preOutputs = this.readPreStepOutputs(context)
    return `你是一个专业的测试设计师。请基于以下需求分析结果，生成测试设计方案。

项目ID: ${context.projectId}
输入数据: ${context.inputData ? JSON.stringify(context.inputData) : '无'}

## 前置步骤产出
${preOutputs}

请按以下格式输出：
1. 测试策略（测试类型、测试层级）
2. 测试场景设计
3. 测试数据需求
4. 测试环境需求
5. 风险评估和应对策略`
  }

  protected getArtifactType(): string {
    return 'test_design'
  }

  protected buildOutput(result: string): unknown {
    return { design: result }
  }
}
