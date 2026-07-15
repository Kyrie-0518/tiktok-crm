import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Space, Typography, message, Spin, Badge, Alert, Input, Collapse } from 'antd';
import { SafetyOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, LinkOutlined, CodeOutlined, ThunderboltOutlined } from '@ant-design/icons';
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

const ACCOUNTS_CACHE_KEY = 'ad_accounts_cache_v1';
const AUTH_STATUS_CACHE_KEY = 'tiktok_auth_status_v1';

const AdAccounts: React.FC = () => {
  // 初始值：直接从 localStorage 读（秒开，无 loading 转圈）
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdAccount[]>(() => {
    try {
      const cached = localStorage.getItem(ACCOUNTS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(() => {
    try {
      const cached = localStorage.getItem(AUTH_STATUS_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  // 手动换 token 模式（客户端/服务器代理都失败时启用）
  const [manualAuth, setManualAuth] = useState<{ authCode: string; appId: string; appSecret: string; errorMsg: string } | null>(null);
  const [manualResponse, setManualResponse] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  // 持久化到 localStorage（任何时候 accounts 变都同步）
  React.useEffect(() => {
    try { localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(accounts)); } catch {}
  }, [accounts]);
  React.useEffect(() => {
    try { if (authStatus) localStorage.setItem(AUTH_STATUS_CACHE_KEY, JSON.stringify(authStatus)); } catch {}
  }, [authStatus]);

  // 静默后台同步（不显示转圈，不阻塞渲染）
  const silentSync = useCallback(async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        api.get('/tiktok-ads/token-status'),
        api.get('/ad-center/advertisers'),
      ]);
      if (sRes.data) {
        setAuthStatus(sRes.data);
        localStorage.setItem(AUTH_STATUS_CACHE_KEY, JSON.stringify(sRes.data));
      }
      if (aRes.data?.success) {
        setAccounts(aRes.data.data || []);
        localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(aRes.data.data || []));
      }
    } catch (e: any) {
      console.warn('[AdAccounts] silent sync failed:', e?.message);
    }
  }, []);

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

  // 显式刷新：强制从 TikTok 拉最新
  const refreshAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/ad-center/advertisers', { params: { refresh: '1' } });
      if (res.data?.success) {
        setAccounts(res.data.data || []);
        localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(res.data.data || []));
        if (res.data.refreshed) message.success('已从 TikTok 刷新最新数据');
      }
    } catch (e: any) {
      message.error('刷新失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 进入页面：直接渲染（localStorage），后台静默同步一次
  useEffect(() => {
    silentSync();
  }, [silentSync]);

  // OAuth 回调：从 URL 中读取 auth_code 并自动换 token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('auth_code') || params.get('code');
    if (!authCode) return;

    const exchange = async () => {
      setLoading(true);
      // 清除 URL 参数，避免刷新时重复执行
      window.history.replaceState({}, '', '/ad-accounts');
      try {
        // Step 1: 获取 OAuth 配置（appId / appSecret）
        const configRes = await api.get('/tiktok-ads/auth-url');
        if (!configRes.data?.success) {
          message.error('获取 OAuth 配置失败');
          return;
        }
        const { appId, appSecret } = configRes.data;

        // Step 2: 浏览器直接调 TikTok OAuth 端点（走本地网络/本地代理，不经服务器）
        let tokenData: any = null;
        try {
          const tiktokRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              app_id: appId,
              secret: appSecret,
              auth_code: authCode,
              grant_type: 'authorization_code',
            }),
          });
          const tiktokJson = await tiktokRes.json();
          if (tiktokJson.code === 0 && tiktokJson.data) {
            tokenData = tiktokJson.data;
            console.log('[TikTok Auth] client-side exchange success');
          } else {
            console.warn('[TikTok Auth] client-side exchange failed:', tiktokJson);
          }
        } catch (corsErr: any) {
          // CORS 错误或其他网络错误 → 回退到服务器代理
          console.warn('[TikTok Auth] client-side exchange failed (probably CORS), falling back to server:', corsErr?.message);
        }

        // Step 3: 如果客户端成功，调用 /save-token 让服务器保存
        if (tokenData) {
          const saveRes = await api.post('/tiktok-ads/save-token', {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            advertiser_ids: tokenData.advertiser_ids || tokenData.advertiser_id || [],
            expires_in: tokenData.expires_in,
          });
          if (saveRes.data?.success) {
            message.success('TikTok Ads 授权成功（本地换 token）');
            loadAuthStatus();
            loadAccounts();
            return;
          }
          message.error('保存 token 失败: ' + saveRes.data?.error);
          return;
        }

        // Step 4: 客户端失败 → 回退到服务器端 exchange
        console.log('[TikTok Auth] falling back to server-side exchange');
        const fallbackRes = await api.post('/tiktok-ads/exchange-code', { auth_code: authCode });
        if (fallbackRes.data?.success) {
          message.success('TikTok Ads 授权成功（服务器换 token）');
          loadAuthStatus();
          loadAccounts();
        } else {
          // Step 5: 服务器也失败 → 启用手动换 token 模式
          const errMsg = fallbackRes.data?.error || '未知错误';
          message.warning('自动换 token 失败，已切换到手动模式');
          setManualAuth({ authCode, appId, appSecret, errorMsg: errMsg });
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

  // 手动换 token：解析用户粘贴的 TikTok API JSON 响应，提交给服务器
  const handleManualSubmit = async () => {
    if (!manualResponse.trim()) { message.warning('请先粘贴 TikTok API 响应'); return; }
    let parsed: any;
    try {
      parsed = JSON.parse(manualResponse);
    } catch {
      message.error('JSON 解析失败，请检查粘贴内容');
      return;
    }
    if (parsed.code !== 0 || !parsed.data) {
      message.error('TikTok 返回错误: ' + (parsed.message || `code=${parsed.code}`));
      return;
    }
    setManualSaving(true);
    try {
      const res = await api.post('/tiktok-ads/save-token', {
        access_token: parsed.data.access_token,
        refresh_token: parsed.data.refresh_token,
        advertiser_ids: parsed.data.advertiser_ids || parsed.data.advertiser_id || [],
        expires_in: parsed.data.expires_in,
      });
      if (res.data?.success) {
        message.success('Token 保存成功！');
        setManualAuth(null);
        setManualResponse('');
        loadAuthStatus();
        loadAccounts();
      } else {
        message.error('保存失败: ' + res.data?.error);
      }
    } catch (e: any) {
      message.error('保存失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setManualSaving(false);
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

      {/* ── 手动换 token 面板（CORS/网络都失败时启用） ── */}
      {manualAuth && (
        <Card
          style={{ marginBottom: 20, borderRadius: 12, border: '1px solid #fbbf24', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          title={<Text strong style={{ color: '#d97706' }}><ThunderboltOutlined /> 手动换 token 模式</Text>}
        >
          <Alert
            type="error" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
            message="自动换 token 失败（浏览器 CORS + 服务器无法访问 TikTok）"
            description={`最后错误: ${manualAuth.errorMsg}`}
          />
          <Text style={{ display: 'block', marginBottom: 8 }}>
            <strong>步骤 1：</strong>在你<strong>本机终端</strong>（不是服务器）执行以下命令（可开启代理）：
          </Text>
          <pre style={{
            background: '#1e293b', color: '#e2e8f0', padding: 12, borderRadius: 8, fontSize: 12,
            overflow: 'auto', marginBottom: 16, lineHeight: 1.5,
          }}>
{`curl -X POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/ \\
  -H "Content-Type: application/json" \\
  -d '{
    "app_id": "${manualAuth.appId}",
    "secret": "${manualAuth.appSecret}",
    "auth_code": "${manualAuth.authCode}",
    "grant_type": "authorization_code"
  }'`}
          </pre>
          <Text style={{ display: 'block', marginBottom: 8 }}>
            <strong>步骤 2：</strong>把命令的<strong>完整 JSON 响应</strong>粘贴到下面文本框：
          </Text>
          <Input.TextArea
            value={manualResponse} onChange={e => setManualResponse(e.target.value)}
            placeholder='粘贴 TikTok API 的 JSON 响应，例如：{"code":0,"message":"OK","data":{"access_token":"...","refresh_token":"...","advertiser_ids":["..."],"expires_in":86400}}'
            autoSize={{ minRows: 6, maxRows: 12 }}
            style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 12, borderRadius: 8 }}
          />
          <Space>
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleManualSubmit} loading={manualSaving} style={{ borderRadius: 8, background: PRIMARY }}>
              提交并保存
            </Button>
            <Button onClick={() => { setManualAuth(null); setManualResponse(''); }} style={{ borderRadius: 8 }}>
              取消
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <CodeOutlined /> 终端执行：auth_code 5 分钟内有效，请尽快完成
            </Text>
          </Space>
        </Card>
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
