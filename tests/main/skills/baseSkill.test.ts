import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../src/main/services/SkillRegistry', () => ({}))

import { BaseSkill } from '../../../src/main/skills/baseSkill'

interface SkillContext {
  projectId: string
  inputData?: unknown
  llmService?: { chat: (params: any) => Promise<string> }
}

class TestSkill extends BaseSkill {
  name = 'test-skill'
  displayName = 'Test Skill'
  description = 'A test skill'
  isBuiltin = true

  protected buildPrompt(_context: SkillContext): string {
    return 'test prompt'
  }

  protected getArtifactType(): string {
    return 'test-artifact'
  }

  protected buildOutput(result: string): unknown {
    return result
  }
}

describe('BaseSkill', () => {
  it('execute 在无 llmService 时返回 success: false', async () => {
    const skill = new TestSkill()
    const context: SkillContext = { projectId: 'p1' }
    const result = await skill.execute(context as any)
    expect(result.success).toBe(false)
    expect(result.error).toBe('LLM服务不可用')
  })

  it('execute 正常调用 llmService.chat', async () => {
    const skill = new TestSkill()
    const mockChat = vi.fn().mockResolvedValue('llm response')
    const context: SkillContext = {
      projectId: 'p1',
      llmService: { chat: mockChat }
    }
    const result = await skill.execute(context as any)
    expect(result.success).toBe(true)
    expect(mockChat).toHaveBeenCalledTimes(1)
    expect(result.output).toBe('llm response')
    expect(result.artifacts).toBeDefined()
    expect(result.artifacts![0].type).toBe('test-artifact')
  })

  it('execute 在 llmService.chat 抛出异常时返回 success: false', async () => {
    const skill = new TestSkill()
    const mockChat = vi.fn().mockRejectedValue(new Error('LLM error'))
    const context: SkillContext = {
      projectId: 'p1',
      llmService: { chat: mockChat }
    }
    const result = await skill.execute(context as any)
    expect(result.success).toBe(false)
    expect(result.error).toBe('LLM error')
  })
})
