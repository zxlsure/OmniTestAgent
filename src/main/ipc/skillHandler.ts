import { registerIpcHandler } from './helpers'
import { skillRegistry } from '../services/SkillRegistry'
import { skillEngine } from '../services/SkillEngine'
import type { SkillContext } from '../services/SkillRegistry'

export function registerSkillHandler(): void {
  registerIpcHandler('skill:list', () => skillRegistry.listDbRecords())
  registerIpcHandler('skill:toggle', (id: string, enabled: boolean) => skillRegistry.toggle(id, enabled))
  registerIpcHandler('skill:import', (_data: unknown) => { throw new Error('Skill导入功能待实现') })
  registerIpcHandler('skill:execute', (params: { skillName: string; context: SkillContext }) => skillEngine.execute(params.skillName, params.context))
}
