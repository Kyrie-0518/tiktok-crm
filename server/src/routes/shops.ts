import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';
import { syncShopOrders, testApiConnection, resyncAllOrderItems } from '../services/order-sync';
import { syncShopProducts } from '../services/tiktok-product-sync';
import { getTokenHealth } from '../services/tiktok-oauth';

const router = Router();

// ========== Shop CRUD ==========

// GET /api/shops — list all shops (exclude sensitive credentials)
router.get('/', authMiddleware, (_req: Request, res: Response) => {
  const db = getDb();
  // 动态检测可用列，兼容旧数据库
  const cols = (db.prepare("PRAGMA table_info(tiktok_shops)").all() as any[]).map((c: any) => c.name);
  const safeCols = ['id', 'name', 'region', 'shop_id', 'status', 'last_synced_at', 'created_at']
    .filter(c => cols.includes(c));
  const extraCols = ['sync_enabled', 'product_sync_enabled', 'app_key', 'api_version', 'refresh_token', 'token_expires_at', 'open_id']
    .filter(c => cols.includes(c));
  const selectCols = [...safeCols, ...extraCols].join(', ');
  const shops = db.prepare(`SELECT ${selectCols} FROM tiktok_shops ORDER BY id ASC`).all() as any[];
  // 掩码处理敏感信息
  const masked = shops.map((s: any) => ({
    ...s,
    _has_credentials: !!(s.access_token && s.access_token.length > 0),
    _has_app_key: !!(s.app_key && s.app_key.length > 0),
    _token_valid: s.token_expires_at ? new Date(s.token_expires_at) > new Date() : false,
    _app_key_masked: s.app_key ? s.app_key.slice(0, 4) + '****' + s.app_key.slice(-4) : '',
    _refresh_token_exists: !!(s.refresh_token && s.refresh_token.length > 0),
  }));
  res.json(masked);
});

// ⚠️ 命名路由必须在 /:id 之前注册，否则会被 :id 匹配拦截

// POST /api/shops/upsert — 爬虫同步店铺信息
router.post('/upsert', authMiddleware, (req: Request, res: Response) => {
  const { platform, shop_name, shop_id, rating, follower_count,
          total_products, main_category, logo_url } = req.body;
  if (!shop_name && !platform) {
    return res.status(400).json({ error: '店铺名称或平台必填' });
  }
  const db = getDb();
  const existing = db.prepare(
    "SELECT * FROM tiktok_shops WHERE (shop_id = ? OR name = ?)"
  ).get(shop_id || '', shop_name || '') as any;
  if (existing) {
    db.prepare(`
      UPDATE tiktok_shops SET name=?, region=?, shop_id=?, status=?, last_synced_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      shop_name || existing.name,
      platform?.replace('shopee_', '').toUpperCase() || existing.region,
      shop_id || existing.shop_id || '', 'active', existing.id
    );
    return res.json({ success: true, created: false, updated: true, id: existing.id, message: `店铺 ${shop_name} 已更新` });
  } else {
    const result = db.prepare("INSERT INTO tiktok_shops (name, region, shop_id, status) VALUES (?, ?, ?, ?)").run(
      shop_name || platform, platform?.replace('shopee_', '').toUpperCase() || 'MY', shop_id || '', 'active'
    );
    return res.json({ success: true, created: true, id: result.lastInsertRowid, message: `店铺 ${shop_name} 已创建` });
  }
});

// GET /api/shops/stats — 数据看板
router.get('/stats', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { shop_id, date_from, date_to } = req.query;
  let baseWhere = 'WHERE 1=1';
  const baseParams: any[] = [];
  if (shop_id) { baseWhere += ' AND o.shop_id = ?'; baseParams.push(Number(shop_id)); }
  let dateFrom = date_from as string || '';
  let dateTo = date_to as string || '';
  if (!dateFrom && !dateTo) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    dateFrom = thirtyDaysAgo.toISOString().slice(0, 10);
    dateTo = new Date().toISOString().slice(0, 10);
  } else if (dateFrom && !dateTo) { dateTo = dateFrom; }
  else if (!dateFrom && dateTo) { dateFrom = dateTo; }
  const isSingleDay = dateFrom === dateTo;
  const filterWhere = `${baseWhere} AND ${ORDER_DATE} >= ? AND ${ORDER_DATE} <= ?`;
  const filterParams = [...baseParams, dateFrom, dateTo];
  const filterRow = db.prepare(`
    SELECT COALESCE(SUM(o.actual_amount), 0) as gmv, COUNT(DISTINCT o.id) as order_count,
           COUNT(DISTINCT oi.id) as item_count, COUNT(DISTINCT oi.sku) as sku_count
    FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id ${filterWhere}
  `).get(...filterParams) as any;
  const statusParams = [...baseParams];
  const pendingShip = db.prepare(`SELECT COUNT(*) as c FROM orders o WHERE o.status = 'pending_ship' AND 1=1 ${baseWhere.replace('WHERE 1=1', '')}`).get(...statusParams) as any;
  const pendingCancel = db.prepare(`SELECT COUNT(*) as c FROM orders o WHERE o.status = 'cancel_requested' AND 1=1 ${baseWhere.replace('WHERE 1=1', '')}`).get(...statusParams) as any;
  const refundRequested = db.prepare(`SELECT COUNT(*) as c FROM orders o WHERE o.status = 'refund_requested' AND 1=1 ${baseWhere.replace('WHERE 1=1', '')}`).get(...statusParams) as any;
  const totalOrders = db.prepare(`SELECT COUNT(*) as c FROM orders o WHERE 1=1 ${baseWhere.replace('WHERE 1=1', '')}`).get(...statusParams) as any;
  const todayParams: any[] = shop_id ? [Number(shop_id)] : [];
  const todayRow = db.prepare(`
    SELECT COALESCE(SUM(o.actual_amount), 0) as gmv, COUNT(o.id) as order_count,
           COALESCE(AVG(o.actual_amount), 0) as avg_order_value
    FROM orders o WHERE ${ORDER_DATE} = date('now') ${shop_id ? 'AND o.shop_id = ?' : ''}
  `).get(...todayParams) as any;
  let trend: any[] = [];
  if (isSingleDay) {
    trend = db.prepare(`
      SELECT ${ORDER_HOUR} as time_point, COALESCE(SUM(o.actual_amount), 0) as gmv,
             COUNT(DISTINCT o.id) as order_count, COUNT(DISTINCT oi.id) as item_count, COUNT(DISTINCT oi.sku) as sku_count
      FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id ${filterWhere}
      GROUP BY time_point ORDER BY time_point ASC
    `).all(...filterParams);
    const prevDay = new Date(dateFrom); prevDay.setDate(prevDay.getDate() - 1);
    const prevStr = prevDay.toISOString().slice(0, 10);
    const prevTrend = db.prepare(`
      SELECT ${ORDER_HOUR} as time_point, COALESCE(SUM(o.actual_amount), 0) as gmv
      FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id ${baseWhere} AND ${ORDER_DATE} = ?
      GROUP BY time_point ORDER BY time_point ASC
    `).all(...baseParams, prevStr);
    const prevMap: Record<string, any> = {};
    for (const r of prevTrend as any[]) { prevMap[r.time_point.split(' ')[1]] = r; }
    const fullHours: string[] = [];
    for (let h = 0; h < 24; h++) fullHours.push(`${String(h).padStart(2, '0')}:00`);
    trend = fullHours.map(hour => {
      const cur = trend.find((t: any) => t.time_point?.endsWith(' ' + hour));
      const prev = prevMap[hour];
      return { time_point: `${dateFrom} ${hour}`, gmv: cur?.gmv || 0, order_count: cur?.order_count || 0,
               item_count: cur?.item_count || 0, sku_count: cur?.sku_count || 0, prev_gmv: prev?.gmv || 0 };
    });
  } else {
    trend = db.prepare(`
      SELECT ${ORDER_DATE} as time_point, COALESCE(SUM(o.actual_amount), 0) as gmv,
             COUNT(DISTINCT o.id) as order_count, COUNT(DISTINCT oi.id) as item_count, COUNT(DISTINCT oi.sku) as sku_count
      FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id ${filterWhere}
      GROUP BY time_point ORDER BY time_point ASC
    `).all(...filterParams);
  }
  res.json({
    today: { gmv: Math.round((todayRow.gmv || 0) * 100) / 100, order_count: todayRow.order_count || 0,
             avg_order_value: Math.round((todayRow.avg_order_value || 0) * 100) / 100 },
    pending_ship: pendingShip.c || 0, cancel_requested: pendingCancel.c || 0,
    refund_requested: refundRequested.c || 0, total_orders: totalOrders.c || 0,
    filtered: { date_from: dateFrom, date_to: dateTo, is_single_day: isSingleDay,
                gmv: Math.round((filterRow.gmv || 0) * 100) / 100,
                order_count: filterRow.order_count || 0, item_count: filterRow.item_count || 0, sku_count: filterRow.sku_count || 0 },
    trend,
  });
});

// ─── 动态路由（:id 必须放在命名路由之后）──────────────

// GET /api/shops/:id — get single shop with credentials (for admin editing)
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(req.params.id) as any;
  if (!shop) return res.status(404).json({ error: '店铺不存在' });
  // 返回完整信息（含凭证），前端负责不泄露
  res.json(shop);
});

// POST /api/shops — create shop（手动创建，不使用 OAuth 授权时）
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { name, region, shop_id, app_key, app_secret, access_token, shop_cipher, api_version, sync_enabled, refresh_token, token_expires_at } = req.body;
  if (!name) return res.status(400).json({ error: '店铺名称必填' });
  const db = getDb();
  try {
    // 如果有 access_token 但没填 app_key/app_secret，使用环境变量
    const ak = app_key || process.env.TIKTOK_APP_KEY || '';
    const as = app_secret || process.env.TIKTOK_APP_SECRET || '';
    const result = db.prepare(
      'INSERT INTO tiktok_shops (name, region, shop_id, status, app_key, app_secret, access_token, refresh_token, token_expires_at, shop_cipher, api_version, sync_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, region || 'MY', shop_id || '', 'active', ak, as, access_token || '', refresh_token || '', token_expires_at || null, shop_cipher || '', api_version || '202309', sync_enabled ? 1 : 0);
    res.json({ id: result.lastInsertRowid, name, region: region || 'MY', status: 'active' });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: '店铺已存在' });
    throw e;
  }
});

// PUT /api/shops/:id — update shop
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const { name, region, shop_id, status, app_key, app_secret, access_token, refresh_token, shop_cipher, api_version, sync_enabled, product_sync_enabled } = req.body;
  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(req.params.id) as any;
  if (!shop) return res.status(404).json({ error: '店铺不存在' });

  const updates: string[] = [];
  const values: any[] = [];

  const set = (col: string, val: any) => {
    if (val !== undefined && val !== null) {
      updates.push(`${col} = ?`);
      values.push(val);
    }
  };

  set('name', name);
  set('region', region);
  set('shop_id', shop_id);
  set('status', status);
  set('app_key', app_key);
  set('app_secret', app_secret);
  set('access_token', access_token);
  set('refresh_token', refresh_token);
  set('shop_cipher', shop_cipher);
  set('api_version', api_version);
  set('sync_enabled', sync_enabled !== undefined ? (sync_enabled ? 1 : 0) : undefined);
  set('product_sync_enabled', product_sync_enabled !== undefined ? (product_sync_enabled ? 1 : 0) : undefined);

  if (updates.length === 0) return res.json({ success: true, message: '无变更' });
  values.push(req.params.id);
  db.prepare(`UPDATE tiktok_shops SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ success: true });
});

// DELETE /api/shops/:id — delete shop
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM tiktok_shops WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/shops/:id/test — 测试 TikTok API 连接
router.post('/:id/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await testApiConnection(Number(req.params.id));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, message: `测试异常: ${e.message}` });
  }
});

// GET /api/shops/token-health — 所有店铺 token 健康状态（运维/告警用）
router.get('/token-health', authMiddleware, (_req: Request, res: Response) => {
  try {
    const health = getTokenHealth();
    const needsAttention = health.filter(h => h.status !== 'healthy');
    res.json({
      success: true,
      total: health.length,
      healthy: health.length - needsAttention.length,
      needs_attention: needsAttention.length,
      shops: health,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/shops/:id/sync — 从 TikTok API 同步订单
router.post('/:id/sync', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await syncShopOrders(Number(req.params.id));
    res.json({
      success: result.errors.length === 0,
      ...result,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, errors: [`同步异常: ${e.message}`] });
  }
});

// POST /api/shops/:id/resync-items — 重新拉取所有已有订单的商品明细
router.post('/:id/resync-items', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await resyncAllOrderItems(Number(req.params.id));
    res.json({
      success: result.errors.length === 0,
      ...result,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, errors: [`补全异常: ${e.message}`] });
  }
});

// POST /api/shops/:id/sync-products — 从 TikTok API 同步产品
// body: { forceFull?: boolean } — 默认 true（手动同步默认全量）
router.post('/:id/sync-products', authMiddleware, async (req: Request, res: Response) => {
  try {
    const forceFull = req.body?.forceFull !== false; // 默认全量
    const result = await syncShopProducts(Number(req.params.id), { forceFull });
    res.json({
      success: result.errors.length === 0,
      ...result,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, errors: [`产品同步异常: ${e.message}`] });
  }
});

// POST /api/shops/:id/sync-all — 同时同步产品和订单
router.post('/:id/sync-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const shopId = Number(req.params.id);
    const productResult = await syncShopProducts(shopId);
    const orderResult = await syncShopOrders(shopId);

    res.json({
      success: true,
      products: productResult,
      orders: orderResult,
      summary: {
        products_created: productResult.created,
        products_updated: productResult.updated,
        orders_created: orderResult.created,
        orders_updated: orderResult.updated,
        total_errors: productResult.errors.length + orderResult.errors.length,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, errors: [`同步异常: ${e.message}`] });
  }
});

// POST /api/shops/:id/toggle-sync — 切换订单/产品同步开关
router.post('/:id/toggle-sync', authMiddleware, (req: Request, res: Response) => {
  const { type, enabled } = req.body;
  if (!type || !['order', 'product'].includes(type)) {
    return res.status(400).json({ success: false, message: 'type 必须为 order 或 product' });
  }

  const db = getDb();
  const col = type === 'order' ? 'sync_enabled' : 'product_sync_enabled';
  db.prepare(`UPDATE tiktok_shops SET ${col} = ? WHERE id = ?`).run(enabled ? 1 : 0, req.params.id);
  res.json({ success: true });
});

// ========== Dashboard Stats ==========

// Helper: normalize order_time to YYYY-MM-DD
// Handles both "DD/MM/YYYY HH:MM:SS" (TikTok export) and ISO 8601 (programmatic)
const ORDER_DATE = `CASE
  WHEN o.order_time LIKE '%/%'
    THEN substr(o.order_time, 7, 4) || '-' || substr(o.order_time, 4, 2) || '-' || substr(o.order_time, 1, 2)
  ELSE date(o.order_time)
END`;

// Helper: normalize order_time to YYYY-MM-DD HH:00 (hour granularity)
const ORDER_HOUR = `CASE
  WHEN o.order_time LIKE '%/%'
    THEN substr(o.order_time, 7, 4) || '-' || substr(o.order_time, 4, 2) || '-' || substr(o.order_time, 1, 2) || ' ' || substr(o.order_time, 12, 2) || ':00'
  ELSE strftime('%Y-%m-%d %H:00', o.order_time)
END`;

export default router;
