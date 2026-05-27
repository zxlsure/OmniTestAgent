import { ipcMain, BrowserWindow } from 'electron'
import { registerIpcHandler } from './helpers'
import { llmService } from '../services/LlmService'

interface ChatParams {
  sessionId: string
  message: string
  projectId?: string
  useRag?: boolean
  knowledgeBaseId?: string
}

interface LlmConfigInput {
  modelName: string
  apiUrl: string
  apiKey: string
  temperature?: number
  maxTokens?: number
}

export function registerLlmHandler(): void {
  registerIpcHandler('llm:chat', (params: ChatParams) => llmService.chat(params))
  registerIpcHandler('llm:streamChat', (params: ChatParams) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) throw new Error('No focused window available')
    return llmService.streamChat(params, win)
  })
  registerIpcHandler('llm:testConnection', (config: { modelName: string; apiUrl: string; apiKey: string }) =>
    llmService.testConnection(config.modelName, config.apiUrl, config.apiKey))
  registerIpcHandler('llm:getConfig', () => llmService.getConfig())
  registerIpcHandler('llm:saveConfig', (config: LlmConfigInput) =>
    llmService.saveConfig(config.modelName, config.apiUrl, config.apiKey, config.temperature ?? 0.7, config.maxTokens ?? 4096))
}
