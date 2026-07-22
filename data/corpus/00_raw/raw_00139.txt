import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Tabs, Table } from 'antd';
import { TeamOutlined, SafetyOutlined, LoginOutlined, UserOutlined } from '@ant-design/icons';
import api from '../../api';
import { todayStr } from '../../utils/time';
import Roles from './Roles';

const { Text } = Typography;

const T_COLOR = {
  primary: '#4568FF', primaryLight: '#EDF0FF',
  cardShadow: '0 8px 24px rgba(15,23,42,0.06)',
  cardBorder: '#EEF1F6', cardRadius: 20,
  textPrimary: '#172033', textSecondary: '#64748B', textTertiary: '#94A3B8',
};

interface StatData { totalUsers: number; totalRoles: number; todayLogins: number; activeUsers: number; }

/** 内联用户列表（替代已删除的 admin/Users.tsx） */
function InlineUsers() {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { api.get('/auth/users').then(r => setUsers(r.data || [])).catch(() => {}); }, []);
  return <Table rowKey="id" dataSource={users} size="small" pagination={{ pageSize: 15, size: 'small' }}
    columns={[
      { title: '用户名', dataIndex: 'username' },
      { title: '角色', dataIndex: 'role', render: (v: string) => v || '—' },
      { title: '创建时间', dataIndex: 'created_at', render: (v: string) => v?.slice(0, 10) },
    ]} />;
}

export default function AccountCenter() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<StatData>({ totalUsers: 0, totalRoles: 0, todayLogins: 0, activeUsers: 0 });

  useEffect(() => {
    if (activeTab !== 'overview') return;
    (async () => {
      try {
        const [usersRes, rolesRes] = await Promise.all([
          api.get('/auth/users'),
          api.get('/auth/roles'),
        ]);
        const users = usersRes.data || [];
        const today = todayStr();
        setStats({
          totalUsers: users.length,
          totalRoles: (rolesRes.data || []).length,
          todayLogins: users.filter((u: any) => u.last_login_at?.startsWith(today)).length,
          activeUsers: users.filter((u: any) => u.identity !== 'DISABLED').length,
        });
      } catch { /* ignore */ }
    })();
  }, [activeTab]);

  const statCards = [
    { label: '用户总数', value: stats.totalUsers, icon: <TeamOutlined />, color: '#4568FF', bg: '#EDF0FF' },
    { label: '角色数量', value: stats.totalRoles, icon: <SafetyOutlined />, color: '#8B5CF6', bg: '#F6F0FF' },
    { label: '今日登录', value: stats.todayLogins, icon: <LoginOutlined />, color: '#22C55E', bg: '#F0FDF4' },
    { label: '活跃账号', value: stats.activeUsers, icon: <UserOutlined />, color: '#F59E0B', bg: '#FFFBEB' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: `linear-gradient(135deg, #6B8CFF, ${T_COLOR.primary})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 2px 10px rgba(79,107,255,0.25)`,
          }}>
            <SafetyOutlined style={{ color: '#fff', fontSize: 19 }} />
          </div>
          <div>
            <Text strong style={{ fontSize: 18, color: T_COLOR.textPrimary, display: 'block' }}>账号中心</Text>
            <Text style={{ fontSize: 12, color: T_COLOR.textTertiary }}>管理系统登录账号与角色权限</Text>
          </div>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarStyle={{ marginBottom: 20 }}
        items={[
          {
            key: 'overview',
            label: '概览',
            children: (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  {statCards.map(s => (
                    <Col xs={12} sm={6} key={s.label}>
                      <Card
                        hoverable
                        style={{ borderRadius: T_COLOR.cardRadius, border: `1px solid ${T_COLOR.cardBorder}`, boxShadow: T_COLOR.cardShadow, height: '100%' }}
                        bodyStyle={{ padding: '18px 20px' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <Text style={{ fontSize: 12, color: T_COLOR.textTertiary }}>{s.label}</Text>
                            <div style={{ fontSize: 26, fontWeight: 700, color: T_COLOR.textPrimary, marginTop: 2, fontFamily: '"Inter", sans-serif' }}>{s.value}</div>
                          </div>
                          <div style={{ width: 42, height: 42, borderRadius: 14, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: s.color }}>{s.icon}</div>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>

                {/* Account Status */}
                <Row gutter={[16, 16]}>
                  <Col xs={12}>
                    <Card style={{ borderRadius: T_COLOR.cardRadius, border: `1px solid ${T_COLOR.cardBorder}`, boxShadow: T_COLOR.cardShadow }}
                      bodyStyle={{ padding: '20px 24px' }}>
                      <Text strong style={{ fontSize: 14, color: T_COLOR.textPrimary, marginBottom: 12, display: 'block' }}>账号状态</Text>
                      <div style={{ display: 'flex', gap: 24 }}>
                        <div><Text style={{ fontSize: 12, color: T_COLOR.textTertiary }}>正常账号</Text><div style={{ fontSize: 24, fontWeight: 700, color: '#22C55E', fontFamily: '"Inter", sans-serif' }}>{stats.activeUsers}</div></div>
                        <div><Text style={{ fontSize: 12, color: T_COLOR.textTertiary }}>禁用账号</Text><div style={{ fontSize: 24, fontWeight: 700, color: '#EF4444', fontFamily: '"Inter", sans-serif' }}>{stats.totalUsers - stats.activeUsers}</div></div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </>
            ),
          },
          {
            key: 'users',
            label: '用户管理',
            children: <InlineUsers />,
          },
          {
            key: 'roles',
            label: '角色管理',
            children: <Roles />,
          },
        ]}
      />
    </div>
  );
}
