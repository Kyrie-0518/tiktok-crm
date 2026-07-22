import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';
import {
  getAvailableChannels, callChannel, updateChannelStats,
  loadKnowledgeBase, Channel
} from './ai';

const router = Router();

// ========== 意图识别 ==========

type TaskType = 'daily_report' | 'weekly_report' | 'data_analysis' | 'profit_diagnosis' | 'influencer_report' | 'knowledge_qa';

interface TaskParams {
  date_from?: string;
  date_to?: string;
  date?: string;
  focus?: string;
  product_id?: number;
  shop_id?: number;
  question?: string;
  file_id?: number;
}

interface ParsedIntent {
  task: TaskType;
  params: TaskParams;
  originalQuery: string;
}

function parseIntent(query: string): ParsedIntent {
  const q = query.toLowerCase();
  const params: TaskParams = {};
  let task: TaskType = 'knowledge_qa';

  // Date extraction
  const datePatterns = [
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g,
    /(今天|昨天|前天|本周|上周|本月|上月|这个月|这个星期)/,
  ];
  for (const pattern of datePatterns) {
    const match = q.match(pattern);
    if (match) {
      const dateStr = match[0];
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');

      if (dateStr === '今天') params.date = `${yyyy}-${mm}-${dd}`;
      else if (dateStr === '昨天') {
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        params.date = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
      } else if (dateStr === '前天') {
        const d2 = new Date(today); d2.setDate(today.getDate() - 2);
        params.date = `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`;
      } else if (dateStr === '本周' || dateStr === '这个星期') {
        const dayOfWeek = today.getDay() || 7;
        const monday = new Date(today); monday.setDate(today.getDate() - dayOfWeek + 1);
        params.date_from = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
        params.date_to = `${yyyy}-${mm}-${dd}`;
      } else if (dateStr === '上周') {
        const dayOfWeek = today.getDay() || 7;
        const lastMonday = new Date(today); lastMonday.setDate(today.getDate() - dayOfWeek - 6);
        const lastSunday = new Date(today); lastSunday.setDate(today.getDate() - dayOfWeek);
        params.date_from = `${lastMonday.getFullYear()}-${String(lastMonday.getMonth()+1).padStart(2,'0')}-${String(lastMonday.getDate()).padStart(2,'0')}`;
        params.date_to = `${lastSunday.getFullYear()}-${String(lastSunday.getMonth()+1).padStart(2,'0')}-${String(lastSunday.getDate()).padStart(2,'0')}`;
      } else if (dateStr === '本月' || dateStr === '这个月') {
        params.date_from = `${yyyy}-${mm}-01`;
        params.date_to = `${yyyy}-${mm}-${dd}`;
      } else if (dateStr === '上月') {
        const lastMonth = new Date(yyyy, today.getMonth() - 1, 1);
        const lastDay = new Date(yyyy, today.getMonth(), 0);
        params.date_from = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth()+1).padStart(2,'0')}-01`;
        params.date_to = `${lastDay.getFullYear()}-${String(lastDay.getMonth()+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;
      } else if (dateStr.match(/^\d{4}/)) {
        const normalized = dateStr.replace(/\//g, '-');
        if (!params.date) params.date = normalized;
      }
      break;
    }
  }

  // Focus keyword detection
  if (/gmv|营收|收入|销售额/.test(q)) params.focus = 'GMV';
  else if (/利润|赚钱|亏|盈利|roi|毛利/.test(q)) params.focus = 'profit';
  else if (/达人|influencer|bd|kol/.test(q)) params.focus = 'influencer';
  else if (/素材|视频|内容|发布/.test(q)) params.focus = 'content';
  else if (/广告|ad|投放/.test(q)) params.focus = 'ad';

  // Intent classification (order matters — more specific first)
  if (/日[报|志|常]|今天|昨天|daily|今日/.test(q) && !/周/.test(q)) {
    task = 'daily_report';
  } else if (/周报|weekly|本周|上周|这周|一周/.test(q)) {
    task = 'weekly_report';
  } else if (/利润|亏[了|钱|损]|赚[了|钱]|roi|毛利[率]?|净利|不赚钱|成本[高|大]/.test(q)) {
    task = 'profit_diagnosis';
  } else if (/达人|influencer|bd汇|kol|博主|网红/.test(q) && /报|汇总|总结|统计/.test(q)) {
    task = 'influencer_report';
  } else if (/分析|数据|上传|excel|csv|文件|表格/.test(q) && !/知识|知道|什么是|怎么/.test(q)) {
    task = 'data_analysis';
  } else {
    task = 'knowledge_qa';
    params.question = query;
  }

  return { task, params, originalQuery: query };
}

// ========== 数据采集 ==========

function gatherOrderSummary(db: any, dateFrom?: string, dateTo?: string, shopId?: number) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const df = dateFrom || todayStr;
  const dt = dateTo || todayStr;

  // 订单概览：用 order_time 字段模糊匹配日期
  let orderWhere = `WHERE (
    o.order_time LIKE '${dt}%'
    OR (o.order_time LIKE '${dd}/${mm}/${yyyy}%')
  )`;
  const params: any[] = [];
  if (dateFrom && dateTo && dateFrom !== dateTo) {
    orderWhere = `WHERE (o.order_time >= ? AND o.order_time <= ?)`;
    params.push(dateFrom, dateTo + ' 23:59:59');
  }

  // 总数 + 金额
  const summary = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(o.actual_amount), 0) as total_gmv,
      COALESCE(SUM(o.taxes), 0) as total_taxes,
      COALESCE(SUM(o.shipping_fee), 0) as total_shipping
    FROM orders o
    ${orderWhere}
  `).all(...params);

  // 按状态分组
  const byStatus = db.prepare(`
    SELECT o.status, COUNT(*) as cnt
    FROM orders o
    ${orderWhere}
    GROUP BY o.status
  `).all(...params);

  // 按店铺分组
  const byShop = db.prepare(`
    SELECT s.name as shop_name, COUNT(*) as order_count,
           COALESCE(SUM(o.actual_amount), 0) as gmv
    FROM orders o
    LEFT JOIN tiktok_shops s ON o.shop_id = s.id
    ${orderWhere}
    GROUP BY o.shop_id
    ORDER BY gmv DESC
  `).all(...params);

  return { summary: summary[0] || {}, byStatus, byShop, dateFrom: df, dateTo: dt };
}

function gatherProductTop(db: any, dateFrom?: string, dateTo?: string, limit = 10) {
  try {
    const df = dateFrom || '';
    const dt = dateTo || '';
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (dateFrom && dateTo) {
      where += ` AND (o.order_time >= ? AND o.order_time <= ?)`;
      params.push(dateFrom, dateTo + ' 23:59:59');
    }
    const rows = db.prepare(`
      SELECT oi.product_name, SUM(oi.quantity) as total_qty,
             SUM(oi.amount) as total_amount, COUNT(DISTINCT o.id) as order_count
      FROM order_items oi
      LEFT JOIN orders o ON oi.order_id = o.id
      ${where}
      GROUP BY oi.product_name
      ORDER BY total_amount DESC
      LIMIT ?
    `).all(...params, limit);
    return rows;
  } catch { return []; }
}

function gatherProfitOverview(db: any, dateFrom?: string, dateTo?: string) {
  try {
    const exchangeRateRow = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rate'").get() as any;
    const exchangeRate = exchangeRateRow ? parseFloat(exchangeRateRow.value) : 1.55;

    const df = dateFrom || '';
    const dt = dateTo || '';
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (dateFrom && dateTo) {
      where += ' AND created_at >= ? AND created_at <= ?';
      params.push(dateFrom, dateTo + ' 23:59:59');
    }

    const records = db.prepare(`
      SELECT * FROM financial_records ${where} ORDER BY created_at DESC LIMIT 200
    `).all(...params) as any[];

    if (records.length === 0) return { totalProfit: 0, avgROI: 0, productCount: 0, exchangeRate, records: [] };

    let totalProfit = 0;
    let totalInvestment = 0;
    for (const r of records) {
      const profit = parseFloat(r.profit_amount || r.net_profit || 0);
      const investment = parseFloat(r.investment || r.purchase_cost || 0);
      totalProfit += profit;
      totalInvestment += investment;
    }
    const avgROI = totalInvestment > 0 ? (totalProfit / totalInvestment * 100) : 0;

    return {
      totalProfit: Math.round(totalProfit * 100) / 100,
      avgROI: Math.round(avgROI * 100) / 100,
      productCount: records.length,
      exchangeRate,
      records: records.slice(0, 20),
    };
  } catch (e: any) {
    return { totalProfit: 0, avgROI: 0, productCount: 0, exchangeRate: 1.55, error: e.message };
  }
}

function gatherInfluencerSummary(db: any, dateFrom?: string, dateTo?: string) {
  try {
    const df = dateFrom || '';
    const dt = dateTo || '';

    // 达人总数
    const total = db.prepare('SELECT COUNT(*) as cnt FROM influencers').get() as any;

    // 本周新增
    let newWhere = '';
    const params: any[] = [];
    if (dateFrom && dateTo) {
      newWhere = 'WHERE created_at >= ? AND created_at <= ?';
      params.push(dateFrom, dateTo + ' 23:59:59');
    }
    const newCount = db.prepare(`SELECT COUNT(*) as cnt FROM influencers ${newWhere}`).get(...params) as any;

    // 寄样统计
    let sampleParams: any[] = [];
    let sampleWhere = '';
    if (dateFrom && dateTo) {
      sampleWhere = 'WHERE sample_sent_date >= ? AND sample_sent_date <= ?';
      sampleParams = [dateFrom, dateTo];
    }
    const samples = db.prepare(`
      SELECT COUNT(*) as total_sent, 
             SUM(CASE WHEN sample_received_date IS NOT NULL THEN 1 ELSE 0 END) as received
      FROM influencers ${sampleWhere}
    `).get(...sampleParams) as any;

    // Top 10 达人（按粉丝数）
    const topInfluencers = db.prepare(
      'SELECT name, tiktok_id, followers, cooperation_status FROM influencers WHERE followers > 0 ORDER BY followers DESC LIMIT 10'
    ).all() as any[];

    return {
      total: total?.cnt || 0,
      newCount: newCount?.cnt || 0,
      samplesSent: samples?.total_sent || 0,
      samplesReceived: samples?.received || 0,
      topInfluencers,
      dateFrom: df, dateTo: dt,
    };
  } catch { return { total: 0, newCount: 0, samplesSent: 0, samplesReceived: 0, topInfluencers: [] }; }
}

// ========== 知识库搜索 ==========

function searchKB(query: string, maxResults = 3) {
  const kb = loadKnowledgeBase();
  if (!kb || kb.length === 0) return [];

  const terms = query.replace(/[，,。\.！!？?\s]+/g, ' ').split(' ').filter(t => t.length >= 2);
  const scored = kb.map(article => {
    let score = 0;
    const titleLower = article.title.toLowerCase();
    const contentLower = article.content.toLowerCase();
    for (const term of terms) {
      const termLower = term.toLowerCase();
      const escaped = termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const titleCount = (titleLower.match(new RegExp(escaped, 'g')) || []).length;
      score += titleCount * 5;
      for (const kw of article.keywords) {
        if (kw.toLowerCase().includes(termLower) || termLower.includes(kw.toLowerCase())) score += 3;
      }
      const bodyCount = (contentLower.match(new RegExp(escaped, 'g')) || []).length;
      score += bodyCount;
    }
    return { ...article, score };
  });

  return scored.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, maxResults)
    .map(r => ({ title: r.title, file: r.file, content: r.content.slice(0, 2000), score: r.score }));
}

// ========== LLM 调用 ==========

async function callLLM(db: any, systemPrompt: string, userPrompt: string): Promise<string> {
  const channels = getAvailableChannels(db);
  if (channels.length === 0) return '(AI 渠道未配置，无法生成分析报告。请在 AI 渠道管理中配置 API。)';

  for (const channel of channels) {
    const result = await callChannel(channel, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 3000);
    if (result.success && result.data) {
      updateChannelStats(db, channel.id, true, result.latency || 0);
      return result.data.choices?.[0]?.message?.content || '(无返回内容)';
    } else {
      updateChannelStats(db, channel.id, false, result.latency || 0, result.error);
    }
  }
  return '(所有 AI 渠道调用均失败，请检查渠道配置)';
}

// ========== 系统提示词 ==========

const SYSTEM_PROMPTS: Record<TaskType, string> = {
  daily_report: `你是虾掌柜ERP的运营数据分析师，负责生成TikTok Shop跨境电商日报。
你的输出必须是Markdown格式，包含以下结构：
1. 核心指标表格（GMV、订单量、客单价、环比变化）
2. 各店铺表现表格
3. 异常预警（如果有）
4. 今日要点总结
要求：数据准确、格式规范、语言专业简洁。不要输出任何代码块标记。`,

  weekly_report: `你是虾掌柜ERP的运营数据分析师，负责生成TikTok Shop跨境电商周报。
你的输出必须是Markdown格式，包含以下结构：
1. 本周核心指标（GMV、订单量、利润、ROI，带环比）
2. 各店铺周表现表格
3. Top 10热销产品表格
4. 达人素材发布统计
5. 利润分析（Top5盈利/亏损产品）
6. 异常预警与下周建议
要求：数据驱动、洞察深入、可执行建议。不要输出任何代码块标记。`,

  data_analysis: `你是虾掌柜ERP的数据分析师，负责分析运营数据文件。
请基于用户提供的数据，选择合适分析框架（漏斗分析、人货场、AARRR、RFM分层、同期群、归因分析）进行深度分析。
输出结构：
1. 数据概览（时间跨度、总量、完整度）
2. 趋势分析（按时间维度的变化）
3. 框架分析（基于选定框架的深度分析）
4. 异常发现（如果有显著异常）
5. 行动建议（3-5条可执行建议）
要求：数据准确、逻辑清晰、建议可落地。不要输出任何代码块标记。`,

  profit_diagnosis: `你是虾掌柜ERP的财务分析师，负责诊断TikTok Shop利润问题。
你熟悉以下业务规则：
- 佣金费率：2026/07/25起为10.26%，此前为0%
- 平台支持费：2026/06/05起为0.45 MYR/单，此前为0
- 交易手续费：固定3.78%
- BXP费用：4.86%
- 跨境运费：产品重量×0.015×汇率
- 净利润公式：x=(实收-税费-运费)×汇率, y=Σ(数量×SKU采购成本), z=实收×(3.78%+4.86%+佣金)×汇率, a=平台费0.45×汇率, c=跨境运费, 净利润=x-y-z-a-c
输出结构：
1. 亏损/盈利总览
2. Top 5亏损产品及原因拆解
3. Top 5盈利产品
4. 系统性优化建议
要求：精准拆解每项成本、给出可落地建议。不要输出任何代码块标记。`,

  influencer_report: `你是虾掌柜ERP的达人BD数据分析师，负责生成达人合作汇报。
输出结构：
1. 达人合作总览（总数、新增、活跃数）
2. 寄样进度统计
3. Top 达人榜单（按粉丝数）
4. 合作状态分布
5. 下周BD计划建议
要求：数据清晰、建议实用。不要输出任何代码块标记。`,

  knowledge_qa: `你是虾掌柜ERP的跨境知识助手，基于系统知识库回答用户问题。
知识库涵盖：跨境电商基础、选品定价、财务核算、运营推广、TikTok专项、广告投放、物流供应链、数据分析、合规风险、工具案例。
回答要求：
1. 如果知识库有相关信息，基于知识库回答并注明来源
2. 如果知识库没有相关信息，基于你的专业知识回答但注明"以下为通用知识，仅供参考"
3. 回答简洁专业，结构化呈现
不要输出任何代码块标记。`,
};

// ========== 主端点 ==========

router.post('/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { query: rawQuery } = req.body;
    if (!rawQuery || typeof rawQuery !== 'string') {
      return res.status(400).json({ error: '请提供问题描述', hint: '示例：生成本周运营日报' });
    }

    const query = rawQuery.trim();
    const db = getDb();
    const intent = parseIntent(query);

    console.log(`[SKIIS-Chat] 意图: ${intent.task}, 参数:`, JSON.stringify(intent.params));

    // 1. 搜索知识库
    const kbResults = searchKB(query, 3);

    // 2. 采集业务数据
    let businessData: any = {};
    const df = intent.params.date_from || '';
    const dt = intent.params.date_to || '';

    switch (intent.task) {
      case 'daily_report': {
        const date = intent.params.date || dt || '';
        businessData.orders = gatherOrderSummary(db, date, date);
        businessData.topProducts = gatherProductTop(db, date, date, 5);
        break;
      }
      case 'weekly_report': {
        const ws = df || '';
        const we = dt || '';
        businessData.orders = gatherOrderSummary(db, ws, we);
        businessData.topProducts = gatherProductTop(db, ws, we, 10);
        businessData.profit = gatherProfitOverview(db, ws, we);
        businessData.influencers = gatherInfluencerSummary(db, ws, we);
        break;
      }
      case 'profit_diagnosis': {
        businessData.profit = gatherProfitOverview(db, df, dt);
        businessData.orders = gatherOrderSummary(db, df, dt);
        break;
      }
      case 'influencer_report': {
        businessData.influencers = gatherInfluencerSummary(db, df, dt);
        break;
      }
      case 'data_analysis': {
        businessData.orders = gatherOrderSummary(db, df, dt);
        businessData.topProducts = gatherProductTop(db, df, dt, 15);
        businessData.profit = gatherProfitOverview(db, df, dt);
        break;
      }
      case 'knowledge_qa': {
        // knowledge_qa only needs KB results
        businessData = {};
        break;
      }
    }

    // 3. 构建提示词
    const systemPrompt = SYSTEM_PROMPTS[intent.task];
    const kbContext = kbResults.length > 0
      ? `\n\n【知识库参考】\n` + kbResults.map(k => `### ${k.title}\n来源: ${k.file}\n${k.content}`).join('\n\n')
      : '';

    const userMessage = `## 用户查询
${query}

## 业务数据 (JSON)
\`\`\`json
${JSON.stringify(businessData, null, 2)}
\`\`\`
${kbContext}

## 指令
请根据以上数据生成分析报告。如果数据为空或异常少，请在报告中说明。`;

    // 4. 调用 LLM
    const analysis = await callLLM(db, systemPrompt, userMessage);

    // 5. 存储结果（日报/周报自动存入 skiis 表）
    let savedToDb = null;
    try {
      if (intent.task === 'daily_report' && intent.params.date) {
        const existing = db.prepare(
          'SELECT id FROM skiis_daily_logs WHERE log_date = ?'
        ).get(intent.params.date) as any;
        if (existing) {
          db.prepare("UPDATE skiis_daily_logs SET content = ?, created_at = datetime('now','localtime') WHERE id = ?")
            .run(analysis, existing.id);
          savedToDb = { table: 'skiis_daily_logs', id: existing.id, date: intent.params.date, action: 'updated' };
        } else {
          // No user_id context for automated saves, skip
          savedToDb = { note: '未关联用户，跳过自动存储' };
        }
      } else if (intent.task === 'weekly_report' && df) {
        const existing = db.prepare(
          'SELECT id FROM skiis_weekly_reports WHERE week_start = ?'
        ).get(df) as any;
        if (existing) {
          db.prepare(
            "UPDATE skiis_weekly_reports SET summary=?, data_analysis=?, created_at=datetime('now','localtime') WHERE id=?"
          ).run(analysis, '', existing.id);
          savedToDb = { table: 'skiis_weekly_reports', id: existing.id, week: df, action: 'updated' };
        } else {
          savedToDb = { note: '未关联用户，跳过自动存储' };
        }
      }
    } catch (e: any) {
      savedToDb = { error: e.message };
    }

    // 6. 返回
    res.json({
      success: true,
      task: intent.task,
      query: intent.originalQuery,
      params: intent.params,
      analysis,
      kbSources: kbResults.map(k => ({ title: k.title, file: k.file })),
      dataCount: {
        orders: Array.isArray(businessData.orders?.byShop) ? businessData.orders.byShop.length : 0,
        products: businessData.topProducts?.length || 0,
        influencers: businessData.influencers?.total || 0,
      },
      savedToDb,
    });
  } catch (e: any) {
    console.error('[SKIIS-Chat] 错误:', e);
    res.status(500).json({ error: '分析失败', detail: e.message });
  }
});

// ========== 快捷端点：直接获取任务数据 ==========

router.get('/data/:task', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { task } = req.params;
  const { date_from, date_to } = req.query;
  const df = (date_from as string) || '';
  const dt = (date_to as string) || '';

  let data: any = {};
  switch (task) {
    case 'orders':
      data = gatherOrderSummary(db, df, dt);
      break;
    case 'products':
      data = { topProducts: gatherProductTop(db, df, dt, 20) };
      break;
    case 'profit':
      data = gatherProfitOverview(db, df, dt);
      break;
    case 'influencers':
      data = gatherInfluencerSummary(db, df, dt);
      break;
    default:
      return res.status(400).json({ error: '未知任务类型', available: ['orders', 'products', 'profit', 'influencers'] });
  }
  res.json({ task, data, date_from: df, date_to: dt });
});

export default router;
