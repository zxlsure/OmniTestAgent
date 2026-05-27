import { registerIpcHandler } from './helpers'
import { getConfig, saveConfig, deleteConfig } from '../data/secureStore'

export function registerStoreHandler(): void {
  registerIpcHandler('store:get', (key: string) => getConfig(key))
  registerIpcHandler('store:set', (key: string, value: any) => saveConfig(key, value))
  registerIpcHandler('store:delete', (key: string) => deleteConfig(key))
}
