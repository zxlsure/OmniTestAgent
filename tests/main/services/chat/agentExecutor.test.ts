// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGetActive, mockGetApiKey, mockGetToolSchemas, mockExecuteTool,
  mockIsAutoApproval, mockAddMessage, mockGetProjectDir, mockDynamicImportFn
} = vi.hoisted(() => ({
  mockGetActive: vi.fn(),
  mockGetApiKey: vi.fn(),
  mockGetToolSchemas: vi.fn(),
  mockExecuteTool: vi.fn(),
  mockIsAutoApproval: vi.fn(),
  mockAddMessage: vi.fn(),
  mockGetProjectDir: vi.fn(),
  mockDynamicImportFn: vi.fn()
}))

vi.mock('electron', () => ({ BrowserWindow: {} }))

vi.mock('../../../../src/main/data/repositories/LlmConfigRepo', () => ({
  llmConfigRepo: { getActive: mockGetActive }
}))

vi.mock('../../../../src/main/data/secureStore', () => ({
  getApiKey: mockGetApiKey
}))

vi.mock('../../../../src/main/data/repositories/ChatRepo', () => ({
  chatRepo: { addMessage: mockAddMessage }
}))

vi.mock('../../../../src/main/utils/dynamicImport', () => ({
  dynamicImport: mockDynamicImportFn
}))

vi.mock('../../../../src/main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../../../../src/main/services/FileOperationService', () => ({
  fileOperationService: { getProjectDir: mockGetProjectDir }
}))

vi.mock('../../../../src/main/services/chat/toolRegistry', () => ({
  getToolSchemas: mockGetToolSchemas,
  executeTool: mockExecuteTool,
  isAutoApproval: mockIsAutoApproval
}))

import { executeAgentLoop, type AgentRequest } from '../../../../src/main/services/chat/agentExecutor'

function makeRequest(overrides?: Partial<AgentRequest>): AgentRequest {
  return { systemPrompt: 'You are a test expert', userMessage: '分析需求', sessionId: 'sess-1', projectId: 'proj-1', historyMessages: [], ...overrides }
}

function makeMockWin() { return { webContents: { send: vi.fn() } } as any }

function setupMockLlmClient(streamOrError: any) {
  mockGetActive.mockReturnValue({ model_name: 'gpt-4', api_url: 'https://api.openai.com/v1', is_active: 1, temperature: 0.7, max_tokens: 4096 })
  mockGetApiKey.mockReturnValue('sk-test')
  const mockCreate = vi.fn().mockResolvedValue(streamOrError)
  const mockClient = { chat: { completions: { create: mockCreate } } }
  const MockOpenAI = vi.fn(function () { return mockClient })
  mockDynamicImportFn.mockResolvedValue({ default: MockOpenAI })
  return mockCreate
}

describe('executeAgentLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetToolSchemas.mockReturnValue([])
    mockIsAutoApproval.mockReturnValue(true)
    mockAddMessage.mockReturnValue(undefined)
    mockGetProjectDir.mockReturnValue('/data/projects/proj-1')
  })

  it('无活跃配置时产出error事件', async () => {
    mockGetActive.mockReturnValue(null)
    const events: any[] = []
    for await (const event of executeAgentLoop(makeRequest(), makeMockWin(), new AbortController().signal)) { events.push(event) }
    const errorEvent = events.find(e => e.type === 'error')
    expect(errorEvent).toBeTruthy()
    expect(errorEvent.data.code).toBe('LOOP_ERROR')
  })

  it('无API Key时产出error事件', async () => {
    mockGetActive.mockReturnValue({ model_name: 'gpt-4', api_url: 'https://api.openai.com/v1', is_active: 1, temperature: 0.7, max_tokens: 4096 })
    mockGetApiKey.mockReturnValue(null)
    const events: any[] = []
    for await (const event of executeAgentLoop(makeRequest(), makeMockWin(), new AbortController().signal)) { events.push(event) }
    const errorEvent = events.find(e => e.type === 'error')
    expect(errorEvent).toBeTruthy()
  })

  it('用户中断执行', async () => {
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'hello' }, finish_reason: null }] }
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] }
    })()
    setupMockLlmClient(mockStream)
    const controller = new AbortController()
    controller.abort()
    const events: any[] = []
    for await (const event of executeAgentLoop(makeRequest(), makeMockWin(), controller.signal)) { events.push(event) }
    const abortedEvent = events.find(e => e.type === 'error')
    expect(abortedEvent).toBeTruthy()
    expect(abortedEvent.data.code).toBe('ABORTED')
  })

  it('产出thinking事件', async () => {
    const mockStream = (async function* () {
      yield { choices: [{ delta: { reasoning_content: '思考中...' }, finish_reason: null }] }
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] }
    })()
    setupMockLlmClient(mockStream)
    const events: any[] = []
    for await (const event of executeAgentLoop(makeRequest(), makeMockWin(), new AbortController().signal)) { events.push(event) }
    const thinkingEvent = events.find(e => e.type === 'thinking')
    expect(thinkingEvent).toBeTruthy()
    expect(thinkingEvent.data.content).toBe('思考中...')
  })

  it('产出content事件', async () => {
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: '分析结果' }, finish_reason: null }] }
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] }
    })()
    setupMockLlmClient(mockStream)
    const events: any[] = []
    for await (const event of executeAgentLoop(makeRequest(), makeMockWin(), new AbortController().signal)) { events.push(event) }
    const contentEvent = events.find(e => e.type === 'content')
    expect(contentEvent).toBeTruthy()
    expect(contentEvent.data.content).toBe('分析结果')
  })

  it('产出done事件', async () => {
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: '完成' }, finish_reason: null }] }
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] }
    })()
    setupMockLlmClient(mockStream)
    const events: any[] = []
    for await (const event of executeAgentLoop(makeRequest(), makeMockWin(), new AbortController().signal)) { events.push(event) }
    const doneEvent = events.find(e => e.type === 'done')
    expect(doneEvent).toBeTruthy()
    expect(doneEvent.data.rounds).toBeGreaterThanOrEqual(1)
  })

  it('产出error事件-LLM调用异常', async () => {
    setupMockLlmClient(Promise.reject(new Error('API error')))
    const events: any[] = []
    for await (const event of executeAgentLoop(makeRequest(), makeMockWin(), new AbortController().signal)) { events.push(event) }
    const errorEvent = events.find(e => e.type === 'error')
    expect(errorEvent).toBeTruthy()
    expect(errorEvent.data.message).toContain('API error')
  })

  it('parseToolArguments正常JSON', () => { expect(JSON.parse('{"focus_area":"登录"}')).toEqual({ focus_area: '登录' }) })

  it('parseToolArguments非法JSON返回空对象', () => { try { JSON.parse('invalid') } catch { expect({}).toEqual({}) } })
})
