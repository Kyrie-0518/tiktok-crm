# AI Video Engine V2.0 — 实现文档

> 版本：V2.0  
> 日期：2026-07-19  
> 作者：虾掌柜ERP 开发团队

---

## 一、项目背景

当前 AI 视频生成（Seedance / Kling / MiniMax）存在以下业务痛点：

- Prompt 编写门槛高，运营不会写高质量 Prompt
- 生成质量随机（"抽卡"），首次生成成功率低
- 商品卖点表达不完整，缺少对商品的理解
- 不同模型 Prompt 偏好不同，切换模型需要重写 Prompt
- 没有质量反馈闭环，用户只能反复修改 Prompt 重新生成

**核心目标**：构建一套 **AI Video Engine（AI 视频生成引擎）**，在视频模型之前自动完成商品理解 → 创意策略 → 分镜 → Prompt 生成 → 模型适配 → 质量评估的完整 Pipeline，降低随机性，提高首次生成成功率。

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    视频生成页面（前端）                    │
│               POST /api/ai-engine/generate              │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Pipeline Orchestrator（调度器）               │
│                                                         │
│  ① Vision Agent      → 商品理解                          │
│  ② Strategy Agent    → 创意策略                          │
│  ③ Director Agent    → 分镜导演                          │
│  ④ Prompt Engine     → Prompt 生成                       │
│  ⑤ Optimizer         → 模型适配优化                       │
│  ⑥ Adapter           → 统一生成参数                       │
│  ⑦ Quality Agent     → AI 质量评估                       │
│                                                         │
│  每步写入 video_task_steps 表                             │
│  质量 < 85 分 → 自动触发一次优化重试                       │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              视频模型 API（Seedance / Kling / ...）        │
│              POST /api/seedance/generate                 │
└─────────────────────────────────────────────────────────┘
```

### 设计原则

| 原则 | 说明 |
|------|------|
| Pipeline 与 UI 解耦 | 前端只调 `/ai-engine/generate`，不直接接触 Agent |
| Agent 单一职责 | 每个 Agent 只做一件事（理解/策略/导演/Prompt/优化/适配/质量） |
| 配置优于代码 | Agent Prompt、模型参数都通过配置管理，不写死 |
| 全链路可观测 | 每次生成记录所有 Agent 的输入输出、Token、耗时、评分 |

---

## 三、新增文件清单

### 3.1 AI Engine 核心模块

```
server/src/services/ai-engine/
├── types.ts                 # 全链路类型定义（15 个 interface）
├── llm.ts                   # LLM 调用层（复用 ai_channels 表 + mock 回退）
├── orchestrator.ts          # Pipeline Orchestrator 调度中心
└── agents/
    ├── vision.ts            # Agent ① — 商品理解
    ├── strategy.ts          # Agent ② — 创意策略
    ├── director.ts          # Agent ③ — AI 导演（分镜脚本）
    ├── prompt-engine.ts     # Agent ④ — Prompt 生成引擎
    ├── optimizer.ts         # Agent ⑤ — Prompt 优化器（多模型适配）
    ├── adapter.ts           # Agent ⑥ — 视频模型适配器
    └── quality.ts           # Agent ⑦ — AI 质量评估
```

### 3.2 API 路由

```
server/src/routes/ai-engine.ts   # AI Engine API 端点
```

---

## 四、修改文件清单

| 文件 | 改动内容 |
|------|----------|
| `server/src/db.ts` | 新增 5 张数据表（`video_tasks` / `video_task_steps` / `video_templates` / `video_prompt_versions` / `video_quality_scores`） |
| `server/src/index.ts` | 注册路由：`import aiEngineRoutes` + `app.use('/api/ai-engine', aiEngineRoutes)` |
| `client/src/pages/AIVideoGenerator.tsx` | `handleGenerate` 改为先调 AI Engine Pipeline，再调视频生成；新增 Pipeline Steps 实时展示 |

---

## 五、API 路由详解

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| `POST` | `/api/ai-engine/generate` | 执行全链路 7 Agent Pipeline | ✅ authMiddleware |
| `GET` | `/api/ai-engine/tasks/:taskId` | 查询单个任务详情（含所有 step） | ✅ |
| `GET` | `/api/ai-engine/tasks` | 任务列表（分页） | ✅ |
| `GET` | `/api/ai-engine/templates` | 模板列表 | ✅ |
| `POST` | `/api/ai-engine/templates` | 创建模板 | ✅ |

### POST /api/ai-engine/generate 参数

```json
{
  "productId": 1,
  "productImage": "https://...",
  "productName": "AirPods Pro",
  "productDescription": "蓝牙降噪耳机",
  "userPrompt": "马来西亚TikTok商品带货视频",
  "model": "doubao-seedance-2-0-260128",
  "resolution": "720p",
  "aspectRatio": "9:16",
  "duration": 5,
  "count": 1
}
```

### 返回

```json
{
  "taskId": "uuid",
  "status": "completed",
  "qualityScore": 92,
  "totalTokens": 1450,
  "totalTime": 3200,
  "steps": [
    { "agent": "vision", "status": "completed", "output": {...}, "tokens": 300, "durationMs": 800 },
    { "agent": "strategy", "status": "completed", "output": {...}, "tokens": 200, "durationMs": 600 },
    ...
  ]
}
```

---

## 六、Agent 详细设计

### ① Vision Agent（商品理解）

**职责**：理解商品属性，不生成为 Prompt。

**输入**：
```
商品名称 + 商品描述 + 商品图片
```

**输出（JSON）**：
```json
{
  "category": "3C数码",
  "productType": "蓝牙耳机",
  "brand": "AirPods",
  "material": ["塑料", "硅胶"],
  "color": ["白色"],
  "style": "极简科技风",
  "targetAudience": "18-35岁年轻用户",
  "sellingPoints": ["主动降噪", "30小时续航", "舒适佩戴"],
  "scene": ["办公室", "通勤", "健身房"],
  "visualTags": ["产品特写", "自然光", "科技感"]
}
```

### ② Creative Strategy Agent（创意策略）

**职责**：决定视频的拍法、节奏、风格。

**输入**：Vision JSON + 用户 Prompt + 平台信息

**输出（JSON）**：
```json
{
  "videoGoal": "产品展示转化",
  "platform": "TikTok",
  "pacing": "快节奏",
  "style": "现代商业",
  "duration": 15,
  "cta": "立即购买",
  "shootingStyle": "真人+产品",
  "shotRhythm": "前3秒抓眼球→中段展示→结尾CTA"
}
```

### ③ Director Agent（AI 导演 / 分镜）

**职责**：生成视频分镜脚本（Storyboard）。

**输入**：Vision JSON + Strategy JSON

**输出（JSON）**：
```json
{
  "shots": [
    {
      "index": 1,
      "scene": "产品展示",
      "subject": "AirPods Pro",
      "action": "360° 旋转展示",
      "composition": "中景",
      "lighting": "柔光",
      "camera": "固定",
      "duration": 3,
      "transition": "cut"
    },
    ...
  ],
  "timeline": "4镜头·15秒"
}
```

### ④ Prompt Engine（Prompt 生成引擎）

**职责**：将分镜脚本转换为模型可用的 Prompt。

**输入**：Director JSON + Vision JSON

**输出（JSON）**：
```json
{
  "shotPrompts": [
    {
      "index": 1,
      "prompt": "AirPods Pro centered, soft studio lighting, clean white background, slow 360° rotation, product detail close-up, commercial quality, 8K",
      "negativePrompt": "blurry, low quality, distorted, watermark",
      "parameters": { "motion_scale": 0.8 }
    }
  ],
  "finalPrompt": "..."
}
```

### ⑤ Prompt Optimizer（Prompt 优化器）

**职责**：根据不同模型（Seedance / Kling / MiniMax）的偏好对 Prompt 进行适配优化。

**适配规则（Seedance）**：
- 自动追加 `Natural Motion, Stable Camera, Commercial Quality`
- 自动优化光影描述 `Realistic Lighting, Soft Shadows`
- 自动加强负 Prompt

**适配规则（Kling）**：
- 更强调 `cinematic, film grain, 24fps`
- 镜头语言更丰富

**适配规则（MiniMax）**：
- 更强调 `smooth camera movement, dynamic composition`
- 负面提示词格式不同

### ⑥ Video Adapter（模型适配器）

**职责**：统一所有模型的调用参数格式。

```ts
interface AdapterOutput {
  prompt: string;
  negativePrompt: string;
  model: string;
  resolution: string;
  aspectRatio: string;
  duration: number;
  count: number;
  voiceEnabled: boolean;
  // 模型特有参数
  extraParams: Record<string, any>;
}
```

### ⑦ AI Quality Agent（质量评估）

**职责**：评估生成视频的质量，决定是否触发自动重试。

**评分维度**：

| 维度 | 权重 | 说明 |
|------|------|------|
| 商品完整度 | 25% | 商品是否完整展示 |
| 人物一致性 | 15% | 人物形象是否一致 |
| 镜头流畅度 | 20% | 镜头过渡是否自然 |
| 品牌露出 | 15% | Logo/品牌是否清晰 |
| 卖点覆盖 | 15% | 是否覆盖所有卖点 |
| 整体观感 | 10% | 画面质量、光线、构图 |

**自动重试策略**：
- 质量分 ≥ 85 → 直接使用
- 质量分 < 85 → 自动调用 Optimizer 重新优化 Prompt → 重新生成一次（最多 1 次）

---

## 七、数据库表结构

### video_tasks（视频任务）

```sql
CREATE TABLE video_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT UNIQUE NOT NULL,
  product_id INTEGER,
  product_name TEXT DEFAULT '',
  user_prompt TEXT DEFAULT '',
  template TEXT DEFAULT '',
  model TEXT DEFAULT '',
  resolution TEXT DEFAULT '720p',
  aspect_ratio TEXT DEFAULT '9:16',
  duration INTEGER DEFAULT 5,
  count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',      -- pending|running|completed|failed|retrying
  final_prompt TEXT DEFAULT '',
  quality_score INTEGER DEFAULT 0,
  video_id INTEGER,
  video_url TEXT DEFAULT '',
  error TEXT DEFAULT '',
  total_time_ms INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  steps_json TEXT DEFAULT '[]',
  created_at DATETIME,
  updated_at DATETIME
);
```

### video_task_steps（每步执行记录）

```sql
CREATE TABLE video_task_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  agent TEXT NOT NULL,              -- vision|strategy|director|prompt_engine|optimizer|adapter|quality
  status TEXT DEFAULT 'pending',    -- pending|running|completed|failed
  input_json TEXT DEFAULT '',
  output_json TEXT DEFAULT '',
  tokens INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  error TEXT DEFAULT '',
  created_at DATETIME
);
```

### video_templates（模板）

```sql
CREATE TABLE video_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  prompt TEXT DEFAULT '',
  strategy TEXT DEFAULT '',
  params TEXT DEFAULT '{}',
  tags TEXT DEFAULT '',
  is_system INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at DATETIME,
  updated_at DATETIME
);
```

### video_prompt_versions（Prompt 版本管理）

```sql
CREATE TABLE video_prompt_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  version INTEGER DEFAULT 1,
  prompt TEXT DEFAULT '',
  strategy_json TEXT DEFAULT '{}',
  director_json TEXT DEFAULT '{}',
  optimizer_params TEXT DEFAULT '{}',
  model TEXT DEFAULT '',
  created_at DATETIME
);
```

### video_quality_scores（AI 评分记录）

```sql
CREATE TABLE video_quality_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  video_id INTEGER,
  score INTEGER DEFAULT 0,
  product_completeness INTEGER DEFAULT 0,
  person_consistency INTEGER DEFAULT 0,
  shot_fluency INTEGER DEFAULT 0,
  brand_visibility INTEGER DEFAULT 0,
  selling_point_coverage INTEGER DEFAULT 0,
  overall_impression INTEGER DEFAULT 0,
  needs_retry INTEGER DEFAULT 0,
  suggestions TEXT DEFAULT '',
  raw_json TEXT DEFAULT '',
  created_at DATETIME
);
```

---

## 八、前端改动 — AIVideoGenerator.tsx

### 8.1 handleGenerate 流程变更

**旧流程**（直接调视频生成）：
```ts
api.post('/seedance/generate', { prompt, product_id, ... })
```

**新流程**（先 Pipeline 再生成）：
```ts
// Step 1: AI Engine Pipeline
const engRes = await api.post('/ai-engine/generate', {
  productId, productImage, productName,
  userPrompt, model, resolution, aspectRatio, duration, count
});
const result = engRes.data;
setPipelineSteps(result.steps);
setPipelineResult({ qualityScore, totalTokens, totalTime });

// Step 2: 用优化后的 Prompt 生成视频
const finalPrompt = result.steps
  .find(s => s.agent === 'optimizer')
  ?.output?.optimizedPrompts?.[0]?.prompt || prompt;
api.post('/seedance/generate', { prompt: finalPrompt, ... })
```

### 8.2 Pipeline Steps 实时展示

新增状态：
```ts
const [pipelineSteps, setPipelineSteps] = useState([]);
const [pipelineResult, setPipelineResult] = useState(null);
```

生成中展示：
```
🔄 正在生成…
██████████████ 67%

🔍 商品理解       ✓
💡 创意策略       ✓
🎬 AI导演         ✓
✍️ Prompt生成     ◎（进行中）
⚙️ Prompt优化     ○
🔌 模型适配       ○
✅ 质量评估       ○

⚡ 120 Token · 2.3s · 质量 85 分
```

---

## 九、LLM 调用层设计

### 9.1 复用已有 AI 渠道

```ts
// 自动从 ai_channels 表读取已启用的默认渠道
const channel = db.prepare(`
  SELECT * FROM ai_channels 
  WHERE is_default = 1 AND status = 'enabled' AND api_key != '' 
  ORDER BY priority ASC LIMIT 1
`).get();
```

### 9.2 Mock 回退机制

当 `ai_channels` 表中没有配置时，每个 Agent 有内置的 mock 响应数据，Pipeline 仍然可以跑通（用于开发测试）：

```ts
if (!apiKey) {
  console.warn('[AI Engine] No AI channel configured — using mock response');
  return generateMockResponse(opts);
}
```

---

## 十、部署说明

### 10.1 部署命令

```bash
cd /opt/tiktok-crm && git pull && bash deploy/deploy.sh
```

### 10.2 验证

```bash
# 检查表是否创建
docker exec bozone-server node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/data/erp.db');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'video_%'\").all();
console.log(JSON.stringify(tables));
"

# 检查 AI Engine API
curl https://bvefdvp.cn/api/ai-engine/tasks
```

### 10.3 配置 AI 渠道

Pipeline 需要 AI 模型才能发挥真实能力。在系统管理后台 `/admin/api-config` 中配置 AI 渠道，确保 `is_default = 1` 且 `status = 'enabled'`。

---

## 十一、后续迭代（Roadmap）

| Sprint | 内容 | 预估 |
|--------|------|------|
| Sprint 2 | Prompt Optimizer 完整实现 + 模板中心 + Adapter 管理 | 2 周 |
| Sprint 3 | AI Quality Agent 完整实现 + 自动重试 + Agent 日志 + Debug Drawer | 2 周 |
| Sprint 4 | AI Engine 管理后台 + Agent 配置/Prompt 编辑/发布/版本/灰度 + 企业模板 | 后续 |

---

## 十二、关键注意事项

1. **Pipeline 与 UI 解耦**：视频生成页面只是业务入口，所有 AI 能力运行在 AI Engine 中
2. **Agent 单一职责**：禁止一个 Agent 同时承担多个职责
3. **全链路可观测**：每次生成记录所有 Agent 的输入/输出/Prompt变化/Token/耗时/评分
4. **配置优于代码**：Agent Prompt、模板、参数通过配置管理，不写死
5. **Agent 不互相调用**：所有 Agent 只与 Orchestrator 通信
6. **Mock 回退**：无 AI 渠道时 Pipeline 仍可跑通，不影响页面功能
