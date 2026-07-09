import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Space, Select, Typography, message, Spin, Timeline, Input } from 'antd';
import { FileTextOutlined, ReloadOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api';

const { Text, Title } = Typography;
const PRIMARY = '#2563eb';

interface RuleLog {
  rule_log_id: string;
  rule_id: string;
  action: string;
  status: string;
  message: string;
  create_time: string;
  before_value?: any;
  after_value?: any;
}

interface AdvertiserInfo {
  advertiser_id: string;
  advertiser_name: string;
}

const AdLogs: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [advertisers, setAdvertisers] = useState<AdvertiserInfo[]>([]);
  const [selectedAdv, setSelectedAdv] = useState('');
  const [rules, setRules] = useState<{ rule_id: string; rule_name: string }[]>([]);
  const [selectedRule, setSelectedRule] = useState<string>('');
  const [logs, setLogs] = useState<RuleLog[]>([]);
  const [keyword, setKeyword] = useState('');

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

  const loadRules = useCallback(async () => {
    if (!selectedAdv) return;
    try {
      const res = await api.get('/ad-center/rules', { params: { advertiser_id: selectedAdv } });
      if (res.data?.success) {
        const list = (res.data.data?.list || []).map((r: any) => ({
          rule_id: r.rule_id || r.id,
          rule_name: r.rule_name || r.name,
        }));
        setRules(list);
        if (list.length && !selectedRule) setSelectedRule(list[0].rule_id);
      }
    } catch { /* ignore */ }
  }, [selectedAdv, selectedRule]);

  const loadLogs = useCallback(async () => {
    if (!selectedRule) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/ad-center/rules/${selectedRule}/logs`, {
        params: { advertiser_id: selectedAdv },
      });
      if (res.data?.success) {
        const list = (res.data.data?.list || []).map((l: any) => ({
          rule_log_id: l.rule_log_id || l.id || Math.random().toString(),
          rule_id: l.rule_id || selectedRule,
          action: l.action || l.event_type || '-',
          status: l.status || l.result,
          message: l.message || l.description || JSON.stringify(l),
          create_time: l.create_time || l.time || '-',
          before_value: l.before_value,
          after_value: l.after_value,
        }));
        setLogs(list);
      }
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }, [selectedAdv, selectedRule]);

  useEffect(() => { loadAdvertisers(); }, [loadAdvertisers]);
  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filtered = logs.filter(l => keyword
    ? l.message.toLowerCase().includes(keyword.toLowerCase()) || l.action.toLowerCase().includes(keyword.toLowerCase())
    : true);

  const successCount = logs.filter(l => l.status === 'SUCCESS' || l.status === 'COMPLETED').length;
  const failCount = logs.filter(l => l.status === 'FAILED' || l.status === 'ERROR').length;

  const columns: ColumnsType<RuleLog> = [
    { title: '时间', dataIndex: 'create_time', key: 'time', width: 180, fixed: 'left' },
    { title: '操作', dataIndex: 'action', key: 'action', width: 120,
      render: (v: string) => <Tag>{v}</Tag> },
    { title: '结果', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => {
        const isSuccess = s === 'SUCCESS' || s === 'COMPLETED';
        return <Tag icon={isSuccess ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={isSuccess ? 'green' : 'red'}>{s}</Tag>;
      } },
    { title: '描述', dataIndex: 'message', key: 'message', ellipsis: true,
      render: (m: string) => <Text>{m?.slice(0, 150)}{m?.length > 150 ? '...' : ''}</Text> },
    { title: '变更前', dataIndex: 'before_value', key: 'before', width: 150,
      render: (v: any) => v ? <Text code style={{ fontSize: 11 }}>{JSON.stringify(v).slice(0, 80)}</Text> : '-' },
    { title: '变更后', dataIndex: 'after_value', key: 'after', width: 150,
      render: (v: any) => v ? <Text code style={{ fontSize: 11 }}>{JSON.stringify(v).slice(0, 80)}</Text> : '-' },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileTextOutlined style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <Title level={4} style={{ margin: 0, color: '#1e293b' }}>执行日志</Title>
          </div>
          <Text type="secondary">自动化规则执行记录与变更历史</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
      </div>

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <Space wrap>
          <Select value={selectedAdv} onChange={setSelectedAdv} style={{ width: 220, borderRadius: 8 }}
            options={advertisers.map(a => ({ value: a.advertiser_id, label: a.advertiser_name }))} />
          <Select value={selectedRule} onChange={setSelectedRule} style={{ width: 200, borderRadius: 8 }}
            options={rules.map(r => ({ value: r.rule_id, label: r.rule_name }))} />
          <Input prefix={<SearchOutlined />} placeholder="搜索日志" value={keyword} onChange={e => setKeyword(e.target.value)}
            allowClear style={{ width: 200, borderRadius: 8 }} />
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            共 <Text strong style={{ color: PRIMARY }}>{filtered.length}</Text> 条
            <Tag icon={<CheckCircleOutlined />} color="green" style={{ marginLeft: 8 }}>{successCount} 成功</Tag>
            <Tag icon={<CloseCircleOutlined />} color="red">{failCount} 失败</Tag>
          </Text>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {loading ? <Spin style={{ display: 'block', margin: '40px auto' }} /> : (
          <Table columns={columns} dataSource={filtered} rowKey="rule_log_id" size="middle"
            scroll={{ x: 1000 }} pagination={{ pageSize: 30, showSizeChanger: false }} />
        )}
      </Card>
    </div>
  );
};

export default AdLogs;
