import { BrowserWindow } from 'electron'
import { chatRepo } from '../../data/repositories/ChatRepo'
import { skillRegistry } from '../SkillRegistry'
import { testFlowPipelineService } from '../TestFlowPipelineService'
import { logger } from '../../utils/logger'
import { buildSystemPrompt, type PromptContext } from './promptBuilder'
import { executeAgentLoop, resolveApproval, type AgentRequest } from './agentExecutor'
import type { ChatSession, ChatMessage, AgentEvent } from '../../data/types/chatAgent'

export class ChatAgentService {
  private abortControllers: Map<string, AbortController> = new Map()
  private executingSessions: Set<string> = new Set()

  async startChat(
    sessionId: string,
    message: string,
    projectId: string,
    win: BrowserWindow,
    knowledgeBaseId?: string
  ): Promise<void> {
    if (this.executingSessions.has(sessionId)) {
      throw new Error('Session is already executing')
    }

    const abortController = new AbortController()
    this.abortControllers.set(sessionId, abortController)
    this.executingSessions.add(sessionId)

    try {
      const pipelineState = projectId
        ? testFlowPipelineService.getPipelineState(projectId)
        : undefined

      const enabledSkills = skillRegistry.list().filter(s =>
        skillRegistry.isSkillEnabled(s.name)
      )

      const promptContext: PromptContext = {
        projectId,
        knowledgeBaseId,
        userMessage: message,
        pipelineState,
        enabledSkills
      }

      const systemPrompt = await buildSystemPrompt(promptContext)

      const history = chatRepo.getMessages(sessionId)
      const historyMessages = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const request: AgentRequest = {
        systemPrompt,
        userMessage: message,
        sessionId,
        projectId,
        knowledgeBaseId,
        historyMessages
      }

      const generator = executeAgentLoop(request, win, abortController.signal)

      for await (const event of generator) {
        win.webContents.send('chat:agentEvent', { sessionId, event })
      }
    } catch (error: any) {
      logger.error(`Chat agent execution failed for session ${sessionId}:`, error)
      win.webContents.send('chat:agentEvent', {
        sessionId,
        event: { type: 'error', data: { code: 'EXEC_ERROR', message: error.message, retryable: false } }
      })
    } finally {
      this.abortControllers.delete(sessionId)
      this.executingSessions.delete(sessionId)
    }
  }

  abortChat(sessionId: string): void {
    const controller = this.abortControllers.get(sessionId)
    if (controller) {
      controller.abort()
      this.abortControllers.delete(sessionId)
      this.executingSessions.delete(sessionId)
      logger.info(`Chat aborted for session: ${sessionId}`)
    }
  }

  approveToolCall(sessionId: string, toolCallId: string, approved: boolean): void {
    const requestId = `${sessionId}:${toolCallId}`
    resolveApproval(requestId, approved)
  }

  isExecuting(sessionId: string): boolean {
    return this.executingSessions.has(sessionId)
  }

  getSessions(projectId?: string): any[] {
    return chatRepo.listSessions(projectId || undefined)
  }

  createSession(projectId: string, title?: string): any {
    return chatRepo.createSession(projectId || null, title || 'New Chat')
  }

  deleteSession(sessionId: string): boolean {
    return chatRepo.deleteSession(sessionId)
  }

  getMessages(sessionId: string): any[] {
    return chatRepo.getMessages(sessionId)
  }
}

export const chatAgentService = new ChatAgentService()
