import { projectRepo, Project } from '../data/repositories/ProjectRepo'
import { logger } from '../utils/logger'

export class ProjectService {
  list(): Project[] {
    return projectRepo.list()
  }

  create(name: string, description?: string): Project {
    return projectRepo.create(name, description)
  }

  update(id: string, data: Partial<Pick<Project, 'name' | 'description'>>): Project | null {
    return projectRepo.update(id, data)
  }

  delete(id: string): boolean {
    return projectRepo.delete(id)
  }

  getStats(id: string): Record<string, number> {
    return projectRepo.getStats(id)
  }

  getById(id: string): Project | null {
    return projectRepo.getById(id)
  }
}

export const projectService = new ProjectService()
