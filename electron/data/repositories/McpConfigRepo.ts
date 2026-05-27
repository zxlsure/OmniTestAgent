import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface McpConfig { id: string; name: string; transport_type: string; url: string | null; command: string | null; args: string | null; is_active: number; created_at: string; updated_at: string }

export class McpConfigRepo {
  getActive(): McpConfig | null { return db().get('SELECT * FROM mcp_config WHERE is_active = 1 LIMIT 1') as McpConfig | null }
  save(name: string, transportType: string, url?: string, command?: string, args?: string): McpConfig {
    const existing = db().get('SELECT id FROM mcp_config WHERE is_active = 1') as { id: string } | null
    if (existing) {
      db().run("UPDATE mcp_config SET name = ?, transport_type = ?, url = ?, command = ?, args = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", [name, transportType, url || null, command || null, args || null, existing.id])
      return db().get('SELECT * FROM mcp_config WHERE id = ?', [existing.id]) as McpConfig
    }
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO mcp_config (id, name, transport_type, url, command, args, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)', [id, name, transportType, url || null, command || null, args || null, now, now])
    return db().get('SELECT * FROM mcp_config WHERE id = ?', [id]) as McpConfig
  }
}

export const mcpConfigRepo = new McpConfigRepo()
