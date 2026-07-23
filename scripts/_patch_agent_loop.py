"""Refactor agentLoop to accept history, simplify /chat handler"""
with open(r'f:\tiktok-crm-dev\server\src\routes\agent-chat.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Replace /chat handler's broken call
old_handler = """    // 生成日期 prompt（与 agentLoop 内 datePrompt 保持一致）
    const _now = new Date();
    const _today = _now.toISOString().slice(0, 10);
    const _yesterday = new Date(_now.getTime() - 86400000).toISOString().slice(0, 10);
    const _weekday = _now.toLocaleDateString('zh-CN', { weekday: 'long' });
    const datePrompt = `\\n\\n## 当前日期信息\\n今天是 ${_today}（${_weekday}）。昨日是 ${_yesterday}。所有"昨日数据"请以 ${_yesterday} 为准。`;
    const ctx = buildContext(SYSTEM_PROMPT + datePrompt, history, query.trim());
    const result = await agentLoopWithContext(channels, ctx.messages);"""

new_handler = """// 直接调用 agentLoop，传入历史
    const result = await agentLoop(channels, query.trim(), history);"""

c = c.replace(old_handler, new_handler)

# 2. Refactor agentLoop signature to accept history
old_sig = "async function agentLoop(channels: Channel[], userQuery: string): Promise<{ report: string; toolCalls: any[] }> {"
new_sig = "async function agentLoop(channels: Channel[], userQuery: string, history: ChatMessage[] = []): Promise<{ report: string; toolCalls: any[] }> {"
c = c.replace(old_sig, new_sig)

# 3. Refactor messages init to include history
old_msgs = """  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT + datePrompt },
    { role: 'user', content: userQuery }
  ];"""

new_msgs = """  // 构建 messages：system + 历史 + 当前用户问题
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT + datePrompt },
    ...history.map((h: any) => ({
      role: h.role,
      content: h.content || '',
      ...(h.tool_calls ? { tool_calls: h.tool_calls } : {}),
      ...(h.tool_call_id ? { tool_call_id: h.tool_call_id } : {}),
    })),
    { role: 'user', content: userQuery }
  ];"""

c = c.replace(old_msgs, new_msgs)

with open(r'f:\tiktok-crm-dev\server\src\routes\agent-chat.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched')