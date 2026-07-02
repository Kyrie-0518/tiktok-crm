import React, { useEffect, useState, useRef } from 'react';
import {
  Card, Button, Space, Modal, Form, Input, Select, Tag, message,
  Popconfirm, Statistic, Row, Col, Empty, Spin, Tooltip, DatePicker,
  Divider, Switch,
} from 'antd';
import {
  PlusOutlined, SyncOutlined, DeleteOutlined, ShopOutlined,
  ShoppingCartOutlined, DollarOutlined, BarChartOutlined,
  ApiOutlined, LinkOutlined, CloudDownloadOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as echarts from 'echarts';
import api from '../api';
import { useHasPerm } from '../stores/authStore';

const BRAND_COLOR = '#2563eb';
const { RangePicker } = DatePicker;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:   { label: '运营中', color: 'success' },
  inactive: { label: '已停用', color: 'default' },
  pending:  { label: '待授权', color: 'warning' },
};

const REGION_MAP: Record<string, string> = {
  MY: '马来西亚', SG: '新加坡', TH: '泰国', PH: '菲律宾',
  ID: '印度尼西亚', VN: '越南', GB: '英国', US: '美国',
};

// Metric color palette
const METRIC_COLORS = ['#2563eb', '#52c41a', '#fa8c16', '#eb2f96'];

export default function ShopManagement() {
  const canEdit = useHasPerm('shops', 'edit');
  const [shops, setShops] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedShop, setSelectedShop] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editShop, setEditShop] = useState<any>(null);
  const [form] = Form.useForm();
  // Date filter
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [dateType, setDateType] = useState<'single' | 'range'>('single');
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const loadShops = async () => {
    setLoading(true);
    try {
      const res = await api.get('/shops');
      setShops(res.data);
    } catch {
      message.error('加载店铺列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (shopId?: number) => {
    setStatsLoading(true);
    try {
      const params: any = {};
      if (shopId) params.shop_id = shopId;
      if (dateRange) {
        params.date_from = dateRange[0].format('YYYY-MM-DD');
        params.date_to = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await api.get('/shops/stats', { params });
      setStats(res.data);
    } catch {
      message.error('加载统计数据失败');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
    loadStats();
    // 检测 TikTok OAuth 回调参数
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      message.success('TikTok 店铺授权成功！');
      // 清除 URL 参数
      window.history.replaceState({}, '', '/shops');
    }
  }, []);

  // Init and resize chart
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    const observer = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, []);

  // Update chart when stats change
  useEffect(() => {
    if (!chartInstance.current || !stats) return;
    const trend = stats.trend || [];
    const isSingleDay = stats.filtered?.is_single_day;

    if (trend.length === 0) {
      chartInstance.current.clear();
      return;
    }

    const xData = trend.map((d: any) => {
      if (isSingleDay) {
        // Show hour HH:00
        return d.time_point?.split(' ')[1] || '';
      }
      return d.time_point || '';
    });

    const gmvSeries = {
      name: 'GMV',
      type: 'line' as const,
      yAxisIndex: 0,
      smooth: true,
      data: trend.map((d: any) => d.gmv || 0),
      itemStyle: { color: METRIC_COLORS[0] },
      lineStyle: { width: 2 },
      areaStyle: { color: 'rgba(37,99,235,0.1)' },
    };

    const series: any[] = [gmvSeries];

    // Add comparison line for single day (prev day)
    if (isSingleDay && trend.some((d: any) => d.prev_gmv > 0)) {
      series.push({
        name: '昨日同时段GMV',
        type: 'line' as const,
        yAxisIndex: 0,
        smooth: true,
        data: trend.map((d: any) => d.prev_gmv || 0),
        itemStyle: { color: '#94a3b8' },
        lineStyle: { width: 2 },
      });
    }

    // Add item_count series
    const hasItems = trend.some((d: any) => d.item_count > 0);
    if (hasItems) {
      series.push({
        name: '商品成交件数',
        type: 'line' as const,
        yAxisIndex: 1,
        smooth: true,
        data: trend.map((d: any) => d.item_count || 0),
        itemStyle: { color: METRIC_COLORS[1] },
        lineStyle: { width: 2 },
      });
    }

    // Add order_count series
    const hasOrders = trend.some((d: any) => d.order_count > 0);
    if (hasOrders) {
      series.push({
        name: '订单数',
        type: 'line' as const,
        yAxisIndex: 1,
        smooth: true,
        data: trend.map((d: any) => d.order_count || 0),
        itemStyle: { color: METRIC_COLORS[2] },
        lineStyle: { width: 2 },
      });
    }

    // Add sku_count series
    const hasSkus = trend.some((d: any) => d.sku_count > 0);
    if (hasSkus) {
      series.push({
        name: 'SKU订单数',
        type: 'line' as const,
        yAxisIndex: 1,
        smooth: true,
        data: trend.map((d: any) => d.sku_count || 0),
        itemStyle: { color: METRIC_COLORS[3] },
        lineStyle: { width: 2 },
      });
    }

    const yAxisConfig = [
      {
        type: 'value' as const,
        name: 'GMV (RM)',
        position: 'left' as const,
        axisLine: { show: true, lineStyle: { color: METRIC_COLORS[0] } },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      {
        type: 'value' as const,
        name: '数量',
        position: 'right' as const,
        axisLine: { show: true, lineStyle: { color: '#94a3b8' } },
        splitLine: { show: false },
      },
    ];

    const option: echarts.EChartsOption = {
      title: {
        text: isSingleDay ? '今日 GMV 趋势（小时）' : 'GMV 趋势',
        textStyle: { fontSize: 13, fontWeight: 500, color: '#666' },
      },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'cross' as const },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const time = params[0].axisValue;
          let html = `<div style="font-weight:600;margin-bottom:4px">${time}</div>`;
          params.forEach((p: any) => {
            if (p.value !== undefined && p.value !== null && p.value !== 0) {
              const color = p.color?.colorStops?.[0]?.color || p.color || '#333';
              html += `<div style="display:flex;justify-content:space-between;gap:16px">
                <span style="color:#666">${p.seriesName}</span>
                <span style="font-weight:600;color:${color}">${Number(p.value).toLocaleString()}</span>
              </div>`;
            }
          });
          return html;
        },
      },
      legend: {
        data: series.map(s => s.name),
        bottom: 0,
        icon: 'roundRect',
      },
      grid: { left: 50, right: 50, top: 40, bottom: 50 },
      xAxis: {
        type: 'category' as const,
        data: xData,
        axisLabel: { fontSize: 11, color: '#999' },
        axisLine: { lineStyle: { color: '#e8e8e8' } },
      },
      yAxis: yAxisConfig,
      series,
    };

    chartInstance.current.setOption(option, true);
  }, [stats]);

  const handleShopClick = (shopId: number) => {
    const next = selectedShop === shopId ? null : shopId;
    setSelectedShop(next);
    loadStats(next || undefined);
  };

  const handleDateChange = (values: any) => {
    setDateRange(values);
    loadStats(selectedShop || undefined);
  };

  const handleSync = async (e: React.MouseEvent, shopId: number) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/shops/${shopId}/sync`);
      if (res.data.success) {
        message.success(`订单同步完成：新增 ${res.data.created} 条，更新 ${res.data.updated} 条`);
      } else {
        message.warning(`订单同步部分失败：${res.data.errors?.join(', ') || '未知错误'}`);
      }
      loadShops();
      loadStats(selectedShop || undefined);
    } catch (e: any) {
      message.error(e.response?.data?.errors?.[0] || '订单同步失败');
    }
  };

  const handleSyncProducts = async (e: React.MouseEvent, shopId: number) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/shops/${shopId}/sync-products`);
      if (res.data.success) {
        message.success(`产品同步完成：新增 ${res.data.created} 条，更新 ${res.data.updated} 条`);
      } else {
        message.warning(`产品同步部分失败：${res.data.errors?.join(', ') || '未知错误'}`);
      }
      loadShops();
    } catch (e: any) {
      message.error(e.response?.data?.errors?.[0] || '产品同步失败');
    }
  };

  const handleSyncAll = async (e: React.MouseEvent, shopId: number) => {
    e.stopPropagation();
    message.loading({ content: '正在全量同步产品+订单...', key: 'sync-all' });
    try {
      const res = await api.post(`/shops/${shopId}/sync-all`);
      const s = res.data.summary;
      message.success({
        content: `全量同步完成：产品 ${s.products_created + s.products_updated} 条，订单 ${s.orders_created + s.orders_updated} 条`,
        key: 'sync-all',
      });
      loadShops();
      loadStats(selectedShop || undefined);
    } catch (e: any) {
      message.error({ content: e.response?.data?.errors?.[0] || '全量同步失败', key: 'sync-all' });
    }
  };

  const handleTest = async (e: React.MouseEvent, shopId: number) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/shops/${shopId}/test`);
      if (res.data.success) {
        message.success(`✓ ${res.data.message}`);
      } else {
        message.error(`✗ ${res.data.message}`);
      }
    } catch (e: any) {
      message.error('测试失败');
    }
  };

  const handleDelete = async (shopId: number) => {
    try {
      await api.delete(`/shops/${shopId}`);
      message.success('已解绑');
      if (selectedShop === shopId) { setSelectedShop(null); loadStats(); }
      loadShops();
    } catch (e: any) {
      message.error(e.response?.data?.error || '解绑失败');
    }
  };

  const handleOpenModal = async (shop?: any) => {
    setEditShop(shop || null);
    if (shop) {
      // 获取完整店铺信息（含凭证）
      try {
        const res = await api.get(`/shops/${shop.id}`);
        form.setFieldsValue(res.data);
      } catch {
        form.setFieldsValue(shop);
      }
    } else {
      form.setFieldsValue({ region: 'MY', status: 'active', api_version: '202309', sync_enabled: false, product_sync_enabled: false });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editShop) {
        await api.put(`/shops/${editShop.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/shops', values);
        message.success('绑定成功');
      }
      setModalOpen(false);
      form.resetFields();
      loadShops();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const filtered = stats?.filtered;
  const isSingleDay = filtered?.is_single_day;
  const selectedShopName = selectedShop ? shops.find(s => s.id === selectedShop)?.name : null;

  return (
    <div style={{ padding: '20px 24px', background: '#f5f3f0', minHeight: '100%' }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 18,
          }}>
            <ShopOutlined />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>店铺管理</h2>
            <span style={{ fontSize: 12, color: '#999' }}>TikTok店铺绑定 · 数据同步 · 统计概览</span>
          </div>
        </div>
        {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>绑定新店铺</Button>}
      </div>

      {/* Shop Cards */}
      <Spin spinning={loading}>
        {shops.length === 0 ? (
          <Empty description="暂无绑定店铺，点击「绑定新店铺」开始" />
        ) : (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {shops.map(shop => (
              <Col key={shop.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  style={{
                    cursor: 'pointer',
                    border: selectedShop === shop.id ? `2px solid ${BRAND_COLOR}` : '1px solid #e8e8e8',
                    borderRadius: 8,
                  }}
                  onClick={() => handleShopClick(shop.id)}
                  styles={{ body: { padding: 16 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{shop.name}</div>
                      <Tag color="blue" style={{ marginBottom: 6 }}>{REGION_MAP[shop.region] || shop.region}</Tag>
                      <Tag color={STATUS_MAP[shop.status]?.color || 'default'}>{STATUS_MAP[shop.status]?.label || shop.status}</Tag>
                    </div>
                    <ShopOutlined style={{ fontSize: 28, color: '#d0d0d0' }} />
                  </div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                    {shop.last_synced_at ? `上次同步: ${shop.last_synced_at.slice(0, 16)}` : '尚未同步'}
                    {shop._has_credentials && <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>API已配置</Tag>}
                    {shop.sync_enabled && <Tag color="blue" style={{ fontSize: 11 }}>订单同步</Tag>}
                    {shop.product_sync_enabled && <Tag color="purple" style={{ fontSize: 11 }}>产品同步</Tag>}
                  </div>
                  <Space style={{ marginTop: 12 }} size="small">
                    <Tooltip title="从 TikTok API 同步订单">
                      <Button size="small" icon={<SyncOutlined />} onClick={e => handleSync(e, shop.id)}>订单</Button>
                    </Tooltip>
                    <Tooltip title="从 TikTok API 同步产品">
                      <Button size="small" icon={<AppstoreOutlined />} onClick={e => handleSyncProducts(e, shop.id)}>产品</Button>
                    </Tooltip>
                    <Tooltip title="全量同步：产品+订单">
                      <Button size="small" type="primary" ghost icon={<CloudDownloadOutlined />} onClick={e => handleSyncAll(e, shop.id)}>全部</Button>
                    </Tooltip>
                    <Tooltip title="测试 API 连接">
                      <Button size="small" icon={<ApiOutlined />} onClick={e => handleTest(e, shop.id)}>测试</Button>
                    </Tooltip>
                    {canEdit && (
                      <>
                        <Button size="small" onClick={e => { e.stopPropagation(); handleOpenModal(shop); }}>编辑</Button>
                        <Popconfirm title="确认解绑此店铺？" onConfirm={e => { e?.stopPropagation(); handleDelete(shop.id); }}>
                          <Button size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()}>解绑</Button>
                        </Popconfirm>
                      </>
                    )}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* Stats Dashboard */}
      <Spin spinning={statsLoading}>
        <Card
          title={
            <Space>
              <BarChartOutlined style={{ color: BRAND_COLOR }} />
              {selectedShopName ? `数据看板 — ${selectedShopName}` : '数据看板（全部店铺）'}
            </Space>
          }
          extra={
            <Space>
              {/* Date Filter */}
              <DatePicker.RangePicker
                value={dateRange}
                onChange={handleDateChange}
                format="YYYY/MM/DD"
                allowClear
                placeholder={['开始日期', '结束日期']}
                style={{ width: 260 }}
              />
              {/* Shop Filter Dropdown */}
              <Select
                placeholder="选择店铺"
                value={selectedShop}
                onChange={(v) => {
                  setSelectedShop(v || null);
                  loadStats(v || undefined);
                }}
                allowClear
                style={{ width: 160 }}
                options={shops.map(s => ({ value: s.id, label: s.name }))}
              />
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={6}>
              <Statistic
                title="GMV（总成交额）"
                value={filtered?.gmv || 0}
                prefix="RM"
                precision={2}
                valueStyle={{ color: METRIC_COLORS[0], fontSize: 20 }}
              />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Statistic
                title="商品成交件数"
                value={filtered?.item_count || 0}
                valueStyle={{ color: METRIC_COLORS[1], fontSize: 20 }}
              />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Statistic
                title="SKU 订单数"
                value={filtered?.sku_count || 0}
                valueStyle={{ color: METRIC_COLORS[2], fontSize: 20 }}
              />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Statistic
                title="订单数"
                value={filtered?.order_count || 0}
                prefix={<ShoppingCartOutlined style={{ fontSize: 16 }} />}
                valueStyle={{ color: METRIC_COLORS[3], fontSize: 20 }}
              />
            </Col>
          </Row>

          {/* Status pills */}
          <Row gutter={[16, 8]} style={{ marginTop: 16 }}>
            {[
              { label: '待发货', value: stats?.pending_ship, color: '#faad14' },
              { label: '申请取消', value: stats?.cancel_requested, color: '#ff4d4f' },
              { label: '退货/退款', value: stats?.refund_requested, color: '#ff4d4f' },
              { label: '今日GMV', value: stats?.today?.gmv, color: BRAND_COLOR, prefix: 'RM ' },
              { label: '今日订单', value: stats?.today?.order_count, color: '#52c41a' },
            ].map(item => (
              <Col key={item.label} xs="auto">
                <Tag color={item.color} style={{ fontSize: 12, padding: '2px 10px' }}>
                  {item.label}: <strong>{typeof item.value === 'number' ? item.value.toLocaleString() : '—'}</strong>
                  {item.prefix === 'RM ' && item.value ? ` RM ${Number(item.value).toFixed(2)}` : ''}
                </Tag>
              </Col>
            ))}
          </Row>

          {/* ECharts Trend Chart */}
          <div style={{ marginTop: 24 }}>
            {stats?.trend?.length > 0 ? (
              <div ref={chartRef} style={{ width: '100%', height: 320 }} />
            ) : (
              <div style={{ textAlign: 'center', color: '#ccc', padding: 40 }}>
                <DollarOutlined style={{ fontSize: 32 }} />
                <div style={{ marginTop: 8, fontSize: 13 }}>暂无趋势数据，新建订单后自动展示</div>
              </div>
            )}
          </div>

          {/* Date range info */}
          {filtered?.date_from && filtered?.date_to && (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#999', marginTop: 8 }}>
              {isSingleDay
                ? `查看日期: ${filtered.date_from}（小时粒度${stats?.trend?.some((d: any) => d.prev_gmv > 0) ? '，含昨日对比' : ''}）`
                : `查看区间: ${filtered.date_from} ~ ${filtered.date_to}（日粒度，共 ${stats?.trend?.length || 0} 天）`}
            </div>
          )}
        </Card>
      </Spin>

      {/* Add / Edit Modal */}
      <Modal
        title={editShop ? '编辑店铺' : '绑定新店铺'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        width={640}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Button
              type="dashed"
              icon={<LinkOutlined />}
              onClick={async () => {
                try {
                  const res = await api.post('/shops/tiktok/auth-url');
                  if (res.data.auth_url) {
                    window.open(res.data.auth_url, '_blank', 'width=800,height=700');
                    message.info('已打开 TikTok 授权页面，授权完成后店铺将自动添加到列表');
                  }
                } catch (e: any) {
                  message.error(e.response?.data?.error || '获取授权链接失败');
                }
              }}
            >
              一键授权 TikTok Shop
            </Button>
            <div>
              <CancelBtn />
              <OkBtn />
            </div>
          </div>
        )}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="店铺名称" rules={[{ required: true, message: '请填写店铺名称' }]}>
            <Input placeholder="例：Freshguard MY Store" />
          </Form.Item>
          <Form.Item name="region" label="市场/地区">
            <Select>
              {Object.entries(REGION_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v} ({k})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="shop_id" label="TikTok Shop ID（可选）">
            <Input placeholder="TikTok 后台的 Shop ID" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="active">运营中</Select.Option>
              <Select.Option value="inactive">已停用</Select.Option>
              <Select.Option value="pending">待授权</Select.Option>
            </Select>
          </Form.Item>

          <Divider plain style={{ fontSize: 13, color: '#999' }}>
            <LinkOutlined style={{ marginRight: 6 }} />TikTok Partner Center API 凭证
          </Divider>

          <Form.Item name="app_key" label="App Key">
            <Input placeholder="Partner Center 应用的 App Key" />
          </Form.Item>
          <Form.Item name="app_secret" label="App Secret">
            <Input.Password placeholder="Partner Center 应用的 App Secret" />
          </Form.Item>
          <Form.Item name="access_token" label="Access Token">
            <Input.Password placeholder="OAuth 授权后的 Access Token" />
          </Form.Item>
          <Form.Item name="shop_cipher" label="Shop Cipher（店铺密钥）">
            <Input placeholder="授权店铺后获取的 Shop Cipher" />
          </Form.Item>
          <Form.Item name="api_version" label="API 版本">
            <Select>
              <Select.Option value="202309">202309（基础订单/商品）</Select.Option>
              <Select.Option value="202406">202406（+外部订单引用）</Select.Option>
              <Select.Option value="202407">202407（+价格详情）</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="sync_enabled" label="启用订单同步" valuePropName="checked">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item name="product_sync_enabled" label="启用产品同步" valuePropName="checked">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
