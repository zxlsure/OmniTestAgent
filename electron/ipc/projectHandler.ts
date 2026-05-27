import { registerIpcHandler } from './helpers'
import { projectService } from '../services/ProjectService'

export function registerProjectHandler(): void {
  registerIpcHandler('project:list', () => projectService.list())
  registerIpcHandler('project:create', (_: any, data: any) => projectService.create(data.name, data.description))
  registerIpcHandler('project:update', (_: any, data: any) => projectService.update(data.id, data))
  registerIpcHandler('project:delete', (id: string) => projectService.delete(id))
  registerIpcHandler('project:switch', (id: string) => projectService.getById(id))
  registerIpcHandler('project:getStats', (id: string) => projectService.getStats(id))
}
