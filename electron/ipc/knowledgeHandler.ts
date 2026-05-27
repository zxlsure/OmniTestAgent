import { registerIpcHandler } from './helpers'
import { knowledgeService } from '../services/KnowledgeService'

export function registerKnowledgeHandler(): void {
  registerIpcHandler('knowledge:listBases', (projectId: string) => knowledgeService.listBases(projectId))
  registerIpcHandler('knowledge:createBase', (data: any) => knowledgeService.createBase(data.projectId, data.name, data.description))
  registerIpcHandler('knowledge:deleteBase', (id: string) => knowledgeService.deleteBase(id))
  registerIpcHandler('knowledge:uploadDoc', (params: any) => knowledgeService.uploadDocument(params.kbId, params.projectId, params.filePath, params.fileName))
  registerIpcHandler('knowledge:vectorize', (docId: string) => knowledgeService.vectorize(docId, '', ''))
  registerIpcHandler('knowledge:search', (params: any) => knowledgeService.search(params.kbId, params.query, params.topK))
  registerIpcHandler('knowledge:listDocuments', (kbId: string) => knowledgeService.listDocuments(kbId))
}
