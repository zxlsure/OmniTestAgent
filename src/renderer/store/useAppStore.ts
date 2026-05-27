import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const initialized = ref(false)
  const llmConnected = ref(false)

  async function initialize() {
    try {
      const config = await window.electronAPI.llm.getConfig()
      llmConnected.value = !!config?.id
    } catch (e: unknown) { console.error('LLM config check failed:', e); llmConnected.value = false }
    initialized.value = true
  }

  return { initialized, llmConnected, initialize }
})
