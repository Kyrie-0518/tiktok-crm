/**
 * TikTok Shop OAuth 授权服务
 * 基于 Bozone 已验证的授权流程重构
 * Ref: https://partner.tiktokshop.com/docv2/page/67c83e0799a75104986ae498
 */
import crypto from 'node:crypto';

// ── 环境变量读取 ──
function env(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

function apiAppKey(): string {
  const k = env('TIKTOK_APP_KEY');
  if (!k) throw new Error('TIKTOK_APP_KEY 未配置');
  return k;
}

function apiAppSecret(): string {
  const s = env('TIKTOK_APP_SECRET');
  if (!s) throw new Error('TIKTOK_APP_SECRET 未配置');
  return s;
}

// ── API 签名 (官方 HMAC-SHA256) ──
// 与 tiktok-sign.ts generateSign 保持一致：空 body 不参与签名
function sign(params: Record<string, string>, path: string, body?: any): string {
  const appSecret = apiAppSecret();
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'access_token')
    .sort()
    .map(k => `${k}${params[k]}`)
    .join('');
  let str = `${path}${sorted}`;
  // 官方规则：只有非空 body 才参与签名（Object.keys(body).length > 0）
  if (body && typeof body === 'object' && Object.keys(body).length > 0) {
    str += JSON.stringify(body);
  }
  return crypto.createHmac('sha256', appSecret).update(`${appSecret}${str}${appSecret}`).digest('hex');
}

// ── 通用 API 调用 ──
export async function apiCall(
  path: string, accessToken: string,
  extraParams: Record<string, string> = {},
  opts?: { method?: string; body?: any }
) {
  const appKey = apiAppKey();
  const apiBase = env('TIKTOK_API_BASE', 'https://open-api.tiktokglobalshop.com/api').replace(/\/$/, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // 官方 SDK 不传 sign_method 参数，否则签名结果与 SDK 不一致
  const params: Record<string, string> = { app_key: appKey, timestamp, ...extraParams };

  // 签名 pathname 必须与 URL 的 pathname 完全一致（含 /api 前缀）
  const apiBaseUrl = new URL(apiBase);
  const pathnamePrefix = apiBaseUrl.pathname.replace(/\/$/, '');
  const signPath = `${pathnamePrefix}${path}`;
  params.sign = sign(params, signPath, opts?.body);

  const method = opts?.method || 'GET';
  const bodyJson = opts?.body ? JSON.stringify(opts?.body) : undefined;
  const url = `${apiBase}${path}?${new URLSearchParams(params)}`;

  // ⚠️ 官方 SDK 对所有请求都设 Content-Type: application/json
  // 包括 GET 请求（参见 nodejs_sdk/client/create-trans-request-options.ts）
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tts-access-token': accessToken,
  };

  console.log(`[TikTok API] ${method} ${path}`);
  console.log(`[TikTok API] URL: ${url}`);
  console.log(`[TikTok API] Body: ${bodyJson || '(none)'}`);

  const res = await fetch(url, { method, headers, body: bodyJson });

  const text = await res.text();
  console.log(`[TikTok API] Response ${res.status}: ${text.slice(0, 500)}`);

  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`); }
  if (json.code !== undefined && json.code !== 0) {
    throw new Error(json.message || json.msg || JSON.stringify(json));
  }
  return json;
}

// ── State 管理 (CSRF 防护，5分钟过期) ──
const states = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  for (const [k, t] of states) if (now - t > 300_000) states.delete(k);
}, 60_000);

function makeState(): string {
  const s = `${crypto.randomUUID()}.${crypto.randomBytes(8).toString('hex')}`;
  states.set(s, Date.now());
  return s;
}

export function verifyState(s: string): boolean {
  if (!states.has(s)) return false;
  states.delete(s);
  return true;
}

// ── OAuth: 生成授权 URL ──
// ⚠️ 关键: 授权 URL 使用 service_id (授权ID), 不是 app_key (应用密钥)!
// service_id 默认 fallback 到 app_key, 但某些应用需要独立的 Service ID
export function buildAuthUrl(redirectUri?: string): { authUrl: string; state: string } {
  const appKey = apiAppKey();
  apiAppSecret(); // just validate
  const serviceId = env('TIKTOK_SERVICE_ID', appKey);
  const finalRedirectUri = redirectUri || env('TIKTOK_REDIRECT_URI');

  if (!finalRedirectUri) {
    throw new Error('TIKTOK_REDIRECT_URI 未配置，请在 .env 中设置');
  }

  if (!env('TIKTOK_SERVICE_ID') && serviceId === appKey) {
    console.warn('[TikTok] ⚠️ 未配置 TIKTOK_SERVICE_ID，使用 APP_KEY 作为 fallback');
    console.warn('[TikTok] ⚠️ 如果遇到 "This service does not exist" 错误，请在 .env 中设置 TIKTOK_SERVICE_ID');
  }

  const state = makeState();
  const scopes = ['seller.order', 'seller.product', 'seller.shop', 'seller.finance', 'affiliate_seller'].join(',');

  const url = `https://services.tiktokshop.com/open/authorize?service_id=${serviceId}&state=${state}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&scope=${scopes}`;

  console.log(`[TikTok] Auth URL: service_id=${serviceId.slice(0, 8)}...`);
  return { authUrl: url, state };
}

// ── OAuth: auth_code 换 token ──
const AUTH_HOST = 'https://auth.tiktok-shops.com';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  shop_id: string;
  shop_cipher: string;
  shop_name?: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const appKey = apiAppKey();
  const appSecret = apiAppSecret();

  const params = new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    auth_code: code,
    grant_type: 'authorized_code',
  });
  const url = `${AUTH_HOST}/api/v2/token/get?${params}`;

  console.log('[TikTok] 正在用 auth_code 换取 token...');
  const res = await fetch(url);
  const text = await res.text();
  console.log(`[TikTok] Token 交换响应 (${res.status}):`, text.slice(0, 300));

  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`); }

  if (json.code !== 0) {
    throw new Error(json.message || json.msg || `Token 交换失败 (code=${json.code})`);
  }

  const d = json.data;
  const token = d.access_token;
  // ⚠️ access_token_expire_in 是 Unix 时间戳（秒），不是剩余的秒数！
  const expiresIn = d.access_token_expire_in
    ? Math.floor(d.access_token_expire_in - Date.now() / 1000)
    : 86400;

  // 获取店铺信息 (shop_cipher 是后续 API 调用的必要参数)
  let shopId = '';
  let shopCipher = '';
  try {
    const shopsJson = await apiCall('/authorization/202309/shops', token);
    const shops = shopsJson?.data?.shops || [];
    if (shops.length > 0) {
      shopId = shops[0].id || shops[0].shop_id || '';
      shopCipher = shops[0].cipher || shops[0].shop_cipher || '';
    }
    console.log(`[TikTok] 店铺信息: shopId=${shopId}, cipher=${shopCipher ? 'yes' : 'no'}`);
  } catch (e: any) {
    console.warn('[TikTok] 获取店铺信息失败（非致命）:', e.message);
  }

  return {
    access_token: token,
    refresh_token: d.refresh_token || '',
    shop_id: shopId || d.open_id?.split('_')?.[0] || '',
    shop_cipher: shopCipher,
    shop_name: d.seller_name || d.shop_name || '',
    expires_in: expiresIn,
    scope: '',
  };
}

// ── OAuth: 刷新 token ──
export async function refreshToken(refreshTokenStr: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const appKey = apiAppKey();
  const appSecret = apiAppSecret();

  const params = new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    refresh_token: refreshTokenStr,
    grant_type: 'authorized_code',
  });
  const url = `${AUTH_HOST}/api/v2/token/refresh?${params}`;

  console.log('[TikTok] 正在刷新 token...');
  const res = await fetch(url);
  const json: any = await res.json();

  if (json.code !== 0) throw new Error(json.message || 'Token 刷新失败');

  const d = json.data;
  const expiresIn = d.access_token_expire_in
    ? Math.floor(d.access_token_expire_in - Date.now() / 1000)
    : 86400;

  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token || refreshTokenStr,
    expires_in: expiresIn,
  };
}

// ── 获取已授权的店铺列表 ──
export async function getAuthorizedShops(accessToken: string) {
  const result = await apiCall('/authorization/202309/shops', accessToken);
  return ((result?.data as any)?.shops || []).map((shop: any) => ({
    id: shop.id || shop.shop_id || '',
    name: shop.name || shop.shop_name || '',
    cipher: shop.cipher || shop.shop_cipher || '',
    region: shop.region || shop.shop_region || '',
  }));
}

// ── 测试连接（需要 shop_cipher 用于订单 API）──
export async function testConnection(accessToken: string, shopCipher?: string) {
  const errors: string[] = [];

  // Try 1: 获取已授权店铺列表（不需要 shop_cipher）
  try {
    const result = await apiCall('/authorization/202309/shops', accessToken);
    return { endpoint: 'shops', data: result };
  } catch (e: any) { errors.push(`shops: ${e.message}`); }

  if (!shopCipher) {
    throw new Error(`缺少 shop_cipher，无法测试订单 API (已尝试 shops: ${errors.join('; ')})`);
  }

  // Try 2: 获取订单列表（page_size 在 URL 参数中，与官方 SDK 一致）
  try {
    const result = await apiCall('/order/202309/orders/search', accessToken,
      { shop_cipher: shopCipher, page_size: '1' },
      { method: 'POST' },
    );
    return { endpoint: 'orders', data: result };
  } catch (e: any) { errors.push(`orders: ${e.message}`); }

  throw new Error(`所有 API 端点均失败: ${errors.join('; ')}`);
}
