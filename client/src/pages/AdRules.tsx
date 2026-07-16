import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Button, Typography, message, Switch, Space, Popconfirm,
  Modal, Form, Input, Select, InputNumber, Row, Col,
} from 'antd';
import {
  ControlOutlined, ReloadOutlined, PlusOutlined, SyncOutlined,
  ThunderboltOutlined, SettingOutlined, CheckCircleOutlined,
  CloseCircleOutlined, DeleteOutlined, EditOutlined, FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api';

const { Text } = Typography;
const { Option } = Select;
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
  notification?: { notification_type: string };
  last_check_result_summary?: { change_success: number; no_change: number; change_fail: number };
  create_datetime?: string; modify_time?: string;
}

// ── 中文字典 ──
const SUBJECT_TYPE_MAP: Record<string, string> = {
  COST: '花费', IMPRESSION: '展现', CLICK: '点击', CONVERSION: '转化',
  CPA: 'CPA', CVR: 'CVR', CTR: 'CTR', CPM: 'CPM', CPC: 'CPC',
  RESULT: '结果', RESULT_RATE: '结果率', COST_PER_RESULT: '单次结果成本',
  DAILY_BUDGET_SPENDING_RATE: '日预算消耗率',
  ROAS_PURCHASE: 'ROAS', NO_CONDITION: '无条件',
};
const MATCH_TYPE_MAP: Record<string, string> = {
  GT: '>', LT: '<', BETWEEN: '~', CONTAINS: '包含', EQUAL: '=',
};
const RANGE_TYPE_MAP: Record<string, string> = {
  TODAY: '今天', YESTERDAY: '昨天', PAST_THREE_DAYS: '近3天',
  PAST_FIVE_DAYS: '近5天', PAST_SEVEN_DAYS: '近7天', LIFETIME: '累计',
};
const EXEC_TYPE_MAP: Record<string, string> = {
  PER_HALF_HOUR: '每30分钟', CUSTOM: '每日定时',
  SPECIFIC_TIME_ACCURATE_ONCE: '一次性',
};
const ACTION_SUBJECT_MAP: Record<string, string> = {
  TURN_ON: '开启', TURN_OFF: '关闭', MESSAGE: '发送通知',
  DAILY_BUDGET: '调整日预算', LIFETIME_BUDGET: '调整总预算', BID: '调整出价',
};
const ACTION_TYPE_MAP: Record<string, string> = {
  INCREASE: '增加', DECREASE: '降低', ADJUST_TO: '调整至',
};

const AdRules: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [advertisers, setAdvertisers] = useState<AdAccount[]>(() => {
    try { const c = localStorage.getItem(ACCOUNTS_KEY); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [selectedAdv, setSelectedAdv] = useState<string>('');
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  // 创建/编辑 Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [form] = Form.useForm();

  const loadAdvertisers = useCallback(async () => {
    try {
      const res = await api.get('/ad-center/advertisers');
      if (res.data?.success) {
        const all = res.data.data || [];
        const enabled = all.filter((a: any) => a.enabled !== false);
        setAdvertisers(enabled);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(enabled));
        if (enabled.length && !selectedAdv) setSelectedAdv(enabled[0].advertiser_id);
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
        setRules(res.data.data?.rules || res.data.data?.list || []);
      }
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
    } finally { setSyncing(false); }
  }, [selectedAdv]);
  useEffect(() => { if (selectedAdv) loadRules(true); }, [selectedAdv, loadRules]);

  // ── 启用/禁用/删除 ──
  const handleToggleStatus = async (ruleId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ON' ? 'OFF' : 'ON';
    try {
      await api.put(`/ad-center/rules/${ruleId}`, {
        advertiser_id: selectedAdv,
        rules: [{ rule_id: ruleId, name: rules.find(r => r.rule_id === ruleId)?.name || '', rule_status: newStatus }],
      });
      setRules(prev => prev.map(r => r.rule_id === ruleId ? { ...r, rule_status: newStatus as 'ON' | 'OFF' } : r));
    } catch (e: any) {
      message.error((e.response?.data?.error || e.message));
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await api.put(`/ad-center/rules/${ruleId}`, {
        advertiser_id: selectedAdv,
        rules: [{ rule_id: ruleId, name: rules.find(r => r.rule_id === ruleId)?.name || '', rule_status: 'DELETED' }],
      });
      setRules(prev => prev.filter(r => r.rule_id !== ruleId));
      message.success('已删除');
    } catch (e: any) {
      message.error((e.response?.data?.error || e.message));
    }
  };

  const handleBatchToggle = async (enabled: boolean) => {
    if (!selectedRowKeys.length) return;
    for (const id of selectedRowKeys) {
      const r = rules.find(x => x.rule_id === id);
      if (!r || (enabled && r.rule_status === 'ON') || (!enabled && r.rule_status === 'OFF')) continue;
      try {
        await api.put(`/ad-center/rules/${id}`, {
          advertiser_id: selectedAdv,
          rules: [{ rule_id: id, name: r.name, rule_status: enabled ? 'ON' : 'OFF' }],
        });
      } catch {}
    }
    setSelectedRowKeys([]);
    loadRules(false);
    message.success(enabled ? '已批量启用' : '已批量禁用');
  };

  // ── 创建/编辑 ──
  const openCreateModal = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      exec_time_type: 'PER_HALF_HOUR',
      notification_type: 'NOT_NOTIFICATION',
      condition_subject: 'COST',
      condition_range: 'TODAY',
      condition_match: 'GT',
      condition_value: '0',
      action_subject: 'MESSAGE',
    });
    setModalOpen(true);
  };

  const openEditModal = (rule: RuleItem) => {
    setEditingRule(rule);
    const cond = rule.conditions[0] || {};
    const act = rule.actions[0] || {};
    form.setFieldsValue({
      name: rule.name,
      exec_time_type: rule.rule_exec_info.exec_time_type,
      exec_time: rule.rule_exec_info.exec_time || '',
      notification_type: rule.notification?.notification_type || 'NOT_NOTIFICATION',
      condition_subject: cond.subject_type || 'COST',
      condition_range: cond.range_type || 'TODAY',
      condition_match: cond.match_type || 'GT',
      condition_value: cond.values ? cond.values[0] : '0',
      action_subject: act.subject_type || 'MESSAGE',
      action_type: act.action_type || undefined,
      action_value: act.value?.value || act.value || undefined,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      const ruleData: any = {
        apply_objects: [{ dimension: 'CAMPAIGN', dimension_ids: [], pre_condition_type: 'ALL_ACTIVE_CAMPAIGN' }],
        conditions: [{
          subject_type: vals.condition_subject,
          range_type: vals.condition_range,
          match_type: vals.condition_match,
          values: [String(vals.condition_value)],
        }],
        actions: [vals.action_subject === 'MESSAGE'
          ? { subject_type: 'MESSAGE' }
          : {
            subject_type: vals.action_subject,
            action_type: vals.action_type,
            value_type: 'EXACT',
            value: { value: vals.action_value },
          }],
        notification: { notification_type: vals.notification_type },
        rule_exec_info: {
          exec_time_type: vals.exec_time_type,
          exec_time: vals.exec_time || '',
        },
        name: vals.name,
      };
      let res;
      if (editingRule) {
        ruleData.rule_id = editingRule.rule_id;
        res = await api.put(`/ad-center/rules/${editingRule.rule_id}`, { advertiser_id: selectedAdv, rules: [ruleData] });
      } else {
        res = await api.post('/ad-center/rules', { advertiser_id: selectedAdv, rules: [ruleData] });
      }
      if (res.data?.success) {
        message.success(editingRule ? '已更新' : '已创建');
        setModalOpen(false);
        loadRules(false);
      }
    } catch (e: any) {
      if (e.errorFields) return; // 表单验证失败
      message.error((e.response?.data?.error || e.message));
    }
  };

  // ── 统计 ──
  const stat = {
    total: rules.length,
    on: rules.filter(r => r.rule_status === 'ON').length,
    off: rules.filter(r => r.rule_status === 'OFF').length,
  };

  // ── 表格列 ──
  const columns: ColumnsType<RuleItem> = [
    { title: '状态', dataIndex: 'rule_status', key: 'status', width: 70, fixed: 'left' as const,
      render: (s: string, r) => (
        <Popconfirm title={`确认${s === 'ON' ? '禁用' : '启用'}?`} onConfirm={() => handleToggleStatus(r.rule_id, s)}>
          <Switch checked={s === 'ON'} size="small" />
        </Popconfirm>
      ) },
    { title: '规则名称', dataIndex: 'name', key: 'name', width: 220, fixed: 'left' as const,
      render: (n: string) => <Text strong style={{ fontSize: 13 }}>{n}</Text> },
    { title: '条件', key: 'conditions', width: 230,
      render: (_: any, r) => {
        const c = r.conditions[0];
        if (!c) return '-';
        return <Space size={4}>
          <Tag color="blue">{SUBJECT_TYPE_MAP[c.subject_type] || c.subject_type}</Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>{RANGE_TYPE_MAP[c.range_type] || c.range_type}</Text>
          <Text style={{ fontSize: 12 }}>{MATCH_TYPE_MAP[c.match_type] || c.match_type}</Text>
          <Text strong style={{ fontSize: 12 }}>{c.values?.join(',')}</Text>
        </Space>;
      } },
    { title: '动作', key: 'actions', width: 130,
      render: (_: any, r) => {
        const a = r.actions[0];
        if (!a) return '-';
        let label = ACTION_SUBJECT_MAP[a.subject_type] || a.subject_type;
        if (a.action_type && a.value) {
          label += ` ${ACTION_TYPE_MAP[a.action_type] || a.action_type} ${a.value?.value || a.value}`;
        }
        return <Text style={{ fontSize: 12 }}>{label}</Text>;
      } },
    { title: '执行频率', key: 'exec', width: 110,
      render: (_: any, r) => {
        const e = r.rule_exec_info;
        const label = EXEC_TYPE_MAP[e.exec_time_type] || e.exec_time_type;
        return <Text type="secondary" style={{ fontSize: 12 }}>
          {e.exec_time_type === 'CUSTOM' ? `每日 ${e.exec_time || ''}` : label}
        </Text>;
      } },
    { title: '最后运行', key: 'last_check', width: 140,
      render: (_: any, r) => {
        const c = r.last_check_result_summary;
        if (!c) return <Text type="secondary">-</Text>;
        return <Space size={4}>
          <Tag color="success" style={{ margin: 0 }}>{c.change_success || 0}✓</Tag>
          <Tag color="warning" style={{ margin: 0 }}>{c.no_change || 0}-</Tag>
          <Tag color="error" style={{ margin: 0 }}>{c.change_fail || 0}✗</Tag>
        </Space>;
      } },
    { title: '创建时间', dataIndex: 'create_datetime', key: 'create_time', width: 150,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v || '-'}</Text> },
    { title: '操作', key: 'action', width: 130, fixed: 'right' as const,
      render: (_: any, r) => (
        <Space size={2}>
          <Button type="link" size="small" icon={<EditOutlined />} style={{ color: PRIMARY, padding: 0 }}
            onClick={() => openEditModal(r)} />
          <Button type="link" size="small" icon={<FileTextOutlined />} style={{ padding: 0 }} />
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(r.rule_id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />} style={{ padding: 0 }} />
          </Popconfirm>
        </Space>
      ) },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}>
          <ControlOutlined style={{ color: '#fff', fontSize: 18 }} />
        </div>
        <div>
          <Text strong style={{ fontSize: 18, color: '#1e293b', display: 'block', lineHeight: 1.2 }}>智能规则</Text>
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>自动化投放规则 · 条件触发 · 7×24 执行</Text>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: '总规则数', value: stat.total, color: '#3b82f6', bg: '#eff6ff', icon: <ControlOutlined /> },
          { label: '运行中', value: stat.on, color: '#059669', bg: '#ecfdf5', icon: <CheckCircleOutlined /> },
          { label: '已暂停', value: stat.off, color: '#d97706', bg: '#fffbeb', icon: <CloseCircleOutlined /> },
        ].map(k => (
          <Card key={k.label} style={{ borderRadius: 12, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            bodyStyle={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, color: k.color, fontSize: 15 }}>
                {k.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{k.value}</div>
              </div>
            </div>
          </Card>
        ))}
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
          <Space size={8}>
            {selectedRowKeys.length > 0 && (
              <>
                <Button size="small" type="primary" style={{ borderRadius: 6 }}
                  onClick={() => handleBatchToggle(true)}>批量启用</Button>
                <Button size="small" type="default" style={{ borderRadius: 6, color: '#dc2626', borderColor: '#fecaca' }}
                  onClick={() => handleBatchToggle(false)}>批量禁用</Button>
              </>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} style={{ borderRadius: 8 }}>新建规则</Button>
            <Button icon={<ReloadOutlined spin={syncing} />} onClick={() => loadRules(false)} style={{ borderRadius: 8 }}>刷新</Button>
          </Space>
          {syncing && <Text type="secondary" style={{ fontSize: 12 }}><SyncOutlined spin /> 同步中…</Text>}
        </div>
      </Card>

      {/* 规则列表 */}
      <Card style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>规则列表</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>共 {rules.length} 条</Text>
        </div>
        <Table
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]) }}
          columns={columns} dataSource={rules} rowKey="rule_id" size="middle"
          loading={syncing && rules.length === 0}
          scroll={{ x: 1200 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: selectedAdv ? '暂无规则' : '请先选择广告账户' }} />
      </Card>

      {/* 创建/编辑 Modal */}
      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave}
        width={560} destroyOnClose
        bodyStyle={{ maxHeight: '60vh', overflow: 'auto' }}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="如：花费超过预算自动暂停" style={{ borderRadius: 6 }} />
          </Form.Item>
          <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 8 }}>触发条件</Text>
          <Row gutter={8}>
            <Col span={8}>
              <Form.Item name="condition_subject" label="指标">
                <Select placeholder="选择指标" style={{ borderRadius: 6 }}>
                  {Object.entries(SUBJECT_TYPE_MAP).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="condition_range" label="时间范围">
                <Select placeholder="选择范围" style={{ borderRadius: 6 }}>
                  {Object.entries(RANGE_TYPE_MAP).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="condition_match" label="操作符">
                <Select placeholder="选择操作符" style={{ borderRadius: 6 }}>
                  {Object.entries(MATCH_TYPE_MAP).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="condition_value" label="阈值">
            <InputNumber style={{ width: '100%', borderRadius: 6 }} placeholder="触发条件的值" />
          </Form.Item>
          <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 8, marginTop: 12 }}>执行动作</Text>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="action_subject" label="动作类型">
                <Select placeholder="选择动作" style={{ borderRadius: 6 }}>
                  {Object.entries(ACTION_SUBJECT_MAP).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.action_subject !== cur.action_subject}>
                {({ getFieldValue }) => {
                  const actionSub = getFieldValue('action_subject');
                  if (!actionSub || actionSub === 'TURN_ON' || actionSub === 'TURN_OFF' || actionSub === 'MESSAGE') return null;
                  return (
                    <Form.Item name="action_type" label="操作方式">
                      <Select placeholder="选择方式" style={{ borderRadius: 6 }}>
                        <Option value="INCREASE">增加</Option>
                        <Option value="DECREASE">降低</Option>
                        <Option value="ADJUST_TO">调整至</Option>
                      </Select>
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.action_subject !== cur.action_subject}>
            {({ getFieldValue }) => {
              const as = getFieldValue('action_subject');
              if (!as || as === 'TURN_ON' || as === 'TURN_OFF' || as === 'MESSAGE') return null;
              return (
                <Form.Item name="action_value" label="预算/值">
                  <InputNumber style={{ width: '100%', borderRadius: 6 }} placeholder="输入预算值" />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block', marginBottom: 8, marginTop: 12 }}>执行计划</Text>
          <Row gutter={8}>
            <Col span={14}>
              <Form.Item name="exec_time_type" label="执行频率">
                <Select placeholder="选择频率" style={{ borderRadius: 6 }}>
                  {Object.entries(EXEC_TYPE_MAP).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.exec_time_type !== cur.exec_time_type}>
                {({ getFieldValue }) => {
                  if (getFieldValue('exec_time_type') === 'CUSTOM') {
                    return <Form.Item name="exec_time" label="执行时间"><Input placeholder="12:00" style={{ borderRadius: 6 }} /></Form.Item>;
                  }
                  return null;
                }}
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notification_type" label="通知设置">
            <Select style={{ borderRadius: 6 }}>
              <Option value="NOT_NOTIFICATION">不通知</Option>
              <Option value="ANY_CHANGES">有任何变化时通知</Option>
              <Option value="TASK_FINISH">任务完成时通知</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdRules;
