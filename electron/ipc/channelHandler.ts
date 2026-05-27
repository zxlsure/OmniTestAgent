import { registerIpcHandler } from './helpers'
import { channelManager } from '../services/ChannelManager'

export function registerChannelHandler(): void {
  registerIpcHandler('channel:configure', (data: any) => channelManager.configure(data.type, data.config, data.isEnabled))
  registerIpcHandler('channel:test', (type: string) => channelManager.test(type))
  registerIpcHandler('channel:send', (params: any) => channelManager.send(params.type, params.message))
  registerIpcHandler('channel:getConfig', (type: string) => channelManager.getConfig(type))
}
