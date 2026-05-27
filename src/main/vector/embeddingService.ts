import { logger } from '../utils/logger'

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>
}

export async function generateEmbedding(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
  const llmConfig = await getLlmConfig()
  if (!llmConfig) throw new Error('LLM not configured for embedding')

  const apiUrl = llmConfig.baseUrl.replace(/\/$/, '') + '/embeddings'
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmConfig.apiKey}`
    },
    body: JSON.stringify({
      model,
      input: text
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Embedding API error: ${response.status} ${errorText}`)
  }

  const result = await response.json() as EmbeddingResponse
  if (!result.data?.[0]?.embedding) {
    throw new Error('Invalid embedding response')
  }

  return result.data[0].embedding
}

async function getLlmConfig(): Promise<{ baseUrl: string; apiKey: string } | null> {
  try {
    const { llmConfigRepo } = await import('../data/repositories/LlmConfigRepo')
    const { getApiKey } = await import('../data/secureStore')
    const config = llmConfigRepo.getActive()
    if (!config) return null
    const apiKey = getApiKey('llm')
    if (!apiKey) return null
    return { baseUrl: config.api_url, apiKey }
  } catch (e: any) {
    logger.error('Failed to get LLM config for embedding:', e)
    return null
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
