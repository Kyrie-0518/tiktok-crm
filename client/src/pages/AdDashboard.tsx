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
  const [reportData, setReportData] = useState<any>(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('ad_report_')) {
          const v = localStorage.getItem(key);
          if (v) return JSON.parse(v);
        }
      }
    } catch {}
    return null;
  });
  const [chartTab, setChartTab] = useState('cost');
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
          dimensions: 'advertiser_id',
          metrics: 'spend,impressions,clicks,conversions,ctr,cpc,cpm',
          level: 'AUCTION_CAMPAIGN',
          force_refresh: '0',
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

  const kpiCards = [
    { label: '花费', value: `$${totalSpend.toFixed(2)}`, icon: <DollarOutlined />, color: '#3b82f6', bg: '#eff6ff' },
    { label: '订单', value: totalOrders, icon: <ShoppingOutlined />, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'CPO', value: `$${cpo}`, icon: <RiseOutlined />, color: '#f59e0b', bg: '#fffbeb' },
    { label: '总收入', value: `$${totalRevenue.toFixed(2)}`, icon: <WalletOutlined />, color: '#059669', bg: '#ecfdf5' },
    { label: 'ROI', value: roi, icon: <TrophyOutlined />, color: '#dc2626', bg: '#fef2f2' },
  ];

  // 图表数据
  const costData = list.map((r: any) => Number(r.metrics?.spend || 0));
  const orderData = list.map((r: any) => Number(r.metrics?.conversions || 0));
  const xLabels = list.map((r: any, i: number) => r.dimensions?.campaign_id || `Day ${i + 1}`);

  const chartOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 50, right: 30, top: 30, bottom: 40, containLabel: true },
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
    series: [{
      name: chartTab === 'cost' ? '成本' : '订单数',
      type: 'bar',
      data: chartTab === 'cost' ? costData : orderData,
      itemStyle: { color: chartTab === 'cost' ? '#3b82f6' : '#8b5cf6', borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 50,
    }],
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

      {/* KPI 5 卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpiCards.map((k, i) => (
          <Card
            key={i}
            style={{ borderRadius: 12, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            bodyStyle={{ padding: '18px 16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: k.bg, color: k.color, fontSize: 18, flexShrink: 0 }}>
                {k.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', lineHeight: 1.1 }}>{k.value}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 趋势图卡 */}
      <Card
        style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* 头部：标题 + Tabs + 同步按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>趋势</Text>
          <Tabs
            activeKey={chartTab}
            onChange={setChartTab}
            size="small"
            style={{ flex: 1, marginLeft: 16, marginBottom: 0 }}
            items={[
              { key: 'cost', label: '成本' },
              { key: 'orders', label: '订单数' },
            ]}
          />
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
