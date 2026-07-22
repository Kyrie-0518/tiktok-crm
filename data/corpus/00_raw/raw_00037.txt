import getDb from '../../db';
import { FormulaItem, CalcContext } from './shared';
import { evaluateFormula, getFormulas } from './formulas';
import { getExchangeRate } from './exchange';

/** 核心利润计算引擎 */
export function calculateProductFinance(
  product: any,
  costDetail: Record<string, number>,
  costItems: any[],
  exchangeRate: number,
  formulas: FormulaItem[],
  customCostFormulas?: Record<string, string>
) {
  const ctx: CalcContext = {
    售价: product.sell_price || 0,
    采购成本: product.cost_price || 0,
    产品重量: product.weight || 0,
    MYR兑RMB汇率: exchangeRate,
  };

  let myrTotalRmb = 0;
  const sellPrice = product.sell_price || 0;
  const parsedCustom = customCostFormulas || {};

  for (const ci of costItems) {
    let rawVal: number;
    const customFormula = parsedCustom[ci.id];
    const globalFormula = ci.formula;

    if (customFormula && customFormula.trim()) {
      rawVal = evaluateFormula(customFormula, ctx);
    } else if (globalFormula && globalFormula.trim()) {
      rawVal = evaluateFormula(globalFormula, ctx);
    } else {
      rawVal = costDetail[ci.id] || 0;
    }

    const val = ci.value_format === 'percentage'
      ? Math.round(sellPrice * rawVal / 100 * 100) / 100
      : rawVal;
    if (ci.currency === 'MYR') {
      const rmbVal = Math.round(val * exchangeRate * 100) / 100;
      ctx[ci.name] = rmbVal;
      myrTotalRmb += rmbVal;
    } else {
      ctx[ci.name] = val;
    }
  }
  ctx['MYR成本合计RMB'] = Math.round(myrTotalRmb * 100) / 100;

  const sorted = [...formulas].sort((a, b) => a.sort_order - b.sort_order);
  const results: Record<string, number> = {};

  for (const f of sorted) {
    const val = evaluateFormula(f.expression, ctx);
    results[f.name] = val;
    ctx[f.name] = val;
  }

  return results;
}
