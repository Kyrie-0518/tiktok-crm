import React from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Avatar } from 'antd';
import {
  RobotOutlined, PieChartOutlined, AreaChartOutlined,
  VideoCameraOutlined, SettingOutlined, PictureOutlined,
  FileImageOutlined, PayCircleOutlined, ColumnHeightOutlined,
  FolderOpenOutlined, SendOutlined, ExclamationCircleOutlined,
  BarChartOutlined, UserOutlined, ThunderboltOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import AIStudio from './AIStudio';
import AIAnalysis from './AIAnalysis';
import SkiisAnalysis from './SkiisAnalysis';
import SeedanceVideoGenerator from './SeedanceVideoGenerator';
import VideoModelConfig from './VideoModelConfig';
import MaterialLibrary from './MaterialLibrary';
import RawMaterials from './RawMaterials';
import AdBills from './AdBills';
import ProductMulti from './ProductMulti';
import OperateMaterial from './OperateMaterial';
import ProductPromotion from './ProductPromotion';
import ProblemOrders from './ProblemOrders';
import DataReports from './DataReports';
import UserCenter from './UserCenter';

const { Sider, Content } = Layout;
const { Text } = Typography;

const HEADER_H = 64;

const ROLE_COLOR: Record<string, string> = {
  developer: '#2563eb',
  manager: '#d97706',
  staff: '#059669',
  viewer: '#6b7280',
};

const ROLE_LABEL: Record<string, string> = {
  developer: '开发者',
  manager: '管理员',
  staff: '运营人员',
  viewer: '访客',
};

const STUDIO_MENU_GROUPS = [
  {
    key: 'group-overview',
    label: '',
    items: [
      { key: '/ai-studio', icon: <ThunderboltOutlined />, label: '工作室概览' },
    ],
  },
  {
    key: 'group-analysis',
    label: '数据智能',
    items: [
      { key: '/ai-studio/ai-analysis', icon: <PieChartOutlined />, label: 'AI智能分析' },
      { key: '/ai-studio/skiis', icon: <AreaChartOutlined />, label: 'SKIIS分析' },
    ],
  },
  {
    key: 'group-video',
    label: 'AI 智创视频',
    items: [
      { key: '/ai-studio/seedance', icon: <RobotOutlined />, label: 'AI视频生成' },
      { key: '/ai-studio/material-library', icon: <PictureOutlined />, label: '素材库' },
      { key: '/ai-studio/raw-materials', icon: <FileImageOutlined />, label: '原料素材' },
    ],
  },
  {
    key: 'group-ad',
    label: '广告管理',
    items: [
      { key: '/ai-studio/ad-bills', icon: <PayCircleOutlined />, label: '广告账款' },
      { key: '/ai-studio/product-multi', icon: <ColumnHeightOutlined />, label: '产品多列' },
      { key: '/ai-studio/operate-material', icon: <FolderOpenOutlined />, label: '运营素材' },
      { key: '/ai-studio/product-promotion', icon: <SendOutlined />, label: '商品推广' },
      { key: '/ai-studio/problem-orders', icon: <ExclamationCircleOutlined />, label: '问题订单' },
      { key: '/ai-studio/data-reports', icon: <BarChartOutlined />, label: '数据报表' },
      { key: '/ai-studio/user-center', icon: <UserOutlined />, label: '用户中心' },
    ],
  },
];

function buildStudioMenuItems() {
  const result: any[] = [];
  for (const group of STUDIO_MENU_GROUPS) {
    result.push({
      type: 'group',
      label: group.label ? (
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
          color: '#94a3b8', paddingLeft: 4,
        }}>{group.label}</span>
      ) : undefined,
      children: group.items.map(item => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
      })),
    });
  }
  return result;
}

const allStudioKeys: string[] = [];
for (const g of STUDIO_MENU_GROUPS) for (const i of g.items) allStudioKeys.push(i.key);

export default function AIStudioLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = useAuthStore((s) => s.username);
  const roleKey = useAuthStore((s) => s.roleKey);

  const menuItems = React.useMemo(() => buildStudioMenuItems(), []);

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const getSelectedKeys = (): string[] => {
    const path = location.pathname;
    if (path === '/ai-studio') return ['/ai-studio'];
    const sorted = [...allStudioKeys].sort((a, b) => b.length - a.length);
    for (const k of sorted) {
      if (path === k || path.startsWith(k + '/')) return [k];
    }
    return ['/ai-studio'];
  };

  const handleBack = () => navigate('/dashboard');

  const avatarText = (username || 'User').slice(0, 1).toUpperCase();
  const userRoleLabel = ROLE_LABEL[roleKey || 'staff'];

  return (
    <>
      <style>{`
        :root {
          --studio-primary: #7B61FF;
          --studio-primary-light: #8b5cf6;
          --studio-bg: #f5f3f0;
          --studio-sider-bg: #ffffff;
          --studio-border: #e8e5e0;
          --studio-text: #1e293b;
          --studio-text-secondary: #475569;
          --studio-text-tertiary: #94a3b8;
          --studio-group-label: #94a3b8;
          --studio-selected-bg: rgba(123,97,255,0.08);
          --studio-selected-color: #6d28d9;
          --studio-avatar-bg: #ede9fe;
          --studio-avatar-color: #7B61FF;
          --studio-bottom-border: #f1efe8;
          --studio-bottom-item-color: #64748b;
          --studio-bottom-item-hover-bg: rgba(123,97,255,0.04);
          --studio-bottom-item-active-bg: rgba(123,97,255,0.08);
          --studio-bottom-item-active-color: #7B61FF;
        }
        [data-theme='dark'] {
          --studio-bg: #0f1117;
          --studio-sider-bg: #161820;
          --studio-border: #252836;
          --studio-text: #e8eaed;
          --studio-text-secondary: #9ca3af;
          --studio-text-tertiary: #6b7280;
          --studio-group-label: #6b7280;
          --studio-selected-bg: rgba(123,97,255,0.14);
          --studio-selected-color: #a78bfa;
          --studio-avatar-bg: #232038;
          --studio-avatar-color: #a78bfa;
          --studio-bottom-border: #252836;
          --studio-bottom-item-color: #9ca3af;
          --studio-bottom-item-hover-bg: rgba(123,97,255,0.06);
          --studio-bottom-item-active-bg: rgba(123,97,255,0.12);
          --studio-bottom-item-active-color: #a78bfa;
        }

        .studio-layout .ant-layout { background: transparent; }
        .studio-sider { box-shadow: 2px 0 8px rgba(0,0,0,0.04) !important; }

        .studio-layout .ant-menu-item-group-title {
          padding: 14px 16px 6px 18px !important;
          font-size: 11px; line-height: 1.4;
        }
        .studio-layout .ant-menu-item-group:first-child .ant-menu-item-group-title {
          padding-top: 10px !important;
        }
        .studio-layout .ant-menu-inline .ant-menu-item {
          height: 42px !important;
          line-height: 42px !important;
          margin: 2px 10px !important;
          padding-inline: 12px !important;
          border-radius: 8px !important;
          font-size: 14px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .studio-layout .ant-menu-light .ant-menu-item .anticon,
        .studio-layout .ant-menu-dark .ant-menu-item .anticon {
          color: #94a3b8 !important; font-size: 16px; transition: color 0.2s;
        }
        [data-theme='dark'] .studio-layout .ant-menu-dark .ant-menu-item .anticon {
          color: #6b7280 !important;
        }
        .studio-layout .ant-menu-light .ant-menu-item:hover:not(.ant-menu-item-selected),
        .studio-layout .ant-menu-dark .ant-menu-item:hover:not(.ant-menu-item-selected) {
          background-color: rgba(123,97,255,0.06) !important;
        }
        .studio-layout .ant-menu-light .ant-menu-item:hover:not(.ant-menu-item-selected) .anticon,
        .studio-layout .ant-menu-dark .ant-menu-item:hover:not(.ant-menu-item-selected) .anticon {
          color: var(--studio-primary-light) !important;
        }
        .studio-layout .ant-menu-light .ant-menu-item-selected,
        .studio-layout .ant-menu-dark .ant-menu-item-selected {
          background: linear-gradient(135deg, rgba(123,97,255,0.10), rgba(139,92,246,0.06)) !important;
          color: var(--studio-selected-color) !important;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(123,97,255,0.08);
        }
        .studio-layout .ant-menu-item-selected::after { display: none !important; }
        .studio-layout .ant-menu-item-selected::before {
          content: ''; position: absolute; left: 0; top: 50%;
          transform: translateY(-50%); width: 3px; height: 18px;
          border-radius: 0 3px 3px 0; background: var(--studio-primary);
        }
        .studio-layout .ant-menu-light .ant-menu-item-selected .anticon,
        .studio-layout .ant-menu-dark .ant-menu-item-selected .anticon {
          color: var(--studio-selected-color) !important;
        }

        .studio-content::-webkit-scrollbar { width: 6px; }
        .studio-content::-webkit-scrollbar-track { background: transparent; }
        .studio-content::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        .studio-content::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>

      <div className="studio-layout" style={{ minHeight: '100vh' }}>
        {/* ═══════ 顶部横栏 ═══════ */}
        <div style={{
          height: HEADER_H,
          background: 'var(--studio-sider-bg)',
          borderBottom: '1px solid var(--studio-border)',
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px 0 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {/* 左侧 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #7B61FF, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(123,97,255,0.25)',
              flexShrink: 0,
            }}>
              <ThunderboltOutlined style={{ color: '#fff', fontSize: 18 }} />
            </div>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 700,
                color: 'var(--studio-text)', lineHeight: 1.3,
              }}>AI 工作室</div>
              <div style={{
                fontSize: 12, color: 'var(--studio-text-tertiary)',
                lineHeight: 1.3,
              }}>AI 智能创作中心</div>
            </div>
          </div>

          {/* 右侧 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Text style={{
              fontSize: 14, color: 'var(--studio-text-secondary)',
              fontWeight: 500,
            }}>{userRoleLabel}</Text>
            <Avatar
              size={32}
              style={{
                background: ROLE_COLOR[roleKey || 'staff'],
                color: '#fff', fontWeight: 600, fontSize: 14,
              }}
            >{avatarText}</Avatar>
          </div>
        </div>

        <Layout style={{ paddingTop: HEADER_H, minHeight: '100vh', background: 'var(--studio-bg)' }}>
          {/* 左侧边栏 — 固定 220px，不再支持折叠 */}
          <Sider
            width={220}
            trigger={null}
            className="studio-sider"
            style={{
              background: 'var(--studio-sider-bg)',
              position: 'fixed', left: 0, top: HEADER_H, bottom: 0,
              overflow: 'hidden', zIndex: 100,
              borderRight: '1px solid var(--studio-border)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* 主菜单（无折叠按钮） */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
                <Menu
                  mode="inline"
                  selectedKeys={getSelectedKeys()}
                  items={menuItems}
                  onClick={handleMenuClick}
                  inlineCollapsed={false}
                  inlineIndent={14}
                  style={{
                    borderRight: 0,
                    background: 'var(--studio-sider-bg)',
                    paddingTop: 2,
                  }}
                  theme="light"
                />
              </div>

              {/* 返回主系统按钮 */}
              <div style={{
                borderTop: '1px solid var(--studio-border)',
                padding: '8px 12px',
                backgroundColor: 'var(--studio-sider-bg)',
              }}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={handleBack}
                  style={{
                    width: '100%', justifyContent: 'flex-start',
                    color: 'var(--studio-bottom-item-color)',
                    borderRadius: 8, paddingLeft: 8,
                    fontSize: 14,
                  }}
                >
                  <Text style={{ fontSize: 14, color: 'var(--studio-bottom-item-color)' }}>返回主系统</Text>
                </Button>
              </div>
            </div>
          </Sider>

          {/* 内容区 — 固定 marginLeft: 220 */}
          <Layout style={{
            marginLeft: 220,
            background: 'var(--studio-bg)',
            minHeight: `calc(100vh - ${HEADER_H}px)`,
          }}>
            <Content
              className="studio-content"
              style={{
                padding: '24px',
                minHeight: `calc(100vh - ${HEADER_H}px)`,
                background: 'transparent',
              }}
            >
              <Routes>
                <Route index element={<AIStudio />} />
                <Route path="ai-analysis" element={<AIAnalysis />} />
                <Route path="skiis" element={<SkiisAnalysis />} />
                <Route path="seedance" element={<SeedanceVideoGenerator />} />
                <Route path="video-models" element={<VideoModelConfig />} />
                <Route path="material-library" element={<MaterialLibrary />} />
                <Route path="raw-materials" element={<RawMaterials />} />
                <Route path="ad-bills" element={<AdBills />} />
                <Route path="product-multi" element={<ProductMulti />} />
                <Route path="operate-material" element={<OperateMaterial />} />
                <Route path="product-promotion" element={<ProductPromotion />} />
                <Route path="problem-orders" element={<ProblemOrders />} />
                <Route path="data-reports" element={<DataReports />} />
                <Route path="user-center" element={<UserCenter />} />
                <Route path="*" element={<Navigate to="/ai-studio" replace />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </div>
    </>
  );
}
