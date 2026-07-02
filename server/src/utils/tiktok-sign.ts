/**
 * TikTok Shop Partner Center API — 请求签名工具
 * 基于官方文档 v202309+ 版本
 */
import crypto from 'crypto';

export interface TikTokAuth {
  app_key: string;
  app_secret: string;
  access_token: string;
  shop_cipher: string;
  api_version?: string;
}

/** 对请求进行 HMAC-SHA256 签名 */
export function signRequest(
  appKey: string,
  appSecret: string,
  path: string,
  timestamp: string,
  bodyStr: string = '',
): string {
  // 签名串 = app_key + path + timestamp + body
  const signStr = appKey + path + timestamp + bodyStr;
  return crypto.createHmac('sha256', appSecret).update(signStr).digest('hex');
}

/** 生成完整的请求头 */
export function buildHeaders(
  auth: TikTokAuth,
  path: string,
  body: Record<string, any> | null = null,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const sign = signRequest(auth.app_key, auth.app_secret, path, timestamp, bodyStr);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tts-access-token': auth.access_token,
    'x-tts-timestamp': timestamp,
    'x-tts-sign': sign,
  };
  return headers;
}

/** 构建完整的 API URL */
export function buildUrl(apiVersion: string, endpoint: string, queryParams?: Record<string, string>): string {
  const base = `https://open-api.tiktokshop.com/api/${apiVersion}/${endpoint}`;
  if (queryParams && Object.keys(queryParams).length > 0) {
    const qs = new URLSearchParams(queryParams).toString();
    return `${base}?${qs}`;
  }
  return base;
}
