import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';

const router = Router();

// GET /api/ai-studio/stats — AI工作室概览统计
router.get('/stats', authMiddleware, (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = (_req as any).user?.id;

    // 1. 视频作品数（seedance_videos 表）
    let totalVideos = 0;
    try {
      const r = db.prepare('SELECT COUNT(*) as c FROM seedance_videos').get() as any;
      totalVideos = r?.c || 0;
    } catch {}

    // 2. 素材总数（seedance_materials 表）
    let totalMaterials = 0;
    try {
      const r = db.prepare('SELECT COUNT(*) as c FROM seedance_materials').get() as any;
      totalMaterials = r?.c || 0;
    } catch {}

    // 3. AI对话次数 — 从 audit_logs 统计 /api/ai/chat 调用
    let totalAiChats = 0;
    try {
      const r = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE method = 'POST' AND (path LIKE '/api/ai/chat%' OR path LIKE '%/chat')").get() as any;
      totalAiChats = r?.c || 0;
    } catch {}

    // 4. 活跃模型数（video_model_configs 中 enabled=1 的）
    let activeModels = 0;
    try {
      let query = 'SELECT COUNT(*) as c FROM video_model_configs WHERE is_enabled = 1';
      const params: any[] = [];
      // 非开发者只能看自己的配置
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      const r = db.prepare(query).get(...params) as any;
      activeModels = r?.c || 0;
    } catch {}

    // 5. SKIIS 工作日志数
    let skiisDailyLogs = 0;
    try {
      const r = db.prepare('SELECT COUNT(*) as c FROM skiis_daily_logs').get() as any;
      skiisDailyLogs = r?.c || 0;
    } catch {}

    // 6. 待处理广告账单（如果 ad_bills 表存在）
    let pendingAdBills = 0;
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ad_bills'").all() as any[];
      if (tables.length > 0) {
        const r = db.prepare("SELECT COUNT(*) as c FROM ad_bills WHERE status NOT IN ('paid','settled','cancelled')").get() as any;
        pendingAdBills = r?.c || 0;
      }
    } catch {}

    // 7. 问题订单数（orders 表中异常状态的订单）
    let problemOrderCount = 0;
    try {
      const r = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('disputed','refund_requested','refunded','exception','on_hold')").get() as any;
      problemOrderCount = r?.c || 0;
    } catch {}

    res.json({
      total_videos: totalVideos,
      total_materials: totalMaterials,
      total_ai_chats: totalAiChats,
      active_models: activeModels,
      skiis_daily_logs: skiisDailyLogs,
      pending_ad_bills: pendingAdBills,
      problem_order_count: problemOrderCount,
    });
  } catch (err: any) {
    console.error('[AI-Studio]', err.message);
    res.status(500).json({ error: 'AI工作室数据加载失败: ' + err.message });
  }
});

export default router;
