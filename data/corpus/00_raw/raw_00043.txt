import { Router, Request, Response } from 'express';
import getDb from '../../db';
import authMiddleware from '../../middleware/auth';
import { calculateProductFinance } from './calc';
import { getFormulas, evaluateFormula } from './formulas';
import { getExchangeRate } from './exchange';

const router = Router();

// GET /records
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { product_id } = req.query;
  let sql = `
    SELECT fr.*, p.name as product_name, p.sku, p.sell_price, p.cost_price, p.weight, p.image,
           p.commission as product_commission,
           s.name as supplier_name
    FROM financial_records fr
    LEFT JOIN products p ON fr.product_id = p.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1`;
  const params: any[] = [];
  if (product_id) { sql += ` AND fr.product_id = ?`; params.push(product_id); }
  sql += ` ORDER BY fr.id DESC`;
  const records = db.prepare(sql).all(...params) as any[];

  const costItems = db.prepare('SELECT * FROM cost_items WHERE is_active = 1').all() as any[];
  const formulas = getFormulas(db);
  const exchangeRate = getExchangeRate(db);

  for (const r of records) {
    r.cost_detail = JSON.parse(r.cost_detail || '{}');
    const customCostFormulas = JSON.parse(r.custom_cost_formulas || '{}');
    r.custom_cost_formulas = customCostFormulas;
    const calc = calculateProductFinance(r, r.cost_detail, costItems, exchangeRate, formulas, customCostFormulas);
    Object.assign(r, calc);
    r.gross_margin = calc['毛利率'] || 0;
    r.breakeven_roi = calc['保本ROI'] || 0;
    r.total_investment = calc['总投入'] || 0;
    r.net_profit = calc['净利润'] || 0;
    r.roi = calc['整体ROI'] || 0;
  }
  res.json(records);
});

// POST /records
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { product_id, cost_detail, custom_cost_formulas } = req.body;
  if (!product_id) return res.status(400).json({ error: '产品必填' });
  const db = getDb();
  const parsedCostDetail = cost_detail || {};
  const parsedCustomFormulas = custom_cost_formulas || {};

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
  if (!product) return res.status(404).json({ error: '产品不存在' });

  const costItems = db.prepare('SELECT * FROM cost_items WHERE is_active = 1').all() as any[];
  const formulas = getFormulas(db);
  const exchangeRate = getExchangeRate(db);

  const calc = calculateProductFinance(product, parsedCostDetail, costItems, exchangeRate, formulas, parsedCustomFormulas);

  const result = db.prepare(
    `INSERT INTO financial_records (product_id, cost_detail, custom_cost_formulas, net_profit, total_investment, roi)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(product_id, JSON.stringify(parsedCostDetail), JSON.stringify(parsedCustomFormulas),
    calc['净利润'] || 0, calc['总投入'] || 0, calc['整体ROI'] || 0);

  res.json({ id: result.lastInsertRowid, ...calc });
});

// PUT /records/batch-cost — 全局批量应用公式
router.put('/batch-cost', authMiddleware, (req: Request, res: Response) => {
  const { cost_detail, cost_formulas } = req.body;
  const db = getDb();
  const costItems = db.prepare('SELECT * FROM cost_items WHERE is_active = 1').all() as any[];
  const commissionItem = costItems.find((ci: any) => ci.name === '达人佣金');
  const formulas = getFormulas(db);
  const exchangeRate = getExchangeRate(db);

  const formulaMap: Record<string, string> = {};
  if (cost_formulas) {
    for (const [costItemId, formula] of Object.entries(cost_formulas)) {
      if (typeof formula === 'string' && formula.trim()) {
        formulaMap[costItemId] = formula;
      }
    }
  }

  const records = db.prepare('SELECT * FROM financial_records').all() as any[];
  const updateStmt = db.prepare(
    'UPDATE financial_records SET cost_detail=?, custom_cost_formulas=?, net_profit=?, total_investment=?, roi=? WHERE id=?'
  );

  const batch = db.transaction(() => {
    let updated = 0;
    for (const r of records) {
      const existing = JSON.parse(r.cost_detail || '{}');
      const existingCustom = JSON.parse(r.custom_cost_formulas || '{}');

      let merged = { ...existing };

      if (Object.keys(formulaMap).length > 0) {
        for (const ci of costItems) {
          if (existingCustom[ci.id]) continue;
          const globalFormula = ci.formula || formulaMap[ci.id];
          if (globalFormula && globalFormula.trim()) {
            const product = db.prepare('SELECT * FROM products WHERE id = ?').get(r.product_id) as any;
            if (product) {
              const ctx: import('./shared').CalcContext = {
                售价: product.sell_price || 0,
                采购成本: product.cost_price || 0,
                产品重量: product.weight || 0,
                MYR兑RMB汇率: exchangeRate,
              };
              const val = evaluateFormula(globalFormula, ctx);
              if (ci.value_format === 'percentage') {
                merged[ci.id] = val;
              } else {
                merged[ci.id] = val;
              }
            }
          }
        }
      } else {
        if (cost_detail) merged = { ...existing, ...cost_detail };
      }

      if (commissionItem && existing[commissionItem.id]) {
        merged[commissionItem.id] = existing[commissionItem.id];
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(r.product_id) as any;
      if (!product) continue;
      const calc = calculateProductFinance(product, merged, costItems, exchangeRate, formulas, existingCustom);
      updateStmt.run(JSON.stringify(merged), JSON.stringify(existingCustom),
        calc['净利润'] || 0, calc['总投入'] || 0, calc['整体ROI'] || 0, r.id);
      updated++;
    }
    return updated;
  });
  const updated = batch();
  res.json({ success: true, updated });
});

// PUT /records/:id
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const { product_id, cost_detail, custom_cost_formulas } = req.body;
  const db = getDb();
  const record = db.prepare('SELECT * FROM financial_records WHERE id = ?').get(req.params.id) as any;
  if (!record) return res.status(404).json({ error: '记录不存在' });

  const pid = product_id || record.product_id;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(pid) as any;
  const parsedCostDetail = cost_detail || JSON.parse(record.cost_detail || '{}');
  const parsedCustomFormulas = custom_cost_formulas !== undefined
    ? custom_cost_formulas
    : JSON.parse(record.custom_cost_formulas || '{}');

  const costItems = db.prepare('SELECT * FROM cost_items WHERE is_active = 1').all() as any[];
  const formulas = getFormulas(db);
  const exchangeRate = getExchangeRate(db);

  const calc = calculateProductFinance(product, parsedCostDetail, costItems, exchangeRate, formulas, parsedCustomFormulas);

  db.prepare(
    `UPDATE financial_records SET product_id=?, cost_detail=?, custom_cost_formulas=?, net_profit=?, total_investment=?, roi=? WHERE id=?`
  ).run(pid, JSON.stringify(parsedCostDetail), JSON.stringify(parsedCustomFormulas),
    calc['净利润'] || 0, calc['总投入'] || 0, calc['整体ROI'] || 0, req.params.id);

  res.json({ success: true, ...calc });
});

// DELETE /records/:id
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM financial_records WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /recalculate — 重算所有记录
router.post('/recalculate', authMiddleware, (_req: Request, res: Response) => {
  const db = getDb();
  const costItems = db.prepare('SELECT * FROM cost_items WHERE is_active = 1').all() as any[];
  const formulas = getFormulas(db);
  const exchangeRate = getExchangeRate(db);

  const records = db.prepare('SELECT * FROM financial_records').all() as any[];
  const update = db.prepare('UPDATE financial_records SET net_profit=?, total_investment=?, roi=? WHERE id=?');

  const batchUpdate = db.transaction(() => {
    for (const r of records) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(r.product_id) as any;
      if (!product) continue;
      const costDetail = JSON.parse(r.cost_detail || '{}');
      const customCostFormulas = JSON.parse(r.custom_cost_formulas || '{}');
      const calc = calculateProductFinance(product, costDetail, costItems, exchangeRate, formulas, customCostFormulas);
      update.run(calc['净利润'] || 0, calc['总投入'] || 0, calc['整体ROI'] || 0, r.id);
    }
  });
  batchUpdate();
  res.json({ success: true, recalculated: records.length });
});

// POST /sync-products — 同步产品到核算记录
router.post('/sync-products', authMiddleware, (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const products = db.prepare('SELECT * FROM products').all() as any[];
    const costItems = db.prepare('SELECT * FROM cost_items WHERE is_active = 1').all() as any[];
    const formulas = getFormulas(db);
    const exchangeRate = getExchangeRate(db);
    const commissionItem = costItems.find((ci: any) => ci.name === '达人佣金');

    let added = 0;
    const insertStmt = db.prepare(`INSERT INTO financial_records (product_id, cost_detail, net_profit, total_investment, roi) VALUES (?, '{}', 0, 0, 0)`);

    const sync = db.transaction(() => {
      for (const p of products) {
        const existing = db.prepare('SELECT * FROM financial_records WHERE product_id = ?').get(p.id) as any;
        if (!existing) { insertStmt.run(p.id); added++; }
        if (commissionItem && p.commission) {
          const record = existing || db.prepare('SELECT * FROM financial_records WHERE product_id = ?').get(p.id) as any;
          if (record) {
            const costDetail = JSON.parse(record.cost_detail || '{}');
            if (!costDetail[commissionItem.id]) {
              costDetail[commissionItem.id] = p.commission;
              db.prepare("UPDATE financial_records SET cost_detail = ? WHERE id = ?").run(JSON.stringify(costDetail), record.id);
            }
          }
        }
      }
      const records = db.prepare('SELECT * FROM financial_records').all() as any[];
      const updateCalc = db.prepare('UPDATE financial_records SET net_profit=?, total_investment=?, roi=? WHERE id=?');
      for (const r of records) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(r.product_id) as any;
        if (!product) continue;
        const costDetail = JSON.parse(r.cost_detail || '{}');
        const customCostFormulas = JSON.parse(r.custom_cost_formulas || '{}');
        const calc = calculateProductFinance(product, costDetail, costItems, exchangeRate, formulas, customCostFormulas);
        updateCalc.run(calc['净利润'] || 0, calc['总投入'] || 0, calc['整体ROI'] || 0, r.id);
      }
    });
    sync();
    res.json({ success: true, total_products: products.length, added });
  } catch (e: any) {
    console.error('[sync-products] Error:', e.message);
    res.status(500).json({ error: `同步失败: ${e.message}` });
  }
});

// GET /summary
router.get('/summary', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { product_id } = req.query;
  let sql = `SELECT SUM(p.sell_price) as total_revenue, SUM(fr.net_profit) as total_profit, SUM(fr.total_investment) as total_investment
             FROM financial_records fr LEFT JOIN products p ON fr.product_id = p.id WHERE 1=1`;
  const params: any[] = [];
  if (product_id) { sql += ` AND fr.product_id = ?`; params.push(product_id); }
  const row = db.prepare(sql).get(...params) as any;
  const totalRevenue = row.total_revenue || 0;
  const totalProfit = row.total_profit || 0;
  const totalInvestment = row.total_investment || 0;
  const overallRoi = totalInvestment > 0 ? Math.round(totalProfit / totalInvestment * 10000) / 100 : 0;
  res.json({
    total_revenue: Math.round(totalRevenue * 100) / 100,
    total_profit: Math.round(totalProfit * 100) / 100,
    total_investment: Math.round(totalInvestment * 100) / 100,
    overall_roi: overallRoi,
  });
});

// GET /records/export
router.get('/export', authMiddleware, (_req: Request, res: Response) => {
  const db = getDb();
  const records = db.prepare(`
    SELECT fr.*, p.name as product_name, p.sku, p.sell_price, p.cost_price
    FROM financial_records fr LEFT JOIN products p ON fr.product_id = p.id
    ORDER BY fr.id DESC
  `).all() as any[];

  const costItems = db.prepare('SELECT * FROM cost_items WHERE is_active = 1').all() as any[];
  const formulas = getFormulas(db);
  const exchangeRate = getExchangeRate(db);

  for (const r of records) {
    r.cost_detail = JSON.parse(r.cost_detail || '{}');
    const customCostFormulas = JSON.parse(r.custom_cost_formulas || '{}');
    const calc = calculateProductFinance(r, r.cost_detail, costItems, exchangeRate, formulas, customCostFormulas);
    Object.assign(r, calc);
    r.gross_margin = calc['毛利率'] || 0;
    r.breakeven_roi = calc['保本ROI'] || 0;
    r.total_investment = calc['总投入'] || 0;
    r.net_profit = calc['净利润'] || 0;
    r.roi = calc['整体ROI'] || 0;
  }
  res.json({ records, formulas });
});

export default router;
