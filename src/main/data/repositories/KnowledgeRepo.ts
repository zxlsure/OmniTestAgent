import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface KnowledgeBase { id: string; project_id: string; name: string; description: string | null; doc_count: number; created_at: string; updated_at: string }
export interface KnowledgeDocument { id: string; kb_id: string; file_name: string; file_path: string; file_size: number | null; file_type: string | null; chunk_count: number; status: string; error_message: string | null; created_at: string; updated_at: string }
export interface DocumentChunk { id: string; document_id: string; content: string; chunk_index: number; embedding_status: string; created_at: string }
export interface QueryLog { id: string; kb_id: string; query: string; result_count: number | null; created_at: string }

export class KnowledgeRepo {
  createBase(projectId: string, name: string, description?: string): KnowledgeBase {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO knowledge_base (id, project_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, projectId, name, description || null, now, now])
    return db().get('SELECT * FROM knowledge_base WHERE id = ?', [id]) as KnowledgeBase
  }
  listBases(projectId: string): KnowledgeBase[] { return db().all('SELECT * FROM knowledge_base WHERE project_id = ? ORDER BY updated_at DESC', [projectId]) as KnowledgeBase[] }
  countByProject(projectId: string): number { return (db().get('SELECT COUNT(*) as c FROM knowledge_base WHERE project_id = ?', [projectId]) as any)?.c || 0 }
  deleteBase(id: string): boolean { return db().run('DELETE FROM knowledge_base WHERE id = ?', [id]).changes > 0 }
  createDocument(kbId: string, fileName: string, filePath: string, fileSize: number, fileType: string): KnowledgeDocument {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO knowledge_document (id, kb_id, file_name, file_path, file_size, file_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, kbId, fileName, filePath, fileSize, fileType, now, now])
    return db().get('SELECT * FROM knowledge_document WHERE id = ?', [id]) as KnowledgeDocument
  }
  listDocuments(kbId: string): KnowledgeDocument[] { return db().all('SELECT * FROM knowledge_document WHERE kb_id = ? ORDER BY created_at DESC', [kbId]) as KnowledgeDocument[] }
  updateDocumentStatus(id: string, status: string, errorMessage?: string): void {
    db().run("UPDATE knowledge_document SET status = ?, error_message = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", [status, errorMessage || null, id])
  }
  createChunk(documentId: string, content: string, chunkIndex: number): DocumentChunk {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO document_chunk (id, document_id, content, chunk_index, created_at) VALUES (?, ?, ?, ?, ?)', [id, documentId, content, chunkIndex, now])
    return db().get('SELECT * FROM document_chunk WHERE id = ?', [id]) as DocumentChunk
  }
  updateChunkEmbedding(chunkId: string, embedding: string): void {
    db().run("UPDATE document_chunk SET embedding = ?, embedding_status = 'completed' WHERE id = ?", [embedding, chunkId])
  }
  logQuery(kbId: string, query: string, resultCount: number): void {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO query_log (id, kb_id, query, result_count, created_at) VALUES (?, ?, ?, ?, ?)', [id, kbId, query, resultCount, now])
  }
  search(kbId: string | undefined, query: string, topK: number = 5): any[] {
    const likePattern = `%${query}%`
    if (kbId) {
      return db().all(
        `SELECT dc.*, kd.file_name, kd.id as doc_id FROM document_chunk dc JOIN knowledge_document kd ON dc.document_id = kd.id WHERE kd.kb_id = ? AND dc.content LIKE ? ORDER BY dc.chunk_index LIMIT ?`,
        [kbId, likePattern, topK]
      )
    }
    return db().all(
      `SELECT dc.*, kd.file_name, kd.id as doc_id FROM document_chunk dc JOIN knowledge_document kd ON dc.document_id = kd.id WHERE dc.content LIKE ? ORDER BY dc.chunk_index LIMIT ?`,
      [likePattern, topK]
    )
  }
}

export const knowledgeRepo = new KnowledgeRepo()
