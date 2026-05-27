import { ipcMain } from 'electron'
import { logger } from '../utils/logger'

export function registerIpcHandler(
  channel: string,
  handler: (...args: any[]) => any | Promise<any>
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      logger.error(`IPC handler error [${channel}]:`, error)
      throw error
    }
  })
}

export function registerIpcEventListener(
  channel: string,
  listener: (...args: any[]) => void
): void {
  ipcMain.on(channel, (_event, ...args) => {
    try {
      listener(...args)
    } catch (error) {
      logger.error(`IPC listener error [${channel}]:`, error)
    }
  })
}
