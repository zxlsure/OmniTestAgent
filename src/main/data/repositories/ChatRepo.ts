import { db } from '../dbAdapter'
import { randomUUID } from 'crypto'

export interface ChatSession { id: string; project_id: string | null; title: string; model: string | null; created_at: string; updated_at: string }
export interface ChatMessage { id: string; session_id: string; role: string; content: string; thinking: string | null; thinking_steps: string | null; tool_calls: string | null; status: string; token_count: number; created_at: string }

export class ChatRepo {
  createSession(projectId: string | null, title: string, model?: string): ChatSession {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO chat_session (id, project_id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, projectId, title, model || null, now, now])
    return db().get('SELECT * FROM chat_session WHERE id = ?', [id]) as ChatSession
  }
  listSessions(projectId?: string): ChatSession[] {
    if (projectId) return db().all('SELECT * FROM chat_session WHERE project_id = ? ORDER BY updated_at DESC', [projectId]) as ChatSession[]
    return db().all('SELECT * FROM chat_session ORDER BY updated_at DESC') as ChatSession[]
  }
  deleteSession(id: string): boolean { return db().run('DELETE FROM chat_session WHERE id = ?', [id]).changes > 0 }
  addMessage(sessionId: string, role: string, content: string, tokenCount: number = 0): ChatMessage {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO chat_message (id, session_id, role, content, status, token_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, sessionId, role, content, 'completed', tokenCount, now])
    db().run("UPDATE chat_session SET updated_at = datetime('now', 'localtime') WHERE id = ?", [sessionId])
    return db().get('SELECT * FROM chat_message WHERE id = ?', [id]) as ChatMessage
  }
  addStreamingMessage(sessionId: string, role: string, content: string, thinking?: string, thinkingSteps?: string, toolCalls?: string): ChatMessage {
    const id = randomUUID(); const now = new Date().toISOString()
    db().run('INSERT INTO chat_message (id, session_id, role, content, thinking, thinking_steps, tool_calls, status, token_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, sessionId, role, content, thinking || null, thinkingSteps || null, toolCalls || null, 'completed', 0, now])
    db().run("UPDATE chat_session SET updated_at = datetime('now', 'localtime') WHERE id = ?", [sessionId])
    return db().get('SELECT * FROM chat_message WHERE id = ?', [id]) as ChatMessage
  }
  getMessages(sessionId: string): ChatMessage[] { return db().all('SELECT * FROM chat_message WHERE session_id = ? ORDER BY created_at ASC', [sessionId]) as ChatMessage[] }
}

export const chatRepo = new ChatRepo()
