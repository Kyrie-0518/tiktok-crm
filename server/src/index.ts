import express from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import financeRoutes, { autoUpdateExchangeRate } from './routes/finance';
import influencerRoutes from './routes/influencers';
import settingsRoutes from './routes/settings';
import aiRoutes from './routes/ai';
import shopRoutes from './routes/shops';
import tiktokAuthRoutes from './routes/tiktok-auth';
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
import adminRoutes from './routes/admin';
// import plan1688Routes from './routes/1688-plan';
// import douyinSearchRoutes from './routes/douyin-search';
import { startAutoBackup } from './utils/backup';
import { auditMiddleware, startAuditLogCleanup } from './middleware/audit';
import auditLogRoutes from './routes/audit-logs';
import aiStudioRoutes from './routes/ai-studio';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiting: 登录接口 5次失败锁定15分钟
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次尝试
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: any, res: any) => {
    res.status(429).json({ error: '登录尝试次数过多，请15分钟后重试' });
  },
  keyGenerator: (req: any) => {
    // 使用 username 作为限流key，如果没有则使用 IP
    return req.body?.username || (req.ip || req.socket?.remoteAddress || 'unknown');
  },
  skipSuccessfulRequests: true, // 成功的登录请求不计入限制
});

// 审计日志中间件（全局记录所有API操作）
app.use(auditMiddleware);

// Health Check（Docker 健康检查用，不记录审计日志的路由）
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// 登录限流
app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/influencers', influencerRoutes);
app.use('/api/influencer-reports', influencerReportRoutes);
app.use('/api/skiis', skiisAnalysisRoutes);
app.use('/api/skiis-chat', skiisChatRoutes);
app.use('/api/agent', agentChatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/shops/tiktok', tiktokAuthRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/orders/ai-import', orderImportRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/seedance', seedanceRoutes);
app.use('/api/video-models', videoModelsRoutes);
app.use('/api/ai-channels', aiChannelsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/ai-studio', aiStudioRoutes);


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
});
