export interface ChatSession { id: string; project_id: string | null; title: string; created_at: string; updated_at: string }
export interface ChatMessage { id: string; session_id: string; role: string; content: string; token_count: number; created_at: string }
