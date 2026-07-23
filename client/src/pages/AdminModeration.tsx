import { useEffect, useState } from 'react';
import { Card, Table, Typography, Button, Space, Tag, message, Popconfirm, Modal, Descriptions } from 'antd';
import { StopOutlined, CheckCircleOutlined, SafetyCertificateOutlined, WarningOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../api';
import { formatDateTime } from '../utils/time';

const { Text, Title } = Typography;

interface ViolationUser {
  id: number;
  username: string;
  ai_suspended: number;
  ai_suspended_at: string;
  ai_suspend_reason: string;
  total: number;
}

export default function AdminModeration() {
  const [users, setUsers] = useState<ViolationUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModal, setDetailModal] = useState<{ open: boolean; userId: number; data: any }>({ open: false, userId: 0, data: null });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/moderation/users');
      setUsers(res.data.data || []);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const showDetail = async (userId: number) => {
    try {
      const res = await api.get(`/admin/moderation/users/${userId}`);
      setDetailModal({ open: true, userId, data: res.data.data });
    } catch { message.error('加载详情失败'); }
  };

  const unban = async (userId: number) => {
    try { await api.post(`/admin/moderation/users/${userId}/unban`); message.success('已解禁'); fetchUsers(); }
    catch { message.error('操作失败'); }
  };

  const ban = async (userId: number) => {
    try { await api.post(`/admin/moderation/users/${userId}/ban`, { reason: '管理员永久封禁' }); message.success('已永久封禁'); fetchUsers(); }
    catch { message.error('操作失败'); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const columns = [
    { title: '用户', dataIndex: 'username', width: 120 },
    { title: '状态', dataIndex: 'ai_suspended', width: 100, render: (v: number, r: ViolationUser) => {
      if (v === 1 && r.ai_suspend_reason?.includes('永久')) return <Tag color="red">已封禁</Tag>;
      if (v === 1) return <Tag color="orange">已暂停</Tag>;
      return <Tag color="green">正常</Tag>;
    }},
    { title: '累计违规', dataIndex: 'total', width: 80, render: (v: number) => <Text style={{ color: v >= 3 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{v}</Text> },
    { title: '暂停时间', dataIndex: 'ai_suspended_at', width: 140, render: (v: string) => v ? formatDateTime(v) : '—' },
    { title: '原因', dataIndex: 'ai_suspend_reason', ellipsis: true, render: (v: string) => v || '—' },
    {
      title: '操作', width: 200,
      render: (_: any, r: ViolationUser) => (
        <Space size="small">
          <Button size="small" onClick={() => showDetail(r.id)}>详情</Button>
          {r.ai_suspended === 1 && (
            <Popconfirm title="确认解禁该用户？" onConfirm={() => unban(r.id)}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}>解禁</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认永久封禁？此操作不可恢复" onConfirm={() => ban(r.id)}>
            <Button size="small" danger icon={<StopOutlined />}>封禁</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>
            <SafetyCertificateOutlined />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>违禁词管理</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>用户违禁记录 · 解禁/封禁 · 备案合规</Text>
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchUsers}>刷新</Button>
      </div>

      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 12 }}>
        <Table rowKey="id" columns={columns} dataSource={users} loading={loading} size="middle"
          locale={{ emptyText: '暂无违禁记录' }} pagination={false} />
      </Card>

      <Modal open={detailModal.open} onCancel={() => setDetailModal({ open: false, userId: 0, data: null })} footer={null} title="违禁详情" width={800}>
        {detailModal.data && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="违禁记录">{detailModal.data.violations?.length || 0} 条</Descriptions.Item>
              <Descriptions.Item label="审计日志">{detailModal.data.logs?.length || 0} 条</Descriptions.Item>
            </Descriptions>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>违禁日志（最近 50 条）</Text>
            <Table rowKey="id" dataSource={detailModal.data.logs || []} size="small" pagination={false}
              columns={[
                { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => formatDateTime(v) },
                { title: '动作', dataIndex: 'action', width: 100, render: (v: string) => <Tag color="error">{v}</Tag> },
                { title: '详情', dataIndex: 'detail', ellipsis: true, render: (v: string) => {
                  try { const d = JSON.parse(v); return <Text style={{ fontSize: 11 }}>输入: {d.input?.slice(0, 60)} | 命中: {(d.matched||[]).join(',')?.slice(0, 60)} | 类别: {(d.categories||[]).join(',')}</Text>; }
                  catch { return <Text style={{ fontSize: 11 }}>{v?.slice(0, 100)}</Text>; }
                }},
                { title: 'IP', dataIndex: 'ip', width: 110 },
              ]} />
          </>
        )}
      </Modal>
    </div>
  );
}
