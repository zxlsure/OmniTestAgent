import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TestCase {
  id: string
  title: string
  description?: string
  status?: string
}

export interface ExecutionResult {
  caseId: string
  status: 'passed' | 'failed' | 'running' | 'pending'
  output?: string
  error?: string
  duration?: number
}

export const useTestExecutionStore = defineStore('testExecution', () => {
  const testCases = ref<TestCase[]>([])
  const selectedCaseIds = ref<string[]>([])
  const executionResults = ref<Map<string, ExecutionResult>>(new Map())
  const executing = ref(false)

  async function fetchTestCases(projectId: string) {
    try {
      const cases = await window.electronAPI.testflow.getStatus(projectId)
      testCases.value = (cases || []).map((c: any) => ({
        id: c.id,
        title: c.title || c.name || c.id,
        description: c.description,
        status: c.status
      }))
    } catch (e: unknown) {
      console.error('Failed to fetch test cases:', e)
    }
  }

  async function executeCases(caseIds: string[], mcpConfig?: any) {
    executing.value = true
    for (const caseId of caseIds) {
      executionResults.value.set(caseId, { caseId, status: 'running' })
    }
    try {
      for (const caseId of caseIds) {
        try {
          const result = await window.electronAPI.mcp.callTool({
            toolName: 'test_runner',
            params: { testCaseId: caseId }
          })
          executionResults.value.set(caseId, {
            caseId,
            status: 'passed',
            output: typeof result === 'string' ? result : JSON.stringify(result)
          })
        } catch (e: any) {
          executionResults.value.set(caseId, {
            caseId,
            status: 'failed',
            error: e.message || String(e)
          })
        }
      }
    } finally {
      executing.value = false
    }
  }

  return { testCases, selectedCaseIds, executionResults, executing, fetchTestCases, executeCases }
})
