/**
 * TikTok Marketing API / Ads OAuth 授权与 Token 管理
 * 用于获取 TikTok 广告账号的 access_token
 */

import { Router, Request, Response } from 'express';
import { fetch, ProxyAgent } from 'undici';
import { authMiddleware } from '../middleware/auth';
import getDb from '../db';
import { getTokenStatus } from '../services/tiktok-ads';

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
  const url = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/';
  const body = {
    app_id: APP_ID,
    secret: APP_SECRET,
    auth_code: authCode,
    grant_type: 'authorization_code',
  };

  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    dispatcher,
  } as any);

  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

async function saveAccountsCache(idsArray: string[]) {
  try {
    const { getAdvertiserInfo, getAdvertiserBalance } = await import('../services/tiktok-ads');
    const timeout = <T>(p: Promise<T>, ms: number) =>
      Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
    const nameMap: Record<string, string> = {};
    const balanceMap: Record<string, any> = {};

    await Promise.all(idsArray.map(async (id: string) => {
      const info = await timeout(getAdvertiserInfo(id), 10000);
      const name = info?.data?.advertiser_name || info?.data?.name;
      if (name) nameMap[id] = name;
    }));
    const balance = await timeout(getAdvertiserBalance(idsArray), 10000);
    (balance?.data?.list || []).forEach((b: any) => { balanceMap[b.advertiser_id] = b; });

    const cache = idsArray.map((id: string) => ({
      advertiser_id: id,
      advertiser_name: nameMap[id] || id,
      status: 'ACTIVE',
      balance_info: balanceMap[id] || null,
    }));
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

async function handleAuthCodeAndSave(authCode: string) {
  const result = await exchangeAuthCode(authCode);
  if (result.code !== 0) throw new Error(result.message || '换取 token 失败');

  const data = result.data || {};
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const advertiserIds = data.advertiser_ids || data.advertiser_id || [];
  if (!accessToken) throw new Error('响应中缺少 access_token');

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
