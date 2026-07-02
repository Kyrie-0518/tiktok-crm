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
  if (!shop.app_key || !shop.app_secret || !shop.access_token) {
    return { created: 0, updated: 0, errors: ['缺少 API 凭证 (app_key/app_secret/access_token)'] };
  }

  // 2. 初始化 API 客户端
  const api = new TikTokAPI({
    app_key: shop.app_key,
    app_secret: shop.app_secret,
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

      // 4. 写入/更新数据库
      for (const order of orders) {
        try {
          const saved = saveOrder(db, order, shopId);
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
    ? new Date(order.create_time * 1000).toISOString() 
    : (order.created_time || new Date().toISOString());
  const updateTime = order.update_time
    ? new Date(order.update_time * 1000).toISOString()
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
  const items = order.line_items || order.items || order.item_list || [];
  if (items.length === 0) return;

  // 先删除旧明细再重新插入
  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);

  const insert = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, sku, price, quantity, item_status, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of items) {
    const productName = item.product_name || item.name || '';
    const sku = item.sku_id || item.seller_sku || '';
    const price = parseFloat(item.sale_price || item.price || '0') || 0;
    const quantity = item.quantity || 1;
    const itemStatus = STATUS_MAP[item.status] || 'pending';
    const imageUrl = item.sku_image || item.image_url || '';

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

    insert.run(orderId, productId, productName, sku, price, quantity, itemStatus, imageUrl);
  }
}

/** 凭证连通性测试 */
export async function testApiConnection(shopId: number): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(shopId) as any;

  if (!shop || !shop.app_key || !shop.app_secret || !shop.access_token) {
    return { success: false, message: '缺少 API 凭证' };
  }

  const api = new TikTokAPI({
    app_key: shop.app_key,
    app_secret: shop.app_secret,
    access_token: shop.access_token,
    shop_cipher: shop.shop_cipher || '',
    api_version: shop.api_version || '202309',
  });

  try {
    // 拉订单列表第1页（1条）测试连通性
    const resp = await api.getOrderList({ page_size: 1 });
    const list = resp?.data?.orders || resp?.data?.order_list;
    if (Array.isArray(list)) {
      return { success: true, message: `连接成功，共 ${resp?.data?.total || list.length} 条订单可同步` };
    }
    return { success: true, message: '连接成功' };
  } catch (e: any) {
    return { success: false, message: `连接失败: ${e.message}` };
  }
}
