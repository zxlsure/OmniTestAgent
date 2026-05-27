import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { KnowledgeBase, KnowledgeDocument, SearchResult } from '@types/knowledge'

export const useKnowledgeStore = defineStore('knowledge', () => {
  const bases = ref<KnowledgeBase[]>([])
  const currentBaseId = ref<string | null>(null)
  const documents = ref<KnowledgeDocument[]>([])
  const searchResults = ref<SearchResult[]>([])

  async function fetchBases(projectId: string) {
    try {
      bases.value = await window.electronAPI.knowledge.listBases(projectId)
    } catch (e: unknown) {
      console.error('Failed to fetch knowledge bases:', e)
    }
  }

  async function fetchDocuments(kbId: string) {
    try {
      documents.value = await window.electronAPI.knowledge.listDocuments(kbId)
    } catch (e: unknown) {
      console.error('Failed to fetch documents:', e)
    }
  }

  async function createBase(projectId: string, name: string, description?: string) {
    try {
      const base = await window.electronAPI.knowledge.createBase({ projectId, name, description })
      bases.value.unshift(base)
    } catch (e: unknown) {
      console.error('Failed to create knowledge base:', e)
    }
  }

  async function search(kbId: string, query: string, topK: number = 5) {
    try {
      searchResults.value = await window.electronAPI.knowledge.search({ kbId, query, topK })
    } catch (e: unknown) {
      console.error('Failed to search knowledge base:', e)
    }
  }

  async function uploadDocument(projectId: string, kbId: string, filePath: string, fileName: string) {
    try {
      const doc = await window.electronAPI.knowledge.uploadDoc({ kbId, projectId, filePath, fileName })
      documents.value.unshift(doc)
      return doc
    } catch (e: unknown) {
      console.error('Failed to upload document:', e)
      throw e
    }
  }

  async function vectorize(docId: string) {
    try {
      await window.electronAPI.knowledge.vectorize(docId)
    } catch (e: unknown) {
      console.error('Failed to vectorize document:', e)
      throw e
    }
  }

  return { bases, currentBaseId, documents, searchResults, fetchBases, fetchDocuments, createBase, search, uploadDocument, vectorize }
})
