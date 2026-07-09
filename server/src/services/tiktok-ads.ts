/**
 * TikTok Business API (Ads) SDK 封装层
 * 基于 tiktok-business-api-sdk-official v1.1.3
 * 提供 22 个 API 类的方法封装，统一 callback → Promise 转换
 */

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

function getAccessToken(): string {
  return process.env.TT_ADS_ACCESS_TOKEN || '';
}

// ── 广告主 / 账户 ──

export async function getAdvertiserInfo(advertiserId?: string) {
  const sdk = await getSDK();
  const api = new sdk.AccountManagementApi();
  const token = getAccessToken();
  const id = advertiserId || token.split('-')[0] || '';
  return promisify(cb => api.advertiserInfo(token, { advertiser_id: id }, cb));
}

// ── Campaign 系列管理 ──

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
  const sdk = await getSDK();
  const api = new sdk.BCApi();
  const token = getAccessToken();
  return promisify(cb => api.advertiserBalanceGet(token, {
    advertiser_ids: advertiserIds,
  }, cb));
}

// ── 通用：获取所有广告主 ──

export async function getMyAdvertisers() {
  const sdk = await getSDK();
  const api = new sdk.AuthenticationApi();
  const token = getAccessToken();
  return promisify(cb => api.oauth2AdvertiserGet(token, {}, cb));
}
