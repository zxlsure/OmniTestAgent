import { skillRepo, SkillRecord } from '../data/repositories/SkillRepo'
import { logger } from '../utils/logger'
import type { LlmService } from './LlmService'
import type { KnowledgeService } from './KnowledgeService'
import type { McpService } from './McpService'
import type { FileOperationService } from './FileOperationService'

export interface ISkill {
  name: string
  displayName: string
  description: string
  isBuiltin: boolean
  execute(context: SkillContext): Promise<SkillResult>
}

export interface SkillContext {
  projectId: string
  inputData?: unknown
  llmService?: LlmService
  knowledgeService?: KnowledgeService
  mcpService?: McpService
  fileService?: FileOperationService
  preStepOutputs?: Array<{ dir: string; content: string }>
}

export interface SkillResult {
  success: boolean
  output?: unknown
  error?: string
  artifacts?: Array<{ type: string; data: unknown }>
}

export class SkillRegistry {
  private skills: Map<string, ISkill> = new Map()

  register(skill: ISkill): void {
    this.skills.set(skill.name, skill)
    const existing = skillRepo.getByName(skill.name)
    if (!existing) {
      skillRepo.create(skill.name, skill.displayName, skill.description, skill.isBuiltin)
    }
    logger.info(`Skill registered: ${skill.name}`)
  }

  get(name: string): ISkill | undefined {
    return this.skills.get(name)
  }

  list(): ISkill[] {
    return Array.from(this.skills.values())
  }

  listDbRecords(): SkillRecord[] {
    return skillRepo.list()
  }

  async toggle(id: string, enabled: boolean): Promise<boolean> {
    if (!enabled) {
      const record = skillRepo.list().find(s => s.id === id)
      if (record?.is_builtin) {
        const enabledBuiltinCount = skillRepo.list().filter(s => s.is_builtin === 1 && s.is_enabled === 1).length
        if (enabledBuiltinCount <= 1) throw new Error('核心Skill不可全部禁用')
      }
    }
    return skillRepo.toggle(id, enabled)
  }

  isSkillEnabled(name: string): boolean {
    const record = skillRepo.getByName(name)
    return record ? record.is_enabled === 1 : false
  }
}

export const skillRegistry = new SkillRegistry()
