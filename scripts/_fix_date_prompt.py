"""Fix datePrompt undefined in agent-chat.ts"""
with open(r'f:\tiktok-crm-dev\server\src\routes\agent-chat.ts', 'r', encoding='utf-8') as f:
    c = f.read()

old = """const ctx = buildContext(SYSTEM_PROMPT + '\\n' + datePrompt, history, query.trim());"""

new = """// 生成日期 prompt（与 agentLoop 内 datePrompt 保持一致）
    const _now = new Date();
    const _today = _now.toISOString().slice(0, 10);
    const _yesterday = new Date(_now.getTime() - 86400000).toISOString().slice(0, 10);
    const _weekday = _now.toLocaleDateString('zh-CN', { weekday: 'long' });
    const datePrompt = `\\n\\n## 当前日期信息\\n今天是 ${_today}（${_weekday}）。昨日是 ${_yesterday}。所有"昨日数据"请以 ${_yesterday} 为准。`;
    const ctx = buildContext(SYSTEM_PROMPT + datePrompt, history, query.trim());"""

if old not in c:
    # Try without the \\n
    old2 = "const ctx = buildContext(SYSTEM_PROMPT + '\\n' + datePrompt, history, query.trim());"
    if old2 in c:
        c = c.replace(old2, new)
else:
    c = c.replace(old, new)

with open(r'f:\tiktok-crm-dev\server\src\routes\agent-chat.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched')