/**
 * 内容安全检测中间件
 * - 违禁词实时拦截 + 3 次累计暂停 + 管理员复核恢复
 * - 备案合规：覆盖违法违规、色情暴力、虚假欺诈等违规内容
 */
import { Request, Response, NextFunction } from 'express';
import getDb from '../db';

// 违禁词库（按类别分组，实际部署时可扩展至 1000+）
const BLOCKED_TERMS: Record<string, string[]> = {
  // 违法违规
  违法: ['走私', '贩毒', '洗钱', '逃税', '偷渡', '诈骗', '传销', '假币', '枪支', '弹药'],
  政治敏感: ['颠覆', '分裂', '恐怖', '暴恐', '极端', '煽动'],
  // 色情暴力
  色情: ['色情', '淫秽', '裸体', '性交', '嫖娼', '卖淫', '约炮', '黄色', '成人'],
  暴力: ['杀人', '自杀', '暴力', '血腥', '虐待', '自残'],
  // 虚假欺诈
  欺诈: ['刷单', '刷评', '虚假', '造假', '仿冒', '假冒', '山寨'],
  // 其他违规
  赌博: ['赌博', '赌场', '博彩', '彩票', '六合彩'],
  毒品: ['毒品', '吸毒', '大麻', '海洛因', '冰毒'],
};

// 扁平化所有违禁词
const ALL_BLOCKED = new Set<string>();
for (const arr of Object.values(BLOCKED_TERMS)) {
  for (const w of arr) ALL_BLOCKED.add(w);
}

interface ViolationRecord {
  user_id: number;
  username: string;
  input: string;
  matched_terms: string[];
  module: string;
  ip: string;
}

/**
 * 检测文本是否包含违禁词
 */
export function detectViolation(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const term of ALL_BLOCKED) {
    if (text.includes(term)) found.push(term);
  }
  return found;
}

/**
 * 记录违规操作
 */
export function recordViolation(record: ViolationRecord): void {
  try {
    const db = getDb();
    // 1. 写入操作日志
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, method, path, status, ip, detail, created_at)
      VALUES (?, ?, ?, 'POST', '/api/violation', 403, ?, ?, datetime('now','localtime'))
    `).run(
      record.user_id, record.username,
      `违禁词拦截-${record.module}`,
      record.ip,
      JSON.stringify({
        input: record.input.slice(0, 200),
        matched_terms: record.matched_terms,
        module: record.module,
      })
    );

    // 2. 累计违规次数
    const now = new Date().toISOString().slice(0, 10);
    const existing = db.prepare(
      `SELECT id, violation_count FROM user_violations WHERE user_id = ? AND date = ?`
    ).get(record.user_id, now) as any;

    if (existing) {
      db.prepare(`UPDATE user_violations SET violation_count = violation_count + 1, updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(existing.id);
    } else {
      db.prepare(`INSERT INTO user_violations (user_id, date, violation_count) VALUES (?, ?, 1)`)
        .run(record.user_id, now);
    }

    // 3. 累计 3 次 → 暂停 AI 功能
    const newCount = (existing?.violation_count || 0) + 1;
    if (newCount >= 3) {
      db.prepare(`UPDATE users SET ai_suspended = 1, ai_suspended_at = datetime('now','localtime'), ai_suspend_reason = ? WHERE id = ?`)
        .run(`累计 ${newCount} 次违禁词输入`, record.user_id);
      console.warn(`[moderation] 用户 ${record.username}(#${record.user_id}) AI功能已暂停：累计 ${newCount} 次违规`);
    }
  } catch (e: any) {
    console.error('[moderation] 记录违规失败:', e.message);
  }
}

/**
 * Express 中间件：拦截违禁词
 */
export function moderationMiddleware(module: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId;
    const username = (req as any).user?.username || 'unknown';

    // 检查用户是否已被暂停
    if (userId) {
      const user = getDb().prepare('SELECT ai_suspended FROM users WHERE id = ?').get(userId) as any;
      if (user?.ai_suspended) {
        return res.status(403).json({
          error: 'AI功能已暂停',
          reason: '累计 3 次违规输入，请联系管理员复核后恢复',
          code: 'AI_SUSPENDED',
        });
      }
    }

    // 提取要检测的文本
    const texts: string[] = [];
    if (req.body?.query) texts.push(req.body.query);
    if (req.body?.userPrompt) texts.push(req.body.userPrompt);
    if (req.body?.prompt) texts.push(req.body.prompt);
    if (req.body?.content) texts.push(req.body.content);

    for (const text of texts) {
      const matched = detectViolation(text);
      if (matched.length > 0) {
        // 记录违规
        if (userId) {
          recordViolation({
            user_id: userId,
            username,
            input: text,
            matched_terms: matched,
            module,
            ip: req.ip || req.socket.remoteAddress || '',
          });
        }
        return res.status(403).json({
          error: '输入内容包含违规信息，已被系统拦截并记录',
          code: 'CONTENT_BLOCKED',
          hint: '请修改输入后重试。累计 3 次违规将暂停 AI 功能。',
        });
      }
    }

    next();
  };
}
