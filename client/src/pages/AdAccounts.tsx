import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Space, Typography, message, Spin, Badge, Alert } from 'antd';
import { SafetyOutlined, ReloadOutlined, CheckCircleOutlined, SyncOutlined, WarningOutlined, LinkOutlined } from '@ant-design/icons';
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

interface AuthStatus {
  hasToken: boolean;
  advertiserIds: string[];
}

const AdAccounts: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  const loadAuthStatus = useCallback(async () => {
    try {
      const res = await api.get('/tiktok-ads/token-status');
      setAuthStatus(res.data);
    } catch (e: any) {
      console.error('加载授权状态失败:', e);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/ad-center/advertisers');
      if (res.data?.success) {
        setAccounts(res.data.data || []);
        if (res.data.unauthorized) {
          message.info(res.data.message || 'TikTok Ads 尚未授权');
        }
      } else {
        message.error('加载失败: ' + res.data?.error);
      }
    } catch (e: any) {
      message.error('加载失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAuthStatus(); loadAccounts(); }, [loadAuthStatus, loadAccounts]);

  const handleAuthorize = async () => {
    setAuthLoading(true);
    try {
      const res = await api.get('/tiktok-ads/auth-url');
      if (res.data?.success && res.data.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        message.error('获取授权链接失败');
      }
    } catch (e: any) {
      message.error('获取授权链接失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setAuthLoading(false);
    }
  };

  const totalBalance = accounts.reduce((s, a) => s + (Number(a.balance_info?.balance) || 0), 0);
  const activeCount = accounts.filter(a => a.status === 'ACTIVE' || a.status === 'APPROVED').length;
  const isAuthorized = authStatus?.hasToken ?? accounts.length > 0;

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
        <Space>
          {isAuthorized ? (
            <Tag icon={<CheckCircleOutlined />} color="success">已授权</Tag>
          ) : (
            <Tag icon={<WarningOutlined />} color="warning">未授权</Tag>
          )}
          <Button type="primary" icon={<LinkOutlined />} loading={authLoading} onClick={handleAuthorize} style={{ borderRadius: 8 }}>
            一键授权 TikTok Ads
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => { loadAuthStatus(); loadAccounts(); }} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
        </Space>
      </div>

      {!isAuthorized && (
        <Alert
          message="TikTok Ads 尚未授权"
          description="请点击右上角「一键授权 TikTok Ads」按钮，在弹出的 TikTok 页面登录并授权。授权成功后刷新本页面即可查看广告账户。"
          type="warning"
          showIcon
          style={{ marginBottom: 20, borderRadius: 12 }}
        />
      )}

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
              size="middle" scroll={{ x: 1020 }} pagination={{ pageSize: 20 }}
              locale={{ emptyText: '暂无授权账户，请先点击右上角「一键授权」' }} />
          </Card>
        </>
      )}
    </div>
  );
};

export default AdAccounts;
