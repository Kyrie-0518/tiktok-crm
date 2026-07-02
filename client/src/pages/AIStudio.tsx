import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin, Button, Tag } from 'antd';
import {
  RobotOutlined,
  PieChartOutlined,
  AreaChartOutlined,
  VideoCameraOutlined,
  SettingOutlined,
  PictureOutlined,
  FileImageOutlined,
  PayCircleOutlined,
  ColumnHeightOutlined,
  FolderOpenOutlined,
  SendOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
  UserOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const { Title, Text } = Typography;

// ═══════════════════════════════════════════
// AI 工作室功能入口定义
// ═══════════════════════════════════════════

interface StudioModule {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  description: string;
  category: 'analysis' | 'video' | 'material' | 'operation' | 'report';
}

const MODULES: StudioModule[] = [
  // ── AI 分析 ──
  { key: 'ai-analysis', label: 'AI智能分析', icon: <PieChartOutlined />, path: '/ai-analysis', color: '#7B61FF', description: 'AI对话代理 + 知识库搜索', category: 'analysis' },
  { key: 'skiis', label: 'SKIIS分析', icon: <AreaChartOutlined />, path: '/skiis', color: '#059669', description: '每日工作沉淀 / 周报生成', category: 'analysis' },
  // ── AI 视频 ──
  { key: 'seedance', label: 'AI视频生成', icon: <RobotOutlined />, path: '/seedance', color: '#8b5cf6', description: '多模型AI视频批量生成', category: 'video' },
  { key: 'video-models', label: '视频模型配置', icon: <VideoCameraOutlined />, path: '/video-models', color: '#2563eb', description: 'Seedance/Kling/MiniMax等模型管理', category: 'video' },
  // ── 素材 ──
  { key: 'material-library', label: '素材库', icon: <PictureOutlined />, path: '/material-library', color: '#0891b2', description: 'AI生成的视频素材管理', category: 'material' },
  { key: 'raw-materials', label: '原料素材', icon: <FileImageOutlined />, path: '/raw-materials', color: '#d97706', description: '原始图片/视频素材上传管理', category: 'material' },
  // ── 运营 ──
  { key: 'ad-bills', label: '广告账款', icon: <PayCircleOutlined />, path: '/ad-bills', color: '#dc2626', description: '广告费用账单管理与追踪', category: 'operation' },
  { key: 'product-multi', label: '产品多列', icon: <ColumnHeightOutlined />, path: '/product-multi', color: '#4f46e5', description: '多维度产品数据展示', category: 'operation' },
  { key: 'operate-material', label: '运营素材', icon: <FolderOpenOutlined />, path: '/operate-material', color: '#ea580c', description: '运营活动素材资源管理', category: 'operation' },
  { key: 'product-promotion', label: '商品推广', icon: <SendOutlined />, path: '/product-promotion', color: '#be185d', description: '商品推广活动管理与效果追踪', category: 'operation' },
  { key: 'problem-orders', label: '问题订单', icon: <ExclamationCircleOutlined />, path: '/problem-orders', color: '#eab308', description: '异常订单处理与追踪', category: 'operation' },
  // ── 报表 & 用户 ──
  { key: 'data-reports', label: '数据报表', icon: <BarChartOutlined />, path: '/data-reports', color: '#0d9488', description: '多维度数据分析报表', category: 'report' },
  { key: 'user-center', label: '用户中心', icon: <UserOutlined />, path: '/user-center', color: '#6366f1', description: '账号信息与偏好设置', category: 'report' },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  analysis: { label: 'AI分析', color: '#7B61FF' },
  video: { label: 'AI视频', color: '#8b5cf6' },
  material: { label: '素材管理', color: '#0891b2' },
  operation: { label: '运营工具', color: '#ea580c' },
  report: { label: '报表中心', color: '#0d9488' },
};

interface StudioStats {
  total_videos: number;
  total_materials: number;
  total_ai_chats: number;
  active_models: number;
  skiis_daily_logs: number;
  pending_ad_bills: number;
  problem_order_count: number;
}

export default function AIStudio() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudioStats();
  }, []);

  const fetchStudioStats = async () => {
    try {
      const res = await api.get('/ai-studio/stats');
      setStats(res.data);
    } catch (e) {
      // 静默失败，使用默认值
      setStats({
        total_videos: 0, total_materials: 0, total_ai_chats: 0,
        active_models: 0, skiis_daily_logs: 0, pending_ad_bills: 0,
        problem_order_count: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // 按分类分组模块
  const groupedModules = Object.entries(
    MODULES.reduce((acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    }, {} as Record<string, StudioModule[]>)
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip="加载 AI 工作室..." />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* ═══ 页面标题 ═══ */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: 'linear-gradient(135deg, #8b5cf6, #7B61FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(139,92,246,0.35)',
        }}>
          <ThunderboltOutlined style={{ fontSize: 22, color: '#fff' }} />
        </div>
        <div>
          <Title level={3} style={{ margin: 0, fontSize: 22, color: 'var(--bo-text-primary)' }}>AI 工作室</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>AI 智能分析 · 视频生成 · 素材管理 · 运营工具</Text>
        </div>
      </div>

      {/* ═══ 统计卡片区 ═══ */}
      <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card className="stat-card-top-border" style={{ borderRadius: 10 }} bodyStyle={{ padding: '16px 20px' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>视频作品</Text>}
              value={stats?.total_videos ?? 0}
              prefix={<VideoCameraOutlined style={{ color: '#8b5cf6' }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: '#8b5cf6' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card className="stat-card-top-border" style={{ borderRadius: 10, borderTopColor: '#0891b2' }} bodyStyle={{ padding: '16px 20px' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>素材总数</Text>}
              value={stats?.total_materials ?? 0}
              prefix={<PictureOutlined style={{ color: '#0891b2' }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: '#0891b2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card className="stat-card-top-border" style={{ borderRadius: 10, borderTopColor: '#7B61FF' }} bodyStyle={{ padding: '16px 20px' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>AI 对话</Text>}
              value={stats?.total_ai_chats ?? 0}
              prefix={<PieChartOutlined style={{ color: '#7B61FF' }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: '#7B61FF' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card className="stat-card-top-border" style={{ borderRadius: 10, borderTopColor: '#059669' }} bodyStyle={{ padding: '16px 20px' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>活跃模型</Text>}
              value={stats?.active_models ?? 0}
              prefix={<SettingOutlined style={{ color: '#059669' }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: '#059669' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card className="stat-card-top-border" style={{ borderRadius: 10, borderTopColor: '#ea580c' }} bodyStyle={{ padding: '16px 20px' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>待处理广告账单</Text>}
              value={stats?.pending_ad_bills ?? 0}
              prefix={<PayCircleOutlined style={{ color: '#ea580c' }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: '#ea580c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card className="stat-card-top-border" style={{ borderRadius: 10, borderTopColor: '#eab308' }} bodyStyle={{ padding: '16px 20px' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>问题订单</Text>}
              value={stats?.problem_order_count ?? 0}
              prefix={<ExclamationCircleOutlined style={{ color: '#eab308' }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: '#eab308' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card className="stat-card-top-border" style={{ borderRadius: 10, borderTopColor: '#059669' }} bodyStyle={{ padding: '16px 20px' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>工作日志</Text>}
              value={stats?.skiis_daily_logs ?? 0}
              prefix={<AreaChartOutlined style={{ color: '#059669' }} />}
              valueStyle={{ fontSize: 26, fontWeight: 700, color: '#059669' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ═══ 功能模块入口（按分类） ═══ */}
      {groupedModules.map(([category, modules]) => (
        <div key={category} style={{ marginBottom: 28 }}>
          {/* 分类标题 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 14, paddingBottom: 8,
            borderBottom: '1px solid var(--bo-border)',
          }}>
            <Tag color={CATEGORY_LABELS[category]?.color} style={{ borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
              {CATEGORY_LABELS[category]?.label}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {modules.length} 个工具
            </Text>
          </div>

          {/* 卡片网格 */}
          <Row gutter={[16, 16]}>
            {modules.map((mod) => (
              <Col xs={24} sm={12} md={8} lg={6} key={mod.key}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 10,
                    borderLeft: `3px solid ${mod.color}`,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  bodyStyle={{ padding: '18px 20px' }}
                  onClick={() => navigate(mod.path)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px rgba(0,0,0,0.1), 0 0 0 1px ${mod.color}20`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = '';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: `${mod.color}12`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: mod.color, fontSize: 19,
                    }}>
                      {mod.icon}
                    </div>
                    <ArrowRightOutlined style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--bo-text-primary)', marginBottom: 4 }}>
                    {mod.label}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>{mod.description}</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );
}
