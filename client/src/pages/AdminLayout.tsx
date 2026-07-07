import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Button, Typography, Avatar } from 'antd';
import {
  SafetyOutlined,
  ArrowLeftOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import AdminDashboard from './AdminDashboard';

const { Sider, Content } = Layout;
const { Text } = Typography;

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

// ═══════════════════════════════════════════
// 管理后台布局组件（独立页面，带顶部横栏）
// ═══════════════════════════════════════════
export default function AdminLayout() {
  const navigate = useNavigate();
  const [siderCollapsed, setSiderCollapsed] = React.useState(false);
  const username = useAuthStore((s) => s.username);
  const roleKey = useAuthStore((s) => s.roleKey);

  const handleBack = () => {
    navigate('/dashboard');
  };

  const avatarText = (username || 'User').slice(0, 1).toUpperCase();
  const userRoleLabel = ROLE_LABEL[roleKey || 'staff'];

  return (
    <>
      <style>{`
        :root {
          --admin-primary: #2563eb;
          --admin-primary-light: #3b82f6;
          --admin-bg: #f5f3f0;
          --admin-sider-bg: #ffffff;
          --admin-border: #e8e5e0;
          --admin-text: #1e293b;
          --admin-text-secondary: #475569;
          --admin-text-tertiary: #94a3b8;
          --admin-group-label: #94a3b8;
          --admin-selected-bg: rgba(37,99,235,0.08);
          --admin-selected-color: #1d4ed8;
          --admin-bottom-border: #f1efe8;
          --admin-bottom-item-color: #64748b;
          --admin-bottom-item-hover-bg: rgba(37,99,235,0.04);
          --admin-bottom-item-active-bg: rgba(37,99,235,0.08);
          --admin-bottom-item-active-color: #2563eb;
        }
        [data-theme='dark'] {
          --admin-bg: #0f1117;
          --admin-sider-bg: #161820;
          --admin-border: #252836;
          --admin-text: #e8eaed;
          --admin-text-secondary: #9ca3af;
          --admin-text-tertiary: #6b7280;
          --admin-group-label: #6b7280;
          --admin-selected-bg: rgba(37,99,235,0.14);
          --admin-selected-color: #60a5fa;
          --admin-bottom-border: #252836;
          --admin-bottom-item-color: #9ca3af;
          --admin-bottom-item-hover-bg: rgba(37,99,235,0.06);
          --admin-bottom-item-active-bg: rgba(37,99,235,0.12);
          --admin-bottom-item-active-color: #60a5fa;
        }

        .admin-layout .ant-layout {
          background: transparent;
        }

        .admin-sider {
          box-shadow: 2px 0 8px rgba(0,0,0,0.04) !important;
        }

        .admin-content::-webkit-scrollbar {
          width: 6px;
        }
        .admin-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .admin-content::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        .admin-content::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>

      <div className="admin-layout" style={{ minHeight: '100vh' }}>
        {/* ═══════════════════════════════════════════
           ── 顶部横栏（Header） ──
           ═══════════════════════════════════════════ */}
        <div style={{
          height: 56,
          background: 'var(--admin-sider-bg)',
          borderBottom: '1px solid var(--admin-border)',
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px 0 16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {/* ── 左侧：图标 + 标题 + 副标题 ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
              flexShrink: 0,
            }}>
              <SafetyOutlined style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <div>
              <div style={{
                fontSize: 15, fontWeight: 700,
                color: 'var(--admin-text)', lineHeight: 1.3,
              }}>
                管理后台
              </div>
              <div style={{
                fontSize: 11, color: 'var(--admin-text-tertiary)',
                marginTop: 1, lineHeight: 1.3,
              }}>
                智汇系统管理中心
              </div>
            </div>
          </div>

          {/* ── 右侧：用户角色 + 头像 ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text style={{
              fontSize: 13, color: 'var(--admin-text-secondary)',
              fontWeight: 500, lineHeight: 1,
            }}>
              {userRoleLabel}
            </Text>
            <Avatar
              size={28}
              style={{
                background: ROLE_COLOR[roleKey || 'staff'],
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {avatarText}
            </Avatar>
          </div>
        </div>

        <Layout style={{ paddingTop: 56, minHeight: '100vh' }}>
          {/* ── 左侧边栏 ── */}
          <Sider
            width={220}
            collapsedWidth={56}
            collapsible
            collapsed={siderCollapsed}
            trigger={null}
            className="admin-sider"
            style={{
              background: 'var(--admin-sider-bg)',
              position: 'fixed', left: 0, top: 56, bottom: 0,
              overflow: 'hidden', zIndex: 100,
              borderRight: '1px solid var(--admin-border)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* 展开/折叠按钮 */}
              {!siderCollapsed && (
                <div style={{
                  padding: '10px 16px',
                  display: 'flex', justifyContent: 'flex-end',
                }}>
                  <div
                    onClick={() => setSiderCollapsed(!siderCollapsed)}
                    style={{
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      width: 24, height: 24, borderRadius: 4,
                      cursor: 'pointer', color: 'var(--admin-text-tertiary)', fontSize: 12,
                    }}
                  >
                    <MenuFoldOutlined />
                  </div>
                </div>
              )}

              {/* 内容占位 */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }} />

              {/* 折叠展开按钮 */}
              {siderCollapsed && (
                <div style={{ borderTop: '1px solid var(--admin-border)', padding: '6px 0' }}>
                  <div
                    onClick={() => setSiderCollapsed(!siderCollapsed)}
                    style={{
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      padding: '4px 0', borderRadius: 4,
                      cursor: 'pointer', color: 'var(--admin-text-tertiary)', fontSize: 13,
                    }}
                  >
                    <MenuUnfoldOutlined />
                  </div>
                </div>
              )}

              {/* 返回主系统按钮 */}
              <div style={{
                borderTop: '1px solid var(--admin-border)',
                padding: siderCollapsed ? '8px 0' : '8px 12px',
                backgroundColor: 'var(--admin-sider-bg)',
              }}>
                {siderCollapsed ? (
                  <div
                    onClick={handleBack}
                    style={{
                      display: 'flex', justifyContent: 'center', cursor: 'pointer',
                      color: 'var(--admin-text-tertiary)', fontSize: 16, padding: '4px 0',
                    }}
                    title="返回主系统"
                  >
                    <ArrowLeftOutlined />
                  </div>
                ) : (
                  <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={handleBack}
                    style={{
                      width: '100%', justifyContent: 'flex-start',
                      color: 'var(--admin-bottom-item-color)',
                      borderRadius: 8, paddingLeft: 8,
                      fontSize: 13,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: 'var(--admin-bottom-item-color)' }}>返回主系统</Text>
                  </Button>
                )}
              </div>
            </div>
          </Sider>

          {/* ── 内容区 ── */}
          <Layout style={{
            marginLeft: siderCollapsed ? 56 : 220,
            background: 'var(--admin-bg)',
            transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            minHeight: 'calc(100vh - 56px)',
          }}>
            <Content
              className="admin-content"
              style={{
                padding: '24px',
                minHeight: 'calc(100vh - 56px)',
                background: 'transparent',
              }}
            >
              <AdminDashboard embedded />
            </Content>
          </Layout>
        </Layout>
      </div>
    </>
  );
}
