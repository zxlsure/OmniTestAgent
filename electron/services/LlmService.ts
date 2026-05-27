import { BrowserWindow } from 'electron'
import { llmConfigRepo } from '../data/repositories/LlmConfigRepo'
import { chatRepo } from '../data/repositories/ChatRepo'
import { getApiKey, saveApiKey } from '../data/secureStore'
import { maskApiKey } from '../utils/crypto'
import { logger } from '../utils/logger'

export interface ChatParams {
  sessionId: string
  message: string
  projectId?: string
  useRag?: boolean
  knowledgeBaseId?: string
}

export class LlmService {
  private client: any = null

  private async getClient(): Promise<any> {
    if (this.client) return this.client
    const config = llmConfigRepo.getActive()
    if (!config) throw new Error('LLM not configured')
    const apiKey = getApiKey('llm')
    if (!apiKey) throw new Error('API Key not configured')
    const OpenAI = (await import('openai')).default
    this.client = new OpenAI({
      apiKey,
      baseURL: config.api_url,
      dangerouslyAllowBrowser: false
    })
    return this.client
  }

  resetClient(): void {
    this.client = null
  }

  async chat(params: ChatParams): Promise<string> {
    const client = await this.getClient()
    const config = llmConfigRepo.getActive()!
    const messages = await this.buildMessages(params)

    const response = await client.chat.completions.create({
      model: config.model_name,
      messages,
      temperature: config.temperature,
      max_tokens: config.max_tokens
    })

    const content = response.choices[0]?.message?.content || ''
    chatRepo.addMessage(params.sessionId, 'user', params.message)
    chatRepo.addMessage(params.sessionId, 'assistant', content, response.usage?.total_tokens)
    return content
  }

  async streamChat(params: ChatParams, win: BrowserWindow): Promise<void> {
    const client = await this.getClient()
    const config = llmConfigRepo.getActive()!
    const messages = await this.buildMessages(params)

    chatRepo.addMessage(params.sessionId, 'user', params.message)

    const stream = await client.chat.completions.create({
      model: config.model_name,
      messages,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      stream: true
    })

    let fullContent = ''
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        fullContent += content
        win.webContents.send('llm:streamChunk', {
          sessionId: params.sessionId, content, done: false
        })
      }
    }

    win.webContents.send('llm:streamEnd', { sessionId: params.sessionId })
    chatRepo.addMessage(params.sessionId, 'assistant', fullContent)
  }

  private async buildMessages(params: ChatParams): Promise<any[]> {
    const messages: any[] = [
      { role: 'system', content: 'You are OmniTestAgent, an intelligent testing assistant focused on software testing.' }
    ]
    const history = chatRepo.getMessages(params.sessionId)
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content })
    }
    messages.push({ role: 'user', content: params.message })
    return messages
  }

  async testConnection(modelName: string, apiUrl: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      const OpenAI = (await import('openai')).default
      const client = new OpenAI({ apiKey, baseURL: apiUrl, dangerouslyAllowBrowser: false })
      await client.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Connection failed' }
    }
  }

  saveConfig(modelName: string, apiUrl: string, apiKey: string, temperature: number, maxTokens: number): void {
    llmConfigRepo.save(modelName, apiUrl, temperature, maxTokens)
    saveApiKey('llm', apiKey)
    this.resetClient()
    logger.info('LLM config saved')
  }

  getConfig(): any {
    const config = llmConfigRepo.getActive()
    const apiKey = getApiKey('llm')
    return { ...config, apiKey: apiKey ? maskApiKey(apiKey) : '', hasApiKey: !!apiKey }
  }
}

export const llmService = new LlmService()
