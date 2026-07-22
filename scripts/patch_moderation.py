"""Patch: add content moderation + model call logging to all AI endpoints"""
import re

# ===== 1. agent-chat.ts: add imports + moderation + model call log =====
with open(r'f:\tiktok-crm-dev\server\src\routes\agent-chat.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Add imports after existing imports
old_import = "import * as Ads from '../services/tiktok-ads';"
new_import = old_import + "\nimport { moderationMiddleware } from '../middleware/content-moderation';\nimport { logModelCall } from '../services/model-call-log';"
code = code.replace(old_import, new_import)

# Add moderation middleware to /chat route
old_route = "router.post('/chat', authMiddleware, async (req: Request, res: Response) => {"
new_route = "router.post('/chat', authMiddleware, moderationMiddleware('owen'), async (req: Request, res: Response) => {"
code = code.replace(old_route, new_route)

# Add model call logging after agentLoop returns
# Find: res.json({ success: true, query, report: result.report ...
# Add logModelCall before the res.json
old_res = "res.json({\n      success: true,\n      query,"
new_res = (
    "// 记录模型调用日志（备案合规）\n"
    "    logModelCall({\n"
    "      userId: (req as any).user?.userId || 0,\n"
    "      username: (req as any).user?.username || '',\n"
    "      module: 'owen',\n"
    "      modelName: channels[0]?.model || 'deepseek',\n"
    "      inputPrompt: query.trim(),\n"
    "      outputContent: result.report,\n"
    "      latencyMs: latency,\n"
    "      ip: req.ip || '',\n"
    "      userAgent: req.headers['user-agent'] || '',\n"
    "      status: 'success',\n"
    "    });\n"
    "    res.json({\n      success: true,\n      query,"
)
code = code.replace(old_res, new_res)

with open(r'f:\tiktok-crm-dev\server\src\routes\agent-chat.ts', 'w', encoding='utf-8') as f:
    f.write(code)
print('1. agent-chat.ts patched')

# ===== 2. ai-engine.ts: add moderation middleware =====
with open(r'f:\tiktok-crm-dev\server\src\routes\ai-engine.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Add import
old_imp2 = "import getDb from '../db';"
new_imp2 = old_imp2 + "\nimport { moderationMiddleware } from '../middleware/content-moderation';"
code = code.replace(old_imp2, new_imp2)

# Add moderation to generate route
old_route2 = "router.post('/generate', authMiddleware, async (req: Request, res: Response) => {"
new_route2 = "router.post('/generate', authMiddleware, moderationMiddleware('ai_engine'), async (req: Request, res: Response) => {"
code = code.replace(old_route2, new_route2)

with open(r'f:\tiktok-crm-dev\server\src\routes\ai-engine.ts', 'w', encoding='utf-8') as f:
    f.write(code)
print('2. ai-engine.ts patched')

# ===== 3. llm.ts: add model call logging =====
with open(r'f:\tiktok-crm-dev\server\src\services\ai-engine\llm.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Add import
old_imp3 = "import getDb from '../../db';"
new_imp3 = old_imp3 + "\nimport { logModelCall } from '../model-call-log';"
code = code.replace(old_imp3, new_imp3)

# Add logModelCall after successful LLM response
# Find the return line after successful call
# Pattern: return { content: ..., usage: ... }  -- this is the success path
# We wrap the return into a logModelCall + return
old_return = "if (r.data?.choices?.[0]) {\n    const msg = r.data.choices[0].message;\n    return {"
new_return = (
    "if (r.data?.choices?.[0]) {\n"
    "    const msg = r.data.choices[0].message;\n"
    "    const usage = r.data.usage || {};\n"
    "    // 记录模型调用日志\n"
    "    try {\n"
    "      logModelCall({\n"
    "        userId: 0,\n"
    "        username: 'ai-engine',\n"
    "        module: 'ai_engine',\n"
    "        modelName: model,\n"
    "        inputPrompt: opts.userPrompt.slice(0, 2000),\n"
    "        outputContent: msg.content?.slice(0, 5000) || '',\n"
    "        tokensIn: usage.prompt_tokens || 0,\n"
    "        tokensOut: usage.completion_tokens || 0,\n"
    "        latencyMs: 0,\n"
    "        status: 'success',\n"
    "      });\n"
    "    } catch (e) { /* ignore log failure */ }\n"
    "    return {"
)
code = code.replace(old_return, new_return)

with open(r'f:\tiktok-crm-dev\server\src\services\ai-engine\llm.ts', 'w', encoding='utf-8') as f:
    f.write(code)
print('3. llm.ts patched')

# ===== 4. video-models/generate.ts: add model call logging =====
with open(r'f:\tiktok-crm-dev\server\src\routes\video-models\generate.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Add import
if "logModelCall" not in code:
    old_imp4 = "import getDb from '../../db';"
    new_imp4 = old_imp4 + "\nimport { logModelCall } from '../../services/model-call-log';"
    code = code.replace(old_imp4, new_imp4)

# Add log after video generation success
# Find where video_id is assigned in the response
old_vid = "const videoId = result.data?.id || result.data?.task_id;"
if old_vid in code:
    new_vid = (
        old_vid + "\n"
        "    try { logModelCall({ userId, username: (req as any).user?.username || '', module: 'video', modelName: model, inputPrompt: prompt?.slice(0, 2000) || '', outputContent: JSON.stringify(result.data).slice(0, 3000), status: videoId ? 'success' : 'error', ip: req.ip || '' }); } catch {}"
    )
    code = code.replace(old_vid, new_vid)

with open(r'f:\tiktok-crm-dev\server\src\routes\video-models\generate.ts', 'w', encoding='utf-8') as f:
    f.write(code)
print('4. video-models/generate.ts patched')

print('\nAll patches applied!')
