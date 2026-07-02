import { Router } from 'express';
import costsRouter from './costs';
import formulasRouter from './formulas';
import exchangeRouter from './exchange';
import recordsRouter from './records';
import orderProfitRouter from './order-profit';
import trendRouter from './trend';

const router = Router();

// 挂载子路由
router.use('/cost-items', costsRouter);
router.use('/formulas', formulasRouter);
router.use('/exchange-rate', exchangeRouter);
router.use('/records', recordsRouter);   // records CRUD（兼容前端 /finance/records 调用）
router.use('/order-profit', orderProfitRouter);
router.use('/trend', trendRouter);     // 利润趋势图 API

// Re-export for index.ts usage
export { autoUpdateExchangeRate } from './exchange';

export default router;
