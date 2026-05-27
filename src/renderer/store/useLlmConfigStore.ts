import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LlmConfig } from '@types/llm'

export const useLlmConfigStore = defineStore('llmConfig', () => {
  const config = ref<LlmConfig | null>(null)
  const testing = ref(false)
  const testResult = ref<{ success: boolean; error?: string } | null>(null)

  async function fetchConfig() {
    try {
      config.value = await window.electronAPI.llm.getConfig()
    } catch (e: unknown) {
      console.error('Failed to fetch LLM config:', e)
    }
  }

  async function testConnection(cfg: { modelName: string; apiUrl: string; apiKey: string }) {
    testing.value = true
    testResult.value = null
    try {
      testResult.value = await window.electronAPI.llm.testConnection(cfg)
    } finally {
      testing.value = false
    }
  }

  async function saveConfig(cfg: any) {
    try {
      await window.electronAPI.llm.saveConfig(cfg)
      await fetchConfig()
    } catch (e: unknown) {
      console.error('Failed to save LLM config:', e)
    }
  }

  return { config, testing, testResult, fetchConfig, testConnection, saveConfig }
})
