import { BaseSkill } from '../baseSkill'
import type { SkillContext } from '../../services/SkillRegistry'

export class CaseGeneratorSkill extends BaseSkill {
  name = 'caseGenerator'
  displayName = '用例生成'
  description = '基于测试设计方案，生成详细测试用例'

  protected buildPrompt(context: SkillContext): string {
    const preOutputs = this.readPreStepOutputs(context)
    return `你是一个专业的测试用例设计专家。请基于以下测试设计方案，生成详细的测试用例集。

项目ID: ${context.projectId}
输入数据: ${context.inputData ? JSON.stringify(context.inputData) : '无'}

## 前置步骤产出
${preOutputs}

请按以下格式为每个用例输出：
- 用例编号
- 用例标题
- 前置条件
- 测试步骤
- 预期结果
- 优先级（P0/P1/P2/P3）
- 测试类型（功能/性能/安全/兼容性）`
  }

  protected getArtifactType(): string {
    return 'test_cases'
  }

  protected buildOutput(result: string): unknown {
    return { cases: result }
  }
}
