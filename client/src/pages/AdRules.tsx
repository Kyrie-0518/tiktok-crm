import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Button, Space, Select, Typography, message, Spin, Drawer, Descriptions,
  Input, Switch, Modal, Divider, Collapse, InputNumber, Tabs, Tooltip, Popconfirm, Result,
} from 'antd';
import {
  ControlOutlined, ReloadOutlined, PlusOutlined, ThunderboltOutlined, SearchOutlined,
  EditOutlined, DeleteOutlined, HistoryOutlined, ArrowLeftOutlined, ExperimentOutlined,
  ApiOutlined, PoweroffOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api';

const { Text, Title } = Typography;
const { Panel } = Collapse;
const PRIMARY = '#2563eb';
const TABS_BG = '#fafafa';

/* ── Types ── */

interface RuleCondition {
  subject_type: string;
  calculation_type: string;
  range_type: string;
  values: string[];
}

interface RuleAction {
  subject_type: string;
  action_type: string;
  value: number;
  value_type: string;
  frequency_type: string;
  frequency_count: number;
}

interface RuleApplyObject {
  dimension: string;
  pre_condition_type: string;
  dimension_ids: string[];
  id_input: string;
}

interface RuleTimePeriod {
  date_type: string;
  start_time: string;
  end_time: string;
  num: number[];
}

interface RuleExecInfo {
  exec_time_type: string;
  time_period_info: RuleTimePeriod[];
}

interface OptimizerRule {
  rule_id: string;
  rule_name: string;
  status: string;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  apply_objects?: RuleApplyObject[];
  rule_exec_info?: RuleExecInfo;
  create_time: string;
}

interface AdvertiserInfo {
  advertiser_id: string;
  advertiser_name: string;
}

/* ── 枚举字典 ── */

const CONDITION_METRICS: Record<string, string> = {
  COST: '花费',
  IMPRESSIONS: '展示量',
  CLICKS: '点击量',
  CTR: '点击率',
  CVR: '转化率',
  CONVERSIONS: '转化数',
  CPA: '单次转化成本',
  ROAS: 'ROAS',
  VIDEO_VIEW_2S: '2秒视频播放',
};

const CALC_TYPES: Record<string, string> = {
  LARGER_THAN: '大于',
  SMALLER_THAN: '小于',
  EQUAL: '等于',
  BETWEEN: '区间',
  INCREASE: '上升',
  DECREASE: '下降',
};

const RANGE_TYPES: Record<string, string> = {
  ABS: '绝对值',
  PCT: '百分比',
};

const ACTION_SUBJECTS: Record<string, string> = {
  AD_STATUS: '广告状态',
  ADGROUP_STATUS: '广告组状态',
  CAMPAIGN_STATUS: '系列状态',
  BUDGET: '预算',
  BID: '出价',
};

const ACTION_TYPES: Record<string, string> = {
  SET: '设为',
  INCREASE: '增加',
  DECREASE: '减少',
  ENABLE: '启用',
  DISABLE: '停用',
};

const DIMENSIONS: Record<string, string> = {
  CAMPAIGN: '广告系列',
  ADGROUP: '广告组',
  AD: '广告',
};

const EXEC_TIME_TYPES: Record<string, string> = {
  ALWAYS: '持续监控',
  DAILY: '每日检查',
  CUSTOM: '自定义时段',
};

const DATE_TYPES: Record<string, string> = {
  EVERYDAY: '每天',
  WEEKDAY: '每周',
};

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/* ── 预制模板 ── */

const PRESET_TEMPLATES = [
  {
    id: 'cost-saver',
    name: '降本增效',
    icon: '📉',
    desc: '花费过高时自动降低出价',
    fill: (): Partial<RuleFormData> => ({
      name: '降本增效-自动降价',
      conditions: [{ subject_type: 'COST', calculation_type: 'LARGER_THAN', range_type: 'ABS', values: ['50'] }],
      actions: [{ subject_type: 'BID', action_type: 'DECREASE', value: 20, value_type: 'PCT', frequency_type: 'DAILY', frequency_count: 1 }],
      apply_objects: [{ dimension: 'CAMPAIGN', pre_condition_type: 'ALL', dimension_ids: [], id_input: '' }],
      rule_exec_info: { exec_time_type: 'ALWAYS', time_period_info: [] },
    }),
  },
  {
    id: 'budget-guard',
    name: '预算守门',
    icon: '🛡️',
    desc: '日预算消耗达80%时启用',
    fill: (): Partial<RuleFormData> => ({
      name: '预算守门-自动启用',
      conditions: [{ subject_type: 'COST', calculation_type: 'LARGER_THAN', range_type: 'PCT', values: ['80'] }],
      actions: [{ subject_type: 'CAMPAIGN_STATUS', action_type: 'ENABLE', value: 0, value_type: 'ABS', frequency_type: 'DAILY', frequency_count: 1 }],
      apply_objects: [{ dimension: 'CAMPAIGN', pre_condition_type: 'ALL', dimension_ids: [], id_input: '' }],
      rule_exec_info: { exec_time_type: 'DAILY', time_period_info: [] },
    }),
  },
  {
    id: 'low-perf-stop',
    name: '低效关停',
    icon: '🔻',
    desc: 'CPA过高时自动暂停',
    fill: (): Partial<RuleFormData> => ({
      name: '低效关停-自动暂停',
      conditions: [{ subject_type: 'CPA', calculation_type: 'LARGER_THAN', range_type: 'ABS', values: ['100'] }],
      actions: [{ subject_type: 'AD_STATUS', action_type: 'DISABLE', value: 0, value_type: 'ABS', frequency_type: 'DAILY', frequency_count: 1 }],
      apply_objects: [{ dimension: 'AD', pre_condition_type: 'ALL', dimension_ids: [], id_input: '' }],
      rule_exec_info: { exec_time_type: 'ALWAYS', time_period_info: [] },
    }),
  },
  {
    id: 'roas-boost',
    name: '转化加速',
    icon: '🚀',
    desc: 'ROAS>3时提升预算15%',
    fill: (): Partial<RuleFormData> => ({
      name: '转化加速-提升预算',
      conditions: [{ subject_type: 'ROAS', calculation_type: 'LARGER_THAN', range_type: 'ABS', values: ['3'] }],
      actions: [{ subject_type: 'BUDGET', action_type: 'INCREASE', value: 15, value_type: 'PCT', frequency_type: 'DAILY', frequency_count: 1 }],
      apply_objects: [{ dimension: 'CAMPAIGN', pre_condition_type: 'ALL', dimension_ids: [], id_input: '' }],
      rule_exec_info: { exec_time_type: 'ALWAYS', time_period_info: [] },
    }),
  },
];

/* ── 表单数据 ── */

interface RuleFormData {
  name: string;
  tzone: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  apply_objects: RuleApplyObject[];
  rule_exec_info: RuleExecInfo;
}

const emptyForm = (): RuleFormData => ({
  name: '',
  tzone: 'Asia/Shanghai',
  conditions: [{ subject_type: 'COST', calculation_type: 'LARGER_THAN', range_type: 'ABS', values: [''] }],
  actions: [{ subject_type: 'BID', action_type: 'DECREASE', value: 10, value_type: 'PCT', frequency_type: 'DAILY', frequency_count: 1 }],
  apply_objects: [{ dimension: 'CAMPAIGN', pre_condition_type: 'ALL', dimension_ids: [], id_input: '' }],
  rule_exec_info: { exec_time_type: 'ALWAYS', time_period_info: [] },
});

/* ── 规则结果类型 ── */

interface RuleResult {
  rule_result_id?: string;
  rule_id?: string;
  action?: string;
  status?: string;
  message?: string;
  create_time?: string;
  before_value?: any;
  after_value?: any;
}

/* ── 时间格式化助手 ── */

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

/* ── Token 过期检测助手 ── */

function isTokenExpiredError(res: any): boolean {
  return res?.data?.error === 'token_expired';
}

function showTokenExpiredModal() {
  Modal.confirm({
    title: 'TikTok Ads 授权已过期',
    content: '当前 TikTok Ads access_token 已失效，无法加载数据。请前往 [广告账户] 页面重新授权。',
    okText: '前往授权',
    cancelText: '稍后',
    onOk: () => { window.location.href = '/ad-accounts'; },
  });
}

/* ══════════════════════════════════════ */

const AdRules: React.FC = () => {
  /* ── state ── */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [advertisers, setAdvertisers] = useState<AdvertiserInfo[]>([]);
  const [selectedAdv, setSelectedAdv] = useState('');
  const [rules, setRules] = useState<OptimizerRule[]>([]);
  const [keyword, setKeyword] = useState('');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);

  // 创建/编辑抽屉
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormData>(emptyForm());
  const [activeTab, setActiveTab] = useState('conditions');

  // 详情抽屉
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRule, setDetailRule] = useState<OptimizerRule | null>(null);

  // 执行结果抽屉
  const [resultsOpen, setResultsOpen] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [results, setResults] = useState<RuleResult[]>([]);
  const [resultsRuleName, setResultsRuleName] = useState('');

  /* ── 数据加载 ── */

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

  const loadRules = useCallback(async (force = false) => {
    if (!selectedAdv) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get('/ad-center/rules', {
        params: { advertiser_id: selectedAdv, force_refresh: force ? 1 : 0 },
      });
      if (res.data?.success) {
        const rawList = res.data.data?.list || [];
        const list: OptimizerRule[] = rawList.map((r: any) => ({
          rule_id: r.rule_id || r.id,
          rule_name: r.rule_name || r.name || '未命名规则',
          status: r.status || r.rule_status || 'DISABLED',
          conditions: r.conditions,
          actions: r.actions,
          apply_objects: r.apply_objects,
          rule_exec_info: r.rule_exec_info,
          create_time: r.create_time || '-',
        }));
        setRules(list);
        setLastUpdated(res.data.last_updated || null);
        setIsCached(!!res.data.cached);
      } else {
        if (isTokenExpiredError(res)) {
          showTokenExpiredModal();
        } else {
          message.error('加载失败: ' + (res.data?.error || '未知错误'));
        }
      }
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
    } finally { setLoading(false); }
  }, [selectedAdv]);

  useEffect(() => { loadAdvertisers(); }, [loadAdvertisers]);
  useEffect(() => { loadRules(); }, [loadRules]);

  /* ── 创建 / 编辑 ── */

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setActiveTab('conditions');
    setFormOpen(true);
  };

  const openEdit = (rule: OptimizerRule) => {
    setEditingId(rule.rule_id);
    const c = (rule.conditions || []).map(cond => ({
      subject_type: cond.subject_type || 'COST',
      calculation_type: cond.calculation_type || 'LARGER_THAN',
      range_type: cond.range_type || 'ABS',
      values: Array.isArray(cond.values) ? cond.values : [String(cond.values || '')],
    }));
    const a = (rule.actions || []).map(act => ({
      subject_type: act.subject_type || 'BID',
      action_type: act.action_type || 'DECREASE',
      value: typeof act.value === 'number' ? act.value : 0,
      value_type: act.value_type || 'PCT',
      frequency_type: (act as any).frequency_type || 'DAILY',
      frequency_count: (act as any).frequency_count || 1,
    }));
    const ao = (rule.apply_objects || []).map(obj => ({
      dimension: obj.dimension || 'CAMPAIGN',
      pre_condition_type: obj.pre_condition_type || 'ALL',
      dimension_ids: obj.dimension_ids || [],
      id_input: (obj.dimension_ids || []).join(','),
    }));
    setForm({
      name: rule.rule_name,
      tzone: 'Asia/Shanghai',
      conditions: c.length ? c : emptyForm().conditions,
      actions: a.length ? a : emptyForm().actions,
      apply_objects: ao.length ? ao : emptyForm().apply_objects,
      rule_exec_info: rule.rule_exec_info || emptyForm().rule_exec_info,
    });
    setActiveTab('conditions');
    setFormOpen(true);
  };

  const applyTemplate = (tid: string) => {
    const tmpl = PRESET_TEMPLATES.find(t => t.id === tid);
    if (!tmpl) return;
    setForm(prev => ({ ...prev, ...tmpl.fill() }));
    message.success(`已应用「${tmpl.name}」模板`);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { message.warning('请输入规则名称'); return; }
    if (!form.conditions.length) { message.warning('请至少设置一个触发条件'); return; }
    if (!form.actions.length) { message.warning('请至少设置一个执行动作'); return; }
    setSaving(true);
    try {
      // 处理 apply_objects 的 dimension_ids
      const applyObjects = form.apply_objects.map(obj => ({
        dimension: obj.dimension,
        pre_condition_type: obj.pre_condition_type,
        dimension_ids: obj.pre_condition_type === 'ALL' ? [] : (obj.id_input ? obj.id_input.split(',').map(s => s.trim()).filter(Boolean) : []),
      }));
      // 处理 conditions 的 values
      const conditions = form.conditions.map(c => ({
        subject_type: c.subject_type,
        calculation_type: c.calculation_type,
        range_type: c.range_type,
        values: c.values.filter(v => v !== ''),
      }));
      // 处理 actions
      const actions = form.actions.map(a => ({
        subject_type: a.subject_type,
        action_type: a.action_type,
        value: { value: a.value },
        value_type: a.value_type,
        frequency_info: a.action_type === 'DISABLE' || a.action_type === 'ENABLE' ? undefined : { type: a.frequency_type, count: a.frequency_count },
      }));

      const payload = {
        advertiser_id: selectedAdv,
        name: form.name.trim(),
        conditions,
        actions,
        apply_objects: applyObjects,
        rule_exec_info: form.rule_exec_info,
        notification: { notification_type: 'NONE' },
        tzone: form.tzone,
      };

      if (editingId) {
        const res = await api.put(`/ad-center/rules/${editingId}`, payload);
        if (res.data?.success) {
          message.success('规则已更新');
          setFormOpen(false);
          loadRules();
        } else {
          message.error(res.data?.error || '更新失败');
        }
      } else {
        const res = await api.post('/ad-center/rules', payload);
        if (res.data?.success) {
          message.success('规则已创建');
          setFormOpen(false);
          loadRules();
        } else {
          message.error(res.data?.error || '创建失败');
        }
      }
    } catch (e: any) {
      message.error('保存失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  /* ── 操作按钮 ── */

  const handleToggle = async (ruleId: string, currentStatus: string) => {
    const isActive = currentStatus === 'ACTIVE' || currentStatus === 'ENABLED';
    const apiRuleStatus = isActive ? 'DISABLED' : 'ACTIVE';
    const uiStatus = isActive ? 'DISABLED' : 'ACTIVE';
    try {
      const rule = rules.find(r => r.rule_id === ruleId);
      const payload = {
        advertiser_id: selectedAdv,
        name: rule?.rule_name || 'Rule',
        rule_status: apiRuleStatus,
        conditions: (rule?.conditions || []).map((c: any) => ({
          subject_type: c.subject_type || 'COST',
          calculation_type: c.calculation_type || 'LARGER_THAN',
          range_type: c.range_type || 'ABS',
          values: Array.isArray(c.values) ? c.values : [String(c.values || '')],
        })),
        actions: (rule?.actions || []).map((a: any) => ({
          subject_type: a.subject_type || 'BID',
          action_type: a.action_type || 'DECREASE',
          value: typeof a.value === 'number' ? { value: a.value } : (a.value || { value: 0 }),
          value_type: a.value_type || 'PCT',
        })),
        apply_objects: (rule?.apply_objects || [{ dimension: 'CAMPAIGN', pre_condition_type: 'ALL' }]),
        rule_exec_info: rule?.rule_exec_info || { exec_time_type: 'ALWAYS' },
        notification: { notification_type: 'NONE' },
        tzone: 'Asia/Shanghai',
      };
      const res = await api.put(`/ad-center/rules/${ruleId}`, payload);
      if (res.data?.success) {
        message.success(uiStatus === 'ACTIVE' ? '规则已启用' : '规则已停用');
        setRules(prev => prev.map(r => r.rule_id === ruleId ? { ...r, status: uiStatus } : r));
        loadRules();
      } else {
        message.error(res.data?.error || '操作失败');
      }
    } catch (e: any) {
      message.error('操作失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      const rule = rules.find(r => r.rule_id === ruleId);
      const payload = {
        advertiser_id: selectedAdv,
        name: rule?.rule_name || 'Rule',
        rule_status: 'DISABLED',
        conditions: (rule?.conditions || []).map((c: any) => ({
          subject_type: c.subject_type || 'COST',
          calculation_type: c.calculation_type || 'LARGER_THAN',
          range_type: c.range_type || 'ABS',
          values: Array.isArray(c.values) ? c.values : [String(c.values || '')],
        })),
        actions: (rule?.actions || []).map((a: any) => ({
          subject_type: a.subject_type || 'BID',
          action_type: a.action_type || 'DECREASE',
          value: typeof a.value === 'number' ? { value: a.value } : (a.value || { value: 0 }),
          value_type: a.value_type || 'PCT',
        })),
        apply_objects: rule?.apply_objects || [{ dimension: 'CAMPAIGN', pre_condition_type: 'ALL' }],
        rule_exec_info: rule?.rule_exec_info || { exec_time_type: 'ALWAYS' },
        notification: { notification_type: 'NONE' },
        tzone: 'Asia/Shanghai',
      };
      await api.put(`/ad-center/rules/${ruleId}`, payload);
      message.success('规则已停用');
      loadRules();
    } catch (e: any) {
      message.error('停用失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const showDetail = async (rule: OptimizerRule) => {
    setDetailRule(rule);
    setDetailOpen(true);
  };

  const showResults = async (rule: OptimizerRule) => {
    setResultsRuleName(rule.rule_name);
    setResults([]);
    setResultsOpen(true);
    setResultsLoading(true);
    try {
      const res = await api.get(`/ad-center/rules/${rule.rule_id}/results`, {
        params: { advertiser_id: selectedAdv },
      });
      if (res.data?.success) {
        const list = (res.data.data?.list || []).map((r: any) => ({
          rule_result_id: r.rule_result_id || r.id || '-',
          rule_id: r.rule_id || rule.rule_id,
          action: r.action || r.event_type || '-',
          status: r.status || r.result || '-',
          message: r.message || r.description || '-',
          create_time: r.create_time || r.time || '-',
          before_value: r.before_value,
          after_value: r.after_value,
        }));
        setResults(list);
      }
    } catch (e: any) {
      message.error('加载执行结果失败');
    } finally {
      setResultsLoading(false);
    }
  };

  /* ── 筛选 ── */

  const filtered = rules.filter(r =>
    keyword ? r.rule_name.toLowerCase().includes(keyword.toLowerCase()) || r.rule_id.includes(keyword) : true
  );
  const activeCount = rules.filter(r => r.status === 'ACTIVE' || r.status === 'ENABLED').length;
  const disabledCount = rules.filter(r => r.status === 'DISABLED' || r.status === 'PAUSED').length;

  /* ── 表格列 ── */

  const formatCondition = (conds?: RuleCondition[]) => {
    if (!conds?.length) return '-';
    return conds.map(c => {
      const metric = CONDITION_METRICS[c.subject_type] || c.subject_type;
      const calc = CALC_TYPES[c.calculation_type] || c.calculation_type;
      const vals = (c.values || []).filter(Boolean).join('~');
      const unit = c.range_type === 'PCT' ? '%' : '';
      return `${metric} ${calc} ${vals}${unit}`;
    }).join('；');
  };

  const formatAction = (acts?: RuleAction[]) => {
    if (!acts?.length) return '-';
    return acts.map(a => {
      const sbj = ACTION_SUBJECTS[a.subject_type] || a.subject_type;
      const atype = ACTION_TYPES[a.action_type] || a.action_type;
      const unit = a.value_type === 'PCT' ? '%' : '';
      if (a.action_type === 'ENABLE' || a.action_type === 'DISABLE') return `${atype} ${sbj}`;
      return `${atype} ${sbj} ${a.value}${unit}`;
    }).join('；');
  };

  const columns: ColumnsType<OptimizerRule> = [
    {
      title: '规则名称', dataIndex: 'rule_name', key: 'name', width: 180, fixed: 'left',
      render: (n: string, r) => <Text strong style={{ color: PRIMARY, cursor: 'pointer' }} onClick={() => showDetail(r)}>{n || r.rule_id}</Text>,
    },
    { title: '规则ID', dataIndex: 'rule_id', key: 'id', width: 170, render: (id: string) => <Text code style={{ fontSize: 12 }}>{id}</Text> },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => {
        const active = s === 'ACTIVE' || s === 'ENABLED';
        return (
          <Tag icon={active ? <ThunderboltOutlined /> : <PoweroffOutlined />}
            color={active ? 'green' : '#94a3b8'}>
            {active ? '生效中' : '已停用'}
          </Tag>
        );
      },
    },
    {
      title: '触发条件', key: 'conditions', width: 260,
      render: (_: any, r: OptimizerRule) => <Text style={{ fontSize: 12 }}>{formatCondition(r.conditions)}</Text>,
    },
    {
      title: '执行动作', key: 'actions', width: 200,
      render: (_: any, r: OptimizerRule) => <Text style={{ fontSize: 12 }}>{formatAction(r.actions)}</Text>,
    },
    { title: '创建时间', dataIndex: 'create_time', key: 'time', width: 170, render: (v: string) => <Text style={{ fontSize: 12, color: '#64748b' }}>{v}</Text> },
    {
      title: '操作', key: 'op', width: 220, fixed: 'right',
      render: (_: any, record: OptimizerRule) => {
        const isActive = record.status === 'ACTIVE' || record.status === 'ENABLED';
        return (
          <Space size={0}>
            <Switch size="small" checked={isActive} style={{ marginRight: 8 }}
              onChange={() => handleToggle(record.rule_id, record.status)} />
            <Button size="small" type="link" icon={<EditOutlined />} style={{ color: PRIMARY }}
              onClick={() => openEdit(record)} />
            <Tooltip title="执行结果">
              <Button size="small" type="link" icon={<HistoryOutlined />} style={{ color: '#64748b' }}
                onClick={() => showResults(record)} />
            </Tooltip>
            <Tooltip title="删除">
              <Popconfirm title="确定删除此规则？" onConfirm={() => handleDelete(record.rule_id)} okText="确定" cancelText="取消">
                <Button size="small" type="link" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  /* ── 条件/动作编辑器 ── */

  const addCondition = () => setForm(prev => ({
    ...prev,
    conditions: [...prev.conditions, { subject_type: 'COST', calculation_type: 'LARGER_THAN', range_type: 'ABS', values: [''] }],
  }));

  const removeCondition = (idx: number) => {
    if (form.conditions.length <= 1) { message.warning('至少保留一个触发条件'); return; }
    setForm(prev => ({ ...prev, conditions: prev.conditions.filter((_, i) => i !== idx) }));
  };

  const addAction = () => setForm(prev => ({
    ...prev,
    actions: [...prev.actions, { subject_type: 'BID', action_type: 'DECREASE', value: 10, value_type: 'PCT', frequency_type: 'DAILY', frequency_count: 1 }],
  }));

  const removeAction = (idx: number) => {
    if (form.actions.length <= 1) { message.warning('至少保留一个执行动作'); return; }
    setForm(prev => ({ ...prev, actions: prev.actions.filter((_, i) => i !== idx) }));
  };

  const isExecTimeSimple = form.rule_exec_info.exec_time_type === 'CUSTOM';

  /* ══════════════════════════════════════ */
  /* ── 渲染 ── */
  /* ══════════════════════════════════════ */

  if (advertisers.length === 0 && !loading) {
    return (
      <div style={{ padding: '0 0 24px' }}>
        <Result icon={<ApiOutlined style={{ color: PRIMARY }} />} title="请先授权 TikTok Ads 账户"
          subTitle="在 广告账户 页面绑定 TikTok 广告账户后才能使用智能规则"
          extra={<Button type="primary" onClick={() => window.location.href = '/ad-accounts'} style={{ borderRadius: 8 }}>前往授权</Button>} />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* ── 标题栏 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ControlOutlined style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <Title level={4} style={{ margin: 0, color: '#1e293b' }}>智能规则</Title>
          </div>
          <Text type="secondary">TikTok 自动化广告优化规则，按条件自动调整预算 / 出价 / 状态</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadRules(true)} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 8, background: PRIMARY }}>创建规则</Button>
        </Space>
      </div>

      {/* ── 搜索筛选栏 ── */}
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <Space wrap>
          <Select value={selectedAdv} onChange={setSelectedAdv} style={{ width: 220, borderRadius: 8 }}
            options={advertisers.map(a => ({ value: a.advertiser_id, label: a.advertiser_name }))} />
          <Input prefix={<SearchOutlined />} placeholder="搜索规则名称" value={keyword} onChange={e => setKeyword(e.target.value)}
            allowClear style={{ width: 240, borderRadius: 8 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 <Text strong style={{ color: PRIMARY }}>{filtered.length}</Text> 条
            <Tag color="green" style={{ marginLeft: 6 }}>{activeCount} 生效</Tag>
            <Tag color="#94a3b8" style={{ marginLeft: 4 }}>{disabledCount} 停用</Tag>
            {lastUpdated && (
              <Text type="secondary" style={{ marginLeft: 10, fontSize: 11 }}>
                {isCached ? '🟢 缓存' : '🔵 实时'} · {formatRelativeTime(lastUpdated)}
              </Text>
            )}
          </Text>
        </Space>
      </Card>

      {/* ── 规则表格 ── */}
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {loading ? <Spin style={{ display: 'block', margin: '40px auto' }} /> : (
          <Table columns={columns} dataSource={filtered} rowKey="rule_id" size="middle"
            scroll={{ x: 1300 }} pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `共 ${t} 条` }} />
        )}
      </Card>

      {/* ══════════════════════════════════════ */}
      {/* ── 创建 / 编辑抽屉 ── */}
      {/* ══════════════════════════════════════ */}
      <Drawer
        title={editingId ? '编辑规则' : '创建智能规则'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        width={700}
        extra={
          <Space>
            <Button onClick={() => setFormOpen(false)} style={{ borderRadius: 8 }}>取消</Button>
            <Button type="primary" onClick={handleSave} loading={saving} style={{ borderRadius: 8, background: PRIMARY }}>保存</Button>
          </Space>
        }
      >
        {/* ── 模板快捷入口 ── */}
        {!editingId && (
          <div style={{ marginBottom: 20 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
              <ExperimentOutlined /> 选择预置模板快速创建
            </Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PRESET_TEMPLATES.map(t => (
                <div key={t.id} onClick={() => applyTemplate(t.id)}
                  style={{
                    padding: '10px 14px', borderRadius: 8, border: '1px solid #e8e5e0', cursor: 'pointer',
                    background: '#fafbfc', transition: 'all .2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.background = '#eef2ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e5e0'; e.currentTarget.style.background = '#fafbfc'; }}
                >
                  <Text strong style={{ fontSize: 13 }}>{t.icon} {t.name}</Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{t.desc}</Text>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 名称 ── */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#334155' }}>规则名称</Text>
          <Input placeholder="例如：降本增效-超出预算自动降价" value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} style={{ borderRadius: 8 }} />
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab}
          style={{ background: TABS_BG, borderRadius: 10, padding: '4px 12px 0' }}
          items={[
            {
              key: 'conditions', label: '触发条件',
              children: (
                <div style={{ padding: '4px 0 16px' }}>
                  {form.conditions.map((cond, idx) => (
                    <Card key={idx} size="small" style={{ borderRadius: 8, marginBottom: 10, border: '1px solid #e8e5e0', background: '#fff' }}
                      title={<Text style={{ fontSize: 12, color: '#64748b' }}>条件 {idx + 1}</Text>}
                      extra={form.conditions.length > 1 && <Button size="small" type="link" danger onClick={() => removeCondition(idx)}>删除</Button>}
                    >
                      <Space wrap direction="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Select value={cond.subject_type} style={{ width: 130, borderRadius: 8 }}
                            onChange={v => {
                              setForm(prev => {
                                const conds = [...prev.conditions];
                                conds[idx] = { ...conds[idx], subject_type: v };
                                return { ...prev, conditions: conds };
                              });
                            }}
                            options={Object.entries(CONDITION_METRICS).map(([k, v]) => ({ value: k, label: v }))}
                          />
                          <Select value={cond.calculation_type} style={{ width: 90, borderRadius: 8 }}
                            onChange={v => {
                              setForm(prev => {
                                const conds = [...prev.conditions];
                                conds[idx] = { ...conds[idx], calculation_type: v };
                                return { ...prev, conditions: conds };
                              });
                            }}
                            options={Object.entries(CALC_TYPES).map(([k, v]) => ({ value: k, label: v }))}
                          />
                          <Select value={cond.range_type} style={{ width: 90, borderRadius: 8 }}
                            onChange={v => {
                              setForm(prev => {
                                const conds = [...prev.conditions];
                                conds[idx] = { ...conds[idx], range_type: v };
                                return { ...prev, conditions: conds };
                              });
                            }}
                            options={Object.entries(RANGE_TYPES).map(([k, v]) => ({ value: k, label: v }))}
                          />
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 11, marginRight: 8 }}>阈值</Text>
                          {cond.calculation_type === 'BETWEEN' ? (
                            <Space>
                              <Input placeholder="最小值" value={cond.values[0] || ''}
                                onChange={e => {
                                  setForm(prev => {
                                    const conds = [...prev.conditions];
                                    conds[idx] = { ...conds[idx], values: [e.target.value, conds[idx].values[1] || ''] };
                                    return { ...prev, conditions: conds };
                                  });
                                }} style={{ width: 100, borderRadius: 6 }} />
                              <Text type="secondary">~</Text>
                              <Input placeholder="最大值" value={cond.values[1] || ''}
                                onChange={e => {
                                  setForm(prev => {
                                    const conds = [...prev.conditions];
                                    conds[idx] = { ...conds[idx], values: [conds[idx].values[0] || '', e.target.value] };
                                    return { ...prev, conditions: conds };
                                  });
                                }} style={{ width: 100, borderRadius: 6 }} />
                            </Space>
                          ) : (
                            <Input placeholder="输入数值" value={cond.values[0] || ''}
                              onChange={e => {
                                setForm(prev => {
                                  const conds = [...prev.conditions];
                                  conds[idx] = { ...conds[idx], values: [e.target.value] };
                                  return { ...prev, conditions: conds };
                                });
                              }} style={{ width: 120, borderRadius: 6 }} />
                          )}
                          {cond.range_type === 'PCT' && <Text type="secondary" style={{ marginLeft: 6, fontSize: 11 }}>%</Text>}
                        </div>
                      </Space>
                    </Card>
                  ))}
                  <Button type="dashed" block onClick={addCondition} icon={<PlusOutlined />} style={{ borderRadius: 8 }}>添加条件</Button>
                </div>
              ),
            },
            {
              key: 'actions', label: '执行动作',
              children: (
                <div style={{ padding: '4px 0 16px' }}>
                  {form.actions.map((act, idx) => (
                    <Card key={idx} size="small" style={{ borderRadius: 8, marginBottom: 10, border: '1px solid #e8e5e0', background: '#fff' }}
                      title={<Text style={{ fontSize: 12, color: '#64748b' }}>动作 {idx + 1}</Text>}
                      extra={form.actions.length > 1 && <Button size="small" type="link" danger onClick={() => removeAction(idx)}>删除</Button>}
                    >
                      <Space wrap direction="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Select value={act.subject_type} style={{ width: 120, borderRadius: 8 }}
                            onChange={v => {
                              setForm(prev => {
                                const acts = [...prev.actions];
                                acts[idx] = { ...acts[idx], subject_type: v };
                                if (v === 'AD_STATUS' || v === 'ADGROUP_STATUS' || v === 'CAMPAIGN_STATUS') {
                                  acts[idx].action_type = 'DISABLE';
                                  acts[idx].value = 0;
                                  acts[idx].value_type = 'ABS';
                                } else {
                                  acts[idx].action_type = 'DECREASE';
                                }
                                return { ...prev, actions: acts };
                              });
                            }}
                            options={Object.entries(ACTION_SUBJECTS).map(([k, v]) => ({ value: k, label: v }))}
                          />
                          <Select value={act.action_type} style={{ width: 90, borderRadius: 8 }}
                            onChange={v => {
                              setForm(prev => {
                                const acts = [...prev.actions];
                                acts[idx] = { ...acts[idx], action_type: v };
                                return { ...prev, actions: acts };
                              });
                            }}
                            options={Object.entries(ACTION_TYPES).filter(([k]) => {
                              const sbj = act.subject_type;
                              if (k === 'ENABLE' || k === 'DISABLE') {
                                return sbj === 'AD_STATUS' || sbj === 'ADGROUP_STATUS' || sbj === 'CAMPAIGN_STATUS';
                              }
                              return sbj === 'BUDGET' || sbj === 'BID';
                            }).map(([k, v]) => ({ value: k, label: v }))}
                          />
                        </div>
                        {(act.action_type !== 'ENABLE' && act.action_type !== 'DISABLE') && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>调整值</Text>
                            <InputNumber size="small" value={act.value} min={1} max={999}
                              onChange={v => {
                                setForm(prev => {
                                  const acts = [...prev.actions];
                                  acts[idx] = { ...acts[idx], value: v || 0 };
                                  return { ...prev, actions: acts };
                                });
                              }} style={{ width: 80, borderRadius: 6 }} />
                            <Select value={act.value_type} size="small" style={{ width: 80, borderRadius: 6 }}
                              onChange={v => {
                                setForm(prev => {
                                  const acts = [...prev.actions];
                                  acts[idx] = { ...acts[idx], value_type: v };
                                  return { ...prev, actions: acts };
                                });
                              }}
                              options={Object.entries(RANGE_TYPES).map(([k, v]) => ({ value: k, label: v }))}
                            />
                            <Select value={act.frequency_type} size="small" style={{ width: 80, borderRadius: 6 }}
                              onChange={v => {
                                setForm(prev => {
                                  const acts = [...prev.actions];
                                  acts[idx] = { ...acts[idx], frequency_type: v };
                                  return { ...prev, actions: acts };
                                });
                              }}
                              options={[
                                { value: 'HOURLY', label: '每小时' },
                                { value: 'DAILY', label: '每日' },
                              ]}
                            />
                            <Text type="secondary" style={{ fontSize: 11 }}>最多</Text>
                            <InputNumber size="small" value={act.frequency_count} min={1} max={99}
                              onChange={v => {
                                setForm(prev => {
                                  const acts = [...prev.actions];
                                  acts[idx] = { ...acts[idx], frequency_count: v || 1 };
                                  return { ...prev, actions: acts };
                                });
                              }} style={{ width: 60, borderRadius: 6 }} />
                            <Text type="secondary" style={{ fontSize: 11 }}>次</Text>
                          </div>
                        )}
                      </Space>
                    </Card>
                  ))}
                  <Button type="dashed" block onClick={addAction} icon={<PlusOutlined />} style={{ borderRadius: 8 }}>添加动作</Button>
                </div>
              ),
            },
            {
              key: 'targets', label: '作用范围',
              children: (
                <div style={{ padding: '4px 0 16px' }}>
                  {form.apply_objects.map((obj, idx) => (
                    <Card key={idx} size="small" style={{ borderRadius: 8, marginBottom: 10, border: '1px solid #e8e5e0', background: '#fff' }}>
                      <Space wrap direction="vertical" style={{ width: '100%' }}>
                        <Select value={obj.dimension} style={{ width: 140, borderRadius: 8 }}
                          onChange={v => {
                            setForm(prev => {
                              const objs = [...prev.apply_objects];
                              objs[idx] = { ...objs[idx], dimension: v };
                              return { ...prev, apply_objects: objs };
                            });
                          }}
                          options={Object.entries(DIMENSIONS).map(([k, v]) => ({ value: k, label: v }))}
                        />
                        <div>
                          <Select value={obj.pre_condition_type} style={{ width: 160, borderRadius: 8, marginBottom: 8 }}
                            onChange={v => {
                              setForm(prev => {
                                const objs = [...prev.apply_objects];
                                objs[idx] = { ...objs[idx], pre_condition_type: v, id_input: v === 'ALL' ? '' : objs[idx].id_input };
                                return { ...prev, apply_objects: objs };
                              });
                            }}
                            options={[
                              { value: 'ALL', label: '全部' },
                              { value: 'LIST', label: '指定ID列表' },
                            ]}
                          />
                          {obj.pre_condition_type === 'LIST' && (
                            <Input placeholder="输入ID，逗号分隔" value={obj.id_input}
                              onChange={e => {
                                setForm(prev => {
                                  const objs = [...prev.apply_objects];
                                  objs[idx] = { ...objs[idx], id_input: e.target.value };
                                  return { ...prev, apply_objects: objs };
                                });
                              }} style={{ borderRadius: 8 }} />
                          )}
                        </div>
                      </Space>
                    </Card>
                  ))}
                </div>
              ),
            },
            {
              key: 'schedule', label: '执行时间',
              children: (
                <div style={{ padding: '4px 0 16px' }}>
                  <Select value={form.rule_exec_info.exec_time_type} style={{ width: 200, borderRadius: 8, marginBottom: 12 }}
                    onChange={v => {
                      setForm(prev => ({
                        ...prev,
                        rule_exec_info: {
                          ...prev.rule_exec_info,
                          exec_time_type: v,
                          time_period_info: v === 'CUSTOM' ? [{ date_type: 'EVERYDAY', start_time: '00:00', end_time: '23:59', num: [0, 1, 2, 3, 4, 5, 6] }] : [],
                        },
                      }));
                    }}
                    options={Object.entries(EXEC_TIME_TYPES).map(([k, v]) => ({ value: k, label: v }))}
                  />
                  {isExecTimeSimple && form.rule_exec_info.time_period_info.map((tp, idx) => (
                    <Card key={idx} size="small" style={{ borderRadius: 8, marginTop: 8, marginBottom: 10, border: '1px solid #e8e5e0', background: '#fff' }}>
                      <Space wrap direction="vertical" style={{ width: '100%' }}>
                        <Select value={tp.date_type} style={{ width: 120, borderRadius: 8 }}
                          onChange={v => {
                            setForm(prev => {
                              const tps = [...prev.rule_exec_info.time_period_info];
                              tps[idx] = { ...tps[idx], date_type: v };
                              if (v === 'EVERDAY') tps[idx] = { ...tps[idx], num: [0, 1, 2, 3, 4, 5, 6] };
                              if (v === 'WEEKDAY') tps[idx] = { ...tps[idx], num: [1] };
                              return { ...prev, rule_exec_info: { ...prev.rule_exec_info, time_period_info: tps } };
                            });
                          }}
                          options={Object.entries(DATE_TYPES).map(([k, v]) => ({ value: k, label: v }))}
                        />
                        {tp.date_type === 'WEEKDAY' && (
                          <Select mode="multiple" value={tp.num} style={{ width: '100%', borderRadius: 8 }}
                            onChange={v => {
                              setForm(prev => {
                                const tps = [...prev.rule_exec_info.time_period_info];
                                tps[idx] = { ...tps[idx], num: v };
                                return { ...prev, rule_exec_info: { ...prev.rule_exec_info, time_period_info: tps } };
                              });
                            }}
                            options={WEEKDAY_LABELS.map((l, i) => ({ value: i + 1, label: l }))}
                          />
                        )}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>从</Text>
                          <Input value={tp.start_time}
                            onChange={e => {
                              setForm(prev => {
                                const tps = [...prev.rule_exec_info.time_period_info];
                                tps[idx] = { ...tps[idx], start_time: e.target.value };
                                return { ...prev, rule_exec_info: { ...prev.rule_exec_info, time_period_info: tps } };
                              });
                            }} style={{ width: 80, borderRadius: 6 }} placeholder="00:00" />
                          <Text type="secondary" style={{ fontSize: 12 }}>至</Text>
                          <Input value={tp.end_time}
                            onChange={e => {
                              setForm(prev => {
                                const tps = [...prev.rule_exec_info.time_period_info];
                                tps[idx] = { ...tps[idx], end_time: e.target.value };
                                return { ...prev, rule_exec_info: { ...prev.rule_exec_info, time_period_info: tps } };
                              });
                            }} style={{ width: 80, borderRadius: 6 }} placeholder="23:59" />
                        </div>
                      </Space>
                    </Card>
                  ))}
                  {form.rule_exec_info.exec_time_type === 'ALWAYS' && (
                    <Text type="secondary" style={{ fontSize: 12 }}>规则将全天候持续监控条件变化并自动执行。</Text>
                  )}
                  {form.rule_exec_info.exec_time_type === 'DAILY' && (
                    <Text type="secondary" style={{ fontSize: 12 }}>每日检查一次，满足条件时自动执行动作。</Text>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Drawer>

      {/* ══════════════════════════════════════ */}
      {/* ── 详情抽屉 ── */}
      {/* ══════════════════════════════════════ */}
      <Drawer title="规则详情" open={detailOpen} onClose={() => setDetailOpen(false)} width={560}>
        {detailRule && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="规则名称">{detailRule.rule_name}</Descriptions.Item>
              <Descriptions.Item label="规则ID"><Text code>{detailRule.rule_id}</Text></Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={(detailRule.status === 'ACTIVE' || detailRule.status === 'ENABLED') ? 'green' : '#94a3b8'}>
                  {detailRule.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{detailRule.create_time}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <Collapse size="small" style={{ borderRadius: 8, background: '#fff' }}>
              <Panel header="触发条件" key="conditions">
                {detailRule.conditions?.length ? (
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {detailRule.conditions.map((c, i) => (
                      <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>
                        {CONDITION_METRICS[c.subject_type] || c.subject_type}
                        {' '}{CALC_TYPES[c.calculation_type] || c.calculation_type}
                        {' '}{(c.values || []).join('~')}{c.range_type === 'PCT' ? '%' : ''}
                      </li>
                    ))}
                  </ul>
                ) : <Text type="secondary">无</Text>}
              </Panel>
              <Panel header="执行动作" key="actions">
                {detailRule.actions?.length ? (
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {detailRule.actions.map((a, i) => (
                      <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>
                        {a.action_type === 'ENABLE' || a.action_type === 'DISABLE'
                          ? `${ACTION_TYPES[a.action_type] || a.action_type} ${ACTION_SUBJECTS[a.subject_type] || a.subject_type}`
                          : `${ACTION_TYPES[a.action_type] || a.action_type} ${ACTION_SUBJECTS[a.subject_type] || a.subject_type} ${a.value}${a.value_type === 'PCT' ? '%' : ''}`}
                      </li>
                    ))}
                  </ul>
                ) : <Text type="secondary">无</Text>}
              </Panel>
              {detailRule.apply_objects?.length ? (
                <Panel header="作用范围" key="scope">
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {detailRule.apply_objects.map((o, i) => (
                      <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>
                        {DIMENSIONS[o.dimension] || o.dimension}：
                        {o.pre_condition_type === 'ALL' ? '全部' : (o.dimension_ids || []).join(', ')}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </Collapse>
            <Divider />
            <Space>
              <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detailRule); }} style={{ borderRadius: 8 }}>编辑</Button>
              <Button icon={<HistoryOutlined />} onClick={() => { setDetailOpen(false); showResults(detailRule); }} style={{ borderRadius: 8 }}>执行结果</Button>
            </Space>
          </>
        )}
      </Drawer>

      {/* ══════════════════════════════════════ */}
      {/* ── 执行结果抽屉 ── */}
      {/* ══════════════════════════════════════ */}
      <Drawer title={`执行结果：${resultsRuleName}`} open={resultsOpen} onClose={() => { setResultsOpen(false); setResults([]); }} width={680}>
        {resultsLoading ? <Spin style={{ display: 'block', margin: '40px auto' }} /> : (
          results.length === 0 ? (
            <Result status="info" title="暂无执行结果" subTitle="规则尚未触发执行或还未产生结果数据" />
          ) : (
            <div style={{ maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
              {results.map((r, i) => (
                <Card key={r.rule_result_id || i} size="small" style={{ borderRadius: 8, marginBottom: 10, border: '1px solid #e8e5e0', background: '#fff' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong style={{ fontSize: 13 }}>{r.action || '-'}</Text>
                      <Tag color={r.status === 'SUCCESS' || r.status === 'COMPLETED' ? 'green' : '#94a3b8'} style={{ borderRadius: 6 }}>{r.status || '-'}</Tag>
                    </div>
                    <Text style={{ fontSize: 12, color: '#475569' }}>{r.message || '-'}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{r.create_time}</Text>
                  </Space>
                </Card>
              ))}
            </div>
          )
        )}
      </Drawer>
    </div>
  );
};

export default AdRules;
