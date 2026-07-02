import { Router, Request, Response } from 'express';
import getDb from '../../db';
import authMiddleware from '../../middleware/auth';
import { ORDER_DATE } from './shared';
import { getExchangeRate } from './exchange';
import { calculateOrderProfit } from './order-profit';

const router = Router();

// GET /trend?days=30 — 利润趋势数据（按天聚合）
// 返回每天的总净利润、总ROI、订单数等
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);

  const exchangeRate = getExchangeRate(db);

  // 从订单表计算每日利润趋势
  const sql = `
    SELECT
      ${ORDER_DATE} as date,
      COUNT(*) as order_count,
      COALESCE(SUM(o.actual_amount), 0) as total_revenue_myr,
      COALESCE(SUM(o.taxes), 0) as total_taxes,
      COALESCE(SUM(o.shipping_fee), 0) as total_shipping
    FROM orders o
    WHERE o.status NOT IN ('cancelled', 'auto_cancelled', 'refunded')
      AND ${ORDER_DATE} >= datetime('now', '-${days} days')
    GROUP BY ${ORDER_DATE}
    ORDER BY ${ORDER_DATE} ASC
  `;

  const dailyOrders = db.prepare(sql).all() as any[];

  // 对每天的订单逐单计算利润（需要 order_items）
  const getOrderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const trendData = dailyOrders.map(day => {
    let dayNetProfit = 0;
    let dayX = 0, dayY = 0, dayZ = 0, dayA = 0, dayC = 0;

    // 获取当天所有订单的明细来计算利润
    const dayOrderSql = `SELECT o.* FROM orders o WHERE ${ORDER_DATE} = ? AND o.status NOT IN ('cancelled', 'auto_cancelled', 'refunded')`;
    const dayOrders = db.prepare(dayOrderSql).all(day.date) as any[];

    for (const order of dayOrders) {
      const items = getOrderItems.all(order.id) as any[];
      const calc = calculateOrderProfit(order, items, exchangeRate, db);
      dayNetProfit += calc.net_profit;
      dayX += calc.x; dayY += calc.y; dayZ += calc.z; dayA += calc.a; dayC += calc.c || 0;
    }

    return {
      date: day.date,
      order_count: parseInt(day.order_count),
      revenue_myr: Math.round((parseFloat(day.total_revenue_myr) || 0) * 100) / 100,
      profit_rmb: Math.round(dayNetProfit * 100) / 100,
      profit_myr: Math.round((dayNetProfit / exchangeRate) * 100) / 100,
      roi: dayX > 0 ? Math.round((dayNetProfit / dayX) * 10000) / 100 : 0,
      breakdown: { x: Math.round(dayX * 100) / 100, y: Math.round(dayY * 100) / 100, z: Math.round(dayZ * 100) / 100, a: Math.round(dayA * 100) / 100, c: Math.round(dayC * 100) / 100 },
    };
  });

  // 计算汇总统计
  const totals = trendData.reduce(
    (acc, d) => ({
      total_revenue_myr: acc.total_revenue_myr + d.revenue_myr,
      total_profit_rmb: acc.total_profit_rmb + d.profit_rmb,
      total_order_count: acc.total_order_count + d.order_count,
    }),
    { total_revenue_myr: 0, total_profit_rmb: 0, total_order_count: 0 }
  );

  res.json({
    days,
    exchange_rate: exchangeRate,
    summary: {
      period_revenue_myr: Math.round(totals.total_revenue_myr * 100) / 100,
      period_profit_rmb: Math.round(totals.total_profit_rmb * 100) / 100,
      period_avg_daily_profit: trendData.length > 0 ? Math.round(totals.total_profit_rmb / trendData.length * 100) / 100 : 0,
      period_orders: totals.total_order_count,
      period_avg_roi: totals.total_revenue_myr > 0 ? Math.round(totals.total_profit_rmb / (totals.total_revenue_myr * exchangeRate) * 10000) / 100 : 0,
    },
    data: trendData,
  });
});

export default router;
