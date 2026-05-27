import { BaseBotClient, BotClientConfig } from './baseBotClient'
import { logger } from '../utils/logger'

export interface BotConfig {
  webhookUrl?: string
  token?: string
  secret?: string
}

export class QqBotClient extends BaseBotClient {
  configure(config: BotClientConfig): void {
    super.configure(config)
    logger.info('QQ Bot configured')
  }

  protected getHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config?.token || ''}` }
  }

  protected getRequestBody(message: string): unknown {
    return { message }
  }
}

export const qqBotClient = new QqBotClient()
