# 博众智汇 ERP 技术规格文档

> **版本**: v1.3.0
> **定位**: TikTok 跨境电商 ERP 系统，面向马来西亚 TikTok Shop 卖家
> **品牌名**: 博众智汇
> **默认账号**: admin / admin123（首次登录强制修改密码）
> **开发者账号**: Kyrie / Ljy231228.

---

## 1. 项目概览

### 1.1 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端框架 | Express | ^4.21.1 |
| 后端语言 | TypeScript | ^5.7.0 |
| 运行时 | Node.js | 22.12.0 |
| 后端热重载 | tsx | ^4.19.0 |
| 数据库 | SQLite (better-sqlite3) | ^11.7.0 |
| 前端框架 | React | ^18.3.1 |
| 前端构建 | Vite | ^6.0.0 |
| UI 组件库 | Ant Design | ^5.22.0 |
| 状态管理 | Zustand | ^5.0.0 |
| 路由 | React Router DOM | ^6.30.3 |
| HTTP 客户端 | Axios | ^1.7.9 |
| 图表 | ECharts | ^5.5.1 |
| Excel 导出/导入 | xlsx (SheetJS) / multer | ^0.18.5 / ^4.5.0 |
| 认证 | JWT (jsonwebtoken) | ^9.0.2 |
| 密码加密 | bcryptjs | ^2.4.3 |

### 1.2 项目目录结构

```
E:\tiktok-crm\
├── server/                              # 后端（Express + SQLite）
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                             # 环境变量（JWT_SECRET 等，不入库）
│   └── src/
│       ├── index.ts                     # 入口：Express app，端口 3000
│       ├── middleware/
│       │   └── auth.ts                 # JWT 认证 + 审计日志中间件 + 登录限流
│       ├── routes/
│       │   ├── auth.ts                 # 认证路由（含 RBAC 登录、/me）
│       │   ├── products.ts             # 产品/供应商/店铺路由
│       │   ├── finance/                # 利润核算子目录（v1.3.0 拆分）
│       │   │   ├── index.ts            # 子路由入口：挂载 /records, /cost-items 等
│       │   │   ├── records.ts          # 核算记录 CRUD + 同步产品 + 重算
│       │   │   ├── costs.ts            # 成本项 CRUD
│       │   │   ├── formulas.ts         # 公式引擎（循环检测+求值）
│       │   │   ├── calc.ts             # 单条记录利润计算
│       │   │   ├── exchange.ts         # 汇率管理
│       │   │   ├── trend.ts           # 利润趋势图数据 API
│       │   │   ├── order-profit.ts     # 订单维度利润核算
│       │   │   └── shared.ts          # 共享工具函数
│       │   ├── influencers.ts          # 达人BD路由
│       │   ├── settings.ts             # 系统设置/备份路由
│       │   ├── ai.ts                   # AI 配置与 Chat 代理路由（含 test-config）
│       │   ├── ai-channels.ts          # AI 渠道管理路由（多渠道负载均衡）
│       │   ├── shops.ts                # TikTok 店铺管理与仪表盘统计路由
│       │   ├── orders.ts               # 订单管理路由（CRUD + 状态计数）
│       │   ├── orders-import.ts        # AI 智能导入订单路由
│       │   ├── dashboard.ts            # 全局仪表盘首页路由
│       │   ├── seedance.ts             # Seedance 视频生成路由
│       │   └── video-models/           # 视频模型管理子目录（v1.3.0 拆分）
│       │       ├── index.ts            # 子路由入口
│       │       ├── configs.ts          # 模型配置 CRUD
│       │       ├── generate.ts         # 视频生成逻辑
│       │       ├── poll.ts             # 任务轮询
│       │       ├── db-helpers.ts       # 数据库操作辅助
│       │       └── types.ts            # 类型定义
│       └── utils/
│           └── backup.ts              # 数据库自动备份工具
│   └── data/
│       ├── erp.db                      # SQLite 数据库文件
│       ├── uploads/                    # 产品图片上传目录
│       ├── tmp/                        # AI 导入临时文件目录
│       └── 虾掌柜_数据备份/             # 数据库备份目录
│
├── client/                              # 前端（React + Vite）
│   ├── package.json
│   ├── vite.config.ts                  # 代理 /api → localhost:3000
│   └── src/
│       ├── main.tsx                    # React 入口
│       ├── App.tsx                     # 路由 + 布局 + RBAC 权限控制 + 动态菜单
│       ├── api/
│       │   └── index.ts               # Axios 实例，请求/响应拦截器
│       ├── stores/
│       │   ├── authStore.ts           # 认证状态 + RBAC 角色/权限
│       │   ├── productStore.ts        # 产品/供应商/店铺状态
│       │   ├── financeStore.ts        # 核算/公式/汇率状态
│       │   ├── influencerStore.ts     # 达人/跟进记录状态
│       │   └── aiStore.ts            # AI 配置状态
│       └── pages/
│           ├── Login.tsx              # 登录页
│           ├── Dashboard.tsx           # 仪表盘首页（v1.3.0 新增）
│           ├── Products.tsx            # 产品管理页
│           ├── ProductDetail.tsx       # 产品详情页
│           ├── Finance.tsx             # 利润核算页（全局公式模式，无单独配置）
│           ├── Influencers.tsx         # 达人BD页
│           ├── Settings.tsx            # 系统设置页（AI配置/账号管理/备份）
│           ├── AIAnalysis.tsx          # AI 智能分析页
│           ├── ShopManagement.tsx      # 店铺管理页（含 ECharts 图表）
│           ├── OrderManagement.tsx     # 订单管理页（状态 tabs + AI 导入向导）
│           ├── UserPermissions.tsx     # 用户与权限管理页
│           ├── SeedanceModelConfig.tsx # Seedance 模型配置页
│           ├── SeedanceVideoGenerator.tsx # Seedance 视频生成页
│           ├── VideoModelConfig.tsx    # 视频模型配置页
│           ├── MaterialLibrary.tsx     # 素材库
│           └── RawMaterials.tsx        # 原材料管理
│
├── _run_hidden.vbs                      # VBS 隐藏窗口脚本
├── start.bat                            # 一键启动前后端
├── stop.bat                             # 一键停止所有服务
├── restart.bat                          # 一键重启前后端
├── start-backend.bat                    # 单独启动后端
├── stop-backend.bat                     # 单独停止后端
├── restart-backend.bat                  # 单独重启后端
├── start-frontend.bat                   # 单独启动前端
├── stop-frontend.bat                    # 单独停止前端
├── restart-frontend.bat                 # 单独重启前端
```

### 1.3 品牌设计

| 属性 | 值 |
|------|-----|
| 品牌名 | 虾掌柜 |
| 品牌色 | #2563eb（商务蓝）|
| Logo | 🦞 虾掌柜 |
| 登录副标题 | 你的小龙虾生意管家 |
| 侧边栏 | 200px 宽，选中项蓝色文字 + 左侧竖线标记 |
| 内容区 | 浅灰背景 #f5f5f5 + 白色卡片 |
| 系统版本 | v1.3.0 |

---

## 2. 数据库设计

### 2.1 数据库配置

- 引擎：SQLite（WAL 模式）
- 外键约束：启用
- 数据文件：`E:\tiktok-crm\server\data\erp.db`
- 迁移策略：每次启动自动检测缺失表/列，执行 ALTER TABLE 增量迁移
- 环境变量：`server/.env` 存储 JWT_SECRET（首次启动随机生成）

### 2.2 ER 关系图

```
tiktok_shops 1──N orders 1──N order_items
                │
                └──N──1 influencers (via orders.influencer_id)
                          │
                          └──N──M── products (via product_influencer_bind)

suppliers 1──N products 1──N product_skus (多SKU支持)
                │
                ├──1──N product_shops ←── shops (legacy)
                │
                └──1──N financial_records

influencers 1──N follow_up_records

roles 1──N users
users (独立)
cost_items (独立，被 financial_records.cost_detail JSON 引用)
settings (key-value，存汇率、公式、AI配置等)
order_import_logs (AI导入历史)
ai_channels (AI多渠道配置)      ← v1.3.0 新增
audit_log (审计日志)            ← v1.3.0 新增
```

### 2.3 完整表结构

#### users — 用户表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 用户 ID |
| username | TEXT | UNIQUE NOT NULL | 用户名 |
| password | TEXT | NOT NULL | bcrypt 哈希密码 |
| display_name | TEXT | DEFAULT '' | 显示名称 |
| role_id | INTEGER | FK→roles(id) | 角色 ID |
| force_change_pwd | INTEGER | DEFAULT 0 | 首次登录是否强制改密 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### roles — 角色表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 角色 ID |
| name | TEXT | UNIQUE NOT NULL | 角色名称 |
| role_key | TEXT | UNIQUE | 角色键值（developer/manager/staff）|
| description | TEXT | DEFAULT '' | 角色描述 |
| permissions | TEXT | DEFAULT '{}' | 权限 JSON {模块键: 'read'\|'edit'} |
| sort_order | INTEGER | DEFAULT 0 | 排序（数字越小权限越高）|
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

**预置角色（id=1 开发者 > id=2 管理员 > id=3 员工）：**

| ID | 名称 | role_key | 描述 | 权限示例 |
|----|------|----------|------|----------|
| 1 | 开发者 | developer | 系统最高权限 | 所有模块 edit |
| 2 | 管理员(领导) | manager | 业务管理员 | AI edit，其他 edit，user-mgmt read |
| 3 | 普通员工 | staff | 普通员工 | 所有模块 read（不可编辑）|

#### suppliers — 供应商表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 供应商 ID |
| name | TEXT | NOT NULL | 供应商名称 |
| contact | TEXT | NOT NULL | 联系方式 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### tiktok_shops — TikTok 店铺表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 店铺 ID |
| name | TEXT | NOT NULL | 店铺名称（如 "Freshguard15"）|
| region | TEXT | DEFAULT 'MY' | 地区（MY/SG/TH/PH/ID/VN/GB/US）|
| shop_id | TEXT | DEFAULT '' | TikTok 店铺后台 ID |
| status | TEXT | DEFAULT 'active' | 状态：active/inactive/pending |
| last_synced_at | DATETIME | | 最后同步时间 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### products — 产品表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 产品 ID |
| sku | TEXT | DEFAULT '' | SKU 编码（非 UNIQUE，支持多 SKU）|
| name | TEXT | NOT NULL | 产品名称 |
| image | TEXT | DEFAULT '' | 图片（base64）|
| weight | REAL | DEFAULT 0 | 重量(g)|
| stock | INTEGER | DEFAULT 0 | 库存 |
| sell_price | REAL | DEFAULT 0 | 售价(MYR)|
| cost_price | REAL | DEFAULT 0 | 采购成本(RMB)|
| supplier_id | INTEGER | FK→suppliers(id)| 供应商 |
| box_qty | INTEGER | DEFAULT 0 | 箱规数量 |
| box_length | REAL | DEFAULT 0 | 箱长 cm |
| box_width | REAL | DEFAULT 0 | 箱宽 cm |
| box_height | REAL | DEFAULT 0 | 箱高 cm |
| box_remark | TEXT | DEFAULT '' | 箱规备注 |
| commission | REAL | DEFAULT 0 | 佣金比例(%)|
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### product_skus — 产品 SKU 表（多 SKU 支持）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | SKU ID |
| product_id | INTEGER | FK→products(id) CASCADE | 产品 ID |
| sku_code | TEXT | DEFAULT '' | SKU 编码（TikTok Seller SKU）|
| spec_name | TEXT | NOT NULL DEFAULT '' | 规格名称 |
| cost_price | REAL | DEFAULT 0 | 规格成本价 |
| sell_price | REAL | DEFAULT 0 | 规格售价 |
| stock | INTEGER | DEFAULT 0 | 规格库存 |
| image | TEXT | DEFAULT '' | SKU 图片 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### product_shops — 产品-店铺价格映射表（遗留）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 记录 ID |
| product_id | INTEGER | FK→products(id) CASCADE | 产品 ID |
| shop_name | TEXT | NOT NULL | 店铺名称 |
| shop_price | REAL | DEFAULT 0 | 该店铺售价 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### cost_items — 成本项表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 成本项 ID |
| name | TEXT | UNIQUE NOT NULL | 成本项名称 |
| currency | TEXT | DEFAULT 'RMB' | 币种：RMB/MYR/USD（可扩展）|
| is_fixed | INTEGER | DEFAULT 0 | 是否固定（固定不可删除）|
| is_active | INTEGER | DEFAULT 1 | 是否启用（软删除）|
| value_format | TEXT | DEFAULT 'number' | 值格式：number 或 percentage |
| formula | TEXT | DEFAULT '' | 自定义计算公式 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

**预置固定成本项（马来西亚 TikTok Shop 场景）：**

| 名称 | 币种 | 典型公式示例 |
|------|------|-------------|
| 订单操作费MYR | MYR | — |
| 佣金费MYR | MYR | — |
| 平台支持费MYR | MYR | — |
| SST税费MYR | MYR | — |
| 交易手续费MYR | MYR | — |
| BXP项目费MYR | MYR | — |
| 达人佣金MYR | MYR | — |
| 跨境运费RMB | RMB | `产品重量 * 0.015 * MYR兑RMB汇率` |
| EXP运费 | RMB | — |
| 物流成本 | RMB | `订单操作费MYR + 跨境运费RMB` |

#### financial_records — 核算记录表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 记录 ID |
| product_id | INTEGER | FK→products(id) CASCADE | 产品 ID |
| sell_price | REAL | DEFAULT 0 | 售价快照(MYR)|
| cost_price | REAL | DEFAULT 0 | 采购成本快照(RMB)|
| weight | REAL | DEFAULT 0 | 重量快照(g)|
| cost_detail | TEXT | DEFAULT '{}' | 成本明细 JSON：{costItemId: rawValue} |
| net_profit | REAL | DEFAULT 0 | 净利润(RMB) 冗余缓存 |
| total_investment | REAL | DEFAULT 0 | 总投入(RMB) 冗余缓存 |
| roi | REAL | DEFAULT 0 | 整体ROI 冗余缓存 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

> **v1.3.0 变更**：移除 `custom_cost_formulas` 字段，不再支持单条记录的单独公式配置。所有记录统一使用 `cost_items.formula` 的全局公式。

#### influencers — 达人表（增强版）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 达人 ID |
| shop_id | INTEGER | FK→tiktok_shops(id) | 关联店铺 |
| influencer_id | TEXT | NOT NULL DEFAULT '' | 达人平台 ID |
| profile_url | TEXT | DEFAULT '' | 主页链接 |
| contact_channel | TEXT | DEFAULT '' | 联系方式渠道 |
| contact_info | TEXT | DEFAULT '' | 联系方式详情 |
| cooperation_type | TEXT | DEFAULT '' | 合作类型 |
| commission_rate | REAL | DEFAULT 0 | 佣金比例 |
| product_id | INTEGER | FK→products(id) | 推广产品 |
| sample_qty | INTEGER | DEFAULT 1 | 样品数量 |
| sample_cost | REAL | DEFAULT 0 | 样品成本 |
| send_date | TEXT | DEFAULT '' | 寄样日期 |
| receive_date | TEXT | DEFAULT '' | 收样日期 |
| material_schedule | TEXT | DEFAULT '' | 素材排期 |
| material_url | TEXT | DEFAULT '' | 素材链接 |
| remark | TEXT | DEFAULT '' | 备注 |
| name | TEXT | NOT NULL DEFAULT '' | 达人名称（兼容旧字段）|
| contact | TEXT | NOT NULL DEFAULT '' | 联系方式（兼容旧字段）|
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### follow_up_records — 跟进记录表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 记录 ID |
| influencer_id | INTEGER | FK→influencers(id) CASCADE | 达人 ID |
| contact_time | DATETIME | DEFAULT NOW | 沟通时间 |
| content | TEXT | DEFAULT '' | 沟通内容 |
| status | TEXT | DEFAULT '待沟通' | 状态：待沟通/已沟通/待跟进/终止跟进 |
| next_follow_up | TEXT | DEFAULT '' | 下次跟进日期 |
| remark | TEXT | DEFAULT '' | 备注 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### product_influencer_bind — 产品-达人绑定表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 绑定 ID |
| influencer_id | INTEGER | FK→influencers(id) CASCADE | 达人 ID |
| product_id | INTEGER | FK→products(id) CASCADE | 产品 ID |
| (influencer_id, product_id) | | UNIQUE | 联合唯一约束 |

#### orders — 订单表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 订单 ID |
| order_no | TEXT | UNIQUE NOT NULL | 订单号 |
| shop_id | INTEGER | FK→tiktok_shops(id) | 关联店铺 |
| buyer_name | TEXT | DEFAULT '' | 买家名称 |
| buyer_phone | TEXT | DEFAULT '' | 买家电话 |
| status | TEXT | DEFAULT 'pending' | 订单状态 |
| payment_status | TEXT | DEFAULT 'unpaid' | 支付状态 |
| logistics_status | TEXT | DEFAULT '' | 物流状态 |
| tracking_no | TEXT | DEFAULT '' | 物流单号 |
| carrier | TEXT | DEFAULT '' | 承运商 |
| item_total | REAL | DEFAULT 0 | 商品合计金额 |
| shipping_fee | REAL | DEFAULT 0 | 运费 |
| discount | REAL | DEFAULT 0 | 优惠金额 |
| taxes | REAL | DEFAULT 0 | 税费 |
| actual_amount | REAL | DEFAULT 0 | 实付金额 |
| influencer_id | INTEGER | FK→influencers(id) | 达人来源 |
| commission_rate | REAL | DEFAULT 0 | 达人佣金比例 |
| remark | TEXT | DEFAULT '' | 备注 |
| order_time | DATETIME | DEFAULT NOW | 下单时间 |
| ship_deadline | DATETIME | | 发货截止时间 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

**订单状态枚举：**

| 状态值 | 中文标签 | 说明 |
|--------|----------|------|
| pending | 待支付 | 等待付款 |
| pending_ship | 待发货 | 已付款待发货 |
| shipped | 已发货 | 运输中 |
| completed | 已完成 | 交易完成 |
| cancelled | 已取消 | 买家取消 |
| cancel_requested | 申请取消 | 等待审核取消 |
| refund_requested | 申请退款 | 等待审核退款 |
| refunded | 已退款 | 已退款完成 |
| auto_cancelled | 自动取消 | 超时自动取消 |

#### order_items — 订单商品明细表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 明细 ID |
| order_id | INTEGER | FK→orders(id) CASCADE | 订单 ID |
| product_id | INTEGER | FK→products(id) | 关联产品 |
| product_sku_id | INTEGER | FK→product_skus(id) | 关联 SKU |
| sku | TEXT | DEFAULT '' | SKU 编码 |
| product_name | TEXT | DEFAULT '' | 商品名称 |
| spec_name | TEXT | DEFAULT '' | 规格名称 |
| quantity | INTEGER | DEFAULT 1 | 数量 |
| unit_price | REAL | DEFAULT 0 | 单价 |
| subtotal | REAL | DEFAULT 0 | 小计 |

#### order_import_logs — AI 导入日志表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 日志 ID |
| user_id | INTEGER | | 操作用户 ID |
| imported_at | DATETIME | DEFAULT NOW | 导入时间 |
| total_rows | INTEGER | DEFAULT 0 | 总行数 |
| success_count | INTEGER | DEFAULT 0 | 成功数 |
| overwrite_count | INTEGER | DEFAULT 0 | 覆盖更新数 |
| fail_count | INTEGER | DEFAULT 0 | 失败数 |
| errors | TEXT | DEFAULT '[]' | 错误详情 JSON |

#### ai_channels — AI 多渠道配置表（v1.3.0 新增）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 渠道 ID |
| name | TEXT | NOT NULL | 渠道名称（如 "DeepSeek"）|
| provider | TEXT | DEFAULT 'custom' | 提供商（deepseek/volcengine/openai/custom）|
| api_base | TEXT | NOT NULL DEFAULT '' | API Base URL |
| api_key | TEXT | NOT NULL DEFAULT '' | API Key |
| model | TEXT | NOT NULL DEFAULT '' | 默认模型 |
| models | TEXT | DEFAULT '[]' | 支持的模型列表(JSON) |
| priority | INTEGER | DEFAULT 100 | 优先级（越小越优先）|
| status | TEXT | DEFAULT 'enabled' | enabled/disabled |
| is_default | INTEGER | DEFAULT 0 | 是否默认渠道 |
| quota_used | REAL | DEFAULT 0 | 已用额度 |
| quota_limit | REAL | DEFAULT 0 | 额度上限 |
| success_count | INTEGER | DEFAULT 0 | 成功次数 |
| error_count | INTEGER | DEFAULT 0 | 失败次数 |
| avg_latency | INTEGER | DEFAULT 0 | 平均延迟(ms) |
| last_used_at | DATETIME | | 最后使用时间 |
| last_success_at | DATETIME | | 最后成功时间 |
| last_error_at | DATETIME | | 最后错误时间 |
| last_error_message | TEXT | DEFAULT '' | 最后错误信息 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |
| updated_at | DATETIME | DEFAULT NOW | 更新时间 |

**预置渠道（系统初始化自动创建）：**

| 名称 | 提供商 | API Base URL | 默认模型 |
|------|--------|-------------|---------|
| DeepSeek | deepseek | https://api.deepseek.com/v1 | deepseek-chat |
| 火山引擎 | volcengine | https://ark.cn-beijing.volcengineapi.com | doubao-pro-32k |
| 硅基流动 | openai | https://api.siliconflow.cn/v1 | DeepSeek/DeepSeek-V3 |

> 注：预置渠道初始状态均为 `disabled` 且 `api_key` 为空，需在 UI 中手动启用并填写 Key。

#### audit_log — 审计日志表（v1.3.0 新增）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 日志 ID |
| user_id | INTEGER | | 操作用户 ID |
| action | TEXT | NOT NULL | 操作类型（CREATE/UPDATE/DELETE/LOGIN等）|
| resource | TEXT | NOT NULL | 资源类型（orders/products/finance等）|
| detail | TEXT | DEFAULT '{}' | 操作详情(JSON) |
| ip_address | TEXT | DEFAULT '' | 客户端 IP |
| created_at | DATETIME | DEFAULT NOW | 操作时间 |

**保留策略**：30天自动清理。

#### settings — 系统设置表（Key-Value）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| key | TEXT | PK | 设置键名 |
| value | TEXT | DEFAULT '{}' | 设置值（JSON 字符串）|

**内置键：**

| key | 说明 |
|-----|------|
| exchange_rate | MYR/RMB 汇率，默认 1.55 |
| finance_formulas | 利润公式配置，JSON 数组 |
| ai_config | **旧式 AI 配置**（api_key/api_base/model），用于订单导入等基础功能 |
| jwt_secret | JWT 密钥（首次启动随机生成 UUID）|

---

## 3. 后端 API 文档

### 3.1 通用规范

- 基础路径：`http://localhost:3000/api`
- 认证方式：Bearer Token（JWT，7天有效）
- 请求头：`Authorization: Bearer <token>`
- Content-Type：`application/json`
- 响应格式：JSON 对象或数组
- 错误响应：`{ error: "错误信息" }`
- 文件上传：multipart/form-data（multer，最大 50MB）
- **审计日志**：全量记录所有 POST/PUT/DELETE 操作

### 3.2 认证模块 — `/api/auth`

#### POST `/api/auth/login`
登录获取 JWT Token（含登录限流：15分钟内最多5次失败锁定）。

**请求体**：`{ "username": "admin", "password": "admin123" }`

**响应**：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "username": "admin",
  "permissions": { "products": "read", "orders": "edit", ... },
  "role_name": "管理员(领导)",
  "role_id": 2,
  "role_key": "manager"
}
```

#### GET `/api/auth/me`
获取当前用户信息（用于页面刷新时恢复状态）。

#### POST `/api/auth/register`
注册新用户（需 manager 及以上权限）。

#### GET `/api/auth/users`
获取用户列表（需认证）。

#### DELETE `/api/auth/users/:id`
删除用户（需 manager 及以上，不可删除自己）。

#### PUT `/api/auth/password`
修改当前用户密码。

### 3.3 产品模块 — `/api/products`

#### 产品 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/products/` | 获取产品列表（含 product_skus，支持 keyword/shop_name 筛选）|
| GET | `/api/products/:id` | 获取产品详情（含规格和店铺价格）|
| POST | `/api/products/` | 创建产品（含 specs 和 shops 数组）|
| PUT | `/api/products/:id` | 更新产品 |
| DELETE | `/api/products/:id` | 删除产品（级联）|

#### 供应商 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/products/suppliers` | 供应商列表 |
| POST | `/api/products/suppliers` | 创建供应商 |
| PUT | `/api/products/suppliers/:id` | 更新供应商 |
| DELETE | `/api/products/suppliers/:id` | 删除供应商 |

#### 遗留店铺 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/api/products/shops` | 遗留店铺 CRUD |
| GET | `/api/products/shop-filter-list` | 店铺名称列表 |

#### 导入导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/products/import` | 批量导入（Excel）|
| GET | `/api/products/export` | 导出所有产品（Excel）|
| POST | `/api/products/upload-image` | 上传产品图片 |

### 3.4 TikTok 店铺管理模块 — `/api/shops`

> 基于 `tiktok_shops` 表的独立店铺管理模块。

#### 店铺 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/shops/` | 店铺列表 |
| POST | `/api/shops/` | 创建店铺 `{ name, region, shop_id }` |
| PUT | `/api/shops/:id` | 更新店铺 |
| DELETE | `/api/shops/:id` | 删除店铺 |
| POST | `/api/shops/:id/sync` | 手动同步 |

#### 仪表盘统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/shops/stats` | 聚合统计（GMV/订单/客单价/趋势）|

### 3.5 订单管理模块 — `/api/orders`

#### 订单 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/orders/` | 订单列表（分页，支持 status/shop_id/keyword）|
| GET | `/api/orders/:id` | 订单详情（含 items + 商品图片回填）|
| POST | `/api/orders/` | 创建订单（自动关联达人佣金率）|
| PUT | `/api/orders/:id` | 更新订单（库存联动）|
| DELETE | `/api/orders/:id` | 删除订单 |

#### 元数据

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/orders/meta/counts` | 各状态订单数量（Tab 徽章）|
| GET | `/api/orders/ids` | 批量获取订单 ID |
| DELETE | `/api/orders/batch` | 批量删除 |

### 3.6 AI 智能订单导入 — `/api/orders/ai-import`

> 直接读取 `settings.ai_config`（旧式配置），与 AI 渠道系统独立。

#### POST `/api/orders/ai-import/parse`
上传 Excel/CSV → AI 识别字段映射 → 返回预览。

**流程**：
1. 解析 Excel（自动跳过说明行）
2. 调用 AI API 识别表头映射（精简 prompt，~300字）
3. 构建订单数据（按 order_no 分组，多 SKU 行合并）

**响应**：
```json
{
  "total_orders": 150,
  "preview": [{ "order_no": "...", "status": "pending_ship", ... }],
  "headers": ["Order ID", "Created Time", ...],
  "mapping": { "Order ID": "order_no", ... },
  "errors": [{ "row": 5, "reason": "..." }],
  "orders": [...]
}
```

#### POST `/api/orders/ai-import/commit`
确认导入，写入数据库。

**特性**：去重覆盖 / SKU 匹配 / 库存扣减回补 / 导入日志

#### GET `/api/orders/ai-import/logs`
查询最近 50 条导入历史。

### 3.7 利润核算模块 — `/api/finance`

> v1.3.0 已拆分为子目录，通过 `/api/finance` 统一挂载。

**路由挂载链路**：
```
server/index.ts → app.use('/api/finance', financeRoutes)
finance/index.ts → router.use('/records', recordsRouter)
                 router.use('/cost-items', costsRouter)
                 ...
```

#### 成本项 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/finance/cost-items` | 活跃成本项列表 |
| POST | `/api/finance/cost-items` | 创建成本项 |
| PUT | `/api/finance/cost-items/:id` | 更新成本项（固定项不可改名/删）|
| DELETE | `/api/finance/cost-items/:id` | 删除成本项（软删除）|

#### 公式 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/finance/formulas` | 公式配置 |
| PUT | `/api/finance/formulas` | 更新公式（循环检测校验）|

#### 汇率 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/finance/exchange-rate` | MYR/RMB 汇率 |
| PUT | `/api/finance/exchange-rate` | 更新汇率 |

#### 核算记录 API（注意路径包含 `/records`！）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/finance/records` | 核算记录列表（支持 product_id 筛选）|
| POST | `/api/finance/records` | 创建核算记录（自动计算）|
| PUT | `/api/finance/records/:id` | 更新核算记录 |
| DELETE | `/api/finance/records/:id` | 删除核算记录 |

#### 计算 API（注意路径包含 `/records`！）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/finance/records/recalculate` | 重算所有记录 |
| POST | `/api/finance/records/sync-products` | 从产品同步到核算记录 |

#### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/finance/summary` | 汇总（总收入/利润/投入/ROI）|
| GET | `/api/finance/records/export` | 导出核算数据（Excel）|
| GET | `/api/finance/trend?date_from=&date_to=` | 利润趋势数据（净利润+ROI日级曲线）|

### 3.8 达人模块 — `/api/influencers`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/api/influencers/` | 达人 CRUD |
| GET/POST/PUT/DELETE | `/api/influencers/:id/records` | 跟进记录 CRUD |
| POST | `/api/influencers/:id/bind` | 绑定产品 |
| GET | `/api/influencers/:id/stats` | 达人统计数据 |

### 3.9 AI 模块 — `/api/ai`

> 双轨制架构：`settings.ai_config`(旧) 与 `ai_channels` 表(新) 并存且完全独立。

#### GET `/api/ai/config`
读取 AI 配置。优先从 `ai_channels` 表取默认渠道，无可用渠道则回退 `settings.ai_config`。

#### PUT `/api/ai/config`
保存到 `settings.ai_config`（旧式配置）。用于订单导入等功能。

#### POST `/api/ai/test-config`（v1.3.0 新增）
测试 `settings.ai_config` 连接性。直接发最小请求验证 API Key 可用性。
> 用于系统设置页的「测试连接」按钮。

#### POST `/api/ai/chat`
AI Chat 代理（走 `ai_channels` 渠道表，支持负载均衡+失败重试）。
- 超时：120秒
- 自动选择最优渠道（优先级排序）
- 更新渠道统计（成功/失败/延迟）

#### POST `/api/ai/chat/stream`
流式 AI 对话（SSE，使用第一个可用默认渠道）。

**双轨制对比：**

| 功能 | 数据来源 | 用途 |
|------|---------|------|
| 系统设置「测试连接」 | `settings.ai_config` | 验证旧配置可用性 |
| 订单 AI 导入 | `settings.ai_config` | 表头识别 |
| AI 智创/对话 | `ai_channels` 表 | 多模型负载均衡 |
| Seedance 视频生成 | `ai_channels` 表 | 高级 AI 能力 |

### 3.10 AI 渠道管理 — `/api/channels`（v1.3.0 新增）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai-channels` | 所有渠道列表 |
| GET | `/api/ai-channels/enabled` | 启用的渠道列表 |
| GET | `/api/ai-channels/default` | 默认渠道 |
| GET | `/api/ai-channels/:id` | 单个渠道详情 |
| POST | `/api/ai-channels` | 添加渠道 |
| PUT | `/api/ai-channels/:id` | 更新渠道 |
| DELETE | `/api/ai-channels/:id` | 删除渠道 |
| POST | `/api/ai-channels/:id/test` | 测试单个渠道连接 |
| POST | `/api/ai-channels/:id/set-default` | 设为默认渠道 |
| GET | `/api/ai-channels/config/providers` | 支持的提供商列表 |

**渠道筛选条件（"可用"）**：
- `status = 'enabled'`
- `api_key != ''`
- `api_base != ''`

### 3.11 仪表盘模块 — `/api/dashboard`（v1.3.0 新增）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard/stats` | 全局汇总统计卡片（营收/利润/订单/产品数）|
| GET | `/api/dashboard/trend?days=N` | 订单趋势折线图数据 |
| GET | `/api/dashboard/profit-trend?days=N` | 利润趋势折线图数据 |
| GET | `/api/dashboard/top-products?limit=N` | Top N 热销产品排行 |

### 3.12 Seedance 视频生成 — `/api/seedance`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/seedance/generate` | 提交视频生成任务 |
| GET | `/api/seedance/task/:taskId` | 查询任务状态 |
| GET | `/api/seedance/result/:taskId` | 获取生成结果 |

### 3.13 视频模型管理 — `/api/video-models`（v1.3.0 拆分）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/video-models/configs` | 模型配置列表 |
| POST | `/api/video-models/configs` | 创建模型配置 |
| PUT | `/api/video-models/configs/:id` | 更新模型配置 |
| DELETE | `/api/video-models/configs/:id` | 删除模型配置 |

### 3.14 系统设置模块 — `/api/settings`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings/` | 获取所有设置 |
| PUT | `/api/settings/` | 更新设置 |
| GET | `/api/settings/backup/list` | 备份文件列表 |
| POST | `/api/settings/backup/trigger` | 手动触发备份 |
| GET | `/api/settings/backup/download/:filename` | 下载备份文件 |

---

## 4. 公式引擎

### 4.1 设计原理

公式引擎允许用户自定义利润计算公式，支持嵌套引用和循环检测。

**v1.3.0 变更**：移除单条记录的 `custom_cost_formulas`，统一使用 `cost_items.formula` 全局公式。

### 4.2 计算流程

```
1. 构建基础上下文
   ctx = { 售价: record.sell_price, 采购成本: record.cost_price,
           产品重量: record.weight, MYR兑RMB汇率: 当前汇率 }

2. 遍历每个活跃成本项
   - 百分比项：val = sellPrice × (rawVal / 100)
   - MYR 项：val × exchangeRate → RMB
   - RMB 项：直接使用
   - 有公式的项：evaluateFormula(formula, ctx) 替代原始值
   → 每个成本项名称作为变量加入 ctx

3. ctx['MYR成本合计RMB'] = MYR 成本总和
4. ctx['MYR兑RMB汇率'] = 当前汇率

5. 按 sort_order 顺序逐个计算公式
   - 替换表达式中变量名为数值
   - new Function("use strict"; return (expr))() 安全求值
   - 结果四舍五入 2 位小数
   - 作为新变量加入 ctx
```

### 4.3 默认公式

| 顺序 | 名称 | 表达式 | 格式 |
|------|------|--------|------|
| 1 | 毛利率 | (售价 - 采购成本) / 售价 * 100 | percentage |
| 2 | 保本ROI | 采购成本 / (售价 - 采购成本) * 100 | percentage |
| 3 | 总投入 | 采购成本 + MYR成本合计RMB | number |
| 4 | 净利润 | 售价 - 总投入 | number |
| 5 | 整体ROI | 净利润 / 总投入 * 100 | percentage |

### 4.4 安全校验

**循环检测**：提取 token → 排除纯数字/基础变量 → 检查引用依赖是否合法（sort_order < 当前）。

**表达式安全**：仅允许数字、空格、运算符 `+-*/()`、小数点 `%`；`new Function` 以 `"use strict"` 执行。

---

## 5. 前端架构

### 5.1 路由结构

```
/login               → Login.tsx（公开）
/dashboard           → Dashboard.tsx（v1.3.0 新增，仪表盘首页）
/ai-analysis         → AIAnalysis.tsx（需认证）
/products            → Products.tsx（需认证）
/product/:id         → ProductDetail.tsx（需认证）
/shops               → ShopManagement.tsx（需认证）
/orders              → OrderManagement.tsx（需认证）
/finance             → Finance.tsx（需认证）
/influencers         → Influencers.tsx（需认证）
/settings            → Settings.tsx（需认证）
/permissions         → UserPermissions.tsx（需认证）
/seedance-model      → SeedanceModelConfig.tsx（需认证）
/seedance-video      → SeedanceVideoGenerator.tsx（需认证）
/video-models        → VideoModelConfig.tsx（需认证）
/materials           → MaterialLibrary.tsx（需认证）
/raw-materials       → RawMaterials.tsx（需认证）
*                    → Navigate to /dashboard（v1.3.0 变更：默认首页改为仪表盘）
```

### 5.2 布局结构

```
┌─────────────────────────────────────────────────────┐
│  🦞 虾掌柜 v1.3.0        用户名(角色名) [退出]     │  ← Header
├──────────┬──────────────────────────────────────────┤
│ 📊 仪表盘 │                                          │
│ 🤖 AI分析  │         Content Area                     │
│ 🏪 店铺管理 │         (浅灰背景 #f5f5f5)              │
│ 📦 产品管理 │         (白色卡片内容)                   │
│ 📋 订单管理 │                                          │
│ 💰 利润核算 │                                          │
│ 🤝 达人BD  │                                          │
│ 系统设置 ▼ │                                          │
│  ├ 系统配置 │                                          │
│  └ 用户与权限│                                         │
└──────────┴──────────────────────────────────────────┘
```

### 5.3 动态菜单与 RBAC

同 v1.2.0。开发者 bypass 所有权限检查，其他用户根据 `permissions` map 过滤菜单和路由。

### 5.4 Zustand Stores

#### authStore
```typescript
interface AuthState {
  token: string | null;
  username: string | null;
  permissions: Record<string, string>;  // { moduleKey: 'read' | 'edit' }
  roleName: string | null;
  roleKey: RoleKey;                    // 'developer' | 'manager' | 'staff'
  // ... actions
}
```

#### financeStore
关键方法：
- `syncProducts()` → `POST /api/finance/records/sync-products`（同步产品）
- `recalculate()` → `POST /api/finance/records/recalculate`（重算）
- `batchApplyFormulas(formulas)` → 批量应用全局公式

> v1.3.0 移除了 `updateRecord` 中对 `custom_cost_formulas` 的处理。

### 5.5 页面功能清单

#### Dashboard.tsx（v1.3.0 新增）
- **4 个统计卡片**：期间总营收(MYR)、期间总利润(RMB)、订单总数、活跃产品数
- **订单趋势图**：ECharts 折线图，GMV + 订单数双轴
- **利润概览**：净利润 + ROI 趋势
- **Top 10 热销产品**：排行榜表格

#### Finance.tsx（v1.3.0 重要变更）
- **全局公式模式**：弹窗统一为「配置成本公式」，不再支持单条记录单独编辑
- **展开行成本明细**：有公式的成本项实时调用 `evaluateFormulaFrontend()` 计算结果展示
- **操作列简化**：只保留「删除」按钮，移除「编辑」
- **利润趋势 Tab**：ECharts 展示净利润(RMB)+ROI 双轴（ROI 为数字格式非百分比）
- **统计卡**：期间总营收、期间总利润、日均利润（已移除平均 ROI）

#### OrderManagement.tsx
- 状态 Tab 栏（9 种状态）
- AI 智能导入向导（三步：上传→预览→确认）
- 错误提示增强（8秒长显示 + 控制台详细日志）

#### Settings.tsx（v1.3.0 变更）
- **AI 配置区域**：「测试连接」调用 `/api/ai/test-config`（读 settings.ai_config），与 AI 渠道系统完全独立
- 账号管理（创建/修改密码/删除）
- 数据备份

---

## 6. 认证与权限体系

### 6.1 认证流程

```
POST /api/auth/login
  ↓ （限流：5次失败/15分钟锁定）
bcrypt 验证密码
  ↓
查询 users + roles 获取权限
  ↓
JWT sign({ userId, username, roleKey })
  ↓
localStorage 存储
  ↓
后续请求 Bearer <token>
  ↓
JWT verify + 审计日志记录
```

### 6.2 权限模型

同 v1.2.0 三层角色体系：developer > manager > staff。

### 6.3 JWT 配置（v1.3.0 变更）

| 配置项 | 值 |
|--------|-----|
| JWT_SECRET | 从 `server/.env` 读取，首次启动随机生成 UUID 存入 settings 表 |
| Token 有效期 | 7 天 |
| 密码哈希 | bcrypt（salt rounds = 10）|
| Payload | `{ userId, username, roleKey }` |

---

## 7. 业务流程

### 7.1 产品管理流程

同 v1.2.0（创建店铺→供应商→产品→多SKU→导入导出）。

### 7.2 订单管理流程

同 v1.2.0（TikTok导出Excel → AI智能导入 → SKU匹配 → 库存联动 → 仪表盘查看）。

### 7.3 利润核算流程（v1.3.0 变更）

```
1. 从产品管理同步产品到核算记录
   POST /api/finance/records/sync-products

2. 在系统设置中配置成本公式（全局统一）
   → 打开 Finance.tsx 「配置成本公式」弹窗
   → 编辑每个成本项的公式
   → 点击「应用全局」（批量应用到所有记录）

3. 查看核算结果
   → 表格每行显示：售价/采购成本/净利润/总投入/ROI
   → 展开行显示成本明细（有公式的项实时计算展示）

4. 汇总导出
   → 利润趋势图（ECharts）
   → Excel 导出
```

**关键变更**：不再支持单条记录的 `custom_cost_formulas` 单独配置，全部统一为全局公式。

### 7.4 AI 双轨制架构（v1.3.0 新增）

```
┌──────────────────────────────────────────────┐
│           settings.ai_config（旧轨道）          │
│                                              │
│  存储位置：settings 表 key='ai_config'        │
│  适用功能：                                   │
│  ✅ 订单 AI 导入（orders-import.ts 直接读取）  │
│  ✅ 系统设置「测试连接」（test-config 接口）    │
│  ✅ GET /api/ai/config（回退来源）             │
│                                              │
│  UI 入口：Settings.tsx → AI 配置区域          │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│          ai_channels 表（新轨道）              │
│                                              │
│  存储位置：ai_channels 表（多行多渠道）        │
│  适用功能：                                   │
│  ✅ AI 智创对话（/api/ai/chat）              │
│  ✅ 流式对话（/api/ai/chat/stream）          │
│  ✅ Seedance 视频生成                        │
│  ✅ 负载均衡 + 失败重试                       │
│  ✅ 渠道统计（延迟/成功率/错误追踪）            │
│                                              │
│  UI 入口：（待开发 AI 渠道管理页面）            │
└──────────────────────────────────────────────┘
```

---

## 8. 部署指南

### 8.1 环境要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10/11 |
| Node.js | >= 18（推荐 22.x）|
| npm | 随 Node.js 安装 |

### 8.2 快速部署

```bash
cd E:\tiktok-crm
cd server && npm install && cd ..
cd client && npm install && cd ..
npm run dev
# 或双击 start.bat 静默后台启动
```

### 8.3 环境变量（v1.3.0 新增）

创建 `server/.env` 文件：

```env
# JWT 密钥（首次启动若不设置会随机生成并存入数据库）
JWT_SECRET=your-random-secret-here
```

`.env` 已添加至 `.gitignore`，不会提交到代码仓库。

### 8.4 访问地址

| 服务 | 地址 |
|------|------|
| 前端（开发）| http://localhost:5173 |
| 后端 API | http://localhost:3000/api |
| 生产（统一入口）| http://localhost:3000 |

---

## 9. 关键实现文件索引

### 后端核心文件

| 文件 | 路径 | 说明 |
|------|------|------|
| 入口 | `server/src/index.ts` | Express app，16 个路由挂载，中间件链 |
| 数据库 | `server/src/db.ts` | 建表/迁移/种子（含 RBAC + ai_channels 初始化）|
| JWT+审计 | `server/src/middleware/auth.ts` | 认证 + 审计日志 + 登录限流 |
| 认证 | `server/src/routes/auth.ts` | 登录/Register/用户CRUD |
| 产品 | `server/src/routes/products.ts` | 产品/供应商/店铺 |
| **利润核算** | **`server/src/routes/finance/`** | **v1.3.0 拆分为 9 个子文件** |
| ├ 入口 | `finance/index.ts` | 子路由注册 |
| ├ 记录 | `finance/records.ts` | 记录CRUD + 同步 + 重算 |
| ├ 成本 | `finance/costs.ts` | 成本项 CRUD |
| ├ 公式 | `finance/formulas.ts` | 公式引擎（循环检测+求值）|
| ├ 计算 | `finance/calc.ts` | 单条利润计算 |
| ├ 汇率 | `finance/exchange.ts` | 汇率读写 |
| ├ 趋势 | `finance/trend.ts` | 日级趋势聚合 |
| ├ 订单利润 | `finance/order-profit.ts` | 订单维度利润 |
| └ 共享 | `finance/shared.ts` | 工具函数 |
| 达人 | `server/src/routes/influencers.ts` | 达人/跟进/绑定 |
| 订单 | `server/src/routes/orders.ts` | 订单CRUD + 状态计数 |
| AI 导入 | `server/src/routes/orders-import.ts` | AI 解析 + commit |
| AI 代理 | `server/src/routes/ai.ts` | 双轨制：config + chat(stream) + test-config |
| AI 渠道 | `server/src/routes/ai-channels.ts` | 多渠道 CRUD + 测试 + 设默认 |
| 店铺 | `server/src/routes/shops.ts` | 店铺 + 仪表盘统计 |
| 仪表盘 | `server/src/routes/dashboard.ts` | 全局首页数据 |
| Seedance | `server/src/routes/seedance.ts` | 视频生成任务 |
| 视频模型 | `server/src/routes/video-models/` | v1.3.0 拆分为 6 个子文件 |
| 设置 | `server/src/routes/settings.ts` | 系统设置 + 备份 |
| 备份 | `server/src/utils/backup.ts` | 定时备份（每日自动）|

### 前端核心文件

| 文件 | 路径 | 说明 |
|------|------|------|
| 入口 | `client/src/main.tsx` | React 挂载 |
| 布局 | `client/src/App.tsx` | 路由 + 侧边栏 + RBAC |
| API 层 | `client/src/api/index.ts` | Axios 实例 |
| 认证 | `client/src/stores/authStore.ts` | Zustand + RBAC |
| AI 状态 | `client/src/stores/aiStore.ts` | AI 配置 |
| 核算 | `client/src/stores/financeStore.ts` | 核算/公式/汇率 |
| 仪表盘 | `client/src/pages/Dashboard.tsx` | **v1.3.0 新增** |
| 利润核算 | `client/src/pages/Finance.tsx` | 全局公式模式（53KB，最复杂页面）|
| 订单管理 | `client/src/pages/OrderManagement.tsx` | 订单列表 + AI 导入向导 |
| 系统设置 | `client/src/pages/Settings.tsx` | AI 配置(test-config) + 备份 |
| 视频生成 | `client/src/pages/SeedanceVideoGenerator.tsx` | Seedance（73KB，最大文件）|

---

## 10. v1.3.0 变更日志

### 已完成的优化（11 项）

| # | 优化项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | JWT Secret 安全化 | ✅ | 首次启动随机生成 UUID 存入 `.env` + settings 表 |
| 2 | 登录限流 | ✅ | `/api/auth/login` 5 次/15 分钟锁定 |
| 3 | 预置账号安全 | ✅ | admin 随机密码+首次强制改密 |
| 4 | SQLite 优化 | ✅ | 加索引 + 查询优化（暂不迁移）|
| 5 | .env 环境变量 | ✅ | `server/.env` + `.gitignore` |
| 6 | 审计日志 | ✅ | 全量记录 API 操作，30 天自动清理 |
| 9 | 利润增强 | ✅ | 利润趋势图（ECharts 日级净利润+ROI 曲线）|
| 12 | 前端组件化 | ✅ | 提取 DataTable/SearchBar/ExportButton 等公共组件 |
| 13 | 后端拆分 | ✅ | finance/、video-models/ 大文件拆分子目录 |
| 15 | 仪表盘首页 | ✅ | 4 卡片 + 趋势图 + Top10 热销 |
| 16 | 多货币汇率 | ✅ | 可扩展 JSON 格式（不限于 MYR）|

### 本轮修复的 Bug

| 问题 | 修复方案 |
|------|---------|
| `/api/finance/sync-products` 404 | 路径缺少 `/records` 层级，已修正 |
| `/api/finance/recalculate` 404 | 同上 |
| 跨境运费显示为 0 | 展开行增加 `evaluateFormulaFrontend()` 实时计算 |
| ROI 显示为百分比 | ECharts 图例/Y轴/系列名均去掉 `%` |
| 单独配置规则混乱 | 移除 `custom_cost_formulas`，统一全局公式 |
| AI 订单导入 500 崩溃 | `readSheet` 返回 `result.rows`，调用方误读 `dataRows` |
| AI 导入超时 | 超时 30s → 120s + Prompt 精简 60% |
| AI 配置测试连接失效 | 新增 `/api/ai/test-config` 端点（读旧配置，与渠道系统解耦）|

### 跳过的优化（8 项）

7. 订单增强、8. 产品增强、10. 达人 BD 增强、11. AI 智创增强、14. 测试、17. PWA、18. 消息通知、19. 数据导出 — 暂不需要。
