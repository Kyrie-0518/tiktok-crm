import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Space, Select, Typography, message, Spin, Drawer, Descriptions, Input } from 'antd';
import { ControlOutlined, ReloadOutlined, PlusOutlined, ThunderboltOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api';

const { Text, Title } = Typography;
const { Option } = Select;
const PRIMARY = '#2563eb';

interface OptimizerRule {
  rule_id: string;
  rule_name: string;
  status: string;
  rule_scope: string;
  rule_condition: any;
  rule_action: any;
  create_time: string;
  campaign_id?: string;
}

interface AdvertiserInfo {
  advertiser_id: string;
  advertiser_name: string;
}

const AdRules: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [advertisers, setAdvertisers] = useState<AdvertiserInfo[]>([]);
  const [selectedAdv, setSelectedAdv] = useState('');
  const [rules, setRules] = useState<OptimizerRule[]>([]);
  const [keyword, setKeyword] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRule, setDetailRule] = useState<OptimizerRule | null>(null);

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
    if (!selectedAdv) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/ad-center/rules', { params: { advertiser_id: selectedAdv } });
      if (res.data?.success) {
        const list = (res.data.data?.list || res.data.data?.rules || []).map((r: any) => ({
          rule_id: r.rule_id || r.id,
          rule_name: r.rule_name || r.name,
          status: r.status || r.rule_status,
          rule_scope: r.rule_scope || r.scope || '-',
          rule_condition: r.rule_condition || r.condition,
          rule_action: r.rule_action || r.action,
          create_time: r.create_time || '-',
          campaign_id: r.campaign_id || '-',
        }));
        setRules(list);
      } else {
        message.error(res.data?.error);
      }
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }, [selectedAdv]);

  useEffect(() => { loadAdvertisers(); }, [loadAdvertisers]);
  useEffect(() => { loadRules(); }, [loadRules]);

  const showDetail = (record: OptimizerRule) => {
    setDetailRule(record);
    setDetailOpen(true);
  };

  const filtered = rules.filter(r => keyword
    ? r.rule_name.toLowerCase().includes(keyword.toLowerCase()) || r.rule_id.includes(keyword)
    : true);

  const activeCount = rules.filter(r => r.status === 'ACTIVE' || r.status === 'ENABLED').length;

  const columns: ColumnsType<OptimizerRule> = [
    { title: '规则名称', dataIndex: 'rule_name', key: 'name', width: 200, fixed: 'left',
      render: (n: string, r) => <Text strong style={{ color: PRIMARY, cursor: 'pointer' }} onClick={() => showDetail(r)}>{n || r.rule_id}</Text> },
    { title: '规则ID', dataIndex: 'rule_id', key: 'id', width: 180, render: (id: string) => <Text code>{id}</Text> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => <Tag icon={<ThunderboltOutlined />} color={s === 'ACTIVE' || s === 'ENABLED' ? 'green' : '#94a3b8'}>{s}</Tag> },
    { title: '作用范围', dataIndex: 'rule_scope', key: 'scope', width: 120, render: (v: string) => v || '-' },
    { title: '关联系列', dataIndex: 'campaign_id', key: 'campaign', width: 180, render: (v: string) => v ? <Text code>{v}</Text> : '-' },
    { title: '创建时间', dataIndex: 'create_time', key: 'time', width: 180 },
    { title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_: any, record) => <Button size="small" type="link" onClick={() => showDetail(record)} style={{ color: PRIMARY }}>详情</Button> },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ControlOutlined style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <Title level={4} style={{ margin: 0, color: '#1e293b' }}>智能规则</Title>
          </div>
          <Text type="secondary">TikTok 自动化广告优化规则，按条件自动调整预算/出价/状态</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadRules} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
      </div>

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <Space wrap>
          <Select value={selectedAdv} onChange={setSelectedAdv} style={{ width: 220, borderRadius: 8 }}
            options={advertisers.map(a => ({ value: a.advertiser_id, label: a.advertiser_name }))} />
          <Input prefix={<SearchOutlined />} placeholder="搜索规则名称" value={keyword} onChange={e => setKeyword(e.target.value)}
            allowClear style={{ width: 240, borderRadius: 8 }} />
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            共 <Text strong style={{ color: PRIMARY }}>{filtered.length}</Text> 条规则
            <Tag color="green" style={{ marginLeft: 8 }}>{activeCount} 活跃</Tag>
          </Text>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {loading ? <Spin style={{ display: 'block', margin: '40px auto' }} /> : (
          <Table columns={columns} dataSource={filtered} rowKey="rule_id" size="middle"
            scroll={{ x: 980 }} pagination={{ pageSize: 20, showSizeChanger: false }} />
        )}
      </Card>

      {/* 详情抽屉 */}
      <Drawer title="规则详情" open={detailOpen} onClose={() => setDetailOpen(false)} width={560}>
        {detailRule && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="规则名称">{detailRule.rule_name}</Descriptions.Item>
            <Descriptions.Item label="规则ID"><Text code>{detailRule.rule_id}</Text></Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color="green">{detailRule.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="作用范围">{detailRule.rule_scope}</Descriptions.Item>
            <Descriptions.Item label="关联系列"><Text code>{detailRule.campaign_id}</Text></Descriptions.Item>
            <Descriptions.Item label="创建时间">{detailRule.create_time}</Descriptions.Item>
            <Descriptions.Item label="触发条件">
              <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(detailRule.rule_condition, null, 2)}</pre>
            </Descriptions.Item>
            <Descriptions.Item label="执行动作">
              <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(detailRule.rule_action, null, 2)}</pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default AdRules;
