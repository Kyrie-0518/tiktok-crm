import React, { useState } from 'react';
import { Card, Button, Typography, Table, Tag, Row, Col, Space, Switch, Collapse, message, Select } from 'antd';
import { ThunderboltOutlined, BarChartOutlined, ReloadOutlined, CodeOutlined } from '@ant-design/icons';
import api from '../../api';

const { Text, Title } = Typography;

const DS = { bg: '#f5f3f0', cardBg: '#FFFFFF', cardBorder: '#e8e5e0', primary: '#2563eb', text: '#1A1A2E', textSecondary: '#6B7280', radius: 12 };

const CATEGORIES = [
  { key: 'shop', label: '店铺', fields: ['shop_id', 'shop_name', 'shop_type', 'region', 'create_time', 'status'] },
  { key: 'product', label: '商品', fields: ['product_id', 'title', 'price', 'brand', 'category', 'status', 'main_image'] },
  { key: 'pricing', label: '价格', fields: ['original_price', 'price', 'sku_price', 'seller_coupons', 'flash_sales', 'free_shipping'] },
  { key: 'inventory', label: '库存', fields: ['total_stock', 'available_stock', 'overseas_stock', 'cross_border_stock', 'warehouse_name'] },
  { key: 'ads', label: '广告', fields: ['campaign_id', 'campaign_name', 'status', 'budget', 'spend', 'roas', 'impressions', 'clicks'] },
  { key: 'orders', label: '订单', fields: ['order_id', 'status', 'payment_amount', 'create_time', 'ship_time', 'delivery_time'] },
  { key: 'logistics', label: '物流', fields: ['warehouse_type', 'shipping_method', 'actual_delivery', 'avg_delivery_time', 'anomaly_rate'] },
  { key: 'videos', label: '视频', fields: ['video_id', 'views', 'likes', 'ctr', 'cvr', 'orders', 'gmv'] },
  { key: 'reviews', label: '评价', fields: ['review_id', 'rating', 'content', 'create_time'] },
];

export default function DataDebug() {
  const [selectedCat, setSelectedCat] = useState('shop');
  const [data, setData] = useState<any>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // 模拟调试数据（实际用真实 API）
      const res = await api.post('/growth-center/diagnose', {
        shop_cipher: 'test', shop_name: '调试模式', days: 7,
      }, { timeout: 60000 });
      setRawData(res.data);
      setData(res.data?.data_snapshot?.[selectedCat] || {});
      message.success('数据已加载');
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
    } finally { setLoading(false); }
  };

  const fakeData = [
    { field: 'shop_id', value: 'ROW_xxx', status: 'ok', source: 'ShopsGet', updated: '2026-07-21 14:30' },
    { field: 'shop_name', value: '测试店铺', status: 'ok', source: 'ShopsGet', updated: '2026-07-21 14:30' },
    { field: 'shop_type', value: 'cross_border', status: 'ok', source: 'ShopsGet', updated: '2026-07-21 14:30' },
    { field: 'region', value: 'US', status: 'ok', source: 'ShopsGet', updated: '2026-07-21 14:30' },
    { field: 'create_time', value: '2025-01-15', status: 'ok', source: 'ShopsGet', updated: '2026-07-21 14:30' },
    { field: 'status', value: 'ACTIVE', status: 'ok', source: 'ShopsGet', updated: '2026-07-21 14:30' },
  ];

  return (
    <div style={{ padding: 24, background: DS.bg, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, #8B5CF6, #A78BFA)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}><CodeOutlined /></div>
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: DS.text }}>数据调试 <Tag color="purple" style={{ marginLeft: 8 }}>管理员</Tag> <span style={{fontSize:10,color:"#2563eb",background:"#eff6ff",padding:"1px 6px",borderRadius:4,marginLeft:8,fontWeight:600}}>META</span></Title>
          <Text type="secondary" style={{ fontSize: 13 }}>验证数据采集接口，查看字段值和来源</Text>
        </div>
        <Space>
          <Select value={selectedCat} onChange={setSelectedCat} style={{ width: 120 }}
            options={CATEGORIES.map(c => ({ value: c.key, label: c.label }))} />
          <Button type="primary" icon={<ReloadOutlined />} onClick={loadData} loading={loading} style={{ borderRadius: 8 }}>拉取数据</Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="字段验证" style={{ borderRadius: DS.radius, border: `1px solid ${DS.cardBorder}` }}>
            <Table dataSource={fakeData} size="small" pagination={false}
              columns={[
                { title: '字段', dataIndex: 'field', key: 'field' },
                { title: '当前值', dataIndex: 'value', key: 'value' },
                { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'ok' ? 'green' : 'red'}>{v === 'ok' ? '✓' : '✗'}</Tag> },
                { title: '来源', dataIndex: 'source', key: 'source' },
                { title: '同步时间', dataIndex: 'updated', key: 'updated' },
              ]} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="原始 JSON" style={{ borderRadius: DS.radius, border: `1px solid ${DS.cardBorder}` }}>
            <pre style={{ fontSize: 11, maxHeight: 400, overflow: 'auto', background: '#F8FAFC', padding: 12, borderRadius: 8 }}>
              {rawData ? JSON.stringify(rawData, null, 2) : '点击"拉取数据"查看'}
            </pre>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
