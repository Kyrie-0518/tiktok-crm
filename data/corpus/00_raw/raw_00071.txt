/**
 * Evidence Builder — 把异常转为证据链，给 LLM 引用
 */
import { UnifiedData, RuleResult, Evidence, RiskItem } from './types';

export function buildEvidence(data: UnifiedData, rules: RuleResult[]): { evidence: Evidence[]; risks: RiskItem[] } {
  const evidence: Evidence[] = [];
  const risks: RiskItem[] = [];

  const categoryLabels: Record<string, string> = {
    traffic: '流量', conversion: '转化', inventory: '库存',
    logistics: '物流', pricing: '价格', ads: '广告', video: '视频',
  };

  for (const rule of rules) {
    const category = rule.category;
    const label = categoryLabels[category] || category;

    // 构建证据链
    const ev: Evidence = {
      category,
      before: '正常',
      after: `${rule.description}`,
      impact: rule.severity === 'P0' ? '高影响' : rule.severity === 'P1' ? '中影响' : '低影响',
      related_metrics: { [rule.metric]: String(rule.current_value) },
    };

    // 针对物流做增强
    if (category === 'logistics') {
      ev.before = `海外仓: ${data.logistics?.estimated_delivery || '?'}天`;
      ev.after = `跨境仓: ${data.logistics?.actual_delivery || '?'}天`;
      ev.related_metrics = {
        平均配送: `${data.logistics?.actual_delivery || '?'}天`,
        异常率: `${((data.logistics?.anomaly_rate || 0) * 100).toFixed(1)}%`,
      };
    }

    // 针对库存做增强
    if (category === 'inventory') {
      const totalStock = data.products.reduce((s: number, p: any) => s + (p.total_stock || 0), 0);
      ev.related_metrics = { 总库存: String(totalStock), 零库存商品: String(rule.current_value) };
    }

    evidence.push(ev);
    risks.push({
      category,
      label,
      score: rule.severity === 'P0' ? 5 : rule.severity === 'P1' ? 4 : rule.severity === 'P2' ? 3 : 2,
    });
  }

  // 无异常时也用健康数据填充
  if (evidence.length === 0) {
    evidence.push({
      category: 'overall', before: '正常', after: '正常',
      impact: '店铺各项指标正常', related_metrics: {},
    });
    risks.push({ category: 'overall', label: '健康', score: 1 });
  }

  return { evidence, risks };
}
