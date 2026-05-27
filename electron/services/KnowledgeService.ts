import { knowledgeRepo, KnowledgeBase, KnowledgeDocument } from '../data/repositories/KnowledgeRepo'
import { getDocumentDir } from '../utils/fileHelper'
import { parseDocument, splitTextIntoChunks } from '../utils/documentParser'
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
        knowledgeRepo.createChunk(docId, chunks[i], i)
      }

      knowledgeRepo.updateDocumentStatus(docId, 'completed')
      logger.info(`Document vectorized: ${doc.file_name}, chunks: ${chunks.length}`)
    } catch (error: any) {
      knowledgeRepo.updateDocumentStatus(docId, 'failed', error.message)
      logger.error(`Document vectorization failed: ${doc.file_name}`, error)
      throw error
    }
  }

  search(kbId: string, query: string, topK: number = 5): any[] {
    knowledgeRepo.logQuery(kbId, query, 0)
    const db = require('../data/database').getDatabase()
    const chunks = db.prepare(`
      SELECT dc.*, kd.file_name, kd.id as doc_id
      FROM document_chunk dc
      JOIN knowledge_document kd ON dc.document_id = kd.id
      WHERE kd.kb_id = ? AND dc.content LIKE ?
      ORDER BY dc.chunk_index
      LIMIT ?
    `).all(kbId, `%${query}%`, topK)

    return chunks.map((c: any) => ({
      content: c.content,
      source: c.file_name,
      score: 0.8,
      chunkIndex: c.chunk_index
    }))
  }
}

export const knowledgeService = new KnowledgeService()
