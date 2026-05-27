import { getDatabase } from './database'
import type { Database as SqlJsDatabase } from 'sql.js'

export class DbAdapter {
  private db: SqlJsDatabase

  constructor() {
    this.db = getDatabase()
  }

  run(sql: string, params: unknown[] = []): { changes: number } {
    this.db.run(sql, params as string[])
    return { changes: this.db.getRowsModified() }
  }

  get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
    const stmt = this.db.prepare(sql)
    stmt.bind(params as string[])
    if (stmt.step()) {
      const row = stmt.getAsObject() as T
      stmt.free()
      return row
    }
    stmt.free()
    return null
  }

  all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql)
    stmt.bind(params as string[])
    const rows: T[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T)
    }
    stmt.free()
    return rows
  }

  exec(sql: string): void {
    this.db.run(sql)
  }

  prepare<T = Record<string, unknown>>(sql: string): { bind: (params?: unknown[]) => void; step: () => boolean; get: () => T | null; free: () => void } {
    const stmt = this.db.prepare(sql)
    return {
      bind: (params: unknown[] = []) => stmt.bind(params as string[]),
      step: () => stmt.step(),
      get: () => stmt.getAsObject() as T,
      free: () => stmt.free()
    }
  }
}

export function db(): DbAdapter {
  return new DbAdapter()
}
