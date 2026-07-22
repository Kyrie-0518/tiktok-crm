import { Router, Request, Response } from 'express';
import getDb from '../../db';
import authMiddleware from '../../middleware/auth';

const router = Router();

interface TokenStats {
  totalTokens: number;
  totalGenerations: number;
}

// 种子数据（按用户名）
const SEED_DATA: Record<string, TokenStats> = {
  Kyrie:   { totalTokens: 6921900, totalGenerations: 59 },
  admin:   { totalTokens: 1521000, totalGenerations: 19 },
  ziyin:   { totalTokens:  653400, totalGenerations:  6 },
  mengzhu: { totalTokens:  305100, totalGenerations:  3 },
};

// GET /stats — 获取当前用户的 Token 累积统计（无数据时自动种子）
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).user?.userId;
  const username = (req as any).user?.username;
  if (!userId) return res.status(401).json({ error: '未登录' });

  const key = `token_stats_${userId}`;
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;

  if (row) {
    try {
      res.json(JSON.parse(row.value));
      return;
    } catch {}
  }

  // 无数据 → 检查种子数据并自动写入
  if (username && SEED_DATA[username]) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run(key, JSON.stringify(SEED_DATA[username]));
    console.log(`[TokenStats] 自动种子: ${username} → ${JSON.stringify(SEED_DATA[username])}`);
    res.json(SEED_DATA[username]);
    return;
  }

  res.json({ totalTokens: 0, totalGenerations: 0 });
});

// PUT /stats — 更新当前用户的 Token 累积统计（增量累加）
router.put('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).user?.userId;
  if (!userId) return res.status(401).json({ error: '未登录' });

  const { tokens } = req.body; // 本次消耗的 tokens 数
  if (!tokens || tokens <= 0) return res.status(400).json({ error: '无效的 token 数量' });

  // 读取现有统计
  let currentStats: TokenStats = { totalTokens: 0, totalGenerations: 0 };
  const existing = db.prepare("SELECT value FROM settings WHERE key = ?")
    .get(`token_stats_${userId}`) as any;
  if (existing) {
    try {
      currentStats = JSON.parse(existing.value);
    } catch {}
  }

  // 累加
  currentStats.totalTokens += tokens;
  currentStats.totalGenerations += 1;

  // 保存
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .run(`token_stats_${userId}`, JSON.stringify(currentStats));

  res.json(currentStats);
});

export default router;
