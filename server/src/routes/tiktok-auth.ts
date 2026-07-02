import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';
import { generateAuthUrl, exchangeAuthCode, refreshAccessToken } from '../services/tiktok-oauth';

const router = Router();

/**
 * POST /api/shops/tiktok/auth-url
 * 生成 TikTok Shop OAuth 授权跳转 URL
 * Body: { redirect_uri?: string }  — 不传则使用 FRONTEND_URL 环境变量
 */
router.post('/auth-url', authMiddleware, (req: Request, res: Response) => {
  try {
    const redirectUri = req.body.redirect_uri || process.env.FRONTEND_URL || 'http://localhost:5173';
    // 授权成功后 TikTok 回调到前端，前端拿到 code 再调 /callback 接口
    const authUrl = generateAuthUrl(`${redirectUri}/shops`);
    res.json({ auth_url: authUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/shops/tiktok/callback
 * 用 TikTok 回调的 auth_code 换取 token，并创建/更新店铺
 * Body: { code: string, state?: string }
 */
router.post('/callback', authMiddleware, async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: '缺少授权码 code' });
  }

  try {
    // 1. 用 code 换取 token
    const tokenData = await exchangeAuthCode(code);

    // 2. 保存到数据库
    const db = getDb();

    // 计算 token 过期时间
    const expiresAt = tokenData.access_token_expire_in
      ? new Date(Date.now() + tokenData.access_token_expire_in * 1000).toISOString()
      : null;

    // 检查是否已存在该店铺（通过 open_id 或 shop_id 匹配）
    const existingShop = tokenData.open_id
      ? db.prepare('SELECT id FROM tiktok_shops WHERE open_id = ? OR shop_id = ?').get(tokenData.open_id, tokenData.open_id) as any
      : db.prepare('SELECT id FROM tiktok_shops WHERE name = ?').get(tokenData.seller_name || 'TikTok Shop') as any;

    const region = tokenData.seller_base_region || 'MY';
    const shopName = tokenData.seller_name || `TikTok Shop (${region})`;

    if (existingShop) {
      // 更新已有店铺
      db.prepare(`
        UPDATE tiktok_shops SET
          name = ?, region = ?, status = 'active',
          access_token = ?, refresh_token = ?, token_expires_at = ?,
          shop_cipher = ?, open_id = ?, last_synced_at = datetime('now')
        WHERE id = ?
      `).run(
        shopName, region,
        tokenData.access_token, tokenData.refresh_token, expiresAt,
        tokenData.open_id || '', tokenData.open_id || '',
        existingShop.id
      );
      res.json({ success: true, updated: true, shop_id: existingShop.id, shop_name: shopName });
    } else {
      // 创建新店铺
      const result = db.prepare(`
        INSERT INTO tiktok_shops (name, region, status, access_token, refresh_token, token_expires_at, shop_cipher, open_id, shop_id, app_key, app_secret)
        VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        shopName, region,
        tokenData.access_token, tokenData.refresh_token, expiresAt,
        tokenData.open_id || '', tokenData.open_id || '', tokenData.open_id || '',
        process.env.TIKTOK_APP_KEY || '',
        process.env.TIKTOK_APP_SECRET || ''
      );
      res.json({ success: true, created: true, shop_id: result.lastInsertRowid, shop_name: shopName });
    }
  } catch (e: any) {
    console.error('[TikTok OAuth] 回调处理失败:', e.message);
    res.status(500).json({ error: `授权失败: ${e.message}` });
  }
});

/**
 * POST /api/shops/tiktok/:id/refresh-token
 * 刷新指定店铺的 access_token
 */
router.post('/:id/refresh-token', authMiddleware, async (req: Request, res: Response) => {
  const db = getDb();
  const shop = db.prepare('SELECT * FROM tiktok_shops WHERE id = ?').get(req.params.id) as any;
  if (!shop) return res.status(404).json({ error: '店铺不存在' });
  if (!shop.refresh_token) return res.status(400).json({ error: '该店铺无 refresh_token，请重新授权' });

  try {
    const tokenData = await refreshAccessToken(shop.refresh_token);
    const expiresAt = tokenData.access_token_expire_in
      ? new Date(Date.now() + tokenData.access_token_expire_in * 1000).toISOString()
      : null;

    db.prepare(`
      UPDATE tiktok_shops SET
        access_token = ?, refresh_token = ?, token_expires_at = ?, last_synced_at = datetime('now')
      WHERE id = ?
    `).run(tokenData.access_token, tokenData.refresh_token, expiresAt, req.params.id);

    res.json({ success: true, message: 'Token 刷新成功' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/shops/tiktok/status
 * 检查 OAuth 配置是否就绪
 */
router.get('/status', (_req: Request, res: Response) => {
  const app_key = process.env.TIKTOK_APP_KEY;
  const app_secret = process.env.TIKTOK_APP_SECRET;
  const configured = !!(app_key && app_secret && app_key !== 'your_app_key_here' && app_secret !== 'your_app_secret_here');
  res.json({
    configured,
    message: configured ? 'TikTok OAuth 已配置' : '请在 server/.env 中配置 TIKTOK_APP_KEY 和 TIKTOK_APP_SECRET',
    redirect_uri: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shops`,
  });
});

export default router;
