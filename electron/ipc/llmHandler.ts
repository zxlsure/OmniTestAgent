import { ipcMain, BrowserWindow } from 'electron'
import { registerIpcHandler } from './helpers'
import { llmService } from '../services/LlmService'

export function registerLlmHandler(): void {
  registerIpcHandler('llm:chat', (params: any) => llmService.chat(params))
  registerIpcHandler('llm:streamChat', (params: any) => {
    const win = BrowserWindow.getFocusedWindow()!
    return llmService.streamChat(params, win)
  })
  registerIpcHandler('llm:testConnection', (config: any) =>
    llmService.testConnection(config.modelName, config.apiUrl, config.apiKey))
  registerIpcHandler('llm:getConfig', () => llmService.getConfig())
  registerIpcHandler('llm:saveConfig', (config: any) =>
    llmService.saveConfig(config.modelName, config.apiUrl, config.apiKey, config.temperature, config.maxTokens))
}
