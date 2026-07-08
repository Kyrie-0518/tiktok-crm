import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Typography, message, Modal, Row, Col, Space } from 'antd';
import {
  SafetyOutlined, CheckCircleOutlined, SyncOutlined,
  PlusOutlined, WarningOutlined, ClockCircleOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;
const BRAND = '#2563eb';

interface AdAccount {
  id: string;
  account_name: string;
  account_id: string;
  platform: string;
  status: 'authorized' | 'expired' | 'pending';
  bound_shops: number;
  bound_campaigns: number;
  last_sync: string;
  spend_today: number;
}

const AdAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      // TODO: 接入真实API
      const mock: AdAccount[] = [
        { id: '1', account_name: '主投放账户', account_id: '7123456789012345678', platform: 'TikTok', status: 'authorized', bound_shops: 3, bound_campaigns: 12, last_sync: '5分钟前', spend_today: 850.5 },
        { id: '2', account_name: '测试账户', account_id: '7234567890123456789', platform: 'TikTok', status: 'authorized', bound_shops: 1, bound_campaigns: 3, last_sync: '1小时前', spend_today: 120.0 },
        { id: '3', account_name: '东南亚投放', account_id: '7345678901234567890', platform: 'TikTok', status: 'expired', bound_shops: 2, bound_campaigns: 5, last_sync: '昨天', spend_today: 0 },
      ];
      setAccounts(mock);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    message.loading({ content: '同步中...', key: 'sync' });
    setTimeout(() => {
      setSyncing(null);
      message.success({ content: '同步完成', key: 'sync' });
      loadAccounts();
    }, 2000);
  };

  const handleAuth = () => {
    message.info('跳转至 TikTok 授权页面（待接入）');
  };

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    authorized: { color: 'green', icon: <CheckCircleOutlined />, text: '已授权' },
    expired: { color: 'orange', icon: <WarningOutlined />, text: '已过期' },
    pending: { color: 'default', icon: <ClockCircleOutlined />, text: '待授权' },
  };

  const columns = [
    {
      title: '账户信息', key: 'info', width: 200,
      render: (_: any, record: AdAccount) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{record.account_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.account_id}</Text>
        </div>
      ),
    },
    {
      title: '平台', dataIndex: 'platform', key: 'platform', width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => {
        const cfg = statusConfig[v];
        return <Tag icon={cfg?.icon} color={cfg?.color}>{cfg?.text}</Tag>;
      },
    },
    {
      title: '关联店铺', dataIndex: 'bound_shops', key: 'shops', width: 90, align: 'center',
      render: (v: number) => <Text strong>{v} 家</Text>,
    },
    {
      title: '系列数', dataIndex: 'bound_campaigns', key: 'campaigns', width: 80, align: 'center',
      render: (v: number) => <Text>{v}</Text>,
    },
    {
      title: '今日花费', dataIndex: 'spend_today', key: 'spend', width: 110, align: 'right',
      render: (v: number) => <Text strong style={{ color: v > 0 ? BRAND : '#94a3b8' }}>${v.toLocaleString()}</Text>,
    },
    {
      title: '最近同步', dataIndex: 'last_sync', key: 'last_sync', width: 100, align: 'center',
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: any, record: AdAccount) => (
        <Space size="small">
          <Button
            size="small"
            icon={<SyncOutlined spin={syncing === record.id} />}
            onClick={() => handleSync(record.id)}
            loading={syncing === record.id}
            style={{ borderRadius: 6 }}
          >
            同步
          </Button>
          {record.status === 'expired' && (
            <Button size="small" type="primary" ghost onClick={handleAuth} style={{ borderRadius: 6, borderColor: BRAND, color: BRAND }}>
              重新授权
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* 标题区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${BRAND}, #60a5fa)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SafetyOutlined style={{ color: '#fff', fontSize: 16 }} />
        </div>
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0, color: '#1e293b' }}>账户授权</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>管理 TikTok Ads 广告账户，授权后可自动获取投放数据</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAuth} style={{ borderRadius: 8 }}>
          添加账户
        </Button>
      </div>

      {/* 账户列表 */}
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Table
          dataSource={accounts}
          columns={columns as any}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
          style={{ borderRadius: 8 }}
        />
      </Card>
    </div>
  );
};

export default AdAccounts;
