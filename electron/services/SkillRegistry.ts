import { skillRepo, SkillRecord } from '../data/repositories/SkillRepo'
import { logger } from '../utils/logger'

export interface ISkill {
  name: string
  displayName: string
  description: string
  isBuiltin: boolean
  execute(context: SkillContext): Promise<SkillResult>
}

export interface SkillContext {
  projectId: string
  inputData?: any
  llmService?: any
  knowledgeService?: any
  mcpService?: any
}

export interface SkillResult {
  success: boolean
  output?: any
  error?: string
  artifacts?: any[]
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
    return skillRepo.toggle(id, enabled)
  }

  isSkillEnabled(name: string): boolean {
    const record = skillRepo.getByName(name)
    return record ? record.is_enabled === 1 : false
  }
}

export const skillRegistry = new SkillRegistry()
