import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Typography, Row, Col, Select, DatePicker, Space, Badge } from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExportOutlined, ReloadOutlined, ClockCircleOutlined,
  PlayCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const BRAND = '#2563eb';

interface LogEntry {
  id: string;
  time: string;
  rule_name: string;
  campaign_name: string;
  level: '系列' | '创意' | '商品';
  action: string;
  detail: string;
  condition_met: string;
  status: 'success' | 'failed' | 'skipped';
  shop: string;
}

const AdLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('全部');
  const [levelFilter, setLevelFilter] = useState<string>('全部');
  const [dateFilter, setDateFilter] = useState<dayjs.Dayjs>(dayjs());

  useEffect(() => { loadLogs(); }, [dateFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      // TODO: 接入真实API
      const actions = [
        { action: '调整预算', detail: '预算 $50 → $35', condition_met: 'CPA ≥ $15' },
        { action: '暂停系列', detail: '系列已暂停投放', condition_met: 'ROI < 1.5' },
        { action: '移除创意', detail: 'ID#A3241 已移除', condition_met: '花费≥$5 AND 订单=0' },
        { action: '增加预算', detail: '预算 $50 → $100', condition_met: '消耗率 ≥ 80%' },
        { action: '加回创意', detail: 'ID#A3215 已加回', condition_met: '近7天订单>0 AND CPA<$6' },
        { action: '创建加热', detail: '预算$15创建素材加热', condition_met: '素材状态=未投放' },
        { action: '调整ROI', detail: '目标ROI 2.5 → 3.0', condition_met: '近3天ROI > 5' },
        { action: '恢复预算', detail: '预算恢复至$30', condition_met: '预算 < $20' },
      ];
      const mock: LogEntry[] = Array.from({ length: 35 }, (_, i) => {
        const act = actions[i % actions.length];
        const status = i % 7 === 0 ? 'failed' : i % 10 === 0 ? 'skipped' : 'success';
        return {
          id: `log_${i}`,
          time: dayjs().subtract(Math.floor(i / 3), 'hour').subtract(i * 5, 'minute').format('MM-DD HH:mm'),
          rule_name: `规则${Math.floor(i / 5) + 1}`,
          campaign_name: `系列${String.fromCharCode(65 + (i % 8))}`,
          level: (['系列', '系列', '创意', '商品'] as const)[i % 4],
          action: act.action,
          detail: act.detail,
          condition_met: act.condition_met,
          status,
          shop: i % 2 === 0 ? '官方旗舰店' : '东南亚跨境店',
        };
      });
      setLogs(mock);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter(log => {
    if (statusFilter !== '全部' && log.status !== statusFilter) return false;
    if (levelFilter !== '全部' && log.level !== levelFilter) return false;
    return true;
  });

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    failed: logs.filter(l => l.status === 'failed').length,
  };

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    success: { color: '#059669', icon: <CheckCircleOutlined />, text: '执行成功' },
    failed: { color: '#dc2626', icon: <CloseCircleOutlined />, text: '执行失败' },
    skipped: { color: '#d97706', icon: <WarningOutlined />, text: '已跳过' },
  };

  const columns = [
    {
      title: '时间', dataIndex: 'time', key: 'time', width: 120,
      render: (v: string) => <Text style={{ fontSize: 13, fontFamily: 'monospace' }}>{v}</Text>,
    },
    {
      title: '店铺/系列', key: 'target', width: 180,
      render: (_: any, r: LogEntry) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{r.campaign_name}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.shop}</Text>
        </div>
      ),
    },
    {
      title: '层级', dataIndex: 'level', key: 'level', width: 70,
      render: (v: string) => (
        <Tag color={v === '系列' ? 'blue' : v === '创意' ? 'purple' : 'cyan'} style={{ fontSize: 11 }}>{v}</Tag>
      ),
    },
    {
      title: '规则', dataIndex: 'rule_name', key: 'rule_name', width: 100,
      render: (v: string) => <Tag color="geekblue" style={{ fontSize: 11 }}>{v}</Tag>,
    },
    {
      title: '触发条件', dataIndex: 'condition_met', key: 'condition_met', width: 180,
      render: (v: string) => <Text style={{ fontSize: 12, color: '#64748b' }}>{v}</Text>,
    },
    {
      title: '执行动作', key: 'action', width: 200,
      render: (_: any, r: LogEntry) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.action}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.detail}</Text>
        </div>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => {
        const cfg = statusConfig[v];
        return <Badge color={cfg?.color} text={cfg?.text} />;
      },
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* 标题区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${BRAND}, #60a5fa)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileTextOutlined style={{ color: '#fff', fontSize: 16 }} />
        </div>
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0, color: '#1e293b' }}>执行日志</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>实时监控自动化规则的执行状态与操作记录</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
          <Button icon={<ExportOutlined />} style={{ borderRadius: 8 }}>导出日志</Button>
        </Space>
      </div>

      {/* 执行统计 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8} sm={4}>
          <Card size="small" style={{ borderRadius: 8, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: BRAND }}>{stats.total}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>执行总数</Text>
          </Card>
        </Col>
        <Col xs={8} sm={4}>
          <Card size="small" style={{ borderRadius: 8, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>{stats.success}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>执行成功</Text>
          </Card>
        </Col>
        <Col xs={8} sm={4}>
          <Card size="small" style={{ borderRadius: 8, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{stats.failed}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>执行失败</Text>
          </Card>
        </Col>
        <Col xs={0} sm={12} />
      </Row>

      {/* 筛选 + 表格 */}
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <DatePicker
            value={dateFilter}
            onChange={(d) => d && setDateFilter(d)}
            style={{ borderRadius: 8 }}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120, borderRadius: 8 }}
            options={[
              { value: '全部', label: '全部状态' },
              { value: 'success', label: '执行成功' },
              { value: 'failed', label: '执行失败' },
              { value: 'skipped', label: '已跳过' },
            ]}
          />
          <Select
            value={levelFilter}
            onChange={setLevelFilter}
            style={{ width: 120, borderRadius: 8 }}
            options={[
              { value: '全部', label: '全部层级' },
              { value: '系列', label: '系列' },
              { value: '创意', label: '创意' },
              { value: '商品', label: '商品' },
            ]}
          />
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            共 <Text strong style={{ color: BRAND }}>{filtered.length}</Text> 条记录
          </Text>
        </div>
        <Table
          dataSource={filtered}
          columns={columns as any}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          size="small"
          scroll={{ x: 950 }}
          style={{ borderRadius: 8 }}
        />
      </Card>
    </div>
  );
};

export default AdLogs;
