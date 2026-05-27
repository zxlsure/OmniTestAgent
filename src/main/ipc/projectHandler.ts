import { registerIpcHandler } from './helpers'
import { projectService } from '../services/ProjectService'

export function registerProjectHandler(): void {
  registerIpcHandler('project:list', () => projectService.list())
  registerIpcHandler('project:create', (data: unknown) => {
    if (!data || typeof data !== 'object') {
      throw new Error('项目创建失败：参数错误')
    }
    const { name, description, directory } = data as { name: string; description?: string; directory?: string }
    if (!name || typeof name !== 'string') {
      throw new Error('项目创建失败：项目名称不能为空')
    }
    return projectService.create(name, description, directory)
  })
  registerIpcHandler('project:update', (data: unknown) => {
    if (!data || typeof data !== 'object') {
      throw new Error('项目更新失败：参数错误')
    }
    const d = data as { id: string; name?: string; description?: string; directory?: string }
    if (!d.id || typeof d.id !== 'string') {
      throw new Error('项目更新失败：缺少项目ID')
    }
    return projectService.update(d.id, d)
  })
  registerIpcHandler('project:delete', (id: string) => projectService.delete(id))
  registerIpcHandler('project:switch', (id: string) => projectService.getById(id))
  registerIpcHandler('project:getStats', (id: string) => projectService.getStats(id))
}
