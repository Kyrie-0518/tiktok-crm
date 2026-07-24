"""Fix Kyrie: restore chat history from backend on mount (after logout/login)"""
with open(r'f:\tiktok-crm-dev\client\src\pages\Kyrie.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Add loadHistory function + useEffect after fetchSessions useEffect
old = "  useEffect(() => { localStorage.setItem('erp_kyrie_sessions', JSON.stringify(sessions)); }, [sessions]);"

new = """  useEffect(() => { localStorage.setItem('erp_kyrie_sessions', JSON.stringify(sessions)); }, [sessions]);

  // 从服务端加载历史消息（退出登录再登回来后恢复对话）
  const loadHistoryFromServer = async () => {
    if (!currentSessionId) {
      // 尝试从 localStorage 恢复上次的会话 ID
      const saved = localStorage.getItem('kyrie_session');
      if (saved) { setCurrentSessionId(saved); loadSessionById(saved); }
      return;
    }
    try {
      const r = await api.get(`/agent/chat-history?sessionId=${currentSessionId}`);
      const history = r.data.data || [];
      if (history.length > 0 && messages.length === 0) {
        setMessages(history.map((h: any, i: number) => ({
          id: `srv_${i}`,
          role: h.role,
          content: h.content,
          timestamp: new Date(h.created_at).getTime(),
        })));
      }
    } catch {}
  };

  const loadSessionById = async (sid: string) => {
    try {
      const r = await api.get(`/agent/chat-history?sessionId=${sid}`);
      const history = r.data.data || [];
      setMessages(history.map((h: any, i: number) => ({
        id: `srv_${i}`,
        role: h.role,
        content: h.content,
        timestamp: new Date(h.created_at).getTime(),
      })));
    } catch {}
  };

  // 组件挂载时从服务端恢复
  useEffect(() => { loadHistoryFromServer(); }, [currentSessionId]);"""

c = c.replace(old, new)

with open(r'f:\tiktok-crm-dev\client\src\pages\Kyrie.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched Kyrie.tsx')
