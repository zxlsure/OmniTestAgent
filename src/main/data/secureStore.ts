import { app } from 'electron'
import { logger } from '../utils/logger'
import { dynamicImport } from '../utils/dynamicImport'
import { createHash } from 'crypto'
import { getMachineId } from '../utils/machineId'

let store: any = null

function getStoreEncryptionKey(): string {
  const machineId = getMachineId()
  return createHash('sha256').update(`omni-test-agent-secure-key:${machineId}`).digest('hex')
}

export async function initSecureStore(): Promise<void> {
  try {
    const ElectronStore = (await dynamicImport('electron-store')).default
    store = new ElectronStore({
      name: 'secure-config',
      encryptionKey: getStoreEncryptionKey()
    })
    logger.info('Secure store initialized')
  } catch (error) {
    logger.error('Failed to init secure store:', error)
    store = {
      get: (key: string) => undefined,
      set: () => {},
      delete: () => {}
    }
  }
}

export function getSecureStore(): any {
  if (!store) throw new Error('Secure store not initialized')
  return store
}

export function saveApiKey(service: string, apiKey: string): void {
  const { encrypt } = require('../utils/crypto')
  const encrypted = encrypt(apiKey, service)
  getSecureStore().set(`apiKeys.${service}`, encrypted)
  logger.info(`API key saved for service: ${service}`)
}

export function getApiKey(service: string): string | null {
  const { decrypt } = require('../utils/crypto')
  const encrypted = getSecureStore().get(`apiKeys.${service}`) as string | undefined
  if (!encrypted) return null
  try {
    return decrypt(encrypted, service)
  } catch (error) {
    logger.error(`Failed to decrypt API key for ${service}:`, error)
    return null
  }
}

export function deleteApiKey(service: string): void {
  getSecureStore().delete(`apiKeys.${service}`)
}

export function saveConfig(key: string, value: unknown): void {
  getSecureStore().set(key, value)
}

export function getConfig(key: string): unknown {
  return getSecureStore().get(key)
}

export function deleteConfig(key: string): void {
  getSecureStore().delete(key)
}
