/**
 * TikTok Shop 订单同步服务
 * 负责从 TikTok API 拉取订单并写入本地数据库
 */
import getDb from '../db';
import { TikTokAPI } from './tiktok-api';

// 订单状态映射：TikTok API → 本地
const STATUS_MAP: Record<string, string> = {
  UNPAID: 'pending',
  AWAITING_SHIPMENT: 'pending',
  AWAITING_COLLECTION: 'processing',
  PARTIALLY_SHIPPING: 'processing',
  IN_TRANSIT: 'shipped',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// 物流状态映射
const LOGISTICS_MAP: Record<string, string> = {
  AWAITING_SHIPMENT: '待发货',
  AWAITING_COLLECTION: '待揽收',
  PARTIALLY_SHIPPING: '部分发货',
  IN_TRANSIT: '运输中',
  DELIVERED: '已签收',
  COMPLETED: '已完成',
};

/** 将秒级 Unix 时间戳转换为 UTC+8 的 ISO 字符串（马来西亚时区） */
function toUtc8(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const offset = 8 * 60 * 60 * 1000; // UTC+8
  return new Date(date.getTime() + offset).toISOString().replace('Z', '');
}

/** 同步指定店铺的订单 */
export async function syncShopOrders(shopId: number): Promise<{ created: number; updated: number; errors: string[] }> {
  const db = getDb();
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  // 1. 获取店铺凭证
  const shop = db.prepare(`
    SELECT * FROM tiktok_shops WHERE id = ? AND sync_enabled = 1
  `).get(shopId) as any;

  if (!shop) {
    return { created: 0, updated: 0, errors: ['店铺未启用同步或无凭证'] };
  }
  // 2. 初始化 API 客户端（优先使用店铺凭证，fallback 到环境变量）
  const appKey = shop.app_key || process.env.TIKTOK_APP_KEY || '';
  const appSecret = shop.app_secret || process.env.TIKTOK_APP_SECRET || '';
  if (!appKey || !appSecret || !shop.access_token) {
    return { created: 0, updated: 0, errors: ['缺少 API 凭证 (app_key/app_secret/access_token)，请重新授权或配置环境变量'] };
  }

  const api = new TikTokAPI({
    app_key: appKey,
    app_secret: appSecret,
    access_token: shop.access_token,
    shop_cipher: shop.shop_cipher || '',
    api_version: shop.api_version || '202309',
  });

  try {
    // 3. 获取订单列表（最近更新的）
    let pageToken: string | undefined;
    let totalFetched = 0;
    const maxPages = 10; // 最多拉 10 页，防止超时

    for (let page = 0; page < maxPages; page++) {
      const params: Record<string, any> = {
        page_size: 50,
        sort_by: 'update_time',
        sort_type: 'DESC',
      };
      if (pageToken) params.page_token = pageToken;

      // 获取上次同步时间，只拉更新过的订单
      if (shop.last_synced_at) {
        const lastSync = new Date(shop.last_synced_at);
        params.update_time_from = Math.floor(lastSync.getTime() / 1000);
      }

      const resp = await api.getOrderList(params);
      const orders = resp?.data?.orders || resp?.data?.order_list || [];

      if (orders.length === 0) break;

      // 4. 获取订单详情（含商品信息）并写入数据库
      for (const order of orders) {
        try {
          const orderId = order.id || order.order_id || '';
          let orderDetail = order;

          // TikTok /orders/search 列表只返回概要，商品信息需要获取详情
          if (orderId) {
            try {
              const detailResp = await api.getOrderDetail([orderId]);
              const detail = detailResp?.data?.orders?.[0] || detailResp?.data?.order_list?.[0];
              if (detail) {
                orderDetail = { ...order, ...detail, line_items: detail.order_lines || detail.line_items || detail.item_list || detail.items || order.line_items };
              }
            } catch (detailErr: any) {
              console.warn(`[order-sync] 获取订单 ${orderId} 详情失败: ${detailErr.message}`);
            }
          }

          const saved = saveOrder(db, orderDetail, shopId);
          if (saved === 'created') created++;
          else if (saved === 'updated') updated++;
        } catch (e: any) {
          errors.push(`订单 ${order.id || 'unknown'}: ${e.message}`);
        }
      }

      totalFetched += orders.length;
      pageToken = resp?.data?.next_page_token;
      if (!pageToken) break;
    }

    // 5. 更新同步时间
    db.prepare("UPDATE tiktok_shops SET last_synced_at = datetime('now') WHERE id = ?").run(shopId);

  } catch (e: any) {
    errors.push(`API 调用失败: ${e.message}`);
  }

  return { created, updated, errors };
}

/** 解析并保存单个订单到本地数据库 */
function saveOrder(db: any, order: any, shopId: number): 'created' | 'updated' | 'skipped' {
  const orderNo = order.id || order.order_id || '';
  if (!orderNo) return 'skipped';

  // 提取基本信息
  const buyerName = order.buyer_name || order.recipient_address?.name || '';
  const buyerPhone = order.buyer_phone || order.recipient_address?.phone || '';
  const status = STATUS_MAP[order.status] || 'pending';
  const logisticsStatus = LOGISTICS_MAP[order.status] || '';
  const trackingNo = order.tracking_number || order.package_info?.tracking_number || '';
  const carrier = order.shipping_provider_name || order.package_info?.carrier || '';
  const actualAmount = parseFloat(order.total_amount || order.payment?.total_amount || '0') || 0;
  const currency = order.currency || 'MYR';
  const orderTime = order.create_time 
    ? toUtc8(order.create_time)
    : (order.created_time || new Date().toISOString().replace('Z', ''));
  const updateTime = order.update_time
    ? toUtc8(order.update_time)
    : orderTime;

  // 收款状态
  let paymentStatus = 'unpaid';
  if (order.payment_status === 'PAID' || order.payment?.status === 'PAID') paymentStatus = 'paid';
  else if (order.payment_status === 'PARTIAL_PAID') paymentStatus = 'partial';

  // 检查是否已存在
  const existing = db.prepare('SELECT id, status, actual_amount FROM orders WHERE order_no = ?').get(orderNo) as any;

  if (existing) {
    // 更新
    db.prepare(`
      UPDATE orders SET
        shop_id = ?, buyer_name = ?, buyer_phone = ?, status = ?,
        payment_status = ?, logistics_status = ?, tracking_no = ?, carrier = ?,
        actual_amount = ?, currency = ?, order_time = ?, updated_at = ?
      WHERE id = ?
    `).run(
      shopId, buyerName, buyerPhone, status,
      paymentStatus, logisticsStatus, trackingNo, carrier,
      actualAmount, currency, orderTime, updateTime,
      existing.id
    );

    // 更新 order_items
    saveOrderItems(db, existing.id, order);

    return 'updated';
  } else {
    // 创建新订单
    const result = db.prepare(`
      INSERT INTO orders (order_no, shop_id, buyer_name, buyer_phone, status,
        payment_status, logistics_status, tracking_no, carrier,
        actual_amount, currency, order_time, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderNo, shopId, buyerName, buyerPhone, status,
      paymentStatus, logisticsStatus, trackingNo, carrier,
      actualAmount, currency, orderTime, orderTime, updateTime
    );

    // 保存订单明细
    saveOrderItems(db, result.lastInsertRowid as number, order);

    return 'created';
  }
}

/** 保存订单明细（order_items） */
function saveOrderItems(db: any, orderId: number, order: any) {
  const items = order.order_lines || order.line_items || order.items || order.item_list || [];
  if (items.length === 0) {
    console.warn(`[saveOrderItems] 订单 ${orderId} 没有商品信息，原始字段:`, Object.keys(order).filter(k => k.includes('item') || k.includes('sku') || k.includes('product')));
    return;
  }

  // 先删除旧明细再重新插入
  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);

  const insert = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price, quantity, subtotal, item_status, image_url, spec_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of items) {
    const productName = item.product_name || item.productName || item.name || '';
    const sku = item.sku_id || item.skuId || item.seller_sku || item.sellerSku || '';
    const unitPrice = parseFloat(item.sale_price || item.salePrice || item.price || '0') || 0;
    const quantity = item.quantity || item.qty || 1;
    const subtotal = unitPrice * quantity;
    const itemStatus = STATUS_MAP[item.status] || STATUS_MAP[item.display_status] || 'pending';
    const imageUrl = item.sku_image || item.skuImage || item.image_url || item.imageUrl || '';
    const specName = item.sku_name || item.skuName || item.seller_sku || item.sellerSku || '';

    // 尝试匹配本地产品
    let productId: number | null = null;
    if (sku) {
      const localSku = db.prepare('SELECT product_id FROM product_skus WHERE sku = ? LIMIT 1').get(sku) as any;
      if (localSku) productId = localSku.product_id;
    }
    if (!productId && productName) {
      const localProduct = db.prepare('SELECT id FROM products WHERE name LIKE ? LIMIT 1').get(`%${productName}%`) as any;
      if (localProduct) productId = localProduct.id;
    }

    insert.run(orderId, productId, productName, sku, unitPrice, quantity, subtotal, itemStatus, imageUrl, specName);
  }
}

/** 凭证连通性测试 */
export async function testApiConnection(shopId: number): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(shopId) as any;

  if (!shop || !shop.access_token) {
    return { success: false, message: '缺少 access_token，请重新授权店铺' };
  }
  if (!shop.app_key && !process.env.TIKTOK_APP_KEY) {
    return { success: false, message: '缺少 App Key，请在环境变量中配置 TIKTOK_APP_KEY' };
  }

  // 如果数据库没有 shop_cipher，尝试自动补全
  if (!shop.shop_cipher && shop.access_token) {
    console.log('[testApiConnection] shop_cipher 为空，尝试从 TikTok API 获取...');
    try {
      const { getAuthorizedShops } = require('../services/tiktok-oauth');
      const shops = await getAuthorizedShops(shop.access_token);
      if (shops.length > 0 && shops[0].cipher) {
        shop.shop_cipher = shops[0].cipher;
        db.prepare('UPDATE tiktok_shops SET shop_cipher = ? WHERE id = ?').run(shop.shop_cipher, shopId);
        console.log('[testApiConnection] ✅ 已获取并保存 shop_cipher');
      }
    } catch (e: any) {
      console.warn('[testApiConnection] ⚠️ 自动获取 shop_cipher 失败:', e.message);
    }
  }

  const appKey = shop.app_key || process.env.TIKTOK_APP_KEY || '';
  const appSecret = shop.app_secret || process.env.TIKTOK_APP_SECRET || '';
  const api = new TikTokAPI({
    app_key: appKey,
    app_secret: appSecret,
    access_token: shop.access_token,
    shop_cipher: shop.shop_cipher || '',
    api_version: shop.api_version || '202309',
  });

  const apiBase = process.env.TIKTOK_API_BASE || 'https://open-api.tiktokglobalshop.com';
  console.log('[testApiConnection] ==================== 测试连接 ====================');
  console.log('[testApiConnection] 店铺:', { id: shop.id, name: shop.name, shop_id: shop.shop_id });
  console.log('[testApiConnection] API Base:', apiBase);
  console.log('[testApiConnection] 凭证检测:');
  console.log('  access_token:', shop.access_token ? `✅ (${shop.access_token.slice(0, 8)}...)` : '❌ 缺失');
  console.log('  shop_cipher:', shop.shop_cipher ? `✅ (${shop.shop_cipher.slice(0, 8)}...)` : '❌ 缺失');
  console.log('  app_key:', appKey ? `✅ (${appKey.slice(0, 8)}...)` : '❌ 缺失');
  console.log('  api_version:', shop.api_version || '202309');

  try {
    // 拉订单列表第1页（1条）测试连通性
    const resp = await api.getOrderList({ page_size: 1 });
    console.log('[testApiConnection] ✅ 响应:', JSON.stringify(resp).slice(0, 300));
    const list = resp?.data?.orders || resp?.data?.order_list;
    if (Array.isArray(list)) {
      return { success: true, message: `连接成功，共 ${resp?.data?.total || list.length} 条订单可同步` };
    }
    return { success: true, message: '连接成功' };
  } catch (e: any) {
    console.error('[testApiConnection] ❌ TikTok API 连接失败');
    console.error('  message:', e.message);
    console.error('  name:', e.name);
    if (e.cause) {
      console.error('  cause:', e.cause);
      console.error('  cause.code:', e.cause?.code);
      console.error('  cause.message:', e.cause?.message);
    }
    if (e.stack) console.error('  stack:', e.stack.split('\n').slice(0, 4).join('\n'));
    
    return { success: false, message: `连接失败: ${e.message || JSON.stringify(e)}` };
  }
}
