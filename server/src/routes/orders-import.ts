/**
 * AI 导入订单接口
 * POST /api/orders/ai-import/parse   — 上传文件 + AI 解析，返回预览数据
 * POST /api/orders/ai-import/commit  — 确认导入，写入数据库
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import getDb from '../db';
import authMiddleware, { JwtPayload } from '../middleware/auth';

const router = Router();

// ---- multer: 临时文件存到 data/tmp ----
const TMP_DIR = path.join(__dirname, '..', '..', 'data', 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('仅支持 .xlsx 或 .csv 格式'));
  },
});

// ---- TikTok 订单状态映射（英文 → 系统内码）----
const TIKTOK_STATUS_MAP: Record<string, string> = {
  'unpaid': 'pending',
  'awaiting payment': 'pending',
  'pending payment': 'pending',
  'to pay': 'pending',
  'awaiting shipment': 'pending_ship',
  'to ship': 'pending_ship',
  'processing': 'pending_ship',
  'shipped': 'shipped',
  'in transit': 'shipped',
  'delivered': 'completed',
  'completed': 'completed',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'cancel requested': 'cancel_requested',
  'refund requested': 'refund_requested',
  'refunded': 'refunded',
  'auto cancelled': 'auto_cancelled',
  'auto canceled': 'auto_cancelled',
  // 中文兜底
  '待支付': 'pending',
  '待发货': 'pending_ship',
  '已发货': 'shipped',
  '已完成': 'completed',
  '已取消': 'cancelled',
  '申请取消': 'cancel_requested',
  '申请退款': 'refund_requested',
  '已退款': 'refunded',
  '自动取消': 'auto_cancelled',
};

function normalizeStatus(raw: string): string {
  if (!raw) return 'pending';
  const key = raw.trim().toLowerCase();
  // 先精确匹配
  if (TIKTOK_STATUS_MAP[key]) return TIKTOK_STATUS_MAP[key];
  if (TIKTOK_STATUS_MAP[raw.trim()]) return TIKTOK_STATUS_MAP[raw.trim()];
  // 模糊匹配（子状态词如 "运输中" → shipped）
  if (/运输中|in transit|in_transit/.test(key)) return 'shipped';
  if (/待发货|pending_ship|to ship|awaiting shipment/.test(key)) return 'pending_ship';
  if (/待支付|unpaid|awaiting payment|pending payment/.test(key)) return 'pending';
  if (/已取消|cancelled|canceled/.test(key)) return 'cancelled';
  if (/已完成|completed|delivered/.test(key)) return 'completed';
  return 'pending';
}

// ---- 读取 Excel/CSV 为二维数组 ----
async function readSheet(filePath: string, originalName: string): Promise<{ headers: string[]; rows: any[][] }> {
  const ext = path.extname(originalName).toLowerCase();

  let allRows: any[][];

  if (ext === '.csv') {
    // CSV: 用 xlsx 库读取
    const wb = XLSX.readFile(filePath, { type: 'string' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
  } else {
    // XLSX: 用 xlsx (SheetJS) 读取，兼容性优于 exceljs
    const wb = XLSX.readFile(filePath);
    if (wb.SheetNames.length > 1) {
      throw new Error('MULTI_SHEET');
    }
    const ws = wb.Sheets[wb.SheetNames[0]];
    allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
  }

  if (allRows.length < 2) throw new Error('文件至少需要包含表头和一行数据');

  const headers = allRows[0].map((h: any) => String(h ?? '').trim());
  let dataRows = allRows.slice(1);

  // TikTok Shop 导出的 Excel 第二行是英文说明行（如 "Platform unique order ID."）
  // 检测特征：第一个非空单元格以大写字母开头 + 以句号结尾，视为说明行并跳过
  if (dataRows.length > 0) {
    const firstDataRow = dataRows[0];
    const firstNonEmpty = firstDataRow.find((c: any) => c !== null && c !== undefined && String(c).trim() !== '');
    if (firstNonEmpty && typeof firstNonEmpty === 'string' && /^[A-Z]/.test(firstNonEmpty) && /\.$/.test(firstNonEmpty.trim())) {
      dataRows = dataRows.slice(1);
    }
  }

  // 过滤完全空的行
  dataRows = dataRows.filter(row => row.some((c: any) => c !== null && c !== undefined && String(c).trim() !== ''));

  return { headers, dataRows };
}

// ---- 调用 AI 进行字段映射 ----
async function aiMapHeaders(headers: string[], db: any): Promise<Record<string, string>> {
  const configRow = db.prepare("SELECT value FROM settings WHERE key = ?").get('ai_config') as any;
  if (!configRow) throw new Error('请先在系统设置中配置 AI API Key');

  let api_key = '', api_base = 'https://api.deepseek.com/v1', model = 'deepseek-chat';
  try {
    const cfg = JSON.parse(configRow.value);
    api_key = cfg.api_key || '';
    api_base = cfg.api_base || api_base;
    model = cfg.model || model;
  } catch {}
  if (!api_key) throw new Error('请先在系统设置中配置 AI API Key');

  const systemFields = [
    'order_no(订单号)', 'order_time(下单时间)', 'buyer_name(买家名称)', 'buyer_phone(买家联系方式)',
    'status(订单状态)', 'payment_status(支付状态)', 'tracking_no(物流单号)', 'carrier(承运商)',
    'logistics_status(物流状态)', 'item_total(商品合计金额)', 'shipping_fee(运费)',
    'discount(优惠金额)', 'taxes(税费)', 'actual_amount(实付金额)', 'remark(备注)',
    'product_name(商品名称)', 'sku(SKU编码)', 'spec_name(规格)', 'quantity(数量)',
    'unit_price(单价)',
  ];

  const prompt = `你是TikTok Shop商家后台订单Excel表头映射专家。
用户上传了TikTok Shop后台导出的订单Excel（可能中英混合），表头列名如下：
${headers.map((h, i) => `${i + 1}. "${h}"`).join('\n')}

请将每个表头映射到以下系统标准字段（如不能匹配则映射为空字符串""）：
${systemFields.join(', ')}

TikTok Shop 常见表头参考（英文导出版）：
- "Order ID" → order_no
- "Created Time" 或 "Create Time" → order_time
- "Paid Time" → order_time（如有Created Time则优先用Created Time）
- "Order Status" → status
- "Order Substatus" → logistics_status
- "Product Name" → product_name
- "Variation" → sku 【重要：这是规格名称，用于匹配产品成本价】
- "Seller SKU" → seller_sku（商家原始SKU编码，存储但不用于成本匹配）
- "Quantity" → quantity
- "SKU Unit Original Price" → unit_price
- "Order Amount" → actual_amount
- "Taxes" / "Tax Amount" → taxes
- "SKU Subtotal After Discount" → item_total
- "Shipping Fee After Discount" → shipping_fee
- "SKU Platform Discount" / "SKU Seller Discount" / "Payment platform discount" → discount（合并映射）
- "Tracking ID" → tracking_no
- "Shipping Provider Name" → carrier
- "Buyer Username" → buyer_name
- "Phone #" → buyer_phone
- "Seller Note" → remark
- "Cancel Reason" / "Cancel By" / "Cancelation/Return Type" → remark（辅助信息）
- "RTS Time" / "Shipped Time" / "Delivered Time" 等时间字段无需映射

注意：
- order_no 是最重要的字段，必须匹配
- 【最重要】sku 字段用于匹配产品成本价！必须使用 "Variation"（规格名称），不是 "Seller SKU"
- product_name/sku/quantity/unit_price 是商品明细字段
- 一个订单可能有多行商品（多SKU行），请识别商品明细相关列
- TikTok Shop 导出可能含说明行（第二行），已被自动跳过
- 直接返回 JSON 对象，key=原始表头，value=系统字段名。不要包含任何解释，只返回JSON。

示例输出：
{"Order ID": "order_no", "Created Time": "order_time", "Product Name": "product_name", "Variation": "sku", "Seller SKU": "seller_sku", "Quantity": "quantity", "Order Amount": "actual_amount", "Order Status": "status", "Tracking ID": "tracking_no", "Shipping Provider Name": "carrier", "Buyer Username": "buyer_name", "Phone #": "buyer_phone", "Seller Note": "remark", "Taxes": "taxes", "Shipping Fee After Discount": "shipping_fee"}`;

  const response = await fetch(`${api_base.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`AI 调用失败 (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json() as any;
  const content: string = data.choices?.[0]?.message?.content || '{}';

  // 提取 JSON（可能被 markdown 代码块包裹）
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 返回格式异常，无法解析字段映射');

  return JSON.parse(jsonMatch[0]);
}

// ---- 将原始行数据按映射转换为订单结构 ----
function buildOrders(
  headers: string[],
  dataRows: any[][],
  mapping: Record<string, string>
): { orders: any[]; errors: { row: number; reason: string }[] } {
  // header index map
  const colIdx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const sysField = mapping[h];
    if (sysField) colIdx[sysField] = i;
  });

  // Group rows by order_no (one order may span multiple rows for multi-product)
  const orderMap = new Map<string, any>();
  const errors: { row: number; reason: string }[] = [];

  dataRows.forEach((row, ri) => {
    const rowNum = ri + 2; // 1-based, header is row 1

    const get = (field: string) => {
      const idx = colIdx[field];
      if (idx === undefined) return '';
      const v = row[idx];
      if (v === null || v === undefined) return '';
      return String(v).trim();
    };

    const getNum = (field: string) => {
      const v = get(field);
      const n = parseFloat(v.replace(/[^\d.\-]/g, ''));
      return isNaN(n) ? null : n;
    };

    // Skip completely empty rows
    const rowStr = row.map(c => String(c ?? '')).join('').trim();
    if (!rowStr) return;

    const order_no = get('order_no');
    if (!order_no) {
      errors.push({ row: rowNum, reason: '订单号为空，已跳过' });
      return;
    }

    const product_name = get('product_name');
    const sku = get('sku');
    const spec_name = get('spec_name');
    const quantityRaw = get('quantity');
    const quantity = quantityRaw ? parseInt(quantityRaw) : 1;
    const unit_price = getNum('unit_price') ?? 0;

    if (isNaN(quantity) || quantity < 1) {
      errors.push({ row: rowNum, reason: `订单 ${order_no} 商品数量非法 (${quantityRaw})，该行商品已跳过` });
    }

    const subtotal = unit_price * (isNaN(quantity) ? 1 : quantity);

    // Build/merge order
    if (!orderMap.has(order_no)) {
      const actual_amount_raw = getNum('actual_amount');
      const item_total_raw = getNum('item_total');
      const shipping_fee_raw = getNum('shipping_fee');
      const discount_raw = getNum('discount');
      const taxes_raw = getNum('taxes');

      // Validate amounts
      if (actual_amount_raw !== null && isNaN(actual_amount_raw)) {
        errors.push({ row: rowNum, reason: `订单 ${order_no} 实付金额格式异常，已用0代替` });
      }

      const order: any = {
        order_no,
        order_time: get('order_time') || new Date().toISOString(),
        buyer_name: get('buyer_name'),
        buyer_phone: get('buyer_phone'),
        status: normalizeStatus(get('status')),
        payment_status: get('payment_status') || 'unpaid',
        tracking_no: get('tracking_no'),
        carrier: get('carrier'),
        logistics_status: get('logistics_status'),
        actual_amount: actual_amount_raw ?? 0,
        item_total: item_total_raw ?? 0,
        shipping_fee: shipping_fee_raw ?? 0,
        discount: discount_raw ?? 0,
        taxes: taxes_raw ?? 0,
        remark: get('remark'),
        items: [],
      };
      orderMap.set(order_no, order);
    }

    // Append item to order
    if (product_name || sku) {
      orderMap.get(order_no)!.items.push({
        product_name,
        sku,
        spec_name,
        quantity: isNaN(quantity) ? 1 : quantity,
        unit_price,
        subtotal,
      });
    }
  });

  // Final pass: if item_total is 0 but items exist, compute it
  for (const order of orderMap.values()) {
    if (!order.item_total && order.items.length) {
      order.item_total = order.items.reduce((s: number, it: any) => s + (it.subtotal || 0), 0);
    }
    if (!order.actual_amount && order.item_total) {
      order.actual_amount = order.item_total + (order.shipping_fee || 0) - (order.discount || 0);
    }
  }

  return { orders: Array.from(orderMap.values()), errors };
}

// ---- 写导入日志 ----
function writeImportLog(db: any, userId: number, total: number, success: number, overwrite: number, fail: number, errors: any[]) {
  // 确保日志表存在
  db.exec(`CREATE TABLE IF NOT EXISTS order_import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_rows INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    overwrite_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    errors TEXT DEFAULT '[]'
  )`);
  db.prepare(`INSERT INTO order_import_logs (user_id, total_rows, success_count, overwrite_count, fail_count, errors)
    VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, total, success, overwrite, fail, JSON.stringify(errors));
}

// ========== ROUTE 1: 解析文件，返回预览 ==========
// POST /api/orders/ai-import/parse
router.post('/parse', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: '请上传文件' });
    return;
  }

  const cleanup = () => {
    try { fs.unlinkSync(file.path); } catch {}
  };

  try {
    const originalName = file.originalname;

    // 读取工作表
    let headers: string[], dataRows: any[][];
    try {
      const result = await readSheet(file.path, originalName) as any;
      headers = result.headers;
      dataRows = result.dataRows;
    } catch (e: any) {
      cleanup();
      if (e.message === 'MULTI_SHEET') {
        res.status(400).json({ error: '暂不支持多工作表文件，请上传单Sheet订单表' });
      } else {
        res.status(400).json({ error: e.message || '文件解析失败' });
      }
      return;
    }

    // AI 字段映射
    const db = getDb();
    let mapping: Record<string, string>;
    try {
      mapping = await aiMapHeaders(headers, db);
    } catch (e: any) {
      cleanup();
      res.status(400).json({ error: e.message || 'AI 解析失败' });
      return;
    }

    // 构建订单数据
    const { orders, errors } = buildOrders(headers, dataRows, mapping);

    cleanup();

    // 返回预览（前50条订单，完整 headers + mapping）
    const preview = orders.slice(0, 50).map(o => ({
      order_no: o.order_no,
      order_time: o.order_time,
      buyer_name: o.buyer_name,
      status: o.status,
      actual_amount: o.actual_amount,
      item_total: o.item_total,
      items: o.items.slice(0, 3),
      item_count: o.items.length,
    }));

    res.json({
      total_orders: orders.length,
      preview,
      headers,
      mapping,
      errors,
      // 完整数据 token（存服务端 session 性能太重，直接回传给前端，commit 时原样发回）
      // 为了安全，实际把完整 orders 数据放在响应里让前端暂存
      orders, // 前端 commit 时带上这份数据
    });
  } catch (e: any) {
    cleanup();
    res.status(500).json({ error: e.message || '解析失败' });
  }
});

// ========== ROUTE 2: 确认导入 ==========
// POST /api/orders/ai-import/commit
router.post('/commit', authMiddleware, async (req: Request, res: Response) => {
  const { orders, shop_id } = req.body as { orders: any[]; shop_id?: number };
  if (!Array.isArray(orders) || orders.length === 0) {
    res.status(400).json({ error: '没有可导入的订单数据' });
    return;
  }

  const db = getDb();
  const user = req.user as JwtPayload;
  const userId = user.userId;

  let success = 0, overwrite = 0;
  const commitErrors: { order_no: string; reason: string }[] = [];

  // 预加载产品表（sku → product）用于自动关联
  const allProducts = db.prepare('SELECT id, name, sku, cost_price, sell_price, stock FROM products').all() as any[];
  // 预加载 product_skus 用于 SKU 维度匹配和库存扣减
  const allSkus = db.prepare('SELECT id, product_id, sku_code, spec_name, cost_price, sell_price, stock FROM product_skus').all() as any[];
  const productBySku = new Map<string, any>();
  const productByName = new Map<string, any>();
  const skuBySkuCode = new Map<string, any>();   // sku_code → sku record
  const skuBySpecName = new Map<string, any[]>(); // product_id → [sku, ...] for spec_name matching
  allProducts.forEach(p => {
    if (p.sku) productBySku.set(p.sku.toLowerCase(), p);
    if (p.name) productByName.set(p.name.toLowerCase(), p);
  });
  allSkus.forEach((s: any) => {
    if (s.sku_code) skuBySkuCode.set(s.sku_code.toLowerCase(), s);
    if (!skuBySpecName.has(String(s.product_id))) skuBySpecName.set(String(s.product_id), []);
    skuBySpecName.get(String(s.product_id)).push(s);
  });

  const importTx = db.transaction(() => {
    for (const order of orders) {
      const { order_no, order_time, buyer_name, buyer_phone, status, payment_status,
              tracking_no, carrier, logistics_status, actual_amount, item_total,
              shipping_fee, discount, taxes, remark, items = [] } = order;

      if (!order_no) continue;

      const trimmedOrderNo = String(order_no).trim();

      try {
        // 匹配 shop_id
        const resolvedShopId = shop_id || null;

        // Check if exists (trim both sides for robust matching)
        const existing = db.prepare('SELECT id, status FROM orders WHERE TRIM(order_no) = ?').get(trimmedOrderNo) as any;

        let orderId: number;
        const isCancelled = status === 'cancelled' || status === 'refunded' || status === 'auto_cancelled';
        const wasActiveNowCancelled = existing &&
          !['cancelled', 'refunded', 'auto_cancelled'].includes(existing.status) &&
          isCancelled;
        const wasActiveBefore = existing &&
          ['cancelled', 'refunded', 'auto_cancelled'].includes(existing.status) &&
          !isCancelled;

        if (existing) {
          // 覆盖更新
          db.prepare(`UPDATE orders SET
            shop_id = COALESCE(?, shop_id),
            buyer_name = ?, buyer_phone = ?, status = ?,
            payment_status = ?, tracking_no = ?, carrier = ?,
            logistics_status = ?, actual_amount = ?, item_total = ?,
            shipping_fee = ?, discount = ?, taxes = ?, remark = ?,
            order_time = ?,
            order_no = ?
            WHERE id = ?
          `).run(
            resolvedShopId, buyer_name || '', buyer_phone || '', status || 'pending',
            payment_status || 'unpaid', tracking_no || '', carrier || '',
            logistics_status || '', actual_amount || 0, item_total || 0,
            shipping_fee || 0, discount || 0, taxes || 0, remark || '',
            order_time || new Date().toISOString(),
            trimmedOrderNo,
            existing.id,
          );
          orderId = existing.id;

          // 库存回补：之前正常 → 现在取消（SKU维度）
          if (wasActiveNowCancelled) {
            const oldItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
            for (const it of oldItems) {
              if (it.product_sku_id) {
                db.prepare('UPDATE product_skus SET stock = stock + ? WHERE id = ?').run(it.quantity, it.product_sku_id);
              } else if (it.product_id) {
                // 旧数据兼容：没有 product_sku_id 的，回补到该产品第一个SKU
                const fallbackSku = db.prepare('SELECT id FROM product_skus WHERE product_id = ? LIMIT 1').get(it.product_id) as any;
                if (fallbackSku) {
                  db.prepare('UPDATE product_skus SET stock = stock + ? WHERE id = ?').run(it.quantity, fallbackSku.id);
                }
              }
            }
          }

          // 删除旧 items，重新插入
          db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
          overwrite++;
        } else {
          // 新增
          const result = db.prepare(`INSERT INTO orders
            (order_no, shop_id, buyer_name, buyer_phone, status, payment_status,
             tracking_no, carrier, logistics_status, actual_amount, item_total,
             shipping_fee, discount, taxes, remark, order_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            trimmedOrderNo, resolvedShopId, buyer_name || '', buyer_phone || '',
            status || 'pending', payment_status || 'unpaid',
            tracking_no || '', carrier || '', logistics_status || '',
            actual_amount || 0, item_total || 0,
            shipping_fee || 0, discount || 0, taxes || 0, remark || '',
            order_time || new Date().toISOString(),
          );
          orderId = result.lastInsertRowid as number;
          success++;
        }

        // 插入 order_items + 自动关联产品 + 库存联动
        const insertItem = db.prepare(`INSERT INTO order_items
          (order_id, product_id, product_sku_id, sku, product_name, spec_name, quantity, unit_price, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        for (const item of items) {
          // 自动匹配产品 → SKU（多级匹配）
          let matchedSku: any = null;
          let productId: number | null = null;

          // 优先1: 按 product_skus.sku_code 匹配（TikTok Seller SKU）
          if (item.sku) matchedSku = skuBySkuCode.get(item.sku.toLowerCase());
          // 优先2: 按产品名匹配产品，再按 spec_name 匹配SKU
          if (!matchedSku && item.product_name) {
            const product = productByName.get(item.product_name.toLowerCase());
            if (product) {
              productId = product.id;
              const productSkus = skuBySpecName.get(String(productId)) || [];
              if (item.spec_name) {
                matchedSku = productSkus.find((s: any) => s.spec_name.toLowerCase() === (item.spec_name as string).toLowerCase());
              }
              // 如果没有 spec_name 或没匹配到，取第一个SKU
              if (!matchedSku && productSkus.length > 0) matchedSku = productSkus[0];
            }
          }
          // 优先3: 按 products.sku（旧数据兼容）
          if (!matchedSku && item.sku) {
            const product = productBySku.get(item.sku.toLowerCase());
            if (product) {
              productId = product.id;
              const productSkus = skuBySpecName.get(String(productId)) || [];
              if (productSkus.length > 0) matchedSku = productSkus[0];
            }
          }
          // 优先4: 按 products.name 匹配
          if (!matchedSku && item.product_name) {
            const product = productByName.get(item.product_name.toLowerCase());
            if (product) {
              productId = product.id;
              const productSkus = skuBySpecName.get(String(productId)) || [];
              if (productSkus.length > 0) matchedSku = productSkus[0];
            }
          }

          if (matchedSku) productId = matchedSku.product_id;
          const productSkuId = matchedSku?.id || null;

          insertItem.run(
            orderId, productId, productSkuId, item.sku || '', item.product_name || '',
            matchedSku?.spec_name || item.spec_name || '', item.quantity || 1,
            item.unit_price || 0, item.subtotal || 0,
          );

          // 库存扣减（SKU维度，仅新增且非取消状态 / 覆盖但之前是取消状态现恢复）
          if (productSkuId) {
            const shouldDeduct = !isCancelled && (!existing || wasActiveBefore);
            if (shouldDeduct) {
              db.prepare('UPDATE product_skus SET stock = MAX(0, stock - ?) WHERE id = ?')
                .run(item.quantity || 1, productSkuId);
            }
            if (wasActiveBefore) {
              db.prepare('UPDATE product_skus SET stock = MAX(0, stock - ?) WHERE id = ?')
                .run(item.quantity || 1, productSkuId);
            }
          }
        }

      } catch (e: any) {
        commitErrors.push({ order_no, reason: e.message || '未知错误' });
      }
    }
  });

  try {
    importTx();
  } catch (e: any) {
    res.status(500).json({ error: '导入事务执行失败: ' + e.message });
    return;
  }

  // 记录导入日志
  try {
    writeImportLog(db, userId, orders.length, success, overwrite,
      commitErrors.length, commitErrors);
  } catch {}

  res.json({
    success,
    overwrite,
    fail: commitErrors.length,
    errors: commitErrors,
    message: `导入完成：新增 ${success} 条，覆盖更新 ${overwrite} 条，失败 ${commitErrors.length} 条`,
  });
});

// ========== ROUTE 3: 查询导入日志 ==========
// GET /api/orders/ai-import/logs
router.get('/logs', authMiddleware, (_req: Request, res: Response) => {
  const db = getDb();
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS order_import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_rows INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      overwrite_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      errors TEXT DEFAULT '[]'
    )`);
    const logs = db.prepare(`
      SELECT l.*, u.username FROM order_import_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.imported_at DESC LIMIT 50
    `).all();
    res.json(logs);
  } catch {
    res.json([]);
  }
});

export default router;
