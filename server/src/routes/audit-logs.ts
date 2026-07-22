import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';

const router = Router();

// 确保表存在（兼容 initTables 未执行的情况）
function ensureTable(db: any) {
  const exists = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'").get() as any);
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
    console.log('[AuditLog] audit_logs 表已创建');
  }
}

// GET /api/audit-logs — 查询操作日志（分页+筛选）
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const db = getDb();
    ensureTable(db);
    const { page, page_size, method, username, start_date, end_date } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(page_size) || 20));
    const offset = (pageNum - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (method) {
      where += ' AND method = ?';
      params.push(String(method).toUpperCase());
    }
    if (username) {
      where += ' AND username LIKE ?';
      params.push(`%${username}%`);
    }
    if (start_date) {
      where += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      where += ' AND created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    const countSql = `SELECT COUNT(*) as total FROM audit_logs ${where}`;
    const total = (db.prepare(countSql).get(...params) as any).total;

    const listSql = `
      SELECT id, user_id, username, method, path, status_code, ip, user_agent, created_at
      FROM audit_logs ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const list = db.prepare(listSql).all(...params, pageSize, offset);

    res.json({
      list,
      total,
      page: pageNum,
      page_size: pageSize,
    });
  } catch (err: any) {
    console.error('[AuditLog] 查询失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit-logs/stats — 统计数据
router.get('/stats', authMiddleware, (_req: Request, res: Response) => {
  try {
    const db = getDb();
    ensureTable(db);
    const todayTotal = (db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE date(created_at) = date('now')").get() as any).c;
    const weekTotal = (db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE created_at >= datetime('now', '-7 days')").get() as any).c;
    const methodStats = db.prepare(`SELECT method, COUNT(*) as c FROM audit_logs GROUP BY method ORDER BY c DESC`).all();
    res.json({ today_total: todayTotal, week_total: weekTotal, method_stats: methodStats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit-logs/model-calls — 模型调用日志（备案合规：全链路可追溯）
router.get('/model-calls', authMiddleware, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const moduleFilter = req.query.module as string;
    const userId = (req as any).user?.role === 'admin' ? undefined : (req as any).user?.userId;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (userId) { where += ' AND user_id = ?'; params.push(userId); }
    if (moduleFilter) { where += ' AND module = ?'; params.push(moduleFilter); }

    const rows = db.prepare(`SELECT * FROM model_call_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const total = (db.prepare(`SELECT COUNT(*) as c FROM model_call_logs ${where}`).get(...params) as any)?.c || 0;

    res.json({ data: rows, total, page, limit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
