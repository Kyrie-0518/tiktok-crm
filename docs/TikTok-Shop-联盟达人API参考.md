# TikTok Shop 联盟达人 API 完整参考

> 基于 nodejs_sdk (OpenAPI Generator 自动生成)
> API 版本：V202405 ~ V202605
> Role：Seller（卖家端）/ Creator（达人端）/ Partner（合作伙伴端）

---

## 一、Seller 卖家端 API（7 个接口）

Base URL: `https://open-api.tiktokglobalshop.com`

| # | 方法名 | HTTP | 路径 | 说明 |
|---|---|---|---|---|
| 1 | `openCollaborationSettingsPost` | POST | `/affiliate_seller/202405/open_collaboration_settings` | 编辑开放协作设置（自动加入/退出开放协作计划） |
| 2 | `openCollaborationsOpenCollaborationIdRemoveCreatorPost` | POST | `/affiliate_seller/202405/open_collaborations/{open_collaboration_id}/remove_creator` | 从开放协作中移除指定达人 |
| 3 | `openCollaborationsPost` | POST | `/affiliate_seller/202405/open_collaborations` | 创建开放协作（选品+设佣金率，所有达人可见） |
| 4 | `openCollaborationsProductsSearchPost` | POST | `/affiliate_seller/202405/open_collaborations/products/search` | 搜索开放协作产品（按类目/佣金率/关键词） |
| 5 | `ordersSearchPost` | POST | `/affiliate_seller/202405/orders/search` | 查询联盟订单列表（返回所有历史联盟订单） |
| 6 | `productsProductIdPromotionLinkGeneratePost` | POST | `/affiliate_seller/202405/products/{product_id}/promotion_link/generate` | 生成联盟推广链接（分发给达人） |
| 7 | `targetCollaborationsPost` | POST | `/affiliate_seller/202405/target_collaborations` | 创建定向协作（私密协作，仅邀请的达人可见） |

### 关键请求参数

**创建开放协作**:
```
{ products: [{ product_id, commission_rate }] }
```

**搜索联盟订单**:
```
{ page_size, page_token }
```

**生成推广链接**:
```
{ product_id }
```

**创建定向协作**:
```
{ products: [{ product_id, commission_rate }], creator_id_list }
```

---

## 二、Creator 达人端 API（6 个接口）

Base URL: `https://open-api.tiktokglobalshop.com`

| # | 方法名 | HTTP | 路径 | 说明 |
|---|---|---|---|---|
| 1 | `openCollaborationsProductsSearchPost` | POST | `/affiliate_creator/202405/open_collaborations/products/search` | 达人搜索可带货的开放协作产品 |
| 2 | `ordersSearchPost` | POST | `/affiliate_creator/202405/orders/search` | 达人查询自己的联盟订单 |
| 3 | `profilesGet` | GET | `/affiliate_creator/202405/profiles` | 获取达人个人资料（粉丝数/类目等） |
| 4 | `showcasesProductsAddPost` | POST | `/affiliate_creator/202405/showcases/products/add` | 将产品添加到达人橱窗 |
| 5 | `showcasesProductsGet` | GET | `/affiliate_creator/202405/showcases/products` | 获取达人橱窗产品列表 |
| 6 | `targetCollaborationsSearchPost` | POST | `/affiliate_creator/202405/target_collaborations/search` | 搜索定向协作邀请 |

---

## 三、Partner 合作伙伴端 API

Base URL: `https://open-api.tiktokglobalshop.com`

| # | 方法名 | 路径 | 说明 |
|---|---|---|---|
| 1 | createAffiliatePartnerCampaign | `/affiliate_partner/202405/campaigns` | 创建联盟合作伙伴活动 |
| 2 | editAffiliatePartnerCampaign | `/affiliate_partner/202405/campaigns/{id}` | 编辑活动 |
| 3 | getAffiliatePartnerCampaignList | `/affiliate_partner/202405/campaigns` | 获取活动列表 |
| 4 | getAffiliatePartnerCampaignDetail | `/affiliate_partner/202405/campaigns/{id}` | 获取活动详情 |
| 5 | getAffiliatePartnerCampaignProductList | `/affiliate_partner/202405/campaigns/{id}/products` | 获取活动产品列表 |
| 6 | generateAffiliatePartnerCampaignProductLink | `/affiliate_partner/202405/campaigns/{id}/products/link` | 生成活动产品链接 |
| 7 | publishAffiliatePartnerCampaign | `/affiliate_partner/202405/campaigns/{id}/publish` | 发布活动 |
| 8 | reviewAffiliatePartnerCampaignProduct | `/affiliate_partner/202405/campaigns/{id}/products/review` | 审核活动产品 |
| 9 | searchTapAffiliateOrders | `/affiliate_partner/202411/orders/search` | 搜索TAP联盟订单 |

---

## 四、扩展版本新增功能（V202407 ~ V202605）

### affiliateCreator V202407
- `generateAffiliateSharingLinkPost` — 生成联盟分享链接（含素材信息）

### affiliateCreator V202410
- `ordersSearchPost` 增强版 — 返回更详细的订单数据，包含 SKU 级别佣金明细
  - 返回字段：`actual_bonus_commission`, `actual_commission`, `estimated_commission`, `skus`（含价格/税费）

### affiliateCreator V202501
- `creatorSelectAffiliateProductPost` — 达人选择联盟产品（带复杂筛选：类目/佣金率/价格+排序）
- `generateAffiliateSharingLinkPost` — 新版分享链接生成

### affiliateSeller（后续版本 V202502 ~ V202605）
- 持续迭代，保持 API 向后兼容

---

## 五、对虾掌柜 ERP 可用的核心接口

### 5.1 达人信息获取
```
GET /affiliate_creator/202405/profiles
```
- 获取达人个人资料：ID、名称、头像、粉丝数、主要类目、地区
- 可用于「联盟管理」模块的达人数据自动补充

### 5.2 联盟订单查询
```
POST /affiliate_seller/202405/orders/search
POST /affiliate_creator/202405/orders/search
```
- 卖家端：查询所有达人带货订单
- 达人端：查询自己的带货订单
- 可用于自动关联订单与达人，计算佣金

### 5.3 达人橱窗
```
GET  /affiliate_creator/202405/showcases/products
POST /affiliate_creator/202405/showcases/products/add
```
- 获取达人橱窗产品
- 添加产品到橱窗（如果我们是 MCN/服务商，可以帮达人操作）

### 5.4 协作管理
```
POST /affiliate_seller/202405/open_collaborations          (公开协作)
POST /affiliate_seller/202405/target_collaborations        (定向协作)
POST /affiliate_seller/202405/open_collaborations/{id}/remove_creator  (移除达人)
```
- 创建带货协作计划
- 指定佣金率和产品
- 管理达人合作关系

### 5.5 推广链接
```
POST /affiliate_seller/202405/products/{id}/promotion_link/generate
POST /affiliate_creator/202407/generate_sharing_link
```
- 生成追踪链接，分发达人
- 用于归因分析和效果追踪

---

## 六、SDK 使用示例（Typescript）

```typescript
import { AffiliateSellerV202405Api } from './nodejs_sdk/api/affiliateSellerV202405Api';
import { AffiliateCreatorV202405Api } from './nodejs_sdk/api/affiliateCreatorV202405Api';

// 卖家端 —— 查询联盟订单
const sellerApi = new AffiliateSellerV202405Api({
  appKey: 'your_app_key',
  appSecret: 'your_app_secret',
  accessToken: 'shop_access_token',
});
const orders = await sellerApi.ordersSearchPost({
  body: { page_size: 50 }
});

// 卖家端 —— 搜索可协作产品
const products = await sellerApi.openCollaborationsProductsSearchPost({
  body: {
    page_size: 20,
    commission_rate_range: { min_rate: 5, max_rate: 20 },
    keyword: 'fashion',
  }
});

// 达人端 —— 获取达人资料
const creatorApi = new AffiliateCreatorV202405Api({
  appKey: 'your_app_key',
  appSecret: 'your_app_secret',
  accessToken: 'creator_access_token',
});
const profile = await creatorApi.profilesGet();
```

---

## 七、数据模型关键字段

### 联盟订单 (Affiliate Order)
| 字段 | 类型 | 说明 |
|---|---|---|
| `order_id` | string | 订单 ID |
| `product_id` | string | 产品 ID |
| `creator_id` | string | 达人 ID |
| `commission_amount` | number | 佣金金额 |
| `commission_rate` | number | 佣金率(%) |
| `order_status` | string | 订单状态 |
| `created_time` | timestamp | 创建时间 |

### 达人资料 (Creator Profile)
| 字段 | 类型 | 说明 |
|---|---|---|
| `creator_id` | string | 达人 ID |
| `creator_name` | string | 达人名称 |
| `avatar_url` | string | 头像地址 |
| `follower_count` | number | 粉丝数 |
| `category` | string | 主要类目 |
| `country` | string | 国家 |

### 协作产品 (Collaboration Product)
| 字段 | 类型 | 说明 |
|---|---|---|
| `product_id` | string | 产品 ID |
| `product_name` | string | 产品名称 |
| `price` | number | 售价 |
| `commission_rate` | number | 佣金率 |
| `sales_count` | number | 销量 |
| `shop_name` | string | 店铺名称 |

---

## 八、接入建议

### 优先级
1. **P0**: `affiliate_seller/orders/search` — 将联盟订单与达人关联，自动计算佣金
2. **P1**: `affiliate_creator/profiles` — 自动获取达人粉丝数/类目数据
3. **P2**: `affiliate_seller/target_collaborations` — 批量创建协作，管理达人关系
4. **P3**: `affiliate_seller/products/promotion_link` — 生成推广链接 + 归因

### 与虾掌柜 ERP 的集成
- **联盟管理 (Influencers)** 页面：接入 `profilesGet` 自动拉取达人数据
- **利润核算 (Finance)** 页面：接入 `ordersSearch` 自动获取佣金费用
- **流量引擎** → 未来可新增「达人协作」模块，管理协作计划和佣金

---

**文档版本**: v1.0 | **关联模块**: 联盟管理 / 财务核算 / 流量引擎
