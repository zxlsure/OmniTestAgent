import { BaseConfigRepo } from './baseConfigRepo'

export interface LlmConfig { id: string; model_name: string; api_url: string; is_active: number; temperature: number; max_tokens: number; created_at: string; updated_at: string }

export class LlmConfigRepo extends BaseConfigRepo<LlmConfig> {
  protected tableName = 'llm_config' as const

  save(modelName: string, apiUrl: string, temperature: number = 0.7, maxTokens: number = 4096): LlmConfig {
    return this.upsert(
      "UPDATE llm_config SET model_name = ?, api_url = ?, temperature = ?, max_tokens = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
      [modelName, apiUrl, temperature, maxTokens],
      'INSERT INTO llm_config (id, model_name, api_url, is_active, temperature, max_tokens, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)',
      [modelName, apiUrl, temperature, maxTokens]
    )
  }
}

export const llmConfigRepo = new LlmConfigRepo()
