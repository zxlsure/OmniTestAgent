import { logger } from '../utils/logger'

export function registerAllIpcHandlers(): void {
  logger.info('Registering all IPC handlers...')

  const handlers = [
    () => import('./projectHandler').then(m => m.registerProjectHandler()),
    () => import('./llmHandler').then(m => m.registerLlmHandler()),
    () => import('./knowledgeHandler').then(m => m.registerKnowledgeHandler()),
    () => import('./mcpHandler').then(m => m.registerMcpHandler()),
    () => import('./skillHandler').then(m => m.registerSkillHandler()),
    () => import('./channelHandler').then(m => m.registerChannelHandler()),
    () => import('./testflowHandler').then(m => m.registerTestflowHandler()),
    () => import('./storeHandler').then(m => m.registerStoreHandler())
  ]

  for (const register of handlers) {
    try {
      register()
    } catch (error) {
      logger.error('Failed to register IPC handler:', error)
    }
  }

  logger.info('All IPC handlers registered')
}
