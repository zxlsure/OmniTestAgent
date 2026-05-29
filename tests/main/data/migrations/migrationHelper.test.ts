import { describe, it, expect } from 'vitest'

function columnExists(db: any, tableName: string, columnName: string): boolean {
  const result = db.exec(`PRAGMA table_info(${tableName})`)
  if (result.length === 0 || result[0].values.length === 0) {
    return false
  }
  const columnNames = result[0].values.map((row: any[]) => row[1] as string)
  return columnNames.includes(columnName)
}

describe('columnExists', () => {
  it('表不存在时返回 false', () => {
    const db = { exec: () => [] }
    expect(columnExists(db, 'nonexistent_table', 'directory')).toBe(false)
  })

  it('列存在时返回 true', () => {
    const db = {
      exec: () => [{
        columns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
        values: [[0, 'id', 'TEXT', 1, null, 1], [1, 'directory', 'TEXT', 0, null, 0]]
      }]
    }
    expect(columnExists(db, 'project', 'directory')).toBe(true)
  })

  it('列不存在时返回 false', () => {
    const db = {
      exec: () => [{
        columns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
        values: [[0, 'id', 'TEXT', 1, null, 1]]
      }]
    }
    expect(columnExists(db, 'project', 'directory')).toBe(false)
  })

  it('表存在但无列时返回 false', () => {
    const db = { exec: () => [{ columns: [], values: [] }] }
    expect(columnExists(db, 'project', 'directory')).toBe(false)
  })
})
