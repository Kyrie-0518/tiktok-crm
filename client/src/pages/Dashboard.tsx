import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Spin, Tag, Button, Result } from 'antd';
import {
  ShoppingCartOutlined, AppstoreOutlined, UserOutlined,
  DollarOutlined, ReloadOutlined, DashboardOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import api from '../api';

interface DashboardData {
  cards: {
    total_orders: number;
    today_orders: number;
    total_products: number;
    total_influencers: number;
    total_revenue_myr: number;
  };
  order_trend: Array<{ date: string; order_count: number; revenue_myr: number }>;
  profit_overview: {
    total_profit_rmb: number;
    total_investment_rmb: number;
    overall_roi: number;
    product_with_records: number;
  };
  top_products: Array<{
    id: number; name: string; sku: string; image: string;
    sell_price: number; total_qty: number; total_sales_myr: number; order_times: number;
  }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || '未知错误';
      console.error('[Dashboard]', msg);
      setError(msg);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!data?.order_trend) return;
    const chartDom = document.getElementById('dashboard-order-trend');
    if (!chartDom) return;
    const chart = echarts.init(chartDom);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(6,182,212,0.3)',
        borderWidth: 1,
        textStyle: { color: '#333', fontSize: 13 },
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      },
      legend: {
        data: ['订单数', '营收(MYR)'],
        bottom: 0,
        textStyle: { fontSize: 12, color: '#999' },
        itemWidth: 14,
        itemHeight: 8,
        itemGap: 20,
      },
      grid: { left: '5%', right: '5%', top: '8%', bottom: '12%' },
      xAxis: {
        type: 'category',
        data: data.order_trend.map(d => d.date.slice(5)),
        axisLine: { lineStyle: { color: '#f0f0f0' } },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: '#999' },
      },
      yAxis: [
        {
          type: 'value',
          name: '单',
          nameTextStyle: { color: '#999', fontSize: 11 },
          splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
          axisLabel: { fontSize: 11, color: '#999' },
        },
        {
          type: 'value',
          name: 'RM',
          nameTextStyle: { color: '#999', fontSize: 11 },
          splitLine: { show: false },
          axisLabel: { fontSize: 11, color: '#999', formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v) },
        },
      ],
      series: [
        {
          name: '订单数',
          type: 'bar',
          barWidth: 16,
          barMaxWidth: 32,
          data: data.order_trend.map(d => d.order_count),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#2563eb' },
              { offset: 1, color: '#1d4ed8' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: { color: '#2563eb' },
          },
        },
        {
          name: '营收(MYR)',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: data.order_trend.map(d => d.revenue_myr),
          lineStyle: { color: '#06b6d4', width: 2, shadowBlur: 8, shadowColor: 'rgba(6,182,212,0.3)' },
          itemStyle: { color: '#06b6d4' },
          symbol: 'circle',
          symbolSize: 5,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(6,182,212,0.2)' },
              { offset: 1, color: 'rgba(6,182,212,0)' },
            ]),
          },
        },
      ],
    });
    return () => chart.dispose();
  }, [data]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="加载仪表盘数据..." /></div>;
  if (error || !data) return (
    <Result
      status="error"
      title="加载失败"
      subTitle={error || '请刷新重试'}
      extra={
        <Button type="primary" icon={<ReloadOutlined />} onClick={fetchDashboard}>
          重新加载
        </Button>
      }
    />
  );

  // ========== 4张统计卡片 ==========
  const statCards = [
    { title: '总订单数', value: data.cards.total_orders, suffix: ` (今日+${data.cards.today_orders})`, icon: <ShoppingCartOutlined />, color: '#2563eb' },
    { title: '总产品数', value: data.cards.total_products, icon: <AppstoreOutlined />, color: '#059669' },
    { title: '总达人数', value: data.cards.total_influencers, icon: <UserOutlined />, color: '#dc2626' },
    { title: '总收入', value: data.cards.total_revenue_myr, prefix: 'RM ', icon: <DollarOutlined />, color: '#f59e0b' },
  ];

  return (
    <div style={{ padding: '20px 24px', background: '#f5f3f0', minHeight: '100%' }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18,
        }}>
          <DashboardOutlined />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>数据概览</h2>
          <span style={{ fontSize: 12, color: '#999' }}>订单 · 产品 · 达人 · 收入</span>
        </div>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {statCards.map((s, i) => (
          <Col xs={12} sm={6} key={i}>
            <Card
              size="small"
              hoverable
              style={{
                borderTop: `2px solid ${s.color}`,
                borderRadius: 10,
                background: '#ffffff',
                borderColor: '#f0f0f0',
                boxShadow: `0 0 20px ${s.color}15`,
              }}
            >
              <Statistic
                title={<span style={{ color: '#666' }}>{s.title}</span>}
                value={s.value}
                suffix={s.suffix}
                prefix={s.prefix}
                valueStyle={{ color: s.color, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 订单趋势 + 利润概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ color: '#333' }}>近30天订单趋势</span>}
            size="small"
            variant="borderless"
            style={{ borderRadius: 12, background: '#ffffff', border: '1px solid #e8e5e0' }}
          >
            <div id="dashboard-order-trend" style={{ width: '100%', height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={<span style={{ color: '#333' }}>利润概览</span>}
            size="small"
            variant="borderless"
            style={{ borderRadius: 12, background: '#ffffff', border: '1px solid #e8e5e0' }}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: '#666' }}>总净利润</span>}
                  value={data.profit_overview.total_profit_rmb}
                  precision={2}
                  prefix="¥ "
                  valueStyle={{
                    color: data.profit_overview.total_profit_rmb >= 0 ? '#059669' : '#dc2626',
                    fontWeight: 600,
                  }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: '#666' }}>整体ROI</span>}
                  value={data.profit_overview.overall_roi}
                  precision={2}
                  suffix="%"
                  valueStyle={{ color: '#2563eb', fontWeight: 600 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: '#666' }}>总投入</span>}
                  value={data.profit_overview.total_investment_rmb}
                  precision={2}
                  prefix="¥ "
                  valueStyle={{ color: '#666' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="核算产品"
                  value={data.profit_overview.product_with_records}
                  suffix=" 个"
                  valueStyle={{ color: '#f59e0b' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Top10 热销产品 */}
      <Card
        title={<span style={{ color: '#333' }}>Top 10 热销产品</span>}
        size="small"
        variant="borderless"
        style={{ borderRadius: 12, background: '#ffffff', border: '1px solid #e8e5e0' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={data.top_products}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '排名', width: 60, render: (_: any, __: any, i: number) => (
              <Tag color={i < 3 ? 'gold' : 'default'} style={{ borderRadius: 6 }}>{i + 1}</Tag>
            )},
            { title: '产品名称', dataIndex: 'name', ellipsis: true },
            { title: 'SKU', dataIndex: 'sku', width: 120, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
            { title: '售价', dataIndex: 'sell_price', width: 90, render: (v: number) => v ? `RM${v.toFixed(2)}` : '-' },
            { title: '销量', dataIndex: 'total_qty', width: 70 },
            { title: '销售额', dataIndex: 'total_sales_myr', width: 100, render: (v: number) => v ? `RM${v.toFixed(2)}` : '-' },
            { title: '下单次数', dataIndex: 'order_times', width: 80 },
          ]}
        />
      </Card>
    </div>
  );
}
