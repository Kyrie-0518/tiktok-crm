import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Input, Select, Tag, Typography, Button, Space,
  Statistic, Avatar, Rate, Tooltip, Empty, Spin,
} from 'antd';
import {
  SearchOutlined, UserOutlined, TikTokOutlined,
  StarOutlined, EyeOutlined, TeamOutlined,
  HeartOutlined, RiseOutlined, FilterOutlined,
  LinkOutlined, MessageOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;
const PRIMARY = '#059669';

interface Creator {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  followers: number;
  category: string;
  country: string;
  avg_views: number;
  engagement_rate: number;
  commission_preference: string;
  rating: number;
  total_videos: number;
  tags: string[];
}

const MOCK_CREATORS: Creator[] = [
  { id: '1', name: 'BeautyGuru Mia', handle: '@beautygurumia', avatar: '', followers: 2500000, category: '美妆', country: '马来西亚', avg_views: 850000, engagement_rate: 4.2, commission_preference: '纯佣 15%', rating: 4.8, total_videos: 320, tags: ['美妆', '护肤', '测评'] },
  { id: '2', name: 'TechReview Joe', handle: '@techreviewjoe', avatar: '', followers: 1800000, category: '数码', country: '菲律宾', avg_views: 620000, engagement_rate: 3.8, commission_preference: '坑位费 + 10%', rating: 4.6, total_videos: 215, tags: ['数码', '开箱', '测评'] },
  { id: '3', name: 'FashionFinds SG', handle: '@fashionfindssg', avatar: '', followers: 3200000, category: '时尚', country: '新加坡', avg_views: 1200000, engagement_rate: 5.1, commission_preference: '纯佣 12%', rating: 4.9, total_videos: 450, tags: ['时尚', '穿搭', '奢侈品'] },
  { id: '4', name: 'HomeStyle Maria', handle: '@homestylemaria', avatar: '', followers: 950000, category: '家居', country: '马来西亚', avg_views: 380000, engagement_rate: 4.5, commission_preference: '置换', rating: 4.7, total_videos: 180, tags: ['家居', '收纳', '好物'] },
  { id: '5', name: 'FoodLover Ken', handle: '@foodloverken', avatar: '', followers: 2100000, category: '食品', country: '泰国', avg_views: 720000, engagement_rate: 6.2, commission_preference: '纯佣 18%', rating: 4.9, total_videos: 520, tags: ['美食', '测评', '烹饪'] },
  { id: '6', name: 'FitCoach Amy', handle: '@fitcoachamy', avatar: '', followers: 1400000, category: '运动', country: '越南', avg_views: 490000, engagement_rate: 5.8, commission_preference: '坑位费 + 15%', rating: 4.5, total_videos: 280, tags: ['健身', '瑜伽', '装备'] },
  { id: '7', name: 'PetLover David', handle: '@petloverdavid', avatar: '', followers: 870000, category: '宠物', country: '马来西亚', avg_views: 310000, engagement_rate: 7.1, commission_preference: '纯佣 10%', rating: 4.8, total_videos: 165, tags: ['宠物', '用品', '猫狗'] },
  { id: '8', name: 'KidToyReviewer', handle: '@kidtoyreviewer', avatar: '', followers: 2900000, category: '母婴', country: '印尼', avg_views: 980000, engagement_rate: 4.9, commission_preference: '纯佣 14%', rating: 4.7, total_videos: 380, tags: ['母婴', '玩具', '开箱'] },
];

const CATEGORIES = ['全部', '美妆', '数码', '时尚', '家居', '食品', '运动', '宠物', '母婴'];
const COUNTRIES = ['全部', '马来西亚', '菲律宾', '新加坡', '泰国', '越南', '印尼'];
const FOLLOWER_RANGES = [
  { value: 'all', label: '全部粉丝' },
  { value: '100k-500k', label: '10万-50万' },
  { value: '500k-1m', label: '50万-100万' },
  { value: '1m-3m', label: '100万-300万' },
  { value: '3m+', label: '300万+' },
];

export default function CreatorMarket() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('全部');
  const [country, setCountry] = useState('全部');
  const [followerRange, setFollowerRange] = useState('all');

  useEffect(() => {
    setLoading(true);
    // TODO: 接入真实 TikTok Creator Marketplace API
    setTimeout(() => {
      setCreators(MOCK_CREATORS);
      setLoading(false);
    }, 600);
  }, []);

  const filtered = creators.filter(c => {
    if (keyword && !c.name.toLowerCase().includes(keyword.toLowerCase()) && !c.handle.toLowerCase().includes(keyword.toLowerCase())) return false;
    if (category !== '全部' && c.category !== category) return false;
    if (country !== '全部' && c.country !== country) return false;
    if (followerRange === '100k-500k' && (c.followers < 100000 || c.followers > 500000)) return false;
    if (followerRange === '500k-1m' && (c.followers < 500000 || c.followers > 1000000)) return false;
    if (followerRange === '1m-3m' && (c.followers < 1000000 || c.followers > 3000000)) return false;
    if (followerRange === '3m+' && c.followers < 3000000) return false;
    return true;
  });

  const formatFollowers = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const formatViews = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
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
          <Text type="secondary" style={{ fontSize: 13 }}>发现优质 TikTok 带货达人，筛选、对比、一键建联</Text>
        </div>
      </div>

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
          <Select value={category} onChange={setCategory} style={{ width: 120, borderRadius: 8 }}
            options={CATEGORIES.map(c => ({ value: c, label: c }))} />
          <Select value={country} onChange={setCountry} style={{ width: 130, borderRadius: 8 }}
            options={COUNTRIES.map(c => ({ value: c, label: c }))} />
          <Select value={followerRange} onChange={setFollowerRange} style={{ width: 140, borderRadius: 8 }}
            options={FOLLOWER_RANGES} />
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            共 <Text strong style={{ color: PRIMARY }}>{filtered.length}</Text> 位达人
          </Text>
        </div>
      </Card>

      {/* 达人卡片网格 */}
      <Spin spinning={loading}>
        {filtered.length === 0 ? (
          <Empty description="暂无匹配的达人" style={{ marginTop: 40 }} />
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map(creator => (
              <Col xs={24} sm={12} lg={8} xl={6} key={creator.id}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
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
                  {/* 卡片头部 - 渐变背景 */}
                  <div style={{
                    height: 80, padding: '16px 20px 0',
                    background: `linear-gradient(135deg, ${PRIMARY}, #34d399)`,
                    display: 'flex', gap: 12,
                  }}>
                    <Avatar
                      size={56}
                      icon={<UserOutlined />}
                      style={{
                        background: '#fff', color: PRIMARY, fontSize: 24,
                        border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        flexShrink: 0, marginTop: 12,
                      }}
                    />
                    <div style={{ flex: 1, color: '#fff', minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {creator.name}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>{creator.handle}</div>
                      <div style={{ marginTop: 2 }}>
                        <Tag color="blue" style={{ fontSize: 10, background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff' }}>
                          {creator.category}
                        </Tag>
                        <Tag style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff' }}>
                          {creator.country}
                        </Tag>
                      </div>
                    </div>
                  </div>

                  {/* 卡片主体 */}
                  <div style={{ padding: '12px 20px 16px' }}>
                    {/* 核心数据 */}
                    <Row gutter={[12, 12]}>
                      <Col span={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <TeamOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{formatFollowers(creator.followers)}</div>
                            <Text type="secondary" style={{ fontSize: 10 }}>粉丝</Text>
                          </div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <EyeOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{formatViews(creator.avg_views)}</div>
                            <Text type="secondary" style={{ fontSize: 10 }}>均观看</Text>
                          </div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <RiseOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>{creator.engagement_rate}%</div>
                            <Text type="secondary" style={{ fontSize: 10 }}>互动率</Text>
                          </div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <StarOutlined style={{ color: '#d97706', fontSize: 12 }} />
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#d97706' }}>{creator.rating}</div>
                            <Text type="secondary" style={{ fontSize: 10 }}>评分</Text>
                          </div>
                        </div>
                      </Col>
                    </Row>

                    {/* 佣金偏好 */}
                    <div style={{
                      marginTop: 12, padding: '8px 12px',
                      background: '#f0fdf4', borderRadius: 8,
                      fontSize: 12, color: PRIMARY, fontWeight: 500,
                    }}>
                      💰 {creator.commission_preference}
                    </div>

                    {/* 标签 */}
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {creator.tags.map(tag => (
                        <Tag key={tag} style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}>{tag}</Tag>
                      ))}
                    </div>
                  </div>

                  {/* 底部操作 */}
                  <div style={{
                    borderTop: '1px solid #f1f5f9', padding: '10px 20px',
                    display: 'flex', gap: 8, justifyContent: 'space-between',
                  }}>
                    <Button type="primary" size="small" icon={<LinkOutlined />}
                      style={{ borderRadius: 6, background: PRIMARY, borderColor: PRIMARY, fontSize: 12 }}>
                      一键建联
                    </Button>
                    <Button size="small" icon={<MessageOutlined />}
                      onClick={() => window.open(`https://www.tiktok.com/${creator.handle}`, '_blank')}
                      style={{ borderRadius: 6, fontSize: 12 }}>
                      查看主页
                    </Button>
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
