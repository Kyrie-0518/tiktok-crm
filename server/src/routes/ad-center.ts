/**
 * 广告中心 API 路由
 * 通过 TikTok MCP Server 提供直播间广告管理能力
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  connectToMCPServer,
  getAvailableTools,
  getMCPStatus,
  callMCPTool,
  closeMCPConnection,
} from '../services/tiktok-mcp/client';

const router = Router();

// ── MCP 连接管理 ──

// POST /api/ad-center/connect — 连接/重连 TikTok MCP Server
router.post('/connect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { serverUrl, accessToken } = req.body;
    const ok = await connectToMCPServer(serverUrl, accessToken);
    if (ok) {
      const tools = getAvailableTools();
      res.json({
        success: true,
        toolCount: tools.length,
        message: `成功连接 TikTok MCP Server，发现 ${tools.length} 个工具`,
      });
    } else {
      const status = getMCPStatus();
      res.status(400).json({ success: false, error: status.error || '连接失败' });
    }
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/ad-center/status — 获取 MCP 连接状态和可用工具列表
router.get('/status', authMiddleware, (_req: Request, res: Response) => {
  const status = getMCPStatus();
  const tools = status.connected
    ? getAvailableTools().map(t => ({ name: t.name, description: t.description }))
    : [];
  res.json({ ...status, tools });
});

// POST /api/ad-center/close — 断开 MCP 连接
router.post('/close', authMiddleware, async (_req: Request, res: Response) => {
  await closeMCPConnection();
  res.json({ success: true, message: 'MCP 连接已关闭' });
});

// ── 工具调用 ──

// POST /api/ad-center/call-tool — 调用指定 MCP 工具
router.post('/call-tool', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { toolName, args } = req.body;
    if (!toolName) return res.status(400).json({ success: false, error: '缺少 toolName 参数' });

    const result = await callMCPTool(toolName, args || {});
    if (result.error) {
      return res.json({ success: false, error: result.error, toolName });
    }
    res.json({ success: true, toolName, data: result.content });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── 快捷操作 ──

// GET /api/ad-center/advertisers — 获取广告账户列表（快捷方式）
router.get('/advertisers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await callMCPTool('advertiser_info_get', {});
    if (result.error) {
      return res.json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.content });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/ad-center/campaigns — 获取广告系列列表（快捷方式）
router.get('/campaigns', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, page = 1, page_size = 50 } = req.query;
    const result = await callMCPTool('campaign_get', {
      advertiser_id: advertiser_id || '',
      page: Number(page),
      page_size: Number(page_size),
    });
    if (result.error) {
      return res.json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.content });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/ad-center/reports — 获取广告报表（快捷方式）
router.get('/reports', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { advertiser_id, dimensions = 'campaign_id', metrics = 'cost,impressions,clicks,conversions', start_date, end_date } = req.query;
    const result = await callMCPTool('report_integrated_get', {
      advertiser_id: advertiser_id || '',
      dimensions: String(dimensions).split(','),
      metrics: String(metrics).split(','),
      start_date: start_date || '',
      end_date: end_date || '',
      page: 1,
      page_size: 100,
    });
    if (result.error) {
      return res.json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.content });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
