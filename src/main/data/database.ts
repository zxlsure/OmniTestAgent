import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { logger } from '../utils/logger'
import { runMigrations } from './migrations/001_initial'
import { runMigration002 } from './migrations/002_chat_agent'
import { runMigration003 } from './migrations/003_project_directory'

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

  try {
    const row = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='_migration_version'")
    let currentVersion = 0
    if (row.length > 0 && row[0].values.length > 0) {
      const verRow = db.exec('SELECT version FROM _migration_version')
      if (verRow.length > 0 && verRow[0].values.length > 0) {
        currentVersion = verRow[0].values[0][0] as number
      }
    } else {
      db.run('CREATE TABLE _migration_version (version INTEGER PRIMARY KEY)')
    }

    if (currentVersion < 2) {
      runMigration002(db)
      db.run('INSERT OR REPLACE INTO _migration_version (version) VALUES (2)')
      logger.info('Migration 002 (chat_agent) applied')
    }

    if (currentVersion < 3) {
      runMigration003(db)
      db.run('INSERT OR REPLACE INTO _migration_version (version) VALUES (3)')
      logger.info('Migration 003 (project_directory) applied')
    }
  } catch (error) {
    logger.error('Migration failed:', error)
  }

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
