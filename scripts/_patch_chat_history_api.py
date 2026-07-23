"""Add chat-history endpoint for Kyrie restore on mount"""
with open(r'f:\tiktok-crm-dev\server\src\routes\agent-chat.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Add new endpoint after sessions/:id
old = """  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/chat', authMiddleware, moderationMiddleware('owen'), async (req: Request, res: Response) => {"""

new = """  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/agent/chat-history?sessionId=xxx — 加载会话历史消息
router.get('/chat-history', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const sessionId = req.query.sessionId as string;
    if (!sessionId) { res.json({ data: [] }); return; }
    const rows = getDb().prepare(
      `SELECT role, content, created_at FROM chat_history WHERE session_id = ? AND user_id = ? ORDER BY id ASC LIMIT 200`
    ).all(sessionId, userId);
    res.json({ data: rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/chat', authMiddleware, moderationMiddleware('owen'), async (req: Request, res: Response) => {"""

c = c.replace(old, new)

with open(r'f:\tiktok-crm-dev\server\src\routes\agent-chat.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Added chat-history endpoint')