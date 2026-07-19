// AI Engine API — Pipeline 入口
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createAndRun } from '../services/ai-engine/orchestrator';
import { getDb } from '../db';
import crypto from 'crypto';

function uuid(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const router = Router();

// POST /api/ai-engine/generate — 执行全链路 AI Pipeline
router.post('/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { productId, productImage, productName, productDescription, userPrompt, template, model, resolution, aspectRatio, duration, count } = req.body;

    if (!userPrompt && !productName) {
      return res.status(400).json({ error: '请提供 userPrompt 或 productName' });
    }

    const taskId = `vt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await createAndRun({
      taskId,
      productId,
      productImage,
      productName: productName || '通用商品',
      productDescription,
      userPrompt: userPrompt || '',
      template,
      model: model || 'doubao-seedance-2-0-260128',
      resolution: resolution || '720p',
      aspectRatio: aspectRatio || '9:16',
      duration: duration || 5,
      count: count || 1,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'AI Engine 执行失败' });
  }
});

// GET /api/ai-engine/tasks/:taskId — 查询任务状态
router.get('/tasks/:taskId', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM video_tasks WHERE task_id = ?').get(req.params.taskId) as any;
  if (!task) return res.status(404).json({ error: '任务不存在' });
  const steps = db.prepare('SELECT * FROM video_task_steps WHERE task_id = ? ORDER BY id').all(req.params.taskId) as any[];
  res.json({ task, steps });
});

// GET /api/ai-engine/tasks — 任务列表
router.get('/tasks', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const tasks = db.prepare('SELECT * FROM video_tasks ORDER BY id DESC LIMIT ?').all(limit) as any[];
  res.json({ tasks, total: tasks.length });
});

// GET /api/ai-engine/templates — 模板列表
router.get('/templates', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM video_templates ORDER BY usage_count DESC LIMIT 100').all() as any[];
  res.json({ templates, total: templates.length });
});

// POST /api/ai-engine/templates — 创建模板
router.post('/templates', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { name, category, prompt, strategy, params, tags } = req.body;
  const result = db.prepare(
    `INSERT INTO video_templates (name, category, prompt, strategy, params, tags, created_by) VALUES (?,?,?,?,?,?,?)`
  ).run(name, category || '', prompt || '', strategy || '', JSON.stringify(params || {}), tags || '', req.user?.userId || 0);
  res.json({ id: result.lastInsertRowid, name });
});

export default router;
