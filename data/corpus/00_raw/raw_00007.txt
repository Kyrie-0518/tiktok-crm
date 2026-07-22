import { Router, Request, Response } from 'express';
import getDb from '../db';
import { authMiddleware, JwtPayload } from '../middleware/auth';

const router = Router();

// ===== 权限辅助 =====
function requireDeveloper(req: Request, res: Response): boolean {
  const user = req.user as JwtPayload;
  if (user.roleKey !== 'developer' && user.roleKey !== 'manager') {
    res.status(403).json({ error: '仅管理员可操作' });
    return false;
  }
  return true;
}

// GET /api/admin/users — 全系统用户列表
router.get('/users', authMiddleware, (req: Request, res: Response) => {
  if (!requireDeveloper(req, res)) return;
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.role_id, u.created_at,
           r.name as role_name, r.role_key as role_key
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    ORDER BY u.id ASC
  `).all();
  res.json(users);
});

// ==========================================
// 操作日志审计
// ==========================================

// GET /api/admin/audit-logs
router.get('/audit-logs', authMiddleware, (req: Request, res: Response) => {
  if (!requireDeveloper(req, res)) return;
  const db = getDb();
  const { page, pageSize, username, method, path, startDate, endDate } = req.query;
  const p = Math.max(1, parseInt(page as string) || 1);
  const ps = Math.min(100, parseInt(pageSize as string) || 20);
  const offset = (p - 1) * ps;

  let where = '1=1';
  const params: any[] = [];
  if (username) { where += ' AND a.username LIKE ?'; params.push(`%${username}%`); }
  if (method) { where += ' AND a.method = ?'; params.push(method); }
  if (path) { where += ' AND a.path LIKE ?'; params.push(`%${path}%`); }
  if (startDate) { where += ' AND a.created_at >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND a.created_at <= ?'; params.push(endDate); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM audit_logs a WHERE ${where}`).get(...params) as { c: number };
  const logs = db.prepare(
    `SELECT a.* FROM audit_logs a WHERE ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, ps, offset);

  res.json({ total: total.c, page: p, pageSize: ps, data: logs });
});

// GET /api/admin/online-users — 当前在线 IP（基于最近 5 分钟请求聚合）
router.get('/online-users', authMiddleware, (req: Request, res: Response) => {
  if (!requireDeveloper(req, res)) return;
  const db = getDb();
  // 按 IP 聚合最近 5 分钟内的请求
  const rows = db.prepare(`
    SELECT
      ip,
      COALESCE(MAX(username), '') as username,
      MAX(user_agent) as user_agent,
      MAX(created_at) as last_seen,
      COUNT(*) as request_count,
      GROUP_CONCAT(DISTINCT method || ' ' || substr(path, 1, 60)) as paths
    FROM audit_logs
    WHERE created_at > datetime('now', '-5 minutes')
      AND ip != ''
    GROUP BY ip
    ORDER BY last_seen DESC
  `).all() as any[];

  // 解析 User-Agent 提取设备信息
  const parsed = rows.map(r => {
    const ua = r.user_agent || '';
    const os = /Windows/.test(ua) ? 'Windows'
      : /Mac/.test(ua) ? 'macOS'
      : /iPhone|iPad/.test(ua) ? 'iOS'
      : /Android/.test(ua) ? 'Android'
      : /Linux/.test(ua) ? 'Linux'
      : '未知';
    const browser = /Edg\//.test(ua) ? 'Edge'
      : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox'
      : /Safari\//.test(ua) && !/Chrome/.test(ua) ? 'Safari'
      : /MSIE|Trident/.test(ua) ? 'IE'
      : '未知';
    return {
      ip: r.ip,
      username: r.username || '（匿名）',
      os,
      browser,
      last_seen: r.last_seen,
      request_count: r.request_count,
      // 最近访问路径（前 3 条）
      recent_paths: [...new Set((r.paths || '').split(',').filter(Boolean))].slice(0, 3),
      // 原始 UA（完整，供排查用）
      user_agent_raw: ua.slice(0, 200),
    };
  });

  res.json({
    online_count: parsed.length,
    window_seconds: 300,
    data: parsed,
  });
});




export default router;
