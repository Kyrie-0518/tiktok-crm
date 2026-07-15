import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Space, Select, Typography, message, Input, Drawer, Descriptions, Popconfirm, Switch, Modal, Collapse, InputNumber, Tabs, Tooltip } from 'antd';
import {
  ControlOutlined, ReloadOutlined, PlusOutlined, SearchOutlined,
  EditOutlined, DeleteOutlined, CheckCircleOutlined, StopOutlined,
  RobotOutlined, ImportOutlined, ThunderboltOutlined, ExperimentOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api';

const { Text } = Typography;
const PRIMARY = '#2563eb';

interface AdAccount { advertiser_id: string; advertiser_name: string; }
interface Rule {
  id: string; name: string; status: string; level: string; binding_count: number;
  interval_minutes: number; trigger_count: number; trigger_mode: string;
  last_run: string; ai_score?: number; created_at: string;
}

const CACHE_KEY = 'ad_rules_accounts';

const AdRules: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdAccount[]>(() => {
    try { const c = localStorage.getItem(CACHE_KEY); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [selectedAccount, setSelectedAccount] = useState('');
  const [rules, setRules] = useState<Rule[]>([]);
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [runFilter, setRunFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  // 加载账户
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

  // 加载规则
  const fetchRules = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const res = await api.get('/ad-center/rules', { params: { advertiser_id: selectedAccount, force_refresh: '0' } });
      if (res.data?.success) setRules(res.data.data?.list || []);
    } catch { message.error('规则加载失败'); }
    finally { setLoading(false); }
  }, [selectedAccount]);

  useEffect(() => { if (selectedAccount) fetchRules(); }, [selectedAccount]);

  // 过滤
  const filteredRules = rules.filter(r => {
    const matchSearch = !searchText || r.name?.toLowerCase().includes(searchText.toLowerCase());
    const matchLevel = levelFilter === 'all' || r.level === levelFilter;
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchRun = runFilter === 'all' ||
      (runFilter === 'running' && r.status === 'ENABLED') ||
      (runFilter === 'stopped' && r.status === 'DISABLED');
    return matchSearch && matchLevel && matchStatus && matchRun;
  });

  const columns: ColumnsType<Rule> = [
    { title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: string) => (
        <Tag icon={s === 'ENABLED' ? <CheckCircleOutlined /> : <StopOutlined />}
          color={s === 'ENABLED' ? 'success' : 'default'}>{s === 'ENABLED' ? '运行中' : '已停止'}</Tag>
      ) },
    { title: '规则名称', dataIndex: 'name', key: 'name', width: 160 },
    { title: '作用级别', dataIndex: 'level', key: 'level', width: 100,
      render: (v: string) => {
        const map: Record<string, string> = { CAMPAIGN: '系列', ADGROUP: '组', AD: '广告' };
        return <Tag>{map[v] || v}</Tag>;
      } },
    { title: '绑定目标', dataIndex: 'binding_count', key: 'binding', width: 90,
      render: (n: number) => <Text>{n || 0} 个</Text> },
    { title: '执行间隔', dataIndex: 'interval_minutes', key: 'interval', width: 90,
      render: (m: number) => m ? `${m} 分钟` : '-' },
    { title: '触发次数', dataIndex: 'trigger_count', key: 'trigger', width: 90,
      render: (n: number) => <Tooltip title="触发次数"><Text>{n || 0}</Text></Tooltip> },
    { title: '触发模式', dataIndex: 'trigger_mode', key: 'mode', width: 100,
      render: (v: string) => <Tag>{v || '自动'}</Tag> },
    { title: '最后运行', dataIndex: 'last_run', key: 'lastRun', width: 140,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text> },
    { title: 'AI 评分', dataIndex: 'ai_score', key: 'aiScore', width: 90,
      render: (v: number) => v ? <Tag color="blue">{v}</Tag> : '-' },
    { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 120,
      render: (v: string) => <Text type="secondary">{v}</Text> },
    { title: '操作', key: 'action', fixed: 'right', width: 120,
      render: (_: any, r: Rule) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} style={{ color: PRIMARY }}>编辑</Button>
          <Popconfirm title="确定删除此规则？" onConfirm={() => message.info('删除: ' + r.name)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* 标题 + 按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}>
            <ControlOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <Text strong style={{ fontSize: 18, color: '#1e293b' }}>智能规则</Text>
            <br />
            <Text style={{ fontSize: 12, color: '#94a3b8' }}>AI Score 驱动的自动化广告优化规则</Text>
          </div>
        </div>
        <Space>
          <Button icon={<RobotOutlined />} onClick={() => message.info('智能生成')}>智能生成</Button>
          <Button icon={<ImportOutlined />}>导入规则</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} style={{ borderRadius: 8 }}>创建规则</Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* 搜索 + 筛选 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="搜索规则名称"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
            style={{ width: 220, borderRadius: 8 }}
          />
          <Select value={levelFilter} onChange={setLevelFilter} style={{ width: 110, borderRadius: 8 }}
            options={[{ label: '全部层级', value: 'all' }, { label: '系列', value: 'CAMPAIGN' }, { label: '组', value: 'ADGROUP' }, { label: '广告', value: 'AD' }]} />
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 110, borderRadius: 8 }}
            options={[{ label: '全部状态', value: 'all' }, { label: '运行中', value: 'ENABLED' }, { label: '已停止', value: 'DISABLED' }]} />
          <Select value={runFilter} onChange={setRunFilter} style={{ width: 110, borderRadius: 8 }}
            options={[{ label: '全部运行', value: 'all' }, { label: '正在执行', value: 'running' }, { label: '已暂停', value: 'stopped' }]} />
          <Select
            value={selectedAccount || undefined}
            onChange={setSelectedAccount}
            style={{ width: 180, borderRadius: 8 }}
            placeholder="选择广告账户"
            options={accounts.map(a => ({ label: a.advertiser_name || a.advertiser_id, value: a.advertiser_id }))}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchRules} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
        </div>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={filteredRules}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 20, showTotal: (t: number) => `共 ${t} 条规则` }}
          locale={{ emptyText: (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <ThunderboltOutlined style={{ fontSize: 40, color: '#94a3b8', marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>暂无规则</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>点击上方按钮创建</div>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} style={{ borderRadius: 8 }}>创建规则</Button>
            </div>
          ) }}
        />
      </Card>

      {/* 创建抽屉（简化版，真实版本要完整实现） */}
      <Drawer title="创建规则" open={createOpen} onClose={() => setCreateOpen(false)} width={640}>
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>
          <ExperimentOutlined style={{ fontSize: 48, marginBottom: 12 }} />
          <div>规则创建向导 - 待实现完整功能</div>
        </div>
      </Drawer>
    </div>
  );
};

export default AdRules;
