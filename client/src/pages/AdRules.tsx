import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Typography, message, Switch, Space, Popconfirm } from 'antd';
import {
  ControlOutlined, ReloadOutlined, DeleteOutlined, EyeOutlined,
  PlusOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api';

const { Text, Title } = Typography;
const PRIMARY = '#2563eb';

const ACCOUNTS_KEY = 'ad_rules_accounts_v1';

interface AdAccount { advertiser_id: string; advertiser_name: string; enabled?: boolean; }
interface RuleItem {
  rule_id: string;
  name: string;
  rule_status: 'ON' | 'OFF' | 'DELETED';
  conditions: Array<{ subject_type: string; range_type: string; match_type: string; values: string[] }>;
  actions: Array<{ subject_type: string; action_type?: string; value_type?: string; value?: any }>;
  apply_objects: Array<{ dimension: string; dimension_ids: string[]; pre_condition_type: string }>;
  rule_exec_info: { exec_time_type: string; exec_time?: string };
  last_check_result_summary?: { change_success: number; no_change: number; change_fail: number };
  create_datetime?: string;
}

const AdRules: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [advertisers, setAdvertisers] = useState<AdAccount[]>(() => {
    try { const c = localStorage.getItem(ACCOUNTS_KEY); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [selectedAdv, setSelectedAdv] = useState<string>('');
  const [rules, setRules] = useState<RuleItem[]>([]);

  const loadAdvertisers = useCallback(async () => {
    try {
      const res = await api.get('/ad-center/advertisers');
      if (res.data?.success) {
        const all = res.data.data || [];
        const enabledList = all.filter((a: any) => a.enabled !== false);
        setAdvertisers(enabledList);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(enabledList));
        if (enabledList.length && !selectedAdv) setSelectedAdv(enabledList[0].advertiser_id);
      }
    } catch {}
  }, [selectedAdv]);
  useEffect(() => { loadAdvertisers(); }, [loadAdvertisers]);

  const loadRules = useCallback(async (silent = true) => {
    if (!selectedAdv) return;
    if (silent) setSyncing(true);
    try {
      const res = await api.get('/ad-center/rules', {
        params: { advertiser_id: selectedAdv, page_size: 200 },
      });
      if (res.data?.success) {
        const list = res.data.data?.rules || res.data.data?.list || [];
        setRules(list);
      }
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
    } finally { setSyncing(false); }
  }, [selectedAdv]);
  useEffect(() => { if (selectedAdv) loadRules(true); }, [selectedAdv, loadRules]);

  // ── 启用/禁用/删除 ──
  const handleToggleStatus = async (ruleId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ON' ? 'OFF' : 'ON';
    const operateType = newStatus === 'ON' ? 'TURN_ON' : 'TURN_OFF';
    try {
      // 调 update 接口传 rule_status
      const res = await api.put(`/ad-center/rules/${ruleId}`, {
        advertiser_id: selectedAdv,
        rules: [{ rule_id: ruleId, name: rules.find(r => r.rule_id === ruleId)?.name || '', rule_status: newStatus }],
      });
      if (res.data?.success) {
        setRules(prev => prev.map(r => r.rule_id === ruleId ? { ...r, rule_status: newStatus as 'ON' | 'OFF' } : r));
        message.success(newStatus === 'ON' ? '已启用' : '已禁用');
      }
    } catch (e: any) {
      message.error('操作失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      const res = await api.put(`/ad-center/rules/${ruleId}`, {
        advertiser_id: selectedAdv,
        rules: [{ rule_id: ruleId, name: rules.find(r => r.rule_id === ruleId)?.name || '', rule_status: 'DELETED' }],
      });
      if (res.data?.success) {
        setRules(prev => prev.filter(r => r.rule_id !== ruleId));
        message.success('已删除');
      }
    } catch (e: any) {
      message.error('删除失败: ' + (e.response?.data?.error || e.message));
    }
  };

  // ── 工具函数 ──
  const subjectTypeLabel = (s: string) => {
    const map: Record<string, string> = { COST: '花费', IMPRESSION: '展现', CLICK: '点击', CONVERSION: '转化', CPA: 'CPA', CVR: 'CVR', CTR: 'CTR', ROAS_PURCHASE: 'ROAS', DAILY_BUDGET_SPENDING_RATE: '消耗率', RESULT: '结果', NO_CONDITION: '无条件' };
    return map[s] || s;
  };
  const matchTypeSymbol = (m: string) => ({ GT: '>', LT: '<', BETWEEN: '~', CONTAINS: '包含' } as Record<string, string>)[m] || m;
  const rangeTypeLabel = (r: string) => ({ TODAY: '今天', YESTERDAY: '昨天', PAST_THREE_DAYS: '近3天', PAST_SEVEN_DAYS: '近7天', LIFETIME: '累计' } as Record<string, string>)[r] || r;
  const execTimeLabel = (info: { exec_time_type: string; exec_time?: string }) => {
    if (info.exec_time_type === 'PER_HALF_HOUR') return '每30分';
    if (info.exec_time_type === 'CUSTOM') return `每日 ${info.exec_time || ''}`;
    return info.exec_time_type;
  };
  const actionLabel = (a: { subject_type: string; action_type?: string; value?: any }) => {
    const map: Record<string, string> = { TURN_ON: '开启', TURN_OFF: '关闭', MESSAGE: '发送通知', DAILY_BUDGET: '调整日预算', BID: '调整出价' };
    const actMap: Record<string, string> = { INCREASE: '增加', DECREASE: '降低', ADJUST_TO: '调整至' };
    let label = map[a.subject_type] || a.subject_type;
    if (a.action_type && a.value) label += `(${actMap[a.action_type] || a.action_type} ${a.value?.value || a.value})`;
    return label;
  };

  // ── 表格列 ──
  const columns: ColumnsType<RuleItem> = [
    { title: '状态', dataIndex: 'rule_status', key: 'status', width: 70, fixed: 'left' as const,
      render: (s: string, r) => (
        <Popconfirm title={`确认${s === 'ON' ? '禁用' : '启用'}此规则?`} onConfirm={() => handleToggleStatus(r.rule_id, s)}>
          <Switch checked={s === 'ON'} size="small" checkedChildren="开" unCheckedChildren="关" />
        </Popconfirm>
      ) },
    { title: '规则名称', dataIndex: 'name', key: 'name', width: 220, fixed: 'left' as const,
      render: (n: string) => <Text strong style={{ fontSize: 13 }}>{n}</Text> },
    { title: '条件', key: 'conditions', width: 260,
      render: (_: any, r) => {
        const cond = r.conditions[0];
        if (!cond) return <Text type="secondary">-</Text>;
        return (
          <Space size={4}>
            <Tag color="blue">{subjectTypeLabel(cond.subject_type)}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>{rangeTypeLabel(cond.range_type)}</Text>
            <Text style={{ fontSize: 12 }}>{matchTypeSymbol(cond.match_type)}</Text>
            <Text strong style={{ fontSize: 12 }}>{cond.values?.join(',')}</Text>
          </Space>
        );
      } },
    { title: '动作', key: 'actions', width: 150,
      render: (_: any, r) => {
        const acts = r.actions.slice(0, 2).map(a => actionLabel(a)).join('、');
        return <Text style={{ fontSize: 12 }}>{acts || '-'}</Text>;
      } },
    { title: '执行频率', key: 'exec', width: 100,
      render: (_: any, r) => <Text type="secondary" style={{ fontSize: 12 }}>{execTimeLabel(r.rule_exec_info)}</Text> },
    { title: '最后运行', key: 'last_check', width: 150,
      render: (_: any, r) => {
        const c = r.last_check_result_summary;
        if (!c) return <Text type="secondary">-</Text>;
        return (
          <Space size={6}>
            <Tag color="success" style={{ margin: 0, fontSize: 11 }}>{c.change_success || 0}</Tag>
            <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>{c.no_change || 0}</Tag>
            <Tag color="error" style={{ margin: 0, fontSize: 11 }}>{c.change_fail || 0}</Tag>
          </Space>
        );
      } },
    { title: '创建时间', dataIndex: 'create_datetime', key: 'create_time', width: 150,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v || '-'}</Text> },
    { title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: (_: any, r) => (
        <Space size={4}>
          <Button type="link" size="small" style={{ color: PRIMARY, padding: 0 }}>详情</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(r.rule_id)}>
            <Button type="link" danger size="small" style={{ padding: 0 }}>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}>
          <ControlOutlined style={{ color: '#fff', fontSize: 18 }} />
        </div>
        <div>
          <Text strong style={{ fontSize: 18, color: '#1e293b', display: 'block', lineHeight: 1.2 }}>智能规则</Text>
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>自动规则 · 7×24 优化投放 · 条件触发自动执行</Text>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}
        bodyStyle={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select value={selectedAdv} onChange={e => setSelectedAdv(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', background: '#fff', minWidth: 200 }}>
            <option value="">选择广告账户</option>
            {advertisers.map(a => <option key={a.advertiser_id} value={a.advertiser_id}>{a.advertiser_name || a.advertiser_id}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <Button type="primary" icon={<PlusOutlined />} disabled style={{ borderRadius: 8 }}>新建规则</Button>
          <Button icon={<ReloadOutlined spin={syncing} />} onClick={() => loadRules(false)} style={{ borderRadius: 8 }}>刷新</Button>
          {syncing && <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}><SyncOutlined spin /> 同步中…</Text>}
        </div>
      </Card>

      {/* 规则列表 */}
      <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>规则列表</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>共 {rules.length} 条规则</Text>
        </div>
        <Table columns={columns} dataSource={rules} rowKey="rule_id" size="middle"
          loading={syncing && rules.length === 0}
          scroll={{ x: 1250 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: selectedAdv ? '暂无规则数据' : '请先选择广告账户' }} />
      </Card>
    </div>
  );
};

export default AdRules;
