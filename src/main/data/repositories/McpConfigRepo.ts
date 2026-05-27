import { BaseConfigRepo } from './baseConfigRepo'

export interface McpConfig { id: string; name: string; transport_type: string; url: string | null; command: string | null; args: string | null; is_active: number; created_at: string; updated_at: string }

export class McpConfigRepo extends BaseConfigRepo<McpConfig> {
  protected tableName = 'mcp_config' as const

  save(name: string, transportType: string, url?: string, command?: string, args?: string): McpConfig {
    return this.upsert(
      "UPDATE mcp_config SET name = ?, transport_type = ?, url = ?, command = ?, args = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
      [name, transportType, url || null, command || null, args || null],
      'INSERT INTO mcp_config (id, name, transport_type, url, command, args, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [name, transportType, url || null, command || null, args || null]
    )
  }
}

export const mcpConfigRepo = new McpConfigRepo()
