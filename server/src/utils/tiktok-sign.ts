/**
 * TikTok Shop Partner Center API — 请求签名工具
 * 基于官方 SDK 算法重构，与 nodejs_sdk 保持一致
 */
import crypto from 'crypto';

export interface TikTokAuth {
  app_key: string;
  app_secret: string;
  access_token: string;
  shop_cipher: string;
  api_version?: string;
}

/** 对请求进行 HMAC-SHA256 签名（官方算法） */
function generateSign(
  appSecret: string,
  pathname: string,
  queryParams: Record<string, string>,
  bodyStr: string = '',
): string {
  // Step 1: 排序参数（排除 sign 和 access_token）
  const sortedKeys = Object.keys(queryParams)
    .filter((k) => k !== 'sign' && k !== 'access_token')
    .sort();

  // Step 2: 拼接 {key}{value}
  const paramString = sortedKeys.map((k) => `${k}${queryParams[k]}`).join('');

  // Step 3: 前面加上 pathname
  let signString = `${pathname}${paramString}`;

  // Step 4: 如果有 body 则追加
  if (bodyStr) {
    signString += bodyStr;
  }

  // Step 5: 用 app_secret 包裹
  signString = `${appSecret}${signString}${appSecret}`;

  // Step 6: HMAC-SHA256
  return crypto.createHmac('sha256', appSecret).update(signString).digest('hex');
}

/** endpoint 前缀到官方 API category 的映射（SDK 单数/复数不一致） */
const CATEGORY_MAP: Record<string, string> = {
  orders: 'order',
  products: 'product',
  shop: 'seller',
  logistics: 'logistics',
  finance: 'finance',
};

/** 生成完整的请求 URL 和请求头（官方 SDK 格式） */
export function buildSignedRequest(
  auth: TikTokAuth,
  endpoint: string,
  queryParams?: Record<string, string>,
  body?: Record<string, any>,
): { url: string; headers: Record<string, string> } {
  const apiVersion = auth.api_version || '202309';
  // 从 endpoint 推断 API category（orders → order, products → product 等）
  const rawCategory = endpoint.split('/')[0] || endpoint;
  const category = CATEGORY_MAP[rawCategory] || rawCategory;
  // 使用环境变量 TIKTOK_API_BASE，支持沙箱/生产环境切换
  const apiBase = process.env.TIKTOK_API_BASE || 'https://open-api.tiktokglobalshop.com';
  const base = `${apiBase}/${category}/${apiVersion}/${endpoint}`;
  const pathname = `/${category}/${apiVersion}/${endpoint}`;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';

  // 构建 query 参数（app_key、timestamp 必传）
  const allParams: Record<string, string> = {
    app_key: auth.app_key,
    timestamp,
    ...queryParams,
  };

  if (auth.shop_cipher) {
    allParams.shop_cipher = auth.shop_cipher;
  }

  // 生成签名
  const sign = generateSign(auth.app_secret, pathname, allParams, bodyStr);
  allParams.sign = sign;

  // 构建 URL（参数按字母序排列，与 SDK 一致）
  const url = new URL(base);
  Object.keys(allParams)
    .sort()
    .forEach((key) => {
      url.searchParams.set(key, allParams[key]);
    });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tts-access-token': auth.access_token,
  };

  return { url: url.toString(), headers };
}

/** @deprecated 旧版签名，仅兼容，请使用 buildSignedRequest */
export function buildUrl(apiVersion: string, endpoint: string, _queryParams?: Record<string, string>): string {
  return `https://open-api.tiktokglobalshop.com/api/${apiVersion}/${endpoint}`;
}

/** @deprecated 旧版签名，仅兼容，请使用 buildSignedRequest */
export function buildHeaders(
  auth: TikTokAuth,
  _path: string,
  _body?: Record<string, any> | null,
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-tts-access-token': auth.access_token,
  };
}

