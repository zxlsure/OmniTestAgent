import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface ChannelConfig { id: string; type: string; config: string; is_enabled: number; created_at: string; updated_at: string }

export class ChannelConfigRepo {
  getByType(type: string): ChannelConfig | null { return db().get('SELECT * FROM channel_config WHERE type = ?', [type]) as ChannelConfig | null }
  save(type: string, config: string, isEnabled: boolean = false): ChannelConfig {
    const existing = db().get('SELECT id FROM channel_config WHERE type = ?', [type]) as { id: string } | null
    if (existing) {
      db().run("UPDATE channel_config SET config = ?, is_enabled = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", [config, isEnabled ? 1 : 0, existing.id])
      return db().get('SELECT * FROM channel_config WHERE id = ?', [existing.id]) as ChannelConfig
    }
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO channel_config (id, type, config, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, type, config, isEnabled ? 1 : 0, now, now])
    return db().get('SELECT * FROM channel_config WHERE id = ?', [id]) as ChannelConfig
  }
}

export const channelConfigRepo = new ChannelConfigRepo()
