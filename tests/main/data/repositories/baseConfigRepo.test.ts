import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'

const mockGet = vi.fn()
const mockRun = vi.fn()

function createMockDb() {
  return { get: mockGet, run: mockRun, all: vi.fn().mockReturnValue([]), exec: vi.fn() }
}

abstract class BaseConfigRepo<T> {
  protected abstract tableName: string
  protected dbInstance: ReturnType<typeof createMockDb>

  constructor(dbInstance: ReturnType<typeof createMockDb>) {
    this.dbInstance = dbInstance
  }

  getActive(): T | null {
    return this.dbInstance.get(`SELECT * FROM ${this.tableName} WHERE is_active = 1 LIMIT 1`) as T | null
  }

  protected upsert(updateSql: string, updateParams: unknown[], insertSql: string, insertParams: unknown[]): T {
    const existing = this.dbInstance.get(`SELECT id FROM ${this.tableName} WHERE is_active = 1`) as { id: string } | null
    if (existing) {
      this.dbInstance.run(updateSql, [...updateParams, existing.id])
      return this.dbInstance.get(`SELECT * FROM ${this.tableName} WHERE id = ?`, [existing.id]) as T
    }
    const id = randomUUID()
    const now = new Date().toISOString()
    this.dbInstance.run(insertSql, [id, ...insertParams, now, now])
    return this.dbInstance.get(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]) as T
  }
}

class TestConfigRepo extends BaseConfigRepo<{ id: string; name: string; is_active: number }> {
  protected tableName = 'test_config'

  upsertTest(name: string) {
    return this.upsert(
      'UPDATE test_config SET name = ?, is_active = 1 WHERE id = ?',
      [name],
      'INSERT INTO test_config (id, name, is_active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)',
      [name]
    )
  }
}

describe('BaseConfigRepo', () => {
  let repo: TestConfigRepo

  beforeEach(() => {
    mockGet.mockReset()
    mockRun.mockReset()
    repo = new TestConfigRepo(createMockDb())
  })

  it('upsert - 已有记录时执行更新', () => {
    const existingId = 'existing-id'
    const updatedRow = { id: existingId, name: 'updated', is_active: 1 }

    mockGet
      .mockReturnValueOnce({ id: existingId })
      .mockReturnValueOnce(updatedRow)
    mockRun.mockReturnValue({ changes: 1 })

    const result = repo.upsertTest('updated')

    expect(mockRun).toHaveBeenCalledWith(
      'UPDATE test_config SET name = ?, is_active = 1 WHERE id = ?',
      ['updated', existingId]
    )
    expect(result).toEqual(updatedRow)
  })

  it('upsert - 无记录时执行插入', () => {
    const newRow = { id: 'new-id', name: 'new', is_active: 1 }

    mockGet
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(newRow)
    mockRun.mockReturnValue({ changes: 1 })

    const result = repo.upsertTest('new')

    expect(mockRun).toHaveBeenCalledTimes(1)
    expect(result).toEqual(newRow)
  })
})
