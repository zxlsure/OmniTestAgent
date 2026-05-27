import type { Database as SqlJsDatabase } from 'sql.js'

export function runMigration003(db: SqlJsDatabase): void {
  db.run('ALTER TABLE project ADD COLUMN directory TEXT')
}
