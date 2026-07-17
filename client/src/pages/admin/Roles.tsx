import React, { useEffect, useState } from 'react';
import { Card, Button, Modal, Form, Input, Select, Checkbox, Tag, Popconfirm, message, Typography, Row, Col, Space, Divider } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyCertificateOutlined,
  ReloadOutlined, TeamOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import api from '../../api';

const { Text } = Typography;

const T_COLOR = {
  primary: '#4568FF', primaryLight: '#EDF0FF',
  cardShadow: '0 8px 24px rgba(15,23,42,0.06)',
  cardBorder: '#EEF1F6', cardRadius: 20,
  textPrimary: '#172033', textSecondary: '#64748B', textTertiary: '#94A3B8',
};

const MODULE_KEYS = [
  'dashboard', 'shops', 'products', 'orders',
  'finance', 'influencers', 'ad-dashboard',
  'ai-studio', 'kyrie', 'knowledge',
  'settings', 'admin-settings', 'admin-users', 'admin-api', 'admin-bot', 'admin-audit',
];
const MODULE_LABELS: Record<string, string> = {
  dashboard: '数据概览', shops: '店铺管理', products: '产品管理', orders: '订单管理',
  finance: '利润核算', influencers: '达人BD', 'ad-dashboard': '广告管理',
  'ai-studio': 'AI工作室', kyrie: '欧文智能体', knowledge: '知识库',
  settings: '系统设置', 'admin-settings': '系统配置', 'admin-users': '账号中心', 'admin-api': 'API管理', 'admin-bot': 'Bot管理', 'admin-audit': '操作日志',
};

interface Role { id: number; name: string; role_key: string; description: string; permissions: string; user_count?: number; }
const FIXED_KEYS = ['developer', 'manager', 'staff', 'viewer'];

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Permission config
  const [perms, setPerms] = useState<Record<string, string>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [rRes, uRes] = await Promise.all([api.get('/auth/roles'), api.get('/auth/users')]);
      const rList = rRes.data || [];
      const uList = uRes.data || [];
      // Count users per role
      const countMap: Record<number, number> = {};
      uList.forEach((u: any) => { countMap[u.role_id] = (countMap[u.role_id] || 0) + 1; });
      setRoles(rList.map((r: Role) => ({ ...r, user_count: countMap[r.id] || 0 })));
      setUsers(uList);
    } catch { message.error('加载数据失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditingRole(null);
    form.resetFields();
    setPerms({});
    setModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({ name: role.name, description: role.description });
    let p: Record<string, string> = {};
    try { p = JSON.parse(role.permissions || '{}'); } catch { /* ignore */ }
    setPerms(p);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = { ...values, permissions: JSON.stringify(perms) };
      if (editingRole) {
        await api.put(`/auth/roles/${editingRole.id}`, payload);
        message.success('角色已更新');
      } else {
        await api.post('/auth/roles', payload);
        message.success('角色已创建');
      }
      setModalOpen(false);
      loadData();
    } catch (e: any) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/auth/roles/${id}`);
      message.success('已删除');
      loadData();
    } catch (e: any) { message.error(e.response?.data?.error || '删除失败'); }
  };

  const togglePerm = (key: string, level: string) => {
    setPerms(prev => ({
      ...prev,
      [key]: prev[key] === level ? 'none' : level,
    }));
  };

  const roleColors: Record<string, string> = { developer: '#4568FF', manager: '#F59E0B', staff: '#22C55E', viewer: '#94A3B8' };

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong style={{ fontSize: 15, color: T_COLOR.textPrimary }}>角色管理</Text>
            <Text style={{ fontSize: 12, color: T_COLOR.textTertiary, marginLeft: 8 }}>共 {roles.length} 个角色</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} size="small" style={{ borderRadius: 8 }}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 10, background: T_COLOR.primary }}>
              新建角色
            </Button>
          </Space>
        </div>
      }
      style={{ borderRadius: T_COLOR.cardRadius, border: `1px solid ${T_COLOR.cardBorder}`, boxShadow: T_COLOR.cardShadow }}
      bodyStyle={{ padding: '20px 24px' }}
    >
      <Row gutter={[16, 16]}>
        {roles.map(role => {
          const color = roleColors[role.role_key] || T_COLOR.primary;
          const isFixed = FIXED_KEYS.includes(role.role_key);
          return (
            <Col xs={24} sm={12} lg={8} key={role.id}>
              <Card
                hoverable
                style={{
                  borderRadius: 16, border: `1px solid ${T_COLOR.cardBorder}`,
                  boxShadow: '0 4px 16px rgba(15,23,42,0.04)', height: '100%',
                  transition: 'all 0.2s',
                }}
                bodyStyle={{ padding: '20px 22px' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T_COLOR.cardBorder; e.currentTarget.style.transform = 'none'; }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color }}>
                      <SafetyCertificateOutlined />
                    </div>
                    <div>
                      <Text strong style={{ fontSize: 14, color: T_COLOR.textPrimary, display: 'block' }}>{role.name}</Text>
                      {isFixed && <Tag color={color} style={{ borderRadius: 4, fontSize: 10, padding: '0 6px', lineHeight: '18px', margin: 0 }}>系统内置</Tag>}
                    </div>
                  </div>
                  {!isFixed && (
                    <Space size={2}>
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(role)} style={{ color: T_COLOR.textSecondary, borderRadius: 6 }} />
                      <Popconfirm title="确认删除此角色？" onConfirm={() => handleDelete(role.id)} okType="danger">
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
                      </Popconfirm>
                    </Space>
                  )}
                </div>

                {/* Description */}
                <Text style={{ fontSize: 12, color: T_COLOR.textTertiary, display: 'block', marginBottom: 12, minHeight: 32 }}>
                  {role.description || '暂无描述'}
                </Text>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TeamOutlined style={{ fontSize: 12, color: T_COLOR.textTertiary }} />
                    <Text style={{ fontSize: 12, color: T_COLOR.textSecondary }}>{role.user_count || 0} 个用户</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AppstoreOutlined style={{ fontSize: 12, color: T_COLOR.textTertiary }} />
                    <Text style={{ fontSize: 12, color: T_COLOR.textSecondary }}>{Object.values(JSON.parse(role.permissions || '{}')).filter((v: any) => v !== 'none').length} 项权限</Text>
                  </div>
                </div>

                {/* Edit button for fixed roles */}
                {isFixed && (
                  <Button block size="small" onClick={() => openEdit(role)} style={{ borderRadius: 8, border: `1px solid ${T_COLOR.cardBorder}`, color: T_COLOR.textSecondary, fontSize: 12 }}>
                    配置权限
                  </Button>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Create / Edit Modal */}
      <Modal
        title={editingRole ? `编辑角色 — ${editingRole.name}` : '新建角色'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={editingRole ? '保存' : '创建'}
        cancelText="取消"
        width={640}
        okButtonProps={{ style: { borderRadius: 8, background: T_COLOR.primary } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如：运营主管" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="description" label="角色描述">
            <Input.TextArea placeholder="描述此角色的职责..." rows={2} style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>

        <Divider style={{ margin: '8px 0 16px' }} />
        <Text strong style={{ fontSize: 13, color: T_COLOR.textPrimary, marginBottom: 12, display: 'block' }}>菜单权限</Text>
        <Row gutter={[12, 8]}>
          {MODULE_KEYS.map(key => {
            const level = perms[key] || 'none';
            return (
              <Col xs={12} sm={8} key={key}>
                <div style={{
                  padding: '8px 12px', borderRadius: 10,
                  border: `1px solid ${level !== 'none' ? T_COLOR.primary + '30' : T_COLOR.cardBorder}`,
                  background: level !== 'none' ? T_COLOR.primaryLight : '#FAFBFC',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', transition: 'all 0.15s',
                }} onClick={() => togglePerm(key, level === 'none' ? 'read' : level === 'read' ? 'edit' : 'none')}>
                  <Text style={{ fontSize: 12, color: level !== 'none' ? T_COLOR.primary : T_COLOR.textSecondary, fontWeight: level !== 'none' ? 600 : 400 }}>
                    {MODULE_LABELS[key] || key}
                  </Text>
                  <Tag style={{
                    borderRadius: 4, fontSize: 10, padding: '0 6px', lineHeight: '18px', margin: 0,
                    background: level === 'edit' ? T_COLOR.primary : level === 'read' ? '#EEF3FF' : '#F1F5F9',
                    color: level === 'edit' ? '#fff' : level === 'read' ? T_COLOR.primary : T_COLOR.textTertiary,
                    border: 'none',
                  }}>
                    {level === 'edit' ? '编辑' : level === 'read' ? '查看' : '无'}
                  </Tag>
                </div>
              </Col>
            );
          })}
        </Row>
        <Text style={{ fontSize: 11, color: T_COLOR.textTertiary, display: 'block', marginTop: 8 }}>
          点击切换权限：无 → 查看 → 编辑 → 无（循环）
        </Text>
      </Modal>
    </Card>
  );
}
