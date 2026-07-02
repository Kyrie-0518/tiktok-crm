const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'erp.db');
console.log('DB_PATH:', DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
 db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role_key TEXT UNIQUE,
    permissions TEXT DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed roles
const roles = [
  { id: 1, name: '开发者', role_key: 'developer', permissions: JSON.stringify({all: 'edit'}), sort_order: 1 },
  { id: 2, name: '管理员', role_key: 'manager', permissions: JSON.stringify({all: 'edit', user_mgmt: 'read'}), sort_order: 2 },
  { id: 3, name: '员工', role_key: 'staff', permissions: JSON.stringify({all: 'read'}), sort_order: 3 },
];

for (const r of roles) {
  const existing = db.prepare('SELECT id FROM roles WHERE role_key = ?').get(r.role_key);
  if (!existing) {
    db.prepare('INSERT INTO roles (id, name, role_key, permissions, sort_order) VALUES (?, ?, ?, ?, ?)').run(r.id, r.name, r.role_key, r.permissions, r.sort_order);
    console.log('Inserted role:', r.role_key);
  }
}

// Seed Kyrie user
const kyrie = db.prepare("SELECT id FROM users WHERE username = 'Kyrie'").get();
if (!kyrie) {
  const hash = bcrypt.hashSync('Ljy231228.', 10);
  db.prepare("INSERT INTO users (username, password, role_id, display_name) VALUES ('Kyrie', ?, 1, '开发者')").run(hash);
  console.log('Inserted user: Kyrie (developer)');
} else {
  db.prepare("UPDATE users SET role_id = 1, display_name = '开发者' WHERE username = 'Kyrie'").run();
  console.log('Updated user: Kyrie (developer)');
}

// Seed admin user (随机密码，首次登录强制修改)
const crypto = require('crypto');
const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (!admin) {
  const randomPassword = crypto.randomBytes(8).toString('hex'); // 16位随机密码
  const hash = bcrypt.hashSync(randomPassword, 10);
  db.prepare("INSERT INTO users (username, password, role_id, display_name, password_changed) VALUES ('admin', ?, 2, '管理员', 0)").run(hash);
  console.log('====================================');
  console.log('Inserted user: admin (manager)');
  console.log(`⚠️  admin 初始随机密码: ${randomPassword}`);
  console.log('⚠️  请保存此密码，首次登录后必须修改！');
  console.log('====================================');
} else {
  db.prepare("UPDATE users SET role_id = 2, display_name = '管理员' WHERE username = 'admin'").run();
  console.log('Updated user: admin (manager)');
}

// Verify
const users = db.prepare('SELECT id, username, display_name, role_id FROM users').all();
console.log('Users:', JSON.stringify(users, null, 2));

const allRoles = db.prepare('SELECT id, name, role_key FROM roles').all();
console.log('Roles:', JSON.stringify(allRoles, null, 2));

db.close();
console.log('Done.');
