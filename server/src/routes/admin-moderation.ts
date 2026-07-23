/**
 * 管理后台 — 违禁记录管理 API
 */
import { Router, Request, Response } from 'express';
import authMiddleware from '../middleware/auth';
import { getViolationUsers, getViolationDetail, unbanUser, permanentBanUser } from '../middleware/content-moderation';

const router = Router();

// 全部接口需要管理员权限
router.use(authMiddleware as any);

// GET /api/admin/moderation/users — 违禁用户列表
router.get('/users', (req: Request, res: Response) => {
  try {
    const users = getViolationUsers();
    res.json({ data: users });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/moderation/users/:id — 用户违禁详情
router.get('/users/:id', (req: Request, res: Response) => {
  try {
    const detail = getViolationDetail(parseInt(req.params.id));
    res.json({ data: detail });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/moderation/users/:id/unban — 解禁
router.post('/users/:id/unban', (req: Request, res: Response) => {
  try {
    unbanUser(parseInt(req.params.id));
    res.json({ success: true, message: '用户已解禁' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/moderation/users/:id/ban — 永久封禁
router.post('/users/:id/ban', (req: Request, res: Response) => {
  try {
    const reason = req.body.reason || '管理员操作';
    permanentBanUser(parseInt(req.params.id), reason);
    res.json({ success: true, message: '已永久封禁' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
