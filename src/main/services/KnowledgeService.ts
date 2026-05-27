import { knowledgeRepo, KnowledgeBase, KnowledgeDocument } from '../data/repositories/KnowledgeRepo'
import { getDocumentDir } from '../utils/fileHelper'
import { parseDocument, splitTextIntoChunks } from '../utils/documentParser'
import { generateEmbedding, cosineSimilarity } from '../vector/embeddingService'
import { logger } from '../utils/logger'
import fs from 'fs'
import path from 'path'

export class KnowledgeService {
  listBases(projectId: string): KnowledgeBase[] {
    return knowledgeRepo.listBases(projectId)
  }

  createBase(projectId: string, name: string, description?: string): KnowledgeBase {
    return knowledgeRepo.createBase(projectId, name, description)
  }

  deleteBase(id: string): boolean {
    return knowledgeRepo.deleteBase(id)
  }

  listDocuments(kbId: string): KnowledgeDocument[] {
    return knowledgeRepo.listDocuments(kbId)
  }

  async uploadDocument(kbId: string, projectId: string, filePath: string, fileName: string): Promise<KnowledgeDocument> {
    const fileSize = fs.statSync(filePath).size
    const ext = path.extname(fileName).toLowerCase()
    const docDir = getDocumentDir(projectId, kbId)
    const destPath = path.join(docDir, fileName)
    fs.copyFileSync(filePath, destPath)

    const doc = knowledgeRepo.createDocument(kbId, fileName, destPath, fileSize, ext)
    logger.info(`Document uploaded: ${fileName} -> ${doc.id}`)
    return doc
  }

  async vectorize(docId: string, kbId: string, projectId: string): Promise<void> {
    const docs = knowledgeRepo.listDocuments(kbId)
    const doc = docs.find(d => d.id === docId)
    if (!doc) throw new Error('Document not found')

    try {
      knowledgeRepo.updateDocumentStatus(docId, 'processing')
      const parsed = await parseDocument(doc.file_path)
      const chunks = splitTextIntoChunks(parsed.text)

      for (let i = 0; i < chunks.length; i++) {
        const chunk = knowledgeRepo.createChunk(docId, chunks[i], i)
        try {
          const embedding = await generateEmbedding(chunks[i])
          knowledgeRepo.updateChunkEmbedding(chunk.id, JSON.stringify(embedding))
        } catch (embedErr: any) {
          logger.warn(`Failed to generate embedding for chunk ${i}: ${embedErr.message}`)
        }
      }

      knowledgeRepo.updateDocumentStatus(docId, 'completed')
      logger.info(`Document vectorized: ${doc.file_name}, chunks: ${chunks.length}`)
    } catch (error: any) {
      knowledgeRepo.updateDocumentStatus(docId, 'failed', error.message)
      logger.error(`Document vectorization failed: ${doc.file_name}`, error)
      throw error
    }
  }

  async search(kbId: string, query: string, topK: number = 5): Promise<any[]> {
    let queryEmbedding: number[] | null = null
    try {
      queryEmbedding = await generateEmbedding(query)
    } catch (e: any) {
      logger.warn('Failed to generate query embedding, falling back to text search:', e.message)
    }

    const chunks = knowledgeRepo.search(kbId, query, topK * 3)
    knowledgeRepo.logQuery(kbId, query, chunks.length)

    if (queryEmbedding) {
      const scored = chunks.map((c: any) => {
        let score = 0
        if (c.embedding) {
          try {
            const chunkEmbedding = JSON.parse(c.embedding) as number[]
            score = cosineSimilarity(queryEmbedding, chunkEmbedding)
          } catch { score = 0 }
        }
        return { ...c, score }
      })
      scored.sort((a, b) => b.score - a.score)
      return scored.slice(0, topK).map((c: any) => ({
        content: c.content,
        source: c.file_name,
        score: c.score,
        chunkIndex: c.chunk_index
      }))
    }

    return chunks.slice(0, topK).map((c: any) => ({
      content: c.content,
      source: c.file_name,
      score: 0.5,
      chunkIndex: c.chunk_index
    }))
  }
}

export const knowledgeService = new KnowledgeService()
