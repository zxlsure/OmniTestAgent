import { BrowserWindow } from 'electron'
import { llmService } from '../LlmService'
import { llmConfigRepo } from '../../data/repositories/LlmConfigRepo'
import { chatRepo } from '../../data/repositories/ChatRepo'
import { getApiKey } from '../../data/secureStore'
import { dynamicImport } from '../../utils/dynamicImport'
import { logger } from '../../utils/logger'
import { fileOperationService } from '../FileOperationService'
import { getToolSchemas, executeTool, isAutoApproval, type ToolContext } from './toolRegistry'
import type { AgentEvent, LLMMessage, LLMToolCall } from '../../data/types/chatAgent'

const MAX_AGENT_ROUNDS = 10
const TOOL_TIMEOUT_MS = 60_000

export interface AgentRequest {
  systemPrompt: string
  userMessage: string
  sessionId: string
  projectId: string
  knowledgeBaseId?: string
  historyMessages: Array<{ role: string; content: string }>
}

export async function* executeAgentLoop(
  request: AgentRequest,
  win: BrowserWindow,
  abortSignal: AbortSignal
): AsyncGenerator<AgentEvent> {
  let round = 0
  const conversationMessages: LLMMessage[] = [
    { role: 'system', content: request.systemPrompt }
  ]

  for (const msg of request.historyMessages) {
    conversationMessages.push({ role: msg.role as any, content: msg.content })
  }

  const resolvedUserMessage = await resolveFileReferences(request.projectId, request.userMessage)
  conversationMessages.push({ role: 'user', content: resolvedUserMessage })

  let contentBuffer = ''

  while (round < MAX_AGENT_ROUNDS) {
    if (abortSignal.aborted) {
      yield { type: 'error', data: { code: 'ABORTED', message: 'Agent execution aborted by user', retryable: false } }
      return
    }

    round++

    try {
      const client = await getLlmClient()
      const config = llmConfigRepo.getActive()
      if (!config) {
        yield { type: 'error', data: { code: 'NO_CONFIG', message: 'LLM not configured', retryable: false } }
        return
      }

      const toolSchemas = getToolSchemas()
      const openaiMessages = conversationMessages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.toolCalls ? { tool_calls: m.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments }
        })) } : {}),
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {})
      }))

      const stream = await client.chat.completions.create({
        model: config.model_name,
        messages: openaiMessages,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        stream: true,
        tools: toolSchemas
      })

      let hasToolCall = false
      let thinkingBuffer = ''
      const pendingToolCalls: LLMToolCall[] = []
      let currentToolCall: Partial<LLMToolCall> | null = null
      let finishReason: string | null = null

      for await (const chunk of stream) {
        if (abortSignal.aborted) break

        const choice = chunk.choices?.[0]
        if (!choice) continue

        const delta = choice.delta

        if (delta?.content) {
          contentBuffer += delta.content
          yield { type: 'content', data: { content: delta.content } }
        }

        if (delta?.reasoning_content) {
          thinkingBuffer += delta.reasoning_content
          yield { type: 'thinking', data: { content: delta.reasoning_content } }
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              if (currentToolCall && currentToolCall.id) {
                pendingToolCalls.push(currentToolCall as LLMToolCall)
              }
              currentToolCall = { id: tc.id, name: tc.function?.name || '', arguments: '' }
            }
            if (tc.function?.name && currentToolCall) {
              currentToolCall.name = tc.function.name
            }
            if (tc.function?.arguments && currentToolCall) {
              currentToolCall.arguments += tc.function.arguments
            }
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason
        }
      }

      if (currentToolCall && currentToolCall.id) {
        pendingToolCalls.push(currentToolCall as LLMToolCall)
      }

      if (thinkingBuffer) {
        conversationMessages.push({
          role: 'assistant',
          content: thinkingBuffer + (contentBuffer ? '\n' + contentBuffer : ''),
          toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined
        })
      } else if (contentBuffer || pendingToolCalls.length > 0) {
        conversationMessages.push({
          role: 'assistant',
          content: contentBuffer || null,
          toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined
        })
      }

      if (pendingToolCalls.length > 0) {
        hasToolCall = true

        const assistantContent = contentBuffer
        contentBuffer = ''

        for (const toolCall of pendingToolCalls) {
          yield {
            type: 'tool_call',
            data: { id: toolCall.id, name: toolCall.name, args: toolCall.arguments }
          }

          if (!isAutoApproval(toolCall.name)) {
            const approved = await requestToolApproval(
              toolCall, request.sessionId, win
            )
            if (!approved) {
              const rejectMsg = `用户拒绝执行工具: ${toolCall.name}`
              yield {
                type: 'tool_result',
                data: { id: toolCall.id, name: toolCall.name, result: rejectMsg, status: 'rejected' }
              }
              conversationMessages.push({
                role: 'tool',
                content: rejectMsg,
                toolCallId: toolCall.id
              })
              continue
            }
          }

          try {
            const toolContext: ToolContext = {
              projectId: request.projectId,
              sessionId: request.sessionId,
              knowledgeBaseId: request.knowledgeBaseId
            }
            const args = parseToolArguments(toolCall.arguments)
            const result = await Promise.race(
              [
                executeTool(toolCall.name, args, toolContext),
                timeoutPromise(TOOL_TIMEOUT_MS, `工具 ${toolCall.name} 执行超时`)
              ]
            )
            yield {
              type: 'tool_result',
              data: { id: toolCall.id, name: toolCall.name, result, status: 'success' }
            }
            conversationMessages.push({
              role: 'tool',
              content: result,
              toolCallId: toolCall.id
            })
          } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            yield {
              type: 'tool_result',
              data: { id: toolCall.id, name: toolCall.name, result: errorMsg, status: 'failed' }
            }
            conversationMessages.push({
              role: 'tool',
              content: `Error: ${errorMsg}`,
              toolCallId: toolCall.id
            })
          }
        }
      }

      if (!hasToolCall || finishReason === 'stop') {
        break
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('Agent loop error:', error)
      yield { type: 'error', data: { code: 'LOOP_ERROR', message: errorMsg, retryable: true } }
      break
    }
  }

  chatRepo.addMessage(request.sessionId, 'user', request.userMessage)
  chatRepo.addMessage(request.sessionId, 'assistant', contentBuffer)

  yield {
    type: 'done',
    data: { content: contentBuffer, rounds: round }
  }
}

async function getLlmClient(): Promise<any> {
  const config = llmConfigRepo.getActive()
  if (!config) throw new Error('LLM not configured')
  const apiKey = getApiKey('llm')
  if (!apiKey) throw new Error('API Key not configured')
  const OpenAI = (await dynamicImport('openai')).default
  return new OpenAI({ apiKey, baseURL: config.api_url, dangerouslyAllowBrowser: false })
}

function parseToolArguments(argsStr: string): Record<string, unknown> {
  try {
    return JSON.parse(argsStr)
  } catch {
    return {}
  }
}

function timeoutPromise(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms)
  })
}

const pendingApprovals: Map<string, { resolve: (approved: boolean) => void }> = new Map()

function requestToolApproval(
  toolCall: LLMToolCall,
  sessionId: string,
  win: BrowserWindow
): Promise<boolean> {
  return new Promise((resolve) => {
    const requestId = `${sessionId}:${toolCall.id}`
    pendingApprovals.set(requestId, { resolve })

    win.webContents.send('chatAgent:approvalRequest', {
      requestId,
      toolName: toolCall.name,
      toolArgs: parseToolArguments(toolCall.arguments),
      sessionId
    })

    setTimeout(() => {
      pendingApprovals.delete(requestId)
      resolve(false)
    }, 120_000)
  })
}

export function resolveApproval(requestId: string, approved: boolean): void {
  const pending = pendingApprovals.get(requestId)
  if (pending) {
    pending.resolve(approved)
    pendingApprovals.delete(requestId)
  }
}

async function resolveFileReferences(projectId: string, message: string): Promise<string> {
  const fileRefRegex = /@([\w./\-]+\.[\w]+)/g
  const matches = [...message.matchAll(fileRefRegex)]
  if (matches.length === 0) return message

  const injectedParts: string[] = []
  for (const match of matches) {
    const fileName = match[1]
    try {
      const projectDir = fileOperationService.getProjectDir(projectId)
      const { readdirSync, statSync, readFileSync } = await import('fs')
      const { join: pathJoin } = await import('path')

      function findFile(dir: string, target: string): string | null {
        const entries = readdirSync(dir)
        for (const entry of entries) {
          const fullPath = pathJoin(dir, entry)
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            const found = findFile(fullPath, target)
            if (found) return found
          } else if (entry === target) {
            return fullPath
          }
        }
        return null
      }

      const foundPath = findFile(projectDir, fileName)
      if (foundPath) {
        const content = readFileSync(foundPath, 'utf-8')
        injectedParts.push(`[Referenced File: ${fileName}]\n${content}`)
      } else {
        injectedParts.push(`[Referenced File: ${fileName}]\n[文件未找到]`)
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      injectedParts.push(`[Referenced File: ${fileName}]\n[读取失败: ${errMsg}]`)
    }
  }

  return injectedParts.length > 0
    ? `${injectedParts.join('\n\n')}\n\n${message}`
    : message
}
