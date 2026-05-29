import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Project } from '@types/project'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)

  async function fetchProjects() {
    try {
      projects.value = await window.electronAPI.project.list()
    } catch (e: unknown) {
      console.error('Failed to fetch projects:', e)
    }
  }

  async function createProject(name: string, description?: string): Promise<Project> {
    const project = await window.electronAPI.project.create({ name, description })
    projects.value.unshift(project)
    return project
  }

  async function deleteProject(id: string) {
    try {
      await window.electronAPI.project.delete(id)
      projects.value = projects.value.filter(p => p.id !== id)
      if (currentProject.value?.id === id) {
        currentProject.value = projects.value[0] || null
      }
    } catch (e: unknown) {
      console.error('Failed to delete project:', e)
    }
  }

  async function switchProject(id: string) {
    try {
      const project = await window.electronAPI.project.switch(id)
      currentProject.value = project
    } catch (e: unknown) {
      console.error('Failed to switch project:', e)
    }
  }

  function getStats(id: string) {
    return window.electronAPI.project.getStats(id)
  }

  return { projects, currentProject, fetchProjects, createProject, deleteProject, switchProject, getStats }
})
