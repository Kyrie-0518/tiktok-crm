import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import configsRouter from './configs';
import generateRouter from './generate';
import pollRouter from './poll';
import statsRouter from './stats';

const router = Router();

// 挂载子路由 — 所有子路由都需要认证
router.use('/configs', authMiddleware, configsRouter);
router.use('/generate', generateRouter);
router.use('/poll', authMiddleware, pollRouter);
router.use('/stats', authMiddleware, statsRouter);

// Re-export types for frontend usage
export { VIDEO_MODEL_TYPES, getModelType } from './types';

export default router;
