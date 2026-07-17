import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';

const router = Router();

// GET /api/dashboard
router.get('/', authMiddleware, (_req: Request, res: Response) => {
  try {
    const db = getDb();

    // 确保时间列存在
    const cols = db.prepare("PRAGMA table_info(orders)").all() as any[];
    const names = cols.map((c: any) => c.name);
    if (!names.includes('order_time')) {
      db.exec('ALTER TABLE orders ADD COLUMN order_time DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    if (!names.includes('created_at')) {
      db.exec('ALTER TABLE orders ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }

    // 重新读取列确认
    const cols2 = db.prepare("PRAGMA table_info(orders)").all() as any[];
    const names2 = cols2.map((c: any) => c.name);
    // 优先用 order_time，其次 created_at，都不存在则用 date('now')
    const dateCol = names2.includes('order_time') ? 'order_time' : 
                    names2.includes('created_at') ? 'created_at' : null;

    const orderDateExpr = dateCol ? `date(orders.${dateCol})` : "date('now')";

    // 卡片
    const totalOrders = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as any).c || 0;
    const todayOrders = (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE ${orderDateExpr} = date('now')`).get() as any).c || 0;
    const totalProducts = (db.prepare("SELECT COUNT(*) as c FROM products").get() as any).c || 0;
    const totalInfluencers = (db.prepare("SELECT COUNT(*) as c FROM influencers").get() as any).c || 0;

    const rev = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','auto_cancelled','refunded') THEN actual_amount ELSE 0 END),0) as r
      FROM orders
    `).get() as any;

    // 今日销售额
    const todayRev = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','auto_cancelled','refunded') THEN actual_amount ELSE 0 END),0) as r
      FROM orders WHERE ${orderDateExpr} = date('now')
    `).get() as any;

    // 趋势
    let trend: any[] = [];
    try {
      trend = db.prepare(`
        SELECT ${orderDateExpr} as date, COUNT(*) as order_count,
               COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','auto_cancelled','refunded') THEN actual_amount ELSE 0 END),0) as revenue
        FROM orders
        WHERE ${orderDateExpr} >= datetime('now','-30 days')
        GROUP BY ${orderDateExpr}
        ORDER BY ${orderDateExpr} ASC
      `).all() as any[];
    } catch {}

    // 利润
    let profit: any = { total_profit: 0, total_investment: 0, product_count: 0, overall_roi: 0 };
    try {
      const fs = db.prepare(`SELECT COALESCE(SUM(net_profit),0) as p, COALESCE(SUM(total_investment),0) as i, COUNT(DISTINCT product_id) as c FROM financial_records`).get() as any;
      profit = {
        total_profit: fs.p || 0,
        total_investment: fs.i || 0,
        product_count: fs.c || 0,
        overall_roi: fs.i > 0 ? Math.round(fs.p / fs.i * 10000) / 100 : 0,
      };
    } catch {}

    // Top10
    let top: any[] = [];
    try {
      top = db.prepare(`
        SELECT p.id, p.name, p.sku, p.image, p.sell_price,
               COALESCE(SUM(oi.quantity),0) as total_qty,
               COALESCE(SUM(oi.subtotal),0) as total_sales,
               COUNT(DISTINCT o.id) as order_times
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled','auto_cancelled','refunded')
        GROUP BY p.id ORDER BY total_qty DESC LIMIT 10
      `).all() as any[];
    } catch {}

    // 订单状态分布（按 status 分组统计）
    let orderStatusCounts: Record<string, number> = {};
    try {
      const rows = db.prepare(`SELECT status, COUNT(*) as c FROM orders GROUP BY status`).all() as any[];
      for (const r of rows) orderStatusCounts[r.status || 'unknown'] = r.c;
    } catch {}

    // 商品健康度
    let productHealth = { total: totalProducts, in_stock: 0, out_of_stock: 0, with_sales: 0, without_sales: 0 };
    try {
      const stockRow = db.prepare(`SELECT
        SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) as out_of_stock
      FROM products`).get() as any;
      productHealth.in_stock = stockRow?.in_stock || 0;
      productHealth.out_of_stock = stockRow?.out_of_stock || 0;

      const salesRow = db.prepare(`SELECT
        COUNT(DISTINCT p.id) as with_sales
      FROM products p
      INNER JOIN order_items oi ON p.id = oi.product_id
      INNER JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled','auto_cancelled','refunded')`).get() as any;
      productHealth.with_sales = salesRow?.with_sales || 0;
      productHealth.without_sales = Math.max(0, totalProducts - productHealth.with_sales);
    } catch {}

    res.json({
      cards: { total_orders: totalOrders, today_orders: todayOrders, total_products: totalProducts, total_influencers: totalInfluencers, total_revenue_myr: Math.round((rev.r||0)*100)/100, today_revenue_myr: Math.round((todayRev.r||0)*100)/100 },
      order_trend: trend.map((d:any) => ({ date: d.date, order_count: d.order_count, revenue_myr: Math.round(parseFloat(d.revenue)*100)/100 })),
      profit_overview: { total_profit_rmb: Math.round(profit.total_profit*100)/100, total_investment_rmb: Math.round(profit.total_investment*100)/100, overall_roi: profit.overall_roi, product_with_records: profit.product_count },
      top_products: top.map((p:any) => ({ id: p.id, name: p.name, sku: p.sku, image: p.image, sell_price: p.sell_price||0, total_qty: parseInt(p.total_qty)||0, total_sales_myr: Math.round(parseFloat(p.total_sales)*100)/100, order_times: parseInt(p.order_times)||0 })),
      order_status_counts: orderStatusCounts,
      product_health: productHealth,
    });
  } catch (err: any) {
    console.error('[Dashboard]', err.message);
    res.status(500).json({ error: '仪表盘数据加载失败: ' + err.message });
  }
});

export default router;
