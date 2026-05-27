import { skillRegistry, ISkill, SkillContext, SkillResult } from './SkillRegistry'
import { llmService } from './LlmService'
import { knowledgeService } from './KnowledgeService'
import { mcpService } from './McpService'
import { fileOperationService } from './FileOperationService'
import { STEP_META_MAP, STEP_DEPENDENCIES, PipelineStepType } from '../data/types/pipeline'
import { logger } from '../utils/logger'

const SKILL_TO_STEP_TYPE: Record<string, PipelineStepType> = {
  requirementParser: PipelineStepType.REQUIREMENT_ANALYSIS,
  testDesigner: PipelineStepType.TEST_DESIGN,
  caseGenerator: PipelineStepType.CASE_GENERATION,
  scriptGenerator: PipelineStepType.SCRIPT_GENERATION
}

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

      const preStepOutputs = this.readPreStepOutputs(skillName, context.projectId)

      const enrichedContext: SkillContext = {
        ...context,
        llmService,
        knowledgeService,
        mcpService,
        fileService: fileOperationService,
        preStepOutputs
      }
      const result = await skill.execute(enrichedContext)
      logger.info(`Skill executed: ${skillName}, success: ${result.success}`)

      if (result.success && context.projectId) {
        const stepType = SKILL_TO_STEP_TYPE[skillName]
        if (stepType) {
          const meta = STEP_META_MAP[stepType]
          const outputContent = result.output ? JSON.stringify(result.output, null, 2) : ''
          if (outputContent) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            fileOperationService.writeFile(
              context.projectId,
              meta.outputDir,
              `${skillName}_output_${timestamp}.md`,
              outputContent
            )
          }
        }
      }

      return result
    } catch (error: any) {
      logger.error(`Skill execution failed: ${skillName}`, error)
      return { success: false, error: error.message }
    }
  }

  private readPreStepOutputs(skillName: string, projectId: string): Array<{ dir: string; content: string }> {
    const stepType = SKILL_TO_STEP_TYPE[skillName]
    if (!stepType) return []

    const deps = STEP_DEPENDENCIES[stepType]
    const outputs: Array<{ dir: string; content: string }> = []

    for (const depType of deps) {
      const depMeta = STEP_META_MAP[depType]
      try {
        const files = fileOperationService.listFiles(projectId, depMeta.outputDir)
        const contents = files
          .filter(f => !f.isDirectory)
          .map(f => {
            try {
              return fileOperationService.readFileContent(projectId, depMeta.outputDir, f.name).content
            } catch {
              return ''
            }
          })
          .filter(c => c.length > 0)
          .join('\n\n---\n\n')

        if (contents) {
          outputs.push({ dir: depMeta.outputDir, content: contents })
        }
      } catch (e: unknown) {
        logger.warn(`Failed to read pre-step output for ${depType}:`, e)
      }
    }

    return outputs
  }
}

export const skillEngine = new SkillEngine()
