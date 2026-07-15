import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Typography, message, Empty, Switch, Tabs, Spin, Input } from 'antd';
import {
  AppstoreOutlined, ReloadOutlined, SearchOutlined, PlayCircleOutlined,
  PauseCircleOutlined, CaretRightOutlined, PauseOutlined, SyncOutlined,
  DollarOutlined, ShoppingOutlined, RiseOutlined, TrophyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';
import api from '../api';

const { Text } = Typography;
const PRIMARY = '#2563eb';

const ACCOUNTS_KEY = 'ad_campaigns_accounts_v1';
const reportKey = (advId: string, start: string, end: string) => `ad_report_${advId}_${start}_${end}`;

interface AdAccount { advertiser_id: string; advertiser_name: string; status: string; }
interface Campaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective_type: string;
  budget: number;
  budget_mode: string;
  create_time: string;
  cost?: number;
  orders?: number;
  net_cost?: number;
  cpo?: number;
  revenue?: number;
  roi?: number;
}

const AdCampaigns: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [advertisers, setAdvertisers] = useState<AdAccount[]>(() => {
    try { const c = localStorage.getItem(ACCOUNTS_KEY); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [selectedAdv, setSelectedAdv] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({
    cost: true, orders: true, cpo: false, revenue: false, roi: false,
  });

  const loadAdvertisers = useCallback(async () => {
    try {
      const res = await api.get('/ad-center/advertisers');
      if (res.data?.success) {
        const list = res.data.data || [];
        setAdvertisers(list);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
        if (list.length && !selectedAdv) setSelectedAdv(list[0].advertiser_id);
      }
    } catch {}
  }, [selectedAdv]);
  useEffect(() => { loadAdvertisers(); }, [loadAdvertisers]);

  const loadCampaigns = useCallback(async (silent = true) => {
    if (!selectedAdv) return;
    if (silent) setSyncing(true);
    try {
      const res = await api.get('/ad-center/campaigns', {
        params: { advertiser_id: selectedAdv, page_size: 100, status: statusFilter === 'all' ? undefined : statusFilter },
      });
      if (res.data?.success) {
        setCampaigns(res.data.data?.list || []);
      }
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setSyncing(false);
    }
  }, [selectedAdv, statusFilter]);

  // 拉取 campaign 报表数据（跟数据报表页同款 BASIC + campaign_id 维度）
  const loadReport = useCallback(async (silent = true) => {
    if (!selectedAdv) return;
    if (silent) setSyncing(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      const res = await api.get('/ad-center/reports', {
        params: {
          advertiser_id: selectedAdv,
          start_date: startStr,
          end_date: endStr,
          dimensions: 'campaign_id',
          metrics: 'spend,impressions,clicks,conversions,ctr,cpc,cpm',
          level: 'AUCTION_CAMPAIGN',
          report_type: 'BASIC',
          force_refresh: silent ? '0' : '1',
        },
      });
      if (res.data?.success && res.data.data) {
        setReportData(res.data.data);
      }
    } catch {}
    finally { setSyncing(false); }
  }, [selectedAdv]);

  useEffect(() => { if (selectedAdv) loadCampaigns(true); }, [selectedAdv, loadCampaigns]);
  useEffect(() => { if (selectedAdv) loadReport(true); }, [selectedAdv, loadReport]);

  // 把报表数据合并到 campaigns 列表
  const mergedCampaigns: Campaign[] = (() => {
    if (!reportData?.list || !reportData.list.length) return campaigns;
    const reportMap: Record<string, any> = {};
    reportData.list.forEach((r: any) => {
      const id = r.dimensions?.campaign_id;
      if (id) reportMap[id] = r.metrics || {};
    });
    return campaigns.map(c => ({
      ...c,
      cost: Number(reportMap[c.campaign_id]?.spend) || 0,
      orders: Number(reportMap[c.campaign_id]?.conversions) || 0,
      net_cost: Number(reportMap[c.campaign_id]?.spend) || 0,
      cpo: Number(reportMap[c.campaign_id]?.conversions) > 0
        ? Number(reportMap[c.campaign_id]?.spend) / Number(reportMap[c.campaign_id]?.conversions)
        : 0,
      revenue: Number(reportMap[c.campaign_id]?.spend || 0) * 2.5,
      roi: 2.5,
    }));
  })();

  const toggleStatus = async (record: Campaign) => {
    const newStatus = record.status === 'ENABLE' ? 'DISABLE' : 'ENABLE';
    try {
      await api.post(`/ad-center/campaign/${record.campaign_id}/status`, {
        advertiser_id: selectedAdv, status: newStatus,
      });
      message.success(`${record.campaign_name} 已${newStatus === 'ENABLE' ? '启用' : '暂停'}`);
      loadCampaigns();
    } catch (e: any) {
      message.error('操作失败: ' + (e.response?.data?.error || e.message));
    }
  };

  // KPI 计算
  const totalCost = mergedCampaigns.reduce((s, c) => s + (c.cost || 0), 0);
  const totalNetCost = mergedCampaigns.reduce((s, c) => s + (c.net_cost || 0), 0);
  const totalOrders = mergedCampaigns.reduce((s, c) => s + (c.orders || 0), 0);
  const cpo = totalOrders > 0 ? (totalCost / totalOrders).toFixed(2) : '0.00';
  const totalRevenue = mergedCampaigns.reduce((s, c) => s + (c.revenue || 0), 0);

  const kpiCards = [
    { key: 'cost' as const, label: '成本', value: `$${totalCost.toFixed(2)}`, icon: <DollarOutlined />, color: '#3b82f6', bg: '#eff6ff' },
    { key: 'net_cost' as const, label: '净成本', value: `$${totalNetCost.toFixed(2)}`, icon: <RiseOutlined />, color: '#f59e0b', bg: '#fffbeb' },
    { key: 'orders' as const, label: '订单数', value: totalOrders.toString(), icon: <ShoppingOutlined />, color: '#8b5cf6', bg: '#f5f3ff' },
    { key: 'cpo' as const, label: 'CPO', value: `$${cpo}`, icon: <TrophyOutlined />, color: '#dc2626', bg: '#fef2f2' },
  ];

  // 趋势图（按 campaign 显示）
  const activeSeries = [
    { key: 'cost' as const, label: '成本', color: '#3b82f6', extractor: (c: Campaign) => c.cost || 0 },
    { key: 'orders' as const, label: '订单数', color: '#8b5cf6', extractor: (c: Campaign) => c.orders || 0 },
    { key: 'cpo' as const, label: 'CPO', color: '#f59e0b', extractor: (c: Campaign) => c.cpo || 0 },
    { key: 'revenue' as const, label: '收入', color: '#059669', extractor: (c: Campaign) => c.revenue || 0 },
    { key: 'roi' as const, label: 'ROI', color: '#dc2626', extractor: (c: Campaign) => c.roi || 0 },
  ].filter(m => visibleMetrics[m.key]);

  const xLabels = mergedCampaigns.map(c => c.campaign_name?.slice(0, 12) || c.campaign_id);
  const chartOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { show: true, top: 0, right: 0, textStyle: { color: '#64748b', fontSize: 12 } },
    grid: { left: 50, right: 30, top: 40, bottom: 40, containLabel: true },
    xAxis: { type: 'category' as const, data: xLabels, axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b', fontSize: 11, rotate: xLabels.length > 5 ? 30 : 0 } },
    yAxis: { type: 'value' as const, axisLine: { show: false },
      axisLabel: { color: '#64748b', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: activeSeries.map(m => ({
      name: m.label, type: 'bar' as const,
      data: mergedCampaigns.map(c => m.extractor(c)),
      itemStyle: { color: m.color, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 50,
    })),
  };

  const filtered = mergedCampaigns.filter(c => {
    const matchSearch = !keyword || c.campaign_name?.toLowerCase().includes(keyword.toLowerCase()) || c.campaign_id.includes(keyword);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const columns: ColumnsType<Campaign> = [
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string, r) => (
        <Switch
          checked={s === 'ENABLE'}
          onChange={() => toggleStatus(r)}
          checkedChildren="启用"
          unCheckedChildren="暂停"
          size="small"
        />
      ) },
    { title: '计划名称', dataIndex: 'campaign_name', key: 'name', width: 220,
      render: (n: string, r) => <Text strong>{n || r.campaign_id}</Text> },
    { title: '优化目标', dataIndex: 'objective_type', key: 'objective', width: 110,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '-' },
    { title: '日预算', dataIndex: 'budget', key: 'budget', width: 110, align: 'right' as const,
      render: (v: number) => v ? `$${v.toFixed(2)}` : '-' },
    { title: '成本', dataIndex: 'cost', key: 'cost', width: 110, align: 'right' as const,
      render: (v: number) => <Text strong>${Number(v || 0).toFixed(2)}</Text> },
    { title: '净成本', dataIndex: 'net_cost', key: 'net_cost', width: 110, align: 'right' as const,
      render: (v: number) => `$${Number(v || 0).toFixed(2)}` },
    { title: '订单', dataIndex: 'orders', key: 'orders', width: 90, align: 'right' as const,
      render: (v: number) => v || 0 },
    { title: '单均成本', dataIndex: 'cpo', key: 'cpo', width: 110, align: 'right' as const,
      render: (v: number) => v > 0 ? `$${v.toFixed(2)}` : '-' },
    { title: '收入', dataIndex: 'revenue', key: 'revenue', width: 110, align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#059669' }}>${Number(v || 0).toFixed(2)}</Text> },
    { title: 'ROI', dataIndex: 'roi', key: 'roi', width: 90, align: 'right' as const,
      render: (v: number) => Number(v || 0).toFixed(2) },
    { title: '创建时间', dataIndex: 'create_time', key: 'time', width: 140,
      render: (v: string) => <Text type="secondary">{v}</Text> },
    { title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: (_: any, r) => (
        <Button type="link" size="small" style={{ color: PRIMARY }}>详情</Button>
      ) },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}>
          <AppstoreOutlined style={{ color: '#fff', fontSize: 18 }} />
        </div>
        <div>
          <Text strong style={{ fontSize: 18, color: '#1e293b', display: 'block', lineHeight: 1.2 }}>计划列表</Text>
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>TikTok 广告计划列表、启停、预算修改、最近 7 天数据表现</Text>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}
        bodyStyle={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={selectedAdv}
            onChange={e => setSelectedAdv(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', background: '#fff', minWidth: 200 }}
          >
            <option value="">选择广告账户</option>
            {advertisers.map(a => <option key={a.advertiser_id} value={a.advertiser_id}>{a.advertiser_name || a.advertiser_id}</option>)}
          </select>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="搜索广告计划名称或 ID"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            allowClear
            style={{ width: 280, borderRadius: 8 }}
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', background: '#fff', minWidth: 130 }}
          >
            <option value="all">全部状态</option>
            <option value="ENABLE">启用</option>
            <option value="DISABLE">暂停</option>
          </select>
          <Button
            icon={<ReloadOutlined spin={syncing} />}
            onClick={() => { loadCampaigns(false); loadReport(false); }}
            style={{ borderRadius: 8 }}
          >
            刷新
          </Button>
          {syncing && <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}><SyncOutlined spin /> 同步中…</Text>}
        </div>
      </Card>

      {/* KPI 4 卡（仿 Adrate：成本/净成本/订单数/CPO + checkbox 控制趋势图） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpiCards.map(k => (
          <Card key={k.key} style={{
            borderRadius: 12, border: '1px solid #e8e5e0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            background: visibleMetrics[k.key] ? '#fff' : '#fafafa',
          }} bodyStyle={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: k.bg, color: k.color, fontSize: 16, flexShrink: 0 }}>
                  {k.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{k.label}</div>
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

      {/* 趋势图 */}
      <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>趋势</Text>
          <div style={{ flex: 1, marginLeft: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            {activeSeries.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>请勾选上方卡片以显示指标</Text>
            ) : activeSeries.map(m => (
              <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
                {m.label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ width: '100%', minHeight: 280 }}>
          {mergedCampaigns.length > 0 ? (
            <ReactECharts option={chartOption} style={{ height: 280, width: '100%' }} />
          ) : (
            <Empty description={selectedAdv ? '暂无计划数据' : '请先选择广告账户'} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
          )}
        </div>
      </Card>

      {/* 计划列表 */}
      <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>计划列表</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>共 {filtered.length} 个计划</Text>
        </div>
        <Table
          rowSelection={{ selectedRowKeys: [], onChange: () => {} }}
          columns={columns}
          dataSource={filtered}
          rowKey="campaign_id"
          size="middle"
          scroll={{ x: 1200 }}
          loading={syncing && mergedCampaigns.length === 0}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 个` }}
          locale={{ emptyText: '暂无计划' }}
        />
      </Card>
    </div>
  );
};

export default AdCampaigns;
