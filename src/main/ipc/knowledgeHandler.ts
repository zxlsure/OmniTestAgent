import { registerIpcHandler } from './helpers'
import { knowledgeService } from '../services/KnowledgeService'

export function registerKnowledgeHandler(): void {
  registerIpcHandler('knowledge:listBases', (projectId: string) => knowledgeService.listBases(projectId))
  registerIpcHandler('knowledge:createBase', (data: { projectId: string; name: string; description?: string }) => knowledgeService.createBase(data.projectId, data.name, data.description))
  registerIpcHandler('knowledge:deleteBase', (id: string) => knowledgeService.deleteBase(id))
  registerIpcHandler('knowledge:uploadDoc', (params: { kbId: string; projectId: string; filePath: string; fileName: string }) => knowledgeService.uploadDocument(params.kbId, params.projectId, params.filePath, params.fileName))
  registerIpcHandler('knowledge:vectorize', (docId: string) => knowledgeService.vectorize(docId, '', ''))
  registerIpcHandler('knowledge:search', (params: { kbId: string; query: string; topK?: number }) => knowledgeService.search(params.kbId, params.query, params.topK))
  registerIpcHandler('knowledge:listDocuments', (kbId: string) => knowledgeService.listDocuments(kbId))
}
