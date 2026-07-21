/**
 * AI Growth Center API
 */
import { Router, Request, Response } from 'express';
import authMiddleware from '../middleware/auth';
import getDb from '../db';
import { runPipeline } from '../services/growth-center/orchestrator';

const router = Router();

// 全部需要认证
router.use(authMiddleware);

/* ══════════════════════════ POST /diagnose — 启动诊断 ══════════════════════════ */
router.post('/diagnose', async (req: Request, res: Response) => {
  const { shop_cipher, shop_name, days } = req.body;
  if (!shop_cipher) return res.status(400).json({ error: '缺少 shop_cipher' });
  if (!shop_name) return res.status(400).json({ error: '缺少 shop_name' });

  try {
    const taskId = `dx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const db = getDb();
    db.prepare(`INSERT INTO growth_diagnoses (task_id, shop_id, shop_name, status, created_at, updated_at)
      VALUES (?, ?, ?, 'running', datetime('now','localtime'), datetime('now','localtime'))`)

    const result = await runPipeline(shop_cipher, shop_name || '未命名店铺', days || 30);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || '诊断失败' });
  }
});

/* ══════════════════════════ POST /diagnose/async — 异步启动 ══════════════════════════ */
router.post('/diagnose/async', async (req: Request, res: Response) => {
  const { shop_cipher, shop_name, days } = req.body;
  if (!shop_cipher) return res.status(400).json({ error: '缺少 shop_cipher' });

  const taskId = `dx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const db = getDb();
  db.prepare(`INSERT INTO growth_diagnoses (task_id, shop_id, shop_name, status, created_at, updated_at)
    VALUES (?, ?, ?, 'running', datetime('now','localtime'), datetime('now','localtime'))`)
    .run(taskId, shop_cipher, shop_name || '');

  // 异步执行，立即返回 taskId
  runPipeline(shop_cipher, shop_name || '未命名店铺', days || 30)
    .catch(e => console.error(`[GrowthCenter] ${taskId} failed:`, e.message));

  res.json({ task_id: taskId, status: 'running' });
});

/* ══════════════════════════ GET /diagnose/:taskId — 查询诊断结果 ══════════════════════════ */
router.get('/diagnose/:taskId', (req: Request, res: Response) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM growth_diagnoses WHERE task_id = ?').get(req.params.taskId) as any;
  if (!task) return res.status(404).json({ error: '诊断不存在' });
  const result = task.result_json ? safeParse(task.result_json) : null;
  res.json({ task, result });
});

/* ══════════════════════════ GET /history — 诊断历史列表 ══════════════════════════ */
router.get('/history', (req: Request, res: Response) => {
  const db = getDb();
  const shopId = req.query.shop_id as string;
  const limit = parseInt(req.query.limit as string) || 30;
  const offset = parseInt(req.query.offset as string) || 0;
  const { default: createErrors } = require('better-sqlite3/src/database');

  let sql = 'SELECT * FROM growth_diagnoses WHERE 1=1';
  const params: any[] = [];
  if (shopId) { sql += ' AND shop_id = ?'; params.push(shopId); }
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params) as any[];
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM growth_diagnoses').get() as any)?.cnt || 0;

  res.json({ rows, total, limit, offset });
});

/* ══════════════════════════ DELETE /history/:taskId — 删除诊断记录 ══════════════════════════ */
router.delete('/history/:taskId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM growth_diagnoses WHERE task_id = ?').run(req.params.taskId);
  res.json({ success: true });
});

/* ══════════════════════════ POST /review — AI复盘 ══════════════════════════ */
router.post('/review', async (req: Request, res: Response) => {
  const { previous_task_id, current_task_id } = req.body;
  if (!previous_task_id || !current_task_id) {
    return res.status(400).json({ error: '缺少 previous_task_id 或 current_task_id' });
  }

  const db = getDb();
  const prev = db.prepare('SELECT * FROM growth_diagnoses WHERE task_id = ?').get(previous_task_id) as any;
  const curr = db.prepare('SELECT * FROM growth_diagnoses WHERE task_id = ?').get(current_task_id) as any;
  if (!prev || !curr) return res.status(404).json({ error: '诊断记录不存在' });

  const prevResult = safeParse(prev.result_json);
  const currResult = safeParse(curr.result_json);

  const daysBetween = Math.round(
    (new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()) / 86400000
  );

  // 简单复盘：对比健康评分和关键指标
  const healthChange = (curr.health_score || 0) - (prev.health_score || 0);

  res.json({
    previous_diagnosis: prevResult,
    current_diagnosis: currResult,
    days_between: daysBetween,
    health_change: healthChange,
    gmv_change_pct: 0,   // TODO: 从数据快照计算
    orders_change: 0,
    completed_actions: [],
    pending_actions: [],
    ai_summary: healthChange > 0
      ? `健康评分提升 +${healthChange} 分，优化效果显著。`
      : healthChange < 0
        ? `健康评分下降 ${healthChange} 分，需要关注。`
        : '健康评分持平。',
    next_recommendations: [],
  });
});

function safeParse(json: string): any {
  try { return JSON.parse(json); } catch { return {}; }
}

export default router;
