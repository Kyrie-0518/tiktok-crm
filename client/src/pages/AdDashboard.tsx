import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Table, Tag, Select, Space, Button, Spin, message, Typography, DatePicker } from 'antd';
import { FundOutlined, DollarOutlined, RiseOutlined, BarChartOutlined, ReloadOutlined, CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';
import api from '../api';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;
const PRIMARY = '#2563eb';

interface AdvertiserInfo {
  advertiser_id: string;
  advertiser_name: string;
  status: string;
  balance?: number;
  spend_today?: number;
  roas?: number;
}

const AdDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [advertisers, setAdvertisers] = useState<AdvertiserInfo[]>([]);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<string>('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().subtract(7, 'day'), dayjs(),
  ]);

  // Summary KPI
  const totalSpend = reportData.reduce((s, r) => s + (Number(r.metrics?.spend) || 0), 0);
  const totalImpressions = reportData.reduce((s, r) => s + (Number(r.metrics?.impressions) || 0), 0);
  const totalClicks = reportData.reduce((s, r) => s + (Number(r.metrics?.clicks) || 0), 0);
  const totalConversions = reportData.reduce((s, r) => s + (Number(r.metrics?.conversions) || 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';
  const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0';
  const convRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : '0';

  const loadAdvertisers = useCallback(async () => {
    try {
      const res = await api.get('/ad-center/advertisers');
      if (res.data?.success) {
        const list = (res.data.data || []).map((a: any) => ({
          advertiser_id: a.advertiser_id || a.id,
          advertiser_name: a.advertiser_name || a.name || a.advertiser_id,
          status: a.status || 'ACTIVE',
          balance: a.balance_info?.balance || 0,
        }));
        setAdvertisers(list);
        if (list.length > 0 && !selectedAdvertiser) {
          setSelectedAdvertiser(list[0].advertiser_id);
        }
      }
    } catch (e: any) {
      message.error('加载广告账户失败');
    }
  }, [selectedAdvertiser]);

  const loadReport = useCallback(async () => {
    if (!selectedAdvertiser) return;
    setLoading(true);
    try {
      const resp = await api.get('/ad-center/reports', {
        params: {
          advertiser_id: selectedAdvertiser,
          start_date: dateRange[0]!.format('YYYY-MM-DD'),
          end_date: dateRange[1]!.format('YYYY-MM-DD'),
          dimensions: 'campaign_id',
          metrics: 'spend,impressions,clicks,conversions,ctr,cpc,cpm',
        },
      });
      if (resp.data?.success) {
        setReportData(resp.data.data?.list || []);
      }
    } catch (e: any) {
      message.error('加载报表失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }, [selectedAdvertiser, dateRange]);

  useEffect(() => { loadAdvertisers(); }, [loadAdvertisers]);
  useEffect(() => { loadReport(); }, [loadReport]);

  // Chart options
  const trendOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['消耗', '展示量'], bottom: 0 },
    xAxis: {
      type: 'category' as const,
      data: reportData.map((r: any) => r.dimensions?.campaign_id || r.dimensions?.campaign_name || '-'),
    },
    yAxis: [
      { type: 'value' as const, name: '消耗 ($)' },
      { type: 'value' as const, name: '展示量' },
    ],
    series: [
      {
        name: '消耗', type: 'bar', color: '#3b82f6',
        data: reportData.map((r: any) => Number(r.metrics?.spend) || 0),
      },
      {
        name: '展示量', type: 'line', yAxisIndex: 1, color: '#059669',
        data: reportData.map((r: any) => Number(r.metrics?.impressions) || 0),
      },
    ],
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
  };

  const campaignColumns: ColumnsType<any> = [
    { title: '系列名称', dataIndex: 'campaign_name', key: 'name', fixed: 'left', width: 180,
      render: (_: any, r: any) => r.dimensions?.campaign_name || r.dimensions?.campaign_id || '-' },
    { title: '消耗', dataIndex: 'spend', key: 'spend', sorter: (a: any, b: any) => (a.metrics?.spend || 0) - (b.metrics?.spend || 0),
      render: (_: any, r: any) => <Text strong>${Number(r.metrics?.spend || 0).toFixed(2)}</Text> },
    { title: '展示量', dataIndex: 'impressions', key: 'impressions',
      render: (_: any, r: any) => Number(r.metrics?.impressions || 0).toLocaleString() },
    { title: '点击数', dataIndex: 'clicks', key: 'clicks',
      render: (_: any, r: any) => Number(r.metrics?.clicks || 0).toLocaleString() },
    { title: 'CTR', dataIndex: 'ctr', key: 'ctr',
      render: (_: any, r: any) => `${Number(r.metrics?.ctr || 0).toFixed(2)}%` },
    { title: 'CPC', dataIndex: 'cpc', key: 'cpc',
      render: (_: any, r: any) => `$${Number(r.metrics?.cpc || 0).toFixed(2)}` },
    { title: '转化', dataIndex: 'conversions', key: 'conversions',
      render: (_: any, r: any) => <Tag color="green">{r.metrics?.conversions || 0}</Tag> },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FundOutlined style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <Title level={4} style={{ margin: 0, color: '#1e293b' }}>广告仪表盘</Title>
          </div>
          <Text type="secondary">实时消耗与效果数据，数据来源 TikTok Marketing API</Text>
        </div>
        <Space>
          <Select value={selectedAdvertiser} onChange={setSelectedAdvertiser} style={{ width: 220, borderRadius: 8 }}
            options={advertisers.map(a => ({ value: a.advertiser_id, label: a.advertiser_name }))} />
          <RangePicker value={dateRange} onChange={(d) => d && d[0] && d[1] && setDateRange(d)} style={{ borderRadius: 8 }} />
          <Button icon={<ReloadOutlined />} onClick={loadReport} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
        </Space>
      </div>

      {loading ? <Spin size="large" style={{ display: 'block', margin: '40px auto' }} /> : (
        <>
          {/* KPI Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {[
              { label: '总消耗', value: `$${totalSpend.toFixed(2)}`, icon: <DollarOutlined />, color: '#3b82f6' },
              { label: '展示量', value: totalImpressions.toLocaleString(), icon: <BarChartOutlined />, color: '#059669' },
              { label: 'CTR', value: `${ctr}%`, icon: <RiseOutlined />, color: '#d97706' },
              { label: 'CPC', value: `$${cpc}`, icon: <FundOutlined />, color: '#7c3aed' },
            ].map((kpi, i) => (
              <Col xs={12} sm={6} key={i}>
                <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {React.cloneElement(kpi.icon as React.ReactElement, { style: { color: kpi.color, fontSize: 18 } })}
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{kpi.label}</Text>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{kpi.value}</div>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Trend Chart */}
          <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <Text strong style={{ fontSize: 15, marginBottom: 12, display: 'block' }}>消耗 & 展示量趋势</Text>
            {reportData.length > 0 ? (
              <ReactECharts option={trendOption} style={{ height: 300 }} />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>暂无数据，请选择日期范围</div>
            )}
          </Card>

          {/* Campaign Table */}
          <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Text strong style={{ fontSize: 15, marginBottom: 12, display: 'block' }}>
              系列维度数据 <Text type="secondary" style={{ fontSize: 12 }}>（{reportData.length} 行）</Text>
            </Text>
            <Table columns={campaignColumns} dataSource={reportData} rowKey={(r: any) => r.dimensions?.campaign_id || Math.random().toString()}
              size="middle" scroll={{ x: 900 }} pagination={{ pageSize: 20, showSizeChanger: false }} />
          </Card>
        </>
      )}
    </div>
  );
};

export default AdDashboard;
