import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';

const router = Router();
const authenticate = authMiddleware;

// ========== AI 渠道管理 ==========

// GET /api/ai-channels — 获取所有渠道
router.get('/', authenticate, (_req: Request, res: Response) => {
  const db = getDb();
  const channels = db.prepare(`
    SELECT id, name, provider, api_base, api_key, model, models, priority, 
           status, is_default, quota_used, quota_limit, success_count, error_count,
           avg_latency, last_used_at, last_success_at, last_error_at, last_error_message,
           created_at, updated_at
    FROM ai_channels ORDER BY priority ASC, id ASC
  `).all();

  // 脱敏处理
  const sanitized = channels.map((ch: any) => ({
    ...ch,
    api_key_masked: ch.api_key ? `${ch.api_key.substring(0, 8)}...${ch.api_key.slice(-4)}` : '',
    models: ch.models ? JSON.parse(ch.models) : [],
    is_default: Boolean(ch.is_default),
  }));

  res.json(sanitized);
});

// GET /api/ai-channels/enabled — 获取启用的渠道（用于 AI 调用）
router.get('/enabled', authenticate, (_req: Request, res: Response) => {
  const db = getDb();
  const channels = db.prepare(`
    SELECT * FROM ai_channels 
    WHERE status = 'enabled' AND api_key != ''
    ORDER BY priority ASC, id ASC
  `).all();

  const sanitized = channels.map((ch: any) => ({
    ...ch,
    api_key_masked: ch.api_key ? `${ch.api_key.substring(0, 8)}...${ch.api_key.slice(-4)}` : '',
    models: ch.models ? JSON.parse(ch.models) : [],
    is_default: Boolean(ch.is_default),
  }));

  res.json(sanitized);
});

// GET /api/ai-channels/default — 获取默认渠道
router.get('/default', authenticate, (_req: Request, res: Response) => {
  const db = getDb();
  const channel = db.prepare(`
    SELECT * FROM ai_channels WHERE is_default = 1 AND status = 'enabled' AND api_key != ''
    ORDER BY priority ASC LIMIT 1
  `).get();

  if (!channel) {
    return res.status(404).json({ error: '未找到可用的默认渠道，请先配置并启用 AI API' });
  }

  res.json(channel);
});

// GET /api/ai-channels/:id — 获取单个渠道
router.get('/:id', authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const channel = db.prepare('SELECT * FROM ai_channels WHERE id = ?').get(req.params.id) as any;

  if (!channel) {
    return res.status(404).json({ error: '渠道不存在' });
  }

  res.json({
    ...channel,
    api_key_masked: channel.api_key ? `${channel.api_key.substring(0, 8)}...${channel.api_key.slice(-4)}` : '',
    models: channel.models ? JSON.parse(channel.models) : [],
    is_default: Boolean(channel.is_default),
  });
});

// POST /api/ai-channels — 添加渠道
router.post('/', authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const { name, provider, api_base, api_key, model, models, priority, status, is_default } = req.body;

  if (!name || !api_base) {
    return res.status(400).json({ error: '名称和 API 地址不能为空' });
  }

  // 如果设为默认，先取消其他默认
  if (is_default) {
    db.prepare('UPDATE ai_channels SET is_default = 0').run();
  }

  const result = db.prepare(`
    INSERT INTO ai_channels (name, provider, api_base, api_key, model, models, priority, status, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    provider || 'custom',
    api_base,
    api_key || '',
    model || '',
    JSON.stringify(models || []),
    priority || 100,
    status || 'disabled',
    is_default ? 1 : 0
  );

  const newChannel = db.prepare('SELECT * FROM ai_channels WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, id: result.lastInsertRowid, channel: newChannel });
});

// PUT /api/ai-channels/:id — 更新渠道
router.put('/:id', authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const { name, provider, api_base, api_key, model, models, priority, status, is_default } = req.body;

  const existing = db.prepare('SELECT * FROM ai_channels WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '渠道不存在' });
  }

  // 如果设为默认，先取消其他默认
  if (is_default && !(existing as any).is_default) {
    db.prepare('UPDATE ai_channels SET is_default = 0').run();
  }

  db.prepare(`
    UPDATE ai_channels SET
      name = ?, provider = ?, api_base = ?, api_key = ?, model = ?,
      models = ?, priority = ?, status = ?, is_default = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    name ?? (existing as any).name,
    provider ?? (existing as any).provider,
    api_base ?? (existing as any).api_base,
    api_key ?? (existing as any).api_key,
    model ?? (existing as any).model,
    models ? JSON.stringify(models) : (existing as any).models,
    priority ?? (existing as any).priority,
    status ?? (existing as any).status,
    is_default ? 1 : 0,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM ai_channels WHERE id = ?').get(req.params.id);
  res.json({ success: true, channel: updated });
});

// DELETE /api/ai-channels/:id — 删除渠道
router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM ai_channels WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '渠道不存在' });
  }

  db.prepare('DELETE FROM ai_channels WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/ai-channels/:id/test — 测试渠道连接
router.post('/:id/test', authenticate, async (req: Request, res: Response) => {
  const db = getDb();
  const channel = db.prepare('SELECT * FROM ai_channels WHERE id = ?').get(req.params.id) as any;

  if (!channel) {
    return res.status(404).json({ error: '渠道不存在' });
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(channel.api_base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channel.api_key}`,
      },
      body: JSON.stringify({
        model: channel.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latency = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));

    if (response.ok && !data.error) {
      // 更新渠道统计
      db.prepare(`
        UPDATE ai_channels SET 
          last_success_at = datetime('now', 'localtime'),
          last_used_at = datetime('now', 'localtime'),
          avg_latency = ((avg_latency * success_count) + ?) / (success_count + 1),
          success_count = success_count + 1,
          last_error_at = NULL,
          last_error_message = ''
        WHERE id = ?
      `).run(latency, channel.id);

      res.json({ success: true, latency, message: '连接成功' });
    } else {
      const errMsg = data.error?.message || data.message || `HTTP ${response.status}`;

      db.prepare(`
        UPDATE ai_channels SET
          last_error_at = datetime('now', 'localtime'),
          last_error_message = ?,
          error_count = error_count + 1
        WHERE id = ?
      `).run(errMsg.slice(0, 500), channel.id);

      res.json({ success: false, error: errMsg });
    }
  } catch (e: any) {
    const latency = Date.now() - startTime;
    const errMsg = e.name === 'AbortError' ? '连接超时 (30秒)' : `网络异常: ${e.message}`;

    db.prepare(`
      UPDATE ai_channels SET
        last_error_at = datetime('now', 'localtime'),
        last_error_message = ?,
        error_count = error_count + 1
      WHERE id = ?
    `).run(errMsg.slice(0, 500), channel.id);

    res.json({ success: false, error: errMsg });
  }
});

// POST /api/ai-channels/:id/set-default — 设为默认渠道
router.post('/:id/set-default', authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const channel = db.prepare('SELECT * FROM ai_channels WHERE id = ?').get(req.params.id);

  if (!channel) {
    return res.status(404).json({ error: '渠道不存在' });
  }

  db.prepare('UPDATE ai_channels SET is_default = 0').run();
  db.prepare('UPDATE ai_channels SET is_default = 1 WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

// GET /api/ai-channels/providers — 获取支持的提供商列表
router.get('/config/providers', authenticate, (_req: Request, res: Response) => {
  const providers = [
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'] },
    { id: 'volcengine', name: '火山引擎', baseUrl: 'https://ark.cn-beijing.volcengineapi.com', models: ['doubao-pro-32k', 'doubao-lite-32k', 'doubao-pro-128k'] },
    { id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', models: ['DeepSeek/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'THUDM/GLM-4-Plus'] },
    { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', models: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest'] },
    { id: 'google', name: 'Google', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
    { id: 'zhipu', name: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4', 'glm-4-flash', 'glm-4-plus', 'glm-4v'] },
    { id: 'baidu', name: '百度文心', baseUrl: 'https://qianfan.baidubce.com/v2', models: ['ernie-4.0-8k', 'ernie-3.5-8k', 'ernie-speed-128k'] },
    { id: 'custom', name: '自定义', baseUrl: '', models: [] },
  ];

  res.json(providers);
});

export default router;
