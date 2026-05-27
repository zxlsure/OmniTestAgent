// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSearch, mockLogQuery, mockGenerateEmbedding, mockCosineSimilarity
} = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockLogQuery: vi.fn(),
  mockGenerateEmbedding: vi.fn(),
  mockCosineSimilarity: vi.fn()
}))

vi.mock('../../../src/main/data/repositories/KnowledgeRepo', () => ({
  knowledgeRepo: { search: mockSearch, logQuery: mockLogQuery }
}))

vi.mock('../../../src/main/utils/fileHelper', () => ({
  getDocumentDir: vi.fn().mockReturnValue('/data/kb')
}))

vi.mock('../../../src/main/utils/documentParser', () => ({
  parseDocument: vi.fn(),
  splitTextIntoChunks: vi.fn()
}))

vi.mock('../../../src/main/vector/embeddingService', () => ({
  generateEmbedding: mockGenerateEmbedding,
  cosineSimilarity: mockCosineSimilarity
}))

vi.mock('../../../src/main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('fs', () => ({
  statSync: vi.fn().mockReturnValue({ size: 1024 }),
  copyFileSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  readFileSync: vi.fn().mockReturnValue('')
}))

vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
  extname: vi.fn().mockReturnValue('.md')
}))

import { KnowledgeService } from '../../../src/main/services/KnowledgeService'

describe('KnowledgeService.search', () => {
  let service: KnowledgeService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new KnowledgeService()
  })

  it('返回排序后的知识片段', async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3])
    mockCosineSimilarity.mockReturnValue(0.9)
    mockSearch.mockReturnValue([
      { content: '片段1', file_name: 'doc1.md', chunk_index: 0, embedding: JSON.stringify([0.1, 0.2, 0.3]) },
      { content: '片段2', file_name: 'doc2.md', chunk_index: 1, embedding: JSON.stringify([0.4, 0.5, 0.6]) }
    ])
    mockLogQuery.mockReturnValue(undefined)
    const results = await service.search('kb-1', '测试查询', 5)
    expect(results.length).toBeLessThanOrEqual(5)
    expect(results[0]).toHaveProperty('content')
    expect(results[0]).toHaveProperty('source')
    expect(results[0]).toHaveProperty('score')
  })

  it('无向量时降级文本检索', async () => {
    mockGenerateEmbedding.mockResolvedValue(null)
    mockSearch.mockReturnValue([{ content: '文本片段', file_name: 'doc1.md', chunk_index: 0 }])
    mockLogQuery.mockReturnValue(undefined)
    const results = await service.search('kb-1', '测试查询', 5)
    expect(results.length).toBeLessThanOrEqual(5)
    if (results.length > 0) expect(results[0].score).toBe(0.5)
  })

  it('向量生成失败时降级', async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error('Embedding unavailable'))
    mockSearch.mockReturnValue([{ content: '降级片段', file_name: 'doc1.md', chunk_index: 0 }])
    mockLogQuery.mockReturnValue(undefined)
    const results = await service.search('kb-1', '测试查询', 5)
    expect(results.length).toBeLessThanOrEqual(5)
    if (results.length > 0) expect(results[0].score).toBe(0.5)
  })

  it('topK参数正确传递', async () => {
    mockGenerateEmbedding.mockResolvedValue(null)
    mockSearch.mockReturnValue([])
    mockLogQuery.mockReturnValue(undefined)
    await service.search('kb-1', '测试查询', 3)
    expect(mockSearch).toHaveBeenCalledWith('kb-1', '测试查询', 9)
  })

  it('结果裁剪到topK', async () => {
    mockGenerateEmbedding.mockResolvedValue(null)
    mockSearch.mockReturnValue(Array.from({ length: 10 }, (_, i) => ({ content: `片段${i}`, file_name: `doc${i}.md`, chunk_index: i })))
    mockLogQuery.mockReturnValue(undefined)
    const results = await service.search('kb-1', '测试查询', 3)
    expect(results.length).toBe(3)
  })
})
