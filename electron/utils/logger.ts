import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private logDir: string = ''
  private logStream: fs.WriteStream | null = null

  init(): void {
    this.logDir = join(app.getPath('userData'), 'logs')
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true })
    }
    const date = new Date().toISOString().split('T')[0]
    const logFile = join(this.logDir, `app-${date}.log`)
    this.logStream = fs.createWriteStream(logFile, { flags: 'a' })
  }

  private write(level: LogLevel, ...args: any[]): void {
    const timestamp = new Date().toISOString()
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`

    if (this.logStream) {
      this.logStream.write(line)
    }

    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    consoleFn(`[${level.toUpperCase()}]`, ...args)
  }

  debug(...args: any[]): void { this.write('debug', ...args) }
  info(...args: any[]): void { this.write('info', ...args) }
  warn(...args: any[]): void { this.write('warn', ...args) }
  error(...args: any[]): void { this.write('error', ...args) }

  destroy(): void {
    this.logStream?.end()
    this.logStream = null
  }
}

export const logger = new Logger()
