"""Patch agent-chat.ts with memory system"""
with open(r'f:\tiktok-crm-dev\server\src\routes\agent-chat.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add import
old_import = "import { logModelCall } from '../services/model-call-log';"
new_import = old_import + "\nimport { createSession, getUserSessions, deleteSession, loadHistory, saveMessages, buildContext } from '../services/chat-memory';"
c = c.replace(old_import, new_import)

# 2. Add session API endpoints before /chat route
session_api = """
// GET /api/agent/sessions — 获取会话列表
router.get('/sessions', authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    res.json({ data: getUserSessions(userId) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/agent/sessions/:id — 删除会话
router.delete('/sessions/:id', authMiddleware, (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    deleteSession(userId, req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

"""
c = c.replace("router.post('/chat'", session_api + "router.post('/chat'")

# 3. Modify /chat handler
old_handler = "const { query } = req.body;"
new_handler = """const { query, sessionId: reqSessionId } = req.body;
  const userId = (req as any).user?.userId;
  const sessionId = reqSessionId || createSession(userId, query.trim());"""
c = c.replace(old_handler, new_handler)

# 4. Replace agentLoop call with context-aware version
old_agent = "const result = await agentLoop(channels, query.trim());"
new_agent = """// --- 智能对话记忆：加载历史 + 构建上下文 ---
    const history = loadHistory(userId, sessionId);
    const ctx = buildContext(SYSTEM_PROMPT + '\\n' + datePrompt, history, query.trim());
    const result = await agentLoopWithContext(channels, ctx.messages);
    // 保存本轮对话
    try {
      saveMessages(userId, sessionId, [
        { role: 'user', content: query.trim() },
        ...(result.toolCallsResult || []).map((tc: any) => ({ role: 'tool' as const, content: tc.content || '', tool_call_id: tc.id })),
        { role: 'assistant', content: result.report },
      ]);
    } catch (e) { console.warn('[memory] save failed', e); }"""
c = c.replace(old_agent, new_agent)

# 5. Add sessionId to response
old_res = "res.json({\n      success: true,\n      query,"
new_res = """res.json({
      success: true,
      sessionId,
      query,"""
c = c.replace(old_res, new_res)

with open(r'f:\tiktok-crm-dev\server\src\routes\agent-chat.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched agent-chat.ts')
