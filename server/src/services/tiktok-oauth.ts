/**
 * TikTok Shop OAuth 授权服务
 * 负责生成授权URL、用auth_code换取token、刷新token
 */
import crypto from 'crypto';

const TIKTOK_AUTH_HOST = 'https://auth.tiktok-shops.com';
const TIKTOK_OAUTH_AUTHORIZE = 'https://services.tiktokshop.com/open/oauth/authorize';

function getConfig() {
  const app_key = process.env.TIKTOK_APP_KEY;
  const app_secret = process.env.TIKTOK_APP_SECRET;
  if (!app_key || !app_secret || app_key === 'your_app_key_here') {
    throw new Error('TIKTOK_APP_KEY 和 TIKTOK_APP_SECRET 未配置，请在 server/.env 中设置');
  }
  return { app_key, app_secret };
}

/**
 * 生成 TikTok Shop OAuth 授权 URL
 * @param redirectUri 授权后 TikTok 回调的地址（通常是前端地址）
 * @param state 防 CSRF 的随机状态码
 */
export function generateAuthUrl(redirectUri: string, state?: string): string {
  const { app_key } = getConfig();
  const _state = state || crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    app_key,
    state: _state,
    redirect_uri: redirectUri,
  });
  return `${TIKTOK_OAUTH_AUTHORIZE}?${params.toString()}`;
}

/**
 * 用 auth_code 换取 access_token
 */
export async function exchangeAuthCode(authCode: string): Promise<TokenExchangeResult> {
  const { app_key, app_secret } = getConfig();

  const params = new URLSearchParams({
    grant_type: 'authorized_code',
    auth_code: authCode,
    app_key,
    app_secret,
  });

  const url = `${TIKTOK_AUTH_HOST}/api/v2/token/get?${params.toString()}`;

  const res = await fetch(url, { method: 'GET' });
  const body = await res.json();

  if (!res.ok || body.code !== 0) {
    throw new Error(body.message || `Token 换取失败 (HTTP ${res.status})`);
  }

  const data = body.data;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    access_token_expire_in: data.access_token_expire_in,
    refresh_token_expire_in: data.refresh_token_expire_in,
    open_id: data.open_id,
    seller_name: data.seller_name,
    seller_base_region: data.seller_base_region,
    user_type: data.user_type,
  };
}

/**
 * 刷新 access_token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenExchangeResult> {
  const { app_key, app_secret } = getConfig();

  const params = new URLSearchParams({
    grant_type: 'authorized_code',
    refresh_token: refreshToken,
    app_key,
    app_secret,
  });

  const url = `${TIKTOK_AUTH_HOST}/api/v2/token/refresh?${params.toString()}`;

  const res = await fetch(url, { method: 'GET' });
  const body = await res.json();

  if (!res.ok || body.code !== 0) {
    throw new Error(body.message || `Token 刷新失败 (HTTP ${res.status})`);
  }

  const data = body.data;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    access_token_expire_in: data.access_token_expire_in,
    refresh_token_expire_in: data.refresh_token_expire_in,
    open_id: data.open_id,
    seller_name: data.seller_name,
    seller_base_region: data.seller_base_region,
    user_type: data.user_type,
  };
}

export interface TokenExchangeResult {
  access_token: string;
  refresh_token: string;
  access_token_expire_in?: number;
  refresh_token_expire_in?: number;
  open_id?: string;
  seller_name?: string;
  seller_base_region?: string;
  user_type?: number;
}
