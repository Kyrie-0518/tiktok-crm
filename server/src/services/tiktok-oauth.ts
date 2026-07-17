/**
 * TikTok Shop OAuth 授权服务
 * 基于 Bozone 已验证的授权流程重构
 * Ref: https://partner.tiktokshop.com/docv2/page/67c83e0799a75104986ae498
 */
import crypto from 'node:crypto';
import getDb from '../db';

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
  const bodyJson = (body && typeof body === 'object' && Object.keys(body).length > 0)
    ? JSON.stringify(body) : undefined;
  if (bodyJson) {
    str += bodyJson;
  }

  const raw = `${appSecret}${str}${appSecret}`;
  const signValue = crypto.createHmac('sha256', appSecret).update(raw).digest('hex');

  // ⚠️ 调试日志：部署后查看服务器日志，直接定位签名差异
  console.log('=== SIGN DEBUG ===');
  console.log('path:', path);
  console.log('sorted:', sorted);
  console.log('body:', bodyJson || '(none)');
  console.log('raw:', raw);
  console.log('sign:', signValue);
  console.log('==================');

  return signValue;
}

// ── 通用 API 调用 ──
export async function apiCall(
  path: string, accessToken: string,
  extraParams: Record<string, string> = {},
  opts?: { method?: string; body?: any }
) {
  const appKey = apiAppKey();
  const apiBase = env('TIKTOK_API_BASE', 'https://open-api.tiktokglobalshop.com').replace(/\/$/, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // 官方 SDK 不传 sign_method 参数，否则签名结果与 SDK 不一致
  const params: Record<string, string> = { app_key: appKey, timestamp, ...extraParams };
  params.sign = sign(params, path, opts?.body);

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
  console.log(`[TikTok API] Headers:`, headers);
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
    grant_type: 'refresh_token',
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

// ════════════════════════════════════════════════════════════════════
//  企业级 Token 自动刷新（mutex + 预刷 + 后台调度 + 失败计数）
// ════════════════════════════════════════════════════════════════════

// 预刷新窗口：过期前 10 分钟就开始刷新（之前是 5 分钟，给慢网络更多缓冲）
const REFRESH_AHEAD_MS = 10 * 60 * 1000;
// 旧 token 兜底窗口：即使过期不超过 30 分钟，刷新失败时仍可继续用
const FALLBACK_GRACE_MS = 30 * 60 * 1000;
// 后台调度扫描间隔
const SCHEDULE_INTERVAL_MS = 5 * 60 * 1000;
// 失败 3 次标记为需要人工重授权
const MAX_CONSECUTIVE_FAILURES = 3;
// 单次刷新重试次数 + 指数退避
const REFRESH_RETRY_TIMES = 3;

// In-memory mutex: 同一 shopId 同一时刻只允许 1 个真正刷新，其他等待共享结果
const refreshLocks = new Map<number, Promise<string>>();
// 连续失败计数（in-memory，重启清零；可未来持久化）
const failureCounters = new Map<number, number>();
// 后台调度是否已启动
let schedulerStarted = false;

/** 内部：实际执行一次刷新（带重试 + 指数退避） */
async function doRefresh(shopId: number, refreshTokenStr: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  let lastErr: any;
  for (let attempt = 1; attempt <= REFRESH_RETRY_TIMES; attempt++) {
    try {
      const token = await refreshToken(refreshTokenStr);
      failureCounters.set(shopId, 0); // 成功 → 清零
      return token;
    } catch (e: any) {
      lastErr = e;
      const wait = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s
      console.warn(`[getValidToken] shop ${shopId} 刷新失败 (第 ${attempt}/${REFRESH_RETRY_TIMES} 次): ${e.message} · ${wait}ms 后重试`);
      if (attempt < REFRESH_RETRY_TIMES) await new Promise(r => setTimeout(r, wait));
    }
  }
  // 3 次都失败
  const fails = (failureCounters.get(shopId) || 0) + 1;
  failureCounters.set(shopId, fails);
  if (fails >= MAX_CONSECUTIVE_FAILURES) {
    console.error(`[getValidToken] 🚨 shop ${shopId} 连续 ${fails} 次刷新失败，需要人工重新授权！`);
    // TODO: 这里可对接告警系统（飞书/邮件），目前打 critical log
  }
  throw lastErr;
}

/** 内部：保存新 token 到 DB */
function saveToken(shopId: number, accessToken: string, refreshTokenStr: string, expiresIn: number) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  db.prepare(`
    UPDATE tiktok_shops SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?
  `).run(accessToken, refreshTokenStr, expiresAt, shopId);
}

/**
 * 获取店铺的有效 access_token（企业级自动刷新）
 * - mutex: 同 shopId 并发只 1 次真实刷新
 * - 预刷: 过期前 10 分钟提前刷新
 * - 重试: 3 次指数退避
 * - 兜底: 刷新失败但旧 token 未过 grace 期仍可用
 */
export async function getValidToken(shopId: number): Promise<string> {
  const db = getDb();
  const shop = db.prepare('SELECT id, access_token, refresh_token, token_expires_at FROM tiktok_shops WHERE id = ?').get(shopId) as any;

  if (!shop?.access_token) {
    throw new Error('店铺未授权，请先完成 TikTok Shop 授权');
  }

  const now = Date.now();
  const expiresAt = shop.token_expires_at ? new Date(shop.token_expires_at).getTime() : 0;

  // ✅ token 还有效（>= 10min buffer）→ 零开销直接返回
  if (expiresAt > now + REFRESH_AHEAD_MS) {
    return shop.access_token;
  }

  // ❌ 没有 refresh_token（首次授权异常）→ 用旧 token 兜底
  if (!shop.refresh_token) {
    if (expiresAt > now) {
      console.warn(`[getValidToken] shop ${shopId} 即将过期但无 refresh_token，用现有 token 尝试`);
      return shop.access_token;
    }
    throw new Error('Token 已过期且缺少 refresh_token，请重新授权店铺');
  }

  // 🔒 mutex: 同一 shopId 多个并发请求共享同一个刷新 Promise
  if (refreshLocks.has(shopId)) {
    console.log(`[getValidToken] shop ${shopId} 已有刷新进行中，等待共享结果`);
    return refreshLocks.get(shopId)!;
  }

  // 启动新的刷新
  const refreshPromise = (async () => {
    try {
      console.log(`[getValidToken] shop ${shopId} token 即将过期 (剩余 ${Math.round((expiresAt - now) / 1000)}s)，开始自动刷新`);
      const newToken = await doRefresh(shopId, shop.refresh_token);
      saveToken(shopId, newToken.access_token, newToken.refresh_token, newToken.expires_in);
      console.log(`[getValidToken] shop ${shopId} ✅ token 自动刷新成功（new expires_in=${newToken.expires_in}s）`);
      return newToken.access_token;
    } catch (e: any) {
      console.error(`[getValidToken] shop ${shopId} ❌ token 刷新失败: ${e.message}`);
      // 兜底：旧 token 还在 grace 期内（过期不超过 30min）→ 继续用
      if (expiresAt > now - FALLBACK_GRACE_MS) {
        console.warn(`[getValidToken] shop ${shopId} 刷新失败但旧 token 仍在 grace 期内，继续使用`);
        return shop.access_token;
      }
      throw new Error(`Token 刷新失败: ${e.message}，请重新授权`);
    } finally {
      refreshLocks.delete(shopId);
    }
  })();

  refreshLocks.set(shopId, refreshPromise);
  return refreshPromise;
}

/** 后台调度：定期扫描所有店铺，提前刷新即将过期的 token（每 5 分钟一次） */
export function startTokenScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  console.log('[tokenScheduler] ✅ 已启动 - 5 分钟扫描一次所有店铺的 token 状态');

  setInterval(async () => {
    try {
      const db = getDb();
      // 找出所有启用了同步的店铺
      const shops = db.prepare(`
        SELECT id, name, token_expires_at, refresh_token FROM tiktok_shops
        WHERE sync_enabled = 1 AND refresh_token != ''
      `).all() as any[];

      const now = Date.now();
      const windowMs = 30 * 60 * 1000; // 30 分钟内即将过期的就预刷

      for (const shop of shops) {
        const expiresAt = shop.token_expires_at ? new Date(shop.token_expires_at).getTime() : 0;
        if (expiresAt > 0 && expiresAt < now + windowMs) {
          try {
            await getValidToken(shop.id);
            console.log(`[tokenScheduler] shop ${shop.id} (${shop.name}) 已预刷`);
          } catch (e: any) {
            console.warn(`[tokenScheduler] shop ${shop.id} 预刷失败: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      console.error('[tokenScheduler] 扫描异常:', e.message);
    }
  }, SCHEDULE_INTERVAL_MS);
}

/** 健康检查：返回所有店铺的 token 状态（用于运维/告警） */
export function getTokenHealth() {
  const db = getDb();
  const shops = db.prepare(`
    SELECT id, name, region, token_expires_at, refresh_token, sync_enabled
    FROM tiktok_shops ORDER BY id
  `).all() as any[];

  const now = Date.now();
  return shops.map(s => {
    const expiresAt = s.token_expires_at ? new Date(s.token_expires_at).getTime() : 0;
    const hasRefresh = !!s.refresh_token;
    const isExpired = expiresAt > 0 && expiresAt < now;
    const isExpiringSoon = expiresAt > 0 && expiresAt < now + 10 * 60 * 1000;
    const hasFailures = (failureCounters.get(s.id) || 0) > 0;
    return {
      id: s.id, name: s.name, region: s.region, sync_enabled: !!s.sync_enabled,
      token_expires_at: s.token_expires_at,
      seconds_remaining: Math.max(0, Math.floor((expiresAt - now) / 1000)),
      status: !hasRefresh ? 'no_refresh_token' : isExpired ? 'expired' : isExpiringSoon ? 'expiring_soon' : 'healthy',
      consecutive_refresh_failures: failureCounters.get(s.id) || 0,
      needs_reauth: hasFailures,
    };
  });
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

  // Try 2: 获取订单列表（POST body 传 page_size，新版接口要求）
  try {
    const result = await apiCall('/order/202309/orders/search', accessToken,
      { shop_cipher: shopCipher },
      { method: 'POST', body: { page_size: 1 } },
    );
    return { endpoint: 'orders', data: result };
  } catch (e: any) { errors.push(`orders: ${e.message}`); }

  throw new Error(`所有 API 端点均失败: ${errors.join('; ')}`);
}
