/**
 * TikTok Marketing API / Ads OAuth 授权与 Token 管理
 * 用于获取 TikTok 广告账号的 access_token
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import getDb from '../db';
import { getTokenStatus, tiktokAdsPost } from '../services/tiktok-ads';

const router = Router();

// 基础配置
const APP_ID = process.env.TT_ADS_APP_ID || '7641162218708434960';
const APP_SECRET = process.env.TT_ADS_APP_SECRET || '9c1115593f6199a22eecb3777b7890cbdb8c5445';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bvefdvp.cn';
const REDIRECT_URI = process.env.TT_ADS_REDIRECT_URI || `${FRONTEND_URL}/ad-accounts`;

// ── 工具函数 ──

function buildAuthUrl(state: string): string {
  const redirect = encodeURIComponent(REDIRECT_URI);
  return `https://business-api.tiktok.com/portal/auth?app_id=${APP_ID}&state=${state}&redirect_uri=${redirect}`;
}

async function exchangeAuthCode(authCode: string) {
  const body = {
    app_id: APP_ID,
    secret: APP_SECRET,
    auth_code: authCode,
    grant_type: 'authorization_code',
  };

  return tiktokAdsPost('/open_api/v1.3/oauth2/access_token/', body);
}

async function saveAccountsCache(idsArray: string[]) {
  try {
    const { getAdvertisersInfo, getAdvertiserBalance } = await import('../services/tiktok-ads');
    const nameMap: Record<string, string> = {};
    const infoMap: Record<string, { country?: string }> = {};
    const balanceMap: Record<string, any> = {};

    try {
      const infoRes = await getAdvertisersInfo(idsArray);
      (infoRes?.data?.list || []).forEach((item: any) => {
        const id = item.advertiser_id;
        const name = item.advertiser_name || item.name;
        if (name) nameMap[id] = name;
        infoMap[id] = { country: item.country || '' };
      });
    } catch { /* ignore */ }
    try {
      const balance = await getAdvertiserBalance(idsArray);
      (balance?.data?.list || []).forEach((b: any) => { balanceMap[b.advertiser_id] = b; });
    } catch { /* ignore */ }

    const cache = idsArray.map((id: string) => ({
      advertiser_id: id,
      advertiser_name: nameMap[id] || id,
      status: 'ACTIVE',
      country: infoMap[id]?.country || undefined,
      balance_info: balanceMap[id] || null,
    }));
    console.log('[tiktok-ads] saveAccountsCache:', JSON.stringify(cache));
    getDb().prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_accounts_cache', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(cache));
    return { cached: true };
  } catch {
    const fallback = idsArray.map((id: string) => ({ advertiser_id: id, advertiser_name: id, status: 'ACTIVE', balance_info: null }));
    getDb().prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_accounts_cache', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(fallback));
    return { cached: false };
  }
}

async function saveTokenData(accessToken: string, refreshToken: string | undefined, advertiserIds: any) {
  const db = getDb();
  db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_access_token', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(accessToken);
  if (refreshToken) {
    db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_refresh_token', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(refreshToken);
  }
  const idsArray = Array.isArray(advertiserIds) ? advertiserIds : (advertiserIds ? [advertiserIds] : []);
  db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_advertiser_ids', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(idsArray));
  await saveAccountsCache(idsArray);
  return { accessToken, advertiserIds: idsArray };
}

async function handleAuthCodeAndSave(authCode: string) {
  const result = await exchangeAuthCode(authCode);
  if (result.code !== 0) throw new Error(result.message || '换取 token 失败');

  const data = result.data || {};
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  if (!accessToken) throw new Error('响应中缺少 access_token');
  return saveTokenData(accessToken, refreshToken, data.advertiser_ids || data.advertiser_id || []);
}


// ── 路由 ──

// GET /api/tiktok-ads/auth-url — 获取 TikTok 广告授权 URL
router.get('/auth-url', authMiddleware, (req: Request, res: Response) => {
  const state = (req.query.state as string) || 'bozone-auth';
  res.json({
    success: true,
    authUrl: buildAuthUrl(state),
    appId: APP_ID,
    redirectUri: REDIRECT_URI,
  });
});

// POST /api/tiktok-ads/exchange-code — 前端用 auth_code 换 token（回调地址现在是 /ad-accounts）
router.post('/exchange-code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authCode = req.body.auth_code || req.body.code;
    if (!authCode) return res.status(400).json({ success: false, error: '缺少 auth_code' });

    const result = await handleAuthCodeAndSave(authCode as string);
    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('[TikTok Ads] 换 token 失败:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/tiktok-ads/callback — 兼容旧版回调（保留，避免已配置 redirect_uri 的应用报错）
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const authCode = (req.query.auth_code || req.query.code) as string;
    if (!authCode) {
      return res.status(400).json({ success: false, error: '缺少 auth_code 参数' });
    }
    await handleAuthCodeAndSave(authCode);
    res.redirect('/ad-accounts');
  } catch (e: any) {
    console.error('[TikTok Ads] 回调处理失败:', e.message);
    console.error('[TikTok Ads] 错误堆栈:', e.stack);
    res.status(500).json({ success: false, error: e.message, stack: e.stack });
  }
});

// GET /api/tiktok-ads/token-status — 查看当前是否已保存 token
router.get('/config', authMiddleware, (_req: Request, res: Response) => {
  res.json({
    success: true,
    appId: APP_ID,
    appSecret: APP_SECRET,
    redirectUri: REDIRECT_URI,
  });
});

// POST /api/tiktok-ads/save-token — 前端直接换到 token 后保存
router.post('/save-token', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { access_token, refresh_token, advertiser_ids } = req.body;
    if (!access_token) return res.status(400).json({ success: false, error: '缺少 access_token' });
    const result = await saveTokenData(access_token, refresh_token, advertiser_ids);
    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('[TikTok Ads] 保存 token 失败:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/tiktok-ads/token-status — 查看当前是否已保存 token
router.get('/token-status', authMiddleware, (_req: Request, res: Response) => {
  try {
    res.json(getTokenStatus());
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
