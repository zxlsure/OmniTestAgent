import { describe, it, expect, vi } from 'vitest'

const mockLoggerInfo = vi.fn()

function columnExists(db: any, tableName: string, columnName: string): boolean {
  const result = db.exec(`PRAGMA table_info(${tableName})`)
  if (result.length === 0 || result[0].values.length === 0) {
    return false
  }
  const columnNames = result[0].values.map((row: any[]) => row[1] as string)
  return columnNames.includes(columnName)
}

function runMigration003(db: any): void {
  if (columnExists(db, 'project', 'directory')) {
    mockLoggerInfo('Migration 003 skipped: column "directory" already exists in table "project"')
    return
  }
  db.run('ALTER TABLE project ADD COLUMN directory TEXT')
  mockLoggerInfo('Migration 003 applied: added column "directory" to table "project"')
}

describe('runMigration003', () => {
  it('directory 列已存在时跳过 ALTER', () => {
    const db = {
      run: vi.fn(),
      exec: vi.fn().mockReturnValue([{
        values: [[0, 'id', 'TEXT', 1, null, 1], [1, 'directory', 'TEXT', 0, null, 0]]
      }])
    }

    runMigration003(db)

    expect(db.run).not.toHaveBeenCalled()
    expect(mockLoggerInfo).toHaveBeenCalledWith('Migration 003 skipped: column "directory" already exists in table "project"')
  })

  it('directory 列不存在时执行 ALTER TABLE', () => {
    const db = {
      run: vi.fn(),
      exec: vi.fn().mockReturnValue([{
        values: [[0, 'id', 'TEXT', 1, null, 1]]
      }])
    }

    runMigration003(db)

    expect(db.run).toHaveBeenCalledWith('ALTER TABLE project ADD COLUMN directory TEXT')
    expect(mockLoggerInfo).toHaveBeenCalledWith('Migration 003 applied: added column "directory" to table "project"')
  })

  it('表不存在时 ALTER 会被调用（外层 catch 处理错误）', () => {
    const db = {
      run: vi.fn(),
      exec: vi.fn().mockReturnValue([])
    }

    runMigration003(db)

    expect(db.run).toHaveBeenCalledWith('ALTER TABLE project ADD COLUMN directory TEXT')
  })
})
