import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SkillRecord } from '@types/skill'

export const useSkillStore = defineStore('skill', () => {
  const skills = ref<SkillRecord[]>([])

  async function fetchSkills() {
    try {
      skills.value = await window.electronAPI.skill.list()
    } catch (e: unknown) {
      console.error('Failed to fetch skills:', e)
    }
  }

  async function toggleSkill(id: string, enabled: boolean) {
    try {
      await window.electronAPI.skill.toggle(id, enabled)
      const skill = skills.value.find(s => s.id === id)
      if (skill) skill.is_enabled = enabled ? 1 : 0
    } catch (e: unknown) {
      console.error('Failed to toggle skill:', e)
    }
  }

  async function importSkill(skillData: unknown) {
    try {
      const result = await window.electronAPI.skill.import(skillData)
      await fetchSkills()
      return result
    } catch (e: unknown) {
      console.error('Failed to import skill:', e)
      throw e
    }
  }

  return { skills, fetchSkills, toggleSkill, importSkill }
})
