/**
 * Data Collector — 并行拉取所有 TikTok 数据源
 * 只负责拿数据，不做分析
 */
import { shopApi } from '../../routes/shops';
import getDb from '../../db';
import { UnifiedData, ShopSnapshot, ProductSnapshot, InventorySnapshot, PricingSnapshot, OrderSnapshot, AdSnapshot, LogisticsSnapshot, VideoSnapshot, ReviewSnapshot, TrafficSnapshot } from './types';

export async function collectAllData(shopCipher: string, days = 30): Promise<UnifiedData> {
  const startTime = new Date(Date.now() - days * 86400000).toISOString();
  const now = new Date().toISOString();

  // 并行拉取所有数据
  const [shop, products, inventory, pricing, orders, ads, logistics, videos, reviews, traffic]
    = await Promise.allSettled([
      collectShop(shopCipher),
      collectProducts(shopCipher),
      collectInventory(shopCipher),
      collectPricing(shopCipher),
      collectOrders(shopCipher, startTime, now),
      collectAds(shopCipher, days),
      collectLogistics(shopCipher, days),
      collectVideos(shopCipher, days),
      collectReviews(shopCipher, 50),
      collectTraffic(shopCipher, days),
    ]);

  const db = getDb();
  const shopName = db.prepare('SELECT shop_name FROM tiktok_shops WHERE shop_cipher = ?').get(shopCipher) as any;

  return {
    shop: (shop.status === 'fulfilled' ? shop.value : null) as ShopSnapshot,
    products: getValue(products, []),
    inventory: getValue(inventory, []),
    pricing: getValue(pricing, []),
    orders: getValue(orders, []),
    ads: getValue(ads, []),
    logistics: getValue(logistics, {} as LogisticsSnapshot),
    videos: getValue(videos, []),
    reviews: getValue(reviews, []),
    traffic: getValue(traffic, {} as TrafficSnapshot),
    meta: {
      total_products: getValue(products, []).length,
      total_orders: getValue(orders, []).length,
      total_ads: getValue(ads, []).length,
      total_videos: getValue(videos, []).length,
      collected_at: new Date().toISOString(),
      time_range_days: days,
    },
  };
}

function getValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

/* ══════════════════════════ 子采集器 ══════════════════════════ */

async function collectShop(cipher: string): Promise<ShopSnapshot> {
  const res = await shopApi.shopsGetShops({ shopCipher: cipher }) as any;
  const s = res?.[0] || {};
  return {
    shop_id: cipher,
    shop_name: s.shop_name || '',
    shop_type: s.type === '1' ? 'cross_border' : 'local',
    region: s.region || '',
    create_time: s.create_time || '',
    status: s.status || '',
  };
}

async function collectProducts(cipher: string): Promise<ProductSnapshot[]> {
  try {
    const res = await shopApi.searchProducts({ shopCipher: cipher, pageSize: 50 }) as any;
    return (res?.products || []).map((p: any) => ({
      product_id: p.id || p.product_id || '',
      spu_id: p.global_product_id || '',
      sku: p.skus?.[0]?.seller_sku || '',
      title: p.title || '',
      brand: p.brand_name || p.brand?.name || '',
      category: p.category_name || '',
      attributes: {},
      main_image: p.main_image?.url || p.main_images?.[0]?.url || '',
      images: (p.images || []).map((i: any) => i.url),
      video_url: p.video?.url || '',
      description: p.description || '',
      specs: p.skus?.map((s: any) => JSON.stringify(s.sales_attributes || {})).join(';') || '',
      status: p.status || '',
      create_time: p.create_time || '',
      price: parseFloat(p.skus?.[0]?.price?.amount || 0),
      original_price: parseFloat(p.price?.amount || 0),
      sku_price: parseFloat(p.skus?.[0]?.price?.amount || 0),
    }));
  } catch { return []; }
}

async function collectInventory(cipher: string): Promise<InventorySnapshot[]> {
  try {
    const res = await shopApi.globalProductsISInventoryUpdate?.({ shopCipher: cipher }) as any;
    return (res?.inventories || []).map((inv: any) => ({
      product_id: inv.product_id || '',
      total_stock: inv.total_quantity || 0,
      available_stock: inv.available_quantity || 0,
      overseas_stock: inv.warehouse_inventory?.overseas || 0,
      cross_border_stock: inv.warehouse_inventory?.cross_border || 0,
      warehouse_name: inv.warehouse_name || '',
      updated_at: inv.updated_time || '',
    }));
  } catch { return []; }
}

async function collectPricing(cipher: string): Promise<PricingSnapshot[]> {
  return [];
}

async function collectOrders(cipher: string, start: string, end: string): Promise<OrderSnapshot[]> {
  try {
    const res = await shopApi.searchOrders?.({
      shopCipher: cipher, startTime: start, endTime: end, pageSize: 100,
    }) as any;
    return (res?.orders || []).map((o: any) => ({
      order_id: o.order_id || '',
      status: o.order_status || '',
      product_id: o.line_items?.[0]?.product_id || '',
      sku: o.line_items?.[0]?.seller_sku || '',
      quantity: o.line_items?.[0]?.quantity || 1,
      payment_amount: parseFloat(o.payment?.total_amount || 0),
      discount_amount: parseFloat(o.payment?.discount_amount || 0),
      shipping_fee: parseFloat(o.payment?.shipping_fee || 0),
      buyer_region: o.delivery_address?.region || '',
      create_time: o.create_time || '',
      payment_time: o.payment?.payment_time || '',
      ship_time: o.shipping?.ship_time || '',
      delivery_time: o.shipping?.delivery_time || '',
      complete_time: o.complete_time || '',
      refund_status: o.return_refund_status || '',
      refund_reason: o.return_reason || '',
      cancel_reason: o.cancel_reason || '',
    }));
  } catch { return []; }
}

async function collectAds(cipher: string, days: number): Promise<AdSnapshot[]> {
  return [];
}

async function collectLogistics(cipher: string, days: number): Promise<LogisticsSnapshot> {
  return {
    warehouse_type: '', shipping_method: '', carrier: '',
    estimated_delivery: 0, actual_delivery: 0,
    avg_ship_time: 0, avg_delivery_time: 0, anomaly_rate: 0, cancel_rate: 0,
  };
}

async function collectVideos(cipher: string, days: number): Promise<VideoSnapshot[]> {
  return [];
}

async function collectReviews(cipher: string, limit: number): Promise<ReviewSnapshot[]> {
  return [];
}

async function collectTraffic(cipher: string, days: number): Promise<TrafficSnapshot> {
  return {
    total_impressions: 0, total_clicks: 0, ctr: 0, pv: 0, uv: 0,
    search_traffic: 0, recommend_traffic: 0, marketplace_traffic: 0,
    affiliate_traffic: 0, live_traffic: 0, ads_traffic: 0,
    external_traffic: 0, organic_traffic: 0, trend: 'stable',
  };
}
