import type { Database as SqlJsDatabase } from 'sql.js'

export function columnExists(db: SqlJsDatabase, tableName: string, columnName: string): boolean {
  const result = db.exec(`PRAGMA table_info(${tableName})`)
  if (result.length === 0 || result[0].values.length === 0) {
    return false
  }
  const columnNames = result[0].values.map(row => row[1] as string)
  return columnNames.includes(columnName)
}
