/**
 * TikTok Shop OAuth 授权路由
 * 对齐 Bozone 已验证的授权流程
 */
import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';
import {
  buildAuthUrl, exchangeCode, verifyState, refreshToken,
  testConnection, getAuthorizedShops,
} from '../services/tiktok-oauth';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ══════════════════════════════════════════════════════
// 1. POST /auth-url — 生成授权跳转URL (需要登录)
// ══════════════════════════════════════════════════════
router.post('/auth-url', authMiddleware, (_req: Request, res: Response) => {
  try {
    const { authUrl } = buildAuthUrl();
    res.json({ success: true, authUrl });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════
// 2. GET /callback — TikTok 授权回调 (公开接口，无需登录!)
//    TikTok 授权成功后重定向到这个地址
//    格式: /callback?code=xxx&state=yyy
// ══════════════════════════════════════════════════════
router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const error = req.query.error as string;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/shops?auth=error&message=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/shops?auth=error&message=missing_params`);
  }
  if (!verifyState(state)) {
    return res.redirect(`${FRONTEND_URL}/shops?auth=error&message=invalid_state`);
  }

  try {
    const token = await exchangeCode(code);
    await upsertShop(token);
    return res.redirect(`${FRONTEND_URL}/shops?auth=success&shop=${encodeURIComponent(token.shop_id)}`);
  } catch (e: any) {
    console.error('[TikTok OAuth] callback error:', e);
    return res.redirect(`${FRONTEND_URL}/shops?auth=error&message=${encodeURIComponent(e.message)}`);
  }
});

// ══════════════════════════════════════════════════════
// 3. POST /callback — 前端手动提交 auth_code (需要登录)
//    Body: { code: string }
// ══════════════════════════════════════════════════════
router.post('/callback', authMiddleware, async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, error: '缺少授权码 code' });

  try {
    const token = await exchangeCode(code);
    const result = await upsertShop(token);
    res.json({ success: true, shop_name: token.shop_name || `Shop ${token.shop_id.slice(-6)}`, ...result });
  } catch (e: any) {
    console.error('[TikTok OAuth] 手动回调失败:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════
// 4. POST /refresh — 刷新指定店铺的 access_token
//    Body: { shop_id: string }
// ══════════════════════════════════════════════════════
router.post('/refresh', authMiddleware, async (req: Request, res: Response) => {
  const { shop_id } = req.body;
  if (!shop_id) return res.status(400).json({ success: false, error: '缺少 shop_id' });

  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE shop_id = ?').get(shop_id) as any;
  if (!shop) return res.status(404).json({ success: false, error: '店铺不存在' });
  if (!shop.refresh_token) return res.status(400).json({ success: false, error: '该店铺无 refresh_token，请重新授权' });

  try {
    const newToken = await refreshToken(shop.refresh_token);
    const expiresAt = new Date(Date.now() + newToken.expires_in * 1000).toISOString();

    db.prepare(`
      UPDATE tiktok_shops SET
        access_token = ?, refresh_token = ?, token_expires_at = ?
      WHERE id = ?
    `).run(newToken.access_token, newToken.refresh_token, expiresAt, shop.id);

    res.json({ success: true, message: 'Token 刷新成功' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════
// 5. POST /test — 测试店铺 API 连接
//    Body: { id: number }
// ══════════════════════════════════════════════════════
router.post('/test', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, error: '缺少店铺 id' });

  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(id) as any;
  if (!shop) return res.status(404).json({ success: false, error: '店铺不存在' });

  let cipher = shop.shop_cipher;
  // 自动补全 shop_cipher
  if (!cipher && shop.access_token) {
    try {
      const shops = await getAuthorizedShops(shop.access_token);
      if (shops.length > 0) {
        cipher = shops[0].cipher;
        db.prepare('UPDATE tiktok_shops SET shop_cipher = ? WHERE id = ?').run(cipher, id);
      }
    } catch (e: any) { /* non-fatal */ }
  }

  try {
    const result = await testConnection(shop.access_token, cipher || undefined);
    res.json({ success: true, result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || '连接测试失败' });
  }
});

// ══════════════════════════════════════════════════════
// 6. GET /status — 检查 OAuth 配置状态
// ══════════════════════════════════════════════════════
router.get('/status', (_req: Request, res: Response) => {
  const appKey = process.env.TIKTOK_APP_KEY;
  const appSecret = process.env.TIKTOK_APP_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  const configured = !!(
    appKey && appKey !== 'your_app_key_here' &&
    appSecret && appSecret !== 'your_app_secret_here' &&
    redirectUri
  );
  res.json({
    configured,
    message: configured ? 'TikTok OAuth 已配置' : '请在 server/.env 中配置 TIKTOK_APP_KEY、TIKTOK_APP_SECRET 和 TIKTOK_REDIRECT_URI',
    redirect_uri: redirectUri || '(未配置)',
  });
});

// ══════════════════════════════════════════════════════
// Helper: 创建或更新店铺记录
// ══════════════════════════════════════════════════════
async function upsertShop(token: {
  access_token: string;
  refresh_token: string;
  shop_id: string;
  shop_cipher: string;
  shop_name?: string;
  expires_in: number;
  scope: string;
}) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM tiktok_shops WHERE shop_id = ?').get(token.shop_id) as any;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  if (existing) {
    // 更新已有店铺
    const updates: Record<string, any> = {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: expiresAt,
      sync_enabled: 1,
      product_sync_enabled: 1,
    };
    if (token.shop_cipher) updates.shop_cipher = token.shop_cipher;
    if (token.shop_name) updates.name = token.shop_name;

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(existing.id);
    db.prepare(`UPDATE tiktok_shops SET ${setClauses} WHERE id = ?`).run(...values);

    console.log(`[TikTok] 更新店铺: ${token.shop_name || token.shop_id} (id=${existing.id})`);
    return { updated: true, shop_id: existing.id };
  } else {
    // 创建新店铺
    const result = db.prepare(`
      INSERT INTO tiktok_shops (name, region, shop_id, shop_cipher, app_key, app_secret, access_token, refresh_token, token_expires_at, api_version, sync_enabled, product_sync_enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `).run(
      token.shop_name || `Shop ${token.shop_id.slice(-6)}`,
      'MY',
      token.shop_id,
      token.shop_cipher,
      process.env.TIKTOK_APP_KEY || '',
      process.env.TIKTOK_APP_SECRET || '',
      token.access_token,
      token.refresh_token,
      expiresAt,
      '202309',
      now
    );

    console.log(`[TikTok] 创建新店铺: ${token.shop_name || token.shop_id} (id=${result.lastInsertRowid})`);
    return { created: true, shop_id: result.lastInsertRowid };
  }
}

export default router;
