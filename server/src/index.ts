// ⚠️ 必须在所有 import 之前加载环境变量
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import financeRoutes, { autoUpdateExchangeRate } from './routes/finance';
import influencerRoutes from './routes/influencers';
import settingsRoutes from './routes/settings';
import aiRoutes from './routes/ai';
import shopRoutes from './routes/shops';
import tiktokAuthRoutes from './routes/tiktok-auth';
import tiktokAdsRoutes from './routes/tiktok-ads';
import orderRoutes from './routes/orders';
import orderImportRoutes from './routes/orders-import';
import seedanceRoutes from './routes/seedance';
import videoModelsRoutes from './routes/video-models';
import aiChannelsRoutes from './routes/ai-channels';
import dashboardRoutes from './routes/dashboard';
import influencerReportRoutes from './routes/influencer-reports';
import skiisAnalysisRoutes from './routes/skiis-analysis';
import skiisChatRoutes from './routes/skiis-chat';
import agentChatRoutes from './routes/agent-chat';
import botWecomRoutes from './routes/bot-wecom';
import botFeishuRoutes from './routes/bot-feishu';
import mobileAuthRoutes from './routes/mobile-auth';
import adminRoutes from './routes/admin';
import adminApiConfigRoutes from './routes/admin-api-configs';
import botConfigRoutes from './routes/bot-config';
// import plan1688Routes from './routes/1688-plan';
// import douyinSearchRoutes from './routes/douyin-search';
import { startAutoBackup } from './utils/backup';
import { startAuditLogCleanup, auditMiddleware } from './middleware/audit';
import { startAutoSync } from './services/auto-sync';
import auditLogRoutes from './routes/audit-logs';
import aiStudioRoutes from './routes/ai-studio';
import productsTiktokRoutes from './routes/products-tiktok';
import adCenterRoutes from './routes/ad-center';
import { connectToMCPServer } from './services/tiktok-mcp/client';
import { startFeishuWebSocket } from './routes/bot-feishu-ws';
import { startTokenScheduler } from './services/tiktok-oauth';
import getDb from './db';

// ── 启动时强制检查 tiktok_shops 表结构迁移 ──
const startupDb = getDb();
const shopCols = startupDb.prepare("PRAGMA table_info(tiktok_shops)").all() as any[];
const tikApiMigrations: [string, string][] = [
  ['app_key', "ALTER TABLE tiktok_shops ADD COLUMN app_key TEXT DEFAULT ''"],
  ['app_secret', "ALTER TABLE tiktok_shops ADD COLUMN app_secret TEXT DEFAULT ''"],
  ['access_token', "ALTER TABLE tiktok_shops ADD COLUMN access_token TEXT DEFAULT ''"],
  ['refresh_token', "ALTER TABLE tiktok_shops ADD COLUMN refresh_token TEXT DEFAULT ''"],
  ['shop_cipher', "ALTER TABLE tiktok_shops ADD COLUMN shop_cipher TEXT DEFAULT ''"],
  ['token_expires_at', "ALTER TABLE tiktok_shops ADD COLUMN token_expires_at DATETIME"],
  ['api_version', "ALTER TABLE tiktok_shops ADD COLUMN api_version TEXT DEFAULT '202309'"],
  ['sync_enabled', "ALTER TABLE tiktok_shops ADD COLUMN sync_enabled INTEGER DEFAULT 0"],
];
for (const [col, sql] of tikApiMigrations) {
  if (!shopCols.some((c: any) => c.name === col)) {
    startupDb.exec(sql);
    console.log(`[migrate] Added ${col} to tiktok_shops`);
  }
}


const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 信任 Nginx 反向代理，读取 X-Forwarded-For 获取真实客户端 IP
app.set('trust proxy', true);

// 全局审计日志：记录所有 API 请求的 IP + User-Agent + 状态码
app.use('/api', auditMiddleware);

// Health Check（Docker 健康检查用）
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/auth', mobileAuthRoutes);
app.use('/api/products', productRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/influencers', influencerRoutes);
app.use('/api/influencer-reports', influencerReportRoutes);
app.use('/api/skiis', skiisAnalysisRoutes);
app.use('/api/skiis-chat', skiisChatRoutes);
app.use('/api/agent', agentChatRoutes);
app.use('/api/bot/wecom', botWecomRoutes);
app.use('/api/bot/feishu', botFeishuRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/api-configs', adminApiConfigRoutes);
app.use('/api/admin/api-configs', botConfigRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/shops/tiktok', tiktokAuthRoutes);
app.use('/api/tiktok-ads', tiktokAdsRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/orders/ai-import', orderImportRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/seedance', seedanceRoutes);
app.use('/api/video-models', videoModelsRoutes);
app.use('/api/ai-channels', aiChannelsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/ai-studio', aiStudioRoutes);
app.use('/api/products-tiktok', productsTiktokRoutes);
app.use('/api/ad-center', adCenterRoutes);


// Serve uploaded images
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads');
app.use('/uploads', express.static(uploadDir));

// Serve static files from client build — 仅开发环境使用
// 生产环境由 Nginx 容器直接提供静态文件
if (process.env.NODE_ENV !== 'production') {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist, {
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    },
  }));
  app.get('*', (_req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 全局错误处理中间件（捕获未处理的异常，记录日志）
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[GlobalErrorHandler]', err?.stack || err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: '服务器内部错误', detail: err?.message });
  }
});

app.listen(PORT, () => {
  console.log(`虾掌柜ERP服务端已启动: http://localhost:${PORT}`);

  // 启动飞书长连接（如已配置 FEISHU_APP_ID/SECRET）
  startFeishuWebSocket();

  // 启动 TikTok Shop token 自动刷新调度器（每 5 分钟扫描一次，提前刷新即将过期的 token）
  startTokenScheduler();

  // 启动时立即更新一次汇率
  autoUpdateExchangeRate();

  // 每天 9:00 自动更新汇率
  const scheduleNext9am = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(9, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const delay = next.getTime() - now.getTime();
    setTimeout(() => {
      autoUpdateExchangeRate();
      setInterval(autoUpdateExchangeRate, 24 * 60 * 60 * 1000);
    }, delay);
    console.log(`[Scheduler] 汇率自动更新已计划: ${next.toLocaleString('zh-CN')}`);
  };
  scheduleNext9am();

  // 启动自动备份
  startAutoBackup();

  // 启动审计日志自动清理（30天）
  startAuditLogCleanup();

  // 启动订单自动同步（每10分钟从 TikTok API 拉取新订单）
  const syncInterval = parseInt(process.env.AUTO_SYNC_INTERVAL_MINUTES || '10', 10);
  console.log(`[Scheduler] 订单自动同步: 每 ${syncInterval} 分钟执行一次`);
  startAutoSync(syncInterval);

  // 尝试连接 TikTok Ads MCP Server（非阻塞，失败不阻止服务启动）
  if (process.env.TT_MCP_SERVER_URL) {
    console.log('[MCP] 检测到 MCP Server 配置，正在自动连接...');
    connectToMCPServer().then(ok => {
      if (ok) {
        console.log('[MCP] ✅ TikTok Ads MCP Server 已自动连接');
      } else {
        console.log('[MCP] ⚠️ 自动连接失败，可通过 POST /api/ad-center/connect 手动重试');
      }
    });
  } else {
    console.log('[MCP] 未配置 TT_MCP_SERVER_URL，跳过自动连接。使用 POST /api/ad-center/connect 手动连接');
  }
});
