/**
 * TikTok Marketing API / Ads OAuth 授权与 Token 管理
 * 用于获取 TikTok 广告账号的 access_token
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import getDb from '../db';

const router = Router();

// 基础配置
const APP_ID = process.env.TT_ADS_APP_ID || '7641162218708434960';
const APP_SECRET = process.env.TT_ADS_APP_SECRET || '9c1115593f6199a22eecb3777b7890cbdb8c5445';
const REDIRECT_URI = process.env.TT_ADS_REDIRECT_URI || 'https://risewise.yangyue.com.cn/api/tiktok-ads/callback';

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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return json;
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

    console.log('[TikTok Ads] 收到 OAuth 回调, auth_code:', authorizationCode.slice(0, 8) + '***');

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
    db.exec(`
      INSERT INTO settings (key, value) VALUES ('tt_ads_access_token', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [accessToken]);
    if (refreshToken) {
      db.exec(`
        INSERT INTO settings (key, value) VALUES ('tt_ads_refresh_token', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [refreshToken]);
    }
    db.exec(`
      INSERT INTO settings (key, value) VALUES ('tt_ads_advertiser_ids', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [JSON.stringify(advertiserIds)]);

    console.log('[TikTok Ads] ✅ access_token 已保存');

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
    const db = getDb();
    const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'tt_ads_access_token'").get() as any;
    const advRow = db.prepare("SELECT value FROM settings WHERE key = 'tt_ads_advertiser_ids'").get() as any;
    const hasToken = !!(tokenRow?.value);
    res.json({
      hasToken,
      advertiserIds: advRow?.value ? JSON.parse(advRow.value) : [],
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
