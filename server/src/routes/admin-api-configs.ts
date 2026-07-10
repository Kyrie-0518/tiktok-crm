import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';

const router = Router();

// ── Helper: 获取当前用户角色 ──
function getRoleKey(req: Request, db: any): string {
  const user = (req as any).user;
  if (user?.roleKey) return user.roleKey;
  const row = db.prepare(`
    SELECT r.role_key FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(user?.userId) as any;
  return row?.role_key || 'staff';
}

function requireAdmin(req: Request, res: Response, db: any): boolean {
  const roleKey = getRoleKey(req, db);
  if (roleKey !== 'developer' && roleKey !== 'manager') {
    res.status(403).json({ error: '仅管理员可访问' });
    return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
//  GET /api/admin/api-configs  — 统一返回两大 API 配置
// ══════════════════════════════════════════════════════════════
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const result: any[] = [];

  // 1. 语言大模型（LLM）配置
  // 优先读取 ai_channels 第一条启用的记录，回退到 settings.ai_config
  let llmChannel: any = null;
  try {
    llmChannel = db.prepare(`
      SELECT id, name, api_base as api_url, api_key, model as model_name, status
      FROM ai_channels
      WHERE status = 'enabled' AND api_key != '' AND api_base != ''
      ORDER BY priority ASC, id ASC LIMIT 1
    `).get();
  } catch { /* ai_channels 可能不存在 */ }

  let llmApiUrl = '';
  let llmModel = '';
  let llmKey = '';
  let llmConfigured = false;
  let llmEnabled = false;

  if (llmChannel) {
    llmApiUrl = llmChannel.api_url || '';
    llmModel = llmChannel.model_name || '';
    llmKey = llmChannel.api_key || '';
    llmConfigured = true;
    llmEnabled = llmChannel.status === 'enabled';
  } else {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get('ai_config') as any;
    if (row) {
      try {
        const cfg = JSON.parse(row.value);
        llmApiUrl = cfg.api_base || '';
        llmModel = cfg.model || '';
        llmKey = cfg.api_key || '';
        llmConfigured = !!(llmApiUrl && llmKey);
        llmEnabled = llmConfigured;
      } catch { /* ignore */ }
    }
  }

  result.push({
    type: 'llm',
    name: '语言大模型',
    description: '用于AI智能分析、SKIIS分析、文本生成等文本分析功能',
    configured: llmConfigured,
    enabled: llmEnabled,
    api_url: llmApiUrl || 'https://api.deepseek.com/v1',
    model_name: llmModel || 'deepseek-chat',
    api_key_masked: llmKey ? `${llmKey.slice(0, 8)}...${llmKey.slice(-4)}` : '',
    has_key: !!llmKey,
  });

  // 2. 视频大模型配置
  // 读取 video_model_configs 第一条已配置记录（默认 seedance）
  let videoCfg: any = null;
  try {
    videoCfg = db.prepare(`
      SELECT id, user_id, model_type, api_url, api_key, model_name, status
      FROM video_model_configs
      WHERE api_key != '' AND api_url != ''
      ORDER BY id ASC LIMIT 1
    `).get();
  } catch { /* video_model_configs 可能不存在 */ }

  // 如果表没有数据，从 video_model_configs 尝试其他渠道，或回退默认值
  let videoApiUrl = '';
  let videoModel = '';
  let videoKey = '';
  let videoConfigured = false;
  let videoEnabled = false;
  let videoModelType = 'seedance';

  if (videoCfg) {
    videoApiUrl = videoCfg.api_url || '';
    videoModel = videoCfg.model_name || '';
    videoKey = videoCfg.api_key || '';
    videoModelType = videoCfg.model_type || 'seedance';
    videoConfigured = !!(videoApiUrl && videoKey && videoModel);
    videoEnabled = videoCfg.status === 'enabled';
  }

  result.push({
    type: 'video',
    name: '视频大模型',
    description: '用于视频生成、数字人等功能',
    configured: videoConfigured,
    enabled: videoEnabled,
    api_url: videoApiUrl,
    model_name: videoModel,
    api_key_masked: videoKey ? `${videoKey.slice(0, 8)}...${videoKey.slice(-4)}` : '',
    has_key: !!videoKey,
    model_type: videoModelType,
  });

  res.json({ configs: result });
});

// ══════════════════════════════════════════════════════════════
//  PUT /api/admin/api-configs/:type  — 保存配置
// ══════════════════════════════════════════════════════════════
router.put('/:type', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  if (!requireAdmin(req, res, db)) return;

  const type = req.params.type;
  const { api_url, api_key, model_name, status } = req.body as any;

  if (!api_url) return res.status(400).json({ error: '请输入 API 接口地址' });
  if (!model_name) return res.status(400).json({ error: '请输入模型名称' });

  if (type === 'llm') {
    // 保存到 settings.ai_config（兼容旧版）
    const value = JSON.stringify({
      api_base: api_url,
      api_key: api_key || '',
      model: model_name,
    });
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('ai_config', value);

    // 同时尝试保存到 ai_channels（如果不存在则插入，存在则更新第一条）
    try {
      const existing = db.prepare("SELECT id FROM ai_channels ORDER BY id ASC LIMIT 1").get() as any;
      if (existing) {
        db.prepare(`
          UPDATE ai_channels SET
            api_base = ?, api_key = ?, model = ?, status = ?,
            updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(api_url, api_key || '', model_name, status === 'enabled' ? 'enabled' : 'disabled', existing.id);
      } else {
        db.prepare(`
          INSERT INTO ai_channels (name, api_base, api_key, model, status, priority, is_default, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `).run('默认渠道', api_url, api_key || '', model_name, status === 'enabled' ? 'enabled' : 'disabled', 1, 1);
      }
    } catch { /* ai_channels 表可能不存在 */ }

    res.json({ success: true, message: '语言大模型配置已保存' });
  } else if (type === 'video') {
    // 保存到 video_model_configs（默认 model_type = seedance）
    const userId = (req as any).user?.userId || 0;
    const modelType = req.body.model_type || 'seedance';
    try {
      const existing = db.prepare("SELECT id FROM video_model_configs WHERE model_type = ? ORDER BY id ASC LIMIT 1").get(modelType) as any;
      if (existing) {
        db.prepare(`
          UPDATE video_model_configs SET
            api_url = ?, api_key = ?, model_name = ?, status = ?,
            updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(api_url, api_key || '', model_name, status === 'enabled' ? 'enabled' : 'disabled', existing.id);
      } else {
        db.prepare(`
          INSERT INTO video_model_configs (user_id, model_type, api_url, api_key, model_name, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
        `).run(userId, modelType, api_url, api_key || '', model_name, status === 'enabled' ? 'enabled' : 'disabled');
      }
    } catch (e: any) {
      return res.status(500).json({ error: '保存视频模型配置失败: ' + e.message });
    }
    res.json({ success: true, message: '视频大模型配置已保存' });
  } else {
    res.status(400).json({ error: '不支持的配置类型: ' + type });
  }
});

// ══════════════════════════════════════════════════════════════
//  DELETE /api/admin/api-configs/:type  — 清空配置
// ══════════════════════════════════════════════════════════════
router.delete('/:type', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  if (!requireAdmin(req, res, db)) return;

  const type = req.params.type;
  if (type === 'llm') {
    db.prepare("DELETE FROM settings WHERE key = ?").run('ai_config');
    try { db.prepare("DELETE FROM ai_channels").run(); } catch { /* ignore */ }
    res.json({ success: true, message: '语言大模型配置已清空' });
  } else if (type === 'video') {
    try { db.prepare("DELETE FROM video_model_configs").run(); } catch { /* ignore */ }
    res.json({ success: true, message: '视频大模型配置已清空' });
  } else {
    res.status(400).json({ error: '不支持的配置类型: ' + type });
  }
});

// ══════════════════════════════════════════════════════════════
//  POST /api/admin/api-configs/:type/test  — 测试连接
// ══════════════════════════════════════════════════════════════
router.post('/:type/test', authMiddleware, async (req: Request, res: Response) => {
  const db = getDb();
  if (!requireAdmin(req, res, db)) return;

  const type = req.params.type;
  const { api_url, api_key, model_name } = req.body as any;

  if (!api_url || !model_name) {
    return res.status(400).json({ error: '请填写完整的 API 地址和模型名称' });
  }

  // 密钥优先用前端传入的，否则从数据库读取（避免前端暴露密钥）
  let key = api_key || '';
  if (!key) {
    if (type === 'llm') {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get('ai_config') as any;
      if (row) {
        try { key = JSON.parse(row.value).api_key || ''; } catch { /* ignore */ }
      }
      if (!key) {
        const ch = db.prepare("SELECT api_key FROM ai_channels WHERE status = 'enabled' AND api_key != '' ORDER BY id ASC LIMIT 1").get() as any;
        if (ch) key = ch.api_key;
      }
    } else if (type === 'video') {
      const cfg = db.prepare("SELECT api_key FROM video_model_configs WHERE api_key != '' ORDER BY id ASC LIMIT 1").get() as any;
      if (cfg) key = cfg.api_key;
    }
  }

  if (!key) {
    return res.status(400).json({ error: '未找到已保存的 API 密钥，请先编辑并保存完整配置' });
  }

  const baseUrl = api_url.replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    if (type === 'llm') {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: model_name, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        res.json({ success: true, message: '语言大模型 API 连接正常' });
      } else {
        const errText = await response.text().catch(() => '');
        res.json({ success: false, error: `连接失败 (HTTP ${response.status}): ${errText.slice(0, 200)}` });
      }
    } else if (type === 'video') {
      // 视频模型测试使用 seedance 格式（默认）
      const endpoint = `${baseUrl}/contents/generations/tasks`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: model_name.toLowerCase(), duration: 5, ratio: '16:9', content: [{ type: 'text', text: 'test' }] }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        res.json({ success: true, message: '视频大模型 API 连接正常' });
      } else if (response.status === 400) {
        const data = await response.json().catch(() => ({}));
        const errMsg = data.error?.message || data.message || '';
        if (errMsg.includes('does not exist') || errMsg.includes('not found')) {
          res.json({ success: false, error: `模型不存在：${errMsg}` });
        } else {
          res.json({ success: true, message: '视频大模型 API 密钥验证通过' });
        }
      } else {
        const errText = await response.text().catch(() => '');
        res.json({ success: false, error: `连接失败 (HTTP ${response.status}): ${errText.slice(0, 200)}` });
      }
    } else {
      res.status(400).json({ error: '不支持的配置类型: ' + type });
    }
  } catch (e: any) {
    clearTimeout(timer);
    const errMsg = e.name === 'AbortError' ? '连接超时（30秒）' : `网络异常：${e.message}`;
    res.json({ success: false, error: errMsg });
  }
});

export default router;
