/**
 * TikTok Business API (Ads) SDK 封装层
 * 基于 tiktok-business-api-sdk-official v1.1.3
 * 提供 22 个 API 类的方法封装，统一 callback → Promise 转换
 */

import { fetch, ProxyAgent } from 'undici';
import getDb from '../db';

// SDK 使用 ES Module，我们用动态 import
let AdsSDK: any = null;
async function getSDK() {
  if (!AdsSDK) {
    AdsSDK = await import('tiktok-business-api-sdk-official');
  }
  return AdsSDK;
}

// ── 通用工具 ──

function promisify<T>(apiCall: (callback: (err: any, data: any, response: any) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    apiCall((err: any, data: any, _response: any) => {
      if (err) {
        if (err.response?.body) {
          reject(new Error(typeof err.response.body === 'string' ? err.response.body : JSON.stringify(err.response.body)));
        } else {
          reject(err);
        }
      } else {
        resolve(data as T);
      }
    });
  });
}


const APP_ID = process.env.TT_ADS_APP_ID || '7641162218708434960';
const APP_SECRET = process.env.TT_ADS_APP_SECRET || '9c1115593f6199a22eecb3777b7890cbdb8c5445';

function getAccessToken(): string {
  // 优先环境变量
  if (process.env.TT_ADS_ACCESS_TOKEN) return process.env.TT_ADS_ACCESS_TOKEN;
  // 其次从数据库 settings 表读取 OAuth 回调保存的 token
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'tt_ads_access_token'").get() as any;
    return row?.value || '';
  } catch {
    return '';
  }
}

export function getTokenStatus(): { hasToken: boolean; advertiserIds: string[] } {
  try {
    const db = getDb();
    const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'tt_ads_access_token'").get() as any;
    const advRow = db.prepare("SELECT value FROM settings WHERE key = 'tt_ads_advertiser_ids'").get() as any;
    return {
      hasToken: !!tokenRow?.value,
      advertiserIds: advRow?.value ? JSON.parse(advRow.value) : [],
    };
  } catch {
    return { hasToken: false, advertiserIds: [] };
  }
}

// ── 广告主 / 账户 ──

const ADVERTISER_INFO_FIELDS = [
  'advertiser_id', 'advertiser_name', 'status', 'currency', 'timezone',
  'company', 'industry', 'phone_number', 'email', 'address', 'country',
  'promotion_area', 'promotion_center', 'advertiser_account_type', 'description',
  'reason', 'rejection_reason', 'create_time', 'language', 'license_no',
  'license_url', 'taxpayer_id', 'official_website_url', 'business_center_id',
  'owner_bcm_user_id', 'owner_bcm_user_name', 'balance', 'spend_cap',
];

const TIKTOK_ADS_API_BASE = 'https://business-api.tiktok.com';

async function tiktokAdsGet(path: string, token: string, query: Record<string, any> = {}) {
  const url = new URL(TIKTOK_ADS_API_BASE + path);
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      url.searchParams.set(k, JSON.stringify(v));
    } else {
      url.searchParams.set(k, String(v));
    }
  });
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
  console.log('[TikTok Ads] undici GET', url.toString());
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
    dispatcher,
  } as any);
  const text = await res.text();
  console.log('[TikTok Ads] undici response', text.slice(0, 2000));
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  if (json.code !== 0 && json.code !== undefined) throw new Error(`TikTok API code ${json.code}: ${json.message}`);
  return json;
}

export async function getAdvertiserInfo(advertiserId?: string) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  if (!advertiserId) return { data: {} };
  const res = await tiktokAdsGet('/open_api/v1.3/advertiser/info/', token, {
    advertiser_ids: [advertiserId],
    fields: ADVERTISER_INFO_FIELDS,
  });
  const item = res?.data?.list?.[0] || res?.data?.advertiser_info_list?.[0] || {};
  return { data: item };
}

export async function getAdvertisersInfo(advertiserIds: string[]) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  if (!advertiserIds.length) return { data: { list: [] } };
  const res = await tiktokAdsGet('/open_api/v1.3/advertiser/info/', token, {
    advertiser_ids: advertiserIds,
    fields: ADVERTISER_INFO_FIELDS,
  });
  if (res.data && !res.data.list && res.data.advertiser_info_list) {
    res.data.list = res.data.advertiser_info_list;
  }
  return res;
}

export async function getCampaigns(params: { advertiser_id: string; page?: number; page_size?: number; campaign_ids?: string[]; status?: string; objective_type?: string }) {
  const sdk = await getSDK();
  const api = new sdk.CampaignCreationApi();
  const token = getAccessToken();
  return promisify(cb => api.campaignGet(token, {
    advertiser_id: params.advertiser_id,
    page: params.page || 1,
    page_size: params.page_size || 50,
    campaign_ids: params.campaign_ids || undefined,
    status: params.status || undefined,
    objective_type: params.objective_type || undefined,
  }, cb));
}

export async function updateCampaign(advertiserId: string, campaignId: string, updates: Record<string, any>) {
  const sdk = await getSDK();
  const api = new sdk.CampaignCreationApi();
  const token = getAccessToken();
  return promisify(cb => api.campaignUpdate(token, {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    body: updates,
  }, cb));
}

export async function updateCampaignStatus(advertiserId: string, campaignId: string, status: string) {
  const sdk = await getSDK();
  const api = new sdk.CampaignCreationApi();
  const token = getAccessToken();
  return promisify(cb => api.campaignStatusUpdate(token, {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    body: { status },
  }, cb));
}

// ── Adgroup 广告组 ──

export async function getAdgroups(params: { advertiser_id: string; campaign_id?: string; page?: number; page_size?: number; adgroup_ids?: string[]; status?: string }) {
  const sdk = await getSDK();
  const api = new sdk.AdgroupApi();
  const token = getAccessToken();
  return promisify(cb => api.adgroupGet(token, {
    advertiser_id: params.advertiser_id,
    campaign_id: params.campaign_id || undefined,
    page: params.page || 1,
    page_size: params.page_size || 50,
    adgroup_ids: params.adgroup_ids || undefined,
    status: params.status || undefined,
  }, cb));
}

// ── Ad 广告 ──

export async function getAds(params: { advertiser_id: string; adgroup_id?: string; campaign_id?: string; page?: number; page_size?: number; ad_ids?: string[]; status?: string }) {
  const sdk = await getSDK();
  const api = new sdk.AdApi();
  const token = getAccessToken();
  return promisify(cb => api.adGet(token, {
    advertiser_id: params.advertiser_id,
    adgroup_id: params.adgroup_id || undefined,
    campaign_id: params.campaign_id || undefined,
    page: params.page || 1,
    page_size: params.page_size || 50,
    ad_ids: params.ad_ids || undefined,
    status: params.status || undefined,
  }, cb));
}

export async function updateAdStatus(advertiserId: string, adId: string, status: string) {
  const sdk = await getSDK();
  const api = new sdk.AdApi();
  const token = getAccessToken();
  return promisify(cb => api.adStatusUpdate(token, {
    advertiser_id: advertiserId,
    ad_id: adId,
    body: { status },
  }, cb));
}

// ── 报表 ──

export async function getReport(params: {
  advertiser_id: string;
  dimensions?: string[];
  metrics?: string[];
  start_date: string;
  end_date: string;
  page?: number;
  page_size?: number;
  filters?: Record<string, any>;
  level?: string;
}) {
  const sdk = await getSDK();
  const api = new sdk.ReportingApi();
  const token = getAccessToken();
  return promisify(cb => api.reportIntegratedGet(token, {
    advertiser_id: params.advertiser_id,
    dimensions: JSON.stringify(params.dimensions || ['campaign_id']),
    metrics: JSON.stringify(params.metrics || ['spend', 'impressions', 'clicks', 'conversions', 'ctr', 'cpc', 'cpm']),
    start_date: params.start_date,
    end_date: params.end_date,
    page: params.page || 1,
    page_size: params.page_size || 100,
    level: params.level || 'AUCTION_CAMPAIGN',
    filters: params.filters ? JSON.stringify(params.filters) : undefined,
  }, cb));
}

// ── 自动规则 ──

export async function getOptimizerRules(params: { advertiser_id: string; page?: number; page_size?: number }) {
  const sdk = await getSDK();
  const api = new sdk.AutomatedRulesApi();
  const token = getAccessToken();
  return promisify(cb => api.optimizerRuleGetList(token, {
    advertiser_id: params.advertiser_id,
    page: params.page || 1,
    page_size: params.page_size || 50,
  }, cb));
}

export async function getOptimizerRuleLogs(params: { advertiser_id: string; rule_id: string; page?: number; page_size?: number }) {
  const sdk = await getSDK();
  const api = new sdk.AutomatedRulesApi();
  const token = getAccessToken();
  return promisify(cb => api.optimizerRuleLogGet(token, {
    advertiser_id: params.advertiser_id,
    rule_id: params.rule_id,
    page: params.page || 1,
    page_size: params.page_size || 50,
  }, cb));
}

// ── 创意素材 ──

export async function getCreativePortfolio(params: { advertiser_id: string; page?: number; page_size?: number }) {
  const sdk = await getSDK();
  const api = new sdk.CreativeManagementApi();
  const token = getAccessToken();
  return promisify(cb => api.creativePortfolioGet(token, {
    advertiser_id: params.advertiser_id,
    page: params.page || 1,
    page_size: params.page_size || 50,
  }, cb));
}

// ── 余额 / 财务 ──

export async function getAdvertiserBalance(advertiserIds: string[]) {
  // BCApi.advertiserBalanceGet 需要 bc_id，这里改用 advertiserInfo 批量接口取余额
  const res = await getAdvertisersInfo(advertiserIds);
  const list = (res?.data?.list || []).map((item: any) => ({
    advertiser_id: item.advertiser_id,
    balance: item.balance || 0,
    currency: item.currency || '',
  }));
  console.log('[TikTok Ads] advertiserBalance derived list:', JSON.stringify(list));
  return { data: { list } };
}

// ── 通用：获取所有广告主 ──
// oauth2AdvertiserGet — 获取当前 token 下有效的广告主列表（用 undici 绕过 SDK superagent 代理限制）
export async function getMyAdvertisers() {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权，请先完成 OAuth 授权');
  const res = await tiktokAdsGet('/open_api/v1.3/oauth2/advertiser/get/', token, {
    app_id: APP_ID,
    secret: APP_SECRET,
  });
  console.log('[TikTok Ads] oauth2AdvertiserGet response:', JSON.stringify(res));
  return res;
}
