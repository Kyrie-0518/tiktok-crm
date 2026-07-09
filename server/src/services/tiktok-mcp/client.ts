/**
 * TikTok for Business MCP Server 客户端
 * 
 * 接入方式：SSE (Server-Sent Events) + JSON-RPC
 * 依赖：@modelcontextprotocol/sdk
 * 
 * 文档：https://business-api.tiktok.com/portal/docs/tiktok-ads-mcp-server/v1.3
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// ── 类型定义 ──

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export interface MCPToolCallResult {
  toolName: string;
  content: any;
  error?: string;
}

// ── 全局状态 ──

let mcpClient: Client | null = null;
let cachedTools: MCPTool[] = [];
let isConnecting = false;
let connectionError: string | null = null;
let lastConnectedAt: string | null = null;

// ── 连接管理 ──

/**
 * 连接到 TikTok MCP Server
 * @param serverUrl - TikTok 提供的 MCP Server SSE URL
 * @param accessToken - TikTok for Business access token
 */
export async function connectToMCPServer(serverUrl?: string, accessToken?: string): Promise<boolean> {
  if (isConnecting) {
    console.log('[MCP] 正在连接中，跳过重复请求');
    return false;
  }

  const url = serverUrl || process.env.TT_MCP_SERVER_URL || 'https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat';
  const token = accessToken || process.env.TT_MCP_ACCESS_TOKEN;

  if (!url) {
    connectionError = '未配置 TT_MCP_SERVER_URL 环境变量（请从 TikTok Business API Portal 获取 MCP Server URL）';
    console.error('[MCP]', connectionError);
    return false;
  }

  if (!token) {
    connectionError = '未配置 TT_MCP_ACCESS_TOKEN 环境变量';
    console.error('[MCP]', connectionError);
    return false;
  }

  isConnecting = true;
  connectionError = null;

  try {
    console.log(`[MCP] 正在连接 TikTok MCP Server: ${url}`);

    // 销毁旧连接
    if (mcpClient) {
      try { await mcpClient.close(); } catch { /* ignore */ }
      mcpClient = null;
    }

    const transport = new SSEClientTransport(
      new URL(url),
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    mcpClient = new Client(
      { name: 'bozone-erp', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    await mcpClient.connect(transport);
    lastConnectedAt = new Date().toISOString();

    // 加载工具列表
    const toolsResult = await mcpClient.listTools();
    cachedTools = (toolsResult?.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    console.log(`[MCP] ✅ 连接成功，发现 ${cachedTools.length} 个工具`);
    connectionError = null;

    return true;
  } catch (e: any) {
    connectionError = e.message || String(e);
    console.error('[MCP] ❌ 连接失败:', connectionError);
    mcpClient = null;
    return false;
  } finally {
    isConnecting = false;
  }
}

/**
 * 获取所有可用工具列表
 */
export function getAvailableTools(): MCPTool[] {
  return cachedTools;
}

/**
 * 调用 MCP 工具
 * @param toolName - 工具名称（如 "advertiser_info_get"）
 * @param args - 参数对象
 */
export async function callMCPTool(toolName: string, args: Record<string, any> = {}): Promise<MCPToolCallResult> {
  if (!mcpClient) {
    return { toolName, content: null, error: 'MCP 客户端未连接，请先调用 connectToMCPServer()' };
  }

  try {
    const result = await mcpClient.callTool({
      name: toolName,
      arguments: args,
    });

    return {
      toolName,
      content: result?.content || result,
    };
  } catch (e: any) {
    return { toolName, content: null, error: e.message || String(e) };
  }
}

/**
 * 获取连接状态
 */
export function getMCPStatus() {
  return {
    connected: !!mcpClient,
    connecting: isConnecting,
    error: connectionError,
    toolCount: cachedTools.length,
    lastConnectedAt,
  };
}

/**
 * 关闭 MCP 连接
 */
export async function closeMCPConnection() {
  if (mcpClient) {
    try { await mcpClient.close(); } catch { /* ignore */ }
    mcpClient = null;
    cachedTools = [];
  }
}
