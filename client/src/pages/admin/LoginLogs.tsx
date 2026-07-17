import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, Tag, Space, Button } from 'antd';
import { LoginOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../../api';

const { Text } = Typography;

const T_COLOR = {
  primary: '#4568FF', cardShadow: '0 8px 24px rgba(15,23,42,0.06)',
  cardBorder: '#EEF1F6', cardRadius: 20,
  textPrimary: '#172033', textSecondary: '#64748B', textTertiary: '#94A3B8',
};

interface LoginRecord {
  username: string; display_name: string; identity: string;
  last_login_at: string; last_login_ip: string; last_user_agent: string;
}

export default function LoginLogs() {
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/users');
      const users = (res.data || []) as any[];
      // Sort by last_login_at desc, filter out never-logged-in
      const sorted = users
        .filter((u: any) => u.last_login_at)
        .sort((a: any, b: any) => (b.last_login_at || '').localeCompare(a.last_login_at || ''))
        .map((u: any) => ({
          username: u.username,
          display_name: u.display_name || u.username,
          identity: u.identity,
          last_login_at: u.last_login_at,
          last_login_ip: u.last_login_ip || '—',
          last_user_agent: u.last_user_agent || '—',
        }));
      setRecords(sorted);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const columns = [
    {
      title: '账号', dataIndex: 'username', width: 200,
      render: (v: string, r: LoginRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LoginOutlined style={{ color: '#22C55E', fontSize: 14 }} />
          <Text strong style={{ fontSize: 13, color: T_COLOR.textPrimary }}>{v}</Text>
          {r.identity === 'SUPER_ADMIN' && (
            <Tag color="gold" style={{ borderRadius: 4, fontSize: 10, padding: '0 5px', lineHeight: '16px', margin: 0 }}>超级管理</Tag>
          )}
        </div>
      ),
    },
    {
      title: '登录时间', dataIndex: 'last_login_at', width: 160,
      render: (v: string) => <Text style={{ fontSize: 12, color: T_COLOR.textSecondary }}>{v.slice(0, 16)}</Text>,
    },
    {
      title: 'IP 地址', dataIndex: 'last_login_ip', width: 150,
      render: (v: string) => <code style={{ fontSize: 12, color: T_COLOR.textTertiary, background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{v}</code>,
    },
    {
      title: '状态', width: 80,
      render: () => <Tag color="success" style={{ borderRadius: 6, border: 'none', background: '#F0FDF4', color: '#22C55E', fontSize: 11 }}><CheckCircleOutlined style={{ fontSize: 10 }} /> 成功</Tag>,
    },
    {
      title: '设备', dataIndex: 'last_user_agent', ellipsis: true,
      render: (v: string) => <Text style={{ fontSize: 11, color: T_COLOR.textTertiary }}>{v.length > 60 ? v.slice(0, 60) + '...' : v}</Text>,
    },
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong style={{ fontSize: 15, color: T_COLOR.textPrimary }}>登录日志</Text>
            <Text style={{ fontSize: 12, color: T_COLOR.textTertiary, marginLeft: 8 }}>共 {records.length} 条记录</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadData} size="small" style={{ borderRadius: 8 }}>刷新</Button>
        </div>
      }
      style={{ borderRadius: T_COLOR.cardRadius, border: `1px solid ${T_COLOR.cardBorder}`, boxShadow: T_COLOR.cardShadow }}
      bodyStyle={{ padding: 0 }}
    >
      <Table
        dataSource={records}
        rowKey="username"
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: false }}
        size="middle"
      />
    </Card>
  );
}
