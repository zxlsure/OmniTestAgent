import { ref } from 'vue'

export function useIpcCall<T>() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function execute(fn: () => Promise<T>): Promise<T | undefined> {
    loading.value = true
    error.value = null
    try {
      return await fn()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, error, execute }
}
