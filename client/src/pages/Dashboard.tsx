import React, { useEffect, useState, useMemo } from 'react';
import { Card, Row, Col, Table, Typography, Spin, Tag, Button, Result, Select } from 'antd';
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
    total_products: number; total_influencers: number;
    total_revenue_myr: number; today_revenue_myr: number;
  };
  order_trend: Array<{ date: string; order_count: number; revenue_myr: number }>;
  profit_overview: { total_profit_rmb: number; total_investment_rmb: number; overall_roi: number; product_with_records: number; };
  top_products: Array<{
    id: number; name: string; sku: string; image: string;
    sell_price: number; total_qty: number; total_sales_myr: number; order_times: number;
  }>;
  order_status_counts: Record<string, number>;
}

const T = {
  primary: '#4F6BFF', primaryLight: '#EEF3FF',
  cardShadow: '0 8px 24px rgba(15,23,42,0.06)',
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
  const topProductName = data?.top_products?.[0]?.name || '—';

  // 趋势图时间范围（近7天/近30天）
  const [trendRange, setTrendRange] = useState<'7d' | '30d'>('30d');
  const trendData = useMemo(() => {
    if (!data?.order_trend) return [];
    if (trendRange === '7d') return data.order_trend.slice(-7);
    return data.order_trend;
  }, [data, trendRange]);

  // ── ECharts 趋势图 ──
  useEffect(() => {
    if (!trendData.length) return;
    const dom = document.getElementById('dashboard-trend');
    if (!dom) return;
    const chart = echarts.init(dom);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: T.cardBorder, textStyle: { color: '#333', fontSize: 12 }, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
      legend: { bottom: 4, textStyle: { fontSize: 11, color: T.textTertiary }, itemWidth: 14, itemHeight: 8, itemGap: 16 },
      grid: { left: 50, right: 60, top: 20, bottom: 56 },
      xAxis: { type: 'category', data: trendData.map(d => d.date.slice(5)), axisLine: { lineStyle: { color: T.cardBorder } }, axisTick: { show: false }, axisLabel: { fontSize: 10, color: T.textTertiary, margin: 14 } },
      yAxis: [
        { type: 'value', name: '订单数', nameTextStyle: { color: T.textTertiary, fontSize: 10, padding: [0, 0, 6, 0] }, splitLine: { lineStyle: { color: '#F1F5F9' } }, axisLabel: { fontSize: 10, color: T.textTertiary, margin: 12 } },
        { type: 'value', name: '销售额', nameTextStyle: { color: T.textTertiary, fontSize: 10, padding: [0, 0, 6, 0] }, splitLine: { show: false }, axisLabel: { fontSize: 10, color: T.textTertiary, margin: 12, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v) } },
      ],
      series: [
        {
          name: '销售额(MYR)', type: 'line', yAxisIndex: 1, smooth: true,
          data: trendData.map(d => d.revenue_myr),
          lineStyle: { color: '#4F6BFF', width: 2.5 },
          itemStyle: { color: '#4F6BFF' }, symbol: 'circle', symbolSize: 5,
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(79,107,255,0.15)' }, { offset: 1, color: 'rgba(79,107,255,0)' }]) },
        },
        {
          name: '订单数', type: 'line', yAxisIndex: 0, smooth: true,
          data: trendData.map(d => d.order_count),
          lineStyle: { color: '#22C55E', width: 2 },
          itemStyle: { color: '#22C55E' }, symbol: 'circle', symbolSize: 4,
        },
      ],
    });
    return () => chart.dispose();
  }, [trendData]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="加载仪表盘数据..." /></div>;
  if (error || !data) return <Result status="error" title="加载失败" subTitle={error || '请刷新重试'} extra={<Button type="primary" icon={<ReloadOutlined />} onClick={fetchDashboard}>重新加载</Button>} />;

  const trendSummary = (() => {
    const days = trendRange === '7d' ? 7 : 30;
    const totalOrders = trendData.reduce((s, d) => s + d.order_count, 0);
    const totalRevenue = trendData.reduce((s, d) => s + d.revenue_myr, 0);
    return `近${days}天 销售额 RM${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · 订单 ${totalOrders} · 日均 ${Math.round(totalOrders / Math.max(trendData.length, 1))} 单`;
  })();

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
            label: '总销售额', value: `RM ${(data.cards.total_revenue_myr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: data.cards.today_revenue_myr > 0 ? `今日 +RM ${(data.cards.today_revenue_myr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '今日无销售',
            icon: <DollarOutlined />, color: '#4F6BFF', bg: '#EEF3FF',
          },
          {
            label: '总订单', value: data.cards.total_orders.toString(),
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
            extra={
              <Select
                size="small"
                value={trendRange}
                onChange={v => setTrendRange(v)}
                style={{ width: 110, borderRadius: 6 }}
                options={[
                  { value: '7d', label: '近 7 天' },
                  { value: '30d', label: '近 30 天' },
                ]}
              />
            }
          >
            <div style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: T.textSecondary }}>{trendSummary}</Text>
            </div>
            <div id="dashboard-trend" style={{ width: '100%', height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
            {/* 店铺概况 */}
            <Card
              title={<Text strong style={{ fontSize: 14, color: T.textPrimary }}>店铺概况</Text>}
              style={{ borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow, flex: 1 }}
              bodyStyle={{ padding: '14px 18px' }}
            >
              <div style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: T.textTertiary, display: 'block' }}>💰 累计销售额</Text>
                <Text strong style={{ fontSize: 22, color: T.primary, fontFamily: '"Inter", sans-serif' }}>
                  RM {data.cards.total_revenue_myr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </div>
              <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: `1px dashed ${T.cardBorder}` }}>
                <div><Text style={{ fontSize: 11, color: T.textTertiary }}>🛒 订单</Text><div><Text strong style={{ fontSize: 14, color: T.textPrimary }}>{data.cards.total_orders}</Text></div></div>
                <div><Text style={{ fontSize: 11, color: T.textTertiary }}>📦 商品</Text><div><Text strong style={{ fontSize: 14, color: T.textPrimary }}>{data.cards.total_products}</Text></div></div>
                <div><Text style={{ fontSize: 11, color: T.textTertiary }}>👤 达人</Text><div><Text strong style={{ fontSize: 14, color: T.textPrimary }}>{data.cards.total_influencers}</Text></div></div>
              </div>
            </Card>

            {/* 订单状态 */}
            <Card
              title={<Text strong style={{ fontSize: 14, color: T.textPrimary }}>📦 订单状态</Text>}
              style={{ borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow, flex: 1 }}
              bodyStyle={{ padding: '14px 18px' }}
            >
              {(() => {
                const s = data.order_status_counts || {};
                const items: { key: string; label: string; color: string; bg: string; match: (k: string) => boolean }[] = [
                  { key: 'pending', label: '待发货', color: '#F59E0B', bg: '#FFFBEB', match: k => k === 'pending' || k === 'to_pack' || k === 'awaiting_shipment' },
                  { key: 'shipped', label: '运输中', color: '#4F6BFF', bg: '#EEF3FF', match: k => k === 'shipped' || k === 'in_transit' || k === 'to_confirm' },
                  { key: 'completed', label: '已完成', color: '#22C55E', bg: '#F0FDF4', match: k => k === 'completed' || k === 'delivered' || k === 'done' || k === 'finished' },
                  { key: 'cancelled', label: '异常', color: '#EF4444', bg: '#FEF2F2', match: k => k === 'cancelled' || k === 'refunded' || k === 'auto_cancelled' || k === 'exception' },
                ];
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map(item => {
                      const count = Object.entries(s).filter(([k]) => item.match(k)).reduce((sum, [, v]) => sum + (v as number), 0);
                      return (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: 3, background: item.color }} />
                            <Text style={{ fontSize: 13, color: T.textSecondary }}>{item.label}</Text>
                          </div>
                          <Text strong style={{ fontSize: 14, color: item.color, fontFamily: '"Inter", sans-serif' }}>{count}</Text>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Card>


          </div>
        </Col>
      </Row>

      {/* ═══ Row 3: 商品销售表现 ═══ */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrophyOutlined style={{ color: '#F59E0B', fontSize: 16 }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong style={{ fontSize: 15, color: T.textPrimary, lineHeight: 1.3 }}>商品销售表现</Text>
                  <Tag style={{ borderRadius: 6, border: 'none', background: T.primaryLight, color: T.primary, fontSize: 11, fontWeight: 600, margin: 0, lineHeight: '20px' }}>
                    共 {data.top_products.length} 个
                  </Tag>
                </div>
                <Text style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.3 }}>Top 商品 · 销售贡献</Text>
              </div>
            </div>
          </div>
        }
        style={{ borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow }}
        styles={{ header: { padding: '16px 24px', borderBottom: `1px solid ${T.cardBorder}` } }}
        bodyStyle={{ padding: 0 }}
      >
        {/* ═══ TOP 3 Bento Cards ═══ */}
        {data.top_products.length > 0 && (
          <div style={{ padding: '20px 24px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {data.top_products.slice(0, 3).map((p, i) => {
              const topColors = ['#F59E0B', '#94A3B8', '#F97316'];
              const topLabels = ['TOP 1', 'TOP 2', 'TOP 3'];
              const pct = data.cards.total_revenue_myr > 0 ? ((p.total_sales_myr / data.cards.total_revenue_myr) * 100) : 0;
              return (
                <div key={p.id}
                  style={{
                    background: i === 0 ? `linear-gradient(135deg, #FFFBF0, #FFFFFF)` : '#FFFFFF',
                    border: `1px solid ${T.cardBorder}`, borderRadius: 16,
                    padding: '14px 16px', height: 120, display: 'flex', flexDirection: 'column',
                    transition: 'all 0.2s', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = topColors[i]; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,23,42,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Top badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{
                      width: 40, height: 18, borderRadius: 6,
                      background: `${topColors[i]}15`, color: topColors[i],
                      fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      letterSpacing: 0.5,
                    }}>{topLabels[i]}</div>
                    <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
                  </div>

                  <div style={{ display: 'flex', gap: 12, flex: 1, alignItems: 'center' }}>
                    {/* Product image */}
                    <div style={{ flexShrink: 0 }}>
                      {p.image ? (
                        <img src={p.image} alt={p.name}
                          style={{ width: 60, height: 60, borderRadius: 12, objectFit: 'cover', background: '#F8FAFC' }}
                          onError={(e: any) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                      ) : null}
                      <div style={{
                        display: p.image ? 'none' : 'flex',
                        width: 60, height: 60, borderRadius: 12, background: '#F8FAFC',
                        alignItems: 'center', justifyContent: 'center', color: T.textTertiary, fontSize: 24,
                      }}>
                        <AppstoreOutlined />
                      </div>
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text ellipsis={{ tooltip: p.name }}
                        style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, display: 'block', lineHeight: 1.35, marginBottom: 6, maxHeight: 32, overflow: 'hidden' }}>
                        {p.name}
                      </Text>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <Text style={{ fontSize: 18, fontWeight: 700, color: T.primary, fontFamily: '"Inter", sans-serif' }}>
                          RM{p.total_sales_myr?.toFixed(0)}
                        </Text>
                        <Text style={{ fontSize: 10, color: T.textTertiary, whiteSpace: 'nowrap' }}>{p.total_qty}件</Text>
                      </div>
                      <Text style={{ fontSize: 10, color: T.textTertiary }}>占 {pct.toFixed(1)}%</Text>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 商品排行榜 Table ═══ */}
        <Table
          dataSource={data.top_products}
          rowKey="id"
          pagination={false}
          size="middle"
          columns={[
            {
              title: '排名', width: 60, align: 'center' as const,
              render: (_: any, __: any, i: number) => {
                const medals = ['🥇', '🥈', '🥉'];
                return <Text style={{ fontSize: 16 }}>{medals[i] || <Text style={{ fontSize: 12, color: T.textTertiary, fontWeight: 600 }}>{i + 1}</Text>}</Text>;
              },
            },
            {
              title: '商品', dataIndex: 'name',
              render: (_: any, r: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {r.image ? (
                    <img src={r.image} alt={r.name}
                      style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#F8FAFC' }}
                      onError={(e: any) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AppstoreOutlined style={{ color: T.textTertiary, fontSize: 14 }} />
                    </div>
                  )}
                  <Text ellipsis={{ tooltip: r.name }} style={{ fontSize: 13, color: T.textPrimary, maxWidth: 260 }}>{r.name}</Text>
                </div>
              ),
            },
            { title: '销量', dataIndex: 'total_qty', width: 70, align: 'right' as const, render: (v: number) => <Text strong style={{ fontSize: 13, color: T.textPrimary }}>{v}</Text> },
            {
              title: '销售额', dataIndex: 'total_sales_myr', width: 110, align: 'right' as const,
              render: (v: number) => <Text strong style={{ fontSize: 13, color: T.primary, fontFamily: '"Inter", sans-serif' }}>RM{v?.toFixed(2)}</Text>,
            },
            {
              title: '占比', width: 65, align: 'right' as const,
              render: (_: any, r: any) => {
                const pct = data.cards.total_revenue_myr > 0 ? ((r.total_sales_myr / data.cards.total_revenue_myr) * 100) : 0;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <div style={{ width: 36, height: 4, borderRadius: 2, background: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 2, background: pct > 30 ? T.primary : pct > 10 ? '#6B8CFF' : '#CBD5E1', transition: 'width 0.3s' }} />
                    </div>
                    <Text style={{ fontSize: 11, color: T.textTertiary, minWidth: 36, textAlign: 'right' }}>{pct.toFixed(1)}%</Text>
                  </div>
                );
              },
            },
            {
              title: '趋势', width: 60, align: 'right' as const,
              render: (_: any, r: any, i: number) => {
                const pct = data.cards.total_revenue_myr > 0 ? ((r.total_sales_myr / data.cards.total_revenue_myr) * 100) : 0;
                const isTop = i < 2 || pct > 20;
                if (isTop) {
                  return <RiseOutlined style={{ color: '#22C55E', fontSize: 14 }} />;
                }
                return <Text style={{ fontSize: 11, color: T.textTertiary }}>—</Text>;
              },
            },
            {
              title: '状态', width: 80,
              render: (_: any, r: any) => {
                const pct = data.cards.total_revenue_myr > 0 ? ((r.total_sales_myr / data.cards.total_revenue_myr) * 100) : 0;
                if (pct > 30) return <Tag color="gold" style={{ borderRadius: 6, margin: 0, fontSize: 10, fontWeight: 600 }}>🔥 核心商品</Tag>;
                if (pct > 10) return <Tag style={{ borderRadius: 6, margin: 0, fontSize: 10, background: '#F0FDF4', color: '#22C55E', border: 'none', fontWeight: 600 }}>📈 热销</Tag>;
                if (pct < 3) return <Tag style={{ borderRadius: 6, margin: 0, fontSize: 10, background: '#FEF2F2', color: '#EF4444', border: 'none', fontWeight: 600 }}>⚠️ 慢销</Tag>;
                return <Tag style={{ borderRadius: 6, margin: 0, fontSize: 10, background: '#F1F5F9', color: T.textTertiary, border: 'none' }}>正常</Tag>;
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
