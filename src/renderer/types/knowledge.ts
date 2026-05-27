export interface KnowledgeBase { id: string; project_id: string; name: string; description: string | null; doc_count: number; created_at: string; updated_at: string }
export interface KnowledgeDocument { id: string; kb_id: string; file_name: string; file_path: string; file_size: number | null; file_type: string | null; chunk_count: number; status: string; error_message: string | null; created_at: string; updated_at: string }
export interface SearchResult { content: string; source: string; score: number; chunkIndex: number }
