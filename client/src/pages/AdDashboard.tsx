import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Select, DatePicker, Table, Tag, Typography } from 'antd';
import {
  FundOutlined, ShoppingCartOutlined, DollarOutlined,
  RiseOutlined, FallOutlined, ThunderboltOutlined,
  ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const BRAND = '#2563eb';

interface DashboardData {
  today_spend: number;
  today_orders: number;
  today_revenue: number;
  today_roi: number;
  today_cpa: number;
  trend: { date: string; spend: number; revenue: number; orders: number; roi: number }[];
  top_campaigns: { name: string; spend: number; revenue: number; roi: number; status: string }[];
}

const AdDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(7, 'day'), dayjs()]);

  useEffect(() => { loadData(); }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      // TODO: 接入真实API
      const mock: DashboardData = {
        today_spend: 1250.50,
        today_orders: 38,
        today_revenue: 4520.80,
        today_roi: 3.62,
        today_cpa: 32.91,
        trend: Array.from({ length: 7 }, (_, i) => {
          const spend = 800 + Math.random() * 1000;
          const revenue = spend * (2 + Math.random() * 3);
          return {
            date: dayjs().subtract(6 - i, 'day').format('MM-DD'),
            spend: Math.round(spend * 100) / 100,
            revenue: Math.round(revenue * 100) / 100,
            orders: Math.floor(20 + Math.random() * 40),
            roi: Math.round((revenue / spend) * 100) / 100,
          };
        }),
        top_campaigns: [
          { name: '智能投放系列A', spend: 420, revenue: 1680, roi: 4.0, status: '投放中' },
          { name: '素材测试系列B', spend: 310, revenue: 992, roi: 3.2, status: '投放中' },
          { name: '高ROI优化C', spend: 180, revenue: 972, roi: 5.4, status: '投放中' },
          { name: '品牌推广D', spend: 220, revenue: 616, roi: 2.8, status: '暂停' },
          { name: '新品测试E', spend: 120.5, revenue: 260.8, roi: 2.16, status: '投放中' },
        ],
      };
      setData(mock);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!data) return;
    const chartDom = document.getElementById('ad-trend-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom);
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['花费', '收入', 'ROI'], bottom: 0, textStyle: { color: '#64748b', fontSize: 12 } },
      grid: { top: 20, left: 10, right: 50, bottom: 35 },
      xAxis: { type: 'category', data: data.trend.map(d => d.date), axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#94a3b8' } },
      yAxis: [
        { type: 'value', name: '金额($)', nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
        { type: 'value', name: 'ROI', nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { show: false } },
      ],
      series: [
        { name: '花费', type: 'bar', data: data.trend.map(d => d.spend), itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] }, barWidth: 16 },
        { name: '收入', type: 'bar', data: data.trend.map(d => d.revenue), itemStyle: { color: '#059669', borderRadius: [4, 4, 0, 0] }, barWidth: 16 },
        { name: 'ROI', type: 'line', yAxisIndex: 1, data: data.trend.map(d => d.roi), lineStyle: { color: '#d97706', width: 2 }, itemStyle: { color: '#d97706' }, symbol: 'circle', symbolSize: 6 },
      ],
    });
    return () => chart.dispose();
  }, [data]);

  const statCards = [
    { title: '今日花费', value: data?.today_spend ?? 0, prefix: '$', icon: <DollarOutlined />, color: '#3b82f6', bg: '#eff6ff' },
    { title: '今日订单', value: data?.today_orders ?? 0, prefix: '', icon: <ShoppingCartOutlined />, color: '#059669', bg: '#ecfdf5' },
    { title: '今日收入', value: data?.today_revenue ?? 0, prefix: '$', icon: <FundOutlined />, color: '#2563eb', bg: '#eef2ff' },
    { title: '今日ROI', value: data?.today_roi ?? 0, prefix: '', icon: <RiseOutlined />, color: '#d97706', bg: '#fffbeb', suffix: 'x' },
    { title: '今日CPA', value: data?.today_cpa ?? 0, prefix: '$', icon: <FallOutlined />, color: '#dc2626', bg: '#fef2f2' },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* 标题区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${BRAND}, #60a5fa)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FundOutlined style={{ color: '#fff', fontSize: 16 }} />
        </div>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1e293b' }}>广告仪表盘</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>TK GMV Max 广告数据全景监控</Text>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <DatePicker.RangePicker
            value={dateRange as any}
            onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            style={{ borderRadius: 8 }}
          />
        </div>
      </div>

      <Spin spinning={loading}>
        {/* 核心指标卡 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {statCards.map((card, i) => (
            <Col xs={24} sm={12} lg={Math.floor(24 / statCards.length)} key={i}>
              <Card
                style={{ borderRadius: 10, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>{card.title}</Text>
                    <div style={{ fontSize: 28, fontWeight: 700, color: card.color, marginTop: 4 }}>
                      {card.prefix}{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}{card.suffix}
                    </div>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {React.cloneElement(card.icon as React.ReactElement, { style: { color: card.color, fontSize: 20 } })}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <Text type="secondary">环比 </Text>
                  <Text style={{ color: Math.random() > 0.5 ? '#059669' : '#dc2626', fontWeight: 500 }}>
                    {Math.random() > 0.5 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    {(Math.random() * 20).toFixed(1)}%
                  </Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* 趋势图 + Top系列 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={16}>
            <Card
              title={<span><RiseOutlined style={{ color: BRAND, marginRight: 8 }} />近7天趋势</span>}
              style={{ borderRadius: 10, height: '100%', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              <div id="ad-trend-chart" style={{ height: 300 }} />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card
              title={<span><ThunderboltOutlined style={{ color: BRAND, marginRight: 8 }} />Top 系列</span>}
              style={{ borderRadius: 10, height: '100%', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              bodyStyle={{ padding: '12px 20px' }}
            >
              <Table
                dataSource={data?.top_campaigns ?? []}
                rowKey="name"
                size="small"
                pagination={false}
                showHeader={false}
                columns={[
                  {
                    title: '系列', dataIndex: 'name', key: 'name',
                    render: (name: string, record: any) => (
                      <div>
                        <div style={{ fontWeight: 500 }}>{name}</div>
                        <Tag color={record.status === '投放中' ? 'blue' : 'default'} style={{ fontSize: 11, lineHeight: '18px' }}>{record.status}</Tag>
                      </div>
                    ),
                  },
                  { title: '花费', dataIndex: 'spend', key: 'spend', align: 'right', render: (v: number) => <Text style={{ fontSize: 12 }}>${v.toLocaleString()}</Text> },
                  { title: 'ROI', dataIndex: 'roi', key: 'roi', align: 'right', render: (v: number) => <Text strong style={{ color: v >= 3 ? '#059669' : '#d97706', fontSize: 13 }}>{v.toFixed(1)}x</Text> },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default AdDashboard;
