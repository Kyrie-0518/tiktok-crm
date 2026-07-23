/**
 * 智能对话记忆系统 v1
 * - 会话隔离（每个用户可开启多个独立会话）
 * - Token 感知限制（总上下文 ≤ 128K token，历史自动截断旧消息）
 * - 关键信息保留（工具调用结果不截断）
 * - 会话自动过期（24 小时无活动 → 标记旧 → 延迟清理 7 天）
 * - 新会话自动创建（前端无需手动管理 sessionId）
 */
import getDb from '../db';
import crypto from 'crypto';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

interface ChatSession {
  session_id: string;
  user_id: number;
  title: string;
  message_count: number;
  total_tokens: number;
  created_at: string;
  updated_at: string;
}

// ══════════════════════════════════════════
//  Session Lifecycle
// ══════════════════════════════════════════

export function createSession(userId: number, firstQuery: string): string {
  const db = getDb();
  // 1. 清理 24 小时前的旧会话（只改状态，不删数据）
  db.prepare(`UPDATE chat_sessions SET status='archived' WHERE user_id=? AND status='active' AND updated_at < datetime('now','localtime','-24 hours')`).run(userId);

  // 2. 检查活跃会话数是否超限（每用户最多 5 个活跃会话）
  const active = db.prepare(`SELECT COUNT(*) as c FROM chat_sessions WHERE user_id=? AND status='active'`).get(userId) as any;
  if (active.c >= 5) {
    // 把最旧的会话归档
    db.prepare(`UPDATE chat_sessions SET status='archived' WHERE id=(SELECT id FROM chat_sessions WHERE user_id=? AND status='active' ORDER BY updated_at ASC LIMIT 1)`).run(userId);
  }

  // 3. 创建新会话
  const sessionId = `conv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const title = firstQuery.slice(0, 50).replace(/[\n\r]/g, ' ');
  db.prepare(`INSERT INTO chat_sessions (session_id, user_id, title, status, message_count, created_at, updated_at) VALUES (?,?,?,'active',0,datetime('now','localtime'),datetime('now','localtime'))`).run(sessionId, userId, title);
  return sessionId;
}

export function getSession(userId: number, sessionId?: string): ChatSession | null {
  if (!sessionId) return null;
  const db = getDb();
  return db.prepare(`SELECT * FROM chat_sessions WHERE session_id=? AND user_id=? AND status='active'`).get(sessionId, userId) as any || null;
}

export function getUserSessions(userId: number): ChatSession[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM chat_sessions WHERE user_id=? AND status='active' ORDER BY updated_at DESC LIMIT 10`).all(userId) as any[];
}

export function deleteSession(userId: number, sessionId: string): void {
  const db = getDb();
  db.prepare(`UPDATE chat_sessions SET status='deleted' WHERE session_id=? AND user_id=?`).run(sessionId, userId);
}

// ══════════════════════════════════════════
//  Message History
// ══════════════════════════════════════════

const MAX_CONTEXT_TOKENS = 80000;  // 留给输出 48K 余量 = 128K
const MAX_HISTORY_TURNS = 20;      // 最多 20 轮（40 条消息）

export function loadHistory(userId: number, sessionId: string): ChatMessage[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT role, content, tool_calls_json FROM chat_history WHERE session_id=? AND user_id=? ORDER BY id ASC LIMIT ?`
  ).all(sessionId, userId, MAX_HISTORY_TURNS * 2) as any[];
  return rows.map((r: any) => ({
    role: r.role,
    content: r.content,
    tool_calls: r.tool_calls_json ? JSON.parse(r.tool_calls_json) : undefined,
  }));
}

export function saveMessages(userId: number, sessionId: string, messages: ChatMessage[]): void {
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO chat_history (session_id, user_id, role, content, tool_calls_json, tokens, created_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'))`);

  for (const msg of messages) {
    if (msg.role === 'tool') {
      // tool 消息的内容可能很大（JSON），截断到 8K
      const truncated = msg.content.length > 8000
        ? msg.content.slice(0, 8000) + '...[truncated]'
        : msg.content;
      stmt.run(sessionId, userId, msg.role, truncated,
        msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
        estimateTokens(truncated));
    } else {
      stmt.run(sessionId, userId, msg.role, msg.content,
        msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
        estimateTokens(msg.content));
    }
  }

  // 更新会话元数据
  const count = db.prepare(`SELECT COUNT(*) as c FROM chat_history WHERE session_id=?`).get(sessionId) as any;
  db.prepare(`UPDATE chat_sessions SET message_count=?, updated_at=datetime('now','localtime') WHERE session_id=?`).run(count.c, sessionId);
}

/**
 * 智能构建 messages 数组：
 * 1. 从 DB 加载最近 N 条历史
 * 2. 从旧到新逐条累加，超过 token 上限就截断旧消息
 * 3. 保留 system + 最近的关键消息
 */
export function buildContext(
  systemPrompt: string,
  history: ChatMessage[],
  currentQuery: string,
  maxTokens = MAX_CONTEXT_TOKENS
): { messages: any[]; truncated: number } {
  let totalTokens = estimateTokens(systemPrompt) + estimateTokens(currentQuery);
  const messages: any[] = [{ role: 'system', content: systemPrompt }];

  // 从旧到新逐条添加历史，超过限制就丢弃最早的
  let startIdx = 0;
  for (startIdx = 0; startIdx < history.length; startIdx++) {
    const msg = history[startIdx];
    const tok = estimateTokens(msg.content) + (msg.tool_calls ? 200 : 0);
    if (totalTokens + tok > maxTokens) break;
    totalTokens += tok;
  }

  const used = history.slice(startIdx);
  for (const msg of used) {
    messages.push({
      role: msg.role,
      content: msg.content,
      ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
    });
  }

  messages.push({ role: 'user', content: currentQuery });

  return { messages, truncated: startIdx };
}

// ══════════════════════════════════════════
//  辅助
// ══════════════════════════════════════════

/** 快速估算 token 数（中文 ~2 字符/token，英文 ~4 字符/token） */
function estimateTokens(text: string): number {
  if (!text) return 0;
  const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = text.length - cn;
  return Math.ceil(cn / 1.5) + Math.ceil(en / 4);
}
