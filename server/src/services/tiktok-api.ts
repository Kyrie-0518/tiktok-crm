/**
 * TikTok Shop Partner Center API 客户端
 * 封装订单、商品、店铺等常用 API 调用
 */
import { buildHeaders, buildUrl, TikTokAuth } from '../utils/tiktok-sign';

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
    const path = `/api/${this.apiVersion}/${endpoint}`;
    const url = buildUrl(this.apiVersion, endpoint, queryParams);
    const headers = buildHeaders(this.auth, path, body);

    const fetchOptions: RequestInit = { method, headers };
    if (body && method === 'POST') {
      fetchOptions.body = JSON.stringify(body);
    }

    const res = await fetch(url, fetchOptions);
    const text = await res.text();

    if (!res.ok) {
      let errMsg = `TikTok API ${res.status}`;
      try {
        const errJson = JSON.parse(text);
        errMsg = errJson.message || errJson.msg || errMsg;
      } catch {}
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

  /** 搜索/获取订单列表 */
  async getOrderList(params: {
    order_status?: string;
    page_size?: number;
    page_token?: string;
    create_time_from?: number;
    create_time_to?: number;
    update_time_from?: number;
    update_time_to?: number;
    [key: string]: any;
  }) {
    return this.post('orders/search', params);
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

  /** 获取授权店铺列表 */
  async getAuthorizedShops() {
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
