import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface Project {
  id: string; name: string; description: string | null; created_at: string; updated_at: string
}

export class ProjectRepo {
  create(name: string, description?: string): Project {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO project (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [id, name, description || null, now, now])
    return this.getById(id)!
  }
  getById(id: string): Project | null { return db().get('SELECT * FROM project WHERE id = ?', [id]) as Project | null }
  list(): Project[] { return db().all('SELECT * FROM project ORDER BY updated_at DESC') as Project[] }
  update(id: string, data: Partial<Pick<Project, 'name' | 'description'>>): Project | null {
    const fields: string[] = []; const values: any[] = []
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description) }
    if (fields.length === 0) return this.getById(id)
    fields.push("updated_at = datetime('now', 'localtime')"); values.push(id)
    db().run(`UPDATE project SET ${fields.join(', ')} WHERE id = ?`, values)
    return this.getById(id)
  }
  delete(id: string): boolean { return db().run('DELETE FROM project WHERE id = ?', [id]).changes > 0 }
  getStats(id: string): Record<string, number> {
    const tc = (db().get('SELECT COUNT(*) as c FROM test_case WHERE project_id = ?', [id]) as any)?.c || 0
    const ac = (db().get('SELECT COUNT(*) as c FROM test_flow_activity WHERE project_id = ?', [id]) as any)?.c || 0
    const kb = (db().get('SELECT COUNT(*) as c FROM knowledge_base WHERE project_id = ?', [id]) as any)?.c || 0
    return { testCaseCount: tc, activityCount: ac, kbCount: kb }
  }
}

export const projectRepo = new ProjectRepo()
