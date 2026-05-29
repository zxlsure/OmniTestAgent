import type { Database as SqlJsDatabase } from 'sql.js'
import { columnExists } from './migrationHelper'
import { logger } from '../../utils/logger'

export function runMigration003(db: SqlJsDatabase): void {
  if (columnExists(db, 'project', 'directory')) {
    logger.info('Migration 003 skipped: column "directory" already exists in table "project"')
    return
  }
  db.run('ALTER TABLE project ADD COLUMN directory TEXT')
  logger.info('Migration 003 applied: added column "directory" to table "project"')
}
