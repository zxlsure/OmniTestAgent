import { channelConfigRepo } from '../data/repositories/ChannelConfigRepo'
import { qqBotClient } from '../channels/qqBotClient'
import { welinkBotClient } from '../channels/welinkBotClient'
import type { BotClientConfig } from '../channels/baseBotClient'
import { logger } from '../utils/logger'

export class ChannelManager {
  configure(type: string, config: unknown, isEnabled: boolean = false): void {
    const configStr = JSON.stringify(config)
    channelConfigRepo.save(type, configStr, isEnabled)
    if (type === 'qq') {
      qqBotClient.configure(config as BotClientConfig)
    } else if (type === 'welink') {
      welinkBotClient.configure(config as BotClientConfig)
    }
    logger.info(`Channel configured: ${type}`)
  }

  getConfig(type: string): unknown {
    const record = channelConfigRepo.getByType(type)
    if (!record) return null
    return { ...JSON.parse(record.config), isEnabled: record.is_enabled === 1 }
  }

  async test(type: string): Promise<{ success: boolean; error?: string }> {
    if (type === 'qq') return qqBotClient.testConnection()
    if (type === 'welink') return welinkBotClient.testConnection()
    return { success: false, error: `Unknown channel type: ${type}` }
  }

  async send(type: string, message: string): Promise<{ success: boolean; error?: string }> {
    if (type === 'qq') return qqBotClient.send(message)
    if (type === 'welink') return welinkBotClient.send(message)
    return { success: false, error: `Unknown channel type: ${type}` }
  }
}

export const channelManager = new ChannelManager()
