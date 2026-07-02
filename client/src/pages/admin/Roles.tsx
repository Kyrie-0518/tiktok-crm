import React from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Popconfirm, message, Radio, Divider, Tooltip } from 'antd';
import {
  PlusOutlined, DeleteOutlined, SafetyOutlined, TeamOutlined, ReloadOutlined,
  LockOutlined, UserOutlined, DownOutlined, RightOutlined,
} from '@ant-design/icons';
import api from '../../api';

const PERM_CATEGORIES = [
  {
    label: '📊 业务管理',
    items: [
      { key: 'dashboard', label: '仪表盘' },
      { key: 'shops', label: '店铺管理' },
      { key: 'products', label: '产品管理' },
      { key: 'orders', label: '订单管理' },
      { key: 'finance', label: '利润核算' },
      { key: 'influencers', label: '达人BD' },
    ],
  },
  {
    label: '🤖 AI智能',
    items: [
      { key: 'ai-video', label: 'AI智创视频' },
      { key: 'seedance-video', label: '  └ AI视频生成' },
      { key: 'material-library', label: '  └ 素材库' },
      { key: 'raw-materials', label: '  └ 原料素材' },
      { key: 'seedance-model-config', label: '  └ 视频模型配置' },
      { key: 'ai-analysis', label: 'AI智能分析' },
      { key: 'skiis', label: 'SKIIS分析' },
    ],
  },
  {
    label: '⚙️ 系统管理',
    items: [
      { key: 'settings-config', label: '系统配置' },
      { key: 'settings-permissions', label: '用户与权限' },
      { key: 'audit-logs', label: '操作日志' },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  developer: 'red',
  manager: 'blue',
  staff: 'geekblue',
};

export default function AdminRoles() {
  const [roles, setRoles] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = React.useState<React.Key[]>([]);

  // Modal states
  const [roleModalOpen, setRoleModalOpen] = React.useState(false);
  const [permModalOpen, setPermModalOpen] = React.useState(false);
  const [userModalOpen, setUserModalOpen] = React.useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = React.useState(false);

  const [editingRole, setEditingRole] = React.useState<any>(null);
  const [editPerms, setEditPerms] = React.useState<Record<string, string>>({});
  const [permDeptFilter, setPermDeptFilter] = React.useState<string>('all');

  const [roleForm] = Form.useForm();
  const [userForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get('/auth/roles'),
        api.get('/admin/users'),
      ]);
      setRoles(r1.data || []);
      setUsers(r2.data || []);
    } finally { setLoading(false); }
  };
  React.useEffect(() => { loadData(); }, []);

  // ── 角色操作 ──
  const openNewRole = () => { setEditingRole(null); roleForm.resetFields(); setRoleModalOpen(true); };
  const openEditRole = (r: any) => { setEditingRole(r); roleForm.setFieldsValue({ name: r.name, description: r.description }); setRoleModalOpen(true); };
  const handleRoleSubmit = async (v: any) => {
    if (editingRole) { await api.put(`/auth/roles/${editingRole.id}`, v); message.success('已更新'); }
    else { await api.post('/auth/roles', v); message.success('已创建'); }
    setRoleModalOpen(false); loadData();
  };
  const handleDeleteRole = async (id: number) => { await api.delete(`/auth/roles/${id}`); message.success('已删除'); loadData(); };

  // ── 权限分配 ──
  const openPermModal = (r: any) => {
    setEditingRole(r);
    setPermDeptFilter('all');
    const perms: Record<string, string> = {};
    try { Object.assign(perms, JSON.parse(r.permissions || '{}')); } catch {}
    setEditPerms(perms);
    setPermModalOpen(true);
  };
  const handleSavePerms = async () => {
    await api.put(`/auth/roles/${editingRole.id}`, { permissions: JSON.stringify(editPerms) });
    setPermModalOpen(false); message.success('权限已保存'); loadData();
  };

  // ── 用户操作 ──
  const openNewUser = () => { userForm.resetFields(); setUserModalOpen(true); };
  const handleCreateUser = async (v: any) => {
    await api.post('/auth/register', v);
    setUserModalOpen(false); message.success('创建成功'); loadData();
  };
  const handleDeleteUser = async (id: number) => { await api.delete(`/auth/users/${id}`); message.success('删除成功'); loadData(); };
  const handleChangePassword = async (v: any) => {
    await api.put('/auth/password', v);
    setPasswordModalOpen(false); passwordForm.resetFields(); message.success('密码修改成功');
  };

  // ── 表格数据 ──
  const roleWithStats = (Array.isArray(roles) ? roles : []).map(role => {
    const _users = (Array.isArray(users) ? users : []).filter((u: any) => u.role_id === role.id);
    return { ...role, user_count: _users.length, _users };
  });

  const expandedRowRender = (role: any) => {
    const roleUsers = role._users || [];
    if (roleUsers.length === 0) {
      return <div style={{ padding: '12px 24px', color: '#94a3b8', fontSize: 13, background: '#fafafa', borderRadius: 6, margin: '0 0 8px 0' }}>该角色下暂无账号，点击上方「新增账号」添加</div>;
    }
    return (
      <Table dataSource={roleUsers} rowKey="id" size="small" pagination={false}
        style={{ margin: '0 0 8px 0' }}
        columns={[
          { title: '账号', dataIndex: 'username', width: 150,
            render: (v: string) => <span style={{ fontWeight: 500, color: '#1f2937' }}><UserOutlined style={{ marginRight: 6, color: '#94a3b8' }} />{v}</span>
          },
          { title: '创建时间', dataIndex: 'created_at', width: 120, render: (v: string) => v?.slice(0, 10) },
          { title: '操作', width: 80, render: (_: any, r: any) => (
            <Popconfirm title="确定删除此账号？" onConfirm={() => handleDeleteUser(r.id)}>
              <Button size="small" type="link" danger icon={<DeleteOutlined />}
                style={{ fontSize: 12, padding: '0 4px' }} disabled={r.role_key === 'developer'} />
            </Popconfirm>
          )},
        ]}
      />
    );
  };

  return (
    <div style={{ padding: 24 }}>
      {/* ══ 页面标题 ══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SafetyOutlined style={{ fontSize: 18, color: '#fff' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>角色与账号</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '2px 0 0' }}>全局权限中心 · 角色-权限-账号一体化管理</p>
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => setPasswordModalOpen(true)}>修改密码</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openNewRole}>新增角色</Button>
          <Button icon={<PlusOutlined />} onClick={openNewUser}>新增账号</Button>
        </Space>
      </div>

      {/* ══ 角色展开表格 ══ */}
      <Card style={{ borderRadius: 10, marginTop: 16 }} bodyStyle={{ padding: 0 }}>
        <Table dataSource={roleWithStats} rowKey="id" loading={loading} size="middle" pagination={false}
          expandable={{
            expandedRowRender, expandedRowKeys,
            onExpandedRowsChange: (keys: any) => setExpandedRowKeys(keys),
            expandIcon: ({ expanded, onExpand, record }) => {
              if (!record._users || record._users.length === 0) return <span style={{ display: 'inline-block', width: 24 }} />;
              return expanded
                ? <DownOutlined onClick={e => onExpand(record, e)} style={{ cursor: 'pointer', fontSize: 12, color: '#64748b' }} />
                : <RightOutlined onClick={e => onExpand(record, e)} style={{ cursor: 'pointer', fontSize: 12, color: '#64748b' }} />;
            },
          }}
          columns={[
            {
              title: '角色名称', dataIndex: 'name', width: 180,
              render: (v: string, r: any) => {
                const color = ROLE_COLORS[r.role_key] || 'default';
                return (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600,
                      background: r.role_key === 'developer' ? '#fef2f2' : r.role_key === 'manager' ? '#eff6ff' : '#f0fdf4',
                      color: r.role_key === 'developer' ? '#dc2626' : r.role_key === 'manager' ? '#2563eb' : '#059669',
                    }}><TeamOutlined /></div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{v}</div>
                      {r.role_key && <Tag color={color} style={{ fontSize: 11, lineHeight: '16px', marginTop: 2 }}>{r.role_key}</Tag>}
                    </div>
                  </span>
                );
              },
            },
            { title: '描述', dataIndex: 'description', ellipsis: true,
              render: (v: string) => <span style={{ color: v ? '#475569' : '#d1d5db', fontSize: 13 }}>{v || '暂无描述'}</span> },
            {
              title: '账号数', dataIndex: 'user_count', width: 80, align: 'center',
              render: (v: number, r: any) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 22, borderRadius: 11,
                  background: v > 0 ? '#eff6ff' : '#f9fafb', color: v > 0 ? '#2563eb' : '#d1d5db', fontSize: 13, fontWeight: 600, cursor: v > 0 ? 'pointer' : 'default' }}
                  onClick={() => { if (v > 0) setExpandedRowKeys(prev => prev.includes(r.id) ? prev.filter(k => k !== r.id) : [...prev, r.id]); }}>
                  {v}
                </span>
              ),
            },
            {
              title: '操作', width: 200,
              render: (_: any, r: any) => (
                <Space size={4}>
                  <Button size="small" onClick={() => openEditRole(r)}>编辑</Button>
                  {r.role_key === 'developer' ? (
                    <Tooltip title="开发者拥有全部权限，无需配置">
                      <Button size="small" icon={<LockOutlined />} disabled>权限</Button>
                    </Tooltip>
                  ) : (
                    <Button size="small" icon={<LockOutlined />} onClick={() => openPermModal(r)}>权限</Button>
                  )}
                  <Popconfirm title="确定删除？" onConfirm={() => handleDeleteRole(r.id)} disabled={!!r.role_key}>
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={!!r.role_key} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* ═══════════ 弹窗区域 ═══════════ */}

      {/* 新增/编辑角色 */}
      <Modal title={editingRole ? '编辑角色' : '新增角色'} open={roleModalOpen} onCancel={() => setRoleModalOpen(false)} onOk={() => roleForm.submit()}>
        <Form form={roleForm} layout="vertical" onFinish={handleRoleSubmit}>
          <Form.Item name="name" label="角色名称" rules={[{ required: true }]}>
            <Input placeholder="如: 运营主管" disabled={!!editingRole?.role_key} />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input placeholder="角色说明" /></Form.Item>
        </Form>
      </Modal>

      {/* 权限分配 */}
      <Modal
        title={null}
        open={permModalOpen}
        onCancel={() => setPermModalOpen(false)}
        onOk={handleSavePerms}
        width={620}
        bodyStyle={{ padding: 0 }}
      >
        {/* 头部 */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LockOutlined style={{ color: '#2563eb', fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>{editingRole?.name || '角色'} · 权限配置</div>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 16px' }}>
            按模块设置该角色的访问权限
          </p>
        </div>

        {/* 权限分组列表 */}
        <div style={{ padding: '0 24px 16px', maxHeight: '50vh', overflowY: 'auto' }}>
          {PERM_CATEGORIES.map(cat => (
            <div key={cat.label} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                {cat.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {cat.items.map(m => (
                  <div key={m.key}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 8,
                      background: editPerms[m.key] ? (editPerms[m.key] === 'edit' ? '#eff6ff' : '#f0fdf4') : '#fafafa',
                      border: editPerms[m.key] ? (editPerms[m.key] === 'edit' ? '1px solid #bfdbfe' : '1px solid #bbf7d0') : '1px solid transparent',
                    }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>{m.label}</span>
                    <Radio.Group size="small" value={editPerms[m.key] || ''}
                      onChange={e => setEditPerms(prev => ({ ...prev, [m.key]: e.target.value }))}>
                      <Radio.Button value="" style={{ fontSize: 11, padding: '0 8px' }}>无</Radio.Button>
                      <Radio.Button value="read" style={{ fontSize: 11, padding: '0 8px' }}>只读</Radio.Button>
                      <Radio.Button value="edit" style={{ fontSize: 11, padding: '0 8px' }}>编辑</Radio.Button>
                    </Radio.Group>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Divider style={{ margin: 0 }} />
        <div style={{ padding: '12px 24px' }}>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
            💡 权限全局生效于该角色 · 开发者拥有全部权限无需配置
          </p>
        </div>
      </Modal>

      {/* 新增账号 */}
      <Modal title="新增账号" open={userModalOpen} onCancel={() => setUserModalOpen(false)} onOk={() => userForm.submit()}>
        <Form form={userForm} layout="vertical" onFinish={handleCreateUser}>
          <Form.Item name="username" label="账号" rules={[{ required: true }]}><Input placeholder="请输入账号" /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}><Input.Password placeholder="密码至少6位" /></Form.Item>
          <Form.Item name="role_id" label="角色" initialValue={3}>
            <Select options={(Array.isArray(roles) ? roles : []).map(r => ({ label: r.name, value: r.id }))} placeholder="选择角色" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改密码 */}
      <Modal title="修改密码" open={passwordModalOpen} onCancel={() => setPasswordModalOpen(false)} onOk={() => passwordForm.submit()}>
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
