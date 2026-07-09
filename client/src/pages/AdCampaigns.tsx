import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Space, Select, Input, Typography, message, Spin, Modal, Switch } from 'antd';
import { AppstoreOutlined, ReloadOutlined, SearchOutlined, PlayCircleOutlined, PauseCircleOutlined, CaretRightOutlined, PauseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api';

const { Text, Title } = Typography;
const { Option } = Select;
const PRIMARY = '#2563eb';

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective_type: string;
  budget: number;
  budget_mode: string;
  create_time: string;
}

interface AdvertiserInfo {
  advertiser_id: string;
  advertiser_name: string;
}

const STATUS_MAP: Record<string, { color: string; icon: React.ReactNode }> = {
  ENABLE: { color: 'green', icon: <PlayCircleOutlined /> },
  DISABLE: { color: '#ef4444', icon: <PauseCircleOutlined /> },
  DELETED: { color: '#94a3b8', icon: null },
};

const AdCampaigns: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [advertisers, setAdvertisers] = useState<AdvertiserInfo[]>([]);
  const [selectedAdv, setSelectedAdv] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadAdvertisers = useCallback(async () => {
    try {
      const res = await api.get('/ad-center/advertisers');
      if (res.data?.success) {
        const list = res.data.data || [];
        setAdvertisers(list);
        if (list.length && !selectedAdv) setSelectedAdv(list[0].advertiser_id);
      }
    } catch { /* ignore */ }
  }, [selectedAdv]);

  const loadCampaigns = useCallback(async () => {
    if (!selectedAdv) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/ad-center/campaigns', {
        params: { advertiser_id: selectedAdv, page_size: 100, status: statusFilter || undefined },
      });
      if (res.data?.success) {
        const list = (res.data.data?.list || []).map((c: any) => ({
          campaign_id: c.campaign_id,
          campaign_name: c.campaign_name,
          status: c.status || c.operation_status,
          objective_type: c.objective_type,
          budget: c.budget || 0,
          budget_mode: c.budget_mode || '-',
          create_time: c.create_time || '-',
        }));
        setCampaigns(list);
      } else {
        message.error(res.data?.error);
      }
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }, [selectedAdv, statusFilter]);

  useEffect(() => { loadAdvertisers(); }, [loadAdvertisers]);
  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

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

  const filtered = campaigns.filter(c => keyword
    ? c.campaign_name.toLowerCase().includes(keyword.toLowerCase()) || c.campaign_id.includes(keyword)
    : true);

  const activeCount = campaigns.filter(c => c.status === 'ENABLE').length;
  const pausedCount = campaigns.filter(c => c.status === 'DISABLE').length;

  const columns: ColumnsType<Campaign> = [
    { title: '系列名称', dataIndex: 'campaign_name', key: 'name', fixed: 'left', width: 200,
      render: (n: string, r) => <Text strong style={{ color: PRIMARY }}>{n || r.campaign_id}</Text> },
    { title: 'ID', dataIndex: 'campaign_id', key: 'id', width: 190, render: (id: string) => <Text code>{id}</Text> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 120,
      render: (s: string) => <Tag icon={STATUS_MAP[s]?.icon} color={STATUS_MAP[s]?.color}>{s}</Tag> },
    { title: '目标', dataIndex: 'objective_type', key: 'objective', width: 120, render: (v: string) => v || '-' },
    { title: '预算', dataIndex: 'budget', key: 'budget', width: 120, render: (v: number) => v ? `$${v.toFixed(2)}` : '-' },
    { title: '预算模式', dataIndex: 'budget_mode', key: 'budget_mode', width: 100 },
    { title: '创建时间', dataIndex: 'create_time', key: 'time', width: 180 },
    { title: '操作', key: 'action', width: 120, fixed: 'right',
      render: (_: any, record) => (
        <Button icon={record.status === 'ENABLE' ? <PauseOutlined /> : <CaretRightOutlined />}
          onClick={() => toggleStatus(record)} size="small"
          style={{ borderRadius: 6, color: record.status === 'ENABLE' ? '#ef4444' : '#059669' }}
          type="text">
          {record.status === 'ENABLE' ? '暂停' : '启用'}
        </Button>
      )},
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AppstoreOutlined style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <Title level={4} style={{ margin: 0, color: '#1e293b' }}>系列管理</Title>
          </div>
          <Text type="secondary">TikTok 广告系列列表、启停、预算修改</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadCampaigns} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
      </div>

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <Space wrap>
          <Select value={selectedAdv} onChange={setSelectedAdv} style={{ width: 220, borderRadius: 8 }}
            options={advertisers.map(a => ({ value: a.advertiser_id, label: a.advertiser_name }))} />
          <Input prefix={<SearchOutlined />} placeholder="搜索系列名称/ID" value={keyword} onChange={e => setKeyword(e.target.value)}
            allowClear style={{ width: 240, borderRadius: 8 }} />
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 130, borderRadius: 8 }} allowClear placeholder="全部状态">
            <Option value="ENABLE">启用</Option>
            <Option value="DISABLE">暂停</Option>
          </Select>
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            共 <Text strong style={{ color: PRIMARY }}>{filtered.length}</Text> 个系列
            <Tag color="green" style={{ marginLeft: 8 }}>{activeCount} 启用</Tag>
            <Tag color="#ef4444">{pausedCount} 暂停</Tag>
          </Text>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {loading ? <Spin style={{ display: 'block', margin: '40px auto' }} /> : (
          <Table columns={columns} dataSource={filtered} rowKey="campaign_id" size="middle" scroll={{ x: 1100 }}
            pagination={{ pageSize: 20, showSizeChanger: false }} />
        )}
      </Card>
    </div>
  );
};

export default AdCampaigns;
