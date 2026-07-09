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
const REDIRECT_URI = process.env.TT_ADS_REDIRECT_URI || 'https://bvefdvp.cn/api/tiktok-ads/callback';

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

  try {
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
  } catch (fetchErr: any) {
    console.error('[TikTok Ads] fetch 异常:', fetchErr.message, fetchErr.cause || '', fetchErr.code || '');
    throw new Error(`fetch failed: ${fetchErr.message}${fetchErr.cause ? ' | ' + fetchErr.cause.message : ''}`);
  }
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

// GET /api/tiktok-ads/callback — TikTok OAuth 回调
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { auth_code, code, state } = req.query;
    const authorizationCode = (auth_code || code) as string;

    if (!authorizationCode) {
      return res.status(400).json({ success: false, error: '缺少 auth_code 参数' });
    }

    const result = await exchangeAuthCode(authorizationCode);

    if (result.code !== 0) {
      return res.status(400).json({
        success: false,
        error: result.message || '换取 token 失败',
        detail: result,
      });
    }

    const data = result.data || {};
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    const advertiserIds = data.advertiser_ids || data.advertiser_id || [];

    if (!accessToken) {
      return res.status(400).json({ success: false, error: '响应中缺少 access_token', detail: result });
    }

    // 保存到 settings 表
    const db = getDb();
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('tt_ads_access_token', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(accessToken);
    if (refreshToken) {
      db.prepare(`
        INSERT INTO settings (key, value) VALUES ('tt_ads_refresh_token', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(refreshToken);
    }
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('tt_ads_advertiser_ids', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(JSON.stringify(advertiserIds));

    // 返回成功页面（用户可关闭）
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #059669;">TikTok 广告授权成功</h1>
          <p>access_token 已自动保存到系统。</p>
          <p>广告账号ID: ${Array.isArray(advertiserIds) ? advertiserIds.join(', ') : advertiserIds}</p>
          <p style="margin-top: 24px; color: #666;">请回到虾掌柜系统继续操作。</p>
        </body>
      </html>
    `);
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

// POST /api/tiktok-ads/save-token — 手动写入 token（绕过服务器网络限制）
router.post('/save-token', authMiddleware, (req: Request, res: Response) => {
  try {
    const { access_token, refresh_token, advertiser_ids } = req.body;
    if (!access_token) return res.status(400).json({ success: false, error: '缺少 access_token' });

    const db = getDb();
    db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_access_token', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(access_token);
    if (refresh_token) {
      db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_refresh_token', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(refresh_token);
    }
    if (advertiser_ids) {
      db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_advertiser_ids', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`)      .run(JSON.stringify(advertiser_ids));
    }

    res.json({ success: true, message: 'Token 已保存' });
  } catch (e: any) {
    console.error('[TikTok Ads] 手动写入 token 失败:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
