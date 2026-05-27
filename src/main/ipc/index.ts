import { logger } from '../utils/logger'

export async function registerAllIpcHandlers(): Promise<void> {
  logger.info('Registering all IPC handlers...')

  const handlers = [
    () => import('./projectHandler').then(m => m.registerProjectHandler()),
    () => import('./llmHandler').then(m => m.registerLlmHandler()),
    () => import('./knowledgeHandler').then(m => m.registerKnowledgeHandler()),
    () => import('./mcpHandler').then(m => m.registerMcpHandler()),
    () => import('./skillHandler').then(m => m.registerSkillHandler()),
    () => import('./channelHandler').then(m => m.registerChannelHandler()),
    () => import('./testflowHandler').then(m => m.registerTestflowHandler()),
    () => import('./storeHandler').then(m => m.registerStoreHandler()),
    () => import('./pipelineHandler').then(m => m.registerPipelineHandler()),
    () => import('./fileOpHandler').then(m => m.registerFileOpHandler()),
    () => import('./chatAgentHandler').then(m => m.registerChatAgentHandler())
  ]

  for (const register of handlers) {
    try {
      await register()
    } catch (error) {
      logger.error('Failed to register IPC handler:', error)
    }
  }

  logger.info('All IPC handlers registered')
}
