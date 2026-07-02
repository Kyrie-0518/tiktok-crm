/**
 * 汇率自动更新脚本 v2
 * 直接使用 better-sqlite3 操作数据库，不触发完整的 initTables 迁移
 * 从 exchangerate-api.com 获取最新 MYR/CNY 汇率并写入数据库
 */
const Database = require('F:/tiktok-crm/server/node_modules/better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'erp.db');
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/MYR';
const timestamp = () => new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

async function main() {
  console.log(`[${timestamp()}] [ExchangeRate Auto] 开始自动更新 MYR/RMB 汇率...`);

  // 1. 从API获取汇率
  let newRate: number | null = null;
  try {
    const response = await fetch(EXCHANGE_RATE_API);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json() as any;
    const rate = data?.rates?.CNY;
    if (rate && rate > 0) {
      newRate = rate;
    } else {
      throw new Error('API 返回的 CNY 汇率无效');
    }
  } catch (e: any) {
    console.error(`[${timestamp()}] [ExchangeRate Auto] ❌ 获取汇率失败: ${e.message}`);
    process.exit(1);
  }

  console.log(`[${timestamp()}] [ExchangeRate Auto] ✅ 从API获取到汇率: 1 MYR = ${newRate} CNY`);

  // 2. 打开数据库（只读当前数据，不触发迁移）
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // 3. 读取现有汇率
  let oldRates: Record<string, number> = { MYR: 1.57 };
  const row = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rates'").get() as any;
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      if (parsed && typeof parsed === 'object') {
        oldRates = parsed;
      }
    } catch {}
  }

  // 4. 更新汇率
  const newRates = { ...oldRates, MYR: newRate };
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('exchange_rates', ?)").run(JSON.stringify(newRates));
  // 清理旧格式
  db.prepare("DELETE FROM settings WHERE key = 'exchange_rate'").run();

  console.log(`[${timestamp()}] [ExchangeRate Auto] ✅ 数据库已更新: ${JSON.stringify(oldRates)} → ${JSON.stringify(newRates)}`);

  // 5. 验证写入
  const verify = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rates'").get() as any;
  if (verify) {
    const saved = JSON.parse(verify.value);
    console.log(`[${timestamp()}] [ExchangeRate Auto] ✅ 验证成功，当前数据库汇率: ${JSON.stringify(saved)}`);
  }

  db.close();
  console.log(`[${timestamp()}] [ExchangeRate Auto] 🎉 汇率更新完成！`);
  process.exit(0);
}

main().catch((e) => {
  console.error(`[${timestamp()}] [ExchangeRate Auto] 未捕获错误:`, e);
  process.exit(1);
});
