import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import configsRouter from './configs';
import generateRouter from './generate';
import pollRouter from './poll';
import statsRouter from './stats';

const router = Router();

// 统一认证：所有 /api/video-models/* 都需要登录态
router.use(authMiddleware);

router.use('/configs', configsRouter);
router.use('/generate', generateRouter);
router.use('/poll', pollRouter);
router.use('/stats', statsRouter);

export { VIDEO_MODEL_TYPES, getModelType } from './types';
export default router;
