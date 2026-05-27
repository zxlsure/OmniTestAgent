import { registerIpcHandler } from './helpers'
import { channelManager } from '../services/ChannelManager'

export function registerChannelHandler(): void {
  registerIpcHandler('channel:configure', (data: { type: string; config: unknown; isEnabled: boolean }) => channelManager.configure(data.type, data.config, data.isEnabled))
  registerIpcHandler('channel:test', (type: string) => channelManager.test(type))
  registerIpcHandler('channel:send', (params: { type: string; message: string }) => channelManager.send(params.type, params.message))
  registerIpcHandler('channel:getConfig', (type: string) => channelManager.getConfig(type))
}
