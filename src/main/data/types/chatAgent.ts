export interface ChatSession {
  id: string
  projectId: string | null
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  model: string | null
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  thinking?: string
  thinkingSteps?: ThinkingStep[]
  toolCalls?: ToolCallStep[]
  status: 'pending' | 'streaming' | 'completed' | 'error'
  timestamp: string
}

export interface ThinkingStep {
  text: string
  toolCall?: ToolCallStep
}

export interface ToolCallStep {
  toolCallId: string
  toolName: string
  parameters: string
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'rejected'
  result?: string
  durationMs?: number
}

export type AgentEvent = {
  type: 'thinking' | 'content' | 'tool_call' | 'tool_result' | 'done' | 'error'
  data: unknown
}

export interface LLMToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface LLMToolCall {
  id: string
  name: string
  arguments: string
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  toolCalls?: LLMToolCall[]
  toolCallId?: string
}
