import { projectRepo, Project } from '../data/repositories/ProjectRepo'
import { testCaseRepo } from '../data/repositories/TestCaseRepo'
import { flowActivityRepo } from '../data/repositories/FlowActivityRepo'
import { knowledgeRepo } from '../data/repositories/KnowledgeRepo'
import { fileOperationService } from './FileOperationService'
import { logger } from '../utils/logger'

const INVALID_CHARS = /[/\\:*?"<>|]/

export class ProjectService {
  list(): Project[] {
    return projectRepo.list()
  }

  create(name: string, description?: string): Project {
    if (INVALID_CHARS.test(name)) {
      throw new Error('项目名称包含非法字符')
    }

    // Step 1: 插入数据库获取projectId
    const project = projectRepo.create(name, description)

    try {
      // Step 2: 基于统一路径公式初始化标准目录
      fileOperationService.initProjectDirs(project.id)
    } catch (err) {
      // Step 3: 目录初始化失败则回滚数据库记录
      projectRepo.delete(project.id)
      throw new Error('项目目录初始化失败：' + (err instanceof Error ? err.message : String(err)))
    }

    return project
  }

  update(id: string, data: Partial<Pick<Project, 'name' | 'description' | 'directory'>>): Project | null {
    return projectRepo.update(id, data)
  }

  delete(id: string): boolean {
    return projectRepo.delete(id)
  }

  getStats(id: string): Record<string, number> {
    const tc = testCaseRepo.countByProject(id)
    const ac = flowActivityRepo.countByProject(id)
    const kb = knowledgeRepo.countByProject(id)
    return { testCaseCount: tc, activityCount: ac, kbCount: kb }
  }

  getById(id: string): Project | null {
    return projectRepo.getById(id)
  }
}

export const projectService = new ProjectService()
