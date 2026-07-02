import { Router, Request, Response } from 'express';
import getDb from '../../db';
import authMiddleware from '../../middleware/auth';
import { DEFAULT_EXCHANGE_RATE } from './shared';
import { getFormulas } from './formulas';
import { calculateProductFinance } from './calc';

const router = Router();

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/MYR';

export async function fetchExchangeRateFromApi(): Promise<number | null> {
  try {
    const response = await fetch(EXCHANGE_RATE_API);
    if (!response.ok) return null;
    const data = await response.json();
    const rate = data?.rates?.CNY;
    if (rate && rate > 0) return rate;
    return null;
  } catch {
    return null;
  }
}

// GET /exchange-rate
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  const db = getDb();
  // 支持新的多货币格式 exchange_rates JSON，也兼容旧的单一 rate
  const row = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rates'").get() as any;
  if (row) {
    try {
      const rates = JSON.parse(row.value);
      if (rates && typeof rates === 'object' && !Array.isArray(rates)) {
        // 新格式: {"MYR": 1.57}
        return res.json(rates);
      }
    } catch {}
  }

  // 回退到旧格式
  const oldRow = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rate'").get() as any;
  if (oldRow) {
    try {
      const val = parseFloat(JSON.parse(oldRow.value));
      if (isFinite(val) && val > 0) { res.json({ MYR: val }); return; }
    } catch {}
  }
  res.json({ MYR: DEFAULT_EXCHANGE_RATE });
});

// PUT /exchange-rate
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  const { rates, rate } = req.body;  // rates = 新格式对象, rate = 兼容旧的单值

  let newRates: Record<string, number> = {};

  if (rates && typeof rates === 'object' && !Array.isArray(rates)) {
    newRates = rates;  // 新格式: {"MYR": 1.57, "USD": 7.2}
  } else if (rate && rate > 0) {
    // 旧格式兼容：自动迁移到新格式
    const existingRates = getExchangeRates(getDb());
    newRates = { ...existingRates, MYR: rate };
  } else {
    // 自动获取 MYR 汇率
    const fetched = await fetchExchangeRateFromApi();
    if (!fetched) { res.status(500).json({ error: '自动获取汇率失败' }); return; }
    newRates = { ...getExchangeRates(getDb()), MYR: fetched };
  }

  const db = getDb();
  const oldRates = getExchangeRates(db);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('exchange_rates', ?)").run(JSON.stringify(newRates));

  // 如果有旧格式数据则清理
  db.prepare("DELETE FROM settings WHERE key = 'exchange_rate'").run();

  // Recalculate all financial records with the new rate
  recalculateAllWithNewRates(db);

  const myrRate = newRates.MYR || Object.values(newRates)[0] || DEFAULT_EXCHANGE_RATE;
  res.json({ success: true, rates: newRates, source: rates ? 'manual' : (rate ? 'manual' : 'api'), recalculated: true, oldRates });
});

/** 获取汇率（返回新格式对象，默认含MYR） */
export function getExchangeRates(db: any): Record<string, number> {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rates'").get() as any;
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // 回退到旧格式
  const oldRow = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rate'").get() as any;
  if (oldRow) {
    try {
      const val = parseFloat(JSON.parse(oldRow.value));
      if (isFinite(val) && val > 0) return { MYR: val };
    } catch {}
  }
  return { MYR: DEFAULT_EXCHANGE_RATE };
}

/** 获取指定币种的汇率（向后兼容） */
export function getExchangeRate(db: any): number {
  const rates = getExchangeRates(db);
  return rates.MYR || Object.values(rates)[0] || DEFAULT_EXCHANGE_RATE;
}

/** 使用新汇率重算所有记录 */
function recalculateAllWithNewRates(db: any): void {
  const costItems = db.prepare('SELECT * FROM cost_items WHERE is_active = 1').all() as any[];
  const formulas = getFormulas(db);
  const exchangeRate = getExchangeRate(db);  // 主汇率（MYR）
  const records = db.prepare('SELECT * FROM financial_records').all() as any[];
  const update = db.prepare('UPDATE financial_records SET net_profit=?, total_investment=?, roi=? WHERE id=?');

  for (const r of records) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(r.product_id) as any;
    if (!product) continue;
    const costDetail = JSON.parse(r.cost_detail || '{}');
    const customCostFormulas = JSON.parse(r.custom_cost_formulas || '{}');
    const calc = calculateProductFinance(product, costDetail, costItems, exchangeRate, formulas, customCostFormulas);
    update.run(calc['净利润'] || 0, calc['总投入'] || 0, calc['整体ROI'] || 0, r.id);
  }
}

/** Auto-fetch exchange rate and recalculate all records */
export function autoUpdateExchangeRate(): void {
  (async () => {
    try {
      const rate = await fetchExchangeRateFromApi();
      if (!rate) { console.log('[ExchangeRate] 自动获取汇率失败，保持当前值'); return; }
      const db = getDb();
      const oldRates = getExchangeRates(db);
      const newRates = { ...oldRates, MYR: rate };
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('exchange_rates', ?)").run(JSON.stringify(newRates));
      db.prepare("DELETE FROM settings WHERE key = 'exchange_rate'").run();
      console.log(`[ExchangeRate] 汇率已自动更新: ${JSON.stringify(oldRates)} → ${JSON.stringify(newRates)}`);

      // Recalculate all records with new rate
      recalculateAllWithNewRates(db);
      console.log(`[ExchangeRate] 已重算所有核算记录`);
    } catch (e) {
      console.error('[ExchangeRate] 自动更新失败:', e);
    }
  })();
}

export default router;
