---
name: SKIIS Pro
description: 虾掌柜运营分析AI工作体 — 通过自然语言完成TikTok Shop日报生成、利润诊断、达人汇报、数据文件分析和跨境知识问答。当用户需要生成运营日报/周报、分析利润数据、统计达人合作情况、解读数据文件、或询问跨境电商/财务核算/TikTok运营相关问题时使用此技能。触发词包括：日报、周报、利润、ROI、达人、BD汇报、数据分析、跨境电商、TikTok Shop等。
---

# 虾掌柜运营分析 AI 工作体 (SKIIS Pro)

## 概述

SKIIS Pro 是一个 AI 运营分析工作体，封装了 TikTok Shop 跨境电商的全套运营分析能力。用户只需通过自然语言描述需求，即可自动完成以下工作：

1. **日报/周报生成** — 自动拉取订单、利润、达人数据，生成结构化报告
2. **利润智能诊断** — 识别亏损产品，拆解每项成本，给出优化建议
3. **达人BD汇报** — 统计达人合作、寄样进度，生成BD周报
4. **数据文件分析** — 支持6大分析框架（漏斗/人货场/AARRR/RFM/同期群/归因）
5. **跨境知识问答** — 基于60+篇知识库的专业问答

## 何时使用

- 用户说"生成本周运营日报"、"今天的数据怎么样"、"汇总本周GMV"
- 用户说"哪些产品在亏钱"、"分析利润"、"ROI为什么下降"
- 用户说"达人BD周报"、"统计达人合作情况"、"寄样进度"
- 用户说"分析这份数据"、"解读GMV趋势"、"对比这两个月数据"
- 用户询问跨境电商知识（佣金费率、物流、选品、定价等）
- 用户提到财务核算、利润模型、成本结构等问题

## 工作方式

本工作体通过后端 API `/api/skiis-chat/chat` 完成所有分析工作。执行步骤：

1. **检查服务状态** — 确保后端服务在 `http://localhost:3000` 运行
2. **获取认证Token** — 从数据库获取用户凭据并登录
3. **发送自然语言查询** — POST 请求到 `/api/skiis-chat/chat`
4. **展示分析结果** — 将返回的Markdown报告格式化展示给用户

### 核心 API

#### POST /api/skiis-chat/chat

请求体：
```json
{
  "query": "用户的自然语言输入"
}
```

响应体：
```json
{
  "success": true,
  "task": "daily_report|weekly_report|profit_diagnosis|influencer_report|data_analysis|knowledge_qa",
  "query": "原始查询",
  "params": { "date_from": "...", "date_to": "...", "focus": "..." },
  "analysis": "LLM生成的Markdown分析报告",
  "kbSources": [{ "title": "知识库文档标题", "file": "文件路径" }],
  "dataCount": { "orders": 10, "products": 5, "influencers": 3 },
  "savedToDb": { ... }
}
```

#### GET /api/skiis-chat/data/:task

获取特定类型的数据（不经过LLM分析）：
- `orders` — 订单汇总数据
- `products` — 热销产品排行
- `profit` — 利润概览
- `influencers` — 达人统计

## 执行流程

### 调用后端时的步骤

1. 首先确认 `http://localhost:3000` 可访问
2. 使用 `admin` 账号登录获取 JWT token：
   ```
   POST http://localhost:3000/api/auth/login
   Content-Type: application/json
   { "username": "admin", "password": "admin123" }
   ```
3. 携带 `Authorization: Bearer <token>` 调用 `/api/skiis-chat/chat`
4. 将返回的 `analysis` 字段（Markdown格式）展示给用户

### 每种任务类型的处理

#### 日报生成 (daily_report)
- 输入示例："生成本周运营日报"、"今天的GMV怎么样"
- 后端自动：采集今日/指定日期订单数据、统计各店铺表现、搜索知识库
- 输出：Markdown日报（核心指标表格 + 店铺表现 + 异常预警）

#### 周报生成 (weekly_report)
- 输入示例："生成本周周报"、"汇总本周数据"
- 后端自动：采集周订单+利润+达人+产品数据，趋势对比
- 输出：Markdown周报（6个标准板块）

#### 利润诊断 (profit_diagnosis)
- 输入示例："哪些产品在亏钱"、"分析ROI"
- 后端自动：读取financial_records、运行公式引擎、拆解成本项
- 输出：Top5亏损产品 + 原因拆解 + 优化建议

#### 达人BD汇报 (influencer_report)
- 输入示例："达人BD周报"、"统计达人合作"
- 后端自动：统计达人总数/新增/寄样/素材
- 输出：达人统计表 + 合作状态分布 + 下周BD建议

#### 数据文件分析 (data_analysis)
- 输入示例："分析这份数据"、"解读GMV趋势"
- 后端自动：采集订单+产品数据，匹配合适分析框架
- 输出：趋势分析 + 框架分析 + 异常发现 + 行动建议

#### 跨境知识问答 (knowledge_qa)
- 输入示例："马来西亚佣金费率是多少"、"斋月选品注意什么"
- 后端自动：搜索60+篇知识库，基于检索结果回答
- 输出：结构化答案 + 引用来源

## 业务规则（已内置于后端）

以下规则由后端自动应用，无需用户知晓：

- 佣金费率：2026/07/25起 10.26%（此前为0）
- 平台支持费：2026/06/05起 0.45 MYR/单（此前为0）
- 交易手续费：固定 3.78%
- BXP费用：4.86%
- 跨境运费：产品重量 × 0.015 × 汇率
- 汇率：自动从 exchangerate-api.com 每日更新
- 净利润公式：x=(实收-税费-运费)×汇率, y=Σ(数量×SKU采购成本), z=实收×(3.78%+4.86%+佣金)×汇率, a=平台费0.45×汇率, c=跨境运费, 净利润=x-y-z-a-c

## 注意事项

- 确保后端服务已启动：`cd server && npm run start`
- 如果返回"未配置AI渠道"，需要先在系统中配置至少一个AI API渠道
- 日报/周报生成后会自动存入数据库的 skiis_daily_logs / skiis_weekly_reports 表
- 所有分析基于实时数据库数据，不是凭记忆生成
