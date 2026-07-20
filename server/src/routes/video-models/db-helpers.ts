import getDb from '../../db';
import path from 'path';
import fs from 'fs';

// 视频本地存储目录
const VIDEO_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', '..', 'data', 'uploads'), 'videos');
if (!fs.existsSync(VIDEO_UPLOAD_DIR)) fs.mkdirSync(VIDEO_UPLOAD_DIR, { recursive: true });

/**
 * 将远程视频URL下载保存到本地，返回本地路径
 * 下载失败时返回原URL（不阻塞主流程）
 */
export async function downloadVideoToLocal(remoteUrl: string, videoId: number): Promise<string> {
  if (!remoteUrl) return '';
  // 已经是本地路径则直接返回
  if (remoteUrl.startsWith('/uploads/')) return remoteUrl;

  const ext = remoteUrl.includes('.mp4') ? '.mp4' : remoteUrl.includes('.webm') ? '.webm' : '.mp4';
  const localFilename = `video_${videoId}_${Date.now()}${ext}`;
  const localPath = path.join(VIDEO_UPLOAD_DIR, localFilename);

  try {
    console.log(`[downloadVideo] 开始下载视频 ${videoId}...`);
    const response = await fetch(remoteUrl, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    const localUrl = `/uploads/videos/${localFilename}`;
    console.log(`[downloadVideo] 视频${videoId} 已保存到本地 (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    return localUrl;
  } catch (e: any) {
    console.error(`[downloadVideo] 视频${videoId} 下载失败:`, e.message);
    // 下载失败时仍返回远程URL，至少能短暂使用
    return remoteUrl;
  }
}

// 数据库操作辅助函数

export function getUserModelConfigs(userId: number | undefined) {
  if (!userId) return [];
  return getDb().prepare('SELECT * FROM video_model_configs WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
}

/**
 * 获取用户模型配置（仅查当前用户自己的配置）
 */
export function getUserModelConfig(userId: number | undefined, modelType: string) {
  if (!userId) return null;
  return getDb().prepare('SELECT * FROM video_model_configs WHERE user_id = ? AND model_type = ?').get(userId, modelType) as any || null;
}

export function saveUserModelConfig(
  userId: number,
  modelType: string,
  data: { api_url: string; query_api_url?: string; api_key: string; model_name: string; extra_params?: any; status?: string }
) {
  const db = getDb();
  const { api_url, query_api_url, api_key, model_name, extra_params, status } = data;
  const existing = db.prepare('SELECT id FROM video_model_configs WHERE user_id = ? AND model_type = ?').get(userId, modelType);

  if (existing) {
    const updates: string[] = ['api_url = ?', 'query_api_url = ?', 'model_name = ?', 'status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [api_url, query_api_url || '', model_name, status || 'disabled'];
    if (api_key) { updates.push('api_key = ?'); values.push(api_key); }
    if (extra_params !== undefined) { updates.push('extra_params = ?'); values.push(typeof extra_params === 'string' ? extra_params : JSON.stringify(extra_params)); }
    values.push(userId, modelType);
    db.prepare(`UPDATE video_model_configs SET ${updates.join(', ')} WHERE user_id = ? AND model_type = ?`).run(...values);
  } else {
    db.prepare(`INSERT INTO video_model_configs (user_id, model_type, api_url, query_api_url, api_key, model_name, extra_params, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      userId, modelType, api_url, query_api_url || '', api_key, model_name, typeof extra_params === 'string' ? extra_params : JSON.stringify(extra_params || {}), status || 'disabled'
    );
  }
}

export function updateTestResult(userId: number, modelType: string, result: 'success' | 'failed', message: string) {
  getDb().prepare(`UPDATE video_model_configs SET last_tested_at = CURRENT_TIMESTAMP, last_test_result = ?, last_test_message = ? WHERE user_id = ? AND model_type = ?`).run(result, message.slice(0, 500), userId, modelType);
}
