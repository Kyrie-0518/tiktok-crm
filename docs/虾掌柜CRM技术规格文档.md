# 虾掌柜 CRM 系统技术规格文档

> **版本**: v1.2.0
> **定位**: TikTok 跨境电商 ERP 系统，面向马来西亚 TikTok Shop 卖家
> **品牌名**: 虾掌柜
> **默认账号**: admin / admin123
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
| Excel 导出 | xlsx (SheetJS) | ^0.18.5 |
| Excel 导入 | xlsx / multer | ^0.18.5 / ^4.5.0 |
| 认证 | JWT (jsonwebtoken) | ^9.0.2 |
| 密码加密 | bcryptjs | ^2.4.3 |

### 1.2 项目目录结构

```
E:\tiktok-crm\
├── server/                          # 后端（Express + SQLite）
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # 入口：Express app，端口 3000
│   │   ├── db.ts                    # SQLite 初始化、建表、迁移、种子数据
│   │   ├── middleware/
│   │   │   └── auth.ts              # JWT 认证中间件
│   │   ├── routes/
│   │   │   ├── auth.ts              # 认证路由（含 RBAC 登录、/me）
│   │   │   ├── products.ts          # 产品/供应商/店铺路由
│   │   │   ├── finance.ts           # 利润核算/公式引擎路由
│   │   │   ├── influencers.ts       # 达人BD路由
│   │   │   ├── settings.ts          # 系统设置/备份路由
│   │   │   ├── ai.ts                # AI 配置与 Chat 代理路由
│   │   │   ├── shops.ts             # TikTok 店铺管理与仪表盘统计路由
│   │   │   ├── orders.ts            # 订单管理路由（CRUD + 状态计数）
│   │   │   └── orders-import.ts     # AI 智能导入订单路由
│   │   └── utils/
│   │       └── backup.ts            # 数据库自动备份工具
│   └── data/
│       ├── erp.db                   # SQLite 数据库文件
│       ├── uploads/                 # 产品图片上传目录
│       ├── tmp/                     # AI 导入临时文件目录
│       └── 虾掌柜_数据备份/          # 数据库备份目录
│
├── client/                          # 前端（React + Vite）
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts               # 代理 /api → localhost:3000
│   ├── index.html
│   └── src/
│       ├── main.tsx                 # React 入口
│       ├── App.tsx                  # 路由 + 布局 + RBAC 权限控制 + 动态菜单
│       ├── api/
│       │   └── index.ts             # Axios 实例，请求/响应拦截器
│       ├── stores/
│       │   ├── authStore.ts         # 认证状态 + RBAC 角色/权限 + localStorage 持久化
│       │   ├── productStore.ts      # 产品/供应商/店铺状态
│       │   ├── financeStore.ts      # 核算/公式/汇率状态
│       │   ├── influencerStore.ts   # 达人/跟进记录状态
│       │   └── aiStore.ts           # AI 配置状态
│       └── pages/
│           ├── Login.tsx            # 登录页
│           ├── Products.tsx         # 产品管理页
│           ├── Finance.tsx          # 利润核算页
│           ├── Influencers.tsx      # 达人BD页（增强版：样品寄送/素材管理）
│           ├── Settings.tsx         # 系统设置页（AI 配置、账号管理、备份）
│           ├── AIAnalysis.tsx       # AI 智能分析页（问答/报表解读/自动处理）
│           ├── ShopManagement.tsx   # 店铺管理页（含仪表盘统计和 ECharts 图表）
│           ├── OrderManagement.tsx  # 订单管理页（状态 tabs + AI 导入向导）
│           ├── UserPermissions.tsx  # 用户与权限管理页（角色配置）
│           └── ProductDetail.tsx    # 产品详情页
│
├── data/                            # 共享数据目录
│   └── uploads/                     # 图片上传（前端）
│
├── _run_hidden.vbs                  # VBS 隐藏窗口脚本（后台启动依赖）
├── start.bat                        # 一键启动前后端（静默）
├── stop.bat                         # 一键停止所有服务
├── restart.bat                      # 一键重启前后端
├── start-backend.bat                # 单独启动后端
├── stop-backend.bat                 # 单独停止后端
├── restart-backend.bat              # 单独重启后端
├── start-frontend.bat               # 单独启动前端
├── stop-frontend.bat               # 单独停止前端
└── restart-frontend.bat            # 单独重启前端
```

### 1.3 品牌设计

| 属性 | 值 |
|------|-----|
| 品牌名 | 虾掌柜 |
| 品牌色 | #2563eb（商务蓝） |
| Logo | 🦞 虾掌柜 |
| 登录副标题 | 你的小龙虾生意管家 |
| 侧边栏 | 200px 宽，选中项蓝色文字 + 左侧竖线标记 |
| 内容区 | 浅灰背景 #f5f5f5 + 白色卡片 |
| 系统版本 | v1.2.0 |

---

## 2. 数据库设计

### 2.1 数据库配置

- 引擎：SQLite（WAL 模式）
- 外键约束：启用
- 数据文件：`E:\tiktok-crm\server\data\erp.db`
- 迁移策略：每次启动自动检测缺失表/列，执行 ALTER TABLE 增量迁移

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
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### roles — 角色表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 角色 ID |
| name | TEXT | UNIQUE NOT NULL | 角色名称 |
| role_key | TEXT | UNIQUE | 角色键值（developer/manager/staff） |
| description | TEXT | DEFAULT '' | 角色描述 |
| permissions | TEXT | DEFAULT '{}' | 权限 JSON {模块键: 'read'|'edit'} |
| sort_order | INTEGER | DEFAULT 0 | 排序（数字越小权限越高） |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

**预置角色（id=1 开发者 > id=2 管理员 > id=3 员工）：**

| ID | 名称 | role_key | 描述 | 权限示例 |
|----|------|----------|------|----------|
| 1 | 开发者 | developer | 系统最高权限 | 所有模块 edit |
| 2 | 管理员(领导) | manager | 业务管理员 | AI edit，其他 edit，user-mgmt read |
| 3 | 普通员工 | staff | 普通员工 | 所有模块 read（不可编辑） |

#### suppliers — 供应商表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 供应商 ID |
| name | TEXT | NOT NULL | 供应商名称 |
| contact | TEXT | NOT NULL | 联系方式 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### tiktok_shops — TikTok 店铺表（v1.2.0 新增）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 店铺 ID |
| name | TEXT | NOT NULL | 店铺名称（如 "Freshguard15"） |
| region | TEXT | DEFAULT 'MY' | 地区（MY/SG/TH/PH/ID/VN/GB/US） |
| shop_id | TEXT | DEFAULT '' | TikTok 店铺后台 ID |
| status | TEXT | DEFAULT 'active' | 状态：active/inactive/pending |
| last_synced_at | DATETIME | | 最后同步时间 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### products — 产品表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 产品 ID |
| sku | TEXT | DEFAULT '' | SKU 编码（非 UNIQUE，支持多 SKU） |
| name | TEXT | NOT NULL | 产品名称 |
| image | TEXT | DEFAULT '' | 图片（base64） |
| weight | REAL | DEFAULT 0 | 重量 |
| stock | INTEGER | DEFAULT 0 | 库存 |
| sell_price | REAL | DEFAULT 0 | 售价 |
| cost_price | REAL | DEFAULT 0 | 采购成本 |
| supplier_id | INTEGER | FK→suppliers(id) | 供应商 |
| box_qty | INTEGER | DEFAULT 0 | 箱规数量 |
| box_length | REAL | DEFAULT 0 | 箱长 cm |
| box_width | REAL | DEFAULT 0 | 箱宽 cm |
| box_height | REAL | DEFAULT 0 | 箱高 cm |
| box_remark | TEXT | DEFAULT '' | 箱规备注 |
| commission | REAL | DEFAULT 0 | 佣金 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### product_skus — 产品 SKU 表（多 SKU 支持，v1.2.0 新增）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | SKU ID |
| product_id | INTEGER | FK→products(id) CASCADE | 产品 ID |
| sku_code | TEXT | DEFAULT '' | SKU 编码（TikTok Seller SKU） |
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

#### product_specs — 产品规格/批次表（遗留）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 规格 ID |
| product_id | INTEGER | FK→products(id) CASCADE | 产品 ID |
| spec_name | TEXT | NOT NULL | 规格名称 |
| batch_no | TEXT | DEFAULT '' | 批次号 |
| cost_price | REAL | DEFAULT 0 | 规格成本价 |
| stock | INTEGER | DEFAULT 0 | 规格库存 |

#### cost_items — 成本项表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 成本项 ID |
| name | TEXT | UNIQUE NOT NULL | 成本项名称 |
| currency | TEXT | DEFAULT 'RMB' | 币种：RMB 或 MYR |
| is_fixed | INTEGER | DEFAULT 0 | 是否固定（固定不可删除） |
| is_active | INTEGER | DEFAULT 1 | 是否启用（软删除） |
| value_format | TEXT | DEFAULT 'number' | 值格式：number 或 percentage |
| formula | TEXT | DEFAULT '' | 自定义计算公式 |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

**预置固定成本项（马来西亚 TikTok Shop 场景）：**

| 名称 | 币种 |
|------|------|
| 订单操作RMB | RMB |
| 佣金费MYR | MYR |
| 平台支持费MYR | MYR |
| SST税费MYR | MYR |
| 交易手续费MYR | MYR |
| BXP项目费MYR | MYR |
| 达人佣金MYR | MYR |

#### financial_records — 核算记录表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO | 记录 ID |
| product_id | INTEGER | FK→products(id) CASCADE | 产品 ID |
| cost_detail | TEXT | DEFAULT '{}' | 成本明细 JSON：{costItemId: rawValue} |
| custom_cost_formulas | TEXT | DEFAULT '{}' | 自定义成本公式 |
| net_profit | REAL | DEFAULT 0 | 净利润（冗余缓存） |
| total_investment | REAL | DEFAULT 0 | 总投入（冗余缓存） |
| roi | REAL | DEFAULT 0 | 整体ROI（冗余缓存） |
| created_at | DATETIME | DEFAULT NOW | 创建时间 |

#### influencers — 达人表（增强版，v1.2.0 新增大量字段）

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
| name | TEXT | NOT NULL DEFAULT '' | 达人名称（兼容旧字段） |
| contact | TEXT | NOT NULL DEFAULT '' | 联系方式（兼容旧字段） |
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

#### orders — 订单表（v1.2.0 新增）

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

#### order_items — 订单商品明细表（v1.2.0 新增）

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

#### order_import_logs — AI 导入日志表（v1.2.0 新增）

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

#### settings — 系统设置表（Key-Value）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| key | TEXT | PK | 设置键名 |
| value | TEXT | DEFAULT '{}' | 设置值（JSON 字符串） |

**内置键：**

| key | 说明 |
|-----|------|
| exchange_rate | MYR/RMB 汇率，默认 1.55 |
| finance_formulas | 利润公式配置，JSON 数组 |
| ai_config | AI 配置（api_key / api_base / model），JSON 对象 |
| 店铺列表等 | 其他自定义配置 |

---

## 3. 后端 API 文档

### 3.1 通用规范

- 基础路径：`http://localhost:3000/api`
- 认证方式：Bearer Token（JWT，7天有效）
- 请求头：`Authorization: Bearer <token>`
- Content-Type：`application/json`
- 响应格式：JSON 对象或数组
- 错误响应：`{ error: "错误信息" }`
- 文件上传：multipart/form-data（multer）

### 3.2 认证模块 — `/api/auth`

#### POST `/api/auth/login`
登录获取 JWT Token（响应包含角色和权限信息）。

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

**响应**：同登录响应结构。

#### POST `/api/auth/register`
注册新用户（需 manager 及以上权限）。

**请求体**：`{ "username": "newuser", "password": "pass123", "role_id": 3 }`

#### GET `/api/auth/users`
获取所有用户列表（需认证）。

**响应**：
```json
[{ "id": 1, "username": "admin", "display_name": "管理员", "role_id": 2, "created_at": "..." }]
```

#### DELETE `/api/auth/users/:id`
删除用户（需 manager 及以上，不可删除自己）。

#### PUT `/api/auth/password`
修改当前用户密码。

**请求体**：`{ "oldPassword": "admin123", "newPassword": "newpass" }`

### 3.3 产品模块 — `/api/products`

#### 产品 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/products/` | 获取产品列表（含 product_skus 关联，支持 keyword/shop_name 筛选） |
| GET | `/api/products/:id` | 获取单个产品详情（含规格和店铺价格） |
| POST | `/api/products/` | 创建产品（含 specs 数组和 shops 数组） |
| PUT | `/api/products/:id` | 更新产品 |
| DELETE | `/api/products/:id` | 删除产品（级联删除 specs、product_shops、product_skus） |

#### 供应商 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/products/suppliers` | 获取供应商列表 |
| POST | `/api/products/suppliers` | 创建供应商 |
| PUT | `/api/products/suppliers/:id` | 更新供应商 |
| DELETE | `/api/products/suppliers/:id` | 删除供应商 |

#### 店铺 API（遗留）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/products/shops` | 获取店铺列表 |
| POST | `/api/products/shops` | 创建店铺 |
| PUT | `/api/products/shops/:id` | 更新店铺 |
| DELETE | `/api/products/shops/:id` | 删除店铺 |
| GET | `/api/products/shop-filter-list` | 获取店铺名称列表 |

#### 导入导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/products/import` | 批量导入产品（Excel） |
| GET | `/api/products/export` | 导出所有产品（Excel） |
| POST | `/api/products/upload-image` | 上传产品图片 |

### 3.4 TikTok 店铺管理模块 — `/api/shops`

> 这是与旧的 `/api/products/shops` 不同的独立店铺管理模块，基于 `tiktok_shops` 表。

#### 店铺 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/shops/` | 获取所有 TikTok 店铺列表 |
| POST | `/api/shops/` | 创建店铺 `{ name, region, shop_id }` |
| PUT | `/api/shops/:id` | 更新店铺（支持 status 停用/启用） |
| DELETE | `/api/shops/:id` | 删除店铺 |
| POST | `/api/shops/:id/sync` | 手动同步（更新 last_synced_at） |

#### 仪表盘统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/shops/stats` | 聚合统计（含今日实时数据、状态计数、趋势数据） |

**GET `/api/shops/stats` 查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| shop_id | number | 按店铺筛选 |
| date_from | string | 开始日期 YYYY-MM-DD（默认近30天） |
| date_to | string | 结束日期 YYYY-MM-DD |

**响应**：
```json
{
  "today": { "gmv": 1234.56, "order_count": 45, "avg_order_value": 27.43 },
  "pending_ship": 12,
  "cancel_requested": 3,
  "refund_requested": 2,
  "auto_cancelled": 5,
  "total_orders": 1500,
  "filtered": { "date_from": "...", "date_to": "...", "gmv": 50000, "order_count": 500, ... },
  "trend": [{ "time_point": "2026-05-15", "gmv": 2000, "order_count": 50, ... }],
  "legacy_trend": [{ "day": "2026-05-15", "gmv": 2000, "orders": 50 }]
}
```

### 3.5 订单管理模块 — `/api/orders`

#### 订单 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/orders/` | 获取订单列表（分页，支持 status/shop_id/keyword 筛选） |
| GET | `/api/orders/:id` | 获取订单详情（含 items 明细和商品图片智能回填） |
| POST | `/api/orders/` | 创建订单（自动关联达人佣金率） |
| PUT | `/api/orders/:id` | 更新订单（取消/退款时自动回补库存） |
| DELETE | `/api/orders/:id` | 删除订单 |

#### 订单元数据

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/orders/meta/counts` | 获取各状态订单数量（用于 Tab 徽章） |
| GET | `/api/orders/ids` | 按条件批量获取订单 ID |
| DELETE | `/api/orders/batch` | 按条件批量删除订单 |

**GET `/api/orders/` 查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| status | string | - | 订单状态（all/pending/pending_ship/...） |
| shop_id | number | - | 店铺 ID |
| keyword | string | - | 订单号/买家名搜索 |
| page | number | 1 | 页码 |
| page_size | number | 20 | 每页数量 |

**商品图片智能回填逻辑**：
1. 按 `order_items.product_sku_id` → `product_skus.image` 直接匹配
2. 按 `order_items.sku` → `product_skus.sku_code` 匹配
3. 按 `order_items.spec_name` → `product_skus.sku_code` 匹配（含模糊匹配）
4. 按 `order_items.product_name` → `products.name` 匹配

### 3.6 AI 智能订单导入 — `/api/orders/ai-import`

#### POST `/api/orders/ai-import/parse`
上传 TikTok 导出的 Excel/CSV 文件，AI 自动识别字段映射，返回预览。

**请求**：multipart/form-data，字段 `file`（xlsx 或 csv，最大 20MB）

**TikTok 状态自动映射**（支持中英文混合）：
- unpaid/awaiting payment → pending
- to ship/awaiting shipment → pending_ship
- shipped/in transit → shipped
- delivered/completed → completed
- cancelled/canceled → cancelled
- cancel requested → cancel_requested
- refund requested → refund_requested
- refunded → refunded
- auto cancelled/auto canceled → auto_cancelled

**响应**：
```json
{
  "total_orders": 150,
  "preview": [{ "order_no": "...", "status": "pending_ship", "actual_amount": 29.9, ... }],
  "headers": ["Order ID", "Created Time", ...],
  "mapping": { "Order ID": "order_no", "Product Name": "product_name", ... },
  "errors": [{ "row": 5, "reason": "订单号为空，已跳过" }],
  "orders": [...]  // 完整订单数据供 commit 使用
}
```

#### POST `/api/orders/ai-import/commit`
确认导入，写入数据库（支持增量更新和库存联动）。

**请求体**：
```json
{
  "orders": [...],  // parse 返回的完整订单数据
  "shop_id": 1       // 导入到指定店铺
}
```

**特性**：
- 自动去重（按 order_no）
- 已存在订单执行覆盖更新（更新状态/金额/物流）
- 自动匹配产品 SKU（多级匹配：sku_code → product_name+spec_name → sku → name）
- 新增订单自动扣减 SKU 库存
- 取消/退款订单自动回补库存
- 记录导入日志

#### GET `/api/orders/ai-import/logs`
查询最近 50 条导入历史。

### 3.7 利润核算模块 — `/api/finance`

#### 成本项 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/finance/cost-items` | 获取活跃成本项列表 |
| POST | `/api/finance/cost-items` | 创建成本项 |
| PUT | `/api/finance/cost-items/:id` | 更新成本项（固定项不可改名/删除） |
| DELETE | `/api/finance/cost-items/:id` | 删除成本项（固定项不可删除） |

#### 公式 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/finance/formulas` | 获取公式配置 |
| PUT | `/api/finance/formulas` | 更新公式（含循环检测校验） |

#### 汇率 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/finance/exchange-rate` | 获取 MYR/RMB 汇率 |
| PUT | `/api/finance/exchange-rate` | 更新汇率 |

#### 核算记录 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/finance/records` | 获取核算记录（支持 product_id 筛选） |
| POST | `/api/finance/records` | 创建核算记录（自动计算） |
| PUT | `/api/finance/records/:id` | 更新核算记录 |
| DELETE | `/api/finance/records/:id` | 删除核算记录 |

#### 计算 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/finance/recalculate` | 重算所有记录（汇率/公式变更后触发） |
| POST | `/api/finance/sync-products` | 从产品管理同步产品到核算记录 |
| GET | `/api/finance/summary` | 获取汇总（总收入/总利润/总投入/整体ROI） |
| GET | `/api/finance/records/export` | 导出核算数据（含公式配置） |

### 3.8 达人模块 — `/api/influencers`

#### 达人 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/influencers/` | 获取达人列表（支持 keyword 搜索） |
| POST | `/api/influencers/` | 创建达人（含样品/素材等新字段） |
| PUT | `/api/influencers/:id` | 更新达人 |
| DELETE | `/api/influencers/:id` | 删除达人 |

#### 跟进记录 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/influencers/:id/records` | 获取跟进记录 |
| POST | `/api/influencers/:id/records` | 创建跟进记录 |
| PUT | `/api/influencers/:infId/records/:id` | 更新跟进记录 |
| DELETE | `/api/influencers/:infId/records/:id` | 删除跟进记录 |

#### 产品绑定与统计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/influencers/:id/bind` | 绑定产品到达人 |
| GET | `/api/influencers/:id/stats` | 获取达人统计数据 |

### 3.9 AI 模块 — `/api/ai`

#### GET `/api/ai/config`
获取 AI 配置（从数据库读取，屏蔽 api_key 返回）。

#### PUT `/api/ai/config`
保存 AI 配置（需 manager 及以上权限）。

**请求体**：`{ "api_key": "...", "api_base": "https://api.deepseek.com/v1", "model": "deepseek-chat" }`

#### POST `/api/ai/chat`
AI Chat 代理（解决浏览器 CORS 问题，自动超时 60 秒）。

**请求体**：`{ "messages": [{ "role": "user", "content": "..." }], "max_tokens": 2000 }`

### 3.10 系统设置模块 — `/api/settings`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings/` | 获取所有设置 |
| PUT | `/api/settings/` | 更新设置 |
| GET | `/api/settings/backup/list` | 获取备份文件列表 |
| POST | `/api/settings/backup/trigger` | 手动触发数据库备份 |

---

## 4. 公式引擎

### 4.1 设计原理

公式引擎允许用户自定义利润计算公式，支持嵌套引用和循环检测。

**数据结构**：
```typescript
interface FormulaItem {
  name: string;           // 公式名称 = 变量别名
  expression: string;     // 数学表达式
  format: 'number' | 'percentage';  // 输出格式
  sort_order: number;     // 计算顺序（1-99，越小越先算）
}
```

### 4.2 计算流程

```
1. 构建基础上下文
   ctx = { 售价: product.sell_price, 采购成本: product.cost_price }

2. 遍历每个活跃成本项
   - 百分比项：val = sellPrice × (rawVal / 100)
   - MYR 项：val × exchangeRate → 转为 RMB，累加到 MYR成本合计RMB
   - RMB 项：直接使用
   → 每个成本项名称作为变量名加入 ctx

3. ctx['MYR成本合计RMB'] = MYR 成本总和
4. ctx['MYR兑RMB汇率'] = 当前汇率

5. 按 sort_order 顺序逐个计算公式
   - 替换表达式中所有变量名为对应数值
   - 用 new Function("use strict"; return (expr))() 安全求值
   - 结果四舍五入到 2 位小数
   - 结果作为新变量加入 ctx（供后续公式引用）
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

**循环检测**：
1. 提取公式表达式中所有中英文+数字 token
2. 排除纯数字和基础变量
3. 检查引用的变量是否已定义为公式名
4. 检查引用的公式 sort_order 是否严格小于当前公式

**表达式安全**：
- 仅允许：数字、空格、运算符 `+-*/`、括号 `()`、小数点 `.`、百分号 `%`
- `new Function` 以 `"use strict"` 模式执行

---

## 5. 前端架构

### 5.1 路由结构

```
/login               → Login.tsx（公开）
/ai-analysis         → AIAnalysis.tsx（需认证，需 ai-analysis 权限）
/products            → Products.tsx（需认证，需 products 权限）
/shops               → ShopManagement.tsx（需认证，需 shops 权限）
/orders              → OrderManagement.tsx（需认证，需 orders 权限）
/finance             → Finance.tsx（需认证，需 finance 权限）
/influencers         → Influencers.tsx（需认证，需 influencers 权限）
/settings            → Settings.tsx（需认证，需 settings-config 权限）
/permissions         → UserPermissions.tsx（需认证，需 settings-permissions 权限）
*                    → Navigate to /products
```

### 5.2 布局结构

```
┌─────────────────────────────────────────────────┐
│  🦞 虾掌柜 v1.2.0        用户名(角色名) [退出]   │  ← Header
├──────────┬──────────────────────────────────────┤
│ 🤖 AI智能分析 │                                      │
│ 🏪 店铺管理  │         Content Area                 │
│ 📦 产品管理  │         (浅灰背景 #f5f5f5)           │
│ 📋 订单管理  │         (白色卡片内容)               │
│ 💰 利润核算  │                                      │
│ 🤝 达人BD   │                                      │
│ 系统设置 ▼  │                                      │
│  ├ 系统配置  │                                      │
│  └ 用户与权限│                                      │
└──────────┴──────────────────────────────────────┘
```

### 5.3 动态菜单与 RBAC

- `menuConfig` 定义菜单项与权限键映射
- 开发者（developer）看到全部菜单
- 其他用户根据 `permissions` map 动态过滤菜单项
- `PermRouteGuard` 组件同时检查 `minRole` 和 `permKey`
- 未授权访问显示警告并跳转 `/products`

### 5.4 Zustand Stores

#### authStore
```typescript
interface AuthState {
  token: string | null;
  username: string | null;
  permissions: Record<string, string>;  // { moduleKey: 'read' | 'edit' }
  roleName: string | null;
  roleKey: RoleKey | null;               // 'developer' | 'manager' | 'staff'
  setAuth: (token, username, permissions?, roleName?, roleKey?) => void;
  logout: () => void;
}
```
- localStorage 持久化键：`erp_token`、`erp_username`、`erp_permissions`、`erp_role_name`、`erp_role_key`
- 辅助函数：`hasMinRole()`、`useHasPerm()`、`useIsDeveloper()`、`useIsManager()`

#### productStore、financeStore、influencerStore
见 v1.0 文档，功能基本不变。

#### aiStore
```typescript
interface AIState {
  apiKey: string;
  apiBase: string;
  model: string;
  loadConfig: () => Promise<void>;
  saveConfig: (config) => Promise<void>;
}
```

### 5.5 页面功能清单

#### Login.tsx
- 渐变背景居中卡片 + 品牌 Logo
- 用户名/密码表单
- 默认账号提示

#### AIAnalysis.tsx
- AI 智能问答（支持自定义 System Prompt）
- TikTok 报表解读（GMV/订单/利润趋势分析）
- AI 自动化处理（批量操作）
- 配置检查和错误提示

#### ShopManagement.tsx
- 店铺 CRUD（支持地区标签和状态管理）
- **仪表盘 ECharts 图表**（GMV/订单数/客单价趋势）
- 日期范围筛选（单日小时级/多日日级粒度）
- 今日实时数据 + 上日对比
- 订单状态计数（待发货/申请取消/申请退款/自动取消）

#### OrderManagement.tsx
- **状态 Tab 栏**（全部/待支付/待发货/已完成/已取消/申请取消/申请退款/自动取消）
- 订单表格（含商品图片智能回填）
- **AI 智能导入向导**（上传→预览→确认三步）
- 批量操作（按条件删除）
- 订单详情弹窗（买家信息/商品明细/物流信息）
- 新增/编辑订单弹窗（自动关联达人佣金率）
- 库存联动（发货扣减，取消/退款回补）

#### Products.tsx
见 v1.0 文档，功能基本不变。

#### Finance.tsx
见 v1.0 文档，功能基本不变。

#### Influencers.tsx
- 左右分栏布局
- 达人列表（含样品/素材/合作类型等增强字段）
- 跟进记录时间线
- **样品寄送管理**（寄样日期/收样日期/样品成本）
- **素材管理**（素材排期/素材链接）
- 产品绑定与统计数据

#### Settings.tsx
- **AI 配置**（API Key/API Base/模型选择，需 manager 及以上）
- 账号管理（用户列表/创建/修改密码）
- 数据备份（备份列表/手动备份/下载）
- 系统信息展示

#### UserPermissions.tsx
- 角色管理面板（编辑角色名称/描述/权限矩阵）
- 用户管理面板（创建/编辑/删除用户，分配角色）
- 权限矩阵：以菜单模块为行，以角色为列，勾选 read/edit 权限
- 权限模块：`ai-analysis`、`products`、`shops`、`orders`、`finance`、`influencers`、`settings-config`、`settings-permissions`、`backup`、`user-mgmt`

---

## 6. 认证与权限体系

### 6.1 认证流程

```
前端 POST /api/auth/login
        ↓
    bcrypt 验证密码
        ↓
    查询 users + roles 表获取权限
        ↓
    JWT sign({ userId, username, roleKey })
        ↓
前端 localStorage 存储 (token, username, permissions, role_name, role_key)
        ↓
后续请求 Authorization: Bearer <token>
        ↓
后端 JWT verify → roleKey 决定 API 访问级别
```

### 6.2 权限模型

**三层角色体系：**

| 角色 | role_key | 权限级别 | 说明 |
|------|----------|----------|------|
| 开发者 | developer | 2（最高） | 所有模块 edit，不可被前端权限配置限制 |
| 管理员 | manager | 1 | 大部分模块 edit，user-mgmt 仅 read |
| 员工 | staff | 0 | 所有模块 read，不可编辑任何数据 |

**模块级权限（per-module granularity）：**

每个菜单模块有一个 `permKey`，映射到 `roles.permissions` JSON：
- `edit`：可读可写
- `read`：仅可读
- 无/空：不可见（菜单隐藏，路由跳转 `/products` 并提示"权限不足"）

**开发者 bypass**：任何 `roleKey === 'developer'` 的用户自动获得所有权限，前端权限配置对其无效。

### 6.3 JWT 配置

- JWT_SECRET: `xiaolongxia-erp-secret-2026`
- Token 过期时间: 7 天
- 密码哈希: bcrypt（salt rounds = 10）
- JWT Payload: `{ userId, username, roleKey }`

---

## 7. 业务流程

### 7.1 产品管理流程

```
创建 TikTok 店铺（如 "Freshguard15"）
    ↓
创建供应商
    ↓
创建产品（支持多 SKU）
  ├── 基本信息：名称、SKU、售价、采购成本、库存、图片
  ├── 箱规信息：数量、长宽高、备注
  └── 多 SKU 规格：sku_code / 规格名 / 成本价 / 售价 / 库存
    ↓
产品列表展示（支持搜索和筛选）
    ↓
点击查看详情 / 编辑 / 删除
    ↓
Excel 导入导出
```

### 7.2 订单管理流程（v1.2.0 新增）

```
店铺运营 → 获取 TikTok 后台导出订单 Excel
    ↓
AI 智能导入
  ├── 上传 Excel/CSV（自动跳过说明行）
  ├── AI 自动识别 TikTok 中英文字段映射
  ├── 预览订单数据（最多50条）
  └── 确认导入（自动去重/覆盖更新）
    ↓
系统自动匹配商品 SKU（多级模糊匹配 + 图片回填）
    ↓
自动扣减库存（新品/恢复取消订单）
    ↓
查看订单列表（按状态 Tab 分类）
    ↓
手动处理发货/取消/退款（自动库存联动）
    ↓
店铺仪表盘查看 GMV/订单趋势和统计
```

### 7.3 AI 智能分析流程（v1.2.0 新增）

```
配置 AI API Key（管理员在系统设置中保存到数据库）
    ↓
AI 智能问答
  └── 客服/运营咨询业务问题
    ↓
TikTok 报表解读
  └── 上传/粘贴 GMV/利润数据，AI 分析趋势和异常
    ↓
AI 自动化处理
  └── 批量操作建议和执行
```

### 7.4 利润核算流程

见 v1.0 文档，功能基本不变。

### 7.5 达人 BD 流程（v1.2.0 增强）

```
添加达人（达人ID/联系方式/主页链接/合作类型）
    ↓
关联 TikTok 店铺 + 设置佣金比例
    ↓
跟进沟通
  ├── 记录沟通内容/状态/下次跟进时间
  └── 设置下次跟进提醒
    ↓
样品管理
  ├── 填写样品数量/成本
  ├── 记录寄样日期/收样日期
  └── 样品成本计入推广费用
    ↓
素材管理
  ├── 素材排期
  └── 素材链接
    ↓
绑定推广产品
    ↓
从达人来的订单自动关联佣金率
    ↓
系统统计达人推广效果
```

### 7.6 权限管理流程（v1.2.0 新增）

```
开发者定义角色（预设：开发者/管理员/员工）
    ↓
为每个角色配置模块权限（read/edit）
    ↓
创建用户并分配角色
    ↓
用户登录后菜单动态过滤 + 路由守卫
    ↓
管理员可在 UI 调整角色权限（settings-permissions 页面）
```

---

## 8. 部署指南

### 8.1 环境要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10/11 |
| Node.js | >= 18（推荐 22.x） |
| npm | 随 Node.js 安装 |

### 8.2 快速部署

```bash
cd E:\tiktok-crm
cd server && npm install && cd ..
cd client && npm install && cd ..
npm run dev
# 或双击 start.bat 静默后台启动
```

### 8.3 访问地址

| 服务 | 地址 |
|------|------|
| 前端（开发） | http://localhost:5173 |
| 后端 API | http://localhost:3000/api |
| 生产（统一入口） | http://localhost:3000 |

### 8.4 生产部署

```bash
cd client && npm run build    # 输出到 client/dist/
cd ../server && npx tsx src/index.ts
# 访问 http://localhost:3000
```

---

## 9. 关键实现文件索引

| 文件 | 路径 | 说明 |
|------|------|------|
| 后端入口 | `server/src/index.ts` | Express app，所有路由注册，启动计划任务 |
| 数据库 | `server/src/db.ts` | 建表/迁移/种子，含 RBAC 角色初始化 |
| JWT 中间件 | `server/src/middleware/auth.ts` | JWT 验证，payload 含 userId/username/roleKey |
| 认证路由 | `server/src/routes/auth.ts` | 登录（含权限返回）、/me、注册、用户管理 |
| 产品路由 | `server/src/routes/products.ts` | 产品/供应商/店铺 CRUD |
| TikTok 店铺路由 | `server/src/routes/shops.ts` | TikTok 店铺 CRUD + 仪表盘统计 API |
| 订单路由 | `server/src/routes/orders.ts` | 订单 CRUD + 状态计数 + 批量操作 |
| AI 导入路由 | `server/src/routes/orders-import.ts` | AI 字段映射 + 预览 + 确认导入 |
| 核算路由 | `server/src/routes/finance.ts` | 公式引擎/成本项/汇率/核算记录 |
| 达人路由 | `server/src/routes/influencers.ts` | 达人/跟进/绑定/统计 |
| AI 路由 | `server/src/routes/ai.ts` | AI 配置读写 + Chat 代理 |
| 设置路由 | `server/src/routes/settings.ts` | 系统设置/备份 |
| 自动备份 | `server/src/utils/backup.ts` | 定时备份 SQLite 数据库 |
| 前端入口 | `client/src/main.tsx` | React 挂载 |
| 路由布局 | `client/src/App.tsx` | 路由 + 侧边栏 + RBAC 菜单过滤 + 路由守卫 |
| API 层 | `client/src/api/index.ts` | Axios 实例 + 请求/响应拦截器 |
| 认证状态 | `client/src/stores/authStore.ts` | Zustand store + RBAC + localStorage 持久化 |
| AI 状态 | `client/src/stores/aiStore.ts` | AI 配置状态 |
| 登录页 | `client/src/pages/Login.tsx` | 登录界面 |
| AI 分析页 | `client/src/pages/AIAnalysis.tsx` | AI 问答/报表解读/自动处理 |
| 店铺管理页 | `client/src/pages/ShopManagement.tsx` | 店铺 CRUD + ECharts 仪表盘 |
| 订单管理页 | `client/src/pages/OrderManagement.tsx` | 订单列表 + AI 导入向导 |
| 产品管理页 | `client/src/pages/Products.tsx` | 产品 CRUD |
| 利润核算页 | `client/src/pages/Finance.tsx` | 公式引擎 + 成本管理 |
| 达人 BD 页 | `client/src/pages/Influencers.tsx` | 达人管理 + 样品/素材 + 跟进 |
| 系统设置页 | `client/src/pages/Settings.tsx` | AI 配置 + 账号管理 + 备份 |
| 权限管理页 | `client/src/pages/UserPermissions.tsx` | 角色配置 + 用户管理 |
| 产品详情页 | `client/src/pages/ProductDetail.tsx` | 产品详情（只读） |
