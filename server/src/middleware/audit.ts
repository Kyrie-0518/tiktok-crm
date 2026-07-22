import { Request, Response, NextFunction } from 'express';
import getDb from '../db';

function ensureAuditTable(db: any) {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'").get();
  if (!exists) {
    db.exec(`
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT DEFAULT '',
        method TEXT NOT NULL DEFAULT '',
        path TEXT NOT NULL DEFAULT '',
        status_code INTEGER DEFAULT 200,
        ip TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)');
    console.log('[AuditMiddleware] audit_logs 表已创建');
  }
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  // @ts-ignore
  res.json = function(data: any) {
    try {
      const db = getDb();
      ensureAuditTable(db);
      const user = (req as any).user;
      db.prepare(`
        INSERT INTO audit_logs (user_id, username, method, path, status_code, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        user?.userId || null,
        user?.username || null,
        req.method,
        req.originalUrl || req.path,
        res.statusCode,
        req.ip || req.socket?.remoteAddress || '',
        req.get('User-Agent') || ''
      );
    } catch { /* 忽略审计日志写入失败 */ }
    return originalJson(data);
  };
  next();
}

/** 启动审计日志180天自动清理（备案合规：不少于6个月） */
export function startAuditLogCleanup(): void {
  const doCleanup = () => {
    try {
      const db = getDb();
      const result = db.prepare("DELETE FROM audit_logs WHERE created_at < datetime('now','localtime', '-180 days')").run();
      if (result.changes > 0) {
        console.log(`[AuditLog] 清理了 ${result.changes} 条过期审计日志`);
      }
    } catch {}
  };
  doCleanup(); // 启动时清理一次
  setInterval(doCleanup, 24 * 60 * 60 * 1000); // 每天清理
}
