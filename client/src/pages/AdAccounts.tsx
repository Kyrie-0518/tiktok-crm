import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Space, Typography, message, Spin, Badge, Alert } from 'antd';
import { SafetyOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, LinkOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api';

const { Text, Title } = Typography;
const PRIMARY = '#2563eb';

interface AdAccount {
  advertiser_id: string;
  advertiser_name: string;
  status: string;
  country?: string;
  balance_info?: { balance: number; currency?: string };
}

interface AuthStatus {
  hasToken: boolean;
  advertiserIds: string[];
}

// 从后端获取 TikTok Ads OAuth 配置（包含 secret，内部 ERP 使用）
async function getTikTokAdsConfig() {
  const res = await api.get('/tiktok-ads/config');
  return res.data;
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

  const refreshAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/ad-center/advertisers', { params: { refresh: '1' } });
      if (res.data?.success) {
        setAccounts(res.data.data || []);
        if (res.data.refreshed) message.success('已从 TikTok 刷新最新数据');
      }
    } catch (e: any) {
      message.error('刷新失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAuthStatus(); loadAccounts(); }, [loadAuthStatus, loadAccounts]);

  // OAuth 回调：从 URL 中读取 auth_code，浏览器直接调 TikTok 换 token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('auth_code') || params.get('code');
    if (!authCode) return;

    const exchange = async () => {
      setLoading(true);
      try {
        // 优先尝试用浏览器本地代理直接换 token
        let tokenData: any = null;
        let directError = '';
        try {
          const config = await getTikTokAdsConfig();
          const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              app_id: config.appId,
              secret: config.appSecret,
              auth_code: authCode,
              grant_type: 'authorization_code',
            }),
          });
          const json = await res.json();
          console.log('[TikTok Ads] 前端换 token 响应:', json);
          if (json.code === 0 && json.data?.access_token) {
            tokenData = json.data;
          } else {
            directError = json.message || '前端换 token 失败';
          }
        } catch (e: any) {
          directError = e.message || '前端换 token 网络错误（可能是 CORS）';
        }

        // 浏览器直接失败，回退到后端换 token
        if (!tokenData) {
          console.log('[TikTok Ads] 前端换 token 失败，回退后端:', directError);
          const res = await api.post('/tiktok-ads/exchange-code', { auth_code: authCode });
          if (res.data?.success) {
            tokenData = res.data.data;
          } else {
            throw new Error(res.data?.error || '后端换 token 失败');
          }
        }

        // 保存 token 到后端
        const saveRes = await api.post('/tiktok-ads/save-token', {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          advertiser_ids: tokenData.advertiser_ids || tokenData.advertiser_id || [],
        });
        if (saveRes.data?.success) {
          message.success('TikTok Ads 授权成功');
          window.history.replaceState({}, '', '/ad-accounts');
          loadAuthStatus();
          loadAccounts();
        } else {
          throw new Error(saveRes.data?.error || '保存 token 失败');
        }
      } catch (e: any) {
        message.error('授权失败: ' + (e.response?.data?.error || e.message));
      } finally {
        setLoading(false);
      }
    };
    exchange();
  }, [loadAuthStatus, loadAccounts]);

  const handleAuthorize = async () => {
    setAuthLoading(true);
    try {
      const config = await getTikTokAdsConfig();
      const state = 'bozone-' + Date.now();
      const authUrl = `https://business-api.tiktok.com/portal/auth?app_id=${config.appId}&state=${state}&redirect_uri=${encodeURIComponent(config.redirectUri)}`;
      window.location.href = authUrl;
    } catch (e: any) {
      message.error('获取授权配置失败: ' + (e.response?.data?.error || e.message));
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
    { title: '国家/地区', dataIndex: 'country', key: 'country', width: 120,
      render: (v: string) => v || '-' },
    { title: '余额', dataIndex: 'balance_info', key: 'balance', width: 160,
      render: (b: any) => <Text strong style={{ color: b?.balance > 0 ? PRIMARY : '#ef4444' }}>
        ${Number(b?.balance || 0).toFixed(2)} {b?.currency || ''}
      </Text> },
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
          <Button icon={<ReloadOutlined />} onClick={refreshAccounts} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
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
              size="middle" scroll={{ x: 860 }} pagination={{ pageSize: 20 }}
              locale={{ emptyText: '暂无授权账户，请先点击右上角「一键授权」' }} />
          </Card>
        </>
      )}
    </div>
  );
};

export default AdAccounts;
