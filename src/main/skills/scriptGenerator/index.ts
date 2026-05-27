import { BaseSkill } from '../baseSkill'
import type { SkillContext } from '../../services/SkillRegistry'

export class ScriptGeneratorSkill extends BaseSkill {
  name = 'scriptGenerator'
  displayName = '脚本生成'
  description = '基于测试用例，生成可执行测试脚本'

  protected buildPrompt(context: SkillContext): string {
    const preOutputs = this.readPreStepOutputs(context)
    return `你是一个专业的测试自动化工程师。请基于以下测试用例，生成可执行的自动化测试脚本。

项目ID: ${context.projectId}
输入数据: ${context.inputData ? JSON.stringify(context.inputData) : '无'}

## 前置步骤产出
${preOutputs}

请生成Python pytest格式的测试脚本，包含：
- 必要的import语句
- fixture定义
- 每个测试用例对应的测试函数
- 断言语句
- 注释说明`
  }

  protected getArtifactType(): string {
    return 'test_script'
  }

  protected buildOutput(result: string): unknown {
    return { script: result }
  }
}
