import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../src/main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

let mockRegisterCallCount = 0
let shouldThrowOnFirst = false

vi.mock('../../../src/main/services/SkillRegistry', () => ({
  skillRegistry: {
    register: vi.fn().mockImplementation(() => {
      if (shouldThrowOnFirst && mockRegisterCallCount === 0) {
        mockRegisterCallCount++
        throw new Error('mock error')
      }
      mockRegisterCallCount++
    }),
    get: vi.fn(),
    list: vi.fn()
  }
}))

vi.mock('../../../src/main/skills/requirementParser', () => ({
  RequirementParserSkill: vi.fn().mockImplementation(function () { return { name: 'requirementParser' } })
}))

vi.mock('../../../src/main/skills/testDesigner', () => ({
  TestDesignerSkill: vi.fn().mockImplementation(function () { return { name: 'testDesigner' } })
}))

vi.mock('../../../src/main/skills/caseGenerator', () => ({
  CaseGeneratorSkill: vi.fn().mockImplementation(function () { return { name: 'caseGenerator' } })
}))

vi.mock('../../../src/main/skills/scriptGenerator', () => ({
  ScriptGeneratorSkill: vi.fn().mockImplementation(function () { return { name: 'scriptGenerator' } })
}))

import { initBuiltinSkills } from '../../../src/main/skills/initBuiltinSkills'

describe('initBuiltinSkills', () => {
  it('注册 4 个内置 Skill', () => {
    mockRegisterCallCount = 0
    shouldThrowOnFirst = false

    initBuiltinSkills()

    expect(mockRegisterCallCount).toBe(4)
  })

  it('单个 Skill 注册失败不阻塞其他 Skill', () => {
    mockRegisterCallCount = 0
    shouldThrowOnFirst = true

    initBuiltinSkills()

    expect(mockRegisterCallCount).toBe(4)
  })
})
