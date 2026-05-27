import { logger } from '../../utils/logger'

export function runMigrations(db: any): void {
  const MIGRATIONS = [
    `CREATE TABLE IF NOT EXISTS project (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS test_flow_activity (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      input_data TEXT,
      output_data TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS flow_review_record (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES test_flow_activity(id) ON DELETE CASCADE,
      result TEXT NOT NULL,
      comment TEXT,
      reviewer TEXT,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS test_case (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'medium',
      steps TEXT,
      expected_result TEXT,
      script_path TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      doc_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS knowledge_document (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      chunk_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS document_chunk (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES knowledge_document(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      embedding_status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS query_log (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL,
      query TEXT NOT NULL,
      result_count INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS chat_session (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES project(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS chat_message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS llm_config (
      id TEXT PRIMARY KEY,
      model_name TEXT NOT NULL,
      api_url TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4096,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS mcp_config (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transport_type TEXT NOT NULL DEFAULT 'http',
      url TEXT,
      command TEXT,
      args TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS skill (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      is_builtin INTEGER DEFAULT 0,
      is_enabled INTEGER DEFAULT 1,
      config TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS channel_config (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_flow_activity_project ON test_flow_activity(project_id, activity_type)`,
    `CREATE INDEX IF NOT EXISTS idx_test_case_project ON test_case(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_base_project ON knowledge_base(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_doc_kb ON knowledge_document(kb_id)`,
    `CREATE INDEX IF NOT EXISTS idx_document_chunk_doc ON document_chunk(document_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_session_project ON chat_session(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_message_session ON chat_message(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_channel_config_type ON channel_config(type)`
  ]

  try {
    for (const sql of MIGRATIONS) {
      db.run(sql)
    }
    logger.info('Database migrations completed')
  } catch (error) {
    logger.error('Database migration failed:', error)
    throw error
  }
}
