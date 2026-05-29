import { skillRegistry } from '../services/SkillRegistry'
import { RequirementParserSkill } from './requirementParser'
import { TestDesignerSkill } from './testDesigner'
import { CaseGeneratorSkill } from './caseGenerator'
import { ScriptGeneratorSkill } from './scriptGenerator'
import { logger } from '../utils/logger'

const BUILTIN_SKILLS = [
  RequirementParserSkill,
  TestDesignerSkill,
  CaseGeneratorSkill,
  ScriptGeneratorSkill
]

export function initBuiltinSkills(): void {
  logger.info('Initializing builtin skills...')
  for (const SkillClass of BUILTIN_SKILLS) {
    try {
      const instance = new SkillClass()
      skillRegistry.register(instance)
    } catch (error: unknown) {
      logger.error(
        `Failed to register builtin skill: ${SkillClass.name}`,
        error
      )
    }
  }
  logger.info('Builtin skills initialization completed')
}
