import { projectRepo, Project } from '../data/repositories/ProjectRepo'
import { testCaseRepo } from '../data/repositories/TestCaseRepo'
import { flowActivityRepo } from '../data/repositories/FlowActivityRepo'
import { knowledgeRepo } from '../data/repositories/KnowledgeRepo'
import { logger } from '../utils/logger'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'

const INVALID_CHARS = /[/\\:*?"<>|]/

export class ProjectService {
  list(): Project[] {
    return projectRepo.list()
  }

  create(name: string, description?: string, directory?: string): Project {
    if (INVALID_CHARS.test(name)) {
      throw new Error('项目名称包含非法字符')
    }

    const targetDir = directory || app.getPath('documents')
    const projectFolderPath = join(targetDir, name)

    if (fs.existsSync(projectFolderPath)) {
      throw new Error('该目录下已存在同名文件夹')
    }

    const project = projectRepo.create(name, description, targetDir)

    try {
      fs.mkdirSync(projectFolderPath, { recursive: true })
    } catch (err) {
      projectRepo.delete(project.id)
      throw new Error('目录无写入权限，请选择其他目录')
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
