// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockAddMessage, mockGetMessages, mockList, mockIsSkillEnabled,
  mockGetPipelineState, mockBuildSystemPrompt, mockExecuteAgentLoop, mockResolveApproval
} = vi.hoisted(() => ({
  mockAddMessage: vi.fn(),
  mockGetMessages: vi.fn().mockReturnValue([]),
  mockList: vi.fn().mockReturnValue([]),
  mockIsSkillEnabled: vi.fn().mockReturnValue(true),
  mockGetPipelineState: vi.fn(),
  mockBuildSystemPrompt: vi.fn().mockResolvedValue('system prompt'),
  mockExecuteAgentLoop: vi.fn(),
  mockResolveApproval: vi.fn()
}))

vi.mock('electron', () => ({ BrowserWindow: {} }))

vi.mock('../../../../src/main/data/repositories/ChatRepo', () => ({
  chatRepo: { addMessage: mockAddMessage, getMessages: mockGetMessages, listSessions: vi.fn().mockReturnValue([]), createSession: vi.fn(), deleteSession: vi.fn() }
}))

vi.mock('../../../../src/main/services/SkillRegistry', () => ({
  skillRegistry: { list: mockList, isSkillEnabled: mockIsSkillEnabled }
}))

vi.mock('../../../../src/main/services/TestFlowPipelineService', () => ({
  testFlowPipelineService: { getPipelineState: mockGetPipelineState }
}))

vi.mock('../../../../src/main/services/chat/promptBuilder', () => ({
  buildSystemPrompt: mockBuildSystemPrompt
}))

vi.mock('../../../../src/main/services/chat/agentExecutor', () => ({
  executeAgentLoop: mockExecuteAgentLoop,
  resolveApproval: mockResolveApproval
}))

vi.mock('../../../../src/main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { ChatAgentService } from '../../../../src/main/services/chat/chatAgentService'

describe('ChatAgentService', () => {
  let service: ChatAgentService
  let mockWin: any

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ChatAgentService()
    mockWin = { webContents: { send: vi.fn() } }
    mockExecuteAgentLoop.mockImplementation(async function* () {
      yield { type: 'content', data: { content: 'test' } }
      yield { type: 'done', data: { content: 'test', rounds: 1 } }
    })
    mockGetPipelineState.mockReturnValue({ steps: [], overallProgress: 0 })
    mockList.mockReturnValue([
      { name: 'requirementParser', displayName: '需求解析', description: '解析需求' },
      { name: 'testDesigner', displayName: '测试设计', description: '设计测试' }
    ])
  })

  it('startChat发送Agent事件', async () => {
    await service.startChat('sess-1', '分析需求', 'proj-1', mockWin)
    expect(mockWin.webContents.send).toHaveBeenCalled()
    const agentEventCalls = mockWin.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'chat:agentEvent')
    expect(agentEventCalls.length).toBeGreaterThan(0)
  })

  it('startChat重复执行拒绝', async () => {
    mockExecuteAgentLoop.mockImplementation(async function* () {
      yield { type: 'content', data: { content: 'test' } }
      yield { type: 'done', data: { content: 'test', rounds: 1 } }
      await new Promise(r => setTimeout(r, 50))
    })
    const p1 = service.startChat('sess-1', 'msg1', 'proj-1', mockWin)
    await expect(service.startChat('sess-1', 'msg2', 'proj-1', mockWin)).rejects.toThrow('Session is already executing')
    await p1
  })

  it('abortChat中止执行', () => {
    service.abortChat('sess-1')
    expect(service.isExecuting('sess-1')).toBe(false)
  })

  it('isExecuting状态正确', async () => {
    expect(service.isExecuting('sess-1')).toBe(false)
    await service.startChat('sess-1', '分析需求', 'proj-1', mockWin)
    expect(service.isExecuting('sess-1')).toBe(false)
  })

  it('startChat异常时发送error事件', async () => {
    mockBuildSystemPrompt.mockRejectedValue(new Error('Prompt build failed'))
    await service.startChat('sess-2', '分析需求', 'proj-1', mockWin)
    const errorCalls = mockWin.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'chat:agentEvent' && c[1]?.event?.type === 'error')
    expect(errorCalls.length).toBeGreaterThan(0)
  })
})
