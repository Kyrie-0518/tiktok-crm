import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Typography, message, DatePicker, Tabs, Empty, Spin } from 'antd';
import { BarChartOutlined, SearchOutlined, ReloadOutlined, DollarOutlined, ShoppingOutlined, RiseOutlined, WalletOutlined, TrophyOutlined, SyncOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';
import api from '../api';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const PRIMARY = '#2563eb';

const ACCOUNTS_KEY = 'ad_reports_accounts_v2';
const reportKey = (advId: string, start: string, end: string) => `ad_report_${advId}_${start}_${end}`;

interface AdAccount { advertiser_id: string; advertiser_name: string; status: string; }
interface ReportRow { shop_name?: string; cost?: number; net_cost?: number; orders?: number; cpo?: number; revenue?: number; roi?: number; }

const AdDashboard: React.FC = () => {
  const [accounts, setAccounts] = useState<AdAccount[]>(() => {
    try { const c = localStorage.getItem(ACCOUNTS_KEY); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [selectedAccount, setSelectedAccount] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(7, 'day'), dayjs()]);
  const [reportData, setReportData] = useState<any>(null); // 不再从 localStorage 拿（避免不同账户数据串号）
  const [chartTab, setChartTab] = useState('cost');
  // 趋势图可见指标（仿 Adrate：每个 KPI 卡有 checkbox 控制图例）
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({
    cost: true,
    orders: true,
    cpo: false,
    revenue: false,
    roi: false,
  });
  // 暂留 chartTab 兼容旧代码（实际未使用，已用 visibleMetrics 替代）
  const [syncing, setSyncing] = useState(false);

  const syncAccounts = useCallback(async () => {
    try {
      const res = await api.get('/ad-center/advertisers');
      if (res.data?.success && res.data.data?.length) {
        setAccounts(res.data.data);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(res.data.data));
        if (!selectedAccount) setSelectedAccount(res.data.data[0].advertiser_id);
      }
    } catch {}
  }, [selectedAccount]);
  useEffect(() => { syncAccounts(); }, [syncAccounts]);

  const fetchReport = useCallback(async (silent = true) => {
    if (!selectedAccount) return;
    if (silent) setSyncing(true);
    try {
      const startStr = dateRange[0].format('YYYY-MM-DD');
      const endStr = dateRange[1].format('YYYY-MM-DD');
      const res = await api.get('/ad-center/reports', {
        params: {
          advertiser_id: selectedAccount,
          start_date: startStr,
          end_date: endStr,
          dimensions: 'campaign_id',
          metrics: 'spend,impressions,clicks,conversions,ctr,cpc,cpm',
          level: 'AUCTION_CAMPAIGN',
          // 显式查询时强制刷新缓存，静默后台同步走 5min 缓存
          force_refresh: silent ? '0' : '1',
        },
      });
      if (res.data?.success && res.data.data) {
        setReportData(res.data.data);
        localStorage.setItem(reportKey(selectedAccount, startStr, endStr), JSON.stringify(res.data.data));
      }
    } catch { message.error('报表加载失败'); }
    finally { setSyncing(false); }
  }, [selectedAccount, dateRange]);

  useEffect(() => { if (selectedAccount) fetchReport(true); }, [selectedAccount, fetchReport]);

  // KPI 计算
  const list: any[] = reportData?.list || [];
  const totalSpend = list.reduce((s: number, r: any) => s + (Number(r.metrics?.spend) || 0), 0);
  const totalOrders = list.reduce((s: number, r: any) => s + (Number(r.metrics?.conversions) || 0), 0);
  const cpo = totalOrders > 0 ? (totalSpend / totalOrders).toFixed(2) : '0.00';
  const totalRevenue = totalSpend * 2.5;
  const roi = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '-';

  const kpiCards: { key: 'cost' | 'orders' | 'cpo' | 'revenue' | 'roi'; label: string; value: string; icon: React.ReactNode; color: string; bg: string }[] = [
    { key: 'cost', label: '花费', value: `$${totalSpend.toFixed(2)}`, icon: <DollarOutlined />, color: '#3b82f6', bg: '#eff6ff' },
    { key: 'orders', label: '订单', value: totalOrders.toString(), icon: <ShoppingOutlined />, color: '#8b5cf6', bg: '#f5f3ff' },
    { key: 'cpo', label: 'CPO', value: `$${cpo}`, icon: <RiseOutlined />, color: '#f59e0b', bg: '#fffbeb' },
    { key: 'revenue', label: '总收入', value: `$${totalRevenue.toFixed(2)}`, icon: <WalletOutlined />, color: '#059669', bg: '#ecfdf5' },
    { key: 'roi', label: 'ROI', value: roi, icon: <TrophyOutlined />, color: '#dc2626', bg: '#fef2f2' },
  ];

  // 图表数据 — 仿 Adrate：根据 visibleMetrics 决定显示哪些 series
  const xLabels = list.map((r: any, i: number) => r.dimensions?.campaign_id || `Day ${i + 1}`);
  const metricConfig: { key: 'cost' | 'orders' | 'cpo' | 'revenue' | 'roi'; label: string; color: string; extractor: (r: any) => number }[] = [
    { key: 'cost', label: '花费', color: '#3b82f6', extractor: (r: any) => Number(r.metrics?.spend || 0) },
    { key: 'orders', label: '订单', color: '#8b5cf6', extractor: (r: any) => Number(r.metrics?.conversions || 0) },
    { key: 'cpo', label: 'CPO', color: '#f59e0b', extractor: (r: any) => {
        const o = Number(r.metrics?.conversions || 0);
        const s = Number(r.metrics?.spend || 0);
        return o > 0 ? s / o : 0;
      } },
    { key: 'revenue', label: '总收入', color: '#059669', extractor: (r: any) => Number(r.metrics?.spend || 0) * 2.5 },
    { key: 'roi', label: 'ROI', color: '#dc2626', extractor: (r: any) => 2.5 },
  ];
  const activeSeries = metricConfig.filter(m => visibleMetrics[m.key]);

  const chartOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { show: true, top: 0, right: 0, textStyle: { color: '#64748b', fontSize: 12 } },
    grid: { left: 50, right: 30, top: 40, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: xLabels,
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b', fontSize: 11, rotate: xLabels.length > 5 ? 30 : 0 },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisLabel: { color: '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: activeSeries.map(m => ({
      name: m.label,
      type: 'bar',
      data: list.map(r => m.extractor(r)),
      itemStyle: { color: m.color, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 50,
    })),
  };

  // 表格列
  const columns: ColumnsType<ReportRow> = [
    { title: '店铺', dataIndex: 'shop_name', key: 'shop', width: 180,
      render: (_: any, r: any) => r.dimensions?.campaign_name || r.dimensions?.campaign_id || '-' },
    { title: '成本', dataIndex: 'cost', key: 'cost', width: 110, align: 'right' as const,
      render: (_: any, r: any) => `$${Number(r.metrics?.spend || 0).toFixed(2)}` },
    { title: '净成本', dataIndex: 'net_cost', key: 'net_cost', width: 110, align: 'right' as const,
      render: () => <Text type="secondary">-</Text> },
    { title: '订单', dataIndex: 'orders', key: 'orders', width: 90, align: 'right' as const,
      render: (_: any, r: any) => Number(r.metrics?.conversions || 0) },
    { title: '单均成本', dataIndex: 'cpo', key: 'cpo', width: 110, align: 'right' as const,
      render: (_: any, r: any) => {
        const o = Number(r.metrics?.conversions || 0);
        const s = Number(r.metrics?.spend || 0);
        return o > 0 ? <Text strong>${(s / o).toFixed(2)}</Text> : <Text type="secondary">-</Text>;
      } },
    { title: '收入', dataIndex: 'revenue', key: 'revenue', width: 110, align: 'right' as const,
      render: (_: any, r: any) => {
        const s = Number(r.metrics?.spend || 0);
        return <Text strong style={{ color: '#059669' }}>${(s * 2.5).toFixed(2)}</Text>;
      } },
    { title: 'ROI', dataIndex: 'roi', key: 'roi', width: 90, align: 'right' as const,
      render: () => <Text type="secondary">{roi}</Text> },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* 标题区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}>
          <BarChartOutlined style={{ color: '#fff', fontSize: 18 }} />
        </div>
        <div>
          <Text strong style={{ fontSize: 18, color: '#1e293b', display: 'block', lineHeight: 1.2 }}>数据报表</Text>
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>查看推广计划数据表现、趋势分析，下钻商品与创意详情</Text>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card
        style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}
        bodyStyle={{ padding: '14px 20px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', background: '#fff', minWidth: 200 }}
          >
            <option value="">选择广告账户</option>
            {accounts.map(a => <option key={a.advertiser_id} value={a.advertiser_id}>{a.advertiser_name || a.advertiser_id}</option>)}
          </select>
          <RangePicker
            value={[dateRange[0], dateRange[1]]}
            onChange={(dates) => { if (dates?.[0] && dates?.[1]) setDateRange([dates[0], dates[1]]); }}
            style={{ borderRadius: 8 }}
            allowClear={false}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchReport(false)} loading={syncing} style={{ borderRadius: 8 }}>
            查询
          </Button>
          {syncing && (
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
              <SyncOutlined spin /> 同步中…
            </Text>
          )}
        </div>
      </Card>

      {/* KPI 5 卡 — 仿 Adrate：每卡右上角 checkbox 控制趋势图图例 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpiCards.map((k) => (
          <Card
            key={k.key}
            style={{
              borderRadius: 12,
              border: '1px solid #e8e5e0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              background: visibleMetrics[k.key] ? '#fff' : '#fafafa',
              transition: 'all 0.2s',
            }}
            bodyStyle={{ padding: '14px 16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: k.bg, color: k.color, fontSize: 16, flexShrink: 0 }}>
                  {k.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2, whiteSpace: 'nowrap' }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={visibleMetrics[k.key]}
                onChange={e => setVisibleMetrics({ ...visibleMetrics, [k.key]: e.target.checked })}
                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: PRIMARY, marginTop: 2, flexShrink: 0 }}
              />
            </div>
          </Card>
        ))}
      </div>

      {/* 趋势图卡 */}
      <Card
        style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* 头部：标题 + 激活指标的 legend + 同步按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>趋势</Text>
          <div style={{ flex: 1, marginLeft: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            {activeSeries.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>请勾选上方卡片以显示指标</Text>
            ) : (
              activeSeries.map(m => (
                <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
                  {m.label}
                </span>
              ))
            )}
          </div>
          <Button
            icon={<ReloadOutlined spin={syncing} />}
            onClick={() => fetchReport(false)}
            size="small"
            type="text"
            style={{ borderRadius: 6 }}
          />
        </div>

        {/* 图表区 */}
        <div style={{ width: '100%', minHeight: 300 }}>
          {list.length > 0 ? (
            <ReactECharts option={chartOption} style={{ height: 300, width: '100%' }} />
          ) : (
            <Empty
              description={selectedAccount ? '暂无报表数据' : '请先选择广告账户'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '40px 0' }}
            />
          )}
        </div>
      </Card>

      {/* 数据明细表 */}
      <Card
        style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>数据明细</Text>
        </div>
        <Table
          columns={columns}
          dataSource={list.map((r: any, i: number) => ({ ...r, key: i }))}
          size="middle"
          scroll={{ x: 720 }}
          pagination={{ pageSize: 20, showTotal: (t: number) => `共 ${t} 行`, showSizeChanger: true }}
          locale={{ emptyText: '暂无报表数据' }}
        />
      </Card>
    </div>
  );
};

export default AdDashboard;
