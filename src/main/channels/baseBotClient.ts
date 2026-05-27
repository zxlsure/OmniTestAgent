import { logger } from '../utils/logger'

export interface BotClientConfig {
  webhookUrl: string
  token?: string
  [key: string]: unknown
}

export abstract class BaseBotClient {
  protected config: BotClientConfig | null = null

  configure(config: BotClientConfig): void {
    this.config = config
  }

  async send(message: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config?.webhookUrl) return { success: false, error: '未配置' }
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(this.getRequestBody(message))
      })
      return { success: response.ok }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('Bot send failed:', msg)
      return { success: false, error: msg }
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.config?.webhookUrl) return { success: false, error: '未配置webhook URL' }
    try {
      const response = await fetch(this.config.webhookUrl, { method: 'GET', signal: AbortSignal.timeout(5000) })
      return { success: response.ok }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  }

  protected abstract getHeaders(): Record<string, string>
  protected abstract getRequestBody(message: string): unknown
}
