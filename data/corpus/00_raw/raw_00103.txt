import React, { useState, useCallback, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Typography, message, Input, Badge, Select, Tooltip, Switch } from 'antd';
import { SafetyOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, LinkOutlined, SyncOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api';

const { Text, Title } = Typography;
const PRIMARY = '#4568FF';

interface AdAccount {
  advertiser_id: string;
  advertiser_name: string;
  status: string;
  country?: string;
  currency?: string;
  timezone?: string;
  balance_info?: { balance: number; currency?: string };
  enabled?: boolean; // 用户手动启用/禁用（true=启用，false=禁用）
  label?: string;
}

interface AuthStatus {
  hasToken: boolean;
  advertiserIds: string[];
}

const PAGE_CACHE_KEY = 'ad_accounts_cache_v3';

const AdAccounts: React.FC = () => {
  // ── 本地缓存秒开 ──
  const [accounts, setAccounts] = useState<AdAccount[]>(() => {
    try { const c = localStorage.getItem(PAGE_CACHE_KEY); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // ── 持久化 ──
  useEffect(() => {
    try { localStorage.setItem(PAGE_CACHE_KEY, JSON.stringify(accounts)); } catch {}
  }, [accounts]);

  // ── 静默同步 ──
  const silentSync = useCallback(async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        api.get('/tiktok-ads/token-status'),
        api.get('/ad-center/advertisers'),
      ]);
      if (sRes.data) setAuthStatus(sRes.data);
      if (aRes.data?.success) setAccounts(aRes.data.data || []);
    } catch {}
  }, []);

  useEffect(() => { silentSync(); }, [silentSync]);

  // ── OAuth 回调 ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('auth_code') || params.get('code');
    if (!authCode) return;

    const exchange = async () => {
      setLoading(true);
      try {
        // 1. 尝试客户端换 token
        const configRes = await api.get('/tiktok-ads/auth-url');
        if (configRes.data?.success) {
          const { appId, appSecret } = configRes.data;
          try {
            const tkRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ app_id: appId, secret: appSecret, auth_code: authCode, grant_type: 'authorization_code' }),
            });
            const tkData = await tkRes.json();
            if (tkData.code === 0 && tkData.data?.access_token) {
              await api.post('/tiktok-ads/save-token', {
                access_token: tkData.data.access_token,
                refresh_token: tkData.data.refresh_token,
                advertiser_ids: tkData.data.advertiser_ids || [],
                expires_in: tkData.data.expires_in,
              });
              message.success('TikTok Ads 授权成功');
              window.history.replaceState({}, '', '/ad-accounts');
              silentSync();
              return;
            }
          } catch {}
        }
        // 2. 回退服务器换 token
        const fbRes = await api.post('/tiktok-ads/exchange-code', { auth_code: authCode });
        if (fbRes.data?.success) {
          message.success('TikTok Ads 授权成功');
          window.history.replaceState({}, '', '/ad-accounts');
          silentSync();
        }
      } catch (e: any) {
        message.error('授权失败: ' + (e.response?.data?.error || e.message));
      } finally { setLoading(false); }
    };
    exchange();
  }, [silentSync]);

  // ── 授权按钮 ──
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
      message.error('获取授权链接失败');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── 同步 ──
  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ad-center/advertisers', { params: { refresh: '1' } });
      if (res.data?.success) {
        setAccounts(res.data.data || []);
        message.success('已从 TikTok 同步最新数据');
      } else {
        // 后端返回的错误（含 token 过期 / 账户欠费 等业务码）
        const errMsg = res.data?.message || res.data?.details || res.data?.error || '同步失败';
        message.error({ content: errMsg, duration: 6 });
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.message || e.response?.data?.details || e.message || '同步失败';
      message.error({ content: errMsg, duration: 6 });
    }
    finally { setLoading(false); }
  };

  // ── 过滤 ──
  const filteredAccounts = accounts.filter(a => {
    const matchSearch = !searchText ||
      a.advertiser_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      a.advertiser_id.includes(searchText);
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && (a.status === 'ACTIVE' || a.status === 'APPROVED')) ||
      (statusFilter === 'paused' && a.status === 'DISABLE');
    return matchSearch && matchStatus;
  });

  // ── 统计 ──
  const isAuthorized = authStatus?.hasToken ?? accounts.length > 0;
  const authorizedCount = accounts.length;
  const enabledCount = accounts.filter(a => a.enabled !== false).length;

  // ── 批量操作 ──
  const handleBatchEnable = async (enabled: boolean) => {
    if (selectedRowKeys.length === 0) return message.warning('请先勾选账户');
    try {
      const res = await api.post('/ad-center/advertisers/batch-enable', {
        advertiser_ids: selectedRowKeys,
        enabled,
      });
      if (res.data?.success) {
        const action = enabled ? '启用' : '禁用';
        const updated = accounts.map(a => ({
          ...a,
          enabled: selectedRowKeys.includes(a.advertiser_id) ? enabled : a.enabled,
        }));
        setAccounts(updated);
        setSelectedRowKeys([]);
        message.success(`已${action} ${selectedRowKeys.length} 个账户`);
      }
    } catch (e: any) {
      message.error('操作失败: ' + (e.response?.data?.error || e.message));
    }
  };

  // ── 单行开关 ──
  const handleToggleSingle = async (id: string, currentEnabled: boolean) => {
    try {
      await api.post('/ad-center/advertisers/batch-enable', {
        advertiser_ids: [id],
        enabled: !currentEnabled,
      });
      const updated = accounts.map(a => ({
        ...a,
        enabled: a.advertiser_id === id ? !currentEnabled : a.enabled,
      }));
      setAccounts(updated);
      message.success(currentEnabled ? '已禁用' : '已启用');
    } catch (e: any) {
      message.error('操作失败: ' + (e.response?.data?.error || e.message));
    }
  };

  // ── 表格列 ──
  const columns: ColumnsType<AdAccount> = [
    { title: '启用', dataIndex: 'enabled', key: 'enabled', width: 70,
      render: (_: any, r) => {
        const isEnabled = r.enabled !== false;
        return <Switch size="small" checked={isEnabled}
          onChange={() => handleToggleSingle(r.advertiser_id, isEnabled)}
          checkedChildren="开" unCheckedChildren="关" />;
      } },
    { title: '广告账户名称', dataIndex: 'advertiser_name', key: 'name', width: 200,
      render: (name: string, r) => <Text strong>{name || r.advertiser_id}</Text> },
    { title: '状态', dataIndex: 'status', key: 'acc_status', width: 80,
      render: (s: string) => {
        const isActive = s === 'ACTIVE' || s === 'APPROVED';
        return isActive ? <Tag color="success">ACTIVE</Tag> : <Tag color="warning">{s}</Tag>;
      } },
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 80,
      render: (_: any, r: any) => r.balance_info?.currency || r.currency || '-' },
    { title: '余额', dataIndex: 'balance_info', key: 'balance', width: 120,
      render: (b: any) => {
        const bal = Number(b?.balance ?? 0);
        return <Text strong style={{ color: bal > 0 ? '#059669' : '#64748b' }}>${bal.toFixed(2)}</Text>;
      } },
    { title: '时区', dataIndex: 'timezone', key: 'timezone', width: 100,
      render: (v: string) => v || '-' },
    { title: '账户 ID', dataIndex: 'advertiser_id', key: 'id', width: 200,
      render: (id: string) => <Text strong>{id}</Text> },
    { title: '操作', key: 'action', width: 80, fixed: 'right',
      render: () => <Button type="link" size="small" style={{ color: PRIMARY }}>详情</Button> },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* ── 页面标题 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #4568FF, #6B8CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}>
          <SafetyOutlined style={{ color: '#fff', fontSize: 18 }} />
        </div>
        <Title level={4} style={{ margin: 0, color: '#172033', lineHeight: 1 }}>账户授权管理</Title>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b', background: '#f1f5f9', padding: '2px 10px', borderRadius: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B8CFF' }} /> TikTok Ads
        </span>
      </div>

      {/* ── 状态卡片 ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 22px', marginBottom: 16, marginTop: 16,
        background: '#fff', borderRadius: 14, border: '1px solid #EEF1F6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: isAuthorized ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #f59e0b, #fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isAuthorized ? <CheckCircleOutlined style={{ color: '#fff', fontSize: 18 }} /> : <WarningOutlined style={{ color: '#fff', fontSize: 18 }} />}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#172033' }}>
              {isAuthorized ? (
                <>已授权 <span style={{ color: PRIMARY, fontWeight: 700 }}>{authorizedCount}</span> 账号</>
              ) : (
                '尚未授权 TikTok Ads'
              )}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {isAuthorized ? '管理 TikTok 授权账号和广告账户' : '授权后可管理您的 TikTok 广告账户与投放'}
            </div>
          </div>
        </div>
        <Button type="primary" icon={<LinkOutlined />} loading={authLoading} onClick={handleAuthorize}
          style={{ borderRadius: 8, height: 36 }}>
          新增授权用户
        </Button>
      </div>

      {/* ── 账户列表 ── */}
      <Card style={{ borderRadius: 14, border: '1px solid #EEF1F6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}>
        {/* 表格头部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <Text strong style={{ fontSize: 15, color: '#172033' }}>广告账户列表</Text>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>选择您想要连接的 TikTok 广告账户</Text>
          </div>
        </div>

        {/* 搜索栏 + 筛选 + 按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="请输入广告账户名称或 ID"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
            style={{ width: 280, borderRadius: 8 }}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 130, borderRadius: 8 }}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '活跃', value: 'active' },
              { label: '已暂停', value: 'paused' },
            ]}
          />
          <div style={{ flex: 1 }} />
          <Tooltip title="从 TikTok 同步最新数据">
            <Button icon={<SyncOutlined />} onClick={handleSync} loading={loading} style={{ borderRadius: 8 }}>
              同步
            </Button>
          </Tooltip>
        </div>

        {/* 批量操作栏 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Space>
            <Button disabled={selectedRowKeys.length === 0} size="small" type="primary"
              style={{ borderRadius: 6 }} onClick={() => handleBatchEnable(true)}>开启连接</Button>
            <Button disabled={selectedRowKeys.length === 0} size="small"
              style={{ borderRadius: 6, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => handleBatchEnable(false)}>关闭连接</Button>
          </Space>
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>
            已启用 <Text strong style={{ color: PRIMARY }}>{enabledCount}</Text>/{authorizedCount} · 已禁用 <Text strong style={{ color: '#dc2626' }}>{authorizedCount - enabledCount}</Text>
          </Text>
        </div>

        {/* 表格 */}
        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
          columns={columns}
          dataSource={filteredAccounts}
          rowKey="advertiser_id"
          size="middle"
          loading={loading && accounts.length === 0}
          scroll={{ x: 1240 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 个账户` }}
          locale={{ emptyText: isAuthorized ? '暂无广告账户数据' : '请先点击右上角「新增授权用户」完成 TikTok 授权' }}
        />
      </Card>
    </div>
  );
};

export default AdAccounts;
