import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface LlmConfig { id: string; model_name: string; api_url: string; is_active: number; temperature: number; max_tokens: number; created_at: string; updated_at: string }

export class LlmConfigRepo {
  getActive(): LlmConfig | null { return db().get('SELECT * FROM llm_config WHERE is_active = 1 LIMIT 1') as LlmConfig | null }
  save(modelName: string, apiUrl: string, temperature: number = 0.7, maxTokens: number = 4096): LlmConfig {
    const existing = db().get('SELECT id FROM llm_config WHERE is_active = 1') as { id: string } | null
    if (existing) {
      db().run("UPDATE llm_config SET model_name = ?, api_url = ?, temperature = ?, max_tokens = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", [modelName, apiUrl, temperature, maxTokens, existing.id])
      return db().get('SELECT * FROM llm_config WHERE id = ?', [existing.id]) as LlmConfig
    }
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO llm_config (id, model_name, api_url, is_active, temperature, max_tokens, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)', [id, modelName, apiUrl, temperature, maxTokens, now, now])
    return db().get('SELECT * FROM llm_config WHERE id = ?', [id]) as LlmConfig
  }
}

export const llmConfigRepo = new LlmConfigRepo()
