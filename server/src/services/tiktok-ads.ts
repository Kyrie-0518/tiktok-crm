/**
 * TikTok Business API (Ads) SDK 封装层
 * 基于 tiktok-business-api-sdk-official v1.1.3
 * 提供 22 个 API 类的方法封装，统一 callback → Promise 转换
 */

import { fetch, fetch as undiciFetch, ProxyAgent, Agent } from 'undici';
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

const TIKTOK_ADS_API_BASE = 'https://business-api.tiktok.com';

function getProxyCandidates(): string[] {
  return [
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
    'http://host.docker.internal:10909',
    'http://172.17.0.1:10909',
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);
}

// 瞬时网络错误——重试能解决的
function isTransientError(e: any): boolean {
  if (!e) return false;
  const code = e?.code || e?.cause?.code;
  if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE', 'ENETUNREACH'].includes(code)) return true;
  const msg = String(e?.message || e?.cause?.message || '');
  return /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|ClientNetworkError/i.test(msg);
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithProxy(url: string, options: any) {
  // 配置开关
  const SKIP_PROXY = process.env.TT_ADS_SKIP_PROXY === '1';
  const DIRECT_TIMEOUT_MS = Number(process.env.TT_ADS_DIRECT_TIMEOUT_MS) || 30000;
  const PROXY_TIMEOUT_MS = Number(process.env.TT_ADS_PROXY_TIMEOUT_MS) || 15000;

  // 给 undici 设置超时
  const optionsWithTimeout = (timeoutMs: number) => ({
    ...options,
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });

  // 0. 【最快通道】FC Relay（国内 ECS 唯一稳定出口）——先试，失败再走代理
  const relayUrl = process.env.TT_ADS_RELAY_URL;
  const relayToken = process.env.TT_ADS_RELAY_TOKEN;
  if (relayUrl && relayToken) {
    try {
      const parsedUrl = new URL(url);
      const relayPath = parsedUrl.pathname + parsedUrl.search;
      const fetchHeaders = (options?.headers || {}) as Record<string, string>;
      const relayRes = await undiciFetch(relayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${relayToken}`,
          'Date': new Date().toUTCString(),
        },
        body: JSON.stringify({
          action: 'relay',
          path: relayPath,
          method: options.method || 'GET',
          payload: fetchHeaders,
        }),
        dispatcher: new Agent({ connect: { timeout: 5_000 }, bodyTimeout: 30_000 }),
      });
      const relayText = await relayRes.text();
      const relayJson = JSON.parse(relayText);
      if (relayJson.success && relayJson.data !== undefined) {
        console.log('[TikTok Ads] FC relay success');
        return {
          ok: String(relayJson.status || 200).startsWith('2'),
          status: relayJson.status || 200,
          text: async () => JSON.stringify(relayJson.data),
          json: async () => relayJson.data,
          headers: new Map([['content-type', 'application/json']]),
        } as any;
      }
      console.warn('[TikTok Ads] FC relay returned error:', relayText.slice(0, 200));
    } catch (e: any) {
      console.warn('[TikTok Ads] FC relay failed:', e.message);
    }
  }

  // 1-3. 原始 fallback：代理 → 直连（境外服务器或不配 relay 时用）
  let lastError: any;
  const proxies = SKIP_PROXY ? [] : getProxyCandidates();
  const maxRetries = 2;

  for (const proxyUrl of proxies) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const dispatcher = new ProxyAgent(proxyUrl);
        const res = await fetch(url, { ...optionsWithTimeout(PROXY_TIMEOUT_MS), dispatcher } as any);
        return res;
      } catch (e: any) {
        lastError = e;
        if (!isTransientError(e) || attempt === maxRetries) break;
        await sleep(500 * Math.pow(2, attempt - 1));
      }
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, optionsWithTimeout(DIRECT_TIMEOUT_MS) as any);
      return res;
    } catch (e: any) {
      lastError = e;
      if (attempt === maxRetries) break;
      await sleep(500 * Math.pow(2, attempt - 1));
    }
  }

  throw lastError;
}

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
  console.log('[TikTok Ads] undici GET', url.toString());
  const res = await fetchWithProxy(url.toString(), {
    method: 'GET',
    headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  console.log('[TikTok Ads] undici response', text.slice(0, 2000));
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  if (json.code !== 0 && json.code !== undefined) throw new Error(`TikTok API code ${json.code}: ${json.message}`);
  return json;
}

export async function tiktokAdsPost(path: string, body: Record<string, any>, token?: string) {
  const url = new URL(TIKTOK_ADS_API_BASE + path);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Access-Token'] = token;
  console.log('[TikTok Ads] undici POST', url.toString(), 'body:', JSON.stringify(body).slice(0, 500));
  const res = await fetchWithProxy(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log('[TikTok Ads] undici POST response', text.slice(0, 2000));
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
  });
  const item = res?.data?.list?.[0] || res?.data?.advertiser_info_list?.[0] || {};
  return { data: item };
}

export async function getAdvertisersInfo(advertiserIds: string[]) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  if (!advertiserIds.length) return { data: { list: [] } };
  // 显式指定要返回的字段（v1.3 必须指定 name 才能拿到中文名）
  const FIELDS = ['advertiser_id', 'name', 'currency', 'timezone', 'country', 'status', 'balance', 'contacter', 'cellphone_number', 'email'];
  const res = await tiktokAdsGet('/open_api/v1.3/advertiser/info/', token, {
    advertiser_ids: advertiserIds,
    fields: FIELDS,
  });
  // v1.2 / v1.3 / 不同账号数，list 的位置可能不同，统一处理
  if (res.data && !res.data.list && res.data.advertiser_info_list) {
    res.data.list = res.data.advertiser_info_list;
  }
  console.log('[TikTok Ads] getAdvertisersInfo response keys:', Object.keys(res?.data || {}),
    '| first item keys:', Object.keys(res?.data?.list?.[0] || {}));
  return res;
}

// ── Campaigns 广告系列（改用 undici 直连 + relay，绕开 superagent）──

export async function getCampaigns(params: { advertiser_id: string; page?: number; page_size?: number; campaign_ids?: string[]; status?: string; objective_type?: string }) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsGet('/open_api/v1.3/campaign/get/', token, {
    advertiser_id: params.advertiser_id,
    page: params.page || 1,
    page_size: params.page_size || 50,
    campaign_ids: params.campaign_ids,
    status: params.status,
    objective_type: params.objective_type,
  });
}

export async function updateCampaign(advertiserId: string, campaignId: string, updates: Record<string, any>) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsPost('/open_api/v1.3/campaign/update/', {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    ...updates,
  }, token);
}

export async function updateCampaignStatus(advertiserId: string, campaignId: string, status: string) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsPost('/open_api/v1.3/campaign/status/update/', {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    status,
  }, token);
}

// ── Adgroup 广告组 ──

export async function getAdgroups(params: { advertiser_id: string; campaign_id?: string; page?: number; page_size?: number; adgroup_ids?: string[]; status?: string }) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsGet('/open_api/v1.3/adgroup/get/', token, {
    advertiser_id: params.advertiser_id,
    campaign_id: params.campaign_id,
    page: params.page || 1,
    page_size: params.page_size || 50,
    adgroup_ids: params.adgroup_ids,
    status: params.status,
  });
}

// ── Ad 广告 ──

export async function getAds(params: { advertiser_id: string; adgroup_id?: string; campaign_id?: string; page?: number; page_size?: number; ad_ids?: string[]; status?: string }) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsGet('/open_api/v1.3/ad/get/', token, {
    advertiser_id: params.advertiser_id,
    adgroup_id: params.adgroup_id,
    campaign_id: params.campaign_id,
    page: params.page || 1,
    page_size: params.page_size || 50,
    ad_ids: params.ad_ids,
    status: params.status,
  });
}

export async function updateAdStatus(advertiserId: string, adId: string, status: string) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsPost('/open_api/v1.3/ad/status/update/', {
    advertiser_id: advertiserId,
    ad_id: adId,
    status,
  }, token);
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
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsGet('/open_api/v1.3/report/integrated/get/', token, {
    advertiser_id: params.advertiser_id,
    dimensions: JSON.stringify(params.dimensions || ['campaign_id']),
    metrics: JSON.stringify(params.metrics || ['spend', 'impressions', 'clicks', 'conversions', 'ctr', 'cpc', 'cpm']),
    start_date: params.start_date,
    end_date: params.end_date,
    page: params.page || 1,
    page_size: params.page_size || 100,
    level: params.level || 'AUCTION_CAMPAIGN',
    filters: params.filters ? JSON.stringify(params.filters) : undefined,
  });
}

// ── 自动规则（统一走 undici 代理，不依赖 SDK 的 superagent） ──

export async function getOptimizerRules(params: { advertiser_id: string; page?: number; page_size?: number; status?: string }) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  const query: Record<string, any> = {
    advertiser_id: params.advertiser_id,
    page: params.page || 1,
    page_size: params.page_size || 50,
  };
  if (params.status) {
    query.filtering = JSON.stringify({ status: params.status });
  }
  return tiktokAdsGet('/open_api/v1.3/optimizer/rule/list/', token, query);
}

export async function getOptimizerRuleDetail(advertiserId: string, ruleId: string) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsGet('/open_api/v1.3/optimizer/rule/get/', token, {
    advertiser_id: advertiserId,
    rule_ids: [ruleId],
  });
}

export async function createOptimizerRule(body: any) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsPost('/open_api/v1.3/optimizer/rule/create/', body, token);
}

export async function updateOptimizerRule(body: any) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsPost('/open_api/v1.3/optimizer/rule/update/', body, token);
}

export async function bindOptimizerRule(body: any) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsPost('/open_api/v1.3/optimizer/rule/batch_bind/', body, token);
}

export async function getOptimizerRuleResults(params: { advertiser_id: string; rule_id: string; page?: number; page_size?: number; lang?: string }) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsGet('/open_api/v1.3/optimizer/rule/result/list/', token, {
    advertiser_id: params.advertiser_id,
    filtering: JSON.stringify({ rule_info: [params.rule_id] }),
    page: params.page || 1,
    page_size: params.page_size || 50,
    lang: params.lang || 'EN',
  });
}

export async function getOptimizerRuleLogs(params: { advertiser_id: string; rule_id: string; page?: number; page_size?: number }) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  return tiktokAdsGet('/open_api/v1.3/optimizer/rule/log/get/', token, {
    advertiser_id: params.advertiser_id,
    rule_id: params.rule_id,
    page: params.page || 1,
    page_size: params.page_size || 50,
  });
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

export async function getBusinessCenters() {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  const res = await tiktokAdsGet('/open_api/v1.3/bc/get/', token);
  console.log('[TikTok Ads] /bc/get/ full response:', JSON.stringify(res));
  return res;
}

export async function getAdvertiserBalance(advertiserIds: string[]) {
  const token = getAccessToken();
  if (!token) throw new Error('TikTok Ads 未授权');
  const list: any[] = [];

  // 收集要查询的 BC ID（自己的 BC + 代理商 BC）
  const bcIds: string[] = [];
  try {
    const bcRes = await getBusinessCenters();
    const bcList = bcRes?.data?.list || [];
    const ownBcId = bcList[0]?.bc_info?.bc_id;
    if (ownBcId) bcIds.push(ownBcId);
    console.log('[TikTok Ads] own bc_id from /bc/get/:', ownBcId);
  } catch { /* ignore */ }
  // 代理商 BC ID（资金由代理商管理，环境变量可配）
  const agentBcId = process.env.TT_ADS_AGENT_BC_ID;
  if (agentBcId && !bcIds.includes(agentBcId)) bcIds.push(agentBcId);

  // 1. 遍历所有 BC 查询余额
  for (const bcId of bcIds) {
    try {
      const balanceFields = [
        'budget_remaining', 'budget_frequency_restriction', 'budget_amount_restriction',
        'min_transferable_amount', 'max_transferable_amount', 'balance_info',
      ];
      let page = 1;
      let totalPage = 1;
      do {
        const res = await tiktokAdsGet('/open_api/v1.3/advertiser/balance/get/', token, {
          bc_id: bcId,
          page_size: '1',
          page: String(page),
          fields: balanceFields,
        });
        console.log(`[TikTok Ads] /advertiser/balance/get/ bc=${bcId} page ${page} response:`, JSON.stringify(res));
        if (res.code === 0 || res.code === undefined) {
          const balanceList = res?.data?.advertiser_account_list || res?.data?.list || [];
          balanceList.forEach((b: any) => {
            const existing = list.find((x: any) => x.advertiser_id === b.advertiser_id);
            if (!existing) {
              list.push({
                advertiser_id: b.advertiser_id,
                balance: b.budget_remaining || b.valid_account_balance || b.account_balance || 0,
                currency: b.currency || '',
              });
            }
          });
          totalPage = res?.data?.page_info?.total_page || 1;
        }
        page++;
      } while (page <= totalPage && page <= 50);
    } catch (e: any) { console.error(`[TikTok Ads] /advertiser/balance/get/ bc=${bcId} failed:`, e.message); }
  }

  // 2. 账户级余额为空，尝试拿 BC 级共享余额
  if (list.length === 0) {
    for (const bcId of bcIds) {
      try {
        const bcBalanceRes = await tiktokAdsGet('/open_api/v1.3/bc/balance/get/', token, { bc_id: bcId });
        console.log(`[TikTok Ads] /bc/balance/get/ bc=${bcId} response:`, JSON.stringify(bcBalanceRes));
        const bcBalance = bcBalanceRes?.data?.balance || bcBalanceRes?.data?.total_balance || bcBalanceRes?.data?.available_balance || 0;
        const bcCurrency = bcBalanceRes?.data?.currency || 'MYR';
        if (bcBalance > 0) {
          advertiserIds.forEach((id: string) => {
            if (!list.find((x: any) => x.advertiser_id === id)) {
              list.push({ advertiser_id: id, balance: bcBalance, currency: bcCurrency, source: 'bc' });
            }
          });
        }
      } catch (e: any) { /* ignore */ }
    }
  }

  // 3. 兜底：用 advertiser/info 的 balance
  if (list.length === 0) {
    try {
      const infoRes = await getAdvertisersInfo(advertiserIds);
      (infoRes?.data?.list || []).forEach((item: any) => {
        list.push({ advertiser_id: item.advertiser_id, balance: item.balance || 0, currency: item.currency || '' });
      });
    } catch { /* ignore */ }
  }

  console.log('[TikTok Ads] advertiserBalance final list:', JSON.stringify(list));
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
