"""Fix setSessionId → setCurrentSessionId in Kyrie.tsx"""
with open(r'f:\tiktok-crm-dev\client\src\pages\Kyrie.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace setter calls
c = c.replace('setSessionId(', 'setCurrentSessionId(')

# Replace new conversation button: clear sessionId
c = c.replace(
    "setSessionId('');\n                localStorage.removeItem('kyrie_session');",
    "setCurrentSessionId(null);\n                localStorage.removeItem('kyrie_session');"
)

# Replace the line that sets sessionId from API response
c = c.replace(
    "if (data.sessionId) { setCurrentSessionId(data.sessionId); localStorage.setItem('kyrie_session', data.sessionId); }",
    "if (data.sessionId && data.sessionId !== currentSessionId) { setCurrentSessionId(data.sessionId); localStorage.setItem('kyrie_session', data.sessionId); }"
)

# Replace sessionId state declaration - we keep it (it was already there)
# But make sure we don't have leftover setSessionId (the patched new conversation button)
# Check final state
remaining = c.count('setSessionId(')
print(f'Remaining setSessionId occurrences: {remaining}')

with open(r'f:\tiktok-crm-dev\client\src\pages\Kyrie.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Fixed')
