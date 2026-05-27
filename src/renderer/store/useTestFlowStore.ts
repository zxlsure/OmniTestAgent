import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FlowActivity } from '@types/testflow'

/**
 * @deprecated 使用 useTestFlowPipelineStore 替代。此 Store 将在后续版本中移除。
 */
export const useTestFlowStore = defineStore('testFlow', () => {
  const activities = ref<FlowActivity[]>([])
  const selectedActivityId = ref<string | null>(null)
  const loading = ref(false)

  async function fetchStatus(projectId: string) {
    loading.value = true
    try {
      activities.value = await window.electronAPI.testflow.getStatus(projectId)
    } catch (e: unknown) {
      console.error('Failed to fetch testflow status:', e)
    } finally {
      loading.value = false
    }
  }

  async function executeActivity(projectId: string, activityType: string) {
    try {
      await window.electronAPI.testflow.execute({ projectId, activityType })
    } catch (e: unknown) {
      console.error('Failed to execute activity:', e)
    }
  }

  async function interruptActivity(activityId: string) {
    try {
      await window.electronAPI.testflow.interrupt(activityId)
    } catch (e: unknown) {
      console.error('Failed to interrupt activity:', e)
    }
  }

  async function reviewActivity(activityId: string, result: 'approved' | 'rejected', comment?: string) {
    try {
      await window.electronAPI.testflow.review({ activityId, result, comment })
    } catch (e: unknown) {
      console.error('Failed to review activity:', e)
    }
  }

  return { activities, selectedActivityId, loading, fetchStatus, executeActivity, interruptActivity, reviewActivity }
})
