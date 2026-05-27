import { registerIpcHandler } from './helpers'
import { storeService } from '../services/StoreService'

export function registerStoreHandler(): void {
  registerIpcHandler('store:get', (key: string) => storeService.getConfig(key))
  registerIpcHandler('store:set', (key: string, value: unknown) => storeService.saveConfig(key, value))
  registerIpcHandler('store:delete', (key: string) => storeService.deleteConfig(key))
}
