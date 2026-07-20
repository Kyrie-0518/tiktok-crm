import { Router, Request, Response } from 'express';
import getDb from '../db';
import authMiddleware from '../middleware/auth';

const router = Router();
const authenticate = authMiddleware;

// ============ 读取当前用户的 Seedance API 配置 ============
function getUserSeedanceConfig(userId: number | undefined) {
  if (!userId) return null;
  const db = getDb();
  const config = db.prepare(
    'SELECT * FROM seedance_user_configs WHERE user_id = ?'
  ).get(userId) as any;
  return config || null;
}

// ============ 模板库 ============

router.get('/templates', authenticate, (req, res) => {
  const db = getDb();
  const { category } = req.query;
  let sql = 'SELECT * FROM seedance_templates WHERE is_system = 1';
  const params: any[] = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY id';
  res.json(db.prepare(sql).all(...params));
});

router.get('/template-categories', authenticate, (_, res) => {
  const db = getDb();
  const cats = db.prepare('SELECT DISTINCT category FROM seedance_templates WHERE is_system = 1 ORDER BY category').all();
  res.json(cats.map((c: any) => c.category));
});

// ============ 素材库（按 user_id 隔离，developer 可查看全部） ============

router.get('/materials', authenticate, (req, res) => {
  const db = getDb();
  const userId = (req as any).user?.userId;
  const roleKey = (req as any).user?.roleKey;
  const { category } = req.query;
  const isDeveloper = roleKey === 'developer';
  let sql = `SELECT sm.*, u.username FROM seedance_materials sm LEFT JOIN users u ON sm.user_id = u.id WHERE ${isDeveloper ? '1=1' : 'sm.user_id = ?'}`;
  const params: any[] = isDeveloper ? [] : [userId];
  if (category) { sql += ' AND sm.category = ?'; params.push(category); }
  sql += ' ORDER BY sm.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/materials', authenticate, (req, res) => {
  const db = getDb();
  const userId = (req as any).user?.userId;
  const { category = '默认', file_type, file_url, file_name, file_size } = req.body;
  if (!file_type || !file_url) return res.status(400).json({ error: '缺少文件信息' });
  const r = db.prepare(
    'INSERT INTO seedance_materials (user_id, category, file_type, file_url, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, category, file_type, file_url, file_name || '', file_size || 0);
  res.json({ id: r.lastInsertRowid, message: '素材添加成功' });
});

router.delete('/materials/:id', authenticate, (req, res) => {
  const db = getDb();
  const userId = (req as any).user?.userId;
  const roleKey = (req as any).user?.roleKey;
  const isDeveloper = roleKey === 'developer';
  let sql, params: any[];
  if (isDeveloper) {
    sql = 'DELETE FROM seedance_materials WHERE id = ?';
    params = [req.params.id];
  } else {
    sql = 'DELETE FROM seedance_materials WHERE id = ? AND user_id = ?';
    params = [req.params.id, userId];
  }
  const r = db.prepare(sql).run(...params);
  if (r.changes === 0) return res.status(404).json({ error: '素材不存在或无权删除' });
  res.json({ message: '素材删除成功' });
});

// ============ 我的作品（按 user_id 隔离，developer 可查看全部） ============

router.get('/videos', authenticate, (req, res) => {
  const db = getDb();
  const userId = (req as any).user?.userId;
  const roleKey = (req as any).user?.roleKey;
  const { product_id, status } = req.query;
  const isDeveloper = roleKey === 'developer';
  let sql = `SELECT sv.*, p.name as product_name, p.image as product_image, u.username FROM seedance_videos sv LEFT JOIN products p ON sv.product_id = p.id LEFT JOIN users u ON sv.user_id = u.id WHERE ${isDeveloper ? '1=1' : 'sv.user_id = ?'}`;
  const params: any[] = isDeveloper ? [] : [userId];
  if (product_id) { sql += ' AND sv.product_id = ?'; params.push(product_id); }
  if (status) { sql += ' AND sv.status = ?'; params.push(status); }
  sql += ' ORDER BY sv.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.delete('/videos/:id', authenticate, (req, res) => {
  const db = getDb();
  const userId = (req as any).user?.userId;
  const roleKey = (req as any).user?.roleKey;
  const isDeveloper = roleKey === 'developer';
  let sql, params: any[];
  if (isDeveloper) {
    sql = 'DELETE FROM seedance_videos WHERE id = ?';
    params = [req.params.id];
  } else {
    sql = 'DELETE FROM seedance_videos WHERE id = ? AND user_id = ?';
    params = [req.params.id, userId];
  }
  const r = db.prepare(sql).run(...params);
  if (r.changes === 0) return res.status(404).json({ error: '视频不存在或无权删除' });
  res.json({ message: '视频删除成功' });
});

// ============ 产品信息 ============

router.get('/products', authenticate, (req, res) => {
  const db = getDb();
  const { keyword } = req.query;
  let sql = 'SELECT id, sku, name, image, sell_price, weight FROM products WHERE 1=1';
  const params: any[] = [];
  if (keyword) { sql += ' AND (name LIKE ? OR sku LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  sql += ' ORDER BY id DESC LIMIT 50';
  res.json(db.prepare(sql).all(...params));
});

// ============ 用户独立 Seedance 模型配置 ============

// GET /seedance/user-config — 获取当前用户的模型配置
router.get('/user-config', authenticate, (req, res) => {
  const userId = (req as any).user?.userId;
  const config = getUserSeedanceConfig(userId);
  if (config) {
    // 返回时脱敏 api_key，并转换时间格式为 ISO 8601（带时区信息）
    const convertToLocalISO = (dateStr: string | null) => {
      if (!dateStr) return null;
      try {
        // SQLite 返回的 datetime('now', 'localtime') 格式如 "2026-05-15 18:15:00"
        // 直接用 new Date() 解析可能有时区问题，转为 ISO 格式确保正确
        const d = new Date(dateStr);
        return d.toISOString();
      } catch {
        return dateStr;
      }
    };
    res.json({
      ...config,
      last_tested_at: convertToLocalISO(config.last_tested_at),
      api_key_masked: config.api_key
        ? `${config.api_key.substring(0, 8)}...${config.api_key.substring(config.api_key.length - 4)}`
        : '',
    });
  } else {
    res.json({
      user_id: userId,
      api_url: '',
      api_key: '',
      api_key_masked: '',
      model_name: '',
      status: 'disabled',
      last_tested_at: null,
      last_test_result: '',
      last_test_message: '',
    });
  }
});

// PUT /seedance/user-config — 保存/更新当前用户的模型配置
router.put('/user-config', authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).user?.userId;
  const { api_url, api_key, model_name, status } = req.body as any;

  if (!api_url) return res.status(400).json({ error: '请输入 API 接口地址' });
  if (!api_key) return res.status(400).json({ error: '请输入 API Key' });
  if (!model_name) return res.status(400).json({ error: '请输入模型名称' });

  const existing = db.prepare('SELECT id FROM seedance_user_configs WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare(`
      UPDATE seedance_user_configs 
      SET api_url = ?, api_key = ?, model_name = ?, status = ?, updated_at = datetime('now', 'localtime')
      WHERE user_id = ?
    `).run(api_url, api_key, model_name, status || 'disabled', userId);
  } else {
    db.prepare(`
      INSERT INTO seedance_user_configs (user_id, api_url, api_key, model_name, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, api_url, api_key, model_name, status || 'disabled');
  }
  res.json({ success: true, message: '配置保存成功' });
});

// POST /seedance/user-config/test — 测试当前用户的模型连接
router.post('/user-config/test', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const config = getUserSeedanceConfig(userId);

  if (!config || !config.api_url || !config.api_key || !config.model_name) {
    return res.json({ success: false, error: '请先保存 API 配置（包含模型名称）' });
  }

  const apiUrl = config.api_url.replace(/\/+$/, '');
  const apiKey = config.api_key;
  const modelName = config.model_name.toLowerCase();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    // Seedance 视频模型测试用 /contents/generations/tasks 接口
    const response = await fetch(`${apiUrl}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        ratio: '16:9',
        generate_audio: true,
        content: [{ type: 'text', text: 'test' }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const db = getDb();
    const responseData = await response.json().catch(() => ({}));

    // 检查响应体中是否有错误
    const hasError = responseData.error || responseData.code || !responseData.id;
    if (response.ok && !hasError) {
      db.prepare(`
        UPDATE seedance_user_configs
        SET last_tested_at = datetime('now', 'localtime'), last_test_result = 'success',
            last_test_message = '模型API接入正常'
        WHERE user_id = ?
      `).run(userId);
      res.json({ success: true, message: '模型API接入正常' });
    } else {
      const errMsg = responseData.error?.message || responseData.message || responseData.code || `HTTP ${response.status}`;
      db.prepare(`
        UPDATE seedance_user_configs
        SET last_tested_at = datetime('now', 'localtime'), last_test_result = 'failed',
            last_test_message = ?
        WHERE user_id = ?
      `).run(errMsg.slice(0, 500), userId);

      // 判断错误类型
      if (response.status === 401 || /invalid.*key|auth/i.test(errMsg)) {
        res.json({ success: false, error: '密钥错误：请检查 API Key 是否正确', detail: errMsg });
      } else if (response.status === 404) {
        res.json({ success: false, error: '地址无效：请检查 API 接口地址', detail: errMsg });
      } else {
        res.json({ success: false, error: `连接失败：${errMsg}`, detail: errMsg });
      }
    }
  } catch (e: any) {
    const db = getDb();
    const errMsg = e.name === 'AbortError' ? '连接超时' : `网络异常：${e.message}`;
    db.prepare(`
      UPDATE seedance_user_configs
      SET last_tested_at = datetime('now', 'localtime'), last_test_result = 'failed',
          last_test_message = ?
      WHERE user_id = ?
    `).run(errMsg.slice(0, 500), userId);
    res.json({ success: false, error: errMsg });
  }
});

// GET /seedance/my-binding — 供前端检查是否有可用配置
router.get('/my-binding', authenticate, (req, res) => {
  const userId = (req as any).user?.userId;
  const config = getUserSeedanceConfig(userId);
  res.json({
    user_id: userId,
    has_config: !!(config && config.api_key && config.status === 'enabled'),
    api_id: config?.id || null,
    api_name: config?.api_url ? '我的模型API' : null,
    api_status: config?.status || 'disabled',
  });
});

// ============ AI视频生成（使用用户自己的 Seedance 配置） ============

// POST /seedance/chat — 调用用户自己配置的 Seedance API
router.post('/chat', authenticate, async (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).user?.userId;
  const { prompt, model, product_image, reference_image, reference_images, product_id, resolution, duration, aspect_ratio } = req.body as any;

  if (!prompt) {
    res.status(400).json({ error: '请输入提示词' });
    return;
  }

  // 读取用户自己的 Seedance 配置
  const userConfig = getUserSeedanceConfig(userId);
  if (!userConfig || !userConfig.api_key || userConfig.status !== 'enabled') {
    res.status(400).json({
      error: '请先在「模型API配置」中完成 API 配置并测试通过后启用',
    });
    return;
  }

  const modelName = model || 'Doubao-Seedance-2.0-260128';
  const baseUrl = userConfig.api_url.replace(/\/+$/, '');

  // 保存生成记录
  const r = db.prepare(`
    INSERT INTO seedance_videos (user_id, product_id, prompt, model, resolution, duration, aspect_ratio, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'generating')
  `).run(userId, product_id || null, prompt, modelName, resolution || '720p', duration || 5, aspect_ratio || '9:16');
  const videoId = r.lastInsertRowid;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userConfig.api_key}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...(product_image ? [{ type: 'image_url', image_url: { url: product_image } }] : []),
            ...(reference_image ? [{ type: 'image_url', image_url: { url: reference_image } }] : []),
            ...(reference_images || []).map((url: string) => ({
              type: 'image_url',
              image_url: { url },
            })),
          ],
        }],
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let errMsg = `API 调用失败 (${response.status})`;
      try { const d = JSON.parse(errText); errMsg = d.error?.message || d.message || errMsg; } catch {}
      db.prepare('UPDATE seedance_videos SET status = ?, api_response = ? WHERE id = ?').run('failed', errText.slice(0, 500), videoId);
      res.status(response.status).json({ error: errMsg });
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const videoUrl = data.video_url || content;

    db.prepare(`
      UPDATE seedance_videos SET video_url = ?, thumbnail_url = ?, status = 'completed', api_response = ? WHERE id = ?
    `).run(videoUrl, data.thumbnail_url || '', JSON.stringify(data), videoId);

    res.json({
      success: true, id: videoId, video_url: videoUrl,
      task_id: data.id || data.task_id, model: modelName,
    });
  } catch (e: any) {
    db.prepare('UPDATE seedance_videos SET status = ?, api_response = ? WHERE id = ?').run('failed', e.message || '', videoId);
    if (e.name === 'AbortError') {
      res.status(504).json({ error: '请求超时（2分钟）' });
    } else {
      res.status(500).json({ error: 'Seedance 调用失败: ' + (e.message || '未知错误') });
    }
  }
});

export default router;
