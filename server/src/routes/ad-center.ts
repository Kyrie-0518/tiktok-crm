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

    try {
      const authResult = await Ads.getMyAdvertisers();
      const authList = authResult?.data?.list || [];
      advertiserIds = authList.map((a: any) => a.advertiser_id).filter(Boolean);
      authList.forEach((a: any) => { if (a.advertiser_name) baseNameMap[a.advertiser_id] = a.advertiser_name; });
      // 更新数据库中的 advertiser_ids
      db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_advertiser_ids', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(advertiserIds));
    } catch (e: any) { console.error('[ad-center] getMyAdvertisers failed:', e.message); }

    if (advertiserIds.length === 0) return res.json({ success: true, data: [] });

    const infoMap: Record<string, { promotion_area?: string }> = {};
    const balanceMap: Record<string, any> = {};

    // 批量调 advertiserInfo 拉 promotion_area
    try {
      const infoRes = await Ads.getAdvertisersInfo(advertiserIds);
      console.log('[ad-center] advertisersInfo raw:', JSON.stringify(infoRes?.data?.list?.slice(0, 2)));
      (infoRes?.data?.list || []).forEach((item: any) => {
        const id = item.advertiser_id;
        if (item.advertiser_name) baseNameMap[id] = item.advertiser_name;
        infoMap[id] = { promotion_area: item.promotion_area || '' };
      });
    } catch (e: any) { console.error('[ad-center] getAdvertisersInfo failed:', e.message); }
    // 批量调 getAdvertiserBalance 拉余额
    try {
      const balance = await Ads.getAdvertiserBalance(advertiserIds);
      console.log('[ad-center] advertiserBalance raw:', JSON.stringify(balance?.data?.list));
      (balance?.data?.list || []).forEach((b: any) => { balanceMap[b.advertiser_id] = b; });
    } catch (e: any) { console.error('[ad-center] getAdvertiserBalance failed:', e.message); }

    const list = advertiserIds.map((id: string) => ({
      advertiser_id: id,
      advertiser_name: baseNameMap[id] || id,
      status: 'ACTIVE',
      promotion_area: infoMap[id]?.promotion_area || undefined,
      balance_info: balanceMap[id] || null,
    }));
    console.log('[ad-center] refreshed advertisers list:', JSON.stringify(list));
    db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_accounts_cache', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(list));

    res.json({ success: true, data: list, refreshed: true });
  } catch (e: any) {
    res.json({ success: true, data: [], error: e.message });
  }
});

// GET /api/ad-center/campaigns — 广告系列列表
router.get('/campaigns', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, page, page_size, status, objective_type } = req.query;
    const result = await Ads.getCampaigns({
      advertiser_id: advertiser_id as string || '',
      page: Number(page) || 1,
      page_size: Number(page_size) || 50,
      status: status as string || undefined,
      objective_type: objective_type as string || undefined,
    });
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

// POST /api/ad-center/campaign/:id/status — 更新系列状态
router.post('/campaign/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, status } = req.body;
    const result = await Ads.updateCampaignStatus(advertiser_id as string, req.params.id, status);
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

// POST /api/ad-center/campaign/:id — 更新系列
router.post('/campaign/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, ...updates } = req.body;
    const result = await Ads.updateCampaign(advertiser_id as string, req.params.id, updates);
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

// GET /api/ad-center/adgroups — 广告组列表
router.get('/adgroups', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, campaign_id, page, page_size, status } = req.query;
    const result = await Ads.getAdgroups({
      advertiser_id: advertiser_id as string || '',
      campaign_id: campaign_id as string || undefined,
      page: Number(page) || 1,
      page_size: Number(page_size) || 50,
      status: status as string || undefined,
    });
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

// GET /api/ad-center/ads — 广告列表
router.get('/ads', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, adgroup_id, campaign_id, page, page_size, status } = req.query;
    const result = await Ads.getAds({
      advertiser_id: advertiser_id as string || '',
      adgroup_id: adgroup_id as string || undefined,
      campaign_id: campaign_id as string || undefined,
      page: Number(page) || 1,
      page_size: Number(page_size) || 50,
      status: status as string || undefined,
    });
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

// POST /api/ad-center/ad/:id/status — 更新广告状态
router.post('/ad/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, status } = req.body;
    const result = await Ads.updateAdStatus(advertiser_id as string, req.params.id, status);
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

// GET /api/ad-center/reports — 广告报表
router.get('/reports', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, start_date, end_date, dimensions, metrics, level, page, page_size } = req.query;
    const result = await Ads.getReport({
      advertiser_id: advertiser_id as string || '',
      start_date: start_date as string || '',
      end_date: end_date as string || '',
      dimensions: dimensions ? (dimensions as string).split(',') : undefined,
      metrics: metrics ? (metrics as string).split(',') : undefined,
      level: level as string || undefined,
      page: Number(page) || 1,
      page_size: Number(page_size) || 100,
    });
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

// GET /api/ad-center/rules — 自动化规则列表
router.get('/rules', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, page, page_size } = req.query;
    const result = await Ads.getOptimizerRules({
      advertiser_id: advertiser_id as string || '',
      page: Number(page) || 1,
      page_size: Number(page_size) || 50,
    });
    res.json({ success: true, data: result?.data || result });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
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
    res.json({ success: false, error: e.message });
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
    res.json({ success: false, error: e.message });
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
