"""Patch db.ts with moderation + model_call_logs tables"""
with open(r'f:\tiktok-crm-dev\server\src\db.ts', 'r', encoding='utf-8') as f:
    content = f.read()

new_block = """
/* ── Content Moderation + Model Call Logs (算法备案合规) ── */
(() => {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL DEFAULT '',
      violation_count INTEGER DEFAULT 0,
      UNIQUE(user_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_user_violations_user ON user_violations(user_id);
    CREATE TABLE IF NOT EXISTS model_call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT DEFAULT '',
      module TEXT DEFAULT '',
      model_name TEXT DEFAULT '',
      input_prompt TEXT DEFAULT '',
      output_content TEXT DEFAULT '',
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      ip TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      status TEXT DEFAULT 'success',
      error_message TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_model_call_logs_user ON model_call_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_model_call_logs_created ON model_call_logs(created_at);
  `);
  // 给 users 表加 moderation 列
  const cols = db.prepare("PRAGMA table_info(users)").all() as any[];
  if (!cols.some((c: any) => c.name === "ai_suspended")) {
    db.exec("ALTER TABLE users ADD COLUMN ai_suspended INTEGER DEFAULT 0");
    console.log("[migrate] users.ai_suspended");
  }
  if (!cols.some((c: any) => c.name === "ai_suspended_at")) {
    db.exec("ALTER TABLE users ADD COLUMN ai_suspended_at DATETIME");
  }
  if (!cols.some((c: any) => c.name === "ai_suspend_reason")) {
    db.exec("ALTER TABLE users ADD COLUMN ai_suspend_reason TEXT DEFAULT ''");
  }
})();

"""

content = content.replace('\nexport default getDb;', new_block + '\nexport default getDb;')
with open(r'f:\tiktok-crm-dev\server\src\db.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Patched db.ts')
