/**
 * TikTok Marketing API / Ads OAuth 授权与 Token 管理
 * 用于获取 TikTok 广告账号的 access_token
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import getDb from '../db';
import { getTokenStatus, tiktokAdsPost } from '../services/tiktok-ads';
import { fetch as undiciFetch, Agent } from 'undici';

const router = Router();

// 基础配置
const APP_ID = process.env.TT_ADS_APP_ID || '7641162218708434960';
const APP_SECRET = process.env.TT_ADS_APP_SECRET || '9c1115593f6199a22eecb3777b7890cbdb8c5445';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bvefdvp.cn';
const REDIRECT_URI = process.env.TT_ADS_REDIRECT_URI || `${FRONTEND_URL}/ad-accounts`;

// ── 工具函数 ──

function buildAuthUrl(state: string): string {
  const redirect = encodeURIComponent(REDIRECT_URI);
  return `https://business-api.tiktok.com/portal/auth?app_id=${APP_ID}&state=${state}&redirect_uri=${redirect}`;
}

async function exchangeAuthCode(authCode: string) {
  const body = {
    app_id: APP_ID,
    secret: APP_SECRET,
    auth_code: authCode,
    grant_type: 'authorization_code',
  };

  // 优先直连
  return tiktokAdsPost('/open_api/v1.3/oauth2/access_token/', body);
}

/** 递归提取错误的完整根因链（undici 的 fetch failed 经常套 3-4 层 cause） */
function extractErrorChain(e: any, depth = 0, max = 5): any[] {
  if (!e || depth >= max) return [];
  return [{
    depth,
    name: e?.name,
    code: e?.code,
    message: e?.message,
    // 一些 undici 错误把状态码放在 cause.status / cause.statusCode
    status: e?.status ?? e?.statusCode,
  }, ...extractErrorChain(e?.cause, depth + 1, max)];
}

/** 通过 Cloudflare Worker 中继换 token（解决国内 ECS 无法访问 TikTok 的问题） */
async function exchangeAuthCodeViaRelay(authCode: string): Promise<any> {
  const relayUrl = process.env.TT_ADS_RELAY_URL;
  const relayToken = process.env.TT_ADS_RELAY_TOKEN || 'change-me';
  if (!relayUrl) throw new Error('未配置 TT_ADS_RELAY_URL');

  // 关键修复：用 undici 显式 fetch + 显式 Agent，强制不走 HTTPS_PROXY
  // undici v7 的 Agent 顶层没有 connectTimeout，要用 connect.timeout
  // 同时显式设置 bodyTimeout / headersTimeout 防止长时间挂起
  const directAgent = new Agent({
    connect: { timeout: 15_000 }, // undici v7 没有顶层 connectTimeout，要嵌套
    bodyTimeout: 30_000,
    headersTimeout: 20_000,
    keepAliveTimeout: 5_000,
  });

  try {
    const res = await undiciFetch(relayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${relayToken}`,
      },
      body: JSON.stringify({
        action: 'exchange_code',
        app_id: APP_ID,
        secret: APP_SECRET,
        auth_code: authCode,
      }),
      dispatcher: directAgent,
    });
    const text = await res.text();
    console.log(`[TikTok Ads] relay response status=${res.status} body=${text.slice(0, 500)}`);
    let json: any;
    try { json = JSON.parse(text); } catch { throw new Error(`relay non-JSON response (status=${res.status}): ${text.slice(0, 200)}`); }
    if (!json.success) throw new Error(json.error || 'Worker relay failed');
    return json.data;
  } catch (e: any) {
    const chain = extractErrorChain(e);
    console.error('[TikTok Ads] relay failed:', {
      url: relayUrl,
      token_prefix: relayToken.slice(0, 12) + '...',
      chain,
      // 关键：把最后一层（根因）也单独抽出来
      root: chain[chain.length - 1],
      // 原始 stack 头部 300 字（不截断 cause.message）
      stack_head: e?.stack?.slice(0, 300),
      // 直接序列化前 2 层，避免被终端 truncate
      full_e: { message: e?.message, code: e?.code, name: e?.name, cause: e?.cause ? { message: e.cause.message, code: e.cause.code, name: e.cause.name } : null },
    });
    // 重新抛一个带根因 message 的新 Error，方便上层日志和前端错误浮层看清楚
    const rootCause = chain[chain.length - 1];
    const rootMsg = rootCause?.message || e?.message || 'relay fetch failed';
    const wrapped = new Error(`relay fetch failed → ${rootMsg} (code=${rootCause?.code || '-'})`);
    (wrapped as any).cause = e;
    (wrapped as any).chain = chain;
    throw wrapped;
  }
}

async function saveAccountsCache(idsArray: string[]) {
  try {
    const { getAdvertisersInfo, getAdvertiserBalance } = await import('../services/tiktok-ads');
    const nameMap: Record<string, string> = {};
    const infoMap: Record<string, { country?: string }> = {};
    const balanceMap: Record<string, any> = {};

    try {
      const infoRes = await getAdvertisersInfo(idsArray);
      (infoRes?.data?.list || []).forEach((item: any) => {
        const id = item.advertiser_id;
        const name = item.advertiser_name || item.name;
        if (name) nameMap[id] = name;
        infoMap[id] = { country: item.country || '' };
      });
    } catch { /* ignore */ }
    try {
      const balance = await getAdvertiserBalance(idsArray);
      (balance?.data?.list || []).forEach((b: any) => { balanceMap[b.advertiser_id] = b; });
    } catch { /* ignore */ }

    const cache = idsArray.map((id: string) => ({
      advertiser_id: id,
      advertiser_name: nameMap[id] || id,
      status: 'ACTIVE',
      country: infoMap[id]?.country || undefined,
      balance_info: balanceMap[id] || null,
    }));
    console.log('[tiktok-ads] saveAccountsCache:', JSON.stringify(cache));
    getDb().prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_accounts_cache', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(cache));
    return { cached: true };
  } catch {
    const fallback = idsArray.map((id: string) => ({ advertiser_id: id, advertiser_name: id, status: 'ACTIVE', balance_info: null }));
    getDb().prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_accounts_cache', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(fallback));
    return { cached: false };
  }
}

async function handleAuthCodeAndSave(authCode: string) {
  let result: any;
  // 1. 尝试直连 TikTok
  try {
    result = await exchangeAuthCode(authCode);
  } catch (directErr: any) {
    console.warn('[TikTok Ads] direct exchange failed:', directErr.message);
    // 2. 回退到 Cloudflare Worker 中继
    if (process.env.TT_ADS_RELAY_URL) {
      console.log('[TikTok Ads] falling back to Cloudflare Worker relay:', process.env.TT_ADS_RELAY_URL);
      result = await exchangeAuthCodeViaRelay(authCode);
    } else {
      throw directErr; // 没有配置 relay，直接报错
    }
  }
  if (result.code !== 0) throw new Error(result.message || '换取 token 失败');

  const data = result.data || {};
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const advertiserIds = data.advertiser_ids || data.advertiser_id || [];
  if (!accessToken) throw new Error('响应中缺少 access_token');

  const db = getDb();
  db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_access_token', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(accessToken);
  if (refreshToken) {
    db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_refresh_token', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(refreshToken);
  }
  const idsArray = Array.isArray(advertiserIds) ? advertiserIds : (advertiserIds ? [advertiserIds] : []);
  db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_advertiser_ids', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(idsArray));

  await saveAccountsCache(idsArray);
  return { accessToken, advertiserIds: idsArray };
}

// ── 路由 ──

// GET /api/tiktok-ads/auth-url — 获取 TikTok 广告授权 URL
router.get('/auth-url', authMiddleware, (req: Request, res: Response) => {
  const state = (req.query.state as string) || 'bozone-auth';
  res.json({
    success: true,
    authUrl: buildAuthUrl(state),
    appId: APP_ID,
    appSecret: APP_SECRET, // 暴露给前端做客户端 token 交换（避免服务器访问 TikTok）
    redirectUri: REDIRECT_URI,
  });
});

// POST /api/tiktok-ads/save-token — 前端已换取 token，服务器直接保存（用于本地代理场景）
router.post('/save-token', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { access_token, refresh_token, advertiser_ids, expires_in } = req.body;
    if (!access_token) return res.status(400).json({ success: false, error: '缺少 access_token' });

    const db = getDb();
    db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_access_token', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(access_token);
    if (refresh_token) {
      db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_refresh_token', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(refresh_token);
    }
    if (expires_in) {
      const expiresAt = Date.now() + Number(expires_in) * 1000;
      db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_token_expires_at', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(expiresAt));
    }
    const idsArray = Array.isArray(advertiser_ids) ? advertiser_ids : (advertiser_ids ? [advertiser_ids] : []);
    if (idsArray.length) {
      db.prepare(`INSERT INTO settings (key, value) VALUES ('tt_ads_advertiser_ids', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(idsArray));
    }

    // 重新拉取账户缓存
    try {
      const { saveAccountsCache } = await import('../services/tiktok-ads');
      // saveAccountsCache 是 async 但内部用了 tiktokAdsPost，国内服务器可能访问不到
      // 这里用 try/catch 包住，失败不影响 token 保存
      saveAccountsCache(idsArray).catch((e: any) => console.warn('[TikTok Ads] saveAccountsCache failed (non-fatal):', e.message));
    } catch (e: any) { /* ignore */ }

    res.json({ success: true, data: { accessToken: '***', advertiserIds: idsArray } });
  } catch (e: any) {
    console.error('[TikTok Ads] save-token failed:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/tiktok-ads/exchange-code — 前端用 auth_code 换 token（回调地址现在是 /ad-accounts）
router.post('/exchange-code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authCode = req.body.auth_code || req.body.code;
    if (!authCode) return res.status(400).json({ success: false, error: '缺少 auth_code' });

    const result = await handleAuthCodeAndSave(authCode as string);
    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('[TikTok Ads] 换 token 失败:', e.message);
    // 区分网络瞬时错误 vs 业务错误
    const isTransient = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED'].includes(e?.code || e?.cause?.code)
      || /fetch failed|ClientNetworkError/i.test(e?.message || '');
    res.status(isTransient ? 503 : 500).json({
      success: false,
      error: e.message,
      error_type: isTransient ? 'network_transient' : 'business',
      hint: isTransient
        ? '网络瞬时错误，已自动重试 9 次（3 代理 × 3 次）。请稍后手动重试，或检查代理端口 10909 是否正常。'
        : '请确认 auth_code 有效且未过期（auth_code 仅 5 分钟有效）',
    });
  }
});

// GET /api/tiktok-ads/callback — 兼容旧版回调（保留，避免已配置 redirect_uri 的应用报错）
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const authCode = (req.query.auth_code || req.query.code) as string;
    if (!authCode) {
      return res.status(400).json({ success: false, error: '缺少 auth_code 参数' });
    }
    await handleAuthCodeAndSave(authCode);
    res.redirect('/ad-accounts');
  } catch (e: any) {
    console.error('[TikTok Ads] 回调处理失败:', e.message);
    console.error('[TikTok Ads] 错误堆栈:', e.stack);
    res.status(500).json({ success: false, error: e.message, stack: e.stack });
  }
});

// GET /api/tiktok-ads/token-status — 查看当前是否已保存 token
router.get('/token-status', authMiddleware, (_req: Request, res: Response) => {
  try {
    res.json(getTokenStatus());
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/tiktok-ads/test-relay — 诊断 Worker 可达性 + 鉴权是否通过
// 返回：worker_url、http_status、response_body（前 500 字）、耗时、错误链（如有）
router.get('/test-relay', authMiddleware, async (_req: Request, res: Response) => {
  const relayUrl = process.env.TT_ADS_RELAY_URL;
  const relayToken = process.env.TT_ADS_RELAY_TOKEN || 'change-me';
  if (!relayUrl) return res.status(400).json({ success: false, error: '未配置 TT_ADS_RELAY_URL' });

  const directAgent = new Agent({
    connect: { timeout: 10_000 },
    bodyTimeout: 15_000,
    headersTimeout: 10_000,
  });
  const t0 = Date.now();
  try {
    // 故意发一个空 auth_code，Worker 会返回 400 + missing 错误，但能验证鉴权+网络是否通
    const r = await undiciFetch(relayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${relayToken}`,
      },
      body: JSON.stringify({
        action: 'exchange_code',
        app_id: APP_ID,
        secret: APP_SECRET,
        auth_code: '__test__', // 占位
      }),
      dispatcher: directAgent,
    });
    const text = await r.text();
    return res.json({
      success: r.status >= 200 && r.status < 500, // 200~499 都算"网络通"，只有 5xx 才算失败
      relay_url: relayUrl,
      http_status: r.status,
      latency_ms: Date.now() - t0,
      body_preview: text.slice(0, 500),
      hint: r.status === 200
        ? 'Worker 可达且鉴权通过'
        : r.status === 401
          ? 'Worker 鉴权失败 — 检查 TT_ADS_RELAY_TOKEN 是否等于 Worker env TIKTOK_RELAY_TOKEN'
          : r.status === 400
            ? 'Worker 可达+鉴权通过，仅参数错误（正常，测试用）'
            : `HTTP ${r.status}`,
    });
  } catch (e: any) {
    const chain = extractErrorChain(e);
    return res.status(503).json({
      success: false,
      relay_url: relayUrl,
      latency_ms: Date.now() - t0,
      error_chain: chain,
      root_cause: chain[chain.length - 1],
      hint: (() => {
        const root = chain[chain.length - 1];
        const code = root?.code || '';
        if (code === 'ENOTFOUND' || /ENOTFOUND/.test(root?.message || '')) return 'DNS 解析失败 — 容器内 ping 不到 Cloudflare，检查 /etc/resolv.conf';
        if (code === 'ECONNREFUSED' || /ECONNREFUSED/.test(root?.message || '')) return '连接被拒 — 端口 443 出站被防火墙挡了';
        if (code === 'ETIMEDOUT' || /timeout/i.test(root?.message || '')) return '连接超时 — 可能是代理 127.0.0.1:7890 拦下了 workers.dev 域名';
        if (/fetch failed/i.test(e?.message || '')) return '底层 fetch 失败（无具体 code）— 多半是 HTTPS_PROXY 把请求路由到 7890 但代理不认 workers.dev；已经显式用 undici 直连 Agent，理论上不走代理。请检查容器内 `curl -v https://kyrie.yangyue0505.workers.dev`';
        return '未知网络错误 — 查看 chain 详情';
      })(),
    });
  }
});

export default router;
