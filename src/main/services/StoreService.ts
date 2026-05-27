import { getConfig, saveConfig, deleteConfig } from '../data/secureStore'

export class StoreService {
  async getConfig(key: string): Promise<unknown> {
    return getConfig(key)
  }

  async saveConfig(key: string, value: unknown): Promise<void> {
    saveConfig(key, value)
  }

  async deleteConfig(key: string): Promise<void> {
    deleteConfig(key)
  }
}

export const storeService = new StoreService()
