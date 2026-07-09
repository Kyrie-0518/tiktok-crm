import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Space, Typography, message, Spin, Badge, Select } from 'antd';
import { SafetyOutlined, ReloadOutlined, CheckCircleOutlined, SyncOutlined, WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api';

const { Text, Title } = Typography;
const PRIMARY = '#2563eb';

interface AdAccount {
  advertiser_id: string;
  advertiser_name: string;
  status: string;
  balance_info?: { balance: number; email?: string; currency?: string };
}

const AdAccounts: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/ad-center/advertisers');
      if (res.data?.success) {
        setAccounts(res.data.data || []);
      } else {
        message.error('加载失败: ' + res.data?.error);
      }
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const totalBalance = accounts.reduce((s, a) => s + (Number(a.balance_info?.balance) || 0), 0);
  const activeCount = accounts.filter(a => a.status === 'ACTIVE' || a.status === 'APPROVED').length;

  const columns: ColumnsType<AdAccount> = [
    { title: '账户名称', dataIndex: 'advertiser_name', key: 'name', width: 200, fixed: 'left',
      render: (name: string, r) => <Text strong>{name || r.advertiser_id}</Text> },
    { title: '账户ID', dataIndex: 'advertiser_id', key: 'id', width: 200, render: (id: string) => <Text code>{id}</Text> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 120,
      render: (s: string) => {
        const isActive = s === 'ACTIVE' || s === 'APPROVED';
        return <Tag icon={isActive ? <CheckCircleOutlined /> : <WarningOutlined />} color={isActive ? 'green' : 'orange'}>{s}</Tag>;
      } },
    { title: '余额', dataIndex: 'balance_info', key: 'balance', width: 160,
      render: (b: any) => <Text strong style={{ color: b?.balance > 0 ? PRIMARY : '#ef4444' }}>
        ${Number(b?.balance || 0).toFixed(2)} {b?.currency || ''}
      </Text> },
    { title: '邮箱', dataIndex: 'balance_info', key: 'email', width: 220,
      render: (b: any) => b?.email || '-' },
    { title: '操作', key: 'action', width: 120, fixed: 'right',
      render: () => <Button icon={<SyncOutlined />} size="small" type="link" style={{ color: PRIMARY }}>同步数据</Button> },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${PRIMARY}, #6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SafetyOutlined style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <Title level={4} style={{ margin: 0, color: '#1e293b' }}>账户授权</Title>
          </div>
          <Text type="secondary">TikTok for Business 广告账户管理与授权同步</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadAccounts} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
      </div>

      {loading ? <Spin size="large" style={{ display: 'block', margin: '40px auto' }} /> : (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <Card style={{ flex: 1, borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>账户总数</Text>
              <div style={{ fontSize: 24, fontWeight: 700, color: PRIMARY }}>{accounts.length}</div>
            </Card>
            <Card style={{ flex: 1, borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>活跃账户</Text>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>
                <Badge status="success" /> {activeCount}
              </div>
            </Card>
            <Card style={{ flex: 1, borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>总余额</Text>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>${totalBalance.toFixed(2)}</div>
            </Card>
          </div>

          {/* Table */}
          <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Table columns={columns} dataSource={accounts} rowKey="advertiser_id"
              size="middle" scroll={{ x: 1020 }} pagination={{ pageSize: 20 }} />
          </Card>
        </>
      )}
    </div>
  );
};

export default AdAccounts;
