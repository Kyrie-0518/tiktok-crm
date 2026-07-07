/**
 * TikTok Shop 产品同步服务
 * 负责从 TikTok API 拉取产品数据并写入本地数据库
 * 支持：基础产品信息、品牌、类目、SKU、SEO、诊断等丰富数据
 */
import getDb from '../db';
import { TikTokAPI } from './tiktok-api';

/** 产品状态映射 */
const PRODUCT_STATUS_MAP: Record<string, string> = {
  DRAFT: 'draft',
  ACTIVATED: 'active',
  AUDIT: 'pending',
  FAILED_AUDIT: 'rejected',
  DEACTIVATED: 'inactive',
  FROZEN: 'frozen',
  DELETED: 'deleted',
};

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * 同步指定店铺的产品
 * @param shopId 店铺 ID
 * @param options.syncDetails 是否同步每条产品的详情（默认 true）
 * @returns 同步统计
 */
export async function syncShopProducts(
  shopId: number,
  options?: { syncDetails?: boolean },
): Promise<SyncResult> {
  const syncDetails = options?.syncDetails ?? true;
  const db = getDb();
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  // 1. 获取店铺凭证
  const shop = db.prepare(`
    SELECT * FROM tiktok_shops WHERE id = ? AND product_sync_enabled = 1
  `).get(shopId) as any;

  if (!shop) {
    return { created: 0, updated: 0, skipped: 0, errors: ['店铺未启用产品同步或无凭证'] };
  }
  if (!shop.access_token) {
    return { created: 0, updated: 0, skipped: 0, errors: ['缺少 access_token，请重新授权'] };
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

  const platform = 'tiktok';

  try {
    let pageToken: string | undefined;
    const maxPages = 20;

    for (let page = 0; page < maxPages; page++) {
      const params: Record<string, any> = {
        page_size: 100,
        sort_by: 'update_time',
        sort_type: 'DESC',
      };
      if (pageToken) params.page_token = pageToken;

      // 增量：只拉更新过的
      if (shop.last_synced_at) {
        params.update_time_from = Math.floor(new Date(shop.last_synced_at).getTime() / 1000);
      }

      const resp = await api.searchProducts(params);
      const productList = resp?.data?.products || resp?.data?.product_list || [];

      // DEBUG: 打印第一个产品的关键字段结构，用于排查字段名
      if (productList.length > 0 && page === 0) {
        const first = productList[0];
        console.log('[ProductSync] 首个产品字段:', {
          id: first.product_id || first.id,
          title: first.title || first.product_name,
          price_keys: first.price ? Object.keys(first.price) : null,
          stock_keys: first.stock_info ? Object.keys(first.stock_info) : null,
          image_keys: first.main_image ? Object.keys(first.main_image) : (Array.isArray(first.images) ? 'images[]' : null),
          has_image_list: Array.isArray(first.image_list),
          sku_count: Array.isArray(first.skus) ? first.skus.length : 0,
        });
      }

      if (productList.length === 0) break;

      for (const product of productList) {
        try {
          // 先保存基础信息
          const result = saveProduct(db, product, shopId, platform, shop.name);
          if (result === 'created') created++;
          else if (result === 'updated') updated++;
          else { skipped++; continue; }

          // 拉取详情丰富数据
          if (syncDetails) {
            const productId = product.product_id || product.id;
            try {
              const detailResp = await api.getProductDetail(String(productId));
              const detail = detailResp?.data;
              if (detail) {
                enrichProductData(db, productId, detail, platform);
              }
            } catch (detailErr: any) {
              // 详情获取失败不影响主流程，仅记录
              errors.push(`产品 ${productId} 详情获取失败: ${detailErr.message}`);
            }
          }
        } catch (e: any) {
          errors.push(`产品 ${product.product_id || product.id}: ${e.message}`);
        }
      }

      pageToken = resp?.data?.next_page_token;
      if (!pageToken) break;
    }

    // 更新产品同步时间
    db.prepare("UPDATE tiktok_shops SET last_synced_at = datetime('now') WHERE id = ?").run(shopId);

  } catch (e: any) {
    errors.push(`API 调用失败: ${e.message}`);
  }

  return { created, updated, skipped, errors };
}

/**
 * 同步单个产品详情（用于手动刷新单个产品）
 */
export async function syncSingleProduct(
  shopId: number,
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(shopId) as any;
  if (!shop?.access_token) return { success: false, error: '店铺无有效凭证' };

  const appKey = shop.app_key || process.env.TIKTOK_APP_KEY || '';
  const appSecret = shop.app_secret || process.env.TIKTOK_APP_SECRET || '';
  const api = new TikTokAPI({
    app_key: appKey,
    app_secret: appSecret,
    access_token: shop.access_token,
    shop_cipher: shop.shop_cipher || '',
    api_version: shop.api_version || '202309',
  });

  try {
    const resp = await api.getProductDetail(productId);
    const detail = resp?.data;
    if (!detail) return { success: false, error: 'API 返回空数据' };

    const platform = 'tiktok';
    const result = saveProduct(db, detail, shopId, platform);
    if (result === 'skipped') return { success: false, error: '产品数据无效' };

    enrichProductData(db, productId, detail, platform);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * 同步品牌数据到本地缓存表
 */
export async function syncBrands(
  shopId: number,
  params?: { category_id?: string; brand_name?: string },
): Promise<{ count: number; error?: string }> {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(shopId) as any;
  if (!shop?.access_token) return { count: 0, error: '店铺无有效凭证' };

  const appKey = shop.app_key || process.env.TIKTOK_APP_KEY || '';
  const appSecret = shop.app_secret || process.env.TIKTOK_APP_SECRET || '';
  const api = new TikTokAPI({
    app_key: appKey, app_secret: appSecret,
    access_token: shop.access_token,
    shop_cipher: shop.shop_cipher || '',
    api_version: '202309',
  });

  try {
    const resp = await api.getBrands({
      page_size: 100,
      category_id: params?.category_id,
      brand_name: params?.brand_name,
    });
    const brands = resp?.data?.brands || resp?.data?.brand_list || [];
    return { count: brands.length };
  } catch (e: any) {
    return { count: 0, error: e.message };
  }
}

/**
 * 同步类目数据
 */
export async function syncCategories(
  shopId: number,
  params?: { locale?: string; keyword?: string },
): Promise<{ count: number; error?: string }> {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(shopId) as any;
  if (!shop?.access_token) return { count: 0, error: '店铺无有效凭证' };

  const appKey = shop.app_key || process.env.TIKTOK_APP_KEY || '';
  const appSecret = shop.app_secret || process.env.TIKTOK_APP_SECRET || '';
  const api = new TikTokAPI({
    app_key: appKey, app_secret: appSecret,
    access_token: shop.access_token,
    shop_cipher: shop.shop_cipher || '',
    api_version: '202309',
  });

  try {
    const resp = await api.getCategories({
      locale: params?.locale,
      keyword: params?.keyword,
    });
    const categories = resp?.data?.categories || resp?.data?.category_list || [];
    return { count: categories.length };
  } catch (e: any) {
    return { count: 0, error: e.message };
  }
}

/**
 * 获取产品 SEO / 诊断数据
 */
export async function syncProductDiagnostics(
  shopId: number,
  productIds: string[],
): Promise<{ diagnoses?: any; seoWords?: any; suggestions?: any; error?: string }> {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(shopId) as any;
  if (!shop?.access_token) return { error: '店铺无有效凭证' };

  const appKey = shop.app_key || process.env.TIKTOK_APP_KEY || '';
  const appSecret = shop.app_secret || process.env.TIKTOK_APP_SECRET || '';
  const api = new TikTokAPI({
    app_key: appKey, app_secret: appSecret,
    access_token: shop.access_token,
    shop_cipher: shop.shop_cipher || '',
    api_version: '202405',
  });

  try {
    const [diagnoses, seoWords, suggestions] = await Promise.allSettled([
      api.getProductDiagnoses(productIds),
      api.getProductSeoWords(productIds),
      api.getProductSuggestions(productIds),
    ]);

    return {
      diagnoses: diagnoses.status === 'fulfilled' ? diagnoses.value : null,
      seoWords: seoWords.status === 'fulfilled' ? seoWords.value : null,
      suggestions: suggestions.status === 'fulfilled' ? suggestions.value : null,
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ═══════════════════════════════════════════════
//  内部辅助函数
// ═══════════════════════════════════════════════

/**
 * 保存单个 TikTok 产品到本地数据库（基础信息）
 */
function saveProduct(
  db: any,
  product: any,
  shopId: number,
  platform: string,
  shopName?: string,
): 'created' | 'updated' | 'skipped' {
  const sourcePid = String(product.product_id || product.id || '').trim();
  if (!sourcePid) return 'skipped';

  const name = product.title || product.product_name || product.name || '';
  if (!name) return 'skipped';

  const status = PRODUCT_STATUS_MAP[product.status] || 'active';
  const sellPrice = parseFloat(product.price?.sale_price || product.sale_price || '0') || 0;
  const originalPrice = parseFloat(product.price?.original_price || product.original_price || String(sellPrice)) || sellPrice;
  const stock = (product.stock_info?.stock_num ?? product.stock_info?.available_stock ?? product.inventory?.quantity ?? product.stock ?? 0);
  // TikTok 搜索列表可能返回 images 数组，取第一张作为 main_image
  const image = product.main_image?.thumb_url || product.main_image?.url ||
    (Array.isArray(product.images) && product.images[0]?.thumb_url) ||
    (Array.isArray(product.images) && product.images[0]?.url) ||
    (Array.isArray(product.image_list) && product.image_list[0]?.thumb_url) ||
    (Array.isArray(product.image_list) && product.image_list[0]?.url) ||
    product.image || '';
  const description = product.description || '';
  const categoryName = product.category?.name || product.category_name || '';
  const weight = parseFloat(product.package_weight || product.weight || '0') || 0;
  const brands = product.brand || product.brands || null;
  const categories = product.category?.chain || product.categories || [];
  const images = product.images || [];
  const extraData = JSON.stringify({
    categories,
    images,
    brand: brands ? (brands.name || brands) : '',
    warranty: product.warranty || '',
    package_dimensions: product.package_dimensions || {},
    certifications: product.certifications || [],
    create_time: product.create_time || null,
    update_time: product.update_time || null,
  });

  // 查找是否已存在
  const existing = db.prepare(
    'SELECT id FROM products WHERE source_platform = ? AND source_product_id = ?'
  ).get(platform, sourcePid) as any;

  if (existing) {
    db.prepare(`
      UPDATE products SET
        name = ?, sell_price = ?, original_price = ?,
        stock = ?, weight = ?, image = IIF(? != '', ?, image),
        description = ?, status = ?, category_name = ?,
        extra_data = ?, last_synced_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name, sellPrice, originalPrice,
      stock, weight, image, image,
      description, status, categoryName,
      extraData,
      existing.id,
    );

    saveProductSkus(db, existing.id, product);
    if (shopName) saveProductShops(db, existing.id, shopName);
    return 'updated';
  } else {
    const result = db.prepare(`
      INSERT INTO products (
        name, sku, sell_price, original_price, stock, weight,
        image, description, status, category_name,
        source_platform, source_product_id, extra_data,
        last_synced_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `).run(
      name, sourcePid, sellPrice, originalPrice, stock, weight,
      image, description, status, categoryName,
      platform, sourcePid, extraData,
    );

    const newProductId = result.lastInsertRowid as number;
    saveProductSkus(db, newProductId, product);
    if (shopName) saveProductShops(db, newProductId, shopName);
    return 'created';
  }
}

/**
 * 关联产品到店铺
 */
function saveProductShops(db: any, productId: number, shopName: string) {
  const existing = db.prepare('SELECT id FROM product_shops WHERE product_id = ? AND shop_name = ?').get(productId, shopName);
  if (!existing) {
    db.prepare('INSERT INTO product_shops (product_id, shop_name, shop_price) VALUES (?, ?, ?)').run(productId, shopName, 0);
  }
}

/**
 * 丰富产品数据（从详情 API 追加信息）
 */
function enrichProductData(db: any, sourcePid: string, detail: any, platform: string) {
  const existing = db.prepare(
    'SELECT id, extra_data FROM products WHERE source_platform = ? AND source_product_id = ?'
  ).get(platform, sourcePid) as any;
  if (!existing) return;

  // 合并详情数据到 extra_data
  let extra: any = {};
  try { extra = JSON.parse(existing.extra_data || '{}'); } catch { /* ignore */ }

  // 追加品牌信息
  if (detail.brand?.name) extra.brand = detail.brand.name;
  if (detail.brand?.id) extra.brand_id = detail.brand.id;

  // 追加完整类目链
  if (detail.category?.chain?.length) extra.categories = detail.category.chain;
  if (detail.category?.id) extra.category_id = detail.category.id;

  // 追加属性
  if (detail.attributes?.length) extra.attributes = detail.attributes;

  // 追加图片（完整列表）
  if (detail.images?.length) extra.images = detail.images;

  // 追加视频
  if (detail.videos?.length) extra.videos = detail.videos;

  // 追加合规信息
  if (detail.certifications?.length) extra.certifications = detail.certifications;

  // 追加描述
  if (detail.description) {
    db.prepare("UPDATE products SET description = IIF(? != '', ?, description) WHERE id = ?")
      .run(detail.description, detail.description, existing.id);
  }

  // 更新 extra_data
  db.prepare("UPDATE products SET extra_data = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(extra), existing.id);

  // 同步详情级别的 SKU
  if (detail.skus?.length) {
    saveProductSkus(db, existing.id, { skus: detail.skus });
  }
}

/**
 * 保存产品 SKU 信息
 */
function saveProductSkus(db: any, productId: number, product: any) {
  const skuList = product.skus || product.sku_list || [];
  if (skuList.length === 0) return;

  for (const sku of skuList) {
    const skuId = String(sku.sku_id || sku.id || '').trim();
    const skuCode = sku.seller_sku || sku.sku_code || skuId || '';
    const specName = sku.sku_name || sku.spec_name || '';
    const skuPrice = parseFloat(sku.price?.sale_price || sku.sale_price || '0') || 0;
    const skuStock = sku.stock_info?.stock_num ?? sku.stock_info?.available_stock ?? sku.stock ?? 0;
    const skuImage = sku.sku_image?.thumb_url || sku.sku_image?.url ||
      (Array.isArray(sku.images) && sku.images[0]?.thumb_url) ||
      (Array.isArray(sku.images) && sku.images[0]?.url) ||
      sku.image || '';

    const existing = db.prepare(
      'SELECT id FROM product_skus WHERE product_id = ? AND sku_code = ?'
    ).get(productId, skuCode) as any;

    if (existing) {
      db.prepare(`
        UPDATE product_skus SET
          spec_name = ?, sell_price = ?, stock = ?,
          image = IIF(? != '', ?, image)
        WHERE id = ?
      `).run(specName, skuPrice, skuStock, skuImage, skuImage, existing.id);
    } else if (skuCode) {
      db.prepare(`
        INSERT INTO product_skus (product_id, sku_code, spec_name, sell_price, stock, image)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(productId, skuCode, specName, skuPrice, skuStock, skuImage);
    }
  }
}
