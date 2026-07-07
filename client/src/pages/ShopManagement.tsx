import React, { useEffect, useState } from 'react';
import {
  Card, Button, Space, Modal, Form, Input, Select, Tag, message,
  Popconfirm, Row, Col, Empty, Spin, Tooltip,
  Switch, Alert,
} from 'antd';
import {
  SyncOutlined, DeleteOutlined, ShopOutlined,
  ApiOutlined, LinkOutlined, CloudDownloadOutlined, AppstoreOutlined,
  KeyOutlined, ReloadOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import api from '../api';
import { useHasPerm } from '../stores/authStore';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:   { label: '运营中', color: 'success' },
  inactive: { label: '已停用', color: 'default' },
  pending:  { label: '待授权', color: 'warning' },
};

const REGION_MAP: Record<string, string> = {
  MY: '马来西亚', SG: '新加坡', TH: '泰国', PH: '菲律宾',
  ID: '印度尼西亚', VN: '越南', GB: '英国', US: '美国',
};

export default function ShopManagement() {
  const canEdit = useHasPerm('shops', 'edit');
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editShop, setEditShop] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState<Record<number, boolean>>({});
  const [form] = Form.useForm();

  const loadShops = async () => {
    setLoading(true);
    try {
      const res = await api.get('/shops');
      setShops(res.data);
    } catch {
      message.error('加载店铺列表失败');
    } finally {
      setLoading(false);
    }
  };

  // Init
  useEffect(() => {
    loadShops();
  }, []);

  // Handle TikTok OAuth callback (two modes)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Mode 1: GET /callback redirect (TikTok → backend → frontend)
    const authResult = params.get('auth');
    const authMsg = params.get('message');
    const authShop = params.get('shop');

    if (authResult === 'success') {
      window.history.replaceState({}, '', '/shops');
      message.success(`TikTok 店铺授权成功！`);
      loadShops();
      return;
    }
    if (authResult === 'error') {
      window.history.replaceState({}, '', '/shops');
      message.error(`授权失败: ${decodeURIComponent(authMsg || '未知错误')}`);
      return;
    }

    // Mode 2: Frontend-based code submission (legacy support)
    const code = params.get('code');
    if (code) {
      window.history.replaceState({}, '', '/shops');
      handleOAuthCallback(code);
    }
  }, []);

  const handleOAuthCallback = async (code: string) => {
    setAuthLoading(true);
    try {
      const res = await api.post('/shops/tiktok/callback', { code });
      if (res.data.created) {
        message.success(`TikTok 店铺「${res.data.shop_name}」授权成功！`);
      } else if (res.data.updated) {
        message.success(`TikTok 店铺「${res.data.shop_name}」已重新授权！`);
      }
      loadShops();
    } catch (e: any) {
      message.error(e.response?.data?.error || '授权处理失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSync = async (e: React.MouseEvent, shopId: number) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/shops/${shopId}/sync`);
      message.success(res.data.success ? `同步完成：新增${res.data.created} 更新${res.data.updated}` : `部分失败：${res.data.errors?.join(',')}`);
      loadShops();
    } catch (e: any) {
      message.error(e.response?.data?.errors?.[0] || '同步失败');
    }
  };

  const handleSyncProducts = async (e: React.MouseEvent, shopId: number) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/shops/${shopId}/sync-products`);
      message.success(res.data.success ? `同步完成：新增${res.data.created} 更新${res.data.updated}` : `部分失败：${res.data.errors?.join(',')}`);
      loadShops();
    } catch (e: any) {
      message.error(e.response?.data?.errors?.[0] || '同步失败');
    }
  };

  const handleSyncAll = async (e: React.MouseEvent, shopId: number) => {
    e.stopPropagation();
    message.loading({ content: '全量同步中...', key: 'sync-all' });
    try {
      const res = await api.post(`/shops/${shopId}/sync-all`);
      const s = res.data.summary;
      message.success({ content: `同步完成：产品${s.products_created + s.products_updated} 订单${s.orders_created + s.orders_updated}`, key: 'sync-all' });
      loadShops();
    } catch (e: any) {
      message.error({ content: e.response?.data?.errors?.[0] || '同步失败', key: 'sync-all' });
    }
  };

  const handleTest = async (e: React.MouseEvent, shopId: number) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/shops/${shopId}/test`);
      if (!res.data.success) {
        console.error('[ShopManagement] 测试连接失败(后端返回):', res.data.message);
      } else {
        console.log('[ShopManagement] 测试连接成功:', res.data.message);
      }
      message[res.data.success ? 'success' : 'error'](res.data.message);
    } catch (e: any) {
      console.error('[ShopManagement] 测试连接失败(请求异常):', e);
      message.error(e.response?.data?.message || e.response?.data?.error || '测试失败');
    }
  };

  const handleRefreshToken = async (e: React.MouseEvent, shopId: number) => {
    e.stopPropagation();
    setRefreshLoading(prev => ({ ...prev, [shopId]: true }));
    try {
      const shop = shops.find(s => s.id === shopId);
      await api.post('/shops/tiktok/refresh', { shop_id: shop?.shop_id || String(shopId) });
      message.success('Token 刷新成功');
      loadShops();
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Token 刷新失败，请重新授权');
    } finally {
      setRefreshLoading(prev => ({ ...prev, [shopId]: false }));
    }
  };

  const handleDelete = async (shopId: number) => {
    try {
      await api.delete(`/shops/${shopId}`);
      message.success('已解绑');
      loadShops();
    } catch (e: any) {
      message.error(e.response?.data?.error || '解绑失败');
    }
  };

  // ─── 一键授权 ──────────────────────────────────
  const handleStartOAuth = async () => {
    setAuthLoading(true);
    try {
      const res = await api.post('/shops/tiktok/auth-url');
      const authUrl = res.data.authUrl || res.data.auth_url;
      if (authUrl) {
        // 直接跳转到 TikTok 授权页面
        window.location.href = authUrl;
      }
    } catch (e: any) {
      message.error(e.response?.data?.error || '获取授权链接失败');
      setAuthLoading(false);
    }
  };

  // ─── 编辑（基本信息，不含凭证） ────────────────
  const handleOpenModal = async (shop?: any) => {
    setEditShop(shop || null);
    if (shop) {
      try {
        const res = await api.get(`/shops/${shop.id}`);
        form.setFieldsValue(res.data);
      } catch {
        form.setFieldsValue(shop);
      }
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editShop) {
        await api.put(`/shops/${editShop.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/shops', { ...values, status: 'active' });
        message.success('创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      loadShops();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const getTokenBadge = (shop: any) => {
    if (!shop._has_credentials) return <Tag color="default">未授权</Tag>;
    if (shop._token_valid === false) return <Tag color="error">Token已过期</Tag>;
    return <Tag color="green">Token有效</Tag>;
  };

  return (
    <div style={{ padding: '20px 24px', background: '#f5f3f0', minHeight: '100%' }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>
            <ShopOutlined />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>店铺管理</h2>
            <span style={{ fontSize: 12, color: '#999' }}>一键授权绑定 TikTok 店铺 · 数据同步</span>
          </div>
        </div>
        {canEdit && (
          <Button type="primary" icon={<LinkOutlined />} size="large" onClick={handleStartOAuth} loading={authLoading}
            style={{ borderRadius: 8, fontWeight: 600 }}>
            一键授权 TikTok Shop
          </Button>
        )}
      </div>

      {/* OAuth 授权提示 */}
      {canEdit && shops.length === 0 && !loading && (
        <Alert
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message="开始使用"
          description="点击右上角「一键授权 TikTok Shop」按钮，跳转到 TikTok 授权页面完成授权后，系统将自动创建店铺并同步数据。首次使用请确保已在 TikTok Partner Center 注册应用并配置了回调地址。"
          style={{ marginBottom: 20, borderRadius: 10 }}
        />
      )}

      {/* 授权回调 loading */}
      {authLoading && (
        <Card style={{ marginBottom: 20, textAlign: 'center', borderRadius: 10 }}>
          <Spin tip="正在处理 TikTok 授权回调，请稍候..." />
        </Card>
      )}

      {/* Shop Cards */}
      <Spin spinning={loading}>
        {shops.length === 0 && !authLoading ? (
          <Empty description="暂无绑定店铺，点击右上角「一键授权 TikTok Shop」开始" />
        ) : (
          <Row gutter={[16, 16]}>
            {shops.map(shop => (
              <Col key={shop.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  style={{
                    border: '1px solid #e8e8e8',
                    borderRadius: 10,
                  }}
                  styles={{ body: { padding: 16 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</div>
                      <Space size={4} wrap>
                        <Tag color="blue">{REGION_MAP[shop.region] || shop.region}</Tag>
                        <Tag color={STATUS_MAP[shop.status]?.color || 'default'}>{STATUS_MAP[shop.status]?.label || shop.status}</Tag>
                        {getTokenBadge(shop)}
                      </Space>
                    </div>
                    <ShopOutlined style={{ fontSize: 28, color: '#d0d0d0', flexShrink: 0 }} />
                  </div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                    {shop.last_synced_at ? `上次同步: ${shop.last_synced_at.slice(0, 16)}` : '尚未同步'}
                    {shop.sync_enabled ? <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>订单同步</Tag> : null}
                    {shop.product_sync_enabled ? <Tag color="purple" style={{ fontSize: 11 }}>产品同步</Tag> : null}
                  </div>
                  <Space style={{ marginTop: 12 }} size="small" wrap>
                    <Tooltip title="同步订单"><Button size="small" icon={<SyncOutlined />} onClick={e => handleSync(e, shop.id)}>订单</Button></Tooltip>
                    <Tooltip title="同步产品"><Button size="small" icon={<AppstoreOutlined />} onClick={e => handleSyncProducts(e, shop.id)}>产品</Button></Tooltip>
                    <Tooltip title="全量同步"><Button size="small" type="primary" ghost icon={<CloudDownloadOutlined />} onClick={e => handleSyncAll(e, shop.id)}>全部</Button></Tooltip>
                    <Tooltip title="测试连接"><Button size="small" icon={<ApiOutlined />} onClick={e => handleTest(e, shop.id)}>测试</Button></Tooltip>
                    {shop._refresh_token_exists && (
                      <Tooltip title="刷新Token"><Button size="small" icon={<ReloadOutlined />} loading={refreshLoading[shop.id]} onClick={e => handleRefreshToken(e, shop.id)} /></Tooltip>
                    )}
                    {canEdit && (
                      <>
                        {!shop._has_credentials && (
                          <Tooltip title="重新授权TikTok"><Button size="small" type="link" icon={<KeyOutlined />} onClick={e => { e.stopPropagation(); handleStartOAuth(); }}>授权</Button></Tooltip>
                        )}
                        <Button size="small" onClick={e => { e.stopPropagation(); handleOpenModal(shop); }}>编辑</Button>
                        <Popconfirm title="确认解绑此店铺？" onConfirm={e => { e?.stopPropagation(); handleDelete(shop.id); }}>
                          <Button size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()}>解绑</Button>
                        </Popconfirm>
                      </>
                    )}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* Edit Modal — 仅编辑基本信息，不含 API 凭证 */}
      <Modal
        title={editShop ? '编辑店铺信息' : '手动添加店铺'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={480}
        okText="保存"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="店铺名称" rules={[{ required: true, message: '请填写店铺名称' }]}>
            <Input placeholder="例：Freshguard MY Store" />
          </Form.Item>
          <Form.Item name="region" label="市场/地区">
            <Select>
              {Object.entries(REGION_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v} ({k})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="active">运营中</Select.Option>
              <Select.Option value="inactive">已停用</Select.Option>
              <Select.Option value="pending">待授权</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="api_version" label="API 版本">
            <Select>
              <Select.Option value="202309">202309（基础）</Select.Option>
              <Select.Option value="202406">202406（+外部订单）</Select.Option>
              <Select.Option value="202407">202407（+价格详情）</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="sync_enabled" label="启用订单同步" valuePropName="checked">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item name="product_sync_enabled" label="启用产品同步" valuePropName="checked">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>

          {editShop && !editShop._has_credentials && (
            <Alert type="warning" message="该店铺尚未通过 TikTok 授权，建议使用「一键授权」绑定" style={{ marginTop: 8, borderRadius: 8 }} />
          )}
        </Form>
      </Modal>
    </div>
  );
}
