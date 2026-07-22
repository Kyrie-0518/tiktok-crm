/**
 * Rule Engine — 预定义规则检测异常（不调用 LLM）
 * 输出异常标识，供 Evidence Builder 使用
 */
import { UnifiedData, RuleResult } from './types';

export function runRules(data: UnifiedData): RuleResult[] {
  const rules: RuleResult[] = [];
  const { products, orders, ads, videos, logistics, traffic } = data;

  /* ── 流量异常 ── */
  if (traffic?.ctr > 0 && traffic.ctr < 0.02) {
    rules.push({ category: 'traffic', severity: 'P1', title: 'CTR 偏低',
      description: '商品整体点击率低于 2%', metric: 'CTR', current_value: traffic.ctr, threshold: 0.02, direction: 'too_low' });
  }
  if (traffic?.trend === 'down') {
    rules.push({ category: 'traffic', severity: 'P2', title: '流量下降趋势',
      description: '店铺流量呈下降趋势', metric: '流量趋势', current_value: 0, threshold: 0, direction: 'too_low' });
  }

  /* ── 转化异常 ── */
  if (orders.length > 0 && traffic?.total_clicks > 0) {
    const cvr = orders.length / traffic.total_clicks;
    if (cvr < 0.01) {
      rules.push({ category: 'conversion', severity: 'P1', title: 'CVR 异常偏低',
        description: `整体转化率 ${(cvr * 100).toFixed(2)}% 低于 1%`, metric: 'CVR',
        current_value: cvr, threshold: 0.01, direction: 'too_low' });
    }
  }

  /* ── 库存风险 ── */
  const zeroStock = products.filter((p: any) => (p.total_stock || 0) === 0).length;
  if (zeroStock > 0) {
    rules.push({ category: 'inventory', severity: 'P0', title: `${zeroStock} 件商品零库存`,
      description: '即将断货需要紧急补货', metric: '库存', current_value: zeroStock, threshold: 0, direction: 'too_low' });
  }

  /* ── 物流异常 ── */
  if (logistics?.actual_delivery > 7) {
    rules.push({ category: 'logistics', severity: 'P1', title: '配送时效过长',
      description: `平均配送时间 ${logistics.actual_delivery} 天`, metric: '配送天数',
      current_value: logistics.actual_delivery, threshold: 7, direction: 'too_high' });
  }
  if (logistics?.anomaly_rate > 0.05) {
    rules.push({ category: 'logistics', severity: 'P0', title: '物流异常率偏高',
      description: `物流异常率 ${(logistics.anomaly_rate * 100).toFixed(2)}%`, metric: '异常率',
      current_value: logistics.anomaly_rate, threshold: 0.05, direction: 'too_high' });
  }

  /* ── 广告异常 ── */
  const activeAds = ads.filter((a: any) => a.status === 'ACTIVE');
  const inefficientAds = activeAds.filter((a: any) => a.roas < 1).length;
  if (inefficientAds > 0) {
    rules.push({ category: 'ads', severity: 'P2', title: `${inefficientAds} 条广告 ROAS<1`,
      description: '这些广告花费大于产出', metric: 'ROAS', current_value: 0, threshold: 1, direction: 'too_low' });
  }

  /* ── 视频异常 ── */
  if (videos.length > 0) {
    const avgCtr = videos.reduce((s, v) => s + (v.ctr || 0), 0) / videos.length;
    if (avgCtr < 0.01) {
      rules.push({ category: 'video', severity: 'P2', title: '视频 CTR 偏低',
        description: `平均视频点击率 ${(avgCtr * 100).toFixed(2)}%`, metric: '视频CTR',
        current_value: avgCtr, threshold: 0.01, direction: 'too_low' });
    }
  }

  return rules;
}
