import type { Database as SqlJsDatabase } from 'sql.js'

export function runMigration002(db: SqlJsDatabase): void {
  const oldSessionData = db.exec('SELECT * FROM chat_session')
  const oldMessageData = db.exec('SELECT * FROM chat_message')

  db.run('DROP TABLE IF EXISTS chat_message')
  db.run('DROP TABLE IF EXISTS chat_session')

  db.run(`CREATE TABLE chat_session (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES project(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )`)

  db.run(`CREATE TABLE chat_message (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    thinking TEXT,
    thinking_steps TEXT,
    tool_calls TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    token_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )`)

  db.run('CREATE INDEX IF NOT EXISTS idx_chat_session_project ON chat_session(project_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_chat_message_session ON chat_message(session_id)')

  if (oldSessionData.length > 0 && oldSessionData[0].values.length > 0) {
    const stmt = db.prepare('INSERT INTO chat_session (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    for (const row of oldSessionData[0].values) {
      stmt.bind([row[0], row[1], row[2], row[3], row[4]])
      stmt.step()
      stmt.reset()
    }
    stmt.free()
  }

  if (oldMessageData.length > 0 && oldMessageData[0].values.length > 0) {
    const stmt = db.prepare('INSERT INTO chat_message (id, session_id, role, content, status, token_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const row of oldMessageData[0].values) {
      stmt.bind([row[0], row[1], row[2], row[3], 'completed', row[4], row[5]])
      stmt.step()
      stmt.reset()
    }
    stmt.free()
  }
}
