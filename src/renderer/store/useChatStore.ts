import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatSession, ChatMessage, ThinkingStep, ToolCallStep, AgentEvent } from '@types/chatAgent'

export type AgentPhase = 'thinking' | 'tool_call' | 'result_organize' | 'done' | null

export interface ApprovalPending {
  toolCallId: string
  toolName: string
  parameters: Record<string, unknown>
  requestId: string
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const streaming = ref(false)
  const agentPhase = ref<AgentPhase>(null)
  const approvalPending = ref<ApprovalPending | null>(null)
  const error = ref<string | null>(null)
  let streamTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  const STREAM_TIMEOUT_MS = 5000

  const currentSession = computed(() =>
    sessions.value.find(s => s.id === currentSessionId.value) ?? null
  )

  function getCurrentAssistantMessage(): ChatMessage | undefined {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].role === 'assistant') return messages.value[i]
    }
    return undefined
  }

  async function fetchSessions(projectId?: string) {
    try {
      const result = await window.electronAPI.chat.getSessions(
        projectId ? { projectId } : undefined
      )
      sessions.value = (result as ChatSession[]) || []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function createSession(projectId: string) {
    try {
      const session = await window.electronAPI.chat.createSession({ projectId }) as ChatSession
      sessions.value.unshift(session)
      currentSessionId.value = session.id
      messages.value = []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function deleteSession(sessionId: string) {
    try {
      await window.electronAPI.chat.deleteSession({ sessionId })
      sessions.value = sessions.value.filter(s => s.id !== sessionId)
      if (currentSessionId.value === sessionId) {
        currentSessionId.value = sessions.value.length ? sessions.value[0].id : null
        messages.value = []
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function fetchMessages(sessionId: string) {
    try {
      const result = await window.electronAPI.chat.getMessages({ sessionId })
      messages.value = (result as ChatMessage[]) || []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function sendMessage(content: string) {
    if (!currentSessionId.value || !content.trim()) return

    const session = currentSession.value
    const isFirstMessage = session && messages.value.length === 0

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: currentSessionId.value,
      role: 'user',
      content,
      status: 'completed',
      timestamp: new Date().toISOString()
    }
    messages.value.push(userMsg)

    if (isFirstMessage && session) {
      const autoTitle = content.slice(0, 20) + (content.length > 20 ? '...' : '')
      session.title = autoTitle
      try {
        await window.electronAPI.store.set(`chat:title:${session.id}`, autoTitle)
      } catch (_e: unknown) {
        // ignore title persistence failure
      }
    }

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      sessionId: currentSessionId.value,
      role: 'assistant',
      content: '',
      thinking: '',
      thinkingSteps: [],
      toolCalls: [],
      status: 'streaming',
      timestamp: new Date().toISOString()
    }
    messages.value.push(assistantMsg)

    streaming.value = true
    agentPhase.value = 'thinking'
    error.value = null

    setupAgentEventListener()

    try {
      await window.electronAPI.chat.sendMessage({
        sessionId: currentSessionId.value,
        message: content,
        projectId: currentSession.value?.projectId || ''
      })
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      streaming.value = false
      agentPhase.value = null
    }
  }

  function abortChat() {
    if (!currentSessionId.value) return
    window.electronAPI.chat.abort({ sessionId: currentSessionId.value })
    streaming.value = false
    agentPhase.value = null
    const msg = getCurrentAssistantMessage()
    if (msg) msg.status = 'error'
  }

  async function approveToolCall(toolCallId: string, approved: boolean) {
    if (!currentSessionId.value || !approvalPending.value) return
    try {
      await window.electronAPI.chat.approvalResponse({
        requestId: approvalPending.value.requestId,
        approved
      })
      approvalPending.value = null
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  function resetStreamTimeout() {
    if (streamTimeoutTimer) clearTimeout(streamTimeoutTimer)
    if (!streaming.value) return
    streamTimeoutTimer = setTimeout(() => {
      if (streaming.value) {
        const msg = getCurrentAssistantMessage()
        if (msg) msg.status = 'error'
        streaming.value = false
        agentPhase.value = null
        error.value = '流式响应中断'
        cleanupAgentEventListener()
      }
    }, STREAM_TIMEOUT_MS)
  }

  function handleAgentEvent(event: AgentEvent) {
    const msg = getCurrentAssistantMessage()
    if (!msg) return

    resetStreamTimeout()

    switch (event.type) {
      case 'thinking': {
        const data = event.data as { content: string }
        msg.thinking = (msg.thinking || '') + data.content
        agentPhase.value = 'thinking'
        break
      }
      case 'content': {
        const data = event.data as { content: string }
        msg.content += data.content
        agentPhase.value = 'result_organize'
        break
      }
      case 'tool_call': {
        const data = event.data as { id: string; name: string; args: Record<string, unknown> }
        const step: ThinkingStep = {
          text: `调用工具 ${data.name}`,
          toolCall: {
            toolCallId: data.id,
            toolName: data.name,
            parameters: JSON.stringify(data.args, null, 2),
            status: 'executing'
          }
        }
        msg.thinkingSteps = msg.thinkingSteps || []
        msg.thinkingSteps.push(step)
        msg.toolCalls = msg.toolCalls || []
        msg.toolCalls.push(step.toolCall)
        agentPhase.value = 'tool_call'
        break
      }
      case 'tool_result': {
        const data = event.data as { id: string; name: string; result: string; status: 'success' | 'failed' | 'rejected'; executionTimeMs?: number }
        if (msg.thinkingSteps) {
          for (let i = msg.thinkingSteps.length - 1; i >= 0; i--) {
            const step = msg.thinkingSteps[i]
            if (step.toolCall && step.toolCall.toolCallId === data.id) {
              step.toolCall.result = data.result
              step.toolCall.status = data.status === 'success' ? 'completed' : data.status === 'rejected' ? 'rejected' : 'failed'
              step.toolCall.durationMs = data.executionTimeMs
              break
            }
          }
        }
        if (msg.toolCalls) {
          for (let i = msg.toolCalls.length - 1; i >= 0; i--) {
            if (msg.toolCalls[i].toolCallId === data.id) {
              msg.toolCalls[i].result = data.result
              msg.toolCalls[i].status = data.status === 'success' ? 'completed' : data.status === 'rejected' ? 'rejected' : 'failed'
              msg.toolCalls[i].durationMs = data.executionTimeMs
              break
            }
          }
        }
        break
      }
      case 'done': {
        msg.status = 'completed'
        streaming.value = false
        agentPhase.value = 'done'
        if (streamTimeoutTimer) clearTimeout(streamTimeoutTimer)
        cleanupAgentEventListener()
        break
      }
      case 'error': {
        const data = event.data as { message: string }
        msg.status = 'error'
        error.value = data.message
        streaming.value = false
        agentPhase.value = null
        if (streamTimeoutTimer) clearTimeout(streamTimeoutTimer)
        cleanupAgentEventListener()
        break
      }
    }
  }

  function setupAgentEventListener() {
    resetStreamTimeout()
    window.electronAPI.chat.onAgentEvent((_event, data) => {
      if (data.sessionId === currentSessionId.value) {
        handleAgentEvent(data.event)
      }
    })
    window.electronAPI.chat.onApprovalRequest((_event, data) => {
      approvalPending.value = {
        toolCallId: data.requestId,
        toolName: data.toolName,
        parameters: data.toolArgs,
        requestId: data.requestId
      }
    })
  }

  function cleanupAgentEventListener() {
    if (streamTimeoutTimer) { clearTimeout(streamTimeoutTimer); streamTimeoutTimer = null }
    window.electronAPI.chat.removeAgentListeners()
    window.electronAPI.chat.removeApprovalListeners()
  }

  return {
    sessions,
    currentSessionId,
    messages,
    streaming,
    agentPhase,
    approvalPending,
    error,
    currentSession,
    fetchSessions,
    createSession,
    deleteSession,
    fetchMessages,
    sendMessage,
    abortChat,
    approveToolCall,
    setupAgentEventListener,
    cleanupAgentEventListener
  }
})
