/**
 * Data Collector — 并行拉取所有 TikTok 数据（全量实装）
 */
import { TikTokAPI } from '../tiktok-api';
import { getValidToken } from '../tiktok-oauth';
import getDb from '../../db';
import { UnifiedData, ShopSnapshot, ProductSnapshot, InventorySnapshot, PricingSnapshot, OrderSnapshot, AdSnapshot, LogisticsSnapshot, VideoSnapshot, ReviewSnapshot, TrafficSnapshot, Coupon, FlashSale } from './types';

const PAGE_SIZE = 50;

export async function collectAllData(shopCipher: string, days = 30): Promise<UnifiedData> {
  // 获取有效 token 和店铺信息（注意：getValidToken 需要的是 shop_id 主键，不是 cipher）
  const db = getDb();
  const shopRecord = db.prepare('SELECT * FROM tiktok_shops WHERE shop_cipher = ?').get(shopCipher) as any;
  const shopName = shopRecord?.shop_name || shopCipher;
  const token = shopRecord ? await getValidToken(shopRecord.id) : '';

  const auth = {
    app_key: shopRecord?.app_key || process.env.TIKTOK_APP_KEY || '',
    app_secret: shopRecord?.app_secret || process.env.TIKTOK_APP_SECRET || '',
    access_token: token,
    shop_id: shopRecord?.shop_id || '',
    shop_cipher: shopCipher,
    api_version: '202309',
  };
  const api = new TikTokAPI(auth);

  // 并行拉取所有数据
  const [shop, products, inventory, pricing, orders, ads, logistics, videos, reviews, traffic]
    = await Promise.allSettled([
      collectShop(api, shopCipher, shopName),
      collectProducts(api),
      collectInventory(api),
      collectPricing(api),
      collectOrders(api, days),
      collectAds(shopCipher, days || 7),
      collectLogistics(api),
      collectVideos(shopCipher, days),
      collectReviews(api),
      collectTraffic(shopCipher, days),
    ]);

  const prods = getValue(products, []);
  const ords = getValue(orders, []);
  const adsData = getValue(ads, []);
  const vids = getValue(videos, []);

  return {
    shop: getValue(shop, null as any),
    products: prods,
    inventory: getValue(inventory, []),
    pricing: getValue(pricing, []),
    orders: ords,
    ads: adsData,
    logistics: getValue(logistics, {} as LogisticsSnapshot),
    videos: vids,
    reviews: getValue(reviews, []),
    traffic: getValue(traffic, {} as TrafficSnapshot),
    meta: {
      total_products: prods.length,
      total_orders: ords.length,
      total_ads: adsData.length,
      total_videos: vids.length,
      collected_at: new Date().toISOString(),
      time_range_days: days,
    },
  };
}

function getValue<T>(r: PromiseSettledResult<T>, fb: T): T {
  return r.status === 'fulfilled' ? r.value : fb;
}

/* ══════════════════════════ 🏪 店铺 ══════════════════════════ */
async function collectShop(api: TikTokAPI, cipher: string, name: string): Promise<ShopSnapshot> {
  try {
    const res = await api.getShopInfo?.() as any;
    const s = res?.data || res || {};
    return {
      shop_id: cipher,
      shop_name: s.shop_name || name,
      shop_type: s.type === 1 ? 'cross_border' : s.type === 2 ? 'local' : (s.seller_type || ''),
      region: s.region || s.region_code || '',
      create_time: s.create_time || '',
      status: s.status || 'ACTIVE',
    };
  } catch { return { shop_id: cipher, shop_name: name, shop_type: '', region: '', create_time: '', status: '' }; }
}

/* ══════════════════════════ 📦 商品 ══════════════════════════ */
async function collectProducts(api: TikTokAPI): Promise<ProductSnapshot[]> {
  const results: ProductSnapshot[] = [];
  try {
    let pageToken: string | undefined;
    do {
      const res: any = await api.searchProducts({ page_size: PAGE_SIZE, page_token: pageToken, search_status: 'ALL' });
      const list = res?.data?.products || res?.products || [];
      for (const p of list) {
        const firstSku = p.skus?.[0] || {};
        results.push({
          product_id: p.id || p.product_id || '',
          spu_id: '',
          sku: firstSku.seller_sku || '',
          title: p.title || '',
          brand: p.brand_name || '',
          category: p.category_list?.map((c: any) => c.name).join(' > ') || '',
          attributes: {},
          main_image: p.main_image?.url || p.main_images?.[0]?.url || '',
          images: (p.images || []).map((i: any) => i.url).filter(Boolean).slice(0, 10),
          video_url: p.video?.url || '',
          description: p.description || '',
          specs: p.skus?.map((s: any) => s.sales_attributes?.map((a: any) => `${a.name}:${a.value}`).join(';')).join(' | ') || '',
          status: p.status || '',
          create_time: p.create_time || '',
          price: parseFloat(firstSku.price?.amount || firstSku.sale_price || 0),
          original_price: parseFloat(firstSku.original_price?.amount || p.price?.amount || 0),
          sku_price: parseFloat(firstSku.price?.amount || 0),
        });
      }
      pageToken = res?.data?.next_page_token || res?.next_page_token;
    } while (pageToken && results.length < 200);
  } catch (e: any) { console.warn('[Collector] products:', e.message); }
  return results;
}

/* ══════════════════════════ 📊 库存 ══════════════════════════ */
async function collectInventory(api: TikTokAPI): Promise<InventorySnapshot[]> {
  const results: InventorySnapshot[] = [];
  try {
    // 先用 SKU 仓库存接口
    for (const status of ['TO_BE_RESTOCK', 'ENOUGH', 'LOW_STOCK', 'OUT_OF_STOCK']) {
      let pageToken: string | undefined;
      try {
        do {
          const res: any = await api.searchInventory?.({ page_size: PAGE_SIZE, page_token: pageToken, search_status: status as any });
          const list = res?.data?.inventory_records || res?.data?.skus || res?.skus || [];
          for (const inv of list) {
            results.push({
              product_id: inv.product_id || '',
              total_stock: inv.total_available_quantity || inv.total_stock || 0,
              available_stock: inv.available_quantity || 0,
              overseas_stock: inv.warehouse_stocks?.find((w: any) => w.warehouse_type === 'OVERSEAS')?.available_quantity || 0,
              cross_border_stock: inv.warehouse_stocks?.find((w: any) => w.warehouse_type === 'CROSS_BORDER')?.available_quantity || 0,
              warehouse_name: inv.warehouse_name || 'default',
              updated_at: inv.update_time || '',
            });
          }
          pageToken = res?.data?.next_page_token || res?.next_page_token;
        } while (pageToken && results.length < 200);
      } catch { /* 某些状态可能无数据 */ }
    }
  } catch (e: any) { console.warn('[Collector] inventory:', e.message); }
  return results;
}

/* ══════════════════════════ 💰 价格 ══════════════════════════ */
async function collectPricing(api: TikTokAPI): Promise<PricingSnapshot[]> {
  const results: PricingSnapshot[] = [];
  try {
    let pageToken: string | undefined;
    do {
      const res: any = await api.searchProducts({ page_size: PAGE_SIZE, page_token: pageToken, search_status: 'ALL' });
      const list = res?.data?.products || res?.products || [];
      for (const p of list) {
        const firstSku = p.skus?.[0] || {};
        const price = parseFloat(firstSku.price?.amount || 0);
        const original = parseFloat(firstSku.original_price?.amount || p.price?.amount || price);
        results.push({
          product_id: p.id || '', price, original_price: original, sku_price: price,
          campaign_price: 0, affiliate_price: 0, platform_subsidy: 0,
          seller_coupons: [], platform_coupons: [], flash_sales: [],
          free_shipping: false,
          discount_rate: original > 0 ? Math.round((1 - price / original) * 100) : 0,
        });
      }
      pageToken = res?.data?.next_page_token || res?.next_page_token;
    } while (pageToken && results.length < 200);
  } catch (e: any) { console.warn('[Collector] pricing:', e.message); }
  return results;
}

/* ══════════════════════════ 📋 订单 ══════════════════════════ */
async function collectOrders(api: TikTokAPI, days: number): Promise<OrderSnapshot[]> {
  const results: OrderSnapshot[] = [];
  const since = Math.floor((Date.now() - days * 86400000) / 1000);
  try {
    let pageToken: string | undefined;
    do {
      const res: any = await api.getOrderList({ page_size: PAGE_SIZE, page_token: pageToken, update_time_from: since, sort_by: 'update_time', sort_type: 'DESC' });
      const list = res?.data?.orders || res?.orders || [];
      for (const o of list) {
        results.push({
          order_id: o.order_id || o.id || '',
          status: o.order_status || o.status || '',
          product_id: o.line_items?.[0]?.product_id || '',
          sku: o.line_items?.[0]?.seller_sku || '',
          quantity: o.line_items?.[0]?.quantity || 1,
          payment_amount: parseFloat(o.payment?.total_amount || o.payment_amount || 0),
          discount_amount: parseFloat(o.payment?.discount_amount || 0),
          shipping_fee: parseFloat(o.payment?.shipping_fee || 0),
          buyer_region: o.delivery_address?.region || o.recipient_address?.region || '',
          create_time: o.create_time || '',
          payment_time: o.payment?.payment_time || o.payment_time || '',
          ship_time: o.shipping?.ship_time || '',
          delivery_time: o.shipping?.delivery_time || '',
          complete_time: o.complete_time || o.update_time || '',
          refund_status: o.return_refund_status || '',
          refund_reason: o.return_reason || '',
          cancel_reason: o.cancel_reason || '',
        });
      }
      pageToken = res?.data?.next_page_token || res?.next_page_token;
    } while (pageToken && results.length < 500);
  } catch (e: any) { console.warn('[Collector] orders:', e.message); }
  return results;
}

/* ══════════════════════════ 📢 广告 ══════════════════════════ */
async function collectAds(shopCipher: string, days: number = 7): Promise<AdSnapshot[]> {
  // 直接调 TikTok Ads API（不走本地缓存，避免数据假/过时）
  try {
    const db = getDb();
    const adAcc = db.prepare("SELECT * FROM ad_accounts WHERE shop_id = ? AND status = 'enabled' LIMIT 1").get(shopCipher) as any;
    const advertiserId = adAcc?.advertiser_id || '';
    const token = adAcc?.access_token || '';
    const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id=${advertiserId}&report_type=BASIC&data_level=AUCTION_AD&dimensions=["campaign_id","adgroup_id"]&metrics=["spend","impressions","clicks","ctr","cpm","cpc","complete_payment","complete_payment_rate","cost_per_complete_payment"]&start_date=${startDate}&end_date=${endDate}&page_size=1000`;
    const { fetchWithProxy } = await import('../tiktok-api');
    const res: any = await fetchWithProxy(url, { method: 'GET', headers: { 'Access-Token': token } });
    const list = res?.data?.data?.list || res?.data?.list || [];
    const campaigns = db.prepare('SELECT campaign_id, campaign_name, status FROM ad_campaigns WHERE shop_id = ?').all(shopCipher) as any[];
    const cmpMap = new Map(campaigns.map((c: any) => [c.campaign_id, c]));
    return list.map((row: any) => {
      const cmp: any = cmpMap.get(row.campaign_id) || {};
      const m = row.metrics || {};
      return {
        campaign_id: row.campaign_id || '', campaign_name: cmp.campaign_name || '',
        adgroup_id: row.adgroup_id || '', adgroup_name: '',
        creative_id: '',
        status: cmp.status || '',
        budget: 0, spend: parseFloat(m.spend || 0),
        impressions: parseInt(m.impressions || 0),
        clicks: parseInt(m.clicks || 0),
        ctr: parseFloat(m.ctr || 0), cpm: parseFloat(m.cpm || 0),
        cpc: parseFloat(m.cpc || 0), cpa: parseFloat(m.cost_per_complete_payment || 0),
        cvr: parseFloat(m.complete_payment_rate || 0),
        orders: parseInt(m.complete_payment || 0),
        gmv: 0, roas: 0,
        learning_phase: '', review_status: '',
        start_time: startDate, end_time: endDate,
      };
    });
  } catch (e: any) { console.warn('[Collector] ads (live API failed):', e.message); return []; }
}

/* ══════════════════════════ 🚚 物流 ══════════════════════════ */
async function collectLogistics(api: TikTokAPI): Promise<LogisticsSnapshot> {
  try {
    const snap: LogisticsSnapshot = { warehouse_type: '', shipping_method: '', carrier: '', estimated_delivery: 0, actual_delivery: 0, avg_ship_time: 0, avg_delivery_time: 0, anomaly_rate: 0, cancel_rate: 0 };
    // 尝试获取物流商列表
    try {
      const providers = await api.getShippingProviders?.() as any;
      const p = providers?.data?.shipping_providers?.[0] || {};
      snap.shipping_method = p.name || '';
      snap.carrier = p.id || '';
    } catch { /* 非关键 */ }
    return snap;
  } catch (e: any) { console.warn('[Collector] logistics:', e.message); return { warehouse_type: '', shipping_method: '', carrier: '', estimated_delivery: 0, actual_delivery: 0, avg_ship_time: 0, avg_delivery_time: 0, anomaly_rate: 0, cancel_rate: 0 }; }
}

/* ══════════════════════════ 📈 视频表现 ══════════════════════════ */
async function collectVideos(shopCipher: string, days: number): Promise<VideoSnapshot[]> {
  try {
    const db = getDb();
    const vids = db.prepare('SELECT * FROM ai_videos WHERE shop_id = ? ORDER BY created_at DESC LIMIT 50').all(shopCipher) as any[];
    return (vids || []).map((v: any) => ({
      video_id: v.video_id || '', product_id: v.product_id || '',
      impressions: v.impressions || 0, views: v.views || 0,
      watch_3s_rate: v.watch_3s_rate || 0, watch_5s_rate: v.watch_5s_rate || 0,
      completion_rate: v.completion_rate || 0, avg_watch_time: v.avg_watch_time || 0,
      likes: v.likes || 0, comments: v.comments || 0, favorites: v.favorites || 0, shares: v.shares || 0,
      product_clicks: v.product_clicks || 0, ctr: v.ctr || 0,
      add_to_cart: v.add_to_cart || 0, cvr: v.cvr || 0,
      orders: v.orders || 0, gmv: v.gmv || 0,
    }));
  } catch (e: any) { console.warn('[Collector] videos:', e.message); return []; }
}

/* ══════════════════════════ ⭐ 评价 ══════════════════════════ */
async function collectReviews(api: TikTokAPI): Promise<ReviewSnapshot[]> {
  try {
    // TikTok customer service reviews
    const res: any = await (api as any).post?.('customer_service/reviews/search', { page_size: 50 }, { page_size: '50' });
    const list = res?.data?.reviews || res?.reviews || [];
    return list.map((r: any) => ({
      review_id: r.review_id || '', rating: r.rating || 0,
      content: r.content || '', images: r.images || [], videos: r.videos || [],
      create_time: r.create_time || '',
    }));
  } catch (e: any) {
    console.warn('[Collector] reviews:', e.message);
    return [];
  }
}

/* ══════════════════════════ 🔍 流量 ══════════════════════════ */
async function collectTraffic(shopCipher: string, days: number): Promise<TrafficSnapshot> {
  try {
    const db = getDb();
    // 从店铺 performance 表读取（如果有）
    const row = db.prepare('SELECT * FROM shop_performance WHERE shop_id = ? ORDER BY date DESC LIMIT 1').get(shopCipher) as any;
    if (row) {
      return {
        total_impressions: row.impressions || 0, total_clicks: row.clicks || 0,
        ctr: row.ctr || 0, pv: row.pv || 0, uv: row.uv || 0,
        search_traffic: row.search_traffic || 0, recommend_traffic: row.recommend_traffic || 0,
        marketplace_traffic: row.marketplace_traffic || 0, affiliate_traffic: row.affiliate_traffic || 0,
        live_traffic: row.live_traffic || 0, ads_traffic: row.ads_traffic || 0,
        external_traffic: row.external_traffic || 0, organic_traffic: row.organic_traffic || 0,
        trend: 'stable',
      };
    }
  } catch (e: any) { console.warn('[Collector] traffic:', e.message); }
  return { total_impressions: 0, total_clicks: 0, ctr: 0, pv: 0, uv: 0, search_traffic: 0, recommend_traffic: 0, marketplace_traffic: 0, affiliate_traffic: 0, live_traffic: 0, ads_traffic: 0, external_traffic: 0, organic_traffic: 0, trend: 'stable' };
}
