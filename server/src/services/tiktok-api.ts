/**
 * TikTok Shop Partner Center API 客户端
 * 封装订单、商品、店铺等常用 API 调用
 */
import { buildSignedRequest, TikTokAuth } from '../utils/tiktok-sign';

export class TikTokAPI {
  private auth: TikTokAuth;

  constructor(auth: TikTokAuth) {
    this.auth = auth;
  }

  get apiVersion(): string {
    return this.auth.api_version || '202309';
  }

  // ─── 通用请求方法 ──────────────────────────────

  private async request(
    method: 'GET' | 'POST',
    endpoint: string,
    queryParams?: Record<string, string>,
    body?: Record<string, any>,
  ): Promise<any> {
    const { url, headers } = buildSignedRequest(this.auth, endpoint, queryParams, body);

    const fetchOptions: RequestInit = { method, headers };
    // 只在有 body 时设置 Content-Type，避免空 body 的 POST 被拒绝
    const hasBody = body && Object.keys(body).length > 0;
    if (hasBody && method === 'POST') {
      fetchOptions.body = JSON.stringify(body);
    } else {
      // 移除 Content-Type，让 fetch 自动处理
      delete (fetchOptions.headers as Record<string, string>)['Content-Type'];
    }

    console.log(`[TikTokAPI] → ${method} ${url}`);
    if (body && Object.keys(body).length > 0) {
      console.log(`[TikTokAPI]   body:`, JSON.stringify(body).slice(0, 200));
    }

    let res: Response;
    try {
      res = await fetch(url, fetchOptions);
    } catch (fetchErr: any) {
      console.error(`[TikTokAPI] ❌ fetch() 底层失败:`);
      console.error(`  URL: ${url}`);
      console.error(`  message: ${fetchErr.message}`);
      console.error(`  cause:`, fetchErr.cause ? JSON.stringify(fetchErr.cause) : 'none');
      console.error(`  code: ${fetchErr.code || 'none'}`);
      throw new Error(`网络连接失败: ${fetchErr.message || fetchErr} (${url})`);
    }

    const text = await res.text();

    if (!res.ok) {
      let errMsg = `TikTok API ${res.status}`;
      try {
        const errJson = JSON.parse(text);
        errMsg = errJson.message || errJson.msg || errMsg;
      } catch {}
      console.error(`[TikTokAPI] ❌ HTTP ${res.status}:`, text.slice(0, 500));
      throw new Error(`[${res.status}] ${errMsg}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private get(endpoint: string, queryParams?: Record<string, string>) {
    return this.request('GET', endpoint, queryParams);
  }

  private post(endpoint: string, body?: Record<string, any>, queryParams?: Record<string, string>) {
    return this.request('POST', endpoint, queryParams, body);
  }

  // ─── 订单 API ──────────────────────────────────

  /** 获取订单详情 — 文档页面: get-order-detail-202309 */
  async getOrderDetail(orderIds: string[]) {
    const ids = orderIds.join(',');
    return this.get('orders', { ids });
  }

  /** 搜索/获取订单列表 — 严格匹配官方 SDK OrdersSearchPost */
  async getOrderList(params: {
    order_status?: string;
    page_size?: number;
    page_token?: string;
    sort_by?: string;
    sort_type?: string;
    sort_field?: string;
    sort_order?: string;
    create_time_from?: number;
    create_time_to?: number;
    update_time_from?: number;
    update_time_to?: number;
    buyer_user_id?: string;
    [key: string]: any;
  }) {
    // 官方 SDK: page_size / sort_* / page_token 在 URL 参数中
    const queryParams: Record<string, string> = {};
    if (params.page_size) queryParams['page_size'] = String(params.page_size);
    if (params.page_token) queryParams['page_token'] = params.page_token;
    if (params.sort_by) queryParams['sort_by'] = params.sort_by;
    if (params.sort_type) queryParams['sort_type'] = params.sort_type;
    if (params.sort_field) queryParams['sort_field'] = params.sort_field;
    if (params.sort_order) queryParams['sort_order'] = params.sort_order;

    // 官方 SDK: 过滤参数在 POST body 中 (GetOrderListRequestBody)
    const body: Record<string, any> = {};
    if (params.order_status) body['order_status'] = params.order_status;
    if (params.create_time_from) body['create_time_ge'] = params.create_time_from;
    if (params.create_time_to) body['create_time_lt'] = params.create_time_to;
    if (params.update_time_from) body['update_time_ge'] = params.update_time_from;
    if (params.update_time_to) body['update_time_lt'] = params.update_time_to;
    if (params.buyer_user_id) body['buyer_user_id'] = params.buyer_user_id;

    return this.request(
      'POST',
      'orders/search',
      Object.keys(queryParams).length > 0 ? queryParams : undefined,
      Object.keys(body).length > 0 ? body : undefined,
    );
  }

  /** 获取订单价格详情 (需要 202407+) */
  async getPriceDetail(orderId: string) {
    return this.get(`orders/${orderId}/price_detail`);
  }

  // ─── 商品 API ──────────────────────────────────

  /** 搜索商品 */
  async searchProducts(params: Record<string, any>) {
    return this.post('products/search', params);
  }

  /** 获取商品详情 */
  async getProductDetail(productId: string) {
    return this.get(`products/${productId}`);
  }

  // ─── 店铺 API ──────────────────────────────────

  /** 
   * 获取授权店铺列表 (DEPRECATED: 此方法路径错误)
   * 正确的 API 路径是 /authorization/202309/shops，不走 CATEGORY_MAP 映射
   * 请使用 tiktok-oauth.ts 中的 getAuthorizedShops(accessToken) 函数
   */
  async getAuthorizedShops() {
    // TODO: 修复 CATEGORY_MAP 使其支持 authorization 类别
    // 当前路径错误，返回 shop/get_authorized_shop 在 TikTok API 中不存在
    return this.get('shop/get_authorized_shop');
  }

  /** 获取店铺信息 */
  async getShopInfo() {
    return this.get('shop/get_info');
  }

  // ─── 物流 API ──────────────────────────────────

  /** 获取物流信息 */
  async getShippingInfo(orderId: string) {
    return this.get(`logistics/${orderId}`);
  }

  /** 获取物流提供商列表 */
  async getShippingProviders() {
    return this.get('logistics/shipping_providers');
  }

  // ─── 财务 API ──────────────────────────────────

  /** 获取结算单 */
  async getSettlements(params: Record<string, any>) {
    return this.get('finance/settlements', params);
  }

  /** 获取订单交易记录 */
  async getOrderTransactions(params: Record<string, any>) {
    return this.get('finance/order_transactions', params);
  }
}
