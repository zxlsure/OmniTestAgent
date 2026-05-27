import { logger } from '../utils/logger'

export interface WelinkConfig {
  webhookUrl?: string
  appId?: string
  appSecret?: string
}

export class WelinkBotClient {
  private config: WelinkConfig | null = null

  configure(config: WelinkConfig): void {
    this.config = config
    logger.info('Welink Bot configured')
  }

  async send(message: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config?.webhookUrl) return { success: false, error: 'Welink Bot未配置' }
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msg_type: 'text', content: { text: message } })
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

export const welinkBotClient = new WelinkBotClient()
