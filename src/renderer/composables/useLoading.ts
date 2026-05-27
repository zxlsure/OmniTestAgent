import { ref } from 'vue'

export function useLoading() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function withLoading<T>(fn: () => Promise<T>): Promise<T | undefined> {
    loading.value = true
    error.value = null
    try {
      return await fn()
    } catch (e: any) {
      error.value = e.message
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, error, withLoading }
}
