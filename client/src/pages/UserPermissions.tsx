import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message,
  Tag, Checkbox, Divider, Spin, Typography,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined, SafetyCertificateOutlined, TeamOutlined,
  UserOutlined, ReloadOutlined, LockOutlined,
} from '@ant-design/icons';
import api from '../api';

const { Text } = Typography;
const BRAND = '#2563eb';

const MENU_MODULES = [
  { key: 'ai-analysis', label: 'AI智能分析' },
  { key: 'ai-creation', label: 'AI智创中心' },
  { key: 'seedance-video', label: 'AI视频生成' },
  { key: 'seedance-model-config', label: '视频模型配置' },
  { key: 'products', label: '产品管理' },
  { key: 'shops', label: '店铺管理' },
  { key: 'orders', label: '订单管理' },
  { key: 'finance', label: '利润核算' },
  { key: 'influencers', label: '达人BD' },
  { key: 'settings-config', label: '系统配置' },
  { key: 'settings-permissions', label: '用户与权限' },
  { key: 'backup', label: '数据备份' },
  { key: 'user-mgmt', label: '用户管理' },
];

interface Role {
  id: number;
  name: string;
  role_key: string;
  description: string;
  permissions: string;
}

interface User {
  id: number;
  username: string;
  display_name: string;
  role_id: number;
  role_key: string;
  created_at: string;
}

/* ========== Role Management Card ========== */
function RolePanel({
  roles,
  loading,
  onRefresh,
}: {
  roles: Role[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [perms, setPerms] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isFixed = useCallback((r: Role) => !!r.role_key, []);

  const openModal = useCallback((role?: Role) => {
    if (role) {
      if (role.role_key === 'developer') {
        message.info('开发者角色权限为全开放，无需编辑');
        return;
      }
      setEditRole(role);
      setName(role.name);
      setDesc(role.description || '');
      try { setPerms(JSON.parse(role.permissions || '{}')); } catch { setPerms({}); }
    } else {
      setEditRole(null);
      setName('');
      setDesc('');
      const defaults: Record<string, string> = {};
      MENU_MODULES.forEach(m => { defaults[m.key] = 'read'; });
      setPerms(defaults);
    }
    setOpen(true);
  }, []);

  const toggle = useCallback((key: string, level: 'read' | 'edit') => {
    setPerms(prev => {
      const next = { ...prev };
      const cur = next[key] || '';
      if (level === 'edit') {
        next[key] = cur === 'edit' ? '' : 'edit';
      } else {
        next[key] = cur === 'read' ? '' : 'read';
      }
      if (next[key] === '') delete next[key];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { message.warning('角色名称必填'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: desc.trim(), permissions: JSON.stringify(perms) };
      if (editRole) {
        await api.put(`/auth/roles/${editRole.id}`, payload);
        message.success('角色已更新');
      } else {
        await api.post('/auth/roles', payload);
        message.success('角色已创建');
      }
      setOpen(false);
      onRefresh();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally {
      setSaving(false);
    }
  }, [name, desc, perms, editRole, onRefresh]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await api.delete(`/auth/roles/${id}`);
      message.success('角色已删除');
      onRefresh();
    } catch (e: any) {
      message.error(e.response?.data?.error || '删除失败');
    }
  }, [onRefresh]);

  const columns = useMemo(() => [
    {
      title: '角色名称', dataIndex: 'name', width: 150,
      render: (v: string, r: Role) => (
        <Space>
          {isFixed(r) && <LockOutlined style={{ color: '#faad14', fontSize: 12 }} />}
          <strong>{v}</strong>
          {isFixed(r) && <Tag color="orange" style={{ fontSize: 11 }}>固定</Tag>}
        </Space>
      ),
    },
    {
      title: '角色标识', dataIndex: 'role_key', width: 100,
      render: (v: string) => v ? <Tag>{v}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: '描述', dataIndex: 'description', width: 200,
      render: (v: string) => v || <Text type="secondary">-</Text>,
    },
    {
      title: '权限概览', key: 'perms', width: 300,
      render: (_: any, r: Role) => {
        try {
          const p = JSON.parse(r.permissions || '{}');
          const isDev = r.role_key === 'developer' || p.all === 'edit';
          const editCount = Object.values(p).filter((v: any) => v === 'edit').length;
          const readCount = Object.values(p).filter((v: any) => v === 'read').length;
          const noneCount = isDev ? 0 : MENU_MODULES.length - editCount - readCount;
          return (
            <Space size={4}>
              <Tag color="green">{isDev ? MENU_MODULES.length : editCount} 编辑</Tag>
              <Tag color="blue">{readCount} 阅读</Tag>
              {noneCount > 0 && <Tag>{noneCount} 无权限</Tag>}
            </Space>
          );
        } catch { return <Text type="secondary">-</Text>; }
      },
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: any, r: Role) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} disabled={r.role_key === 'developer'}>编辑</Button>
          {!isFixed(r) && (
            <Popconfirm title="确定删除此角色？" description="请确保没有用户使用此角色" onConfirm={() => handleDelete(r.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [isFixed, openModal, handleDelete]);

  return (
    <>
      <Card
        title={<Space><SafetyOutlined style={{ color: BRAND }} />角色权限配置</Space>}
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={onRefresh}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>新增角色</Button>
          </Space>
        }
      >
        <Table dataSource={roles} columns={columns} rowKey="id" loading={loading} size="small" pagination={false} />
      </Card>

      <Modal
        title={editRole ? `编辑角色 - ${editRole.name}` : '新增角色'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okText="保存"
        confirmLoading={saving}
        width={600}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item label="角色名称" required>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="如：运营专员" disabled={!!editRole?.role_key} />
          </Form.Item>
          <Form.Item label="描述">
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="角色描述（可选）" />
          </Form.Item>
        </Form>

        <Divider style={{ margin: '12px 0 16px' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>权限配置</Text>
        </Divider>

        <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '12px 16px', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #e8e8e8' }}>
            <Text strong style={{ color: '#666', fontSize: 13 }}>模块</Text>
            <Text strong style={{ textAlign: 'center', color: '#666', fontSize: 13 }}>阅读</Text>
            <Text strong style={{ textAlign: 'center', color: '#666', fontSize: 13 }}>编辑</Text>
          </div>
          {MENU_MODULES.map(m => {
            const cur = perms[m.key] || '';
            return (
              <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f5f5f5', alignItems: 'center' }}>
                <Text style={{ fontSize: 13 }}>{m.label}</Text>
                <div style={{ textAlign: 'center' }}>
                  <Checkbox checked={cur === 'read' || cur === 'edit'} disabled={cur === 'edit'} onChange={() => toggle(m.key, 'read')} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Checkbox checked={cur === 'edit'} onChange={() => toggle(m.key, 'edit')} />
                </div>
              </div>
            );
          })}
        </div>
        <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
          「编辑」权限包含「阅读」权限，开启编辑后阅读自动勾选
        </Text>
      </Modal>
    </>
  );
}

/* ========== User Management Card ========== */
function UserPanel({
  roles,
  users,
  loading,
  onRefresh,
}: {
  roles: Role[];
  users: User[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  // Edit form
  const [editName, setEditName] = useState('');
  const [editRoleId, setEditRoleId] = useState<number | undefined>(undefined);
  // Create form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoleId, setNewRoleId] = useState<number>(3);
  // Reset form
  const [newPw, setNewPw] = useState('');

  const assignableRoles = useMemo(() => roles.filter(r => r.role_key !== 'developer'), [roles]);

  const getRoleName = useCallback((roleId: number | null) => {
    if (!roleId) return <Tag color="default">未分配</Tag>;
    const role = roles.find(r => r.id === roleId);
    return role ? <Tag color="blue">{role.name}</Tag> : <Tag color="default">未知</Tag>;
  }, [roles]);

  const openEdit = useCallback((user: User) => {
    setEditUser(user);
    setEditName(user.display_name || '');
    setEditRoleId(user.role_id || undefined);
    setEditOpen(true);
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editUser) return;
    try {
      await api.put(`/auth/users/${editUser.id}`, { display_name: editName, role_id: editRoleId });
      message.success('用户信息已更新');
      setEditOpen(false);
      onRefresh();
    } catch (e: any) {
      message.error(e.response?.data?.error || '更新失败');
    }
  }, [editUser, editName, editRoleId, onRefresh]);

  const handleCreate = useCallback(async () => {
    if (!newUsername.trim() || !newPassword) { message.warning('账号和密码必填'); return; }
    if (newPassword.length < 6) { message.warning('密码至少6位'); return; }
    try {
      await api.post('/auth/register', { username: newUsername.trim(), password: newPassword, role_id: newRoleId });
      message.success('用户创建成功');
      setCreateOpen(false);
      onRefresh();
    } catch (e: any) {
      message.error(e.response?.data?.error || '创建失败');
    }
  }, [newUsername, newPassword, newRoleId, onRefresh]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await api.delete(`/auth/users/${id}`);
      message.success('用户已删除');
      onRefresh();
    } catch (e: any) {
      message.error(e.response?.data?.error || '删除失败');
    }
  }, [onRefresh]);

  const openReset = useCallback((user: User) => {
    setResetUser(user);
    setNewPw('');
    setResetOpen(true);
  }, []);

  const handleReset = useCallback(async () => {
    if (!newPw) { message.warning('请输入新密码'); return; }
    if (newPw.length < 6) { message.warning('密码至少6位'); return; }
    try {
      await api.put(`/auth/users/${resetUser!.id}/reset-password`, { newPassword: newPw });
      message.success(`${resetUser!.username} 的密码已重置`);
      setResetOpen(false);
    } catch (e: any) {
      message.error(e.response?.data?.error || '重置失败');
    }
  }, [newPw, resetUser]);

  const columns = useMemo(() => [
    {
      title: '账号', dataIndex: 'username', width: 150,
      render: (v: string) => <Space><UserOutlined /><span>{v}</span></Space>,
    },
    {
      title: '显示名称', dataIndex: 'display_name', width: 120,
      render: (v: string) => v || <Text type="secondary">-</Text>,
    },
    {
      title: '角色', dataIndex: 'role_id', width: 140,
      render: (v: number, r: User) => (
        <Space>
          {getRoleName(v)}
          {r.role_key === 'developer' && <Tag color="gold" style={{ fontSize: 11 }}>最高权限</Tag>}
        </Space>
      ),
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 120,
      render: (v: string) => v ? v.slice(0, 10) : '-',
    },
    {
      title: '操作', key: 'action', width: 200,
      render: (_: any, r: User) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Button type="link" size="small" onClick={() => openReset(r)}>重置密码</Button>
          {r.role_key !== 'developer' && (
            <Popconfirm title="确定删除此用户？" onConfirm={() => handleDelete(r.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [getRoleName, openEdit, openReset, handleDelete]);

  return (
    <>
      <Card
        title={<Space><TeamOutlined style={{ color: BRAND }} />子账号管理</Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setNewUsername(''); setNewPassword(''); setNewRoleId(3); setCreateOpen(true); }}>新增子账号</Button>}
      >
        <Table dataSource={users} columns={columns} rowKey="id" loading={loading} size="small" pagination={false} />
      </Card>

      {/* Edit User */}
      <Modal title="编辑用户" open={editOpen} onCancel={() => setEditOpen(false)} onOk={handleEditSubmit} okText="保存" destroyOnClose>
        <Form layout="vertical">
          <Form.Item label="账号"><Input value={editUser?.username} disabled /></Form.Item>
          <Form.Item label="显示名称"><Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="可选，用于界面展示" /></Form.Item>
          <Form.Item label="分配角色">
            <Select value={editRoleId} onChange={setEditRoleId} allowClear placeholder="选择角色"
              options={assignableRoles.map(r => ({ value: r.id, label: `${r.name} - ${r.description || '无描述'}` }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create User */}
      <Modal title="新增子账号" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={handleCreate} okText="创建" destroyOnClose>
        <Form layout="vertical">
          <Form.Item label="账号" required><Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="请输入登录账号" /></Form.Item>
          <Form.Item label="密码" required><Input.Password value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="请输入密码（至少6位）" /></Form.Item>
          <Form.Item label="分配角色">
            <Select value={newRoleId} onChange={setNewRoleId} placeholder="选择角色"
              options={assignableRoles.map(r => ({ value: r.id, label: `${r.name} - ${r.description || '无描述'}` }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Password */}
      <Modal title={`重置密码 - ${resetUser?.username || ''}`} open={resetOpen} onCancel={() => setResetOpen(false)} onOk={handleReset} okText="确认重置" destroyOnClose>
        <Form layout="vertical">
          <Form.Item label="新密码" required><Input.Password value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="请输入新密码（至少6位）" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

/* ========== Main Page ========== */
export default function UserPermissions() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rolesRes, usersRes] = await Promise.all([
        api.get('/auth/roles'),
        api.get('/auth/users'),
      ]);
      setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (e: any) {
      setError(e.response?.data?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Text type="danger" style={{ fontSize: 16 }}>{error}</Text>
        <br />
        <Button style={{ marginTop: 16 }} onClick={loadData}>重试</Button>
      </div>
    );
  }

  if (loading && roles.length === 0) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" tip="加载中..." /></div>;
  }

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18,
        }}>
          <SafetyCertificateOutlined />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>角色权限管理</h2>
          <span style={{ fontSize: 12, color: '#999' }}>角色配置 · 用户分配 · 权限控制</span>
        </div>
      </div>
      <RolePanel roles={roles} loading={loading} onRefresh={loadData} />
      <UserPanel roles={roles} users={users} loading={loading} onRefresh={loadData} />
    </div>
  );
}
