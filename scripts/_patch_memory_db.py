"""Patch db.ts with chat memory tables"""
with open(r'f:\tiktok-crm-dev\server\src\db.ts', 'r', encoding='utf-8') as f:
    c = f.read()

new_block = """
/* ── 智能对话记忆系统 ── */
(() => {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      message_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, status);
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT DEFAULT '',
      tool_calls_json TEXT DEFAULT '[]',
      tokens INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id, user_id);
  `);
})();

"""

c = c.replace('\nexport default getDb;', new_block + '\nexport default getDb;')
with open(r'f:\tiktok-crm-dev\server\src\db.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched db.ts')
