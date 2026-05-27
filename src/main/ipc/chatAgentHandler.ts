import { ipcMain, BrowserWindow } from 'electron'
import { registerIpcHandler } from './helpers'
import { chatAgentService } from '../services/chat/chatAgentService'
import { logger } from '../utils/logger'

export function registerChatAgentHandler(): void {
  registerIpcHandler('chat:sendMessage', async (params: {
    sessionId: string; message: string; projectId: string; knowledgeBaseId?: string
  }) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) throw new Error('No focused window available')
    return chatAgentService.startChat(
      params.sessionId, params.message, params.projectId, win, params.knowledgeBaseId
    )
  })

  registerIpcHandler('chat:abort', async (params: { sessionId: string }) => {
    chatAgentService.abortChat(params.sessionId)
  })

  registerIpcHandler('chat:approveToolCall', async (params: {
    sessionId: string; toolCallId: string; approved: boolean
  }) => {
    chatAgentService.approveToolCall(params.sessionId, params.toolCallId, params.approved)
  })

  registerIpcHandler('chat:getSessions', async (params?: { projectId?: string }) => {
    return chatAgentService.getSessions(params?.projectId)
  })

  registerIpcHandler('chat:createSession', async (params: {
    projectId: string; title?: string
  }) => {
    return chatAgentService.createSession(params.projectId, params.title)
  })

  registerIpcHandler('chat:deleteSession', async (params: { sessionId: string }) => {
    return chatAgentService.deleteSession(params.sessionId)
  })

  registerIpcHandler('chat:getMessages', async (params: { sessionId: string }) => {
    return chatAgentService.getMessages(params.sessionId)
  })

  ipcMain.on('chatAgent:approvalResponse', (_event, params: {
    requestId: string; approved: boolean; reason?: string
  }) => {
    try {
      const [sessionId, toolCallId] = params.requestId.split(':')
      chatAgentService.approveToolCall(sessionId, toolCallId, params.approved)
    } catch (error) {
      logger.error('Failed to resolve approval:', error)
    }
  })

  logger.info('ChatAgent IPC handlers registered')
}
