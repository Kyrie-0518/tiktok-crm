import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import getDb from '../db';
import authMiddleware from '../middleware/auth';

const router = Router();

// ---- multer 临时文件 ----
const TMP_DIR = path.join(__dirname, '..', '..', 'data', 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.csv', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('仅支持 .xlsx / .csv 格式'));
  },
});

// ========== List (with filters + pagination) ==========
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { keyword, status, cooperation_type, shop_id, send_date_from, send_date_to, receive_from, receive_to, contact_date_from, contact_date_to, page, page_size } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(page_size) || 20));
  const offset = (pageNum - 1) * pageSize;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (keyword) {
    where += ` AND (inf.influencer_id LIKE ? OR inf.name LIKE ? OR inf.remark LIKE ? OR s.name LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (cooperation_type) {
    where += ` AND inf.cooperation_type = ?`;
    params.push(cooperation_type);
  }
  if (status) {
    where += ` AND inf.status = ?`;
    params.push(status);
  }
  if (shop_id) {
    where += ` AND inf.shop_id = ?`;
    params.push(Number(shop_id));
  }
  // 建联日期筛选
  if (contact_date_from) {
    where += ` AND inf.contact_date >= ?`;
    params.push(contact_date_from);
  }
  if (contact_date_to) {
    where += ` AND inf.contact_date <= ?`;
    params.push(contact_date_to);
  }
  // 寄样日期筛选
  if (send_date_from) {
    where += ` AND inf.send_date >= ?`;
    params.push(send_date_from);
  }
  if (send_date_to) {
    where += ` AND inf.send_date <= ?`;
    params.push(send_date_to);
  }
  // 收货日期筛选
  if (receive_from) {
    where += ` AND inf.receive_date >= ?`;
    params.push(receive_from);
  }
  if (receive_to) {
    where += ` AND inf.receive_date <= ?`;
    params.push(receive_to);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM influencers inf LEFT JOIN tiktok_shops s ON inf.shop_id = s.id ${where}`).get(...params) as { total: number };
  const list = db.prepare(
    `SELECT inf.*, s.name as shop_name, p.name as product_name, p.cost_price as product_cost_price
     FROM influencers inf
     LEFT JOIN tiktok_shops s ON inf.shop_id = s.id
     LEFT JOIN products p ON inf.product_id = p.id
     ${where}
     ORDER BY CASE WHEN inf.contact_date != '' THEN inf.contact_date END DESC, inf.id DESC
     LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  res.json({ list, total: countRow.total, page: pageNum, page_size: pageSize });
});

// ========== Export all (MUST be before /:id) ==========
router.get('/export/all', authMiddleware, (_req: Request, res: Response) => {
  const db = getDb();
  const list = db.prepare(
    `SELECT inf.*, s.name as shop_name, p.name as product_name, p.cost_price as product_cost_price
     FROM influencers inf
     LEFT JOIN tiktok_shops s ON inf.shop_id = s.id
     LEFT JOIN products p ON inf.product_id = p.id
     ORDER BY inf.id DESC`
  ).all();
  res.json(list);
});

// ========== Stats summary (MUST be before /:id) ==========
router.get('/stats/summary', authMiddleware, (_req: Request, res: Response) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as c FROM influencers').get() as { c: number };
  const byCooperation = db.prepare("SELECT cooperation_type, COUNT(*) as count FROM influencers GROUP BY cooperation_type").all();
  const unshipped = db.prepare("SELECT COUNT(*) as c FROM influencers WHERE send_date = '' OR send_date IS NULL").get() as { c: number };
  const unreceived = db.prepare("SELECT COUNT(*) as c FROM influencers WHERE receive_date = '' OR receive_date IS NULL").get() as { c: number };
  const totalSampleCost = db.prepare("SELECT COALESCE(SUM(sample_cost), 0) as total FROM influencers").get() as { total: number };
  res.json({
    total: total.c,
    by_cooperation: byCooperation,
    unshipped: unshipped.c,
    unreceived: unreceived.c,
    total_sample_cost: totalSampleCost.total,
  });
});

// ========== Batch Import (MUST be before /:id) ==========
router.post('/batch-import', authMiddleware, (req: Request, res: Response) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '导入数据不能为空' });
  }
  const db = getDb();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  const insertStmt = db.prepare(
    `INSERT INTO influencers (shop_id, influencer_id, profile_url, contact_channel, contact_info,
     cooperation_type, product_id, sample_qty, sample_cost, contact_date, send_date, receive_date,
     material_schedule, material_url, remark, status, name, contact)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const batchImport = db.transaction((dataList: any[]) => {
    for (const item of dataList) {
      try {
        let sample_cost = 0;
        if (item.product_id && item.sample_qty) {
          const product = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(item.product_id) as any;
          if (product) {
            sample_cost = (product.cost_price || 0) * (item.sample_qty || 1);
            sample_cost = Math.round(sample_cost * 100) / 100;
          }
        }
        insertStmt.run(
          item.shop_id || null, item.influencer_id || '', item.profile_url || '',
          item.contact_channel || '', item.contact_info || '',
          item.cooperation_type || '', item.product_id || null,
          item.sample_qty || 1, sample_cost,
          item.contact_date || '', item.send_date || '', item.receive_date || '',
          item.material_schedule || '', item.material_url || '',
          item.remark || '', item.status || '未回复', item.influencer_id || '', item.contact_info || ''
        );
        success++;
      } catch (e: any) {
        failed++;
        errors.push(`${item.influencer_id || '未知'}: ${e.message}`);
      }
    }
  });
  batchImport(items);
  res.json({ success, failed, errors });
});

// ========== File Upload Import (支持 .xlsx/.csv 真正解析) ==========
router.post('/batch-import/file', upload.single('file'), authMiddleware, async (req: Request, res: Response) => {
  try {
    const filePath = req.file?.path;
    const originalName = req.file?.originalname || '';
    if (!filePath) return res.status(400).json({ error: '未上传文件' });

    // 用 SheetJS 解析
    let allRows: any[][];
    const ext = path.extname(originalName).toLowerCase();
    if (ext === '.csv') {
      const wb = XLSX.readFile(filePath, { type: 'string' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
    } else {
      const wb = XLSX.readFile(filePath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
    }

    // 清理临时文件
    try { fs.unlinkSync(filePath); } catch {}

    if (allRows.length < 2) return res.status(400).json({ error: '文件至少需要表头+1行数据' });

    const headers = allRows[0].map((h: any) => String(h ?? '').trim());
    const db = getDb();
    const shops = db.prepare("SELECT id, name FROM tiktok_shops WHERE status='active'").all() as any[];
    const products = db.prepare("SELECT id, name FROM products").all() as any[];

    // 列名映射（中文 → 数据库字段）
    const fieldMap: Record<string, string> = {
      '店铺': 'shop_name', '店铺名称': 'shop_name',
      '达人ID': 'influencer_id',
      '达人主页': 'profile_url',
      '建联渠道': 'contact_channel',
      '联系信息': 'contact_info',
      '合作方式': 'cooperation_type',
      '佣金比例(%)': 'commission_rate', '佣金比例': 'commission_rate',
      '样品名称': 'product_name', '样品/产品': 'product_name', '产品名称': 'product_name',
      '样品数量': 'sample_qty',
      '样品成本': 'sample_cost',
      '建联日期': 'contact_date', '联系日期': 'contact_date', '接触日期': 'contact_date',
      '寄样日期': 'send_date',
      '收货日期': 'receive_date',
      '素材排期': 'material_schedule',
      '素材链接': 'material_url',
      '备注': 'remark',
    };

    const items: any[] = [];
    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      if (!row.some((c: any) => c !== null && c !== undefined && String(c).trim() !== '')) continue;

      const rawItem: any = {};
      headers.forEach((h, idx) => { rawItem[h] = row[idx]; });

      const item: any = {};

      for (const [cn, field] of Object.entries(fieldMap)) {
        if (rawItem[cn] !== undefined && rawItem[cn] !== null && String(rawItem[cn]).trim() !== '') {
          item[field] = rawItem[cn];
        }
      }

      // 店铺映射
      const shopName = item['shop_name'];
      if (shopName) {
        const shop = shops.find(s => s.name === shopName);
        if (shop) { item.shop_id = shop.id; delete item.shop_name; }
      }

      // 产品映射
      const productName = item['product_name'];
      if (productName) {
        const prod = products.find(p => p.name === productName);
        if (prod) { item.product_id = prod.id; delete item.product_name; }
      }

      // 数值转换
      if (item.sample_qty) item.sample_qty = parseInt(String(item.sample_qty)) || 1;
      if (item.commission_rate) item.commission_rate = parseFloat(String(item.commission_rate)) || 0;

      items.push(item);
    }

    if (items.length === 0) return res.status(400).json({ error: '未识别到有效数据行，请检查表头是否匹配' });

    // 执行导入
    let success = 0, failed = 0;
    const errors: string[] = [];

    const insertStmt = db.prepare(
      `INSERT INTO influencers (shop_id, influencer_id, profile_url, contact_channel, contact_info,
       cooperation_type, product_id, sample_qty, sample_cost, contact_date, send_date, receive_date,
       material_schedule, material_url, remark, status, name, contact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const doImport = db.transaction((dataList: any[]) => {
      for (const it of dataList) {
        try {
          let sc = 0;
          if (it.product_id && it.sample_qty) {
            const p = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(it.product_id) as any;
            if (p) sc = Math.round((p.cost_price || 0) * (it.sample_qty || 1) * 100) / 100;
          }
          insertStmt.run(
            it.shop_id || null, it.influencer_id || '', it.profile_url || '',
            it.contact_channel || '', it.contact_info || '',
            it.cooperation_type || '', it.product_id || null,
            it.sample_qty || 1, sc,
            it.contact_date || '', it.send_date || '', it.receive_date || '',
            it.material_schedule || '', it.material_url || '',
            it.remark || '', it.status || '未回复', it.influencer_id || '', it.contact_info || ''
          );
          success++;
        } catch (e: any) { failed++; errors.push(`${it.influencer_id || '未知'}: ${e.message}`); }
      }
    });

    doImport(items);
    res.json({ success, failed, total: items.length, errors });

  } catch (err: any) {
    // 清理临时文件
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message || '导入失败' });
  }
});

// ========== Get single ==========
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare(
    `SELECT inf.*, s.name as shop_name, p.name as product_name, p.cost_price as product_cost_price
     FROM influencers inf
     LEFT JOIN tiktok_shops s ON inf.shop_id = s.id
     LEFT JOIN products p ON inf.product_id = p.id
     WHERE inf.id = ?`
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: '达人不存在' });
  res.json(row);
});

// ========== Create ==========
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { shop_id, influencer_id, profile_url, contact_channel, contact_info, cooperation_type, commission_rate, product_id, sample_qty, contact_date, send_date, receive_date, material_schedule, material_url, remark, status } = req.body;
  if (!influencer_id) {
    return res.status(400).json({ error: '达人ID必填' });
  }
  const db = getDb();

  // Auto calculate sample cost from product
  let sample_cost = 0;
  if (product_id && sample_qty) {
    const product = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(product_id) as any;
    if (product) {
      sample_cost = (product.cost_price || 0) * (sample_qty || 1);
      sample_cost = Math.round(sample_cost * 100) / 100;
    }
  }

  // Validate commission_rate: keep max 2 decimal places
  let rate = 0;
  if (commission_rate !== undefined && commission_rate !== null && commission_rate !== '') {
    rate = Math.round(Number(commission_rate) * 100) / 100;
  }

  const result = db.prepare(
    `INSERT INTO influencers (shop_id, influencer_id, profile_url, contact_channel, contact_info,
     cooperation_type, commission_rate, product_id, sample_qty, sample_cost, contact_date, send_date, receive_date,
     material_schedule, material_url, remark, status, name, contact)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    shop_id || null, influencer_id, profile_url || '', contact_channel || '', contact_info || '',
    cooperation_type || '', rate, product_id || null, sample_qty || 1, sample_cost,
    contact_date || '', send_date || '', receive_date || '', material_schedule || '', material_url || '',
    remark || '', status || '未回复', influencer_id, contact_info || ''
  );
  res.json({ id: result.lastInsertRowid, sample_cost, commission_rate: rate });
});

// ========== Update ==========
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const { shop_id, influencer_id, profile_url, contact_channel, contact_info, cooperation_type, commission_rate, product_id, sample_qty, contact_date, send_date, receive_date, material_schedule, material_url, remark, status } = req.body;
  const db = getDb();

  // 先获取现有记录
  const existing = db.prepare('SELECT * FROM influencers WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: '达人不存在' });

  // Auto calculate sample cost
  let sample_cost = existing.sample_cost || 0;
  if (product_id && sample_qty) {
    const product = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(product_id) as any;
    if (product) {
      sample_cost = (product.cost_price || 0) * (sample_qty || 1);
      sample_cost = Math.round(sample_cost * 100) / 100;
    }
  }

  // Validate commission_rate
  let rate = existing.commission_rate || 0;
  if (commission_rate !== undefined && commission_rate !== null && commission_rate !== '') {
    rate = Math.round(Number(commission_rate) * 100) / 100;
  }

  // 只更新传入的字段，其余保留原值
  db.prepare(
    `UPDATE influencers SET shop_id=?, influencer_id=?, profile_url=?, contact_channel=?, contact_info=?,
     cooperation_type=?, commission_rate=?, product_id=?, sample_qty=?, sample_cost=?, contact_date=?, send_date=?, receive_date=?,
     material_schedule=?, material_url=?, remark=?, status=?, name=?, contact=?
     WHERE id=?`
  ).run(
    shop_id ?? existing.shop_id,
    influencer_id ?? existing.influencer_id,
    profile_url ?? existing.profile_url,
    contact_channel ?? existing.contact_channel,
    contact_info ?? existing.contact_info,
    cooperation_type ?? existing.cooperation_type,
    rate,
    product_id ?? existing.product_id,
    sample_qty ?? existing.sample_qty,
    sample_cost,
    contact_date ?? existing.contact_date,
    send_date ?? existing.send_date,
    receive_date ?? existing.receive_date,
    material_schedule ?? existing.material_schedule,
    material_url ?? existing.material_url,
    remark ?? existing.remark,
    status ?? existing.status ?? '未回复',
    influencer_id ?? existing.name,
    contact_info ?? existing.contact,
    req.params.id
  );
  res.json({ success: true, sample_cost, commission_rate: rate });
});

// ========== Delete ==========
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM influencers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════
//  TikTok 达人同步（从官方 SDK 拉取达人信息）
// ═══════════════════════════════════════════════

// POST /api/influencers/sync-from-tiktok — 从 TikTok Shop API 拉取达人资料
router.post('/sync-from-tiktok', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { shop_id } = req.body;

    // 获取店铺凭证
    const shop = db.prepare(`
      SELECT * FROM tiktok_shops WHERE id = ? AND access_token IS NOT NULL
    `).get(shop_id || 1) as any;

    if (!shop || !shop.access_token) {
      return res.status(400).json({ error: '店铺未授权，请先在店铺管理中授权 TikTok Shop' });
    }

    const appKey = shop.app_key || process.env.TIKTOK_APP_KEY || '';
    const appSecret = shop.app_secret || process.env.TIKTOK_APP_SECRET || '';
    if (!appKey || !appSecret) {
      return res.status(400).json({ error: '缺少 App Key / App Secret，请检查环境变量或店铺配置' });
    }

    const { TikTokAPI } = require('../services/tiktok-api');
    const api = new TikTokAPI({
      app_key: appKey,
      app_secret: appSecret,
      access_token: shop.access_token,
      shop_cipher: shop.shop_cipher || '',
      api_version: shop.api_version || '202309',
    });

    const profileResp = await api.getCreatorProfile();

    if (profileResp.code !== 0) {
      return res.status(400).json({
        error: profileResp.message || 'API 调用失败',
        detail: profileResp,
      });
    }

    const profile = profileResp.data;
    if (!profile || !profile.username) {
      return res.json({ success: true, synced: 0, message: '未获取到达人资料（该店铺可能未开通达人联盟）' });
    }

    // Upsert 到达人表
    const existing = db.prepare('SELECT id FROM influencers WHERE influencer_id = ?').get(profile.username) as any;
    const influencerData = {
      influencer_id: profile.username,
      name: profile.username,
      shop_id: shop_id || shop.id,
      contact_channel: 'TikTok API',
      status: '已回复',
      remark: JSON.stringify({
        creator_user_open_id: profile.creatorUserOpenId,
        register_region: profile.registerRegion,
        selection_region: profile.selectionRegion,
        seller_type: profile.sellerType,
        user_type: profile.userType,
        permissions: profile.permissions,
        avatar_url: profile.avatar?.url,
      }),
    };

    if (existing) {
      db.prepare(`
        UPDATE influencers SET name = ?, shop_id = ?, contact_channel = ?, status = ?, remark = ?
        WHERE id = ?
      `).run(influencerData.name, influencerData.shop_id, influencerData.contact_channel, influencerData.status, influencerData.remark, existing.id);
      res.json({ success: true, synced: 1, updated: true, profile: { username: profile.username, avatar_url: profile.avatar?.url } });
    } else {
      db.prepare(`
        INSERT INTO influencers (influencer_id, name, shop_id, contact_channel, status, remark)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(influencerData.influencer_id, influencerData.name, influencerData.shop_id, influencerData.contact_channel, influencerData.status, influencerData.remark);
      res.json({ success: true, synced: 1, created: true, profile: { username: profile.username, avatar_url: profile.avatar?.url } });
    }
  } catch (e: any) {
    console.error('[influencers] sync-from-tiktok 失败:', e.message);
    res.status(500).json({ error: e.message || '同步失败' });
  }
});

// POST /api/influencers/sync-affiliate-orders — 从 TikTok 拉取达人联盟订单
router.post('/sync-affiliate-orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { shop_id } = req.body;

    const shop = db.prepare(`
      SELECT * FROM tiktok_shops WHERE id = ? AND access_token IS NOT NULL
    `).get(shop_id || 1) as any;

    if (!shop || !shop.access_token) {
      return res.status(400).json({ error: '店铺未授权' });
    }

    const appKey = shop.app_key || process.env.TIKTOK_APP_KEY || '';
    const appSecret = shop.app_secret || process.env.TIKTOK_APP_SECRET || '';
    const { TikTokAPI } = require('../services/tiktok-api');
    const api = new TikTokAPI({
      app_key: appKey, app_secret: appSecret,
      access_token: shop.access_token,
      shop_cipher: shop.shop_cipher || '',
      api_version: shop.api_version || '202309',
    });

    let allOrders: any[] = [];
    let pageToken: string | undefined;
    const maxPages = 20;
    for (let i = 0; i < maxPages; i++) {
      const resp = await api.searchAffiliateOrders({ page_size: 50, page_token: pageToken });
      if (resp.code !== 0) break;
      const orders = resp.data?.orders || resp.data?.order_list || [];
      allOrders = allOrders.concat(orders);
      pageToken = resp.data?.next_page_token;
      if (!pageToken || orders.length === 0) break;
    }

    // 提取达人信息 & 更新订单中的 influencer_id
    let linkedCount = 0;
    const updateOrder = db.prepare('UPDATE orders SET influencer_id = ? WHERE order_no = ?');
    const upsertInf = db.prepare(`
      INSERT INTO influencers (influencer_id, name, shop_id, contact_channel, status)
      VALUES (?, ?, ?, 'TikTok API', '已完成')
      ON CONFLICT(influencer_id) DO NOTHING
    `);

    const infMap = new Map<string, number>();
    // 预加载已有达人
    (db.prepare('SELECT id, influencer_id FROM influencers').all() as any[]).forEach(i => infMap.set(i.influencer_id, i.id));

    for (const order of allOrders) {
      const creatorId = order.creator_id || order.creatorId || '';
      const orderId = order.order_id || order.orderId || '';
      if (!creatorId || !orderId) continue;

      let infId = infMap.get(creatorId);
      if (!infId) {
        upsertInf.run(creatorId, creatorId, shop_id || shop.id);
        infId = (db.prepare('SELECT id FROM influencers WHERE influencer_id = ?').get(creatorId) as any)?.id;
        if (infId) infMap.set(creatorId, infId);
      }
      if (infId) {
        updateOrder.run(infId, orderId);
        linkedCount++;
      }
    }

    res.json({ success: true, total_orders: allOrders.length, linked: linkedCount });
  } catch (e: any) {
    console.error('[influencers] sync-affiliate-orders 失败:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
