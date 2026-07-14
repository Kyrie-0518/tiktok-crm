/**
 * Cloudflare Worker — TikTok Ads OAuth 中继
 * 部署到 Cloudflare Workers（免费，全球边缘），解决国内 ECS 无法访问 TikTok API 的问题
 *
 * 部署方法：
 * 1. 打开 https://dash.cloudflare.com → Workers & Pages → Create Worker
 * 2. 把这段代码粘贴进去 → Deploy
 * 3. 在 Worker Settings → Variables 里添加加密变量：
 *    - NO_SECRET_TOKEN: 一个随机字符串（用于防滥用）
 * 4. 记下 Worker 的 URL（如 https://tiktok-relay.你的名.workers.dev）
 * 5. 在服务器 docker-compose.yml 的 environment 加：TT_ADS_RELAY_URL=https://tiktok-relay.你的名.workers.dev
 */

async function exchangeAuthCode(appId: string, secret: string, authCode: string) {
  const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      secret,
      auth_code: authCode,
      grant_type: 'authorization_code',
    }),
  });
  return res.json();
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // 只允许 POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'POST required' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 简单鉴权：防止被滥用
    const authHeader = request.headers.get('Authorization');
    const expectedToken = env.TIKTOK_RELAY_TOKEN || 'change-me';
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const body: any = await request.json();

      // ── exchange-code ──
      if (body.action === 'exchange_code') {
        const { app_id, secret, auth_code } = body;
        if (!app_id || !secret || !auth_code) {
          return new Response(JSON.stringify({ success: false, error: 'missing app_id/secret/auth_code' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const result = await exchangeAuthCode(app_id, secret, auth_code);
        return new Response(JSON.stringify({ success: true, data: result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ── generic POST relay ──（所有其他 TikTok API 请求）
      if (body.action === 'relay') {
        const { path, method, payload } = body;
        const tiktokUrl = `https://business-api.tiktok.com${path}`;
        const res = await fetch(tiktokUrl, {
          method: method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(payload?.access_token ? { 'Access-Token': payload.access_token } : {}),
          },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
        });
        const json = await res.json();
        return new Response(JSON.stringify({ success: true, data: json }), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: false, error: `unknown action: ${body.action}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
