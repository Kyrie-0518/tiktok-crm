/**
 * 广告中心 API 路由
 * 双通道：
 * - SDK 直连：TikTok Business API SDK (tiktok-business-api-sdk-official)
 * - MCP 通道：TikTok for Business MCP Server（给欧文 AI 用）
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import getDb from '../db';
import {
  connectToMCPServer,
  getAvailableTools,
  getMCPStatus,
  callMCPTool,
} from '../services/tiktok-mcp/client';
import * as Ads from '../services/tiktok-ads';

const router = Router();

// ══════════════════════════════════════
//  通用错误处理：检测 token 过期
// ══════════════════════════════════════

function handleApiError(e: any, res: Response) {
  const msg = e?.message || String(e);
  // TikTok 401 / token 过期错误码（只有 10102 和 40001 是 token 相关的，40002 是字段错误不归这里）
  if (/HTTP 401|code 10102|code 40001|Expired credentials|invalid_token/i.test(msg)) {
    console.warn('[ad-center] 检测到 token 过期:', msg.slice(0, 200));
    return res.json({
      success: false,
      error: 'token_expired',
      message: 'TikTok Ads 授权已过期，请前往 [广告账户] 页面重新授权',
      details: msg,
    });
  }
  // TikTok 账户欠费
  if (/in debt|AccessDenied|insufficient_balance|code 40100/i.test(msg)) {
    console.warn('[ad-center] 检测到账户欠费:', msg.slice(0, 200));
    return res.json({
      success: false,
      error: 'account_in_debt',
      message: 'TikTok Ads 账户欠费（API 返回：Current user is in debt）\n请前往 https://ads.tiktok.com 充值或还款后重试',
      details: msg,
    });
  }
  return res.json({ success: false, error: msg });
}

// ══════════════════════════════════════
//  通用缓存助手（缓解流量引擎菜单加载慢）
// ══════════════════════════════════════

const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

interface CachedResult<T = any> {
  data: T;
  cached: boolean;
  last_updated: number;
}

async function getCachedOrFetch<T = any>(
  cacheKey: string,
  fetcher: () => Promise<{ data: T } | T>,
  opts: { forceRefresh?: boolean; ttl?: number } = {}
): Promise<CachedResult<T>> {
  const db = getDb();
  const tsKey = `${cacheKey}__ts`;
  const ttl = opts.ttl ?? CACHE_TTL;
  const forceRefresh = opts.forceRefresh === true;

  if (!forceRefresh) {
    const cacheRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(cacheKey) as any;
    const tsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(tsKey) as any;
    if (cacheRow?.value && tsRow?.value) {
      const lastUpdated = Number(tsRow.value);
      if (Date.now() - lastUpdated < ttl) {
        try {
          return { data: JSON.parse(cacheRow.value), cached: true, last_updated: lastUpdated };
        } catch { /* 解析失败则忽略缓存 */ }
      }
    }
  }

  const raw = await fetcher();
  const data: T = (raw as any)?.data ?? (raw as T);
  const now = Date.now();
  try {
    db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(cacheKey, JSON.stringify(data));
    db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(tsKey, String(now));
  } catch (e) { console.error('[ad-center] cache write failed:', e); }
  return { data, cached: false, last_updated: now };
}

// ══════════════════════════════════════
//  SDK 直连通道（流量引擎图表/表格）
// ══════════════════════════════════════

// GET /api/ad-center/advertisers — 广告账户列表 + 余额
router.get('/advertisers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const status = Ads.getTokenStatus();
    if (!status.hasToken) {
      return res.json({ success: true, data: [], unauthorized: true, message: 'TikTok Ads 尚未授权' });
    }

    const forceRefresh = req.query.refresh === '1';
    const db = getDb();

    // 普通加载：直接读数据库缓存
    if (!forceRefresh) {
      const cacheRow = db.prepare("SELECT value FROM settings WHERE key = 'tt_ads_accounts_cache'").get() as any;
      if (cacheRow?.value) {
        try { return res.json({ success: true, data: JSON.parse(cacheRow.value) }); } catch { /* ignore */ }
      }
      // 无缓存：返回 ID 列表
      const ids = status.advertiserIds || [];
      return res.json({ success: true, data: ids.map((id: string) => ({
        advertiser_id: id, advertiser_name: id, status: 'ACTIVE', balance_info: null,
      })) });
    }

    // 强制刷新：先获取最新广告主列表，再拉详情和余额
    let advertiserIds: string[] = [];
    let baseNameMap: Record<string, string> = {};

    // 1. 优先用 settings 表里保存的 advertiser_ids（OAuth 时存的，最可靠）
    const savedIdsRow = db.prepare("SELECT value FROM settings WHERE key = 'tt_ads_advertiser_ids'").get() as any;
    if (savedIdsRow?.value) {
      try { advertiserIds = JSON.parse(savedIdsRow.value); } catch {}
    }
    // 2. 备用方案：调 /oauth2/advertiser/get/ 拿最新列表
    try {
      const authResult = await Ads.getMyAdvertisers();
      const authList = authResult?.data?.list || [];
      const freshIds = authList.map((a: any) => a.advertiser_id).filter(Boolean);
      if (freshIds.length > 0) {
        advertiserIds = freshIds;
        authList.forEach((a: any) => {
          if (a.advertiser_name || a.name) baseNameMap[a.advertiser_id] = a.advertiser_name || a.name;
        });
        // 更新保存的 ID 列表
        db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_advertiser_ids', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(advertiserIds));
      }
    } catch (e: any) { console.error('[ad-center] getMyAdvertisers failed:', e.message); }

    // 3. 兜底：如果两者都没有，放弃
    if (advertiserIds.length === 0) {
      console.warn('[ad-center] no advertiser_ids available, returning empty');
      return res.json({ success: true, data: [], error: 'no_advertiser_ids' });
    }
    console.log(`[ad-center] refreshing ${advertiserIds.length} advertisers`);

    const infoMap: Record<string, { country?: string; currency?: string; timezone?: string; balance?: number; name?: string }> = {};
    const balanceMap: Record<string, any> = {};

    // 4. 批量调 advertiserInfo 拉详情（name/currency/timezone/country/balance）
    try {
      const infoRes = await Ads.getAdvertisersInfo(advertiserIds);
      const list = (infoRes?.data?.list || []) as any[];
      console.log(`[ad-center] advertiserInfo 返回 ${list.length} 条，首条 keys:`, Object.keys(list[0] || {}));
      list.forEach((item: any) => {
        const id = item.advertiser_id;
        // TikTok v1.3 标准字段：name（中文名）。v1.2 是 advertiser_name
        const name = item.name || item.advertiser_name;
        if (name) baseNameMap[id] = name;
        // 全部从 info 拉：currency / timezone / country / balance（如果返回了）
        infoMap[id] = {
          name: name || undefined,
          country: item.country || '',
          currency: item.currency || '',
          timezone: item.timezone || item.display_timezone || '',
          balance: typeof item.balance === 'number' ? item.balance : undefined,
        };
      });
    } catch (e: any) { console.error('[ad-center] getAdvertisersInfo failed:', e.message); }

    // 5. 批量调 getAdvertiserBalance 拉余额
    try {
      const balance = await Ads.getAdvertiserBalance(advertiserIds);
      console.log('[ad-center] advertiserBalance raw:', JSON.stringify(balance?.data?.list));
      (balance?.data?.list || []).forEach((b: any) => { balanceMap[b.advertiser_id] = b; });
    } catch (e: any) { console.error('[ad-center] getAdvertiserBalance failed:', e.message); }

    const list = advertiserIds.map((id: string) => {
      const balanceItem = balanceMap[id] || {};
      // 优先用 balanceMap（专用接口拉的），回退到 infoMap（info 接口返回的）
      const balance = balanceItem.balance ?? infoMap[id]?.balance ?? 0;
      const currency = balanceItem.currency || infoMap[id]?.currency || '';
      return {
        advertiser_id: id,
        advertiser_name: baseNameMap[id] || id,
        status: 'ACTIVE',
        country: infoMap[id]?.country || undefined,
        currency: currency || undefined,
        timezone: infoMap[id]?.timezone || undefined,
        balance_info: { balance, currency: currency || undefined },
      };
    });
    console.log('[ad-center] refreshed advertisers list:', JSON.stringify(list));
    db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_accounts_cache', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(list));

    res.json({ success: true, data: list, refreshed: true });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/campaigns — 广告系列列表（带缓存）
router.get('/campaigns', authMiddleware, async (req: Request, res: Response) => {
  try {
    const advertiserId = req.query.advertiser_id as string || '';
    const forceRefresh = req.query.force_refresh === '1';
    const cacheKey = `tt_ads_campaigns_${advertiserId}_${req.query.status || 'all'}_${req.query.objective_type || 'all'}`;
    const result = await getCachedOrFetch(cacheKey, () => Ads.getCampaigns({
      advertiser_id: advertiserId,
      page: Number(req.query.page) || 1,
      page_size: Number(req.query.page_size) || 50,
      status: req.query.status as string || undefined,
      objective_type: req.query.objective_type as string || undefined,
    }), { forceRefresh, ttl: 3 * 60 * 1000 });
    res.json({ success: true, data: result.data, cached: result.cached, last_updated: result.last_updated });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// POST /api/ad-center/campaign/:id/status — 更新系列状态
router.post('/campaign/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, status } = req.body;
    const result = await Ads.updateCampaignStatus(advertiser_id as string, req.params.id, status);
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// POST /api/ad-center/campaign/:id — 更新系列
router.post('/campaign/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, ...updates } = req.body;
    const result = await Ads.updateCampaign(advertiser_id as string, req.params.id, updates);
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/adgroups — 广告组列表（带缓存）
router.get('/adgroups', authMiddleware, async (req: Request, res: Response) => {
  try {
    const advertiserId = req.query.advertiser_id as string || '';
    const forceRefresh = req.query.force_refresh === '1';
    const cacheKey = `tt_ads_adgroups_${advertiserId}_${req.query.campaign_id || 'all'}_${req.query.status || 'all'}`;
    const result = await getCachedOrFetch(cacheKey, () => Ads.getAdgroups({
      advertiser_id: advertiserId,
      campaign_id: req.query.campaign_id as string || undefined,
      page: Number(req.query.page) || 1,
      page_size: Number(req.query.page_size) || 50,
      status: req.query.status as string || undefined,
    }), { forceRefresh, ttl: 3 * 60 * 1000 });
    res.json({ success: true, data: result.data, cached: result.cached, last_updated: result.last_updated });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/ads — 广告列表（带缓存）
router.get('/ads', authMiddleware, async (req: Request, res: Response) => {
  try {
    const advertiserId = req.query.advertiser_id as string || '';
    const forceRefresh = req.query.force_refresh === '1';
    const cacheKey = `tt_ads_ads_${advertiserId}_${req.query.campaign_id || 'all'}_${req.query.adgroup_id || 'all'}_${req.query.status || 'all'}`;
    const result = await getCachedOrFetch(cacheKey, () => Ads.getAds({
      advertiser_id: advertiserId,
      adgroup_id: req.query.adgroup_id as string || undefined,
      campaign_id: req.query.campaign_id as string || undefined,
      page: Number(req.query.page) || 1,
      page_size: Number(req.query.page_size) || 50,
      status: req.query.status as string || undefined,
    }), { forceRefresh, ttl: 3 * 60 * 1000 });
    res.json({ success: true, data: result.data, cached: result.cached, last_updated: result.last_updated });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// POST /api/ad-center/ad/:id/status — 更新广告状态
router.post('/ad/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, status } = req.body;
    const result = await Ads.updateAdStatus(advertiser_id as string, req.params.id, status);
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/reports — 广告报表（5min 缓存）
router.get('/reports', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, start_date, end_date, dimensions, metrics, level, page, page_size } = req.query;
    const forceRefresh = req.query.force_refresh === '1';
    const cacheKey = `tt_ads_reports_${advertiser_id}_${start_date}_${end_date}_${level || 'default'}`;
    const result = await getCachedOrFetch(cacheKey, () => Ads.getReport({
      advertiser_id: advertiser_id as string || '',
      start_date: start_date as string || '',
      end_date: end_date as string || '',
      dimensions: dimensions ? (dimensions as string).split(',') : undefined,
      metrics: metrics ? (metrics as string).split(',') : undefined,
      level: level as string || undefined,
      page: Number(page) || 1,
      page_size: Number(page_size) || 100,
    }), { forceRefresh });
    res.json({ success: true, data: result.data, cached: result.cached });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/rules — 自动化规则列表（带 5min 缓存）
router.get('/rules', authMiddleware, async (req: Request, res: Response) => {
  try {
    const advertiserId = req.query.advertiser_id as string || '';
    const forceRefresh = req.query.force_refresh === '1';
    const cacheKey = `tt_ads_rules_${advertiserId}`;
    const result = await getCachedOrFetch(cacheKey, () => Ads.getOptimizerRules({
      advertiser_id: advertiserId,
      page: Number(req.query.page) || 1,
      page_size: Number(req.query.page_size) || 50,
      status: req.query.status as string || undefined,
    }), { forceRefresh, ttl: 3 * 60 * 1000 });
    res.json({
      success: true,
      data: result.data,
      cached: result.cached,
      last_updated: result.last_updated,
    });
  } catch (e: any) {
    console.error('[ad-center] rules list failed:', e.message);
    return handleApiError(e, res);
  }
});

// POST /api/ad-center/rules — 创建自动化规则
router.post('/rules', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, name, conditions, actions, apply_objects, rule_exec_info, notification, tzone, lang } = req.body;
    if (!advertiser_id || !name) {
      return res.status(400).json({ success: false, error: '缺少 advertiser_id 或 name' });
    }
    const body = {
      advertiser_id,
      lang: lang || 'EN',
      rules: [{
        name,
        conditions: conditions || [],
        actions: actions || [],
        apply_objects: apply_objects || [{ dimension: 'CAMPAIGN', pre_condition_type: 'ALL' }],
        rule_exec_info: rule_exec_info || { exec_time_type: 'ALWAYS' },
        notification: notification || { notification_type: 'NONE' },
        tzone: tzone || 'UTC',
      }],
    };
    const result = await Ads.createOptimizerRule(body);
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// PUT /api/ad-center/rules/:id — 更新自动化规则（含启停）
router.put('/rules/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, name, conditions, actions, apply_objects, rule_exec_info, notification, tzone, lang, rule_status } = req.body;
    if (!advertiser_id) {
      return res.status(400).json({ success: false, error: '缺少 advertiser_id' });
    }
    const ruleData: any = {
      rule_id: req.params.id,
      name: name || 'Untitled Rule',
      conditions: conditions || [],
      actions: actions || [],
      apply_objects: apply_objects || [{ dimension: 'CAMPAIGN', pre_condition_type: 'ALL' }],
      rule_exec_info: rule_exec_info || { exec_time_type: 'ALWAYS' },
      notification: notification || { notification_type: 'NONE' },
      tzone: tzone || 'UTC',
    };
    // rule_status 用于控制规则启用/停用
    if (rule_status) ruleData.rule_status = rule_status;
    const body = {
      advertiser_id,
      lang: lang || 'EN',
      rules: [ruleData],
    };
    const result = await Ads.updateOptimizerRule(body);
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/rules/:id — 单条规则详情
router.get('/rules/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const advertiser_id = req.query.advertiser_id as string;
    if (!advertiser_id) return res.status(400).json({ success: false, error: '缺少 advertiser_id' });
    const result = await Ads.getOptimizerRuleDetail(advertiser_id, req.params.id);
    const ruleData = result?.data?.list?.[0] || result?.data || result;
    res.json({ success: true, data: ruleData });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// POST /api/ad-center/rules/:id/bind — 绑定作用对象
router.post('/rules/:id/bind', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, bind_info, lang } = req.body;
    if (!advertiser_id || !bind_info) {
      return res.status(400).json({ success: false, error: '缺少 advertiser_id 或 bind_info' });
    }
    const boundInfo = bind_info.map((b: any) => ({ ...b, rule_id: req.params.id }));
    const result = await Ads.bindOptimizerRule({
      advertiser_id,
      lang: lang || 'EN',
      bind_info: boundInfo,
    });
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/rules/:id/results — 规则执行结果
router.get('/rules/:id/results', authMiddleware, async (req: Request, res: Response) => {
  try {
    const advertiser_id = req.query.advertiser_id as string;
    if (!advertiser_id) return res.status(400).json({ success: false, error: '缺少 advertiser_id' });
    const result = await Ads.getOptimizerRuleResults({
      advertiser_id,
      rule_id: req.params.id,
      page: Number(req.query.page) || 1,
      page_size: Number(req.query.page_size) || 50,
    });
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/rules/:id/logs — 规则执行日志
router.get('/rules/:id/logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, page, page_size } = req.query;
    const result = await Ads.getOptimizerRuleLogs({
      advertiser_id: advertiser_id as string || '',
      rule_id: req.params.id,
      page: Number(page) || 1,
      page_size: Number(page_size) || 50,
    });
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/creatives — 创意素材列表
router.get('/creatives', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, page, page_size } = req.query;
    const result = await Ads.getCreativePortfolio({
      advertiser_id: advertiser_id as string || '',
      page: Number(page) || 1,
      page_size: Number(page_size) || 50,
    });
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// ══════════════════════════════════════
//  GMV Max 推广系列
// ══════════════════════════════════════

// GET /api/ad-center/gmv-max/campaigns — GMV Max 计划列表
router.get('/gmv-max/campaigns', authMiddleware, async (req: Request, res: Response) => {
  try {
    const advertiserId = req.query.advertiser_id as string || '';
    const gmvType = req.query.gmv_type as string || 'product'; // product | live
    const forceRefresh = req.query.force_refresh === '1';
    const cacheKey = `tt_ads_gmvmax_${advertiserId}_${gmvType}`;
    console.log(`[ad-center] gmv-max campaigns: advertiser=${advertiserId} type=${gmvType} forceRefresh=${forceRefresh}`);
    const result = await getCachedOrFetch(cacheKey, () => Ads.getGmvMaxCampaigns({
      advertiser_id: advertiserId,
      gmv_max_promotion_types: gmvType === 'live' ? ['LIVE_GMV_MAX'] : ['PRODUCT_GMV_MAX'],
      page: Number(req.query.page) || 1,
      page_size: Number(req.query.page_size) || 50,
      primary_status: req.query.status as string || undefined,
    }), { forceRefresh });
    const listLen = (result.data as any)?.list?.length || 0;
    console.log(`[ad-center] gmv-max campaigns 返回 ${listLen} 个 (cached=${result.cached})`);
    if (listLen > 0) console.log(`[ad-center] gmv-max 首条 keys:`, Object.keys((result.data as any).list[0]));
    res.json({ success: true, data: result.data, cached: result.cached });
  } catch (e: any) {
    console.error('[ad-center] gmv-max campaigns failed:', e.message);
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/gmv-max/campaigns/:id — 单个 GMV Max 计划详情
router.get('/gmv-max/campaigns/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const advertiserId = req.query.advertiser_id as string || '';
    const result = await Ads.getGmvMaxCampaignInfo(advertiserId, req.params.id);
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    return handleApiError(e, res);
  }
});

// GET /api/ad-center/gmv-max/report — GMV Max 专属报表（直接用 GMV Max campaign_id 维度）
router.get('/gmv-max/report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const advertiserId = req.query.advertiser_id as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const gmvType = (req.query.gmv_type as string) || 'product';
    if (!advertiserId || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: '缺少 advertiser_id / start_date / end_date' });
    }

    // 从已有 GMV Max campaigns 缓存里取 store_id
    const db = getDb();
    let storeId: string | null = null;
    const cacheRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(`tt_ads_gmvmax_${advertiserId}_${gmvType}`) as any;
    if (cacheRow?.value) {
      try {
        const cached = JSON.parse(cacheRow.value);
        if (cached?.list?.[0]?.store_id) storeId = cached.list[0].store_id;
      } catch {}
    }

    // 缓存没有就实时查一次
    if (!storeId) {
      console.log(`[ad-center] gmv-max/report: 无缓存，实时查 campaigns 拿 store_id`);
      const campRes = await Ads.getGmvMaxCampaigns({
        advertiser_id: advertiserId,
        gmv_max_promotion_types: gmvType === 'live' ? ['LIVE_GMV_MAX'] : ['PRODUCT_GMV_MAX'],
        page: 1, page_size: 1,
      });
      const campList = campRes?.data?.list || [];
      if (campList[0]?.store_id) storeId = campList[0].store_id;
    }
    if (!storeId) {
      return res.json({ success: false, error: 'no_store_id', message: '该账户下无 GMV Max 计划' });
    }
    console.log(`[ad-center] gmv-max/report: store_id=${storeId} type=${gmvType} dates=${startDate}~${endDate}`);

    const result = await Ads.getGmvMaxReport({
      advertiser_id: advertiserId,
      store_ids: [storeId],
      start_date: startDate,
      end_date: endDate,
      gmv_max_promotion_types: gmvType === 'live' ? ['LIVE'] : ['PRODUCT'],
      // 关键：去掉 stat_time_day（避免 30 天限制），只用 campaign_id 维度，范围最大 365 天
      dimensions: ['campaign_id'],
      metrics: ['cost', 'net_cost', 'orders', 'cost_per_order', 'gross_revenue', 'roi'],
      page_size: 200,
    });
    const listLen = (result as any)?.data?.list?.length || 0;
    console.log(`[ad-center] gmv-max/report 返回 ${listLen} 条`);
    if (listLen > 0) {
      console.log(`[ad-center] gmv-max/report 首条:`, JSON.stringify((result as any).data.list[0]).slice(0, 400));
    }
    // 把诊断信息塞到响应里
    const respData = (result as any)?.data || result;
    (respData as any).__debug = { storeId, startDate, endDate, gmvType, listLen, advertiserId };
    res.json({ success: true, data: respData });
  } catch (e: any) {
    console.error('[ad-center] gmv-max/report failed:', e.message);
    return handleApiError(e, res);
  }
});

// ══════════════════════════════════════
//  MCP 通道（给欧文 AI 智能体用）
// ══════════════════════════════════════

// POST /api/ad-center/mcp/connect — 连接 MCP Server
router.post('/mcp/connect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ok = await connectToMCPServer();
    if (ok) {
      res.json({ success: true, toolCount: getAvailableTools().length });
    } else {
      res.status(400).json({ success: false, error: getMCPStatus().error });
    }
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/ad-center/mcp/status — MCP 状态
router.get('/mcp/status', authMiddleware, (_req: Request, res: Response) => {
  const status = getMCPStatus();
  const tools = status.connected ? getAvailableTools().map((t: any) => ({ name: t.name, description: t.description })) : [];
  res.json({ ...status, tools });
});

// POST /api/ad-center/mcp/call — 通过 MCP 调用工具（给 AI 用）
router.post('/mcp/call', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { toolName, args } = req.body;
    if (!toolName) return res.status(400).json({ success: false, error: '缺少 toolName' });
    const result = await callMCPTool(toolName, args || {});
    if (result.error) return res.json({ success: false, error: result.error });
    res.json({ success: true, data: result.content });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
