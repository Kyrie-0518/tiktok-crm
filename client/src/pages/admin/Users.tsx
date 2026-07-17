import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, message, Typography, Avatar, Space } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined,
  UserOutlined, ReloadOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import api from '../../api';

const { Text } = Typography;

const T_COLOR = {
  primary: '#4568FF', primaryLight: '#EDF0FF',
  cardShadow: '0 8px 24px rgba(15,23,42,0.06)',
  cardBorder: '#EEF1F6', cardRadius: 20,
  textPrimary: '#172033', textSecondary: '#64748B', textTertiary: '#94A3B8',
};

interface User { id: number; username: string; display_name: string; role_id: number; role_key: string; role_name: string; created_at: string; last_login_at: string; last_login_ip: string; identity: string; email: string; }
interface Role { id: number; name: string; role_key: string; }

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Reset password modal
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdForm] = Form.useForm();
  const [pwdUser, setPwdUser] = useState<User | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([api.get('/auth/users'), api.get('/auth/roles')]);
      setUsers(uRes.data || []);
      setRoles(rRes.data || []);
    } catch { message.error('加载数据失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ role_id: roles.find(r => r.role_key === 'staff')?.id || 3 });
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({ username: user.username, display_name: user.display_name, role_id: user.role_id, email: user.email });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingUser) {
        await api.put(`/auth/users/${editingUser.id}`, values);
        message.success('用户已更新');
      } else {
        await api.post('/auth/register', values);
        message.success('用户已创建');
      }
      setModalOpen(false);
      loadData();
    } catch (e: any) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/auth/users/${id}`);
      message.success('已删除');
      loadData();
    } catch (e: any) { message.error(e.response?.data?.error || '删除失败'); }
  };

  const openResetPwd = (user: User) => {
    setPwdUser(user);
    pwdForm.resetFields();
    setPwdModalOpen(true);
  };

  const handleResetPwd = async () => {
    try {
      const values = await pwdForm.validateFields();
      await api.put(`/auth/users/${pwdUser!.id}/reset-password`, { newPassword: values.newPassword });
      message.success('密码已重置');
      setPwdModalOpen(false);
    } catch (e: any) { message.error(e.response?.data?.error || '重置失败'); }
  };

  const getRoleColor = (key: string) => {
    const m: Record<string, string> = { developer: '#4568FF', manager: '#F59E0B', staff: '#22C55E', viewer: '#94A3B8' };
    return m[key] || '#64748B';
  };

  const columns = [
    {
      title: '用户', dataIndex: 'username', width: 260,
      render: (_: any, r: User) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={36} style={{ background: r.identity === 'SUPER_ADMIN' ? 'linear-gradient(135deg, #6B8CFF, #4F6BFF)' : getRoleColor(r.role_key), flexShrink: 0, fontSize: 14, fontWeight: 600 }}>
            {(r.display_name || r.username).charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text strong style={{ fontSize: 13, color: T_COLOR.textPrimary }}>{r.username}</Text>
              {r.identity === 'SUPER_ADMIN' && (
                <Tag color="gold" style={{ borderRadius: 6, fontSize: 10, padding: '0 6px', lineHeight: '18px' }}>🛡 超级管理员</Tag>
              )}
            </div>
            <Text style={{ fontSize: 11, color: T_COLOR.textTertiary }}>{r.display_name || r.username}</Text>
          </div>
        </div>
      ),
    },
    {
      title: '角色', dataIndex: 'role_name', width: 100,
      render: (v: string, r: User) => (
        <Tag style={{ borderRadius: 6, border: 'none', background: `${getRoleColor(r.role_key)}15`, color: getRoleColor(r.role_key), fontSize: 11, fontWeight: 600 }}>
          {v || r.role_key || '—'}
        </Tag>
      ),
    },
    {
      title: '邮箱', dataIndex: 'email', width: 160,
      render: (v: string) => <Text style={{ fontSize: 12, color: v ? T_COLOR.textSecondary : T_COLOR.textTertiary }}>{v || '—'}</Text>,
    },
    {
      title: '最后登录', dataIndex: 'last_login_at', width: 140,
      render: (v: string) => <Text style={{ fontSize: 12, color: T_COLOR.textTertiary }}>{v ? v.slice(0, 16) : '从未登录'}</Text>,
    },
    {
      title: '操作', width: 180, align: 'right' as const,
      render: (_: any, r: User) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} style={{ color: T_COLOR.textSecondary, fontSize: 12, borderRadius: 6 }}>编辑</Button>
          <Button type="text" size="small" icon={<LockOutlined />} onClick={() => openResetPwd(r)} style={{ color: T_COLOR.textSecondary, fontSize: 12, borderRadius: 6 }}>密码</Button>
          {r.identity !== 'SUPER_ADMIN' && (
            <Popconfirm title="确认删除此用户？" onConfirm={() => handleDelete(r.id)} okType="danger">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 12, borderRadius: 6 }} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong style={{ fontSize: 15, color: T_COLOR.textPrimary }}>用户管理</Text>
            <Text style={{ fontSize: 12, color: T_COLOR.textTertiary, marginLeft: 8 }}>共 {users.length} 个账号</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} size="small" style={{ borderRadius: 8 }}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 10, background: T_COLOR.primary }}>
              创建账号
            </Button>
          </Space>
        </div>
      }
      style={{ borderRadius: T_COLOR.cardRadius, border: `1px solid ${T_COLOR.cardBorder}`, boxShadow: T_COLOR.cardShadow }}
      bodyStyle={{ padding: 0 }}
    >
      <Table
        dataSource={users}
        rowKey="id"
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        size="middle"
        style={{ marginTop: 0 }}
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editingUser ? '编辑用户' : '创建账号'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={editingUser ? '保存' : '创建'}
        cancelText="取消"
        okButtonProps={{ style: { borderRadius: 8, background: T_COLOR.primary } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        style={{ borderRadius: 14 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input placeholder="登录账号名" disabled={!!editingUser} style={{ borderRadius: 8 }} />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码', min: 6 }]}>
              <Input.Password placeholder="至少6位" style={{ borderRadius: 8 }} />
            </Form.Item>
          )}
          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="显示名（可选）" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="邮箱（可选）" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="role_id" label="角色" rules={[{ required: true }]}>
            <Select style={{ borderRadius: 8 }} options={roles.map(r => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        title={`重置密码 — ${pwdUser?.username || ''}`}
        open={pwdModalOpen}
        onOk={handleResetPwd}
        onCancel={() => setPwdModalOpen(false)}
        okText="确认重置"
        cancelText="取消"
        okButtonProps={{ style: { borderRadius: 8, background: T_COLOR.primary } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码', min: 6 }]}>
            <Input.Password placeholder="至少6位" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
