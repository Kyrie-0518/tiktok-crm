/**
 * 批量回填 order_items.product_id
 * 
 * 用法：node scripts/backfill_product_id.cjs
 * 
 * 功能：扫描所有 product_id 为 NULL 的 order_items 记录，
 *       通过多级匹配（sku_code / spec_name / product_name）重新关联产品，
 *       并回写到数据库。
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'server', 'data', 'erp.db');
const db = new Database(DB_PATH);

console.log('=== 批量回填 order_items.product_id ===\n');

// 1. 统计需要修复的记录
const nullCount = db.prepare("SELECT COUNT(*) as c FROM order_items WHERE product_id IS NULL").get();
console.log(`[统计] product_id 为 NULL 的 order_items 记录: ${nullCount.c} 条`);

if (nullCount.c === 0) {
  console.log('\n没有需要修复的记录，退出。');
  db.close();
  process.exit(0);
}

// 2. 预加载索引
const allSkus = db.prepare('SELECT id, product_id, sku_code, spec_name FROM product_skus').all();
const allProducts = db.prepare('SELECT id, name, sku FROM products').all();

const skuByCode = new Map();        // sku_code(lower) → {product_id, id}
const skuBySpec = new Map();         // spec_name(lower) → {product_id, id}
const prodByName = new Map();        // name(lower) → {id}
const prodBySku = new Map();         // sku(lower) → {id}

allSkus.forEach(s => {
  if (s.sku_code) skuByCode.set(s.sku_code.toLowerCase(), s);
  if (s.spec_name) skuBySpec.set(s.spec_name.toLowerCase(), s);
});
allProducts.forEach(p => {
  if (p.name) prodByName.set(p.name.toLowerCase(), p);
  if (p.sku) prodBySku.set(p.sku.toLowerCase(), p);
});

// 3. 匹配函数
function matchProduct(sku, productName, specName) {
  // 优先1: sku_code 精确匹配
  if (sku && skuByCode.has(sku.toLowerCase())) return skuByCode.get(sku.toLowerCase()).product_id;
  
  // 优先2: sku_code 模糊匹配（处理 "Pemberish Bersaguna x1" 这类名）
  if (sku) {
    const cleanSku = sku.replace(/\s+/g, ' ').trim().toLowerCase();
    for (const [k, v] of skuByCode.entries()) {
      if (k.includes(cleanSku) || cleanSku.includes(k)) return v.product_id;
    }
  }

  // 优先3: spec_name 匹配
  const searchKey = (specName || sku || '').toLowerCase().replace(/\s*x\d+$/i, '').trim();
  if (searchKey && skuBySpec.has(searchKey)) return skuBySpec.get(searchKey).product_id;
  if (searchKey) {
    for (const [k, v] of skuBySpec.entries()) {
      if (k.includes(searchKey) || searchKey.includes(k)) return v.product_id;
    }
  }

  // 优先4: 产品名称精确
  if (productName && prodByName.has(productName.toLowerCase())) return prodByName.get(productName.toLowerCase()).id;

  // 优先5: 产品名称模糊（去掉数量后缀）
  if (productName) {
    const cleanName = productName.replace(/\s*x\d+\s*$/i, '').trim().toLowerCase();
    for (const [k, v] of prodByName.entries()) {
      if (k.includes(cleanName) || cleanName.includes(k)) return v.id;
    }
  }

  // 优先6: products.sku 兼容
  if (sku) {
    const cleanSku2 = sku.replace(/\s*x\d+$/i, '').trim().toLowerCase();
    if (prodBySku.has(cleanSku2)) return prodBySku.get(cleanSku2).id;
  }

  return null;
}

// 4. 逐条修复
const nullItems = db.prepare(`
  SELECT oi.id, oi.order_id, oi.sku, oi.product_name, oi.spec_name, oi.product_id
  FROM order_items oi WHERE oi.product_id IS NULL
`).all();

let updated = 0, stillNull = 0, stats = { exact: 0, fuzzy: 0, name: 0 };

const updateStmt = db.prepare('UPDATE order_items SET product_id = ? WHERE id = ?');

for (const item of nullItems) {
  const productId = matchProduct(item.sku, item.product_name, item.spec_name);
  
  if (productId) {
    updateStmt.run(productId, item.id);
    updated++;
    
    // 分类统计
    const hasExactMatch = (item.sku && skuByCode.has(item.sku.toLowerCase()));
    if (hasExactMatch) stats.exact++;
    else if (item.sku) stats.fuzzy++;
    else stats.name++;

    console.log(`  ✅ ID=${item.id} | SKU="${item.sku || '-'}" | Name="${item.product_name || '-'}" → product_id=${productId}`);
  } else {
    stillNull++;
    console.log(`  ❌ ID=${item.id} | SKU="${item.sku || '-'}" | Name="${item.product_name || '-'}" → 未匹配`);
  }
}

console.log('\n=== 修复结果 ===');
console.log(`总计扫描: ${nullItems.length} 条`);
console.log(`成功回填: ${updated} 条`);
console.log(`  - sku_code 精确匹配: ${stats.exact}`);
console.log(`  - sku_code/spec 模糊匹配: ${stats.fuzzy}`);
console.log(`  - 产品名称匹配: ${stats.name}`);
console.log(`仍未匹配: ${stillNull} 条`);
console.log('\nDone.');

db.close();
