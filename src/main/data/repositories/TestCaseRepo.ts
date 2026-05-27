import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface TestCase {
  id: string; project_id: string; title: string; description: string | null; priority: string
  steps: string | null; expected_result: string | null; script_path: string | null; status: string
  created_at: string; updated_at: string
}

export class TestCaseRepo {
  create(data: Partial<TestCase> & { project_id: string; title: string }): TestCase {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run(`INSERT INTO test_case (id, project_id, title, description, priority, steps, expected_result, script_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.project_id, data.title, data.description || null, data.priority || 'medium', data.steps || null, data.expected_result || null, data.script_path || null, data.status || 'draft', now, now])
    const result = this.getById(id)
    if (!result) throw new Error(`TestCase not found after insert: ${id}`)
    return result
  }
  getById(id: string): TestCase | null { return db().get('SELECT * FROM test_case WHERE id = ?', [id]) as TestCase | null }
  listByProject(projectId: string): TestCase[] { return db().all('SELECT * FROM test_case WHERE project_id = ? ORDER BY created_at DESC', [projectId]) as TestCase[] }
  update(id: string, data: Partial<TestCase>): boolean {
    const fields: string[] = []; const values: any[] = []
    for (const [k, v] of Object.entries(data)) { if (['title','description','priority','steps','expected_result','script_path','status'].includes(k)) { fields.push(`${k} = ?`); values.push(v) } }
    if (fields.length === 0) return false
    fields.push("updated_at = datetime('now', 'localtime')"); values.push(id)
    return db().run(`UPDATE test_case SET ${fields.join(', ')} WHERE id = ?`, values).changes > 0
  }
  delete(id: string): boolean { return db().run('DELETE FROM test_case WHERE id = ?', [id]).changes > 0 }
  countByProject(projectId: string): number { return (db().get('SELECT COUNT(*) as c FROM test_case WHERE project_id = ?', [projectId]) as any)?.c || 0 }
}

export const testCaseRepo = new TestCaseRepo()
