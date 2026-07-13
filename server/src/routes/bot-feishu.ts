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

// POST — 接收飞书事件
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const body = req.body as any;

    // URL 验证 — 不依赖环境变量配置
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // 环境变量检查（仅在真实事件处理时需要）
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
  } catch (e: any) {
    console.error('[Feishu] 处理事件失败:', e.message);
    res.json({ code: 0 });
  }
});

export default router;
