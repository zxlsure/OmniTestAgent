import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface SkillRecord { id: string; name: string; display_name: string; description: string | null; is_builtin: number; is_enabled: number; config: string | null; created_at: string; updated_at: string }

export class SkillRepo {
  list(): SkillRecord[] { return db().all('SELECT * FROM skill ORDER BY is_builtin DESC, name ASC') as SkillRecord[] }
  getByName(name: string): SkillRecord | null { return db().get('SELECT * FROM skill WHERE name = ?', [name]) as SkillRecord | null }
  create(name: string, displayName: string, description?: string, isBuiltin: boolean = false): SkillRecord {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO skill (id, name, display_name, description, is_builtin, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', [id, name, displayName, description || null, isBuiltin ? 1 : 0, now, now])
    return db().get('SELECT * FROM skill WHERE id = ?', [id]) as SkillRecord
  }
  toggle(id: string, enabled: boolean): boolean {
    const skill = db().get('SELECT * FROM skill WHERE id = ?', [id]) as SkillRecord | null
    if (!skill) return false
    return db().run("UPDATE skill SET is_enabled = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", [enabled ? 1 : 0, id]).changes > 0
  }
}

export const skillRepo = new SkillRepo()
