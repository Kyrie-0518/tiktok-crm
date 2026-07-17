import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Table, Typography, Spin, Tag, Button, Result } from 'antd';
import {
  ShoppingCartOutlined, DollarOutlined, AppstoreOutlined, UserOutlined,
  ReloadOutlined, BarChartOutlined, TrophyOutlined, RiseOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import api from '../api';

const { Text, Title } = Typography;

// ═══════════════════ TYPES ═══════════════════
interface DashboardData {
  cards: {
    total_orders: number; today_orders: number;
    total_products: number; total_influencers: number; total_revenue_myr: number;
  };
  order_trend: Array<{ date: string; order_count: number; revenue_myr: number }>;
  profit_overview: { total_profit_rmb: number; total_investment_rmb: number; overall_roi: number; product_with_records: number; };
  top_products: Array<{
    id: number; name: string; sku: string; image: string;
    sell_price: number; total_qty: number; total_sales_myr: number; order_times: number;
  }>;
}

const T = {
  primary: '#4F6BFF', cardShadow: '0 8px 24px rgba(15,23,42,0.06)',
  cardBorder: '#E8ECF5', cardRadius: 20, textPrimary: '#1E293B',
  textSecondary: '#64748B', textTertiary: '#94A3B8',
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    try { setLoading(true); setError(null); const res = await api.get('/dashboard'); setData(res.data); }
    catch (e: any) { setError(e.response?.data?.error || e.message || '未知错误'); }
    finally { setLoading(false); }
  };

  // ── 衍生指标 ──
  const avgOrderValue = data ? data.cards.total_revenue_myr / Math.max(1, data.cards.total_orders) : 0;
  const totalSalesQty = data ? data.top_products.reduce((s, p) => s + (p.total_qty || 0), 0) : 0;
  const orderTrendRevenue = data?.order_trend.reduce((s, d) => s + d.revenue_myr, 0) || 0;
  const topProductName = data?.top_products?.[0]?.name || '—';

  // ── ECharts 趋势图 ──
  useEffect(() => {
    if (!data?.order_trend) return;
    const dom = document.getElementById('dashboard-trend');
    if (!dom) return;
    const chart = echarts.init(dom);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: T.cardBorder, textStyle: { color: '#333', fontSize: 12 }, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
      legend: { bottom: 0, textStyle: { fontSize: 11, color: T.textTertiary }, itemWidth: 12, itemHeight: 8 },
      grid: { left: '3%', right: '5%', top: '8%', bottom: '12%' },
      xAxis: { type: 'category', data: data.order_trend.map(d => d.date.slice(5)), axisLine: { lineStyle: { color: T.cardBorder } }, axisTick: { show: false }, axisLabel: { fontSize: 10, color: T.textTertiary } },
      yAxis: [
        { type: 'value', name: '单', nameTextStyle: { color: T.textTertiary, fontSize: 10 }, splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } }, axisLabel: { fontSize: 10, color: T.textTertiary } },
        { type: 'value', name: 'RM', nameTextStyle: { color: T.textTertiary, fontSize: 10 }, splitLine: { show: false }, axisLabel: { fontSize: 10, color: T.textTertiary, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v) } },
      ],
      series: [
        {
          name: '订单数', type: 'bar', yAxisIndex: 0, barWidth: 14,
          data: data.order_trend.map(d => d.order_count),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#6B8CFF' }, { offset: 1, color: T.primary },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: '销售额(MYR)', type: 'line', yAxisIndex: 1, smooth: true,
          data: data.order_trend.map(d => d.revenue_myr),
          lineStyle: { color: '#F59E0B', width: 2 },
          itemStyle: { color: '#F59E0B' }, symbol: 'circle', symbolSize: 4,
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(245,158,11,0.12)' }, { offset: 1, color: 'rgba(245,158,11,0)' }]) },
        },
      ],
    });
    return () => chart.dispose();
  }, [data]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="加载仪表盘数据..." /></div>;
  if (error || !data) return <Result status="error" title="加载失败" subTitle={error || '请刷新重试'} extra={<Button type="primary" icon={<ReloadOutlined />} onClick={fetchDashboard}>重新加载</Button>} />;

  const trendSummary = `近30天 销售额 RM${orderTrendRevenue.toLocaleString()} · 订单 ${data.cards.total_orders} · 日均 ${Math.round(data.cards.total_orders / 30)} 单`;

  return (
    <div style={{ fontFamily: '"PingFang SC", -apple-system, "Inter", sans-serif' }}>

      {/* ═══ Header ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, #6B8CFF, #4F6BFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(79,107,255,0.25)',
        }}>
          <BarChartOutlined style={{ fontSize: 20, color: '#fff' }} />
        </div>
        <div>
          <Title level={3} style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.textPrimary }}>经营概览</Title>
          <Text style={{ fontSize: 13, color: T.textTertiary }}>店铺经营数据驾驶舱</Text>
        </div>
      </div>

      {/* ═══ Row 1: 4 KPI 卡片 ═══ */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            label: '今日销售额', value: `RM ${(data.cards.total_revenue_myr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: data.cards.today_orders > 0 ? `今日 +${data.cards.today_orders} 单` : null,
            icon: <DollarOutlined />, color: '#4F6BFF', bg: '#EEF3FF',
          },
          {
            label: '今日订单', value: data.cards.total_orders.toString(),
            change: data.cards.today_orders > 0 ? `今日 +${data.cards.today_orders}` : null,
            icon: <ShoppingCartOutlined />, color: '#22C55E', bg: '#F0FDF4',
          },
          {
            label: '客单价', value: `RM ${avgOrderValue.toFixed(2)}`,
            change: null,
            icon: <RiseOutlined />, color: '#F59E0B', bg: '#FFFBEB',
          },
          {
            label: '商品销量', value: `${totalSalesQty}`,
            change: `共 ${data.cards.total_products} 个 SKU`,
            icon: <AppstoreOutlined />, color: '#8B5CF6', bg: '#F5F3FF',
          },
        ].map((card, i) => (
          <Col xs={12} sm={6} key={i}>
            <Card
              hoverable
              style={{
                borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`,
                boxShadow: T.cardShadow, height: 120, transition: 'all 0.2s',
              }}
              bodyStyle={{ padding: '16px 20px' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 12, color: T.textTertiary }}>{card.label}</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, fontFamily: '"Inter", sans-serif', marginTop: 2, lineHeight: 1.2 }}>
                    {card.value}
                  </div>
                  {card.change && <Text style={{ fontSize: 11, color: T.textTertiary }}>{card.change}</Text>}
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: card.color, flexShrink: 0 }}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ═══ Row 2: 趋势图 + 经营概况 ═══ */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card
            title={<Text strong style={{ fontSize: 15, color: T.textPrimary }}>销售趋势</Text>}
            style={{ borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow }}
            bodyStyle={{ padding: '20px 24px' }}
            extra={<Text style={{ fontSize: 12, color: T.textTertiary }}>近30天</Text>}
          >
            <div style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: T.textSecondary }}>{trendSummary}</Text>
            </div>
            <div id="dashboard-trend" style={{ width: '100%', height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<Text strong style={{ fontSize: 15, color: T.textPrimary }}>店铺概况</Text>}
            style={{ borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: '累计销售额', value: `RM ${data.cards.total_revenue_myr.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: <DollarOutlined />, color: '#4F6BFF' },
                { label: '累计订单', value: data.cards.total_orders.toString(), icon: <ShoppingCartOutlined />, color: '#22C55E' },
                { label: '商品数量', value: `${data.cards.total_products}`, icon: <AppstoreOutlined />, color: '#8B5CF6' },
                { label: '达人数量', value: `${data.cards.total_influencers}`, icon: <UserOutlined />, color: '#F59E0B' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, fontSize: 13 }}>
                      {item.icon}
                    </div>
                    <Text style={{ fontSize: 13, color: T.textSecondary }}>{item.label}</Text>
                  </div>
                  <Text strong style={{ fontSize: 14, color: T.textPrimary }}>{item.value}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ═══ Row 3: 热销商品 ═══ */}
      <Card
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrophyOutlined style={{ color: '#F59E0B' }} /><Text strong style={{ fontSize: 15, color: T.textPrimary }}>热销商品排行</Text></div>}
        style={{ borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow }}
        bodyStyle={{ padding: 0 }}
      >
        {/* Top 5 Cards */}
        {data.top_products.length > 0 && (
          <Row gutter={[12, 12]} style={{ padding: '20px 24px 8px' }}>
            {data.top_products.slice(0, 4).map((p, i) => (
              <Col xs={12} sm={6} key={p.id}>
                <div style={{
                  padding: '14px 16px', borderRadius: 16,
                  background: i === 0 ? `linear-gradient(135deg, ${T.primaryLight || '#EEF3FF'}, #FFF)` : '#FAFBFC',
                  border: `1px solid ${T.cardBorder}`, height: '100%',
                }}>
                  <Tag color={i === 0 ? 'gold' : 'default'} style={{ borderRadius: 6, marginBottom: 6 }}>#{i + 1}</Tag>
                  <Text strong ellipsis style={{ fontSize: 13, color: T.textPrimary, display: 'block', marginBottom: 6 }}>{p.name}</Text>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div>
                      <Text style={{ fontSize: 10, color: T.textTertiary, display: 'block' }}>销量</Text>
                      <Text strong style={{ fontSize: 14, color: T.textPrimary }}>{p.total_qty}</Text>
                    </div>
                    <div>
                      <Text style={{ fontSize: 10, color: T.textTertiary, display: 'block' }}>销售额</Text>
                      <Text strong style={{ fontSize: 14, color: T.primary }}>RM{p.total_sales_myr?.toFixed(2)}</Text>
                    </div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}
        {/* Full Table */}
        <Table
          dataSource={data.top_products}
          rowKey="id"
          pagination={false}
          size="small"
          style={{ marginTop: data.top_products.length > 0 ? 0 : 0 }}
          columns={[
            { title: '排名', width: 60, render: (_: any, __: any, i: number) => <Tag color={i < 3 ? 'gold' : 'default'} style={{ borderRadius: 6 }}>{i + 1}</Tag> },
            { title: '商品名称', dataIndex: 'name', ellipsis: true },
            { title: '售价', dataIndex: 'sell_price', width: 90, align: 'right' as const, render: (v: number) => v ? `RM${v.toFixed(2)}` : '-' },
            { title: '销量', dataIndex: 'total_qty', width: 70, align: 'right' as const },
            { title: '销售额', dataIndex: 'total_sales_myr', width: 110, align: 'right' as const, render: (v: number) => v ? <Text strong style={{ color: T.primary }}>RM{v.toFixed(2)}</Text> : '-' },
            { title: '占比', width: 70, align: 'right' as const,
              render: (_: any, r: any) => {
                const pct = data.cards.total_revenue_myr > 0 ? ((r.total_sales_myr / data.cards.total_revenue_myr) * 100) : 0;
                return <Text style={{ fontSize: 12, color: T.textTertiary }}>{pct.toFixed(1)}%</Text>;
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
