import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Typography, Row, Col, Select, Input, Space, Switch, Badge } from 'antd';
import {
  AppstoreOutlined, DollarOutlined, ShoppingCartOutlined,
  RiseOutlined, SearchOutlined, FilterOutlined, SettingOutlined,
  PlayCircleOutlined, PauseCircleOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;
const BRAND = '#2563eb';

interface Campaign {
  id: string;
  name: string;
  shop: string;
  ad_account: string;
  rule_group: string | null;
  enabled: boolean;
  budget: number;
  target_roi: number;
  spend: number;
  orders: number;
  cpa: number;
  revenue: number;
  roi: number;
  impressions: number;
  clicks: number;
  ctr: number;
  status: '投放中' | '暂停中';
  type: '商品' | '直播';
}

const AdCampaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('全部');
  const [typeFilter, setTypeFilter] = useState<string>('全部');

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      // TODO: 接入真实API
      const mock: Campaign[] = Array.from({ length: 12 }, (_, i) => ({
        id: `cmp_${i}`,
        name: `智能投放系列${String.fromCharCode(65 + i)}`,
        shop: i < 6 ? '官方旗舰店' : '东南亚跨境店',
        ad_account: i < 8 ? '主投放账户' : '测试账户',
        rule_group: i % 3 === 0 ? null : `规则组${(i % 3)}`,
        enabled: i % 5 !== 0,
        budget: 50 + Math.floor(Math.random() * 200),
        target_roi: 2.5 + Math.random() * 3,
        spend: Math.round((100 + Math.random() * 900) * 100) / 100,
        orders: Math.floor(Math.random() * 50),
        cpa: Math.round((20 + Math.random() * 60) * 100) / 100,
        revenue: Math.round((200 + Math.random() * 3000) * 100) / 100,
        roi: Math.round((2 + Math.random() * 5) * 100) / 100,
        impressions: Math.floor(1000 + Math.random() * 20000),
        clicks: Math.floor(50 + Math.random() * 500),
        ctr: Math.round((0.5 + Math.random() * 10) * 100) / 100,
        status: i % 4 === 0 ? '暂停中' : '投放中',
        type: i % 3 === 0 ? '直播' : '商品',
      }));
      setCampaigns(mock);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = campaigns.filter(c => {
    if (searchText && !c.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (statusFilter !== '全部' && c.status !== statusFilter) return false;
    if (typeFilter !== '全部' && c.type !== typeFilter) return false;
    return true;
  });

  const totals = {
    spend: filtered.reduce((s, c) => s + c.spend, 0),
    orders: filtered.reduce((s, c) => s + c.orders, 0),
    revenue: filtered.reduce((s, c) => s + c.revenue, 0),
    roi: filtered.length > 0 ? filtered.reduce((s, c) => s + c.revenue, 0) / filtered.reduce((s, c) => s + c.spend, 0) : 0,
    cpa: filtered.length > 0 ? filtered.reduce((s, c) => s + c.spend, 0) / filtered.reduce((s, c) => s + c.orders, 0) : 0,
  };

  const columns = [
    {
      title: '系列信息', key: 'info', width: 240, fixed: 'left' as const,
      render: (_: any, r: Campaign) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Switch checked={r.enabled} size="small" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <Tag style={{ fontSize: 10, lineHeight: '16px' }}>{r.shop}</Tag>
              <Tag color={r.type === '直播' ? 'purple' : 'blue'} style={{ fontSize: 10, lineHeight: '16px' }}>{r.type}</Tag>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '规则组', dataIndex: 'rule_group', key: 'rule_group', width: 100,
      render: (v: string | null) => v ? <Tag color="geekblue">{v}</Tag> : <Tag color="default">未绑定</Tag>,
    },
    {
      title: '预算', dataIndex: 'budget', key: 'budget', width: 80, sorter: (a: Campaign, b: Campaign) => a.budget - b.budget,
      render: (v: number) => <Text strong>${v}</Text>,
    },
    {
      title: '目标ROI', dataIndex: 'target_roi', key: 'target_roi', width: 80,
      render: (v: number) => <Text style={{ color: BRAND }}>{v.toFixed(1)}x</Text>,
    },
    {
      title: '花费', dataIndex: 'spend', key: 'spend', width: 90, sorter: (a: Campaign, b: Campaign) => a.spend - b.spend,
      render: (v: number) => <Text style={{ color: '#3b82f6' }}>${v.toFixed(2)}</Text>,
    },
    {
      title: '订单', dataIndex: 'orders', key: 'orders', width: 70, sorter: (a: Campaign, b: Campaign) => a.orders - b.orders,
      render: (v: number) => <Text>{v}</Text>,
    },
    {
      title: 'CPA', dataIndex: 'cpa', key: 'cpa', width: 80, sorter: (a: Campaign, b: Campaign) => a.cpa - b.cpa,
      render: (v: number) => <Text style={{ color: v > 50 ? '#dc2626' : '#059669' }}>${v.toFixed(2)}</Text>,
    },
    {
      title: '收入', dataIndex: 'revenue', key: 'revenue', width: 90, sorter: (a: Campaign, b: Campaign) => a.revenue - b.revenue,
      render: (v: number) => <Text style={{ color: '#059669' }}>${v.toFixed(2)}</Text>,
    },
    {
      title: 'ROI', dataIndex: 'roi', key: 'roi', width: 80, sorter: (a: Campaign, b: Campaign) => a.roi - b.roi,
      render: (v: number, r: Campaign) => (
        <Text strong style={{ color: v >= r.target_roi ? '#059669' : '#dc2626' }}>
          {v.toFixed(1)}x
        </Text>
      ),
    },
    {
      title: '展现/点击', key: 'reach', width: 110,
      render: (_: any, r: Campaign) => (
        <div style={{ fontSize: 12 }}>
          <div><Text style={{ color: '#94a3b8' }}>展</Text> {r.impressions.toLocaleString()}</div>
          <div><Text style={{ color: '#94a3b8' }}>点</Text> {r.clicks} ({r.ctr}%)</div>
        </div>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => (
        <Badge status={v === '投放中' ? 'processing' : 'default'} text={v} style={{ fontSize: 12 }} />
      ),
    },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: () => (
        <Space size="small">
          <Button size="small" type="link" icon={<SettingOutlined />} style={{ color: BRAND, fontSize: 12 }}>详情</Button>
        </Space>
      ),
    },
  ];

  const statCards = [
    { title: '总花费', value: totals.spend, prefix: '$', icon: <DollarOutlined />, color: '#3b82f6' },
    { title: '总订单', value: totals.orders, prefix: '', icon: <ShoppingCartOutlined />, color: '#059669' },
    { title: '总收入', value: totals.revenue, prefix: '$', icon: <RiseOutlined />, color: '#2563eb' },
    { title: '综合ROI', value: totals.roi, prefix: '', icon: <AppstoreOutlined />, color: '#d97706', suffix: 'x' },
    { title: '平均CPA', value: totals.cpa, prefix: '$', icon: <DollarOutlined />, color: '#dc2626' },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* 标题区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${BRAND}, #60a5fa)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AppstoreOutlined style={{ color: '#fff', fontSize: 16 }} />
        </div>
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0, color: '#1e293b' }}>系列管理</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>GMV Max 广告系列数据监控与管理</Text>
        </div>
        <Button icon={<PlayCircleOutlined />} type="primary" style={{ borderRadius: 8, background: BRAND }}>新建系列</Button>
      </div>

      {/* KPI统计卡 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {statCards.map((card, i) => (
          <Col xs={12} sm={8} md={4} lg={Math.floor(24 / statCards.length)} key={i}>
            <Card
              size="small"
              style={{ borderRadius: 8, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              bodyStyle={{ padding: '14px 16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${card.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {React.cloneElement(card.icon as React.ReactElement, { style: { color: card.color, fontSize: 14 } })}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{card.title}</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: card.color }}>
                    {card.prefix}{typeof card.value === 'number' ? card.value.toLocaleString(undefined, card.value % 1 !== 0 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {}) : card.value}{card.suffix}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 筛选 + 表格 */}
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="搜索系列名称..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 220, borderRadius: 8 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 110, borderRadius: 8 }}
            options={[
              { value: '全部', label: '全部状态' },
              { value: '投放中', label: '投放中' },
              { value: '暂停中', label: '暂停中' },
            ]}
          />
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 110, borderRadius: 8 }}
            options={[
              { value: '全部', label: '全部类型' },
              { value: '商品', label: '商品' },
              { value: '直播', label: '直播' },
            ]}
          />
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            共 <Text strong style={{ color: BRAND }}>{filtered.length}</Text> 个系列
          </Text>
        </div>
        <Table
          dataSource={filtered}
          columns={columns as any}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          size="small"
          scroll={{ x: 1400 }}
          style={{ borderRadius: 8 }}
        />
      </Card>
    </div>
  );
};

export default AdCampaigns;
