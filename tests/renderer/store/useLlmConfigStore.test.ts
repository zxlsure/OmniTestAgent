// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockGetConfig = vi.fn()
const mockTestConnection = vi.fn()
const mockSaveConfig = vi.fn()

beforeEach(() => {
  vi.stubGlobal('window', {
    electronAPI: {
      llm: {
        getConfig: mockGetConfig,
        testConnection: mockTestConnection,
        saveConfig: mockSaveConfig
      }
    }
  })
})

import { useLlmConfigStore } from '@/store/useLlmConfigStore'

describe('useLlmConfigStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchConfig正确加载配置', async () => {
    const fakeConfig = { id: '1', modelName: 'gpt-4', baseUrl: 'https://api.openai.com/v1', apiKey: '****1234', hasApiKey: true }
    mockGetConfig.mockResolvedValue(fakeConfig)

    const store = useLlmConfigStore()
    await store.fetchConfig()

    expect(mockGetConfig).toHaveBeenCalled()
    expect(store.config).toEqual(fakeConfig)
  })

  it('testConnection调用成功', async () => {
    mockTestConnection.mockResolvedValue({ success: true })

    const store = useLlmConfigStore()
    await store.testConnection({ modelName: 'gpt-4', apiUrl: 'https://api.openai.com/v1', apiKey: 'sk-test' })

    expect(store.testing).toBe(false)
    expect(store.testResult).toEqual({ success: true })
  })

  it('testConnection调用失败', async () => {
    mockTestConnection.mockResolvedValue({ success: false, error: 'Connection failed' })

    const store = useLlmConfigStore()
    await store.testConnection({ modelName: 'gpt-4', apiUrl: 'https://api.openai.com/v1', apiKey: 'sk-bad' })

    expect(store.testing).toBe(false)
    expect(store.testResult?.success).toBe(false)
    expect(store.testResult?.error).toBe('Connection failed')
  })

  it('saveConfig保存后刷新', async () => {
    const freshConfig = { id: '1', modelName: 'gpt-4', baseUrl: 'https://api.openai.com/v1' }
    mockSaveConfig.mockResolvedValue(undefined)
    mockGetConfig.mockResolvedValue(freshConfig)

    const store = useLlmConfigStore()
    await store.saveConfig({ modelName: 'gpt-4', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test' })

    expect(mockSaveConfig).toHaveBeenCalled()
    expect(mockGetConfig).toHaveBeenCalled()
    expect(store.config).toEqual(freshConfig)
  })
})
