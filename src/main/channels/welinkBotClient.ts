import { BaseBotClient, BotClientConfig } from './baseBotClient'
import { logger } from '../utils/logger'

export interface WelinkConfig {
  webhookUrl?: string
  appId?: string
  appSecret?: string
}

export class WelinkBotClient extends BaseBotClient {
  configure(config: BotClientConfig): void {
    super.configure(config)
    logger.info('Welink Bot configured')
  }

  protected getHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json' }
  }

  protected getRequestBody(message: string): unknown {
    return { msg_type: 'text', content: { text: message } }
  }
}

export const welinkBotClient = new WelinkBotClient()
