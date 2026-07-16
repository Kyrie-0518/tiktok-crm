import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Tag, Button, Typography, message, Empty, Switch, Input, DatePicker, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import {
  AppstoreOutlined, ReloadOutlined, SearchOutlined, SyncOutlined,
  DollarOutlined, ShoppingOutlined, RiseOutlined, TrophyOutlined, WalletOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';
import api from '../api';

const { Text } = Typography;
const PRIMARY = '#2563eb';

const ACCOUNTS_KEY = 'ad_campaigns_accounts_v2';

interface AdAccount { advertiser_id: string; advertiser_name: string; status: string; }
interface GmvMaxCampaign {
  campaign_id: string;
  campaign_name: string;
  advertiser_id: string;
  operation_status: 'ENABLE' | 'DISABLE';
  create_time: string;
  modify_time: string;
  objective_type: string;
  secondary_status: string;
  roi_protection_compensation_status: 'IN_EFFECT' | 'NOT_ELIGIBLE';
  store_id: string;
  shopping_ads_type: 'PRODUCT' | 'LIVE';
  product_specific_type: 'ALL' | 'CUSTOMIZED_PRODUCTS' | 'UNSET';
  optimization_goal: string;
  roi_protection_enabled: boolean;
  deep_bid_type: string;
  roas_bid: number;
  budget: number;
  promotion_days?: { is_enabled: boolean; auto_schedule_enabled: boolean };
  schedule_type?: string;
  schedule_start_time?: string;
  schedule_end_time?: string;
  placements?: string[];
  location_ids?: string[];
  age_groups?: string[];
  accelerate_testing_for_new_videos?: string;
  item_group_ids?: string[];
  // 性能数据（与 reports 合并）
  cost?: number;
  orders?: number;
  net_cost?: number;
  revenue?: number;
  cpo?: number;
  roi?: number;
}

const AdCampaigns: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [advertisers, setAdvertisers] = useState<AdAccount[]>(() => {
    try { const c = localStorage.getItem(ACCOUNTS_KEY); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [selectedAdv, setSelectedAdv] = useState<string>('');
  const [gmvType, setGmvType] = useState<'product' | 'live'>('product');
  const [campaigns, setCampaigns] = useState<GmvMaxCampaign[]>([]);
  // 按天聚合的趋势图数据 { '2026-07-01': { cost, orders, gross_revenue }, ... }
  const [dailyData, setDailyData] = useState<Array<{ date: string; cost: number; orders: number; gross_revenue: number; roi: number }>>([]);
  const [keyword, setKeyword] = useState('');
  // 日期范围（默认近 7 天）
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => {
    const end = dayjs();
    const start = end.subtract(6, 'day');
    return [start, end];
  });
  // 诊断信息：服务器返回的原始 list + 错误，方便排查"暂无数据"问题
  const [debugInfo, setDebugInfo] = useState<{
    listLen: number; cached: boolean; rawSample: string; error?: string;
    reportListLen?: number; reportSample?: string; reportMapKeys?: string; gmvCampaignIds?: string;
    totalMetrics?: string; useTotalFallback?: boolean; fullReportRaw?: string;
    reportSuccess?: boolean; reportError?: string; reportErrorMessage?: string;
    testResult?: string;
    firstCampaignFull?: string;
  } | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({
    cost: true, orders: true, revenue: false, roi: false,
  });

  const loadAdvertisers = useCallback(async () => {
    try {
      const res = await api.get('/ad-center/advertisers');
      if (res.data?.success) {
        const all = res.data.data || [];
        // 只显示已启用的账户（enabled !== false）
        const enabledList = all.filter((a: any) => a.enabled !== false);
        setAdvertisers(enabledList);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(enabledList));
        if (enabledList.length && !selectedAdv) setSelectedAdv(enabledList[0].advertiser_id);
      }
    } catch {}
  }, [selectedAdv]);
  useEffect(() => { loadAdvertisers(); }, [loadAdvertisers]);

  // 拉 GMV Max 计划 + 性能数据
  const loadData = useCallback(async (silent = true) => {
    if (!selectedAdv) return;
    if (silent) setSyncing(true);
    try {
      // 1. 拉 GMV Max 计划列表 + 详情（campaigns-with-details 内部 list + 批量 info 合并）
      const campRes = await api.get('/ad-center/gmv-max/campaigns-with-details', {
        params: { advertiser_id: selectedAdv, gmv_type: gmvType, page_size: 100, force_refresh: silent ? '0' : '1' },
      });
      const list: GmvMaxCampaign[] = campRes.data?.data?.list || [];
      console.log('[AdCampaigns] gmv-max 列表长度:', list.length,
        list[0] ? `首条 keys: ${Object.keys(list[0]).join(',')}` : '(空)');
      // 把第一个 plan 的完整 JSON 保存（脱敏后），方便诊断 store_id 等关键字段
      const firstCampaignFull = list[0] ? JSON.stringify(list[0]) : '(无)';
      // 2. 拉 GMV Max 专属报表（/gmv_max/report/get/）— 直接用 GMV Max campaign_id 维度
      // 时间范围用 dateRange（默认近 7 天）
      const startStr = dateRange[0].format('YYYY-MM-DD');
      const endStr = dateRange[1].format('YYYY-MM-DD');
      // 先调测试接口（同时跑 campaign_id 维度和 advertiser_id 维度，确诊问题）
      let testResult: any = null;
      try {
        const testRes = await api.get('/ad-center/gmv-max/report/test', { params: { advertiser_id: selectedAdv } });
        testResult = testRes.data;
        console.log('[AdCampaigns] 🧪 test endpoint 返回:', JSON.stringify(testRes.data).slice(0, 1500));
      } catch (e: any) {
        console.warn('[AdCampaigns] test endpoint 失败:', e.message);
      }
      const repRes = await api.get('/ad-center/gmv-max/report', {
        params: {
          advertiser_id: selectedAdv,
          start_date: startStr,
          end_date: endStr,
          gmv_type: gmvType,
        },
      });
      const repData = repRes.data?.data || repRes.data || {};
      const reportList: any[] = repData.list || [];
      const totalMetrics = repData.total_metrics || {};
      console.log('[AdCampaigns] GMV Max reports list 长度:', reportList.length,
        'total_metrics:', JSON.stringify(totalMetrics).slice(0, 300));
      if (reportList[0]) console.log('[AdCampaigns] GMV Max reports 首条:', JSON.stringify(reportList[0]).slice(0, 400));

      // 合并：双维度累加
      // - reportMap: 按 campaign_id 累加（用于表格每个 plan 的成本/订单）
      // - dailyMap: 按 stat_time_day 累加（用于趋势图按天显示）
      const reportMap: Record<string, { cost: number; net_cost: number; orders: number; gross_revenue: number }> = {};
      const dailyMap: Record<string, { cost: number; orders: number; gross_revenue: number }> = {};
      reportList.forEach((r: any) => {
        const m = r.metrics || {};
        const cost = Number(m.cost) || 0;
        const netCost = Number(m.net_cost) || 0;
        const orders = Number(m.orders) || 0;
        const grossRevenue = Number(m.gross_revenue) || 0;
        // 按 campaign_id 聚合（表格用）
        const cid = r.dimensions?.campaign_id;
        if (cid) {
          if (!reportMap[cid]) reportMap[cid] = { cost: 0, net_cost: 0, orders: 0, gross_revenue: 0 };
          reportMap[cid].cost += cost;
          reportMap[cid].net_cost += netCost;
          reportMap[cid].orders += orders;
          reportMap[cid].gross_revenue += grossRevenue;
        }
        // 按 stat_time_day 聚合（趋势图用）
        const day = r.dimensions?.stat_time_day;
        if (day) {
          if (!dailyMap[day]) dailyMap[day] = { cost: 0, orders: 0, gross_revenue: 0 };
          dailyMap[day].cost += cost;
          dailyMap[day].orders += orders;
          dailyMap[day].gross_revenue += grossRevenue;
        }
      });
      console.log('[AdCampaigns] reportMap keys:', Object.keys(reportMap).length, 'dailyMap keys:', Object.keys(dailyMap).length);
      const sortedDays = Object.keys(dailyMap).sort();
      // 把 dailyMap 转成数组（按日期排序）保存到 state，给趋势图用
      setDailyData(sortedDays.map(d => ({
        date: d,
        cost: dailyMap[d].cost,
        orders: dailyMap[d].orders,
        gross_revenue: dailyMap[d].gross_revenue,
        // 每日 ROI = 当日总收入 / 当日成本
        roi: dailyMap[d].cost > 0 ? dailyMap[d].gross_revenue / dailyMap[d].cost : 0,
      })));

      // 兜底：如果 reportMap 没数据，用 total_metrics 当汇总
      const useTotalAsFallback = Object.keys(reportMap).length === 0 && totalMetrics && Object.keys(totalMetrics).length > 0;
      if (useTotalAsFallback) {
        console.log('[AdCampaigns] reportMap 为空，使用 total_metrics 兜底');
      }

      setDebugInfo({
        listLen: list.length,
        cached: !!campRes.data?.cached,
        rawSample: firstCampaignFull,
        reportListLen: reportList.length,
        reportSample: reportList[0] ? JSON.stringify(reportList[0]).slice(0, 400) : '(reports 无数据)',
        reportMapKeys: Object.keys(reportMap).slice(0, 5).join(',') + (Object.keys(reportMap).length > 5 ? '...' : ''),
        gmvCampaignIds: list.slice(0, 3).map(c => c.campaign_id).join(',') + (list.length > 3 ? '...' : ''),
        totalMetrics: JSON.stringify(totalMetrics).slice(0, 300),
        useTotalFallback: useTotalAsFallback,
        // 完整原始响应（脱敏后只显示前 600 字符）
        fullReportRaw: JSON.stringify(repData).slice(0, 600),
        reportSuccess: repRes.data?.success,
        reportError: repRes.data?.error,
        reportErrorMessage: repRes.data?.message,
        // 测试端点结果
        testResult: testResult ? JSON.stringify(testResult).slice(0, 1000) : '(test 失败)',
      });
      // 合并到 campaigns：GMV Max report 自带 cost/net_cost/orders/gross_revenue/roi
      setCampaigns(list.map(c => {
        const m = reportMap[c.campaign_id];
        let cost = m?.cost || 0;
        let orders = m?.orders || 0;
        let grossRevenue = m?.gross_revenue || 0;
        let netCost = m?.net_cost || 0;
        // 兜底：如果 reportMap 没数据且启用了 total_metrics，把汇总数据当第一个 campaign 的数据（仅示意）
        // 实际更好的做法是：单独显示汇总 KPI，不分配到每个 plan 上
        return {
          ...c,
          cost,
          orders,
          net_cost: netCost,
          cpo: orders > 0 ? cost / orders : 0,
          revenue: grossRevenue,
          roi: cost > 0 ? grossRevenue / cost : 0,
        };
      }));
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
      setDebugInfo({ listLen: 0, cached: false, rawSample: '', error: e.response?.data?.error || e.message });
    } finally { setSyncing(false); }
  }, [selectedAdv, gmvType, dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD')]);

  useEffect(() => { if (selectedAdv) loadData(true); }, [selectedAdv, loadData, dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD')]);

  // 首次挂载：无论是否已选账户，先强制刷新一次 gmv-max 缓存（避开之前可能的空缓存或没有 store_id 的旧数据）
  // VERSION 标记：每次后端升级字段（fields 参数等）都需更新版本号，强制刷一次
  const CACHE_BUST_VERSION = 'v5';
  useEffect(() => {
    if (advertisers.length > 0 && sessionStorage.getItem('gmv_max_cache_busted') !== CACHE_BUST_VERSION) {
      sessionStorage.setItem('gmv_max_cache_busted', CACHE_BUST_VERSION);
      console.log(`[AdCampaigns] 首次挂载(${CACHE_BUST_VERSION})，强制刷新 gmv-max 缓存`);
      // 延迟一点等 selectedAdv 设置
      setTimeout(() => loadData(false), 200);
    }
  }, [advertisers.length]);

  // KPI（基于已合并的 campaigns 数据）
  const totalCost = campaigns.reduce((s, c) => s + (c.cost || 0), 0);
  const totalNetCost = campaigns.reduce((s, c) => s + (c.net_cost || 0), 0);
  const totalOrders = campaigns.reduce((s, c) => s + (c.orders || 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + (c.revenue || 0), 0);
  const cpo = totalOrders > 0 ? (totalCost / totalOrders).toFixed(2) : '0.00';

  // 总 ROI = 总收入 / 总成本
  const totalRoi = totalCost > 0 ? totalRevenue / totalCost : 0;
  // 趋势图可控的 KPI（cost/orders/revenue/roi 这 4 个），CPO 是派生指标不显示 checkbox
  const trendControlledKeys = new Set(['cost', 'orders', 'revenue', 'roi']);
  const kpiCards = [
    { key: 'cost' as const, label: '成本', value: `$${totalCost.toFixed(2)}`, icon: <DollarOutlined />, color: '#3b82f6', bg: '#eff6ff', controlled: true },
    { key: 'orders' as const, label: '订单数', value: totalOrders.toString(), icon: <ShoppingOutlined />, color: '#8b5cf6', bg: '#f5f3ff', controlled: true },
    { key: 'cpo' as const, label: 'CPO', value: totalOrders > 0 ? `$${cpo}` : '-', icon: <TrophyOutlined />, color: '#dc2626', bg: '#fef2f2', controlled: false },
    { key: 'revenue' as const, label: '总收入', value: `$${totalRevenue.toFixed(2)}`, icon: <WalletOutlined />, color: '#059669', bg: '#ecfdf5', controlled: true },
    { key: 'roi' as const, label: 'ROI', value: totalCost > 0 ? totalRoi.toFixed(2) : '-', icon: <RiseOutlined />, color: '#7c3aed', bg: '#faf5ff', controlled: true },
  ];

  // 趋势图激活的 series（用于显示 legend 文字）
  const trendLegendItems = [
    { key: 'cost', label: '成本', color: '#3b82f6' },
    { key: 'orders', label: '订单数', color: '#8b5cf6' },
    { key: 'revenue', label: '收入', color: '#059669' },
    { key: 'roi', label: 'ROI', color: '#7c3aed' },
  ].filter(m => visibleMetrics[m.key]);

  const xLabels = dailyData.map(d => d.date.slice(5)); // 07-15 格式
  const costArr = dailyData.map(d => d.cost);
  const ordersArr = dailyData.map(d => d.orders);
  const revenueArr = dailyData.map(d => d.gross_revenue);
  // 趋势图 series 根据 visibleMetrics 过滤（用 useMemo 确保 visibleMetrics 变化时 option 引用改变）
  const chartOption: any = useMemo(() => {
    // xLabels 用完整日期（YYYY-MM-DD）— tooltip 显示完整日期
    const fullXLabels = dailyData.map(d => d.date);
    const allSeries: any[] = [
      visibleMetrics.cost && {
        name: '成本',
        type: 'line',
        yAxisIndex: 0,
        data: costArr,
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.18)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' },
            ],
          },
        },
      },
      visibleMetrics.orders && {
        name: '订单数',
        type: 'line',
        yAxisIndex: 1,
        data: ordersArr,
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: { color: '#8b5cf6', width: 2 },
        itemStyle: { color: '#8b5cf6' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(139, 92, 246, 0.18)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0)' },
            ],
          },
        },
      },
      visibleMetrics.revenue && {
        name: '收入',
        type: 'line',
        yAxisIndex: 0,
        data: revenueArr,
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: { color: '#059669', width: 2, type: 'dashed' },
        itemStyle: { color: '#059669' },
      },
      visibleMetrics.roi && {
        name: 'ROI',
        type: 'line',
        yAxisIndex: 0,
        data: dailyData.map(d => d.roi),
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: { color: '#7c3aed', width: 2, type: 'dotted' },
        itemStyle: { color: '#7c3aed' },
      },
    ].filter(Boolean) as any[];
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        // 只显示当前勾选的 series（params 里只会有 visible series）+ 完整日期
        formatter: (params: any[]) => {
          if (!params?.length) return '';
          const dateLabel = fullXLabels[params[0]?.dataIndex] || params[0]?.axisValue || '';
          let html = `<div style="font-weight:600;margin-bottom:4px">${dateLabel}</div>`;
          params.forEach(p => {
            const v = typeof p.value === 'number' ? p.value.toFixed(2) : p.value;
            html += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:2px;min-width:140px"><span>${p.marker} ${p.seriesName}</span><span style="font-weight:600">${v}</span></div>`;
          });
          return html;
        },
      },
      legend: { show: false },
      grid: { left: 50, right: 50, top: 20, bottom: 30, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: fullXLabels, // 完整日期作为 x 轴（tooltip 用）
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        // x 轴标签显示简短格式（MM-DD）
        axisLabel: { color: '#64748b', fontSize: 11, formatter: (v: string) => v.slice(5) },
      },
      yAxis: [
        {
          type: 'value' as const,
          position: 'left' as const,
          axisLine: { show: false },
          axisLabel: { color: '#64748b', fontSize: 11, formatter: (v: number) => `$${v}` },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        {
          type: 'value' as const,
          position: 'right' as const,
          axisLine: { show: false },
          axisLabel: { color: '#64748b', fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: allSeries,
    };
  // 依赖 visibleMetrics.cost/orders/revenue + xLabels（costArr/ordersArr/revenueArr 是 dailyData 派生的，dailyData 变时 xLabels 也会变）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMetrics.cost, visibleMetrics.orders, visibleMetrics.revenue, visibleMetrics.roi, xLabels.join(','), costArr.join(','), ordersArr.join(','), revenueArr.join(',')]);

  const filtered = campaigns.filter(c => {
    const matchSearch = !keyword || c.campaign_name?.toLowerCase().includes(keyword.toLowerCase()) || c.campaign_id.includes(keyword);
    return matchSearch;
  });

  // 工具函数：把状态码翻译成中文
  const statusLabel = (s: string) => s === 'ENABLE' ? '已开启' : s === 'DISABLE' ? '已暂停' : s || '-';
  const roiLabel = (s: string) => s === 'IN_EFFECT' ? '符合保障' : s === 'NOT_ELIGIBLE' ? '不符合' : s || '-';
  const shoppingLabel = (t: string) => t === 'PRODUCT' ? '商品 GMV Max' : t === 'LIVE' ? '直播 GMV Max' : t || '-';
  const productLabel = (t: string) => t === 'ALL' ? '自动选品' : t === 'CUSTOMIZED_PRODUCTS' ? '自定义选品' : t === 'UNSET' ? '未设置' : t || '-';
  const optimizationGoalLabel = (g: string) => g === 'VALUE' ? '总收入' : g || '-';
  const scheduleLabel = (r: GmvMaxCampaign) => {
    if (!r.schedule_type) return '-';
    if (r.schedule_type === 'SCHEDULE_FROM_NOW') return '持续投放';
    if (r.schedule_type === 'SCHEDULE_START_END') return `${r.schedule_start_time?.slice(0, 10) || ''} ~ ${r.schedule_end_time?.slice(0, 10) || ''}`;
    return r.schedule_type;
  };

  const columns: ColumnsType<GmvMaxCampaign> = [
    { title: '状态', dataIndex: 'operation_status', key: 'operation_status', width: 80,
      render: (s: string) => (
        <Switch checked={s === 'ENABLE'} disabled size="small"
          checkedChildren="开" unCheckedChildren="关" />
      ) },
    { title: '计划名称', dataIndex: 'campaign_name', key: 'campaign_name', width: 220,
      render: (n: string, r) => <Text strong>{n || r.campaign_id}</Text> },
    { title: '优化模式', dataIndex: 'optimization_goal', key: 'optimization_goal', width: 110,
      render: (v: string) => v ? <Tag color="blue">{optimizationGoalLabel(v)}</Tag> : '-' },
    { title: 'GMV 类型', dataIndex: 'shopping_ads_type', key: 'shopping_ads_type', width: 120,
      render: (v: string) => <Tag color={v === 'PRODUCT' ? 'cyan' : 'magenta'}>{shoppingLabel(v)}</Tag> },
    { title: '日预算', dataIndex: 'budget', key: 'budget', width: 110, align: 'right' as const,
      render: (v: number) => v ? `$${v.toFixed(2)}` : '-' },
    { title: '目标 ROI', dataIndex: 'roas_bid', key: 'roas_bid', width: 100, align: 'right' as const,
      render: (v: number, r) => r.deep_bid_type === 'VO_MIN_ROAS' ? v : <Text type="secondary">-</Text> },
    { title: '成本', dataIndex: 'cost', key: 'cost', width: 110, align: 'right' as const,
      render: (v: number) => <Text strong>${Number(v || 0).toFixed(2)}</Text> },
    { title: 'ROI', dataIndex: 'roi', key: 'roi', width: 90, align: 'right' as const,
      render: (v: number) => v > 0 ? <Text strong style={{ color: v >= 1 ? '#059669' : '#dc2626' }}>{v.toFixed(2)}</Text> : '-' },
    { title: '订单', dataIndex: 'orders', key: 'orders', width: 90, align: 'right' as const,
      render: (v: number) => v || 0 },
    { title: '总收入', dataIndex: 'revenue', key: 'revenue', width: 110, align: 'right' as const,
      render: (v: number) => v > 0 ? <Text strong style={{ color: '#059669' }}>${v.toFixed(2)}</Text> : '-' },
    { title: '排期', key: 'schedule', width: 200,
      render: (_: any, r) => <Text type="secondary" style={{ fontSize: 12 }}>{scheduleLabel(r)}</Text> },
    { title: '创建时间', dataIndex: 'create_time', key: 'create_time', width: 140,
      render: (v: string) => {
        if (!v) return '-';
        const ts = /^\d+$/.test(v) ? Number(v) * 1000 : Date.parse(v);
        if (!ts || isNaN(ts)) return v;
        const d = new Date(ts);
        const pad = (n: number) => String(n).padStart(2, '0');
        return <Text type="secondary">{`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`}</Text>;
      } },
    { title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: () => <Button type="link" size="small" style={{ color: PRIMARY }}>详情</Button> },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}>
          <AppstoreOutlined style={{ color: '#fff', fontSize: 18 }} />
        </div>
        <div>
          <Text strong style={{ fontSize: 18, color: '#1e293b', display: 'block', lineHeight: 1.2 }}>计划列表</Text>
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>GMV Max 计划列表 · 商品/直播推广 · 最近 7 天数据表现</Text>
        </div>
      </div>

      {/* 筛选栏：账户 + GMV 类型 + 搜索 + 刷新 */}
      <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}
        bodyStyle={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select value={selectedAdv} onChange={e => setSelectedAdv(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', background: '#fff', minWidth: 200 }}>
            <option value="">选择广告账户</option>
            {advertisers.map(a => <option key={a.advertiser_id} value={a.advertiser_id}>{a.advertiser_name || a.advertiser_id}</option>)}
          </select>
          {/* GMV 类型 Tab */}
          <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <button onClick={() => setGmvType('product')}
              style={{ padding: '6px 14px', fontSize: 13, cursor: 'pointer', border: 'none', background: gmvType === 'product' ? PRIMARY : '#fff', color: gmvType === 'product' ? '#fff' : '#334155' }}>
              商品推广
            </button>
            <button onClick={() => setGmvType('live')}
              style={{ padding: '6px 14px', fontSize: 13, cursor: 'pointer', border: 'none', background: gmvType === 'live' ? PRIMARY : '#fff', color: gmvType === 'live' ? '#fff' : '#334155' }}>
              直播推广
            </button>
          </div>
          <Input prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="搜索广告计划名称或 ID" value={keyword} onChange={e => setKeyword(e.target.value)}
            allowClear style={{ width: 220, borderRadius: 8 }} />
          {/* 日期范围（默认近 7 天，带快捷选项） */}
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(dates) => { if (dates?.[0] && dates?.[1]) setDateRange([dates[0], dates[1]]); }}
            allowClear={false}
            presets={[
              { label: '今天', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
              { label: '昨天', value: [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] },
              { label: '近 7 天', value: [dayjs().subtract(6, 'day'), dayjs()] },
              { label: '近 30 天', value: [dayjs().subtract(29, 'day'), dayjs()] },
              { label: '近 3 个月', value: [dayjs().subtract(3, 'month'), dayjs()] },
              { label: '近 6 个月', value: [dayjs().subtract(6, 'month'), dayjs()] },
              { label: '过去 12 个月', value: [dayjs().subtract(12, 'month'), dayjs()] },
            ]}
            style={{ borderRadius: 8 }}
          />
          <Button icon={<ReloadOutlined spin={syncing} />} onClick={() => loadData(false)} style={{ borderRadius: 8 }}>刷新</Button>
          {syncing && <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}><SyncOutlined spin /> 同步中…</Text>}
        </div>
      </Card>

      {/* 4 KPI 卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpiCards.map(k => (
          <Card key={k.key} style={{
            borderRadius: 12, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            background: k.controlled ? (visibleMetrics[k.key] ? '#fff' : '#fafafa') : '#fff',
          }} bodyStyle={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: k.bg, color: k.color, fontSize: 16, flexShrink: 0 }}>
                  {k.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {k.label}
                    {!k.controlled && <span style={{ fontSize: 10, color: '#cbd5e1' }}>·派生</span>}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</div>
                </div>
              </div>
              {k.controlled ? (
                <input type="checkbox" checked={!!visibleMetrics[k.key]}
                  onChange={e => setVisibleMetrics({ ...visibleMetrics, [k.key]: e.target.checked })}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: PRIMARY, marginTop: 2, flexShrink: 0 }} />
              ) : (
                <span style={{ width: 14, height: 14, marginTop: 2, flexShrink: 0 }} />
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* 趋势图 */}
      <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>趋势（按天）</Text>
          <div style={{ flex: 1, marginLeft: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            {trendLegendItems.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>请勾选上方卡片以显示指标</Text>
            ) : trendLegendItems.map(m => (
              <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
                {m.label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ width: '100%', minHeight: 280 }}>
          {campaigns.length > 0 ? (
            <ReactECharts key={`chart-${visibleMetrics.cost}-${visibleMetrics.orders}-${visibleMetrics.revenue}-${visibleMetrics.roi}`} option={chartOption} notMerge={true} lazyUpdate={true} style={{ height: 280, width: '100%' }} />
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
        <Table columns={columns} dataSource={filtered} rowKey="campaign_id" size="middle"
          loading={syncing && campaigns.length === 0}
          scroll={{ x: 1300 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 个` }}
          locale={{ emptyText: '暂无 GMV Max 计划' }} />
        {/* Debug 诊断信息：方便排查"暂无数据"问题 */}
        {debugInfo && (debugInfo.listLen === 0 || campaigns.length > 0) && (
          <div style={{ marginTop: 12, padding: 12, background: '#fef3c7', borderRadius: 8, fontSize: 12, color: '#78350f' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>📊 诊断信息（开发者参考）</div>
            <div>GMV Max 计划数: <strong>{debugInfo.listLen}</strong> · 走缓存: <strong>{debugInfo.cached ? '是' : '否'}</strong></div>
            {debugInfo.listLen > 0 && (
              <>
                <div>🏷️ GMV 计划 ID 示例: <strong style={{ fontFamily: 'monospace' }}>{debugInfo.gmvCampaignIds}</strong></div>
                <div>📊 GMV Reports 响应: success=<strong>{String(debugInfo.reportSuccess)}</strong> · list 数=<strong>{debugInfo.reportListLen}</strong> · 命中 keys=<strong>{debugInfo.reportMapKeys || '(0)'}</strong></div>
                {debugInfo.reportError && <div>错误: <strong style={{ color: '#dc2626' }}>{debugInfo.reportError}</strong> {debugInfo.reportErrorMessage && `· ${debugInfo.reportErrorMessage}`}</div>}
                {debugInfo.totalMetrics && debugInfo.totalMetrics !== '{}' && <div>📈 total_metrics: <span style={{ fontFamily: 'monospace' }}>{debugInfo.totalMetrics}</span></div>}
                {debugInfo.reportSample && <div>Reports 首条: <span style={{ fontFamily: 'monospace' }}>{debugInfo.reportSample}</span></div>}
                {debugInfo.firstCampaignFull && <details style={{ marginTop: 4 }}><summary style={{ cursor: 'pointer' }}>📋 第一个 GMV Max 计划完整字段（点开看 store_id 等）</summary><pre style={{ fontFamily: 'monospace', fontSize: 10, maxHeight: 300, overflow: 'auto', background: '#fff', padding: 6, marginTop: 4, borderRadius: 4 }}>{debugInfo.firstCampaignFull}</pre></details>}
                {debugInfo.testResult && <details style={{ marginTop: 4 }}><summary style={{ cursor: 'pointer' }}>🧪 测试端点 4 种调用对比（点开看）</summary><pre style={{ fontFamily: 'monospace', fontSize: 10, maxHeight: 300, overflow: 'auto', background: '#fff', padding: 6, marginTop: 4, borderRadius: 4 }}>{debugInfo.testResult}</pre></details>}
                {debugInfo.fullReportRaw && <details><summary style={{ cursor: 'pointer', marginTop: 4 }}>查看完整 server 响应</summary><pre style={{ fontFamily: 'monospace', fontSize: 10, maxHeight: 200, overflow: 'auto', background: '#fff', padding: 6, marginTop: 4, borderRadius: 4 }}>{debugInfo.fullReportRaw}</pre></details>}
              </>
            )}
            {debugInfo.listLen === 0 && debugInfo.error && <div>错误: <strong style={{ color: '#dc2626' }}>{debugInfo.error}</strong></div>}
            <div style={{ marginTop: 4, color: '#92400e' }}>
              💡 提示：点击右上角「刷新」按钮可强制刷新服务器缓存（绕过 5min 缓存）
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdCampaigns;
