"""Patch Kyrie.tsx with sessionId support"""
with open(r'f:\tiktok-crm-dev\client\src\pages\Kyrie.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. session state
old_s = "const [generating, setGenerating] = useState(false);"
new_s = old_s + '\n  const [sessionId, setSessionId] = useState<string>(localStorage.getItem("kyrie_session") || "");\n  const [sessions, setSessions] = useState<any[]>([]);'
c = c.replace(old_s, new_s)

# 2. fetchSessions  
old_f = "const fetchSuggestions"
new_f = '''  const fetchSessions = async () => {
    try { const r = await api.get("/agent/sessions"); setSessions(r.data.data || []); } catch {}
  };
  useEffect(() => { fetchSessions(); }, []);

  const fetchSuggestions'''
c = c.replace(old_f, new_f)

# 3. send sessionId
old_send = "api.post('/agent/chat', {\n      query: inputValue.trim()"
new_send = "api.post('/agent/chat', {\n      query: inputValue.trim(),\n      sessionId"
c = c.replace(old_send, new_send)

# 4. save sessionId from response
old_data = "const data = res.data;"
new_data = 'const data = res.data;\n      if (data.sessionId) { setSessionId(data.sessionId); localStorage.setItem("kyrie_session", data.sessionId); }'
c = c.replace(old_data, new_data)

# 5. New conversation button (add after the header area — look for "欧文 Uncle Drew")
old_title = "Uncle Drew"
new_title = 'Uncle Drew'
# Just add the button somewhere near the input area

with open(r'f:\tiktok-crm-dev\client\src\pages\Kyrie.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched Kyrie.tsx')
