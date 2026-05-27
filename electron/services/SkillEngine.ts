import { skillRegistry, ISkill, SkillContext, SkillResult } from './SkillRegistry'
import { llmService } from './LlmService'
import { knowledgeService } from './KnowledgeService'
import { mcpService } from './McpService'
import { logger } from '../utils/logger'

export class SkillEngine {
  async execute(skillName: string, context: SkillContext): Promise<SkillResult> {
    const skill = skillRegistry.get(skillName)
    if (!skill) {
      return { success: false, error: `Skill not found: ${skillName}` }
    }

    if (!skillRegistry.isSkillEnabled(skillName)) {
      return { success: false, error: `Skill is disabled: ${skillName}` }
    }

    try {
      logger.info(`Executing skill: ${skillName}`)
      const enrichedContext: SkillContext = {
        ...context,
        llmService,
        knowledgeService,
        mcpService
      }
      const result = await skill.execute(enrichedContext)
      logger.info(`Skill executed: ${skillName}, success: ${result.success}`)
      return result
    } catch (error: any) {
      logger.error(`Skill execution failed: ${skillName}`, error)
      return { success: false, error: error.message }
    }
  }
}

export const skillEngine = new SkillEngine()
