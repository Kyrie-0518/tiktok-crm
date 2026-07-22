/**
 * TikTok Shop 商品管理路由
 * 接入全部 TikTok 商品 API：商品 CRUD、品牌、类目、库存、价格、合规、诊断等
 */
import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';
import { TikTokAPI } from '../services/tiktok-api';
import {
  syncSingleProduct,
  syncBrands,
  syncCategories,
  syncProductDiagnostics,
} from '../services/tiktok-product-sync';

const router = Router();

// ═══════════════════════════════════════════════
//  辅助：从请求中创建 TikTokAPI 实例
// ═══════════════════════════════════════════════

function createApiForShop(shopId: number): TikTokAPI | null {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(shopId) as any;
  if (!shop?.access_token) return null;

  const appKey = shop.app_key || process.env.TIKTOK_APP_KEY || '';
  const appSecret = shop.app_secret || process.env.TIKTOK_APP_SECRET || '';

  return new TikTokAPI({
    app_key: appKey,
    app_secret: appSecret,
    access_token: shop.access_token,
    shop_cipher: shop.shop_cipher || '',
    api_version: shop.api_version || '202309',
  });
}

/**
 * 从 req.body 中获取 shop_id，创建 API 实例并返回 { api, shopId }
 */
function getApi(req: Request, res: Response): { api: TikTokAPI; shopId: number } | null {
  const shopId = Number(req.body.shop_id || req.query.shop_id || req.params.shopId);
  if (!shopId) {
    res.status(400).json({ success: false, error: '缺少 shop_id 参数' });
    return null;
  }
  const api = createApiForShop(shopId);
  if (!api) {
    res.status(400).json({ success: false, error: '店铺无有效凭证，请先完成授权' });
    return null;
  }
  return { api, shopId };
}

// ═══════════════════════════════════════════════
//  商品 CRUD（V202309）
// ═══════════════════════════════════════════════

// POST /api/products-tiktok/search — 搜索商品
router.post('/search', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.searchProducts(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products-tiktok/:productId — 获取商品详情
router.get('/:productId', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getProductDetail(req.params.productId, {
      return_under_review_version: req.query.return_under_review_version === '1',
      return_draft_version: req.query.return_draft_version === '1',
      locale: req.query.locale as string,
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok — 创建商品
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.createProduct(req.body.product_data);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/products-tiktok/:productId — 全量编辑商品
router.put('/:productId', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.editProduct(req.params.productId, req.body.product_data);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/:productId/partial-edit — 局部编辑商品
router.post('/:productId/partial-edit', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.partialEditProduct(req.params.productId, req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/activate — 上架商品
router.post('/activate', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.activateProduct({ product_ids: req.body.product_ids });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/deactivate — 下架商品
router.post('/deactivate', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.deactivateProduct({ product_ids: req.body.product_ids });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/recover — 恢复商品
router.post('/recover', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.recoverProducts({ product_ids: req.body.product_ids });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/listing-check — 上架检查
router.post('/listing-check', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.checkProductListing(req.body, req.body.is_diagnosis_required);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  库存 & 价格
// ═══════════════════════════════════════════════

// POST /api/products-tiktok/:productId/inventory/update — 更新库存
router.post('/:productId/inventory/update', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.updateInventory(req.params.productId, req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/inventory/search — 搜索库存
router.post('/inventory/search', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.searchInventory(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/:productId/price/update — 更新价格
router.post('/:productId/price/update', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.updatePrice(req.params.productId, req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  图片上传
// ═══════════════════════════════════════════════

// POST /api/products-tiktok/images/upload — 上传商品图片（URL 模式）
router.post('/images/upload', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.uploadImage({
      url: req.body.url,
      use_case: req.body.use_case,
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/files/upload — 上传商品文件（URL 模式）
router.post('/files/upload', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.uploadFile({
      url: req.body.url,
      name: req.body.name,
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  品牌
// ═══════════════════════════════════════════════

// GET /api/products-tiktok/brands — 获取品牌列表
router.get('/brands/list', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getBrands({
      page_size: Number(req.query.page_size) || 20,
      category_id: req.query.category_id as string,
      is_authorized: req.query.is_authorized === '1' ? true : req.query.is_authorized === '0' ? false : undefined,
      brand_name: req.query.brand_name as string,
      page_token: req.query.page_token as string,
      category_version: req.query.category_version as string,
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/brands — 创建自定义品牌
router.post('/brands', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.createCustomBrand(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  类目
// ═══════════════════════════════════════════════

// GET /api/products-tiktok/categories — 获取类目列表
router.get('/categories/list', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getCategories({
      locale: req.query.locale as string,
      keyword: req.query.keyword as string,
      category_version: req.query.category_version as string,
      listing_platform: req.query.listing_platform as string,
      include_prohibited_categories: req.query.include_prohibited === '1',
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/categories/recommend — 推荐类目
router.post('/categories/recommend', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.recommendCategory(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products-tiktok/categories/:categoryId/attributes — 获取类目属性
router.get('/categories/:categoryId/attributes', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getCategoryAttributes(req.params.categoryId, {
      locale: req.query.locale as string,
      category_version: req.query.category_version as string,
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products-tiktok/categories/:categoryId/rules — 获取类目规则
router.get('/categories/:categoryId/rules', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getCategoryRules(req.params.categoryId, {
      category_version: req.query.category_version as string,
      locale: req.query.locale as string,
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  全球类目
// ═══════════════════════════════════════════════

// GET /api/products-tiktok/global-categories — 获取全球类目
router.get('/global-categories/list', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getGlobalCategories({
      locale: req.query.locale as string,
      keyword: req.query.keyword as string,
      category_version: req.query.category_version as string,
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products-tiktok/global-categories/:categoryId/attributes — 全球类目属性
router.get('/global-categories/:categoryId/attributes', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getGlobalCategoryAttributes(req.params.categoryId, {
      locale: req.query.locale as string,
      category_version: req.query.category_version as string,
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products-tiktok/global-categories/:categoryId/rules — 全球类目规则
router.get('/global-categories/:categoryId/rules', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getGlobalCategoryRules(req.params.categoryId, {
      category_version: req.query.category_version as string,
      locale: req.query.locale as string,
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  全球商品
// ═══════════════════════════════════════════════

// POST /api/products-tiktok/global-products/search — 搜索全球商品
router.post('/global-products/search', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.searchGlobalProducts(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products-tiktok/global-products/:globalProductId — 全球商品详情
router.get('/global-products/:globalProductId', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getGlobalProduct(req.params.globalProductId);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/global-products — 创建全球商品
router.post('/global-products', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.createGlobalProduct(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/products-tiktok/global-products/:globalProductId — 编辑全球商品
router.put('/global-products/:globalProductId', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.editGlobalProduct(req.params.globalProductId, req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/global-products/:globalProductId/publish — 发布全球商品
router.post('/global-products/:globalProductId/publish', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.publishGlobalProduct(req.params.globalProductId, req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/global-products/:globalProductId/inventory/update — 更新全球库存
router.post('/global-products/:globalProductId/inventory/update', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.updateGlobalInventory(req.params.globalProductId, req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  诊断与 SEO（V202405）
// ═══════════════════════════════════════════════

// GET /api/products-tiktok/diagnostics/:productId — 商品诊断&SEO&建议
router.get('/diagnostics/check', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  const productIds = (req.query.product_ids as string)?.split(',') || [];
  if (!productIds.length) {
    return res.status(400).json({ success: false, error: '缺少 product_ids 参数' });
  }

  try {
    const result = await syncProductDiagnostics(ctx.shopId, productIds);
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  上架先决条件（V202309 / V202312）
// ═══════════════════════════════════════════════

// GET /api/products-tiktok/prerequisites — 检查上架先决条件
router.get('/prerequisites', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.checkListingPrerequisites();
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  上架 Schema（V202401 / V202407）
// ═══════════════════════════════════════════════

// GET /api/products-tiktok/listing-schemas — 获取上架 Schema
router.get('/listing-schemas', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const version = req.query.version as string || '202401';
    const resp = version === '202407'
      ? await ctx.api.getListingSchemasV202407({
          category_ids: req.query.category_ids as string,
          locale: req.query.locale as string,
          category_version: req.query.category_version as string,
        })
      : await ctx.api.getListingSchemas({
          category_ids: req.query.category_ids as string,
          locale: req.query.locale as string,
          category_version: req.query.category_version as string,
        });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  合规（V202409 / V202501）
// ═══════════════════════════════════════════════

// POST /api/products-tiktok/compliance/manufacturers/search — 搜索制造商
router.post('/compliance/manufacturers/search', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.searchManufacturers(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/compliance/manufacturers — 创建制造商
router.post('/compliance/manufacturers', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.createManufacturer(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/compliance/manufacturers/:manufacturerId/partial-edit
router.post('/compliance/manufacturers/:manufacturerId/partial-edit', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.partialEditManufacturer(req.params.manufacturerId, req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/compliance/responsible-persons/search — 搜索责任人
router.post('/compliance/responsible-persons/search', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.searchResponsiblePersons(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/compliance/responsible-persons — 创建责任人
router.post('/compliance/responsible-persons', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.createResponsiblePerson(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/compliance/responsible-persons/:personId/partial-edit
router.post('/compliance/responsible-persons/:personId/partial-edit', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.partialEditResponsiblePerson(req.params.personId, req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  图片优化 & 翻译（V202404 / V202505 / V202506）
// ═══════════════════════════════════════════════

// POST /api/products-tiktok/images/optimize — 优化图片
router.post('/images/optimize', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.optimizeImage(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/images/translate — 创建图片翻译任务
router.post('/images/translate', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.createImageTranslationTask(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products-tiktok/images/translate/result — 查询图片翻译任务
router.get('/images/translate/result', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const ids = (req.query.translation_task_ids as string)?.split(',') || [];
    const resp = await ctx.api.getImageTranslationTasks(ids);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  全球复制 & 尺码表（V202507）
// ═══════════════════════════════════════════════

// GET /api/products-tiktok/global-listing-rules — 全球上架规则
router.get('/global-listing-rules', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getGlobalListingRules();
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/:productId/global-replicate — 全球复制
router.post('/:productId/global-replicate', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.globalReplicateProduct(req.params.productId, req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products-tiktok/:productId/replicated-products — 已复制商品列表
router.get('/:productId/replicated-products', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getReplicatedProducts(req.params.productId);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/sizecharts/search — 尺码表搜索
router.post('/sizecharts/search', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.searchSizeCharts(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  类目升级（V202407）
// ═══════════════════════════════════════════════

// POST /api/products-tiktok/category-upgrade — 类目升级任务
router.post('/category-upgrade', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.createCategoryUpgradeTask(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  商机（V202604）
// ═══════════════════════════════════════════════

// POST /api/products-tiktok/opportunities/query — 查询商机
router.post('/opportunities/query', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.queryOpportunities(req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products-tiktok/opportunities/submissions — 商机提交记录
router.get('/opportunities/submissions', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.getOpportunitySubmissions({
      status: req.query.status as string,
      opportunity_id: req.query.opportunity_id as string,
      product_id: req.query.product_id as string,
      submit_time_ge: req.query.submit_time_ge as string,
      submit_time_lt: req.query.submit_time_lt as string,
      page_token: req.query.page_token as string,
      page_size: Number(req.query.page_size) || 20,
    });
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/opportunities/:opportunityId/submit — 提交商机
router.post('/opportunities/:opportunityId/submit', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.submitOpportunity(req.params.opportunityId, req.body);
    res.json({ success: true, data: resp?.data || resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  品牌 & 类目同步（辅助）
// ═══════════════════════════════════════════════

// POST /api/products-tiktok/brands/sync — 同步品牌到本地（仅统计）
router.post('/brands/sync', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const result = await syncBrands(ctx.shopId, {
      category_id: req.body.category_id,
      brand_name: req.body.brand_name,
    });
    res.json({ success: !result.error, ...result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products-tiktok/categories/sync — 同步类目到本地（仅统计）
router.post('/categories/sync', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const result = await syncCategories(ctx.shopId, {
      locale: req.body.locale,
      keyword: req.body.keyword,
    });
    res.json({ success: !result.error, ...result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  单个产品刷新
// ═══════════════════════════════════════════════

// POST /api/products-tiktok/sync-single — 同步单个产品详情
router.post('/sync-single', authMiddleware, async (req: Request, res: Response) => {
  const { shop_id, product_id } = req.body;
  if (!shop_id || !product_id) {
    return res.status(400).json({ success: false, error: '缺少 shop_id 或 product_id' });
  }

  try {
    const result = await syncSingleProduct(Number(shop_id), String(product_id));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  测试连接
// ═══════════════════════════════════════════════

// GET /api/products-tiktok/test — 测试 API 连接
router.get('/test', authMiddleware, async (req: Request, res: Response) => {
  const ctx = getApi(req, res);
  if (!ctx) return;

  try {
    const resp = await ctx.api.checkListingPrerequisites();
    res.json({ success: true, message: '连接正常', data: resp });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;