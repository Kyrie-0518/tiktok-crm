/**
 * 飞书 Bot 回调接口
 * 文档: https://open.feishu.cn/document/server-docs/im-v1/message/events/receive
 *
 * 配置:
 * - FEISHU_APP_ID
 * - FEISHU_APP_SECRET
 * - FEISHU_VERIFICATION_TOKEN
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import getDb from '../db';
import { getAvailableChannels } from './ai';
import { agentLoop } from './agent-chat';

const router = Router();

function isConfigured(): boolean {
  return !!(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET && process.env.FEISHU_VERIFICATION_TOKEN);
}

// 获取 tenant_access_token
let cachedToken = '';
let tokenExpiry = 0;
async function getTenantAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: process.env.FEISHU_APP_ID, app_secret: process.env.FEISHU_APP_SECRET }),
  });
  const data = await res.json() as any;
  if (data.code !== 0) throw new Error(`获取飞书token失败: ${data.msg}`);
  cachedToken = data.tenant_access_token;
  tokenExpiry = Date.now() + (data.expire - 300) * 1000;
  return cachedToken;
}

// 发送消息到飞书
async function sendMessage(chatId: string, content: string, msgId?: string): Promise<void> {
  const token = await getTenantAccessToken();
  const url = 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id';
  const body: any = {
    receive_id: chatId,
    msg_type: 'text',
    content: JSON.stringify({ text: content }),
  };
  if (msgId) body.root_id = msgId;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

// 发送临时消息（群聊中仅发送者可见）
async function sendEphemeral(chatId: string, userId: string, content: string): Promise<void> {
  const token = await getTenantAccessToken();
  const url = 'https://open.feishu.cn/open-apis/ephemeral/v1/send';
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      chat_id: chatId,
      open_id: userId,
      msg_type: 'text',
      content: JSON.stringify({ text: content }),
    }),
  });
}

// GET/HEAD — 飞书 URL 连通性探测（必须返回 200）
router.get('/callback', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', path: '/api/bot/feishu/callback', timestamp: new Date().toISOString() });
});
router.head('/callback', (_req: Request, res: Response) => {
  res.status(200).end();
});


// POST — 接收飞书事件
router.post('/callback', async (req: Request, res: Response) => {
  console.log('[Feishu] 收到回调:', JSON.stringify(req.body).slice(0, 500));
  console.log('[Feishu] 请求头:', JSON.stringify(req.headers));

  try {
    const body = req.body as any;

    // ── 处理加密事件 ──
    // 如果 body.encrypt 存在，说明飞书启用了事件加密，需要先解密
    if (body.encrypt) {
      const encryptKey = process.env.FEISHU_ENCRYPT_KEY;
      if (!encryptKey) {
        console.error('[Feishu] 事件已加密但未配置 FEISHU_ENCRYPT_KEY');
        return res.status(200).json({ code: -1, msg: 'encryption key not configured' });
      }
      try {
        // 飞书加密原理（文档：https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-subscription-configure-/encrypt-key-encryption-configuration-case）
        // 1. key = SHA256(Encrypt Key)
        // 2. 密文格式 = base64(iv(16字节) + encrypted_event)
        const key = crypto.createHash('sha256').update(encryptKey).digest();
        const ciphertext = Buffer.from(body.encrypt, 'base64');
        const iv = ciphertext.slice(0, 16);
        const encrypted = ciphertext.slice(16);

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = Buffer.concat([
          decipher.update(encrypted),
          decipher.final()
        ]);
        // PKCS7Padding: 去掉末尾补位
        const pad = decrypted[decrypted.length - 1];
        decrypted = decrypted.slice(0, decrypted.length - pad);
        // 解密后就是飞书原始 JSON（无需额外切分）
        const realBody = JSON.parse(decrypted.toString('utf-8'));
        console.log('[Feishu] 解密后:', JSON.stringify(realBody).slice(0, 500));
        // 用解密后的 body 继续处理
        return await handleEvent(realBody, res);
      } catch (e: any) {
        console.error('[Feishu] 解密失败:', e.message);
        return res.status(200).json({ code: -1, msg: 'decrypt failed' });
      }
    }

    // ── 未加密，直接用 body ──
    return await handleEvent(body, res);
  } catch (e: any) {
    console.error('[Feishu] 处理异常:', e.message);
    res.json({ code: 0 });
  }
});

// 诊断接口：检查网络可达性、环境变量配置、当前服务器时间
router.get('/diagnose', (_req: Request, res: Response) => {
  const configured = isConfigured();
  const hasEncryptKey = !!process.env.FEISHU_ENCRYPT_KEY;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    feishu: {
      configured,
      has_app_id: !!process.env.FEISHU_APP_ID,
      has_app_secret: !!process.env.FEISHU_APP_SECRET,
      has_verification_token: !!process.env.FEISHU_VERIFICATION_TOKEN,
      has_encrypt_key: hasEncryptKey,
    },
    note: '如果飞书保存 URL 时仍显示 url invalid，且此处没有收到请求，说明网络/DNS/SSL/防火墙未放行飞书服务器。',
  });
});

// 模拟飞书 URL 验证（本地自测 + 可临时作为飞书回调地址测试连通性）
router.post('/test', async (req: Request, res: Response) => {
  const body = req.body as any;
  console.log('[Feishu/Test] 收到请求:', JSON.stringify(body));

  // 兼容飞书真实格式 + 手动模拟格式
  const challenge = body.challenge || body.event?.challenge || 'test-passed';
  return res.json({ challenge });
});

// 统一事件处理
async function handleEvent(body: any, res: Response) {
  // URL 验证 — v1.0 格式
  if (body.type === 'url_verification') {
    console.log('[Feishu] URL验证(v1.0), challenge:', body.challenge);
    return res.json({ challenge: body.challenge });
  }

  // URL 验证 — v2.0 格式
  if (body.schema === '2.0' && body.header?.event_type === 'url_verification') {
    console.log('[Feishu] URL验证(v2.0), challenge:', body.event?.challenge);
    return res.json({ challenge: body.event?.challenge || body.challenge });
  }

  // ── 正常事件处理（需要配置） ──
  if (!isConfigured()) return res.status(503).json({ error: '飞书未配置' });

  // 验证 token
  const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN;
  if (body.token && body.token !== verificationToken) {
    console.warn('[Feishu] Token不匹配');
    return res.status(403).json({ error: 'invalid token' });
  }

  // 处理事件
  if (body.header?.event_type === 'im.message.receive_v1') {
    const event = body.event || {};
    const message = event.message || {};
    const msgType = message.message_type;

    // 只处理文本消息
    if (msgType !== 'text') {
      return res.json({ code: 0 });
    }

    const content = JSON.parse(message.content || '{}').text || '';
    const chatId = message.chat_id;
    const userId = event.sender?.sender_id?.open_id;
    const msgId = message.message_id;

    if (!content) return res.json({ code: 0 });

    console.log(`[Feishu] ${userId}: ${content}`);

    // 调用 Agent
    const db = getDb();
    const channels = getAvailableChannels(db);
    if (channels.length === 0) {
      await sendMessage(chatId, 'AI 服务暂不可用，请先在系统设置中配置 AI 模型。', msgId);
      return res.json({ code: 0 });
    }

    try {
      const result = await agentLoop(channels, content);
      const reply = result.report.length > 2000
        ? result.report.slice(0, 1990) + '\n\n---\n[内容较长已截断，完整报告请登录PC查看]'
        : result.report;
      await sendMessage(chatId, reply, msgId);
    } catch (e: any) {
      await sendEphemeral(chatId, userId, `处理失败：${e.message}`);
    }
  }

  res.json({ code: 0 });
}

export default router;
