import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';
import path from 'path';
import fs from 'fs';

const router = Router();
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'data', 'uploads'));
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
console.log('[upload] UPLOAD_DIR =', UPLOAD_DIR);

// ========== Image Upload ==========

router.post('/upload-image', authMiddleware, (req: Request, res: Response) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: '缺少图片数据' });
  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `product_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    res.json({ url: `/uploads/${filename}` });
  } catch (e: any) {
    res.status(500).json({ error: '图片保存失败' });
  }
});

// ========== Suppliers ==========

router.get('/suppliers', authMiddleware, (_req: Request, res: Response) => {
  const db = getDb();
  const list = db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all();
  res.json(list);
});

router.post('/suppliers', authMiddleware, (req: Request, res: Response) => {
  const { name, contact } = req.body;
  if (!name || !contact) return res.status(400).json({ error: '供应商名称和联系方式必填' });
  const db = getDb();
  const result = db.prepare('INSERT INTO suppliers (name, contact) VALUES (?, ?)').run(name, contact);
  res.json({ id: result.lastInsertRowid, name, contact });
});

router.put('/suppliers/:id', authMiddleware, (req: Request, res: Response) => {
  const { name, contact } = req.body;
  const db = getDb();
  db.prepare('UPDATE suppliers SET name = ?, contact = ? WHERE id = ?').run(name, contact, req.params.id);
  res.json({ success: true });
});

router.delete('/suppliers/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE products SET supplier_id = NULL WHERE supplier_id = ?').run(req.params.id);
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== Shop Management (read from tiktok_shops) ==========

router.get('/shops', authMiddleware, (_req: Request, res: Response) => {
  const db = getDb();
  const list = db.prepare('SELECT id, name FROM tiktok_shops WHERE status = ? ORDER BY id DESC').all('active');
  res.json(list);
});

// ========== Products ==========

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { keyword, shop_name } = req.query;
  let sql = `SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE 1=1`;
  const params: any[] = [];
  if (keyword) {
    sql += ` AND (p.name LIKE ?)`;
    params.push(`%${keyword}%`);
    // Also search by SKU code in product_skus
    sql += ` OR p.id IN (SELECT product_id FROM product_skus WHERE sku_code LIKE ?)`;
    params.push(`%${keyword}%`);
  }
  if (shop_name) {
    sql += ` AND p.id IN (SELECT product_id FROM product_shops WHERE shop_name = ?)`;
    params.push(shop_name);
  }
  sql += ` ORDER BY (SELECT COALESCE(SUM(stock), 0) FROM product_skus WHERE product_id = p.id) DESC, p.id DESC`;
  const list = db.prepare(sql).all(...params);
  // Attach skus and shops for each product
  for (const p of list as any[]) {
    p.skus = db.prepare('SELECT * FROM product_skus WHERE product_id = ? ORDER BY id').all(p.id);
    // Calculate aggregated stock from SKUs
    p.stock = (p.skus as any[]).reduce((sum: number, sku: any) => sum + (sku.stock || 0), 0);
    p.shops = db.prepare('SELECT * FROM product_shops WHERE product_id = ?').all(p.id);
  }
  res.json(list);
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const p = db.prepare(`SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?`).get(req.params.id) as any;
  if (!p) return res.status(404).json({ error: '产品不存在' });
  p.skus = db.prepare('SELECT * FROM product_skus WHERE product_id = ? ORDER BY id').all(p.id);
  p.stock = (p.skus as any[]).reduce((sum: number, sku: any) => sum + (sku.stock || 0), 0);
  p.shops = db.prepare('SELECT * FROM product_shops WHERE product_id = ?').all(p.id);
  res.json(p);
});

router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { name, image, weight, supplier_id, skus, box_qty, box_length, box_width, box_height, box_remark, shops, commission } = req.body;
  if (!name) return res.status(400).json({ error: '产品名称必填' });
  if (!skus || skus.length === 0) return res.status(400).json({ error: '至少需要1个SKU' });
  const db = getDb();
  const insertProduct = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO products (name, image, weight, supplier_id, box_qty, box_length, box_width, box_height, box_remark, commission, cost_price, sell_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, image || '', weight || 0, supplier_id || null, box_qty || 0, box_length || 0, box_width || 0, box_height || 0, box_remark || '', commission || 0, skus[0]?.cost_price || 0, skus[0]?.sell_price || 0);
    const productId = result.lastInsertRowid as number;
    // Insert SKUs
    const insertSku = db.prepare('INSERT INTO product_skus (product_id, sku_code, spec_name, cost_price, sell_price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const s of skus) {
      insertSku.run(productId, s.sku_code || '', s.spec_name || '', s.cost_price || 0, s.sell_price || 0, s.stock || 0, s.image || '');
    }
    // Insert shops
    if (shops && shops.length > 0) {
      const insertShop = db.prepare('INSERT INTO product_shops (product_id, shop_name, shop_price) VALUES (?, ?, ?)');
      for (const s of shops) {
        insertShop.run(productId, s.shop_name, s.shop_price || 0);
      }
    }
    return productId;
  });
  const productId = insertProduct();
  res.json({ id: productId, name });
});

router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const { name, image, weight, supplier_id, skus, box_qty, box_length, box_width, box_height, box_remark, shops, commission } = req.body;
  if (!name) return res.status(400).json({ error: '产品名称必填' });
  if (!skus || skus.length === 0) return res.status(400).json({ error: '至少需要1个SKU' });
  const db = getDb();
  const update = db.transaction(() => {
    db.prepare(
      'UPDATE products SET name=?, image=?, weight=?, supplier_id=?, box_qty=?, box_length=?, box_width=?, box_height=?, box_remark=?, commission=?, cost_price=?, sell_price=? WHERE id=?'
    ).run(name, image || '', weight || 0, supplier_id || null, box_qty || 0, box_length || 0, box_width || 0, box_height || 0, box_remark || '', commission || 0, skus[0]?.cost_price || 0, skus[0]?.sell_price || 0, req.params.id);
    // Replace all SKUs
    db.prepare('DELETE FROM product_skus WHERE product_id = ?').run(req.params.id);
    const insertSku = db.prepare('INSERT INTO product_skus (product_id, sku_code, spec_name, cost_price, sell_price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const s of skus) {
      insertSku.run(Number(req.params.id), s.sku_code || '', s.spec_name || '', s.cost_price || 0, s.sell_price || 0, s.stock || 0, s.image || '');
    }
    // Replace shops
    db.prepare('DELETE FROM product_shops WHERE product_id = ?').run(req.params.id);
    if (shops && shops.length > 0) {
      const insertShop = db.prepare('INSERT INTO product_shops (product_id, shop_name, shop_price) VALUES (?, ?, ?)');
      for (const s of shops) {
        insertShop.run(Number(req.params.id), s.shop_name, s.shop_price || 0);
      }
    }
  });
  update();
  res.json({ success: true });
});

router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM product_skus WHERE product_id = ?').run(req.params.id);
  db.prepare('DELETE FROM product_shops WHERE product_id = ?').run(req.params.id);
  db.prepare('DELETE FROM product_specs WHERE product_id = ?').run(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== SKU Sub-routes ==========

router.get('/:id/skus', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const skus = db.prepare('SELECT * FROM product_skus WHERE product_id = ? ORDER BY id').all(req.params.id);
  res.json(skus);
});

router.put('/:id/skus', authMiddleware, (req: Request, res: Response) => {
  const { skus } = req.body;
  if (!skus || skus.length === 0) return res.status(400).json({ error: '至少需要1个SKU' });
  const db = getDb();
  const updateSkus = db.transaction(() => {
    db.prepare('DELETE FROM product_skus WHERE product_id = ?').run(req.params.id);
    const insertSku = db.prepare('INSERT INTO product_skus (product_id, sku_code, spec_name, cost_price, sell_price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const s of skus) {
      insertSku.run(Number(req.params.id), s.sku_code || '', s.spec_name || '', s.cost_price || 0, s.sell_price || 0, s.stock || 0, s.image || '');
    }
    // Sync first SKU's cost_price and sell_price to products table
    if (skus.length > 0) {
      db.prepare('UPDATE products SET cost_price = ?, sell_price = ? WHERE id = ?')
        .run(skus[0].cost_price || 0, skus[0].sell_price || 0, Number(req.params.id));
    }
  });
  updateSkus();
  res.json({ success: true });
});

// ========== Update Shop Price ==========

router.put('/:id/shops', authMiddleware, (req: Request, res: Response) => {
  const { shops } = req.body;
  const db = getDb();
  db.prepare('DELETE FROM product_shops WHERE product_id = ?').run(req.params.id);
  if (shops && shops.length > 0) {
    const insertShop = db.prepare('INSERT INTO product_shops (product_id, shop_name, shop_price) VALUES (?, ?, ?)');
    for (const s of shops) {
      insertShop.run(Number(req.params.id), s.shop_name, s.shop_price || 0);
    }
  }
  res.json({ success: true });
});

// ========== Excel Import/Export ==========

router.post('/import', authMiddleware, (req: Request, res: Response) => {
  const { products: items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: '数据格式错误' });
  const db = getDb();
  const importTx = db.transaction(() => {
    let count = 0;
    for (const item of items) {
      if (!item.name) continue;
      try {
        const result = db.prepare(
          'INSERT INTO products (sku, name, image, weight, stock, sell_price, cost_price, supplier_id, box_qty, box_length, box_width, box_height, box_remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(item.sku || '', item.name, item.image || '', item.weight || 0, item.stock || 0, item.sell_price || 0, item.cost_price || 0, item.supplier_id || null, item.box_qty || 0, item.box_length || 0, item.box_width || 0, item.box_height || 0, item.box_remark || '');
        // Create default SKU for imported product
        db.prepare('INSERT INTO product_skus (product_id, sku_code, spec_name, cost_price, sell_price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(result.lastInsertRowid, item.sku || '', '默认规格', item.cost_price || 0, item.sell_price || 0, item.stock || 0, item.image || '');
        if (item.shops && item.shops.length > 0) {
          const insertShop = db.prepare('INSERT INTO product_shops (product_id, shop_name, shop_price) VALUES (?, ?, ?)');
          for (const s of item.shops) {
            insertShop.run(result.lastInsertRowid, s.shop_name, s.shop_price || 0);
          }
        }
        count++;
      } catch (e: any) {
        // Silently skip duplicate errors
        if (!e.message?.includes('UNIQUE') && !e.message?.includes('constraint')) throw e;
      }
    }
    return count;
  });
  const count = importTx();
  res.json({ success: true, imported: count });
});

router.get('/export', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const products = db.prepare(`SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id`).all() as any[];
  for (const p of products) {
    p.skus = db.prepare('SELECT * FROM product_skus WHERE product_id = ? ORDER BY id').all(p.id);
    p.shops = db.prepare('SELECT * FROM product_shops WHERE product_id = ?').all(p.id);
  }
  res.json(products);
});

// Keep export before /:id route for correct matching
router.get('/shop-filter-list', authMiddleware, (_req: Request, res: Response) => {
  const db = getDb();
  const list = db.prepare('SELECT name FROM tiktok_shops WHERE status = ? ORDER BY name').all('active');
  res.json(list.map((r: any) => r.name));
});

// ========== 爬虫同步接口 ==========

// POST /api/products/sync-from-platform — 电商平台商品同步到 ERP
router.post('/sync-from-platform', authMiddleware, (req: Request, res: Response) => {
  const {
    source_platform, source_product_id, sku, name, sell_price,
    original_price, stock, weight, image, description,
    status, category_name, extra_data,
  } = req.body;

  if (!name) return res.status(400).json({ error: '商品名称必填' });
  const db = getDb();

  // 按 source_product_id 或 (name + sku) 去重
  const existing = db.prepare(
    `SELECT * FROM products WHERE (source_product_id = ? OR (name = ? AND sku = ?))`
  ).get(source_product_id || '', name || '', sku || '') as any;

  if (existing) {
    db.prepare(`
      UPDATE products SET name=?, sell_price=?, original_price=?, stock=?,
        weight=?, image=?, description=?, status=?,
        category_name=?, extra_data=?, updated_at=datetime('now'),
        last_synced_at=datetime('now')
      WHERE id=?
    `).run(
      name, sell_price ?? existing.sell_price,
      original_price ?? sell_price,
      stock ?? existing.stock,
      weight ?? existing.weight,
      image || existing.image,
      description || '',
      status || 'active',
      category_name || '',
      JSON.stringify(extra_data || {}),
      existing.id
    );
    return res.json({ success: true, created: false, id: existing.id, message: '商品已更新' });
  } else {
    const result = db.prepare(`
      INSERT INTO products (
        name, sku, sell_price, original_price, stock, weight,
        image, description, status, category_name,
        source_platform, source_product_id, extra_data,
        created_at, updated_at, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `).run(
      name, sku || '', sell_price || 0, original_price || 0,
      stock || 0, weight || 0, image || '', description || '',
      status || 'active', category_name || '',
      source_platform || '', source_product_id || '',
      JSON.stringify(extra_data || {})
    );
    return res.json({ success: true, created: true, id: result.lastInsertRowid, message: '商品已创建' });
  }
});

export default router;
