import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Button, Typography } from 'antd';
import {
  SettingOutlined, AuditOutlined, SafetyOutlined,
  GlobalOutlined, ArrowLeftOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons';
import AdminDashboard from './AdminDashboard';

const { Sider, Content } = Layout;
const { Text } = Typography;

// ═══════════════════════════════════════════
// 管理后台布局组件（独立页面，类似 AI 工作室）
// ═══════════════════════════════════════════
export default function AdminLayout() {
  const navigate = useNavigate();
  const [siderCollapsed, setSiderCollapsed] = React.useState(false);

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <>
      {/* ═══ 管理后台样式 ═══ */}
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
          --admin-avatar-bg: #dbeafe;
          --admin-avatar-color: #2563eb;
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
          --admin-avatar-bg: #1e293b;
          --admin-avatar-color: #60a5fa;
          --admin-bottom-border: #252836;
          --admin-bottom-item-color: #9ca3af;
          --admin-bottom-item-hover-bg: rgba(37,99,235,0.06);
          --admin-bottom-item-active-bg: rgba(37,99,235,0.12);
          --admin-bottom-item-active-color: #60a5fa;
        }

        .admin-layout {
          min-height: 100vh;
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

      <div className="admin-layout">
        <Layout style={{ minHeight: '100vh', background: 'var(--admin-bg)' }}>
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
              position: 'fixed', left: 0, top: 0, bottom: 0,
              overflow: 'hidden', zIndex: 100,
              borderRight: '1px solid var(--admin-border)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Logo 区域 */}
              <div style={{
                minHeight: 50, display: 'flex', alignItems: 'center',
                justifyContent: siderCollapsed ? 'center' : 'space-between',
                padding: siderCollapsed ? '0' : '0 12px 0 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 3px 10px rgba(37,99,235,0.3)',
                    flexShrink: 0,
                  }}>
                    <SafetyOutlined style={{ fontSize: 17, color: '#fff' }} />
                  </div>
                  {!siderCollapsed && (
                    <span style={{
                      fontSize: 15, fontWeight: 700,
                      color: 'var(--admin-text)', lineHeight: 1.2,
                    }}>管理后台</span>
                  )}
                </div>
                {!siderCollapsed && (
                  <div
                    onClick={() => setSiderCollapsed(!siderCollapsed)}
                    style={{
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      width: 24, height: 24, borderRadius: 4,
                      cursor: 'pointer', color: 'var(--admin-text-tertiary)', fontSize: 12,
                      transition: 'all 0.15s',
                    }}
                  >
                    <MenuFoldOutlined />
                  </div>
                )}
              </div>

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
            minHeight: '100vh',
          }}>
            <Content
              className="admin-content"
              style={{
                padding: '24px',
                minHeight: 'calc(100vh)',
                background: 'transparent',
              }}
            >
              {/* 页面标题 */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 20,
                    boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
                  }}>
                    <SafetyOutlined />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--admin-text)', lineHeight: 1.3 }}>
                      管理后台
                    </h2>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--admin-text-tertiary)' }}>
                      智汇系统管理中心
                    </p>
                  </div>
                </div>
              </div>

              <AdminDashboard embedded />
            </Content>
          </Layout>
        </Layout>
      </div>
    </>
  );
}
