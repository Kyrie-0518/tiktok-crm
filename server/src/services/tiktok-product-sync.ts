/**
 * TikTok Shop 产品同步服务
 * 负责从 TikTok API 拉取产品数据并写入本地数据库
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

/**
 * 同步指定店铺的产品
 * @returns 同步统计：新建、更新、跳过、错误
 */
export async function syncShopProducts(shopId: number): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
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
    const maxPages = 20; // 产品同步量较大

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

      if (productList.length === 0) break;

      for (const product of productList) {
        try {
          const result = saveProduct(db, product, shopId, platform);
          if (result === 'created') created++;
          else if (result === 'updated') updated++;
          else skipped++;
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
 * 保存单个 TikTok 产品到本地数据库
 */
function saveProduct(
  db: any,
  product: any,
  shopId: number,
  platform: string,
): 'created' | 'updated' | 'skipped' {
  const sourcePid = String(product.product_id || product.id || '').trim();
  if (!sourcePid) return 'skipped';

  const name = product.title || product.product_name || product.name || '';
  if (!name) return 'skipped';

  const status = PRODUCT_STATUS_MAP[product.status] || 'active';
  const sellPrice = parseFloat(product.price?.sale_price || product.sale_price || '0') || 0;
  const originalPrice = parseFloat(product.price?.original_price || product.original_price || String(sellPrice)) || sellPrice;
  const stock = (product.stock_info?.stock_num || product.inventory?.quantity || product.stock || 0);
  const image = product.main_image?.thumb_url || product.main_image?.url || product.image || '';
  const description = product.description || '';
  const categoryName = product.category?.name || product.category_name || '';
  const weight = parseFloat(product.package_weight || product.weight || '0') || 0;
  const extraData = JSON.stringify({
    categories: product.category?.chain || product.categories || [],
    images: product.images || [],
    brand: product.brand || '',
    warranty: product.warranty || '',
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

    // 同步 SKU
    saveProductSkus(db, existing.id, product, platform);

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

    // 同步 SKU
    saveProductSkus(db, result.lastInsertRowid as number, product, platform);

    return 'created';
  }
}

/**
 * 保存产品 SKU 信息
 */
function saveProductSkus(db: any, productId: number, product: any, _platform: string) {
  const skuList = product.skus || product.sku_list || [];
  if (skuList.length === 0) return;

  for (const sku of skuList) {
    const skuId = String(sku.sku_id || sku.id || '').trim();
    const skuCode = sku.seller_sku || sku.sku_code || skuId || '';
    const specName = sku.sku_name || sku.spec_name || '';
    const skuPrice = parseFloat(sku.price?.sale_price || sku.sale_price || '0') || 0;
    const skuStock = sku.stock_info?.stock_num || sku.stock || 0;
    const skuImage = sku.sku_image?.thumb_url || sku.sku_image?.url || sku.image || '';

    // 查重
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
