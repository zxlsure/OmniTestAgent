import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export abstract class BaseConfigRepo<T> {
  protected abstract tableName: string

  getActive(): T | null {
    return db().get(`SELECT * FROM ${this.tableName} WHERE is_active = 1 LIMIT 1`) as T | null
  }

  protected upsert(updateSql: string, updateParams: unknown[], insertSql: string, insertParams: unknown[]): T {
    const existing = db().get(`SELECT id FROM ${this.tableName} WHERE is_active = 1`) as { id: string } | null
    if (existing) {
      db().run(updateSql, [...updateParams, existing.id])
      return db().get(`SELECT * FROM ${this.tableName} WHERE id = ?`, [existing.id]) as T
    }
    const id = randomUUID()
    const now = new Date().toISOString()
    db().run(insertSql, [id, ...insertParams, now, now])
    return db().get(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]) as T
  }

  protected upsertByKey(keyColumn: string, keyValue: unknown, updateSql: string, updateParams: unknown[], insertSql: string, insertParams: unknown[]): T {
    const existing = db().get(`SELECT id FROM ${this.tableName} WHERE ${keyColumn} = ?`, [keyValue]) as { id: string } | null
    if (existing) {
      db().run(updateSql, [...updateParams, existing.id])
      return db().get(`SELECT * FROM ${this.tableName} WHERE id = ?`, [existing.id]) as T
    }
    const id = randomUUID()
    const now = new Date().toISOString()
    db().run(insertSql, [id, ...insertParams, now, now])
    return db().get(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]) as T
  }
}
