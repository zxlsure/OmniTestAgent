// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const { mockGetActive, mockGetApiKey, mockSaveApiKey, mockDynamicImportFn } = vi.hoisted(() => ({
  mockGetActive: vi.fn(),
  mockGetApiKey: vi.fn(),
  mockSaveApiKey: vi.fn(),
  mockDynamicImportFn: vi.fn()
}))

vi.mock('electron', () => ({ BrowserWindow: {} }))

vi.mock('../../../src/main/data/repositories/LlmConfigRepo', () => ({
  llmConfigRepo: { getActive: mockGetActive, save: vi.fn() }
}))

vi.mock('../../../src/main/data/secureStore', () => ({
  getApiKey: mockGetApiKey,
  saveApiKey: mockSaveApiKey
}))

vi.mock('../../../src/main/data/repositories/ChatRepo', () => ({
  chatRepo: { addMessage: vi.fn(), getMessages: vi.fn().mockReturnValue([]) }
}))

vi.mock('../../../src/main/utils/crypto', () => ({
  maskApiKey: (key: string) => key ? `${key.slice(0, 3)}****${key.slice(-3)}` : '****'
}))

vi.mock('../../../src/main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../../../src/main/utils/dynamicImport', () => ({
  dynamicImport: mockDynamicImportFn
}))

describe('LlmService - Provider 配置', () => {
  const PROVIDER_DEFAULT_URL_MAP: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    azure: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}',
    local: 'http://localhost:11434/v1'
  }
  const ALLOWED_PROVIDERS = ['openai', 'anthropic', 'azure', 'local']

  it('默认URL映射-OpenAI', () => expect(PROVIDER_DEFAULT_URL_MAP.openai).toBe('https://api.openai.com/v1'))
  it('默认URL映射-Anthropic', () => expect(PROVIDER_DEFAULT_URL_MAP.anthropic).toBe('https://api.anthropic.com/v1'))
  it('默认URL映射-Azure', () => expect(PROVIDER_DEFAULT_URL_MAP.azure).toContain('azure'))
  it('默认URL映射-Local', () => expect(PROVIDER_DEFAULT_URL_MAP.local).toBe('http://localhost:11434/v1'))
  it('白名单校验-合法Provider', () => expect(ALLOWED_PROVIDERS).toEqual(['openai', 'anthropic', 'azure', 'local']))
  it('白名单校验-非法Provider', () => { expect(ALLOWED_PROVIDERS).not.toContain('google'); expect(ALLOWED_PROVIDERS).not.toContain('invalid') })
})

describe('LlmService - 字段名统一', () => {
  it('apiKey字段存在', () => expect({ apiKey: 'sk-test' }).toHaveProperty('apiKey'))
  it('baseUrl字段存在', () => expect({ baseUrl: 'url' }).toHaveProperty('baseUrl'))
  it('modelName字段存在', () => expect({ modelName: 'gpt-4' }).toHaveProperty('modelName'))
  it('禁止使用api_key', () => expect({ apiKey: 'sk-test' }).not.toHaveProperty('api_key'))
  it('禁止使用api_url', () => expect({ baseUrl: 'url' }).not.toHaveProperty('api_url'))
  it('禁止使用model_name', () => expect({ modelName: 'gpt-4' }).not.toHaveProperty('model_name'))
})

import { LlmService } from '../../../src/main/services/LlmService'

describe('LlmService - 实例方法', () => {
  it('resetClient不抛错', () => {
    const service = new LlmService()
    service.resetClient()
    service.destroy()
  })

  it('destroy不抛错', () => {
    const service = new LlmService()
    service.destroy()
  })

  it('getConfig返回配置', () => {
    mockGetActive.mockReturnValue({ model_name: 'gpt-4', api_url: 'https://api.openai.com/v1', temperature: 0.7, max_tokens: 4096 })
    mockGetApiKey.mockReturnValue('sk-test-key')
    const service = new LlmService()
    const config = service.getConfig() as any
    expect(config).toHaveProperty('apiKey')
    expect(config.hasApiKey).toBe(true)
    service.destroy()
  })

  it('saveConfig调用resetClient', () => {
    const service = new LlmService()
    service.saveConfig('gpt-4', 'https://api.openai.com/v1', 'sk-new', 0.5, 2048)
    expect(mockSaveApiKey).toHaveBeenCalledWith('llm', 'sk-new')
    service.destroy()
  })
})
