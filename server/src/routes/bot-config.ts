/**
 * Bot 配置管理 API
 * 读写 docker-compose.yml 中的企业微信/飞书环境变量
 */
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// 读取 docker-compose.yml 中的环境变量
function readComposeEnv(platform: string): Record<string, string> {
  const composePath = path.resolve(__dirname, '../../../docker-compose.yml');
  if (!fs.existsSync(composePath)) return {};

  const content = fs.readFileSync(composePath, 'utf-8');
  const result: Record<string, string> = {};

  // 匹配特定平台的环境变量
  const prefix = platform === 'wecom' ? 'WECOM_' : 'FEISHU_';
  const regex = new RegExp(`- ${prefix}(\\w+)=(.+)`, 'g');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const value = match[2].trim();
    result[`${prefix}${match[1]}`] = value;
  }

  return result;
}

// 写入 docker-compose.yml 环境变量
function writeComposeEnv(platform: string, values: Record<string, string>): void {
  const composePath = path.resolve(__dirname, '../../../docker-compose.yml');
  let content = fs.readFileSync(composePath, 'utf-8');

  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`(${key}=).*`, 'g');
    const replacement = `$1${value}`;
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
    } else {
      // 新增变量：插入到该平台变量组末尾
      const prefix = platform === 'wecom' ? 'WECOM_' : 'FEISHU_';
      const insertPattern = new RegExp(`(- ${prefix}.*\n)(?!- ${prefix})`, 'g');
      if (insertPattern.test(content)) {
        content = content.replace(insertPattern, `$1      - ${key}=${value}\n`);
      }
    }
  }

  fs.writeFileSync(composePath, content, 'utf-8');
}

// 清空平台环境变量
function clearComposeEnv(platform: string): void {
  const composePath = path.resolve(__dirname, '../../../docker-compose.yml');
  let content = fs.readFileSync(composePath, 'utf-8');
  const prefix = platform === 'wecom' ? 'WECOM_' : 'FEISHU_';

  const lines = content.split('\n');
  const filtered = lines.filter(line => !line.trim().startsWith(`- ${prefix}`));
  content = filtered.join('\n');
  fs.writeFileSync(composePath, content, 'utf-8');
}

// GET /api/admin/api-configs/bot — 获取所有Bot配置
router.get('/bot', (_req: Request, res: Response) => {
  const wecomConfig = readComposeEnv('wecom');
  const feishuConfig = readComposeEnv('feishu');

  res.json({
    configs: {
      wecom: wecomConfig,
      feishu: feishuConfig,
    },
    statuses: {
      wecom: !!(wecomConfig.WECOM_CORP_ID && wecomConfig.WECOM_SECRET && wecomConfig.WECOM_TOKEN),
      feishu: !!(feishuConfig.FEISHU_APP_ID && feishuConfig.FEISHU_APP_SECRET),
    },
  });
});

// PUT /api/admin/api-configs/bot — 保存Bot配置
router.put('/bot', (req: Request, res: Response) => {
  try {
    const { platform, values } = req.body;
    if (!platform || !values || typeof values !== 'object') {
      return res.status(400).json({ error: '参数不完整' });
    }

    writeComposeEnv(platform, values);
    res.json({ success: true, message: '配置已保存到 docker-compose.yml，重启服务后生效' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/api-configs/bot/:platform — 清空Bot配置
router.delete('/bot/:platform', (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    if (!['wecom', 'feishu'].includes(platform)) {
      return res.status(400).json({ error: '不支持的平台' });
    }

    clearComposeEnv(platform);
    res.json({ success: true, message: '配置已清空' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
