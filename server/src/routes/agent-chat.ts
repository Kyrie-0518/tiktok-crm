import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';
import {
  getAvailableChannels, callChannel, updateChannelStats,
  loadKnowledgeBase, Channel
} from './ai';
import * as Ads from '../services/tiktok-ads';
import { moderationMiddleware } from '../middleware/content-moderation';
import { logModelCall } from '../services/model-call-log';
import { createSession, getUserSessions, deleteSession, loadHistory, saveMessages, buildContext } from '../services/chat-memory';

const router = Router();

// ══════════════════════════════════════════════════════════════
//  欧文 Agent — 系统提示词（核心大脑）
// ══════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `你是「欧文」—— 跨境电商全栈运营智能体，专精 TikTok Shop 东南亚市场。
你拥有对本 ERP 系统所有模块数据（店铺、订单、产品、财务、达人、广告）的完全访问权限。

## ⭐ 内核——回复风格（必须遵守）

根据用户意图自动选择回复模式：

### 模式 A：快速查数
触发：用户只想知道一个数字。如"今天多少单"、"消耗多少"、"GMV"
回复：10-50字以内，直给数字。
格式：指标名 + 数字 + 虚拟表情 + 一句话结尾
示例：
  📊 今日GMV: 12,350 MYR | 订单: 1,856单 | 广告消耗: $106.38
  ✅ 整体平稳，需要我深入分析吗？

### 模式 B：简短分析
触发：用户问了2-3个数据点，或问"怎么样""正常吗"
回复：150-300字，含数据+一句话判断+1个建议
结尾反问引导下一轮

### 模式 C：深度报告
触发：用户说"复盘"/"诊断"/"分析"/"报告"
回复：完整 Markdown 结构化报告（表格+问题+建议+执行清单）

## ⚠️ 关键规则
- **必须调用工具函数获取数据，绝不能编造数字！**
- 每次回复末尾，都要问一句引导性反问，推动对话继续（如："需要我帮你查广告ROI吗？"/"要我对比一下昨天的数据吗？"）
- ⚠️ **广告数据强制规则**：查询广告花费/订单/ROI 时，**必须且只能**调用 get_tiktok_ad_data 获取实时 TikTok Ads 数据。禁止调用 get_ad_overview 来获取广告数据（那个表是空的/过时的）。
- 工具按需调用：get_shop_stats (店铺)、get_order_list (订单)、get_finance_overview (财务)、get_influencer_summary (达人)、get_ad_overview (仅历史账单)、get_tiktok_ad_data (⭐广告唯一来源⭐)、get_product_performance (产品)
- 默认查昨日数据
- 如果工具返回的数据为空或失败，如实说"暂无数据"

## 思考过程（必备）
每次回复前，先用一行简短描述你的判断：
> 【分析】用户意图=X | 需要调用的工具=Y | 回复模式=Z

## 业务知识
- TikTok Shop 市场：马来西亚(MYR)、泰国(THB)、越南(VND)、菲律宾(PHP)、新加坡(SGD)、印尼(IDR)
- 结算 MYR，汇率取 settings 表
- 核心指标：GMV、订单量、客单价、ROI、毛利率、退货率、发货时效、广告消耗

## 禁止
- 不要编造数字
- 模式A/B下不要长篇大论
- 不要同时调用 get_ad_overview 和 get_tiktok_ad_data（只调后者）
- 不要输出工具调用的技术细节`;

// ══════════════════════════════════════════════════════════════
//  Tool 函数定义 (OpenAI Function Calling 格式)
// ══════════════════════════════════════════════════════════════
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_shop_stats',
      description: '获取所有店铺或指定店铺的销售统计概览：GMV、订单数、SKU数、趋势数据。可用于了解整体运营状况。',
      parameters: {
        type: 'object',
        properties: {
          shop_id: { type: 'number', description: '指定店铺ID，不传则返回所有店铺汇总' },
          days: { type: 'number', description: '统计最近N天，默认1（昨天）', default: 1 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_order_list',
      description: '获取订单列表，支持按状态/店铺/日期筛选。可用于查发货状态、异常订单等。',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: '订单状态：pending(待处理)、processing(处理中)、shipped(已发货)、delivered(已签收)、cancelled(已取消)、returned(退货)' },
          shop_id: { type: 'number', description: '店铺ID' },
          date_from: { type: 'string', description: '开始日期 YYYY-MM-DD' },
          date_to: { type: 'string', description: '结束日期 YYYY-MM-DD' },
          limit: { type: 'number', description: '返回条数，默认50', default: 50 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_finance_overview',
      description: '获取财务利润总览：总收入、总成本（按费用类型拆解）、净利润、ROI。可选按日期范围筛选。',
      parameters: {
        type: 'object',
        properties: {
          shop_id: { type: 'number', description: '店铺ID' },
          date_from: { type: 'string', description: '开始日期 YYYY-MM-DD' },
          date_to: { type: 'string', description: '结束日期 YYYY-MM-DD' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_influencer_summary',
      description: '获取达人合作概况：达人数量、带货订单数、GMV贡献、佣金支出。可用于评估达人渠道表现。',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: '开始日期 YYYY-MM-DD' },
          date_to: { type: 'string', description: '结束日期 YYYY-MM-DD' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_ad_overview',
      description: '获取手动录入的广告账单数据（非 TikTok API）。如需真实 TikTok Ads 花费/订单/ROI，请优先使用 get_tiktok_ad_data 工具。',
      parameters: {
        type: 'object',
        properties: {
          shop_id: { type: 'number', description: '店铺ID' },
          date_from: { type: 'string', description: '开始日期 YYYY-MM-DD' },
          date_to: { type: 'string', description: '结束日期 YYYY-MM-DD' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_product_performance',
      description: '获取产品表现排行：热销TOP产品、滞销产品、库存预警。',
      parameters: {
        type: 'object',
        properties: {
          shop_id: { type: 'number' },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          limit: { type: 'number', description: '返回条数默认10', default: 10 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: '搜索跨境电商知识库（含佣金规则、物流政策、平台规则、选品策略等60+篇文档）。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词或问题' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_tiktok_ad_data',
      description: '获取 TikTok Ads 广告花费数据（GMV Max推广系列的真实花费/订单/ROI/收入等）。比 get_ad_overview 的 ad_bills 表更准确，来自 TikTok API 直连。',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: '开始日期 YYYY-MM-DD' },
          date_to: { type: 'string', description: '结束日期 YYYY-MM-DD' },
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_exchange_rate',
      description: '获取当前汇率配置（MYR→RMB等）。',
      parameters: { type: 'object', properties: {} }
    }
  }
];

// ══════════════════════════════════════════════════════════════
//  Tool 执行器
// ══════════════════════════════════════════════════════════════

async function executeTool(name: string, args: any): Promise<any> {
  const db = getDb();

  // 构建日期筛选条件（orders 用 order_time）
  function orderDateWhere(base: string, params: any[], prefix = 'o') {
    const parts: string[] = [];
    if (args.date_from) { parts.push(`DATE(${prefix}.order_time) >= ?`); params.push(args.date_from); }
    if (args.date_to) { parts.push(`DATE(${prefix}.order_time) <= ?`); params.push(args.date_to); }
    if (args.shop_id) { parts.push(`${prefix}.shop_id = ?`); params.push(args.shop_id); }
    return parts.length ? (base ? base + ' AND ' : 'WHERE ') + parts.join(' AND ') : base;
  }

  switch (name) {
    // ── 店铺统计 ──
    case 'get_shop_stats': {
      const days = args.days || 1;
      const d = new Date(); d.setDate(d.getDate() - days);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

      const params: any[] = [dateStr];
      let where = `WHERE DATE(o.order_time) >= ?`;
      if (args.shop_id) { where += ' AND o.shop_id = ?'; params.push(args.shop_id); }

      const orders = db.prepare(`
        SELECT o.shop_id, ts.name as shop_name, ts.region,
          COUNT(DISTINCT o.id) as order_count,
          COALESCE(SUM(CAST(o.actual_amount AS REAL)), 0) as total_gmv
        FROM orders o
        LEFT JOIN tiktok_shops ts ON o.shop_id = ts.id
        ${where}
        GROUP BY o.shop_id
        ORDER BY total_gmv DESC
      `).all(...params) as any[];

      const totalGMV = orders.reduce((s: number, o: any) => s + (o.total_gmv || 0), 0);
      const totalOrders = orders.reduce((s: number, o: any) => s + (o.order_count || 0), 0);

      return JSON.stringify({ period: dateStr, shops: orders, summary: { total_gmv: totalGMV.toFixed(2), total_orders: totalOrders, shop_count: orders.length } });
    }

    // ── 订单列表 ──
    case 'get_order_list': {
      const params: any[] = [];
      let where = '';
      if (args.shop_id) { where += (where ? ' AND ' : 'WHERE ') + 'o.shop_id = ?'; params.push(args.shop_id); }
      if (args.status) { where += (where ? ' AND ' : 'WHERE ') + 'o.status = ?'; params.push(args.status); }
      if (args.date_from) { where += (where ? ' AND ' : 'WHERE ') + 'DATE(o.order_time) >= ?'; params.push(args.date_from); }
      if (args.date_to) { where += (where ? ' AND ' : 'WHERE ') + 'DATE(o.order_time) <= ?'; params.push(args.date_to); }
      const limit = args.limit || 50;

      const orders = db.prepare(`
        SELECT o.id, o.order_no, o.status, o.actual_amount, o.logistics_status,
          ts.name as shop_name, DATE(o.order_time) as date, o.buyer_name
        FROM orders o
        LEFT JOIN tiktok_shops ts ON o.shop_id = ts.id
        ${where}
        ORDER BY o.order_time DESC
        LIMIT ?
      `).all(...params, limit) as any[];

      const statusSummary = db.prepare(`
        SELECT status, COUNT(*) as cnt FROM orders o ${where}
        GROUP BY status
      `).all(...params) as any[];

      return JSON.stringify({ orders, status_summary: statusSummary, total: orders.length });
    }

    // ── 财务利润总览（基于 financial_records + cost_items） ──
    case 'get_finance_overview': {
      const params: any[] = [];
      let where = '';
      if (args.shop_id) { where = 'WHERE p.shop_id = ?'; params.push(args.shop_id); }

      // 从 financial_records 表汇总
      const profit = db.prepare(`
        SELECT COUNT(*) as record_count,
          COALESCE(SUM(fr.total_investment), 0) as total_investment,
          COALESCE(SUM(fr.net_profit), 0) as net_profit,
          CASE WHEN COALESCE(SUM(fr.total_investment), 0) > 0
            THEN ROUND(COALESCE(SUM(fr.net_profit), 0) / SUM(fr.total_investment) * 100, 2)
            ELSE 0 END as roi_pct
        FROM financial_records fr
        JOIN products p ON fr.product_id = p.id
        ${where}
      `).all(...params) as any[];

      // 成本项列表
      const costItems = db.prepare(`
        SELECT name, currency, is_fixed FROM cost_items WHERE is_active = 1 ORDER BY id
      `).all() as any[];

      // 按店铺的订单收入汇总
      let orderRevenue: any[] = [];
      try {
        orderRevenue = db.prepare(`
          SELECT ts.name as shop_name,
            COUNT(DISTINCT o.id) as order_count,
            COALESCE(SUM(o.actual_amount), 0) as total_revenue
          FROM orders o
          LEFT JOIN tiktok_shops ts ON o.shop_id = ts.id
          ${args.shop_id ? 'WHERE o.shop_id = ?' : ''}
          ${args.date_from ? (args.shop_id ? 'AND' : 'WHERE') + ' DATE(o.order_time) >= ?' : ''}
          ${args.date_to ? (args.shop_id || args.date_from ? 'AND' : 'WHERE') + ' DATE(o.order_time) <= ?' : ''}
          GROUP BY o.shop_id
        `).all(
          ...(args.shop_id ? [args.shop_id] : []),
          ...(args.date_from ? [args.date_from] : []),
          ...(args.date_to ? [args.date_to] : [])
        ) as any[];
      } catch { /* ignore */ }

      return JSON.stringify({
        profit: profit[0] || { record_count: 0, total_investment: 0, net_profit: 0, roi_pct: 0 },
        cost_items: costItems,
        order_revenue: orderRevenue
      });
    }

    // ── 达人概况 ──
    case 'get_influencer_summary': {
      const params: any[] = [];
      let where = '';
      if (args.date_from) { where += (where ? ' AND ' : 'WHERE ') + 'created_at >= ?'; params.push(args.date_from); }
      if (args.date_to) { where += (where ? ' AND ' : 'WHERE ') + 'created_at <= ?'; params.push(args.date_to); }

      const summary = db.prepare(`
        SELECT
          COUNT(*) as total_count,
          SUM(CASE WHEN status = '已合作' OR status = '合作中' THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN status = '未回复' OR status = '待沟通' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN status = '已拒绝' OR status = '不合作' THEN 1 ELSE 0 END) as rejected_count
        FROM influencers
        ${where}
      `).all(...params) as any[];

      const byStatus = db.prepare(`
        SELECT status, COUNT(*) as cnt FROM influencers ${where} GROUP BY status ORDER BY cnt DESC
      `).all(...params) as any[];

      return JSON.stringify({ ...summary[0], by_status: byStatus, date_range: { from: args.date_from || '全部', to: args.date_to || '全部' } });
    }

    // ── 广告数据 ──
    case 'get_ad_overview': {
      // ad_bills 表可能不存在
      try {
        const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ad_bills'").get();
        if (!tableCheck) {
          return JSON.stringify({ notice: '广告账单模块暂未开启（ad_bills表不存在），广告花费请查看手动记录或平台后台。' });
        }

        const params: any[] = [];
        let where = '';
        if (args.shop_id) { where += (where ? ' AND ' : 'WHERE ') + 'shop_id = ?'; params.push(args.shop_id); }
        if (args.date_from) { where += (where ? ' AND ' : 'WHERE ') + 'DATE(period_start) >= ?'; params.push(args.date_from); }
        if (args.date_to) { where += (where ? ' AND ' : 'WHERE ') + 'DATE(period_start) <= ?'; params.push(args.date_to); }

        const ads = db.prepare(`
          SELECT shop_name, COUNT(*) as bill_count,
            COALESCE(SUM(amount), 0) as total_spend,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
          FROM ad_bills
          ${where}
          GROUP BY shop_name ORDER BY total_spend DESC
        `).all(...params) as any[];

        const totalSpend = ads.reduce((s: number, a: any) => s + (a.total_spend || 0), 0);
        return JSON.stringify({ ads, total_spend: totalSpend.toFixed(2) });
      } catch (e: any) {
        return JSON.stringify({ error: '广告数据查询失败：' + e.message });
      }
    }

    // ── 产品表现 ──
    case 'get_product_performance': {
      const params: any[] = [];
      let where = '';
      if (args.shop_id) { where += (where ? ' AND ' : 'WHERE ') + 'o.shop_id = ?'; params.push(args.shop_id); }
      if (args.date_from) { where += (where ? ' AND ' : 'WHERE ') + 'DATE(o.order_time) >= ?'; params.push(args.date_from); }
      if (args.date_to) { where += (where ? ' AND ' : 'WHERE ') + 'DATE(o.order_time) <= ?'; params.push(args.date_to); }
      const limit = args.limit || 10;

      const topProducts = db.prepare(`
        SELECT oi.product_name, oi.sku,
          COUNT(DISTINCT o.id) as order_count,
          COALESCE(SUM(oi.quantity), 0) as total_qty,
          COALESCE(SUM(oi.subtotal), 0) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        ${where}
        GROUP BY oi.product_name
        ORDER BY total_revenue DESC
        LIMIT ?
      `).all(...params, limit) as any[];

      return JSON.stringify({ top_products: topProducts });
    }

    // ── 知识库搜索 ──
    case 'search_knowledge': {
      const query = (args.query || '').toLowerCase();
      const kb = loadKnowledgeBase();
      if (!kb) return JSON.stringify([]);

      const results = kb
        .filter(doc => {
          const score =
            (doc.title.toLowerCase().includes(query) ? 5 : 0) +
            (doc.content.toLowerCase().includes(query) ? 3 : 0) +
            (doc.keywords?.some((kw: string) => query.includes(kw.toLowerCase())) ? 2 : 0);
          return score > 0;
        })
        .slice(0, 5)
        .map(doc => ({
          title: doc.title,
          // 截取相关内容段落（不超过500字）
          content: doc.content.slice(0, 500),
        }));

      return JSON.stringify(results);
    }

    // ── TikTok Ads 数据（实时调 TikTok Ads API 拿真实数据） ──
    case 'get_tiktok_ad_data': {
      const result: any = { accounts: [], date_from: args.date_from, date_to: args.date_to };
      try {
        // 1. 从 settings 表取所有授权广告主列表（含 advertiser_id + name）
        const accountsCache = db.prepare("SELECT value FROM settings WHERE key = 'tt_ads_accounts_cache'").get() as any;
        const accounts: any[] = accountsCache?.value ? JSON.parse(accountsCache.value) : [];
        if (accounts.length === 0) {
          return JSON.stringify({ notice: 'TikTok Ads 尚未授权任何广告账户', accounts: [] });
        }
        // 只查 enabled 的广告主
        const enabledAccounts = accounts.filter((a: any) => a.enabled !== false);
        if (enabledAccounts.length === 0) {
          return JSON.stringify({ notice: '所有广告账户都已被禁用，请前往"账户授权管理"启用', accounts: [] });
        }

        // 2. 默认 30 天范围（避免 stat_time_day 30 天限制 + 提供有意义数据）
        const dateFrom = args.date_from || (() => {
          const d = new Date(); d.setDate(d.getDate() - 29);
          return d.toISOString().slice(0, 10);
        })();
        const dateTo = args.date_to || new Date().toISOString().slice(0, 10);

        // 3. 对每个广告主：**优先读计划列表页面的缓存**（campaigns-with-details 含 store_id）
        for (const acc of enabledAccounts) {
          try {
            const advId = acc.advertiser_id;
            if (!advId) continue;

            let storeId: string | null = null;
            let campCount = 0;

            // ① 优先：读计划列表页面的缓存（含 store_id + info 详情）
            const detailCache = db.prepare("SELECT value FROM settings WHERE key = ?").get(`tt_ads_gmvmax_with_details_${advId}_product`) as any;
            if (detailCache?.value) {
              try {
                const detailData = JSON.parse(detailCache.value);
                const list = detailData.list || [];
                campCount = list.length;
                if (list[0]?.store_id) storeId = list[0].store_id;
              } catch {}
            }

            // ② 次选：store_id 专用缓存
            if (!storeId) {
              const storeCache = db.prepare("SELECT value FROM settings WHERE key = ?").get(`tt_ads_gmvmax_store_id_${advId}`) as any;
              if (storeCache?.value) storeId = storeCache.value;
            }

            // ③ 兜底：实时调 list + info 拿 store_id
            if (!storeId) {
              try {
                const listRes: any = await Ads.getGmvMaxCampaigns({
                  advertiser_id: advId,
                  gmv_max_promotion_types: ['PRODUCT_GMV_MAX'],
                  page: 1, page_size: 1,
                });
                const list = listRes?.data?.list || [];
                if (list[0]?.campaign_id) {
                  campCount = campCount || 1;
                  const infoRes: any = await Ads.getGmvMaxCampaignInfo(advId, list[0].campaign_id);
                  const info = (infoRes as any)?.data || infoRes || {};
                  if (info?.store_id) {
                    storeId = info.store_id;
                    try {
                      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(`tt_ads_gmvmax_store_id_${advId}`, storeId);
                    } catch {}
                  }
                }
              } catch (e: any) {
                console.warn(`[Kyrie] live fallback for store_id failed adv=${advId}:`, e.message);
              }
            }

            if (!storeId) {
              result.accounts.push({
                advertiser_id: advId,
                advertiser_name: acc.advertiser_name || acc.name || '',
                notice: '无 store_id（请联系技术支持确认该账号已授权 GMV Max 推广系列）',
                cost: '0.00', orders: 0, revenue: '0.00', roi: '0', campaign_count: campCount,
              });
              continue;
            }
            // 实时调 GMV Max report API
            const reportRes: any = await Ads.getGmvMaxReport({
              advertiser_id: advId,
              store_ids: [storeId],
              start_date: dateFrom,
              end_date: dateTo,
              gmv_max_promotion_types: ['PRODUCT'],
              dimensions: ['campaign_id'],
              metrics: ['cost', 'net_cost', 'orders', 'cost_per_order', 'gross_revenue', 'roi'],
              page_size: 200,
            });
            const reportList: any[] = reportRes?.data?.list || [];
            // 汇总
            let totalCost = 0, totalOrders = 0, totalRevenue = 0;
            reportList.forEach((r: any) => {
              const m = r.metrics || {};
              totalCost += Number(m.cost) || 0;
              totalOrders += Number(m.orders) || 0;
              totalRevenue += Number(m.gross_revenue) || 0;
            });
            result.accounts.push({
              advertiser_id: advId,
              advertiser_name: acc.advertiser_name || acc.name || '',
              campaign_count: campCount,
              cost: totalCost.toFixed(2),
              net_cost: reportList.reduce((s: number, r: any) => s + (Number(r.metrics?.net_cost) || 0), 0).toFixed(2),
              orders: totalOrders,
              revenue: totalRevenue.toFixed(2),
              roi: totalCost > 0 ? (totalRevenue / totalCost).toFixed(2) : '0',
              date_from: dateFrom,
              date_to: dateTo,
            });
          } catch (accErr: any) {
            result.accounts.push({
              advertiser_id: acc.advertiser_id,
              advertiser_name: acc.advertiser_name || '',
              notice: 'API 调用失败：' + (accErr.message || '未知错误'),
              cost: '0.00', orders: 0, revenue: '0.00', roi: '0',
            });
          }
        }
        // 4. 汇总
        const totalCost = result.accounts.reduce((s: number, a: any) => s + parseFloat(a.cost || '0'), 0);
        const totalOrders = result.accounts.reduce((s: number, a: any) => s + (a.orders || 0), 0);
        const totalRevenue = result.accounts.reduce((s: number, a: any) => s + parseFloat(a.revenue || '0'), 0);
        const totalCampaigns = result.accounts.reduce((s: number, a: any) => s + (a.campaign_count || 0), 0);
        result.summary = {
          account_count: result.accounts.length,
          campaign_count: totalCampaigns,
          total_cost: totalCost.toFixed(2),
          total_orders: totalOrders,
          total_revenue: totalRevenue.toFixed(2),
          total_roi: totalCost > 0 ? (totalRevenue / totalCost).toFixed(2) : '0',
        };
      } catch (e: any) {
        return JSON.stringify({ error: e.message, accounts: [] });
      }
      return JSON.stringify(result);
    }

    // ── 汇率 ──
    case 'get_exchange_rate': {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rate'").get() as any;
      if (row) {
        try {
          const data = JSON.parse(row.value);
          return JSON.stringify(data);
        } catch {
          // 旧格式
          return JSON.stringify({ MYR_to_RMB: row.value });
        }
      }
      return JSON.stringify({ MYR_to_RMB: '1.55' });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ══════════════════════════════════════════════════════════════
//  Agent 核心循环：LLM 决策 → 工具执行 → 结果分析 → 报告
// ══════════════════════════════════════════════════════════════

export // agentLoop 的变体：接收已构建好的 messages（带历史上下文）
async function agentLoopWithContext(channels: AiChannel[], messages: any[]): Promise<any> {
  const result = { report: '', toolCalls: [] as any[], toolCallsResult: [] as any[], totalTokens: 0 };
  for (let turn = 0; turn < 5; turn++) {
    const channel = channels[0];
    const start = Date.now();
    const tools = getToolDefinitions();
    try {
      const r = await callLLMApi(channel, messages, tools);
      result.totalTokens += r.usage?.total_tokens || 0;
      const msg = r.choices[0].message;
      if (msg.tool_calls) {
        messages.push(msg);
        const toolResults = [];
        for (const tc of msg.tool_calls) {
          const output = await executeToolCall(tc.function.name, JSON.parse(tc.function.arguments));
          toolResults.push({ id: tc.id, name: tc.function.name, content: typeof output === 'string' ? output : JSON.stringify(output) });
          messages.push({ role: 'tool', tool_call_id: tc.id, content: typeof output === 'string' ? output : JSON.stringify(output) });
          result.toolCalls.push({ tool: tc.function.name, args: tc.function.arguments, result: output });
        }
        result.toolCallsResult = toolResults;
      } else {
        messages.push(msg);
        result.report = msg.content || '';
        break;
      }
    } catch (e: any) {
      // 重试一次
      if (turn < 1) continue;
      result.report = '[error] AI 引擎执行失败: ' + e.message;
      break;
    }
  }
  return result;
}

async function agentLoop(channels: Channel[], userQuery: string, history: ChatMessage[] = []): Promise<{ report: string; toolCalls: any[] }> {
  // 注入实时日期信息到 system prompt
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const datePrompt = `\n\n## ⏰ 当前日期信息\n今天是 ${today}（${now.toLocaleDateString('zh-CN', { weekday: 'long' })}）。昨日是 ${yesterday}。所有"昨日数据"请以 ${yesterday} 为准。`;
  
  // 构建 messages：system + 历史 + 当前用户问题
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT + datePrompt },
    ...history.map((h: any) => ({
      role: h.role,
      content: h.content || '',
      ...(h.tool_calls ? { tool_calls: h.tool_calls } : {}),
      ...(h.tool_call_id ? { tool_call_id: h.tool_call_id } : {}),
    })),
    { role: 'user', content: userQuery }
  ];

  const executedTools: any[] = [];
  const MAX_TURNS = 5;  // 最多5轮工具调用

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // 调用 LLM（携带工具定义）
    const response = await callChannel(
      channels[0],
      messages,
      4000,
      undefined,
      TOOLS,
      'auto'
    );

    if (!response.success || !response.data) {
      return {
        report: `❌ AI 服务调用失败：${response.error || '未知错误'}`,
        toolCalls: executedTools
      };
    }

    const msg = response.data.choices?.[0]?.message;
    if (!msg) {
      return {
        report: `❌ AI 返回格式异常：${JSON.stringify(response.data).slice(0, 200)}`,
        toolCalls: executedTools
      };
    }

    // 检查是否有工具调用
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // 记录 Assistant 的工具调用请求
      messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });

      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        let toolArgs: any = {};
        try { toolArgs = JSON.parse(tc.function.arguments || '{}'); } catch { /* keep empty */ }

        // 执行工具
        const toolResult = await executeTool(toolName, toolArgs);
        executedTools.push({ tool: toolName, args: toolArgs, result_length: toolResult.length });

        // 将工具结果追加到消息
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResult
        });
      }
      continue;  // 继续下一轮，让 LLM 处理工具结果
    }

    // 没有工具调用 → LLM 已生成最终回复
    return {
      report: msg.content || '分析完成，但未生成报告内容。',
      toolCalls: executedTools
    };
  }

  // 超出最大轮数 → 让 LLM 基于已有数据强制生成
  messages.push({ role: 'user', content: '请基于以上已获取的数据，生成一份完整的分析报告。' });
  const finalResp = await callChannel(channels[0], messages, 4000);

  return {
    report: finalResp.data?.choices?.[0]?.message?.content || '无法生成报告。',
    toolCalls: executedTools
  };
}

// ══════════════════════════════════════════════════════════════
//  API 端点
// ══════════════════════════════════════════════════════════════

// POST /api/agent/chat

// GET /api/agent/sessions — 获取会话列表
router.get('/sessions', authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    res.json({ data: getUserSessions(userId) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/agent/sessions/:id — 删除会话
router.delete('/sessions/:id', authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    deleteSession(userId, req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/agent/chat-history?sessionId=xxx — 加载会话历史消息
router.get('/chat-history', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const sessionId = req.query.sessionId as string;
    if (!sessionId) { res.json({ data: [] }); return; }
    const rows = getDb().prepare(
      `SELECT role, content, created_at FROM chat_history WHERE session_id = ? AND user_id = ? ORDER BY id ASC LIMIT 200`
    ).all(sessionId, userId);
    res.json({ data: rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/chat', authMiddleware, moderationMiddleware('owen'), async (req: Request, res: Response) => {
  const { query, sessionId: reqSessionId } = req.body;
  const userId = (req as any).user?.userId;
  const sessionId = reqSessionId || createSession(userId, query.trim());
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: '请输入有效的查询内容' });
  }

  const db = getDb();
  const channels = getAvailableChannels(db);
  if (channels.length === 0) {
    return res.status(500).json({ error: '没有可用的 AI 渠道，请先在系统设置中配置 AI 模型' });
  }

  try {
    const startTime = Date.now();
    // --- 智能对话记忆：加载历史 + 构建上下文 ---
    const history = loadHistory(userId, sessionId);
// 直接调用 agentLoop，传入历史
    const result = await agentLoop(channels, query.trim(), history);
    // 保存本轮对话
    try {
      saveMessages(userId, sessionId, [
        { role: 'user', content: query.trim() },
        ...(result.toolCallsResult || []).map((tc: any) => ({ role: 'tool' as const, content: tc.content || '', tool_call_id: tc.id })),
        { role: 'assistant', content: result.report },
      ]);
    } catch (e) { console.warn('[memory] save failed', e); }
    const latency = Date.now() - startTime;

    // 记录渠道统计
    updateChannelStats(db, channels[0].id, true, latency);

    // 存储报告到数据库
    try {
      db.prepare(`
        INSERT INTO skiis_reports (type, title, content, data_summary, created_at)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      `).run('agent_chat', query.slice(0, 100), result.report, JSON.stringify(result.toolCalls));
    } catch { /* 静默，不影响响应 */ }

    // 记录模型调用日志（备案合规）
    logModelCall({
      userId: (req as any).user?.userId || 0,
      username: (req as any).user?.username || '',
      module: 'owen',
      modelName: channels[0]?.model || 'deepseek',
      inputPrompt: query.trim(),
      outputContent: result.report,
      latencyMs: latency,
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      status: 'success',
    });
    res.json({
      success: true,
      sessionId,
      query,
      report: result.report,
      toolCalls: result.toolCalls,
      latency_ms: latency
    });
  } catch (err: any) {
    console.error('[Agent] Error:', err);
    res.status(500).json({ error: err.message || 'Agent 处理失败' });
  }
});

// GET /api/agent/tools — 列出可用工具（调试用）
router.get('/tools', authMiddleware, (_req: Request, res: Response) => {
  res.json({ tools: TOOLS.map(t => t.function.name) });
});

export default router;
