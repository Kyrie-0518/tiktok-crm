import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH
  ? path.isAbsolute(process.env.DB_PATH)
    ? process.env.DB_PATH
    : path.join(__dirname, '..', process.env.DB_PATH)
  : path.join(DATA_DIR, 'erp.db');

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT DEFAULT '',
      name TEXT NOT NULL,
      image TEXT DEFAULT '',
      weight REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      sell_price REAL DEFAULT 0,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      box_qty INTEGER DEFAULT 0,
      box_length REAL DEFAULT 0,
      box_width REAL DEFAULT 0,
      box_height REAL DEFAULT 0,
      box_remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      shop_name TEXT NOT NULL,
      shop_price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_specs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      spec_name TEXT NOT NULL,
      batch_no TEXT DEFAULT '',
      cost_price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS product_skus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sku_code TEXT DEFAULT '',
      spec_name TEXT NOT NULL DEFAULT '',
      cost_price REAL DEFAULT 0,
      sell_price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      image TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cost_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      currency TEXT DEFAULT 'RMB',
      is_fixed INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS financial_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      cost_detail TEXT DEFAULT '{}',
      net_profit REAL DEFAULT 0,
      total_investment REAL DEFAULT 0,
      roi REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS influencers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER REFERENCES tiktok_shops(id) ON DELETE SET NULL,
      influencer_id TEXT NOT NULL DEFAULT '',
      profile_url TEXT DEFAULT '',
      contact_channel TEXT DEFAULT '',
      contact_info TEXT DEFAULT '',
      cooperation_type TEXT DEFAULT '',
      commission_rate REAL DEFAULT 0,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      sample_qty INTEGER DEFAULT 1,
      sample_cost REAL DEFAULT 0,
      contact_date TEXT DEFAULT '',
      send_date TEXT DEFAULT '',
      receive_date TEXT DEFAULT '',
      material_schedule TEXT DEFAULT '',
      material_url TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      status TEXT DEFAULT '未回复',
      -- Legacy fields (backward compat)
      name TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS follow_up_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
      contact_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      content TEXT DEFAULT '',
      status TEXT DEFAULT '待沟通',
      next_follow_up TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_influencer_bind (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(influencer_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS tiktok_shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      region TEXT DEFAULT 'MY',
      shop_id TEXT UNIQUE NOT NULL,
      shop_cipher TEXT DEFAULT '',
      app_key TEXT DEFAULT '',
      app_secret TEXT DEFAULT '',
      access_token TEXT DEFAULT '',
      refresh_token TEXT DEFAULT '',
      token_expires_at DATETIME,
      api_version TEXT DEFAULT '202309',
      sync_enabled INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      last_synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      shop_id INTEGER REFERENCES tiktok_shops(id) ON DELETE SET NULL,
      buyer_name TEXT DEFAULT '',
      buyer_phone TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid',
      logistics_status TEXT DEFAULT '',
      tracking_no TEXT DEFAULT '',
      carrier TEXT DEFAULT '',
      item_total REAL DEFAULT 0,
      shipping_fee REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      actual_amount REAL DEFAULT 0,
      influencer_id INTEGER REFERENCES influencers(id) ON DELETE SET NULL,
      commission_rate REAL DEFAULT 0,
      remark TEXT DEFAULT '',
      order_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      ship_deadline DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_sku_id INTEGER REFERENCES product_skus(id) ON DELETE SET NULL,
      sku TEXT DEFAULT '',
      product_name TEXT DEFAULT '',
      spec_name TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      item_status TEXT DEFAULT 'pending',
      image_url TEXT DEFAULT '',
      product_source_id TEXT DEFAULT '',
      image TEXT DEFAULT ''
    );
  `);

  // Get existing tables list (used throughout migration)
  const tableList = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];

  // Migrate: add new columns to products if missing
  const productCols = db.prepare("PRAGMA table_info(products)").all() as any[];
  const colNames = productCols.map(c => c.name);
  if (!colNames.includes('sell_price')) db.exec('ALTER TABLE products ADD COLUMN sell_price REAL DEFAULT 0');
  if (!colNames.includes('cost_price')) db.exec('ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0');
  if (!colNames.includes('box_qty')) db.exec('ALTER TABLE products ADD COLUMN box_qty INTEGER DEFAULT 0');
  if (!colNames.includes('box_length')) db.exec('ALTER TABLE products ADD COLUMN box_length REAL DEFAULT 0');
  if (!colNames.includes('box_width')) db.exec('ALTER TABLE products ADD COLUMN box_width REAL DEFAULT 0');
  if (!colNames.includes('box_height')) db.exec('ALTER TABLE products ADD COLUMN box_height REAL DEFAULT 0');
  if (!colNames.includes('box_remark')) db.exec('ALTER TABLE products ADD COLUMN box_remark TEXT DEFAULT ""');
  if (!colNames.includes('commission')) db.exec('ALTER TABLE products ADD COLUMN commission REAL DEFAULT 0');

  // Migrate: add taxes column to orders (for order-based profit calculation)
  const orderCols = db.prepare("PRAGMA table_info(orders)").all() as any[];
  const orderColNames = orderCols.map(c => c.name);
  if (!orderColNames.includes('taxes')) {
    db.exec('ALTER TABLE orders ADD COLUMN taxes REAL DEFAULT 0');
  }
  if (!orderColNames.includes('order_time')) {
    db.exec('ALTER TABLE orders ADD COLUMN order_time DATETIME DEFAULT CURRENT_TIMESTAMP');
  }

  // Migrate: remove UNIQUE constraint from products.sku (for multi-SKU support)
  const productTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'").get() as any;
  if (productTableInfo?.sql && productTableInfo.sql.includes('sku TEXT UNIQUE')) {
    // Need to recreate table without UNIQUE constraint
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE IF NOT EXISTS products_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT DEFAULT '',
        name TEXT NOT NULL,
        image TEXT DEFAULT '',
        weight REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        sell_price REAL DEFAULT 0,
        cost_price REAL DEFAULT 0,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        box_qty INTEGER DEFAULT 0,
        box_length REAL DEFAULT 0,
        box_width REAL DEFAULT 0,
        box_height REAL DEFAULT 0,
        box_remark TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO products_new SELECT * FROM products;
      DROP TABLE products;
      ALTER TABLE products_new RENAME TO products;
    `);
    db.pragma('foreign_keys = ON');
    console.log('[migrate] Removed UNIQUE constraint from products.sku');
  }

  // Migrate: create product_skus if missing (multi-SKU support)
  if (!tableList.some(t => t.name === 'product_skus')) {
    db.exec(`
      CREATE TABLE product_skus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku_code TEXT DEFAULT '',
        spec_name TEXT NOT NULL DEFAULT '',
        cost_price REAL DEFAULT 0,
        sell_price REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        image TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Migrate: add image column to product_skus if missing
  const skuCols = db.prepare("PRAGMA table_info(product_skus)").all() as any[];
  if (!skuCols.some((c: any) => c.name === 'image')) {
    db.exec("ALTER TABLE product_skus ADD COLUMN image TEXT DEFAULT ''");
  }

  // Migrate: add formula column to cost_items if missing
  const costItemCols = db.prepare("PRAGMA table_info(cost_items)").all() as any[];
  if (!costItemCols.some((c: any) => c.name === 'formula')) {
    db.exec("ALTER TABLE cost_items ADD COLUMN formula TEXT DEFAULT ''");
  }
  if (!costItemCols.some((c: any) => c.name === 'value_format')) {
    db.exec("ALTER TABLE cost_items ADD COLUMN value_format TEXT DEFAULT 'number'");
  }

  // Migrate: add custom_cost_formulas column to financial_records if missing
  const frCols = db.prepare("PRAGMA table_info(financial_records)").all() as any[];
  if (!frCols.some((c: any) => c.name === 'custom_cost_formulas')) {
    db.exec("ALTER TABLE financial_records ADD COLUMN custom_cost_formulas TEXT DEFAULT '{}'");
  }

  // Migrate: add columns to order_items if missing
  const oiCols = db.prepare("PRAGMA table_info(order_items)").all() as any[];
  const oiColNames = oiCols.map(c => c.name);
  if (!oiColNames.includes('product_sku_id')) {
    db.exec('ALTER TABLE order_items ADD COLUMN product_sku_id INTEGER REFERENCES product_skus(id) ON DELETE SET NULL');
  }
  if (!oiColNames.includes('sku')) db.exec("ALTER TABLE order_items ADD COLUMN sku TEXT DEFAULT ''");
  if (!oiColNames.includes('item_status')) db.exec("ALTER TABLE order_items ADD COLUMN item_status TEXT DEFAULT 'pending'");
  if (!oiColNames.includes('image_url')) db.exec("ALTER TABLE order_items ADD COLUMN image_url TEXT DEFAULT ''");
  if (!oiColNames.includes('spec_name')) db.exec("ALTER TABLE order_items ADD COLUMN spec_name TEXT DEFAULT ''");
  if (!oiColNames.includes('product_source_id')) db.exec("ALTER TABLE order_items ADD COLUMN product_source_id TEXT DEFAULT ''");
  if (!oiColNames.includes('image')) db.exec("ALTER TABLE order_items ADD COLUMN image TEXT DEFAULT ''");

  // Migrate: create shops table if missing
  if (!tableList.some(t => t.name === 'shops')) {
    db.exec(`
      CREATE TABLE shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Migrate: create product_shops if missing
  if (!tableList.some(t => t.name === 'product_shops')) {
    db.exec(`
      CREATE TABLE product_shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        shop_name TEXT NOT NULL,
        shop_price REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Migrate: tiktok_shops
  if (!tableList.some(t => t.name === 'tiktok_shops')) {
    db.exec(`
      CREATE TABLE tiktok_shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        region TEXT DEFAULT 'MY',
        shop_id TEXT UNIQUE NOT NULL,
        shop_cipher TEXT DEFAULT '',
        app_key TEXT DEFAULT '',
        app_secret TEXT DEFAULT '',
        access_token TEXT DEFAULT '',
        refresh_token TEXT DEFAULT '',
        token_expires_at DATETIME,
        api_version TEXT DEFAULT '202309',
        sync_enabled INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active',
        last_synced_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Migrate: orders
  if (!tableList.some(t => t.name === 'orders')) {
    db.exec(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        shop_id INTEGER REFERENCES tiktok_shops(id) ON DELETE SET NULL,
        buyer_name TEXT DEFAULT '',
        buyer_phone TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        logistics_status TEXT DEFAULT '',
        tracking_no TEXT DEFAULT '',
        carrier TEXT DEFAULT '',
        item_total REAL DEFAULT 0,
        shipping_fee REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        taxes REAL DEFAULT 0,
        actual_amount REAL DEFAULT 0,
        influencer_id INTEGER REFERENCES influencers(id) ON DELETE SET NULL,
        commission_rate REAL DEFAULT 0,
        remark TEXT DEFAULT '',
        order_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        ship_deadline DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Migrate: influencers table - add new columns for enhanced BD management
  const infCols = db.prepare("PRAGMA table_info(influencers)").all() as any[];
  const infColNames = infCols.map(c => c.name);
  if (!infColNames.includes('shop_id')) db.exec('ALTER TABLE influencers ADD COLUMN shop_id INTEGER REFERENCES tiktok_shops(id) ON DELETE SET NULL');
  if (!infColNames.includes('influencer_id')) db.exec("ALTER TABLE influencers ADD COLUMN influencer_id TEXT NOT NULL DEFAULT ''");
  if (!infColNames.includes('contact_channel')) db.exec("ALTER TABLE influencers ADD COLUMN contact_channel TEXT DEFAULT ''");
  if (!infColNames.includes('contact_info')) db.exec("ALTER TABLE influencers ADD COLUMN contact_info TEXT DEFAULT ''");
  if (!infColNames.includes('cooperation_type')) db.exec("ALTER TABLE influencers ADD COLUMN cooperation_type TEXT DEFAULT ''");
  if (!infColNames.includes('product_id')) db.exec('ALTER TABLE influencers ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE SET NULL');
  if (!infColNames.includes('sample_qty')) db.exec('ALTER TABLE influencers ADD COLUMN sample_qty INTEGER DEFAULT 1');
  if (!infColNames.includes('sample_cost')) db.exec('ALTER TABLE influencers ADD COLUMN sample_cost REAL DEFAULT 0');
  if (!infColNames.includes('send_date')) db.exec("ALTER TABLE influencers ADD COLUMN send_date TEXT DEFAULT ''");
  if (!infColNames.includes('receive_date')) db.exec("ALTER TABLE influencers ADD COLUMN receive_date TEXT DEFAULT ''");
  if (!infColNames.includes('material_schedule')) db.exec("ALTER TABLE influencers ADD COLUMN material_schedule TEXT DEFAULT ''");
  if (!infColNames.includes('material_url')) db.exec("ALTER TABLE influencers ADD COLUMN material_url TEXT DEFAULT ''");
  if (!infColNames.includes('remark')) db.exec("ALTER TABLE influencers ADD COLUMN remark TEXT DEFAULT ''");
  if (!infColNames.includes('commission_rate')) db.exec('ALTER TABLE influencers ADD COLUMN commission_rate REAL DEFAULT 0');
  if (!infColNames.includes('contact_date')) db.exec("ALTER TABLE influencers ADD COLUMN contact_date TEXT DEFAULT ''");
  // Also make profile_url and name/contact accept empty defaults for new schema
  // (Old schema had NOT NULL on name/contact/profile_url; new rows use influencer_id as primary identifier)

  // Migrate: order_items
  if (!tableList.some(t => t.name === 'order_items')) {
    db.exec(`
      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        product_sku_id INTEGER REFERENCES product_skus(id) ON DELETE SET NULL,
        sku TEXT DEFAULT '',
        product_name TEXT DEFAULT '',
        spec_name TEXT DEFAULT '',
        quantity INTEGER DEFAULT 1,
        unit_price REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        item_status TEXT DEFAULT 'pending',
        image_url TEXT DEFAULT '',
        product_source_id TEXT DEFAULT '',
        image TEXT DEFAULT ''
      );
    `);
  }
  // Migrate: roles table
  if (!tableList.some(t => t.name === 'roles')) {
    db.exec(`
      CREATE TABLE roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        role_key TEXT UNIQUE DEFAULT NULL,
        description TEXT DEFAULT '',
        permissions TEXT DEFAULT '{}',
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Migrate: add role_key and sort_order to existing roles table
  const roleCols = db.prepare("PRAGMA table_info(roles)").all() as any[];
  const roleColNames = roleCols.map(c => c.name);
  if (!roleColNames.includes('role_key')) db.exec("ALTER TABLE roles ADD COLUMN role_key TEXT UNIQUE DEFAULT NULL");
  if (!roleColNames.includes('sort_order')) db.exec('ALTER TABLE roles ADD COLUMN sort_order INTEGER DEFAULT 0');

  // Seed 3 fixed roles: developer, manager, staff (idempotent)
  const devPerms = JSON.stringify({
    'ai-analysis': 'edit', 'ai-creation': 'edit', 'seedance-video': 'edit', 'seedance-model-config': 'edit',
    'products': 'edit', 'shops': 'edit',
    'orders': 'edit', 'finance': 'edit', 'influencers': 'edit',
    'skiis-analysis': 'edit',
    'settings': 'edit', 'backup': 'edit', 'user-mgmt': 'edit',
    'settings-config': 'edit', 'settings-permissions': 'edit',
    'dept-switch': 'edit',
  });
  const mgrPerms = JSON.stringify({
    'ai-analysis': 'edit', 'ai-creation': 'edit', 'seedance-video': 'edit', 'seedance-model-config': 'edit',
    'products': 'edit', 'shops': 'edit',
    'orders': 'edit', 'finance': 'edit', 'influencers': 'edit',
    'skiis-analysis': 'edit',
    'settings': 'edit', 'backup': 'edit', 'user-mgmt': 'read',
    'settings-config': 'edit', 'settings-permissions': 'edit',
    'dept-switch': 'edit',
  });
  const staffPerms = JSON.stringify({
    'ai-analysis': 'read', 'ai-creation': 'read', 'seedance-video': 'read', 'seedance-model-config': 'read',
    'products': 'read', 'shops': 'read',
    'orders': 'read', 'finance': 'read', 'influencers': 'read',
    'skiis-analysis': 'read',
    'settings': 'read', 'backup': 'read', 'user-mgmt': 'read',
    'settings-config': 'read', 'settings-permissions': 'read',
  });

  // Use INSERT OR IGNORE for idempotency, then UPDATE to sync permissions
  db.prepare(`INSERT OR IGNORE INTO roles (id, name, role_key, description, permissions, sort_order) VALUES (1, '开发者', 'developer', '系统最高权限，可管理所有用户和系统配置', ?, 1)`).run(devPerms);
  db.prepare(`INSERT OR IGNORE INTO roles (id, name, role_key, description, permissions, sort_order) VALUES (2, '管理员(领导)', 'manager', '业务管理员，可管理数据和AI配置', ?, 2)`).run(mgrPerms);
  db.prepare(`INSERT OR IGNORE INTO roles (id, name, role_key, description, permissions, sort_order) VALUES (3, '普通员工', 'staff', '普通员工，仅可查看数据', ?, 3)`).run(staffPerms);
  // Sync existing roles' permissions on every startup
  db.prepare(`UPDATE roles SET permissions = ? WHERE id = 1`).run(devPerms);
  db.prepare(`UPDATE roles SET permissions = ? WHERE id = 2`).run(mgrPerms);
  db.prepare(`UPDATE roles SET permissions = ? WHERE id = 3`).run(staffPerms);

  // Migrate old role data: if old "管理员" role (id>3 or no role_key) exists, update admin user to manager
  const oldAdminRole = db.prepare("SELECT id FROM roles WHERE name = '管理员' AND role_key IS NULL").get() as any;
  if (oldAdminRole) {
    // Reassign any users from old role to manager (id=2)
    db.prepare('UPDATE users SET role_id = 2 WHERE role_id = ?').run(oldAdminRole.id);
    db.prepare('DELETE FROM roles WHERE id = ?').run(oldAdminRole.id);
  }
  const oldReadonlyRole = db.prepare("SELECT id FROM roles WHERE name = '只读用户' AND role_key IS NULL").get() as any;
  if (oldReadonlyRole) {
    db.prepare('UPDATE users SET role_id = 3 WHERE role_id = ?').run(oldReadonlyRole.id);
    db.prepare('DELETE FROM roles WHERE id = ?').run(oldReadonlyRole.id);
  }

  // Clean up legacy user_roles junction table if it exists (no longer needed)
  if (tableList.some(t => t.name === 'user_roles')) {
    try { db.prepare('DROP TABLE user_roles').run(); } catch {}
  }

  // users 表添加需要的新字段 — 必须在种子用户之前
  const allUserColsResult = db.prepare("PRAGMA table_info(users)").all() as any[];
  const allUserCols = allUserColsResult.map((c: any) => c.name);
  if (!allUserCols.includes('password_changed')) {
    db.exec("ALTER TABLE users ADD COLUMN password_changed INTEGER DEFAULT 0");
  }
  if (!allUserCols.includes('display_name')) {
    db.exec("ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT ''");
  }
  if (!allUserCols.includes('role_id')) {
    db.exec('ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL');
  }
  // 登录追踪：记录最后登录 IP / 时间 / 用户设备
  if (!allUserCols.includes('last_login_ip')) {
    db.exec("ALTER TABLE users ADD COLUMN last_login_ip TEXT DEFAULT ''");
  }
  if (!allUserCols.includes('last_login_at')) {
    db.exec("ALTER TABLE users ADD COLUMN last_login_at DATETIME");
  }
  if (!allUserCols.includes('last_user_agent')) {
    db.exec("ALTER TABLE users ADD COLUMN last_user_agent TEXT DEFAULT ''");
  }
  if (!allUserCols.includes('email')) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''");
  }
  if (!allUserCols.includes('identity')) {
    db.exec("ALTER TABLE users ADD COLUMN identity TEXT DEFAULT 'USER'");
  }

  // Seed default admin if not exist — 随机生成密码+首次强制修改
  const existingAdmin = db.prepare("SELECT id, role_id FROM users WHERE username = 'admin'").get() as any;
  if (!existingAdmin) {
    const adminPassword = randomBytes(6).toString('hex'); // 12位随机密码
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare("INSERT INTO users (username, password, role_id, display_name, password_changed) VALUES (?, ?, 2, ?, 0)").run('admin', hash, '管理员');
    console.log(`\n[Security] 管理员账号已创建:`);
    console.log(`[Security]   用户名: admin`);
    console.log(`[Security]   密码: ${adminPassword}`);
    console.log(`[Security]   ⚠️ 首次登录后请立即修改密码！\n`);
  } else {
    // Ensure admin has manager role (id=2) if not developer
    if (existingAdmin.role_id !== 1) {
      db.prepare('UPDATE users SET role_id = 2 WHERE id = ?').run(existingAdmin.id);
    }
    // 如果admin没有password_changed字段值，设为0强制改密
    const adminPwChanged = db.prepare("SELECT password_changed FROM users WHERE username = 'admin'").get() as any;
    if (!adminPwChanged || !adminPwChanged.password_changed) {
      db.prepare("UPDATE users SET password_changed = 0 WHERE username = 'admin'");
    }
  }

  // Seed developer user (Kyrie) if not exists — 保留密码但首次登录强制改密
  const kyrieUser = db.prepare("SELECT id FROM users WHERE username = 'Kyrie'").get() as any;
  if (!kyrieUser) {
    const hash = bcrypt.hashSync('Ljy231228.', 10);
    db.prepare("INSERT INTO users (username, password, role_id, display_name, password_changed, identity) VALUES (?, ?, 1, ?, 0, 'SUPER_ADMIN')").run('Kyrie', hash, '开发者');
  } else {
    // Ensure Kyrie is developer (role_id=1), SUPER_ADMIN, force password change
    db.prepare('UPDATE users SET role_id = 1, display_name = ?, identity = ?, password_changed = 0 WHERE username = ?').run('开发者', 'SUPER_ADMIN', 'Kyrie');
  }

  // Add commission_rate to orders if missing (for profit calculation linkage)
  const orderCols2 = db.prepare("PRAGMA table_info(orders)").all() as any[];
  const orderColNames2 = orderCols2.map(c => c.name);
  if (!orderColNames2.includes('commission_rate')) db.exec('ALTER TABLE orders ADD COLUMN commission_rate REAL DEFAULT 0');

  // Migrate: cost_items add currency, is_active columns (if missing)
  const costItemCols2 = db.prepare("PRAGMA table_info(cost_items)").all() as any[];
  const costColNames = costItemCols2.map(c => c.name);
  if (!costColNames.includes('currency')) db.exec("ALTER TABLE cost_items ADD COLUMN currency TEXT DEFAULT 'RMB'");
  if (!costColNames.includes('is_active')) db.exec("ALTER TABLE cost_items ADD COLUMN is_active INTEGER DEFAULT 1");
  if (!costColNames.includes('value_format')) db.exec("ALTER TABLE cost_items ADD COLUMN value_format TEXT DEFAULT 'number'");
  // Remove is_roi_base concept - all costs are included in calculation

  // Migrate: financial_records - remove old columns if they exist, handle schema change
  const finCols = db.prepare("PRAGMA table_info(financial_records)").all() as any[];
  const finColNames = finCols.map(c => c.name);
  // Old schema had period_start, period_end, revenue, spec_id, influencer_id - we keep backward compat

  // Seed fixed cost items for Malaysia TikTok Shop if none exist with currency
  const costCount = db.prepare("SELECT COUNT(*) as c FROM cost_items WHERE is_fixed = 1 AND currency IS NOT NULL").get() as { c: number };
  if (costCount.c === 0) {
    const fixedItems = [
      { name: '订单操作RMB', currency: 'RMB' },
      { name: '佣金费MYR', currency: 'MYR' },
      { name: '平台支持费MYR', currency: 'MYR' },
      { name: 'SST税费MYR', currency: 'MYR' },
      { name: '交易手续费MYR', currency: 'MYR' },
      { name: 'BXP项目费MYR', currency: 'MYR' },
      { name: '达人佣金MYR', currency: 'MYR' },
      { name: '跨境运费RMB', currency: 'RMB' },
    ];
    const insert = db.prepare('INSERT INTO cost_items (name, currency, is_fixed, is_active, formula) VALUES (?, ?, 1, 1, ?)');
    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        try { insert.run(item.name, item.currency, item.formula || ''); } catch {}
      }
    });
    insertMany(fixedItems);
  }

  // Migrate: add 跨境运费RMB cost item if missing
  const crossBorderItem = db.prepare("SELECT id FROM cost_items WHERE name = '跨境运费RMB'").get() as any;
  if (!crossBorderItem) {
    db.prepare("INSERT INTO cost_items (name, currency, is_fixed, is_active, formula) VALUES (?, ?, 1, 1, ?)")
      .run('跨境运费RMB', 'RMB', '产品重量 * 0.015 * MYR兑RMB汇率');
  }

  // Migrate: remove duplicate '跨境运费' (without RMB suffix) if exists
  const oldCrossBorderItem = db.prepare("SELECT id FROM cost_items WHERE name = '跨境运费'").get() as any;
  if (oldCrossBorderItem) {
    db.prepare("DELETE FROM cost_items WHERE name = '跨境运费'").run();
  }

  // Migrate: auto-generate default SKU for products that don't have any product_skus
  const productsWithoutSkus = db.prepare(`
    SELECT p.id, p.sku, p.name, p.cost_price, p.sell_price, p.stock
    FROM products p
    LEFT JOIN product_skus ps ON p.id = ps.product_id
    WHERE ps.id IS NULL
  `).all() as any[];
  if (productsWithoutSkus.length > 0) {
    const insertSku = db.prepare('INSERT INTO product_skus (product_id, sku_code, spec_name, cost_price, sell_price, stock) VALUES (?, ?, ?, ?, ?, ?)');
    const migrateSkus = db.transaction((items: any[]) => {
      for (const p of items) {
        insertSku.run(p.id, p.sku || '', '默认规格', p.cost_price || 0, p.sell_price || 0, p.stock || 0);
      }
    });
    migrateSkus(productsWithoutSkus);
    console.log(`[migrate] Auto-generated default SKU for ${productsWithoutSkus.length} products`);
  }

  // Migrate: sync products.cost_price and sell_price from first SKU (for finance calculation)
  const productsNeedSync = db.prepare(`
    SELECT p.id
    FROM products p
    INNER JOIN product_skus ps ON p.id = ps.product_id
    WHERE (p.cost_price != ps.cost_price OR p.sell_price != ps.sell_price)
    AND ps.id = (SELECT MIN(id) FROM product_skus WHERE product_id = p.id)
  `).all() as any[];
  if (productsNeedSync.length > 0) {
    const syncStmt = db.prepare(`
      UPDATE products SET cost_price = ?, sell_price = ?
      WHERE id = ? AND (cost_price != ? OR sell_price != ?)
    `);
    const syncCostPrice = db.transaction(() => {
      for (const p of productsNeedSync) {
        const firstSku = db.prepare('SELECT cost_price, sell_price FROM product_skus WHERE product_id = ? ORDER BY id LIMIT 1').get(p.id) as any;
        if (firstSku) {
          syncStmt.run(firstSku.cost_price || 0, firstSku.sell_price || 0, p.id, firstSku.cost_price || 0, firstSku.sell_price || 0);
        }
      }
    });
    syncCostPrice();
    console.log(`[migrate] Synced cost_price/sell_price for ${productsNeedSync.length} products from first SKU`);
  }

  // Seed default shop if not exist
  const shopCount = db.prepare('SELECT COUNT(*) as c FROM tiktok_shops').get() as { c: number };
  if (shopCount.c === 0) {
    db.prepare('INSERT INTO tiktok_shops (name, region, shop_id, status) VALUES (?, ?, ?, ?)').run(
      'Freshguard15', 'MY', 'freshguard15', 'active'
    );
  }

  // ============ Seedance 2.0 模块 ============

  // Migrate: seedance_apis 表（API配置管理）
  if (!tableList.some(t => t.name === 'seedance_apis')) {
    db.exec(`
      CREATE TABLE seedance_apis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        status TEXT DEFAULT 'disabled',
        last_tested_at DATETIME,
        last_test_result TEXT DEFAULT '',
        last_test_message TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    // 迁移：添加测试结果字段（如果不存在）
    const seedanceApisInfo = db.prepare("PRAGMA table_info(seedance_apis)").all() as any[];
    const hasApiKey = seedanceApisInfo.some(c => c.name === 'api_key');
    const hasLastTestedAt = seedanceApisInfo.some(c => c.name === 'last_tested_at');
    const hasLastTestResult = seedanceApisInfo.some(c => c.name === 'last_test_result');
    const hasLastTestMessage = seedanceApisInfo.some(c => c.name === 'last_test_message');
    
    if (!hasApiKey) {
      db.exec("ALTER TABLE seedance_apis ADD COLUMN api_key TEXT");
      // 迁移旧数据：将 app_id 和 app_secret 合并为 api_key
      try {
        db.exec("UPDATE seedance_apis SET api_key = COALESCE(app_id || ':' || app_secret, app_id, app_secret, '') WHERE api_key IS NULL OR api_key = ''");
      } catch { /* 忽略旧数据迁移错误 */ }
    }
    if (!hasLastTestedAt) {
      db.exec("ALTER TABLE seedance_apis ADD COLUMN last_tested_at DATETIME");
    }
    if (!hasLastTestResult) {
      db.exec("ALTER TABLE seedance_apis ADD COLUMN last_test_result TEXT DEFAULT ''");
    }
    if (!hasLastTestMessage) {
      db.exec("ALTER TABLE seedance_apis ADD COLUMN last_test_message TEXT DEFAULT ''");
    }
  }

  // Migrate: seedance_account_bindings 表（账号-API绑定）
  if (!tableList.some(t => t.name === 'seedance_account_bindings')) {
    db.exec(`
      CREATE TABLE seedance_account_bindings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        api_id INTEGER REFERENCES seedance_apis(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);
  }

  // Migrate: seedance_templates 表（视频模板库）
  if (!tableList.some(t => t.name === 'seedance_templates')) {
    db.exec(`
      CREATE TABLE seedance_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT DEFAULT '通用',
        thumbnail TEXT DEFAULT '',
        prompt TEXT DEFAULT '',
        config TEXT DEFAULT '{}',
        is_system INTEGER DEFAULT 1,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Migrate: seedance_materials 表（素材库）
  if (!tableList.some(t => t.name === 'seedance_materials')) {
    db.exec(`
      CREATE TABLE seedance_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT DEFAULT '默认',
        file_type TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_name TEXT DEFAULT '',
        file_size INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Migrate: seedance_videos 表（生成的视频）
  if (!tableList.some(t => t.name === 'seedance_videos')) {
    db.exec(`
      CREATE TABLE seedance_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        title TEXT DEFAULT '',
        video_url TEXT DEFAULT '',
        thumbnail_url TEXT DEFAULT '',
        prompt TEXT DEFAULT '',
        model TEXT DEFAULT 'Doubao-Seedance-1.5-pro',
        resolution TEXT DEFAULT '720p',
        duration INTEGER DEFAULT 5,
        aspect_ratio TEXT DEFAULT '9:16',
        status TEXT DEFAULT 'pending',
        token_usage INTEGER DEFAULT 0,
        api_response TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  // 为已有 seedance_videos 表添加 token_usage 列（增量迁移）
  try {
    const svCols = db.prepare("PRAGMA table_info('seedance_videos')").all() as any[];
    if (svCols.length > 0 && !svCols.some((c: any) => c.name === 'token_usage')) {
      db.exec("ALTER TABLE seedance_videos ADD COLUMN token_usage INTEGER DEFAULT 0");
      // 回填已有完成的 api_response 中的 token_usage
      db.exec(`
        UPDATE seedance_videos SET token_usage = CAST(
          COALESCE(NULLIF(json_extract(api_response, '$.usage.total_tokens'), ''), '0') AS INTEGER
        ) WHERE status = 'completed' AND api_response != ''
      `);
    }
  } catch { /* 表可能不存在 */ }

  // Migrate: video_model_configs 表（通用视频模型配置，支持多模型）
  if (!tableList.some(t => t.name === 'video_model_configs')) {
    db.exec(`
      CREATE TABLE video_model_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        model_type TEXT NOT NULL,
        api_url TEXT NOT NULL DEFAULT '',
        api_key TEXT NOT NULL DEFAULT '',
        model_name TEXT NOT NULL DEFAULT '',
        extra_params TEXT DEFAULT '{}',
        status TEXT DEFAULT 'disabled',
        last_tested_at DATETIME,
        last_test_result TEXT DEFAULT '',
        last_test_message TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, model_type)
      );
    `);
  }

  // Migrate: seedance_user_configs 表（兼容旧接口）
  // 如果表不存在，创建它
  if (!tableList.some(t => t.name === 'seedance_user_configs')) {
    db.exec(`
      CREATE TABLE seedance_user_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        api_url TEXT NOT NULL DEFAULT '',
        api_key TEXT NOT NULL DEFAULT '',
        model_name TEXT NOT NULL DEFAULT '',
        status TEXT DEFAULT 'disabled',
        last_tested_at DATETIME,
        last_test_result TEXT DEFAULT '',
        last_test_message TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[migrate] Created seedance_user_configs table');
  } else {
    // 如果表存在，确保有所有需要的字段
    const seedanceCols = db.prepare("PRAGMA table_info(seedance_user_configs)").all() as any[];
    const seedanceColNames = seedanceCols.map(c => c.name);
    if (!seedanceColNames.includes('last_tested_at')) {
      db.exec("ALTER TABLE seedance_user_configs ADD COLUMN last_tested_at DATETIME");
    }
    if (!seedanceColNames.includes('last_test_result')) {
      db.exec("ALTER TABLE seedance_user_configs ADD COLUMN last_test_result TEXT DEFAULT ''");
    }
    if (!seedanceColNames.includes('last_test_message')) {
      db.exec("ALTER TABLE seedance_user_configs ADD COLUMN last_test_message TEXT DEFAULT ''");
    }
  }

  // Migrate: seedance_templates 初始化默认模板
  const templateCount = db.prepare('SELECT COUNT(*) as c FROM seedance_templates').get() as { c: number };
  if (templateCount.c === 0) {
    const defaultTemplates = [
      { name: '家清带货模板', category: '家清', prompt: 'High-quality product showcase, clean home environment, fast-paced editing, trending music, call-to-action overlay', config: JSON.stringify({ style: 'lifestyle', duration: 15 }) },
      { name: '美妆种草模板', category: '美妆', prompt: 'Beauty product demonstration, soft lighting, skin care application, before/after效果, beauty filter', config: JSON.stringify({ style: 'beauty', duration: 15 }) },
      { name: '3C科技模板', category: '3C', prompt: 'Tech product unboxing, sleek background, feature highlights, futuristic vibe, motion graphics', config: JSON.stringify({ style: 'tech', duration: 10 }) },
      { name: '食品美食模板', category: '食品', prompt: 'Food close-up shots, appetizing presentation, ASMR sounds, recipe steps, mouth-watering visuals', config: JSON.stringify({ style: 'food', duration: 15 }) },
    ];
    const insertTemplate = db.prepare('INSERT INTO seedance_templates (name, category, prompt, config, is_system, created_by) VALUES (?, ?, ?, ?, 1, NULL)');
    for (const t of defaultTemplates) {
      try { insertTemplate.run(t.name, t.category, t.prompt, t.config); } catch {}
    }
  }

  // ========== AI 渠道管理表 ==========
  // 支持多渠道 AI API 管理，类似 One API 功能
  if (!tableList.some(t => t.name === 'ai_channels')) {
    db.exec(`
      CREATE TABLE ai_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'custom',
        api_base TEXT NOT NULL DEFAULT '',
        api_key TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        models TEXT DEFAULT '[]',
        priority INTEGER DEFAULT 100,
        status TEXT DEFAULT 'enabled',
        is_default INTEGER DEFAULT 0,
        quota_used REAL DEFAULT 0,
        quota_limit REAL DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        avg_latency INTEGER DEFAULT 0,
        last_used_at DATETIME,
        last_success_at DATETIME,
        last_error_at DATETIME,
        last_error_message TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[migrate] Created ai_channels table');
  } else {
    // 确保有所有需要的字段
    const cols = db.prepare("PRAGMA table_info(ai_channels)").all() as any[];
    const colNames = cols.map(c => c.name);
    const addCol = (name: string, def: string) => {
      if (!colNames.includes(name)) {
        db.exec(`ALTER TABLE ai_channels ADD COLUMN ${name} ${def}`);
      }
    };
    addCol('provider', 'TEXT DEFAULT custom');
    addCol('models', 'TEXT DEFAULT []');
    addCol('priority', 'INTEGER DEFAULT 100');
    addCol('is_default', 'INTEGER DEFAULT 0');
    addCol('quota_used', 'REAL DEFAULT 0');
    addCol('quota_limit', 'REAL DEFAULT 0');
    addCol('success_count', 'INTEGER DEFAULT 0');
    addCol('error_count', 'INTEGER DEFAULT 0');
    addCol('avg_latency', 'INTEGER DEFAULT 0');
    addCol('last_used_at', 'DATETIME');
    addCol('last_success_at', 'DATETIME');
    addCol('last_error_at', 'DATETIME');
    addCol('last_error_message', 'TEXT DEFAULT');
  }

  // 初始化默认渠道（如果表为空）
  const channelCount = db.prepare('SELECT COUNT(*) as c FROM ai_channels').get() as { c: number };
  if (channelCount.c === 0) {
    const defaultChannels = [
      { name: 'DeepSeek', provider: 'deepseek', api_base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', priority: 1, is_default: 1 },
      { name: '火山引擎', provider: 'volcengine', api_base: 'https://ark.cn-beijing.volcengineapi.com', model: 'doubao-pro-32k', priority: 2, is_default: 0 },
      { name: '硅基流动', provider: 'siliconflow', api_base: 'https://api.siliconflow.cn/v1', model: 'DeepSeek/DeepSeek-V3', priority: 3, is_default: 0 },
    ];
    const insertChannel = db.prepare('INSERT INTO ai_channels (name, provider, api_base, api_key, model, priority, status, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const ch of defaultChannels) {
      try { insertChannel.run(ch.name, ch.provider, ch.api_base, '', ch.model, ch.priority, 'disabled', ch.is_default); } catch {}
    }
    console.log('[migrate] Added default AI channels');
  }

  // ============ v1.3.0 优化项 ============

  // 创建审计日志表
  if (!tableList.some(t => t.name === 'audit_logs')) {
    db.exec(`
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT DEFAULT '',
        method TEXT NOT NULL DEFAULT '',
        path TEXT NOT NULL DEFAULT '',
        status_code INTEGER DEFAULT 200,
        ip TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // 审计日志索引：按时间清理时加速
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)');
  }

  // ============ 达人BD汇报表 ============
  if (!tableList.some(t => t.name === 'influencer_reports')) {
    db.exec(`
      CREATE TABLE influencer_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        report_type TEXT NOT NULL DEFAULT 'daily',
        report_date TEXT NOT NULL,
        content TEXT DEFAULT '',
        plan TEXT DEFAULT '',
        issues TEXT DEFAULT '',
        needs TEXT DEFAULT '',
        new_influencers_count INTEGER DEFAULT 0,
        contacted_count INTEGER DEFAULT 0,
        samples_sent_count INTEGER DEFAULT 0,
        materials_received_count INTEGER DEFAULT 0,
        feishu_synced INTEGER DEFAULT 0,
        feishu_message_id TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_reports_user_date ON influencer_reports(user_id, report_date)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_reports_type ON influencer_reports(report_type)');
  }

  // Migrate: influencer_reports 添加 stats_by_shop 字段（按店铺统计JSON）
  const reportCols = db.prepare("PRAGMA table_info(influencer_reports)").all() as any[];
  if (!reportCols.some((c: any) => c.name === 'stats_by_shop')) {
    db.exec("ALTER TABLE influencer_reports ADD COLUMN stats_by_shop TEXT DEFAULT '[]'");
  }
  // Migrate: influencer_reports 添加 summary 字段（整体总结）
  if (!reportCols.some((c: any) => c.name === 'summary')) {
    db.exec("ALTER TABLE influencer_reports ADD COLUMN summary TEXT DEFAULT ''");
  }

  // ============ SQLite 索引优化 ============
  // orders 表索引
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_order_time ON orders(order_time)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id)');
  // order_items 表索引
  db.exec('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)');
  // financial_records 表索引
  db.exec('CREATE INDEX IF NOT EXISTS idx_financial_records_product_id ON financial_records(product_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_financial_records_created ON financial_records(created_at)');

  // ============ 种子：按用户 Token 累积统计 ============
  seedTokenStats(db);

  // 10. TikTok Shop API 凭证字段
  const tikApiCols = db.prepare("PRAGMA table_info(tiktok_shops)").all() as any[];
  const tikApiMigrations: [string, string][] = [
    ['app_key', "ALTER TABLE tiktok_shops ADD COLUMN app_key TEXT DEFAULT ''"],
    ['app_secret', "ALTER TABLE tiktok_shops ADD COLUMN app_secret TEXT DEFAULT ''"],
    ['access_token', "ALTER TABLE tiktok_shops ADD COLUMN access_token TEXT DEFAULT ''"],
    ['refresh_token', "ALTER TABLE tiktok_shops ADD COLUMN refresh_token TEXT DEFAULT ''"],
    ['shop_cipher', "ALTER TABLE tiktok_shops ADD COLUMN shop_cipher TEXT DEFAULT ''"],
    ['token_expires_at', "ALTER TABLE tiktok_shops ADD COLUMN token_expires_at DATETIME"],
    ['api_version', "ALTER TABLE tiktok_shops ADD COLUMN api_version TEXT DEFAULT '202309'"],
    ['sync_enabled', "ALTER TABLE tiktok_shops ADD COLUMN sync_enabled INTEGER DEFAULT 0"],
  ];
  for (const [col, sql] of tikApiMigrations) {
    if (!tikApiCols.some((c: any) => c.name === col)) {
      db.exec(sql);
      console.log(`[migrate v2.1] Added ${col} to tiktok_shops`);
    }
  }

  // 11. TikTok Shop 产品同步字段
  const prodCols = db.prepare("PRAGMA table_info(products)").all() as any[];
  const prodMigrations: [string, string][] = [
    ['source_platform', "ALTER TABLE products ADD COLUMN source_platform TEXT DEFAULT ''"],
    ['source_product_id', "ALTER TABLE products ADD COLUMN source_product_id TEXT DEFAULT ''"],
    ['original_price', "ALTER TABLE products ADD COLUMN original_price REAL DEFAULT 0"],
    ['description', "ALTER TABLE products ADD COLUMN description TEXT DEFAULT ''"],
    ['status', "ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active'"],
    ['tiktok_status', "ALTER TABLE products ADD COLUMN tiktok_status TEXT DEFAULT ''"],
    ['category_name', "ALTER TABLE products ADD COLUMN category_name TEXT DEFAULT ''"],
    ['extra_data', "ALTER TABLE products ADD COLUMN extra_data TEXT DEFAULT '{}'"],
    ['last_synced_at', "ALTER TABLE products ADD COLUMN last_synced_at DATETIME"],
    ['updated_at', "ALTER TABLE products ADD COLUMN updated_at DATETIME"],
  ];
  for (const [col, sql] of prodMigrations) {
    if (!prodCols.some((c: any) => c.name === col)) {
      db.exec(sql);
      console.log(`[migrate v2.2] Added ${col} to products`);
    }
  }

  // 12. TikTok Shop 产品同步开关
  if (!tikApiCols.some((c: any) => c.name === 'product_sync_enabled')) {
    db.exec("ALTER TABLE tiktok_shops ADD COLUMN product_sync_enabled INTEGER DEFAULT 0");
    console.log('[migrate v2.3] Added product_sync_enabled to tiktok_shops');
  }

  // 12b. TikTok Shop open_id（OAuth 授权后由 TikTok 返回的唯一标识）
  if (!tikApiCols.some((c: any) => c.name === 'open_id')) {
    db.exec("ALTER TABLE tiktok_shops ADD COLUMN open_id TEXT DEFAULT ''");
    console.log('[migrate v2.4] Added open_id to tiktok_shops');
  }

  // 13. order_items 补充 TikTok 源字段
  const oiColsV2 = db.prepare("PRAGMA table_info(order_items)").all() as any[];
  const oiMigrations: [string, string][] = [
    ['source_product_id', "ALTER TABLE order_items ADD COLUMN source_product_id TEXT DEFAULT ''"],
    ['image_url', "ALTER TABLE order_items ADD COLUMN image_url TEXT DEFAULT ''"],
    ['item_status', "ALTER TABLE order_items ADD COLUMN item_status TEXT DEFAULT 'pending'"],
  ];
  for (const [col, sql] of oiMigrations) {
    if (!oiColsV2.some((c: any) => c.name === col)) {
      db.exec(sql);
      console.log(`[migrate v2.4] Added ${col} to order_items`);
    }
  }

  // orders 表补充字段
  const ordCols = db.prepare("PRAGMA table_info(orders)").all() as any[];
  const ordMigrations: [string, string][] = [
    ['source_platform', "ALTER TABLE orders ADD COLUMN source_platform TEXT DEFAULT 'tiktok'"],
    ['source_order_id', "ALTER TABLE orders ADD COLUMN source_order_id TEXT DEFAULT ''"],
    ['currency', "ALTER TABLE orders ADD COLUMN currency TEXT DEFAULT 'MYR'"],
    ['shipping_address', "ALTER TABLE orders ADD COLUMN shipping_address TEXT DEFAULT ''"],
    ['logistics_provider', "ALTER TABLE orders ADD COLUMN logistics_provider TEXT DEFAULT ''"],
    ['taxes', "ALTER TABLE orders ADD COLUMN taxes REAL DEFAULT 0"],
    ['pay_time', "ALTER TABLE orders ADD COLUMN pay_time DATETIME"],
    ['ship_time', "ALTER TABLE orders ADD COLUMN ship_time DATETIME"],
    ['complete_time', "ALTER TABLE orders ADD COLUMN complete_time DATETIME"],
    ['updated_at', "ALTER TABLE orders ADD COLUMN updated_at DATETIME"],
  ];
  for (const [col, sql] of ordMigrations) {
    if (!ordCols.some((c: any) => c.name === col)) {
      db.exec(sql);
      console.log(`[migrate v2.5] Added ${col} to orders`);
    }
  }

  // 索引
  db.exec('CREATE INDEX IF NOT EXISTS idx_products_source ON products(source_platform, source_product_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source_platform, source_order_id)');

  console.log('[migrate v2.2] TikTok Shop sync columns migration done');

  console.log('[migrate v2.0] Multi-department system migration done');
}

function seedTokenStats(db: any) {
  const seedData: Record<string, { totalTokens: number; totalGenerations: number }> = {
    Kyrie:  { totalTokens: 6921900, totalGenerations: 59 },
    admin:  { totalTokens: 1521000, totalGenerations: 19 },
    ziyin:  { totalTokens:  653400, totalGenerations:  6 },
    mengzhu:{ totalTokens:  305100, totalGenerations:  3 },
  };

  for (const [username, stats] of Object.entries(seedData)) {
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as any;
    if (!user) continue;

    const key = `token_stats_${user.id}`;
    const existing = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
    if (existing) continue; // 已有数据，不覆盖

    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .run(key, JSON.stringify(stats));
    console.log(`[SeedTokenStats] ${username}(id=${user.id}): totalTokens=${stats.totalTokens}, totalGenerations=${stats.totalGenerations}`);
  }
}

/* ═══════════════════════════════ AI Video Engine tables ═══════════════════════════════ */
function initVideoEngineTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT UNIQUE NOT NULL,
      product_id INTEGER,
      product_name TEXT DEFAULT '',
      user_prompt TEXT DEFAULT '',
      template TEXT DEFAULT '',
      model TEXT DEFAULT '',
      resolution TEXT DEFAULT '720p',
      aspect_ratio TEXT DEFAULT '9:16',
      duration INTEGER DEFAULT 5,
      count INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      final_prompt TEXT DEFAULT '',
      quality_score INTEGER DEFAULT 0,
      video_id INTEGER,
      video_url TEXT DEFAULT '',
      error TEXT DEFAULT '',
      total_time_ms INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      steps_json TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS video_task_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      agent TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      input_json TEXT DEFAULT '',
      output_json TEXT DEFAULT '',
      tokens INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      error TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_vt_steps_task ON video_task_steps(task_id);

    CREATE TABLE IF NOT EXISTS video_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      prompt TEXT DEFAULT '',
      strategy TEXT DEFAULT '',
      params TEXT DEFAULT '{}',
      tags TEXT DEFAULT '',
      is_system INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS video_prompt_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      version INTEGER DEFAULT 1,
      prompt TEXT DEFAULT '',
      strategy_json TEXT DEFAULT '{}',
      director_json TEXT DEFAULT '{}',
      optimizer_params TEXT DEFAULT '{}',
      model TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS video_quality_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      video_id INTEGER,
      score INTEGER DEFAULT 0,
      product_completeness INTEGER DEFAULT 0,
      person_consistency INTEGER DEFAULT 0,
      shot_fluency INTEGER DEFAULT 0,
      brand_visibility INTEGER DEFAULT 0,
      selling_point_coverage INTEGER DEFAULT 0,
      overall_impression INTEGER DEFAULT 0,
      needs_retry INTEGER DEFAULT 0,
      suggestions TEXT DEFAULT '',
      raw_json TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);
  console.log('[migrate v3.0] AI Video Engine tables initialized');
}
initVideoEngineTables(db);

export default getDb;
