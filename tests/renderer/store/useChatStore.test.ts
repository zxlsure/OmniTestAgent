// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockGetSessions = vi.fn()
const mockCreateSession = vi.fn()
const mockDeleteSession = vi.fn()
const mockGetMessages = vi.fn()
const mockSendMessage = vi.fn()
const mockAbort = vi.fn()
let agentEventCallback: ((...args: any[]) => void) | null = null
const mockOnAgentEvent = vi.fn().mockImplementation((cb: any) => {
  agentEventCallback = cb
})
const mockOnApprovalRequest = vi.fn()
const mockRemoveAgentListeners = vi.fn()
const mockRemoveApprovalListeners = vi.fn()
const mockApprovalResponse = vi.fn()

beforeEach(() => {
  agentEventCallback = null
  vi.stubGlobal('window', {
    electronAPI: {
      chat: {
        getSessions: mockGetSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        getMessages: mockGetMessages,
        sendMessage: mockSendMessage,
        abort: mockAbort,
        onAgentEvent: mockOnAgentEvent,
        onApprovalRequest: mockOnApprovalRequest,
        removeAgentListeners: mockRemoveAgentListeners,
        removeApprovalListeners: mockRemoveApprovalListeners,
        approvalResponse: mockApprovalResponse
      }
    }
  })
})

import { useChatStore } from '@/store/useChatStore'

describe('useChatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockOnAgentEvent.mockImplementation((cb: any) => {
      agentEventCallback = cb
    })
    mockOnApprovalRequest.mockImplementation(() => {})
    mockRemoveAgentListeners.mockImplementation(() => {})
    mockRemoveApprovalListeners.mockImplementation(() => {})
  })

  describe('createSession', () => {
    it('添加新session', async () => {
      const fakeSession = {
        id: 'sess-1',
        projectId: 'proj-1',
        title: '新会话',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model: null
      }
      mockCreateSession.mockResolvedValue(fakeSession)

      const store = useChatStore()
      await store.createSession('proj-1')

      expect(mockCreateSession).toHaveBeenCalledWith({ projectId: 'proj-1' })
      expect(store.sessions).toHaveLength(1)
      expect(store.sessions[0].id).toBe('sess-1')
      expect(store.currentSessionId).toBe('sess-1')
    })
  })

  describe('sendMessage', () => {
    it('设置 streaming=true', async () => {
      const fakeSession = {
        id: 'sess-1',
        projectId: 'proj-1',
        title: '会话',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model: null
      }
      mockCreateSession.mockResolvedValue(fakeSession)
      mockSendMessage.mockResolvedValue(undefined)

      const store = useChatStore()
      await store.createSession('proj-1')
      await store.sendMessage('帮我分析需求')

      expect(store.streaming).toBe(true)
      expect(store.messages).toHaveLength(2)
      expect(store.messages[0].role).toBe('user')
      expect(store.messages[1].role).toBe('assistant')
      expect(store.messages[1].status).toBe('streaming')
    })
  })

  describe('agent事件处理', () => {
    async function setupStoreWithMessage() {
      const fakeSession = {
        id: 'sess-1', projectId: 'proj-1', title: '会话', messages: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), model: null
      }
      mockCreateSession.mockResolvedValue(fakeSession)
      mockSendMessage.mockResolvedValue(undefined)

      const store = useChatStore()
      await store.createSession('sess-1')
      await store.sendMessage('你好')
      return store
    }

    function emitAgentEvent(event: any) {
      if (agentEventCallback) {
        agentEventCallback(null, { sessionId: 'sess-1', event })
      }
    }

    it('content事件追加到消息', async () => {
      const store = await setupStoreWithMessage()

      emitAgentEvent({ type: 'content', data: { content: '分析' } })
      emitAgentEvent({ type: 'content', data: { content: '结果' } })

      const assistantMsg = store.messages.find(m => m.role === 'assistant')
      expect(assistantMsg?.content).toBe('分析结果')
    })

    it('done事件设置 streaming=false', async () => {
      const store = await setupStoreWithMessage()

      expect(store.streaming).toBe(true)

      emitAgentEvent({ type: 'done', data: { content: '完成', rounds: 1 } })

      expect(store.streaming).toBe(false)
      const assistantMsg = store.messages.find(m => m.role === 'assistant')
      expect(assistantMsg?.status).toBe('completed')
    })

    it('error事件设置 error', async () => {
      const store = await setupStoreWithMessage()

      emitAgentEvent({ type: 'error', data: { code: 'LOOP_ERROR', message: '执行失败' } })

      expect(store.error).toBe('执行失败')
      expect(store.streaming).toBe(false)
      const assistantMsg = store.messages.find(m => m.role === 'assistant')
      expect(assistantMsg?.status).toBe('error')
    })

    it('thinking事件追加到thinking字段', async () => {
      const store = await setupStoreWithMessage()

      emitAgentEvent({ type: 'thinking', data: { content: '推理步骤1' } })
      emitAgentEvent({ type: 'thinking', data: { content: '推理步骤2' } })

      const assistantMsg = store.messages.find(m => m.role === 'assistant')
      expect(assistantMsg?.thinking).toBe('推理步骤1推理步骤2')
    })

    it('tool_call事件添加工具调用步骤', async () => {
      const store = await setupStoreWithMessage()

      emitAgentEvent({
        type: 'tool_call',
        data: { id: 'tc-1', name: 'analyze_requirement', args: { focus_area: '登录' } }
      })

      const assistantMsg = store.messages.find(m => m.role === 'assistant')
      expect(assistantMsg?.toolCalls).toHaveLength(1)
      expect(assistantMsg?.toolCalls?.[0].toolName).toBe('analyze_requirement')
      expect(assistantMsg?.toolCalls?.[0].status).toBe('executing')
    })

    it('tool_result事件更新ToolCallStep', async () => {
      const store = await setupStoreWithMessage()

      emitAgentEvent({
        type: 'tool_call',
        data: { id: 'tc-1', name: 'analyze_requirement', args: { focus_area: '登录' } }
      })

      emitAgentEvent({
        type: 'tool_result',
        data: { id: 'tc-1', name: 'analyze_requirement', result: '分析完成', status: 'success', executionTimeMs: 1500 }
      })

      const assistantMsg = store.messages.find(m => m.role === 'assistant')
      expect(assistantMsg?.toolCalls?.[0].result).toBe('分析完成')
      expect(assistantMsg?.toolCalls?.[0].status).toBe('completed')
      expect(assistantMsg?.toolCalls?.[0].durationMs).toBe(1500)
    })

    it('审批请求事件设置approvalPending', async () => {
      const store = await setupStoreWithMessage()

      const mockOnApproval = vi.fn().mockImplementation((cb: any) => {
        cb(null, { requestId: 'sess-1:tc-1', toolName: 'analyze_requirement', toolArgs: { focus_area: '登录' } })
      })
      mockOnApprovalRequest.mockImplementation(mockOnApproval)

      store.setupAgentEventListener()

      expect(store.approvalPending).toBeTruthy()
      expect(store.approvalPending?.toolName).toBe('analyze_requirement')
      expect(store.approvalPending?.requestId).toBe('sess-1:tc-1')
    })

    it('approveToolCall调用IPC', async () => {
      const store = await setupStoreWithMessage()
      store.approvalPending = {
        toolCallId: 'tc-1',
        toolName: 'analyze_requirement',
        parameters: { focus_area: '登录' },
        requestId: 'sess-1:tc-1'
      }
      mockApprovalResponse.mockResolvedValue(undefined)

      await store.approveToolCall('tc-1', true)

      expect(mockApprovalResponse).toHaveBeenCalledWith({
        requestId: 'sess-1:tc-1',
        approved: true
      })
      expect(store.approvalPending).toBeNull()
    })

    it('abortChat中止对话', async () => {
      const store = await setupStoreWithMessage()

      store.abortChat()

      expect(store.streaming).toBe(false)
      const assistantMsg = store.messages.find(m => m.role === 'assistant')
      expect(assistantMsg?.status).toBe('error')
      expect(mockAbort).toHaveBeenCalled()
    })

    it('流式超时触发', async () => {
      vi.useFakeTimers()
      const store = await setupStoreWithMessage()

      vi.advanceTimersByTime(5000)

      const assistantMsg = store.messages.find(m => m.role === 'assistant')
      expect(assistantMsg?.status).toBe('error')
      expect(store.error).toBe('流式响应中断')
      expect(store.streaming).toBe(false)

      vi.useRealTimers()
    })
  })
})
