import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Typography, Row, Col, Select, Input, Tabs, Statistic, Progress, Button, Space } from 'antd';
import {
  PictureOutlined, RiseOutlined, PlayCircleOutlined,
  StopOutlined, EyeOutlined, ThunderboltOutlined,
  DollarOutlined, ShoppingCartOutlined, BarChartOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';

const { Text, Title } = Typography;
const BRAND = '#2563eb';

interface Creative {
  id: string;
  name: string;
  campaign: string;
  type: '视频' | '图片';
  status: '投放中' | '暂停' | '已移除' | '未投放';
  spend: number;
  orders: number;
  revenue: number;
  roi: number;
  cpa: number;
  impressions: number;
  clicks: number;
  ctr: number;
  play_rate: number;
  shop: string;
  duration?: string;
}

const AdCreatives: React.FC = () => {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');

  useEffect(() => { loadCreatives(); }, []);

  const loadCreatives = async () => {
    setLoading(true);
    try {
      const mock: Creative[] = Array.from({ length: 20 }, (_, i) => ({
        id: `cr_${i}`,
        name: `创意素材-${String.fromCharCode(65 + i)}_v${Math.floor(Math.random() * 3) + 1}`,
        campaign: `系列${String.fromCharCode(65 + (i % 8))}`,
        type: i % 3 === 0 ? '图片' : '视频',
        status: (['投放中', '投放中', '投放中', '暂停', '已移除', '未投放'] as const)[i % 6],
        spend: Math.round((5 + Math.random() * 200) * 100) / 100,
        orders: Math.floor(Math.random() * 25),
        revenue: Math.round((10 + Math.random() * 800) * 100) / 100,
        roi: Math.round((0.5 + Math.random() * 6) * 100) / 100,
        cpa: Math.round((10 + Math.random() * 80) * 100) / 100,
        impressions: Math.floor(500 + Math.random() * 10000),
        clicks: Math.floor(10 + Math.random() * 300),
        ctr: Math.round((0.3 + Math.random() * 8) * 100) / 100,
        play_rate: Math.round((30 + Math.random() * 70) * 100) / 100,
        shop: i % 2 === 0 ? '官方旗舰店' : '东南亚跨境店',
        duration: i % 3 === 0 ? undefined : `${Math.floor(15 + Math.random() * 45)}s`,
      }));
      setCreatives(mock);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const chartDom = document.getElementById('creative-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom);
    const top10 = [...creatives].filter(c => c.spend > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['ROI', '花费'], bottom: 0, textStyle: { color: '#64748b', fontSize: 11 } },
      grid: { top: 10, left: 120, right: 40, bottom: 30 },
      xAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      yAxis: {
        type: 'category',
        data: top10.map(c => c.name.substring(0, 12)),
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      series: [
        { name: '花费', type: 'bar', data: top10.map(c => c.spend), itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] }, barWidth: 10, barGap: '20%' },
        { name: 'ROI', type: 'bar', data: top10.map(c => c.roi), itemStyle: { color: '#059669', borderRadius: [0, 4, 4, 0] }, barWidth: 10 },
      ],
    });
    return () => chart.dispose();
  }, [creatives]);

  const filtered = creatives.filter(c => {
    if (searchText && !c.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'running') return c.status === '投放中';
    if (activeTab === 'paused') return c.status === '暂停';
    if (activeTab === 'removed') return c.status === '已移除';
    return true;
  });

  const totals = {
    running: creatives.filter(c => c.status === '投放中').length,
    spend: filtered.reduce((s, c) => s + c.spend, 0),
    orders: filtered.reduce((s, c) => s + c.orders, 0),
    revenue: filtered.reduce((s, c) => s + c.revenue, 0),
    avgCtr: filtered.length > 0 ? filtered.reduce((s, c) => s + c.ctr, 0) / filtered.length : 0,
  };

  const statusConfig: Record<string, { color: string; text: string }> = {
    '投放中': { color: 'blue', text: '投放中' },
    '暂停': { color: 'orange', text: '暂停' },
    '已移除': { color: 'red', text: '已移除' },
    '未投放': { color: 'default', text: '未投放' },
  };

  const columns = [
    {
      title: '素材名称', key: 'name', width: 200, fixed: 'left' as const,
      render: (_: any, r: Creative) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 56, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {r.type === '视频' ? <PlayCircleOutlined style={{ color: BRAND, fontSize: 18 }} /> : <PictureOutlined style={{ color: '#d97706', fontSize: 18 }} />}
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.3 }}>{r.name}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <Tag color={r.type === '视频' ? 'purple' : 'cyan'} style={{ fontSize: 10, lineHeight: '16px' }}>{r.type}{r.duration ? ` ${r.duration}` : ''}</Tag>
              <Tag style={{ fontSize: 10, lineHeight: '16px' }}>{r.shop}</Tag>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '系列', dataIndex: 'campaign', key: 'campaign', width: 100,
      render: (v: string) => <Tag color="geekblue" style={{ fontSize: 11 }}>{v}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => {
        const cfg = statusConfig[v];
        return <Tag color={cfg?.color} style={{ fontSize: 11 }}>{cfg?.text}</Tag>;
      },
    },
    {
      title: '展现量', dataIndex: 'impressions', key: 'impressions', width: 90, sorter: (a: Creative, b: Creative) => a.impressions - b.impressions,
      render: (v: number) => <Text>{v.toLocaleString()}</Text>,
    },
    {
      title: 'CTR', dataIndex: 'ctr', key: 'ctr', width: 70, sorter: (a: Creative, b: Creative) => a.ctr - b.ctr,
      render: (v: number) => (
        <Text style={{ color: v > 3 ? '#059669' : v > 1 ? '#d97706' : '#dc2626' }}>{v.toFixed(1)}%</Text>
      ),
    },
    {
      title: '花费', dataIndex: 'spend', key: 'spend', width: 80, sorter: (a: Creative, b: Creative) => a.spend - b.spend,
      render: (v: number) => <Text>${v.toFixed(2)}</Text>,
    },
    {
      title: '订单', dataIndex: 'orders', key: 'orders', width: 60, sorter: (a: Creative, b: Creative) => a.orders - b.orders,
      render: (v: number) => <Text>{v}</Text>,
    },
    {
      title: 'CPA', dataIndex: 'cpa', key: 'cpa', width: 80, sorter: (a: Creative, b: Creative) => a.cpa - b.cpa,
      render: (v: number) => <Text style={{ color: v > 50 ? '#dc2626' : '#059669' }}>${v.toFixed(2)}</Text>,
    },
    {
      title: 'ROI', dataIndex: 'roi', key: 'roi', width: 70, sorter: (a: Creative, b: Creative) => a.roi - b.roi,
      render: (v: number) => <Text strong style={{ color: v >= 2 ? '#059669' : '#dc2626' }}>{v.toFixed(1)}x</Text>,
    },
    {
      title: '播放率', dataIndex: 'play_rate', key: 'play_rate', width: 80,
      render: (v: number) => v ? <Progress percent={Math.round(v)} size="small" strokeColor={BRAND} /> : <Text type="secondary">-</Text>,
    },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: () => (
        <Space size="small">
          <Button size="small" type="link" icon={<EyeOutlined />} style={{ fontSize: 12 }}>详情</Button>
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: 'all', label: `全部 (${creatives.length})` },
    { key: 'running', label: `投放中 (${creatives.filter(c => c.status === '投放中').length})` },
    { key: 'paused', label: `暂停 (${creatives.filter(c => c.status === '暂停').length})` },
    { key: 'removed', label: `已移除 (${creatives.filter(c => c.status === '已移除').length})` },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* 标题区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${BRAND}, #60a5fa)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PictureOutlined style={{ color: '#fff', fontSize: 16 }} />
        </div>
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0, color: '#1e293b' }}>素材分析</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>广告素材效果追踪与创意洞察</Text>
        </div>
      </div>

      {/* 概览卡 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: '投放中素材', value: totals.running, color: BRAND, icon: <PlayCircleOutlined /> },
          { label: '总花费', value: `$${totals.spend.toFixed(0)}`, color: '#3b82f6', icon: <DollarOutlined /> },
          { label: '总订单', value: totals.orders, color: '#059669', icon: <ShoppingCartOutlined /> },
          { label: '总收入', value: `$${totals.revenue.toFixed(0)}`, color: '#d97706', icon: <RiseOutlined /> },
          { label: '平均CTR', value: `${totals.avgCtr.toFixed(1)}%`, color: '#8b5cf6', icon: <BarChartOutlined /> },
        ].map((card, i) => (
          <Col xs={24} sm={12} md={8} lg={Math.floor(24 / 5)} key={i}>
            <Card size="small" style={{ borderRadius: 8, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${card.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {React.cloneElement(card.icon as React.ReactElement, { style: { color: card.color, fontSize: 14 } })}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{card.label}</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: card.color }}>{card.value}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 图表 + 表格 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={<span><BarChartOutlined style={{ color: BRAND, marginRight: 8 }} />Top 素材 ROI</span>}
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', height: '100%' }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            <div id="creative-chart" style={{ height: 360 }} />
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabItems}
              style={{ marginBottom: 0 }}
              tabBarExtraContent={
                <Input.Search
                  placeholder="搜索素材..."
                  allowClear
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  style={{ width: 200 }}
                  size="small"
                />
              }
            />
            <Table
              dataSource={filtered}
              columns={columns as any}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
              size="small"
              scroll={{ x: 1100 }}
              style={{ borderRadius: 8, marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdCreatives;
