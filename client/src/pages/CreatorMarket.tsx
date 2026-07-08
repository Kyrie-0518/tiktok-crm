import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Input, Select, Tag, Typography, Button, Space,
  Statistic, Avatar, Empty, Spin, message, Badge,
} from 'antd';
import {
  SearchOutlined, UserOutlined,
  StarOutlined, EyeOutlined, TeamOutlined,
  RiseOutlined, ReloadOutlined,
  LinkOutlined, SyncOutlined, CloudDownloadOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import api from '../api';

const { Text, Title } = Typography;
const PRIMARY = '#059669';

interface CreatorRow {
  id: number;
  influencer_id: string;
  name: string;
  shop_name: string;
  shop_id: number;
  status: string;
  contact_channel: string;
  contact_info: string;
  cooperation_type: string;
  commission_rate: number;
  remark: string;
  // 从 remark JSON 中解析
  parsed: {
    avatar_url?: string;
    register_region?: string;
    selection_region?: string;
    seller_type?: string;
    user_type?: string;
    permissions?: string[];
  };
  // 关联订单统计
  order_count: number;
  total_revenue: number;
}

const CATEGORIES = ['全部', '美妆', '数码', '时尚', '家居', '食品', '运动', '宠物', '母婴'];
const COUNTRIES = ['全部', 'MY', 'PH', 'SG', 'TH', 'VN', 'ID'];

export default function CreatorMarket() {
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('全部');
  const [shops, setShops] = useState<any[]>([]);

  const loadCreators = useCallback(async () => {
    setLoading(true);
    try {
      // 拉取 influencer 列表 + 关联订单统计
      const res = await api.get('/influencers', { params: { page_size: 200 } });
      const list = (res.data?.list || res.data?.influencers || []) as any[];

      // 尝试拉取订单统计（如有）
      let orderStats: Record<number, { count: number; revenue: number }> = {};
      try {
        const statsRes = await api.get('/influencers/order-stats');
        orderStats = statsRes.data || {};
      } catch { /* ignore */ }

      const parsed: CreatorRow[] = list.map((r: any) => {
        let profile: any = {};
        try { profile = r.remark ? JSON.parse(r.remark) : {}; } catch { /* ignore */ }
        return {
          id: r.id,
          influencer_id: r.influencer_id || '',
          name: r.name || r.influencer_id || '',
          shop_name: r.shop_name || '',
          shop_id: r.shop_id || 0,
          status: r.status || '未回复',
          contact_channel: r.contact_channel || '',
          contact_info: r.contact_info || '',
          cooperation_type: r.cooperation_type || '',
          commission_rate: r.commission_rate || 0,
          remark: r.remark || '',
          parsed: {
            avatar_url: profile.avatar_url,
            register_region: profile.register_region,
            selection_region: profile.selection_region,
            seller_type: profile.seller_type,
            user_type: profile.user_type,
            permissions: profile.permissions,
          },
    order_count: orderStats[r.id]?.count ?? 0,
    total_revenue: orderStats[r.id]?.revenue ?? 0,
        };
      });
      setCreators(parsed);
    } catch (e: any) {
      message.error('加载达人列表失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.get('/shops').then(r => setShops(r.data || [])).catch(() => {});
    loadCreators();
  }, [loadCreators]);

  // 从 TikTok 同步达人数据
  const handleSyncFromTikTok = async () => {
    setSyncing(true);
    try {
      const shopIds = shops.length > 0 ? shops.map((s: any) => s.id) : [1];
      let totalLinked = 0;
      let totalOrders = 0;

      for (const shopId of shopIds) {
        try {
          const res = await api.post('/influencers/sync-affiliate-orders', { shop_id: shopId });
          totalLinked += res.data?.linked || 0;
          totalOrders += res.data?.total_orders || 0;
        } catch { /* 跳过同步失败的店铺 */ }
      }

      if (totalLinked > 0) {
        message.success(`从 ${totalOrders} 条联盟订单中关联了 ${totalLinked} 位达人`);
      } else {
        message.info('未发现新的达人联盟订单，请确保店铺已授权且有联盟订单数据');
      }
      loadCreators();
    } catch (e: any) {
      message.error('同步失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setSyncing(false);
    }
  };

  const filtered = creators.filter(c => {
    if (keyword && !c.name.toLowerCase().includes(keyword.toLowerCase()) && !c.influencer_id.toLowerCase().includes(keyword.toLowerCase())) return false;
    if (country !== '全部' && c.parsed.register_region !== country) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = { '未回复': '#faad14', '已回复': '#2563eb', '待寄样': '#722ed1', '已完成': '#059669' };
    return map[status] || '#8c8c8c';
  };

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* 标题区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `linear-gradient(135deg, ${PRIMARY}, #34d399)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SearchOutlined style={{ color: '#fff', fontSize: 16 }} />
        </div>
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0, color: '#1e293b' }}>达人广场</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            从 TikTok Shop 联盟订单中同步达人数据，发现优质带货达人
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadCreators} style={{ borderRadius: 8 }}>刷新</Button>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            onClick={handleSyncFromTikTok}
            loading={syncing}
            style={{ borderRadius: 8, background: PRIMARY, borderColor: PRIMARY }}
          >
            从TikTok同步达人
          </Button>
        </Space>
      </div>

      {/* 统计卡 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8} sm={4}>
          <Card size="small" style={{ borderRadius: 8, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }} bodyStyle={{ padding: '12px 10px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: PRIMARY }}>{creators.length}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>达人总数</Text>
          </Card>
        </Col>
        <Col xs={8} sm={4}>
          <Card size="small" style={{ borderRadius: 8, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }} bodyStyle={{ padding: '12px 10px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{creators.filter(c => c.status === '已完成').length}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>已合作</Text>
          </Card>
        </Col>
        <Col xs={8} sm={4}>
          <Card size="small" style={{ borderRadius: 8, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }} bodyStyle={{ padding: '12px 10px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>{creators.filter(c => c.order_count > 0).length}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>已出单</Text>
          </Card>
        </Col>
        <Col xs={0} sm={12} />
      </Row>

      {/* 筛选栏 */}
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="搜索达人名称或ID..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <Select value={country} onChange={setCountry} style={{ width: 120, borderRadius: 8 }}
            options={COUNTRIES.map(c => ({ value: c, label: c === '全部' ? '全部地区' : c }))} />
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            共 <Text strong style={{ color: PRIMARY }}>{filtered.length}</Text> 位达人
          </Text>
        </div>
      </Card>

      {/* 达人卡片网格 */}
      <Spin spinning={loading}>
        {filtered.length === 0 ? (
          <Empty
            description={
              <div>
                <div style={{ marginBottom: 8 }}>暂无达人数据</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  点击「从TikTok同步达人」从联盟订单中自动拉取达人信息
                </Text>
              </div>
            }
            style={{ marginTop: 40 }}
          >
            <Button type="primary" icon={<CloudDownloadOutlined />} onClick={handleSyncFromTikTok} loading={syncing} style={{ borderRadius: 8 }}>
              从TikTok同步达人
            </Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map(creator => (
              <Col xs={24} sm={12} lg={8} xl={6} key={creator.id}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    transition: 'all 0.2s ease', overflow: 'hidden',
                  }}
                  bodyStyle={{ padding: 0 }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(5,150,105,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = '';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                  }}
                >
                  {/* 卡片头部 */}
                  <div style={{
                    height: 80, padding: '16px 20px 0',
                    background: `linear-gradient(135deg, ${PRIMARY}, #34d399)`,
                    display: 'flex', gap: 12,
                  }}>
                    <Avatar
                      size={56}
                      src={creator.parsed.avatar_url || undefined}
                      icon={<UserOutlined />}
                      style={{
                        background: '#fff', color: PRIMARY, fontSize: 24,
                        border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        flexShrink: 0, marginTop: 12,
                      }}
                    />
                    <div style={{ flex: 1, color: '#fff', minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {creator.name || creator.influencer_id}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>@{creator.influencer_id}</div>
                      <div style={{ marginTop: 2 }}>
                        {creator.shop_name && (
                          <Tag style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}>
                            <ShopOutlined /> {creator.shop_name}
                          </Tag>
                        )}
                        {creator.parsed.register_region && (
                          <Tag style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff' }}>
                            {creator.parsed.register_region}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 卡片主体 */}
                  <div style={{ padding: '12px 20px 16px' }}>
                    <Row gutter={[12, 12]}>
                      <Col span={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <TeamOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                              <Badge status="processing" />
                              {creator.status}
                            </div>
                            <Text type="secondary" style={{ fontSize: 10 }}>建联状态</Text>
                          </div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <RiseOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{creator.order_count}</div>
                            <Text type="secondary" style={{ fontSize: 10 }}>关联订单</Text>
                          </div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <LinkOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {creator.contact_channel || '未设置'}
                            </div>
                            <Text type="secondary" style={{ fontSize: 10 }}>建联渠道</Text>
                          </div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <StarOutlined style={{ color: '#d97706', fontSize: 12 }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#d97706', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {creator.cooperation_type || '未知'}
                            </div>
                            <Text type="secondary" style={{ fontSize: 10 }}>
                              {creator.commission_rate > 0 ? `佣金 ${creator.commission_rate}%` : '合作方式'}
                            </Text>
                          </div>
                        </div>
                      </Col>
                    </Row>

                    {/* 平台信息 */}
                    {creator.parsed.seller_type && (
                      <div style={{
                        marginTop: 12, padding: '8px 12px',
                        background: '#f0fdf4', borderRadius: 8,
                        fontSize: 12, color: PRIMARY, fontWeight: 500,
                      }}>
                        🌐 {creator.parsed.seller_type === 'CROSS_BORDER' ? '跨境卖家' : '本地卖家'}
                        {creator.parsed.selection_region ? ` · 可推广地区: ${creator.parsed.selection_region}` : ''}
                      </div>
                    )}
                  </div>

                  {/* 底部操作 */}
                  <div style={{
                    borderTop: '1px solid #f1f5f9', padding: '10px 20px',
                    display: 'flex', gap: 8, justifyContent: 'space-between',
                  }}>
                    <Button type="primary" size="small"
                      style={{ borderRadius: 6, background: PRIMARY, borderColor: PRIMARY, fontSize: 12 }}
                      onClick={() => window.open(`https://www.tiktok.com/@${creator.influencer_id}`, '_blank')}>
                      查看主页
                    </Button>
                    {creator.order_count > 0 ? (
                      <Tag color="green" style={{ margin: 0 }}>已带货</Tag>
                    ) : (
                      <Tag color="default" style={{ margin: 0 }}>待建联</Tag>
                    )}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </div>
  );
}
