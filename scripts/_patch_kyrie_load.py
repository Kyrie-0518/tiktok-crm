"""Make Kyrie restore chat history on mount"""
with open(r'f:\tiktok-crm-dev\client\src\pages\Kyrie.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

old = """  const fetchSessions = async () => {
    try { const r = await api.get("/agent/sessions"); setSessions(r.data.data || []); } catch {}
  };
  useEffect(() => { fetchSessions(); }, []);"""

new = """  const fetchSessions = async () => {
    try { const r = await api.get("/agent/sessions"); setSessions(r.data.data || []); } catch {}
  };

  // 加载历史消息（切换 tab 再回来时恢复对话）
  const loadHistory = async () => {
    if (!currentSessionId) { setMessages([]); return; }
    try {
      const r = await api.get(`/agent/chat-history?sessionId=${currentSessionId}`);
      const history = r.data.data || [];
      setMessages(history.map((h: any, i: number) => ({
        id: `hist_${i}`,
        role: h.role,
        content: h.content,
        timestamp: new Date(h.created_at).getTime(),
      })));
    } catch { setMessages([]); }
  };

  useEffect(() => { fetchSessions(); }, []);
  useEffect(() => { loadHistory(); }, [currentSessionId]);"""

c = c.replace(old, new)

with open(r'f:\tiktok-crm-dev\client\src\pages\Kyrie.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched Kyrie.tsx - auto restore on mount')