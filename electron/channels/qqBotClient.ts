import { logger } from '../utils/logger'

export interface BotConfig {
  webhookUrl?: string
  token?: string
  secret?: string
}

export class QqBotClient {
  private config: BotConfig | null = null

  configure(config: BotConfig): void {
    this.config = config
    logger.info('QQ Bot configured')
  }

  async send(message: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config?.webhookUrl) return { success: false, error: 'QQ Bot未配置' }
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
        body: JSON.stringify({ message })
      })
      return { success: response.ok }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.config?.webhookUrl) return { success: false, error: '未配置webhook URL' }
    try {
      const response = await fetch(this.config.webhookUrl, { method: 'GET', signal: AbortSignal.timeout(5000) })
      return { success: response.ok }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

export const qqBotClient = new QqBotClient()
