# 虾掌柜 ERP（Bozone）— 系统技术文档 v3.0

> **撰写日期**：2026-07-23  
> **版本**：v3.0  
> **面向读者**：产品负责人 / 技术团队 / 备案审核 / 投资人

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [TikTok Shop API 授权体系](#3-tiktok-shop-api-授权体系)
4. [TikTok Ads API 授权体系](#4-tiktok-ads-api-授权体系)
5. [模块功能实现](#5-模块功能实现)
6. [前端设计体系](#6-前端设计体系)
7. [后端构建规范](#7-后端构建规范)
8. [AI 能力矩阵](#8-ai-能力矩阵)
9. [备案合规架构](#9-备案合规架构)
10. [功能优势与效率体现](#10-功能优势与效率体现)

---

## 1. 项目概述

### 1.1 产品定位

虾掌柜 ERP（Bozone）是一个**TikTok Shop 专精的全域跨境运营 SaaS 平台**，定位为东南亚跨境卖家的"第二核心系统"（第一为 TikTok Shop 后台）。系统以 AI 为驱动引擎，覆盖店铺管理、订单同步、产品管理、财务核算、达人 BD、AI 视频生成、广告投放及智能诊断等全链路业务场景。

### 1.2 面向用户

| 用户角色 | 核心使用场景 |
|---------|-------------|
| **跨境电商运营人员** | 日常订单管理、产品上下架、达人合作、利润核算 |
| **运营管理者** | 数据看板、多店铺横向对比、团队绩效评估 |
| **市场/广告投放人员** | TikTok Ads 全链路管理、ROI 分析、素材测试 |
| **财务人员** | 多币种利润核算、费用归集、税务辅助 |
| **产品/技术决策者** | AI 能力评估、系统架构审查、合规审核 |

### 1.3 技术栈一览

| 层级 | 技术选型 | 选型理由 |
|------|---------|---------|
| **前端** | React 19 + Vite + Ant Design 5 + TanStack Router/Query/Table + Recharts + Zustand | 高性能 SPA，TypeScript 全链路 |
| **后端** | Express 4 + TypeScript (tsx 运行时) + better-sqlite3 | 零配置 TypeScript 运行，单文件数据库，部署极简 |
| **容器** | Docker Compose，2 容器（bozone-server :3000，bozone-client :8080） | 一键部署，隔离明确 |
| **代理** | 宿主机 Nginx + Let's Encrypt SSL | 零停机证书续期，反代高效 |
| **AI 模型** | DeepSeek-V4-Pro（通用） + 火山引擎 Seedance 1.0 Pro（视频生成） | 已备案国产大模型，API 调用 |
| **数据库** | SQLite (WAL 模式) | 零运维，单文件方便备份恢复 |

### 1.4 部署架构

```
互联网 (HTTPS 443)
  ↓
宿主机 Nginx (/etc/nginx/conf.d/bozone.conf)
  ├── /api/*  → 127.0.0.1:3000  (bozone-server，network_mode: host)
  ├── /uploads/* → 127.0.0.1:3000
  └── /*  → 127.0.0.1:8080  (bozone-client 容器)
       ↓
bozone-server (Node.js 20 + tsx)
  ├── Express 4 路由层（30+ 路由文件）
  ├── better-sqlite3 数据库
  └── 外部 API 调用（TikTok / DeepSeek / 火山引擎）
```

**国内网络特殊方案**：阿里云 ECS 无法直连 `business-api.tiktok.com`，采用 Cloudflare Worker 中继，部署地址 `https://kyrie.yangyue0505.workers.dev`，Token 鉴权。

---

## 2. 系统架构

### 2.1 后端路由全景

```
server/src/routes/
├── auth.ts                  # JWT 登录/注册/权限
├── mobile-auth.ts           # 移动端扫码 Token
├── agent-chat.ts            # ★ 欧文 Agent（对话 + 9 Tool Calling + 记忆系统）
├── ai.ts                    # AI 通道管理 + 知识库加载
├── ai-channels.ts           # AI 通道 CRUD + 测试
├── ai-engine.ts             # ★ AI Engine Pipeline（7 Agent）
├── dashboard.ts             # 仪表盘数据聚合
├── shops.ts                 # 店铺管理
├── tiktok-auth.ts           # ★ TikTok Shop OAuth 授权
├── orders.ts                # 订单管理
├── orders-import.ts         # 订单导入
├── products.ts              # 产品管理
├── products-tiktok.ts       # TikTok 产品同步
├── finance/                 # 财务核算（9 子文件）
├── influencers.ts           # 达人 BD
├── influencer-reports.ts    # 达人汇报
├── tiktok-ads.ts            # ★ TikTok Ads OAuth + API
├── ad-center.ts             # ★ 广告管理中心
├── ai-studio.ts             # AI 工作室（素材库）
├── seedance.ts              # AI 视频生成（Seedance）
├── video-models/            # 视频模型管理（generate/poll/configs/stats/db-helpers）
├── growth-center.ts         # ★ AI 增长中心
├── admin-moderation.ts      # 违禁词管理 API
├── admin-api-configs.ts     # 管理后台 API 配置
├── audit-logs.ts            # 审计日志 + 模型调用日志
├── settings.ts              # 系统设置
├── admin.ts                 # 管理后台
├── bot-feishu-ws.ts         # 飞书 Bot 长连接
├── bot-wecom.ts             # 企业微信 Bot
├── skiis-analysis.ts        # 运营分析
├── skiis-chat.ts            # 运营对话
├── upload.ts                # 文件上传
└── health.ts                # 健康检查
```

### 2.2 前端路由全景

```
client/src/pages/
├── Dashboard.tsx            # 仪表盘
├── ShopManagement.tsx       # 店铺管理
├── OrderManagement.tsx      # 订单管理
├── Products.tsx             # 产品管理
├── Finance.tsx              # 利润核算
├── DataReports.tsx          # 财务统计表
├── InfluencerLayout.tsx     # 达人 BD
├── Kyrie.tsx                # ★ 欧文 Agent（PC）
├── MobileKyrie.tsx          # ★ 欧文 Agent（移动）
├── AIStudioLayout.tsx       # AI 工作室
├── MaterialLibrary.tsx      # 素材库
├── AIVideoGenerator.tsx     # ★ 视频生成
├── AdDashboard.tsx          # 广告概览
├── AdAccounts.tsx           # 广告账户
├── AdCampaigns.tsx          # 广告系列
├── AdRules.tsx              # 广告规则
├── AdCreatives.tsx          # 广告素材
├── AdBills.tsx              # 广告对账
├── AdLogs.tsx               # 广告日志
├── SystemSettings.tsx       # 系统设置
├── AuditLogs.tsx            # 操作日志 + 模型调用
├── ApiConfig.tsx            # ★ AI 能力配置
├── VideoModelConfig.tsx     # 视频模型配置
├── admin/                   # 管理后台
│   ├── AccountCenter.tsx
│   ├── AdminLayout.tsx
│   ├── AuditLogs.tsx
│   ├── BotManagement.tsx
│   └── ...
├── AdminModeration.tsx      # ★ 违禁词管理
└── growth-center/           # ★ AI 增长中心
    ├── ShopDiagnosis.tsx
    ├── DiagnosisHistory.tsx
    ├── AIReview.tsx
    └── DataDebug.tsx
```

### 2.3 导航菜单结构

```
运营中心：仪表盘 → 店铺管理 → 产品管理 → 订单管理 → 达人BD
智汇中台：欧文Agent → AI工作室
流量引擎：广告概览 → 广告账户 → 广告系列 → 广告规则 → 广告素材 → 广告日志 → 广告对账
财务中心：利润核算 → 广告对账 → 财务统计表
AI增长中心：[META] 店铺诊断 → 诊断记录 → AI复盘 → 数据调试
移动端：  /m/kyrie（独立入口，扫码登录）
管理后台：系统设置 → 操作日志 → 违禁词管理 → API管理 → Bot管理 → ...
```

---

## 3. TikTok Shop API 授权体系

### 3.1 OAuth 完整流程

```
店铺管理页 → 点击"授权 TikTok"
  ↓
POST /api/shops/tiktok/auth-url
  → server/src/services/tiktok-oauth.ts:buildAuthUrl()
  → 生成 state=随机32位hex（防 CSRF）
  → 返回: https://services.tiktokshop.com/open/authorize?
      app_key=xxx&state=xxx&scopes=seller.order,seller.product,seller.shop,seller.finance
  → 前端 window.open 跳转到 TikTok 授权页
  ↓
用户授权完成 → TikTok 重定向到 redirect_uri
  ↓
GET /api/shops/tiktok/callback?code=xxx&state=xxx（公开接口）
  → 验证 state 有效性
  → 调用 https://auth.tiktok-shops.com/api/v2/token/get
  → 请求体: { app_key, app_secret, auth_code, grant_type: 'authorized_code' }
  → 返回: { access_token, refresh_token, expires_in, shop_cipher }
  → 写入 tiktok_shops 表
  → 并调用 GET /api/shops/tiktok/test 补全店铺名称/地区信息
```

### 3.2 企业级 Token 自动刷新

```
每次 API 调用前 → getValidToken(shopId) 检查：
  ├─ token 有效且剩余 > 10min → 直接返回（零开销）
  ├─ token 剩余 < 10min → 进入刷新流程
  │    ├─ 同 shopId 并发请求共享同一个 Promise
  │    ├─ 重试 3 次（指数退避 1s/2s/4s）
  │    ├─ 成功：更新 tiktok_shops 表，计数器清零
  │    └─ 失败：grace 期 30min 内旧 token 仍可用
  └─ 连续失败 3 次 → 标记需重新授权

后台调度器 startTokenScheduler()
  → 每 5 分钟扫描即将过期（< 30min）的 token
  → 预刷，无需等待用户访问
```

### 3.3 API 签名机制

```typescript
// HMAC-SHA256 签名
sign(path, params, body, appSecret):
  raw = appSecret + path + sortedParams + bodyJson + appSecret
  return SHA256(raw)
```

### 3.4 数据存储

**表：tiktok_shops**

| 列名 | 说明 |
|------|------|
| `shop_cipher` | API 调用的店铺标识（唯一） |
| `access_token` | OAuth access_token |
| `refresh_token` | OAuth refresh_token |
| `token_expires_at` | token 过期时间戳 |
| `app_key` / `app_secret` | 应用密钥 |
| `shop_name` / `region` | 店铺基本信息 |

---

## 4. TikTok Ads API 授权体系

### 4.1 网络拓扑（关键）

```
国内 ECS（8.163.24.221）
  ↓ 直连失败（ETIMEDOUT）
business-api.tiktok.com
  ↓ Cloudflare 兜底
Cloudflare Worker（kyrie.yangyue0505.workers.dev）
  → 中继转发 TikTok Ads API
  → Token 鉴权: kyrie-tiktok-relay-2026-a8f3d9c7
```

### 4.2 OAuth 流程

```
1. GET /api/tiktok-ads/auth-url → 生成 TikTok Ads 授权 URL
2. 用户在 TikTok 侧授权 → 回调到前端
3. POST /api/tiktok-ads/exchange-code（auth_code → token）
   ├─ 先直连 business-api.tiktok.com
   └─ 失败 → 自动回退 Cloudflare Worker 中继
4. 保存到 ad_accounts 表（access_token + refresh_token）
```

### 4.3 双通道自动回退

```
fetchWithProxy(url, options):
  ├─ 直连（3 次重试，指数退避 1s/2s/4s）
  ├─ 直连失败 → Cloudflare Worker 中继（2 次重试）
  └─ 可通过环境变量控制:
      TT_ADS_SKIP_PROXY=1  → 跳过代理
      TT_ADS_DIRECT_TIMEOUT_MS=30000
      TT_ADS_PROXY_TIMEOUT_MS=15000
```

---

## 5. 模块功能实现

### 5.1 仪表盘（Dashboard）
- **入口**：`/dashboard` → `Dashboard.tsx`
- **API**：`GET /api/dashboard/stats`
- **功能**：4 统计卡片（GMV/订单/产品/店铺）+ ECharts 趋势图 + 利润概览 + Top10 热销产品
- **数据来源**：聚合查询 orders 表 + 实时计算

### 5.2 店铺管理（Shop）
- **入口**：`/shops` → `ShopManagement.tsx`
- **核心 API**：`POST /api/shops/tiktok/auth-url` → `GET /callback` → `POST /refresh`
- **功能**：多店铺管理、TikTok OAuth 授权、Token 状态监控、手动刷新、同步开关
- **数据库**：`tiktok_shops` 表

### 5.3 订单管理（Order）
- **入口**：`/orders` → `OrderManagement.tsx`
- **核心 API**：`GET /api/orders/list` + `POST /api/orders/import`
- **自动同步**：`server/src/services/auto-sync.ts` — 每 10 分钟调用 TikTok `GET /order/202309/orders/search`
- **同步策略**：
  - 全量同步：首次授权拉取近 30 天订单
  - 增量同步：按 `update_time` 拉取最近变更
  - 订单商品明细：逐单品提取 `line_items[]`
- **数据库**：`orders` 表 + `order_items` 表

### 5.4 产品管理（Product）
- **入口**：`/products` → `Products.tsx`
- **核心 API**：`GET /api/products/tiktok/sync`
- **同步流程**：调用 TikTok `GET /product/202309/products/search`，分页拉取全量
- **数据库**：`products` 表 + `product_images` 表

### 5.5 财务核算（Finance）★ 核心模块
- **入口**：`/finance` → `Finance.tsx`
- **API**：`server/src/routes/finance/`（已拆分为 9 个子文件）
- **功能**：
  - 8 种费用模板（平台佣金/广告费/达人佣金/物流费/包装费/仓储费/退款/其他）
  - MYR 多货币核算
  - 利润表（按 SKU/按月/按店铺/按国家）
  - ECharts 利润趋势图
- **计算公式**：净利润 = GMV - 退款 - 佣金 - 支付费 - 采购成本 - 头程物流 - 尾程配送 - 仓储 - 广告 - 达人佣金 - 税费 - 其他

### 5.6 达人 BD（Influencer）
- **入口**：`/influencers` → `InfluencerLayout.tsx`
- **一期功能**：达人登记（姓名/平台/粉丝数/合作方式/联系方式）
- **数据库**：`influencers` 表 + `influencer_reports` 表

### 5.7 AI 工作室（AI Studio）
- **入口**：`/ai-studio` → `AIStudioLayout.tsx`
- **素材库**：`MaterialLibrary.tsx` — 图片/视频上传、分类、标签、搜索
- **视频生成**：`AIVideoGenerator.tsx` — 7 Agent Pipeline（详见"AI 能力矩阵"）
- **核心技术**：Seedance API 调用（火山引擎方舟大模型）
- **图片增强**：Client-side Canvas 自动放大到 720px+（解决 Seedance 最小 300px 要求）

### 5.8 广告管理（Ads）
- **入口**：`/ad-dashboard` → `AdDashboard.tsx`，子页面：账户/系列/规则/素材/对账/日志
- **核心 API**：`server/src/routes/ad-center.ts`
- **数据来源**：TikTok Ads API（通过 Cloudflare Worker 中继）+ 本地库 `ad_campaigns` / `ad_creatives`
- **功能**：全链路广告数据展示（Campaign → Ad Group → Creative）、ROAS 实时计算

### 5.9 欧文 Agent（Owen / Kyrie）
- **入口**：`/kyrie` (PC) / `/m/kyrie` (移动)
- **核心文件**：`server/src/routes/agent-chat.ts`（system prompt + 9 Tool Calling 函数）
- **智能记忆**：`server/src/services/chat-memory.ts`（会话隔离 + Token 感知截断 + 自动过期）
- **9 个工具**：`get_shop_stats` / `get_order_list` / `get_product_list` / `get_influencers` / `get_finance_summary` / `get_ad_performance` / `get_dashboard` / `get_knowledge` / `analyze_data`
- **最多 5 轮**：agentLoop 循环调用工具直到返回最终报告
- **安全**：违禁词检测 + 模型调用全量留存

### 5.10 AI 增长中心（Growth Center）★ v1.0 [META]
- **入口**：`/growth-center/diagnosis` / `history` / `review` / `debug`
- **核心架构**：8 阶段 Pipeline
  ```
  Data Collector（10 个 TikTok API） → Data Mapper（统一模型）
  → Rule Engine（6 类规则） → Evidence Builder（异常→证据链）
  → Diagnosis Engine（DeepSeek-V4-Pro） → Suggestion Engine → Report
  ```
- **4 页面**：店铺诊断（健康评分+问题+证据链+建议）、诊断记录、AI 复盘、数据调试

### 5.11 系统管理
- **认证**：JWT + RBAC（admin/user 两级）、5 次登录失败锁定 15 分钟
- **审计**：全量 API 操作日志（180 天保留）、模型调用日志
- **安全**：速率限制、IP 白名单、备份恢复、SQLite 索引优化

### 5.12 飞书 Bot
- **通信模式**：长连接（WebSocket），主动连飞书网关
- **消息处理**：去重（processedMessages Set）+ 3 秒超时重推
- **算法**：SHA256 加密解密（key 从飞书 Event Subscriptions 获取）

---

## 6. 前端设计体系

### 6.1 品牌设计规范（v2024.05.22 暖灰商务）

| 设计元素 | 值 |
|---------|-----|
| **品牌色** | `#2563eb` |
| **页面背景** | `#f5f3f0` |
| **侧边栏背景** | `#faf9f7` |
| **卡片背景** | `#FFFFFF` |
| **卡片圆角** | 12px |
| **边框色** | `#e8e5e0` |
| **卡片阴影** | `0 1px 3px rgba(0,0,0,0.04)` |
| **按钮圆角** | 8px |
| **输入框圆角** | 10px |
| **模态框圆角** | 14px |
| **灰色阶** | Slate 600-900（文字）/ Slate 50-200（背景） |
| **统计卡色** | 蓝#3b82f6 / 绿#059669 / 红#dc2626 / 橙#d97706 |

### 6.2 UI 组件规范

- **页面骨架**：渐变图标标题栏 → 圆角阴影卡片 → 表格/内容
- **表格容器**：12px 圆角 + 微阴影 + 无边框
- **搜索筛选栏**：浅灰底 + 8px 圆角 + 定高
- **状态标签**：6px 圆角 + fontWeight 500
- **主按钮**：8px 圆角 + hover 渐变

### 6.3 已完成的 UI 统一

| 页面 | 状态 |
|------|------|
| 素材库 (MaterialLibrary.tsx) | ✅ 标杆页面 |
| 操作日志 (AuditLogs.tsx) | ✅ |
| API 管理 (ApiConfig.tsx) | ✅ |
| 仪表盘 (Dashboard.tsx) | ⚠️ 待优化 |
| 达人 BD (Influencers.tsx) | ⚠️ 待优化 |

---

## 7. 后端构建规范

### 7.1 目录结构

```
server/
├── src/
│   ├── index.ts              # Express 启动 + 全局中间件 + 路由注册
│   ├── db.ts                 # SQLite WAL 模式初始化 + 30+ 迁移
│   ├── middleware/            # auth / audit / rate-limit / content-moderation
│   ├── routes/               # 30+ 路由文件
│   ├── services/             # 业务逻辑层
│   │   ├── tiktok-api.ts     # TikTok Shop API 封装
│   │   ├── tiktok-oauth.ts   # Token 管理 + 签名
│   │   ├── tiktok-ads.ts     # TikTok Ads API 封装
│   │   ├── order-sync.ts     # 订单同步逻辑
│   │   ├── auto-sync.ts      # 定时同步（10min）
│   │   ├── tiktok-product-sync.ts
│   │   ├── ai-engine/        # AI Engine（10 子文件）
│   │   ├── growth-center/    # AI 增长中心 Pipeline
│   │   ├── chat-memory.ts    # 对话记忆系统
│   │   ├── model-call-log.ts # 模型调用日志
│   │   └── tiktok-mcp/       # TikTok Ads MCP Server
│   └── utils/
│       └── llm-endpoint.ts
├── data/
│   └── erp.db                # SQLite 数据库
├── package.json
├── tsconfig.json
└── Dockerfile
```

### 7.2 中间件链

```
请求 → CORS → JSON Body Parser → Cookie Parser
    → Rate Limiter → Audit Logger
    → Content Moderation（AI 接口）
    → Auth Middleware（JWT 验证）
    → 业务路由
```

### 7.3 数据库设计概要

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `users` | 用户账户 | username, password_hash, role, ai_suspended |
| `tiktok_shops` | 店铺+Token | shop_cipher, access_token, refresh_token |
| `orders` | 订单数据 | order_id, shop_cipher, order_status, gmv |
| `products` | 商品数据 | product_id, shop_id, title, price |
| `ai_channels` | AI 通道配置 | api_base, api_key, model, is_default |
| `video_model_configs` | 视频模型配置 | api_url, query_api_url, model_name, api_key |
| `model_call_logs` | 模型调用日志 | user_id, module, model_name, input_prompt, output_content |
| `user_violations` | 违禁记录 | user_id, date, violation_count |
| `chat_sessions` | 对话会话 | session_id, user_id, title, status |
| `chat_history` | 对话历史 | session_id, role, content, tokens |
| `audit_logs` | 操作审计 | user_id, method, path, status, ip, detail |
| `growth_diagnoses` | 诊断报告 | task_id, shop_id, health_score, result_json |
| `video_tasks` | 视频生成任务 | task_id, status, prompt, quality_score |

---

## 8. AI 能力矩阵

### 8.1 欧文 Agent（Function Calling）

```
用户 Query
  ↓
System Prompt（跨境电商专家）
  ↓
DeepSeek-V4-Pro → Function Calling 决策
  ├─ 调用工具：get_shop_stats / get_order_list / ...
  ├─ 工具返回数据 → 注入 context
  ├─ 继续决策（最多 5 轮）
  └─ 最终生成 Markdown 报告
```

### 8.2 AI 视频生成（7 Agent Pipeline）

```
商品图 + Prompt
  ↓
① Vision    — 商品理解（材质/风格/卖点）
② Strategy  — 创意策略（目标人群/平台适配）
③ Director  — 分镜脚本（镜头运动/场景/节奏）
④ Prompt    — Prompt 生成
⑤ Optimizer — 模型适配优化（LLM 调用 DeepSeek-V4-Pro）
⑥ Adapter   — 统一参数格式（Seedance 接口）
⑦ Quality   — 质量评分 ≥ 85 → 生成，否则自动重试
  ↓
Seedance API → 视频文件
```

### 8.3 AI 增长中心（Rule Engine + LLM）

```
Data Collector（10 个 TikTok API 并行）
  ↓
Rule Engine（机器检测 CTR<2% / CVR<1% / 库存=0）
  ↓
Evidence Builder（异常→证据链）
  ↓
DeepSeek-V4-Pro 诊断分析
  ↓
结构化报告（健康评分 + 问题 + 证据 + 建议 + 优先级 + 置信度）
```

### 8.4 对话记忆系统

| 机制 | 行为 |
|------|------|
| Token 感知截断 | 累加 80K token 后自动丢弃旧消息 |
| 会话隔离 | 每用户最多 5 活跃会话，24h 无活动归档 |
| 前端持久化 | localStorage 保存 sessionId，刷新不丢失 |
| 自动创建 | 首条消息自动创建新会话 |
| 新对话按钮 | 一键清空上下文，开启全新对话 |

---

## 9. 备案合规架构

### 9.1 内容安全

| 层级 | 实现 |
|------|------|
| 违禁词检测 | 50 关键词 + 正则模式 + 变体绕过，3 层智能匹配 |
| 拦截机制 | 单次拦截 + 前端弹合规提示 + 累计 3 次暂停 AI |
| 管理后台 | `/admin/moderation` 违禁记录列表、解禁/封禁操作 |

### 9.2 模型调用全量留存

| 表 | 字段 | 保留周期 |
|----|------|---------|
| `model_call_logs` | user_id, module, model_name, input_prompt, output_content, tokens, ip, status | **180 天** |
| `audit_logs` | user_id, method, path, status, ip, detail | **180 天** |

### 9.3 AIGC 元数据

- 所有 AI 生成文件嵌入 `AIGC: 1` / `ContentProducer` / `ProducerID`
- 支持 PNG/JPEG(tEXt+XMP)、MP4(udta)、PDF(XMP)、文本(Markdown注释)
- 工具：`scripts/inject_aigc_meta.py`

### 9.4 AI 标识

- 欧文对话每条回复底部显示"内容由AI生成"（10px 极淡灰色，备案可见但不影响体验）

---

## 10. 功能优势与效率体现

### 10.1 相比手动操作 TikTok 后台的效率提升

| 场景 | 手动操作 | 虾掌柜 ERP | 效率提升 |
|------|---------|-----------|---------|
| 每天查看 5 个店铺 GMV | 5× 登录切换 ≈ 15min | 仪表盘一屏展示，5s | **180x** |
| 每 10 分钟同步一次订单 | 不可能手动 | 自动化定时同步 | **∞** |
| 月利润核算（多店铺） | Excel 手动拉数据 2-4h | 一键导出，30s | **240x** |
| 达人 BD 管理 50 个达人 | 备忘录/Excel 碎片 | 系统统一管理+搜索 | **10x** |
| 广告 ROI 监控（5 个 Campaign） | 逐一登录 TikTok Ads | 一屏展示+实时计算 | **50x** |
| AI 视频生成 | 无此能力 | 7 Agent Pipeline 全自动 | **新增能力** |
| 店铺诊断 | 人工分析 2-4h | 一键诊断 35s | **200x** |

### 10.2 系统核心优势

1. **一键部署**：Docker Compose 两条命令上线
2. **零运维数据库**：SQLite 单文件，备份=cp
3. **企业级 Token 管理**：自动刷新+mutex+grace期+预刷调度
4. **国内网络自适应**：直连失败自动回退 Cloudflare Worker 中继
5. **AI 全链路**：从数据分析→决策支持→内容生成，形成闭环
6. **备案合规全栈**：违禁词/审计/模型日志/AIGC元数据一应俱全

---

> **文档版本**：v3.0  
> **最后更新**：2026-07-23  
> **维护团队**：虾掌柜技术团队
