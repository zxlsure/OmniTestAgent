import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { logger } from '../utils/logger'
import { runMigrations } from './migrations/001_initial'

let db: SqlJsDatabase | null = null
let dbPath: string = ''
let saveTimer: ReturnType<typeof setInterval> | null = null

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

function saveToDisk(): void {
  if (!db) return
  try {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
  } catch (error) {
    logger.error('Failed to save database to disk:', error)
  }
}

export async function initDatabase(): Promise<void> {
  dbPath = join(app.getPath('userData'), 'omni-test-agent.db')
  logger.info(`Initializing database at: ${dbPath}`)

  const SQL = await initSqlJs()

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')
  db.run('PRAGMA journal_mode = WAL')

  runMigrations(db)

  saveTimer = setInterval(saveToDisk, 30000)

  logger.info('Database initialized successfully')
}

export function closeDatabase(): void {
  if (saveTimer) {
    clearInterval(saveTimer)
    saveTimer = null
  }
  if (db) {
    saveToDisk()
    db.close()
    db = null
    logger.info('Database closed')
  }
}
