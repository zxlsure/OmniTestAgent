import { getDatabase } from './database'

interface DbRow { [key: string]: any }

export class DbAdapter {
  private db: any

  constructor() {
    this.db = getDatabase()
  }

  run(sql: string, params: any[] = []): { changes: number } {
    this.db.run(sql, params)
    return { changes: this.db.getRowsModified() }
  }

  get(sql: string, params: any[] = []): DbRow | null {
    const stmt = this.db.prepare(sql)
    stmt.bind(params)
    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()
      return row
    }
    stmt.free()
    return null
  }

  all(sql: string, params: any[] = []): DbRow[] {
    const stmt = this.db.prepare(sql)
    stmt.bind(params)
    const rows: DbRow[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    return rows
  }

  exec(sql: string): void {
    this.db.run(sql)
  }

  prepare(sql: string): { run: (...params: any[]) => { changes: number }; get: (...params: any[]) => DbRow | null; all: (...params: any[]) => DbRow[] } {
    return {
      run: (...params: any[]) => this.run(sql, params),
      get: (...params: any[]) => this.get(sql, params),
      all: (...params: any[]) => this.all(sql, params)
    }
  }
}

export function db(): DbAdapter {
  return new DbAdapter()
}
