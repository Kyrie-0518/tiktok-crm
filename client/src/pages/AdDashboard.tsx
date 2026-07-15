import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Typography, message, DatePicker, Spin, Tabs } from 'antd';
import { BarChartOutlined, SearchOutlined, ReloadOutlined, DollarOutlined, ShoppingOutlined, RiseOutlined, WalletOutlined, TrophyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';
import api from '../api';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const PRIMARY = '#2563eb';

const CACHE_KEY = 'ad_reports_cache_v1';

interface AdAccount { advertiser_id: string; advertiser_name: string; status: string; }
interface ReportRow { shop_name?: string; cost?: number; net_cost?: number; orders?: number; cpo?: number; revenue?: number; roi?: number; }

const AdDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdAccount[]>(() => {
    try { const c = localStorage.getItem(CACHE_KEY); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [selectedAccount, setSelectedAccount] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(7, 'day'), dayjs()]);
  const [reportData, setReportData] = useState<any>(null);
  const [chartTab, setChartTab] = useState('cost');

  // 静默加载账户
  const syncAccounts = useCallback(async () => {
    try {
      const res = await api.get('/ad-center/advertisers');
      if (res.data?.success && res.data.data?.length) {
        setAccounts(res.data.data);
        localStorage.setItem(CACHE_KEY, JSON.stringify(res.data.data));
        if (!selectedAccount) setSelectedAccount(res.data.data[0].advertiser_id);
      }
    } catch {}
  }, [selectedAccount]);
  useEffect(() => { syncAccounts(); }, [syncAccounts]);

  // 查报表
  const fetchReport = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const res = await api.get('/ad-center/reports', {
        params: {
          advertiser_id: selectedAccount,
          start_date: dateRange[0].format('YYYY-MM-DD'),
          end_date: dateRange[1].format('YYYY-MM-DD'),
          dimensions: 'advertiser_id',
          metrics: 'spend,impressions,clicks,conversions,ctr,cpc,cpm',
          level: 'AUCTION_CAMPAIGN',
          force_refresh: '0',
        },
      });
      if (res.data?.success) setReportData(res.data.data);
    } catch { message.error('报表加载失败'); }
    finally { setLoading(false); }
  }, [selectedAccount, dateRange]);

  useEffect(() => { if (selectedAccount) fetchReport(); }, [selectedAccount]);

  // KPI
  const list: any[] = reportData?.list || [];
  const totalSpend = list.reduce((s: number, r: any) => s + (Number(r.metrics?.spend) || 0), 0);
  const totalOrders = list.reduce((s: number, r: any) => s + (Number(r.metrics?.conversions) || 0), 0);
  const cpo = totalOrders > 0 ? (totalSpend / totalOrders).toFixed(2) : '0.00';
  const totalRevenue = totalSpend * 2.5; // 模拟收入 = 花费*ROAS
  const roi = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '-';

  const kpiCards = [
    { label: '花费', value: `$${totalSpend.toFixed(2)}`, icon: <DollarOutlined />, color: '#3b82f6', bg: '#eff6ff' },
    { label: '订单', value: totalOrders, icon: <ShoppingOutlined />, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'CPO', value: `$${cpo}`, icon: <RiseOutlined />, color: '#f59e0b', bg: '#fffbeb' },
    { label: '总收入', value: `$${totalRevenue.toFixed(2)}`, icon: <WalletOutlined />, color: '#059669', bg: '#ecfdf5' },
    { label: 'ROI', value: roi, icon: <TrophyOutlined />, color: '#dc2626', bg: '#fef2f2' },
  ];

  // 图表
  const costData = list.map((r: any) => Number(r.metrics?.spend || 0));
  const orderData = list.map((r: any) => Number(r.metrics?.conversions || 0));
  const xLabels = list.map((_: any, i: number) => `Day ${i + 1}`);

  const chartOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category' as const, data: xLabels },
    yAxis: { type: 'value' as const },
    series: [{
      name: chartTab === 'cost' ? '成本' : '订单数',
      type: 'bar',
      data: chartTab === 'cost' ? costData : orderData,
      color: chartTab === 'cost' ? '#3b82f6' : '#8b5cf6',
    }],
  };

  // 表格
  const columns: ColumnsType<ReportRow> = [
    { title: '店铺', dataIndex: 'shop_name', key: 'shop', render: (v: string) => v || '-' },
    { title: '成本', dataIndex: 'cost', key: 'cost', render: (_: any, r: any) => `$${Number(r.metrics?.spend || 0).toFixed(2)}` },
    { title: '净成本', dataIndex: 'net_cost', key: 'net_cost', render: () => '-' },
    { title: '订单', dataIndex: 'orders', key: 'orders', render: (_: any, r: any) => Number(r.metrics?.conversions || 0) },
    { title: '单均成本', dataIndex: 'cpo', key: 'cpo', render: (_: any, r: any) => {
      const o = Number(r.metrics?.conversions || 0);
      const s = Number(r.metrics?.spend || 0);
      return o > 0 ? `$${(s / o).toFixed(2)}` : '-';
    }},
    { title: '收入', dataIndex: 'revenue', key: 'revenue', render: (_: any, r: any) => {
      const s = Number(r.metrics?.spend || 0);
      return `$${(s * 2.5).toFixed(2)}`;
    }},
    { title: 'ROI', dataIndex: 'roi', key: 'roi', render: () => roi },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}>
          <BarChartOutlined style={{ color: '#fff', fontSize: 18 }} />
        </div>
        <div>
          <Text strong style={{ fontSize: 18, color: '#1e293b', display: 'block' }}>数据报表</Text>
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>查看推广计划数据表现、趋势分析，下钻商品与创意详情</Text>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', background: '#fff', minWidth: 180 }}>
            <option value="">选择广告账户</option>
            {accounts.map(a => <option key={a.advertiser_id} value={a.advertiser_id}>{a.advertiser_name || a.advertiser_id}</option>)}
          </select>
          <RangePicker
            value={[dateRange[0], dateRange[1]]}
            onChange={(dates) => { if (dates?.[0] && dates?.[1]) setDateRange([dates[0], dates[1]]); }}
            style={{ borderRadius: 8 }}
            allowClear={false}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchReport} loading={loading} style={{ borderRadius: 8 }}>
            查询
          </Button>
        </div>
      </Card>

      <Spin spinning={loading && !reportData}>
        {/* KPI 卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
          {kpiCards.map((k, i) => (
            <Card key={i} style={{ borderRadius: 12, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', textAlign: 'center' }} bodyStyle={{ padding: '16px 12px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: k.bg, color: k.color, fontSize: 14, marginBottom: 6 }}>
                {k.icon}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {/* 趋势图 */}
        <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <Text strong style={{ fontSize: 14, color: '#1e293b' }}>趋势</Text>
            <Tabs
              activeKey={chartTab}
              onChange={setChartTab}
              size="small"
              style={{ marginBottom: 0 }}
              items={[
                { key: 'cost', label: '成本' },
                { key: 'orders', label: '订单数' },
              ]}
            />
            <div style={{ flex: 1 }} />
            <Button icon={<ReloadOutlined />} onClick={fetchReport} size="small" style={{ borderRadius: 6 }} />
          </div>
          {list.length > 0 ? (
            <ReactECharts option={chartOption} style={{ height: 300 }} />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>暂无报表数据</div>
          )}
        </Card>

        {/* 数据表格 */}
        <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <Table
            columns={columns}
            dataSource={list.map((r: any, i: number) => ({ ...r, key: i }))}
            size="middle"
            scroll={{ x: 800 }}
            pagination={{ pageSize: 20, showTotal: (t: number) => `共 ${t} 行` }}
            locale={{ emptyText: '暂无报表数据' }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default AdDashboard;
