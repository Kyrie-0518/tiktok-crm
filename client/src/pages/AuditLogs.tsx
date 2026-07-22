import { useEffect, useState } from 'react';
import { Card, Table, Tag, Input, Select, Space, DatePicker, Typography, Statistic, Row, Col, message, Tabs } from 'antd';
import {
  HistoryOutlined, SearchOutlined, UserOutlined, RobotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatDateTimeSec, formatDateTime } from '../utils/time';
import api from '../api';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface AuditLog {
  id: number;
  user_id: number | null;
  username: string;
  method: string;
  path: string;
  status_code: number;
  ip: string;
  user_agent: string;
  created_at: string;
}

interface ModelCallLog {
  id: number;
  user_id: number;
  username: string;
  module: string;
  model_name: string;
  input_prompt: string;
  output_content: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  ip: string;
  status: string;
  created_at: string;
}

export default function AuditLogs() {
  // === 操作日志状态 ===
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [methodFilter, setMethodFilter] = useState<string | undefined>();
  const [userFilter, setUserFilter] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [stats, setStats] = useState({ today_total: 0, week_total: 0 });

  // === 模型调用状态 ===
  const [activeTab, setActiveTab] = useState('operations');
  const [modelCalls, setModelCalls] = useState<ModelCallLog[]>([]);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcTotal, setMcTotal] = useState(0);
  const [mcPage, setMcPage] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (methodFilter) params.method = methodFilter;
      if (userFilter) params.username = userFilter;
      if (dateRange) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await api.get('/audit-logs', { params });
      setLogs(res.data.list);
      setTotal(res.data.total);
    } catch (e: any) {
      message.error('加载日志失败: ' + (e.response?.data?.error || e.message));
    } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/audit-logs/stats');
      setStats(res.data);
    } catch {}
  };

  const fetchModelCalls = async () => {
    setMcLoading(true);
    try {
      const res = await api.get('/audit-logs/model-calls', { params: { page: mcPage, limit: 20 } });
      setModelCalls(res.data.data || []);
      setMcTotal(res.data.total || 0);
    } catch (e: any) {
      setModelCalls([]);
    } finally { setMcLoading(false); }
  };

  useEffect(() => { fetchLogs(); fetchStats(); }, [page, methodFilter, userFilter, dateRange]);
  useEffect(() => { if (activeTab === 'models') fetchModelCalls(); }, [mcPage, activeTab]);

  const methodColors: Record<string, string> = {
    GET: 'green', POST: 'blue', PUT: 'orange', DELETE: 'red', PATCH: 'purple',
  };

  // === 操作日志列 ===
  const columns = [
    { title: '时间', dataIndex: 'created_at', width: 160, render: (v: string) => v ? formatDateTimeSec(v) : '-' },
    { title: '方法', dataIndex: 'method', width: 80, render: (v: string) => <Tag color={methodColors[v] || 'default'}>{v}</Tag> },
    { title: '路径', dataIndex: 'path', ellipsis: true, render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    { title: '状态', dataIndex: 'status_code', width: 70, render: (v: number) => <Tag color={v < 300 ? 'success' : v < 400 ? 'warning' : 'error'}>{v}</Tag> },
    { title: '用户', dataIndex: 'username', width: 100, render: (v: string) => v || <Text type="secondary">匿名</Text> },
    { title: 'IP', dataIndex: 'ip', width: 130, render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v || '-'}</Text> },
  ];

  // === 模型调用列 ===
  const modelCallColumns = [
    { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => formatDateTime(v) },
    { title: '用户', dataIndex: 'username', width: 80 },
    { title: '模块', dataIndex: 'module', width: 80, render: (v: string) => {
      const map: Record<string, string> = { owen: '欧文', video: '视频', diagnosis: '诊断', ai_engine: 'AI引擎' };
      return <Tag>{map[v] || v}</Tag>;
    }},
    { title: '模型', dataIndex: 'model_name', width: 100, ellipsis: true },
    { title: '输入', dataIndex: 'input_prompt', width: 200, ellipsis: true, render: (v: string) => <Text style={{ fontSize: 11 }}>{v?.slice(0, 80) || '-'}</Text> },
    { title: '输出', dataIndex: 'output_content', width: 250, ellipsis: true, render: (v: string) => <Text style={{ fontSize: 11 }}>{v?.slice(0, 100) || '-'}</Text> },
    { title: 'Token', key: 'tokens', width: 60, render: (_: any, r: ModelCallLog) => <Text style={{ fontSize: 11 }}>{(r.tokens_in || 0) + (r.tokens_out || 0)}</Text> },
    { title: '耗时', dataIndex: 'latency_ms', width: 60, render: (v: number) => v ? (v > 1000 ? (v/1000).toFixed(1)+'s' : v+'ms') : '-' },
    { title: 'IP', dataIndex: 'ip', width: 100 },
    { title: '状态', dataIndex: 'status', width: 60, render: (v: string) => <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? '成功' : v}</Tag> },
  ];

  return (
    <div style={{ padding: '20px 24px', background: '#f5f3f0', minHeight: '100%' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #4568FF, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 18,
          }}>
            <HistoryOutlined />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#172033' }}>操作日志</h2>
            <span style={{ fontSize: 12, color: '#999' }}>API 请求记录 · 180天自动清理 · 备案合规</span>
          </div>
        </div>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'operations',
          label: '操作日志',
          children: (
            <>
              {/* 统计卡片 */}
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={12} sm={6}>
                  <Card size="small" style={{ borderTop: '2px solid #64748b', borderRadius: 10, background: '#111827', borderColor: 'rgba(255,255,255,0.06)' }}>
                    <Statistic title={<span style={{ color: '#94a3b8' }}>今日请求</span>} value={stats.today_total} valueStyle={{ color: '#94a3b8', fontWeight: 600, fontSize: 22 }} />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small" style={{ borderTop: '2px solid #475569', borderRadius: 10, background: '#111827', borderColor: 'rgba(255,255,255,0.06)' }}>
                    <Statistic title={<span style={{ color: '#94a3b8' }}>近7天请求</span>} value={stats.week_total} valueStyle={{ color: '#475569', fontWeight: 600, fontSize: 22 }} />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small" style={{ borderTop: '2px solid #3b82f6', borderRadius: 10, background: '#111827', borderColor: 'rgba(255,255,255,0.06)', boxShadow: '0 0 20px rgba(59,130,246,0.15)' }}>
                    <Statistic title={<span style={{ color: '#94a3b8' }}>总记录数</span>} value={total} valueStyle={{ color: '#60a5fa', fontWeight: 600, fontSize: 22 }} />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small" style={{ borderTop: '2px solid #d97706', borderRadius: 10, background: '#111827', borderColor: 'rgba(255,255,255,0.06)' }}>
                    <Statistic title={<span style={{ color: '#94a3b8' }}>当前页</span>} value={logs.length} suffix={` / ${pageSize}`} valueStyle={{ color: '#d97706', fontWeight: 600, fontSize: 22 }} />
                  </Card>
                </Col>
              </Row>

              {/* 筛选栏 */}
              <div style={{ padding: '12px 16px', background: '#111827', borderRadius: 10, marginBottom: 12, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Select value={methodFilter} onChange={setMethodFilter} placeholder="请求方法" allowClear style={{ width: 110 }}
                  options={[{ label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }, { label: 'PUT', value: 'PUT' }, { label: 'DELETE', value: 'DELETE' }, { label: 'PATCH', value: 'PATCH' }]} />
                <Input placeholder="搜索用户名" prefix={<UserOutlined style={{ color: '#9ca3af' }} />} style={{ width: 160 }} value={userFilter} onChange={e => { setUserFilter(e.target.value); setPage(1); }} allowClear />
                <RangePicker value={dateRange} onChange={v => { setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null); setPage(1); }} format="YYYY-MM-DD" allowClear />
                <Space>
                  <SearchOutlined style={{ color: '#9ca3af' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>{methodFilter || userFilter || dateRange ? '已筛选' : '显示全部'}</Text>
                </Space>
              </div>

              {/* 表格 */}
              <Card bordered={false} bodyStyle={{ padding: 0 }} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Table dataSource={logs} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ current: page, pageSize, total, onChange: setPage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }} />
              </Card>
            </>
          ),
        },
        {
          key: 'models',
          label: <span><RobotOutlined /> 模型调用</span>,
          children: (
            <Card bordered={false} bodyStyle={{ padding: 0 }} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Table rowKey="id" columns={modelCallColumns} dataSource={modelCalls} loading={mcLoading}
                pagination={{ current: mcPage, total: mcTotal, pageSize: 20, onChange: setMcPage, showSizeChanger: false, showTotal: (t: number) => `共 ${t} 条` }}
                size="small" scroll={{ x: 1100 }} locale={{ emptyText: '暂无模型调用记录' }} />
            </Card>
          ),
        },
      ]} />
    </div>
  );
}
