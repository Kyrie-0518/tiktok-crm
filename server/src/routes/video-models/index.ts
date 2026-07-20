import { Router } from 'express';
import configsRouter from './configs';
import generateRouter from './generate';
import pollRouter from './poll';
import statsRouter from './stats';

const router = Router();

// 挂载子路由 — authMiddleware 在各子路由内单独使用
router.use('/configs', configsRouter);
router.use('/generate', generateRouter);
router.use('/poll', pollRouter);
router.use('/stats', statsRouter);

// Re-export types for frontend usage
export { VIDEO_MODEL_TYPES, getModelType } from './types';

export default router;
