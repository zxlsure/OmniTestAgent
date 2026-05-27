import { db } from '../dbAdapter'
import { BaseConfigRepo } from './baseConfigRepo'

export interface ChannelConfig { id: string; type: string; config: string; is_enabled: number; created_at: string; updated_at: string }

export class ChannelConfigRepo extends BaseConfigRepo<ChannelConfig> {
  protected tableName = 'channel_config' as const

  getByType(type: string): ChannelConfig | null {
    return db().get('SELECT * FROM channel_config WHERE type = ?', [type]) as ChannelConfig | null
  }

  save(type: string, config: string, isEnabled: boolean = false): ChannelConfig {
    return this.upsertByKey(
      'type', type,
      "UPDATE channel_config SET config = ?, is_enabled = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
      [config, isEnabled ? 1 : 0],
      'INSERT INTO channel_config (id, type, config, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [type, config, isEnabled ? 1 : 0]
    )
  }
}

export const channelConfigRepo = new ChannelConfigRepo()
