import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, message, Tooltip, Avatar, Dropdown, Badge } from 'antd';
import {
  ShopOutlined, UserOutlined,
  SettingOutlined, LogoutOutlined, RobotOutlined,
  AppstoreOutlined, UnorderedListOutlined,
  DashboardOutlined,
  DollarOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
  SunOutlined, MoonOutlined,
  KeyOutlined, AuditOutlined, SafetyOutlined,
  CaretDownOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuthStore, hasMinRole } from './stores/authStore';
import type { RoleKey } from './stores/authStore';
import { useTheme } from './main';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Finance from './pages/Finance';
import Influencers from './pages/Influencers';
import ShopManagement from './pages/ShopManagement';
import OrderManagement from './pages/OrderManagement';
import SystemSettings from './pages/SystemSettings';
import AIStudioLayout from './pages/AIStudioLayout';
import SkiisWorkbody from './pages/SkiisWorkbody';

const { Sider, Content } = Layout;

const BRAND_COLOR = '#2563eb';

// ═══════════════════════════════════════════
// 菜单分组：按业务功能领域拆分
// ═══════════════════════════════════════════
const MENU_GROUPS = [
  {
    key: 'group-business',
    label: '运营中心',
    items: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
      { key: '/shops', icon: <ShopOutlined />, label: '店铺管理' },
      { key: '/products', icon: <AppstoreOutlined />, label: '产品管理' },
      { key: '/orders', icon: <UnorderedListOutlined />, label: '订单管理' },
    ],
  },
  {
    key: 'group-finance',
    label: '财务',
    items: [
      { key: '/finance', icon: <DollarOutlined />, label: '利润核算' },
      { key: '/influencers', icon: <UserOutlined />, label: '达人BD' },
    ],
  },
  {
    key: 'group-ai-studio',
    label: 'AI 工作室',
    items: [
      { key: '/skiis-workbody', icon: <ThunderboltOutlined />, label: '欧文' },
      { key: '/ai-studio', icon: <RobotOutlined />, label: 'AI 工作室' },
    ],
  },
];

// 系统设置菜单 — 侧边栏底部独立区域，点击跳转 /system-settings?tab=xxx
const SYSTEM_BOTTOM_MENUS = [
  { key: 'config', icon: <SettingOutlined />, label: '系统设置', tabKey: 'config' },
  { key: 'permissions', icon: <KeyOutlined />, label: '用户与权限', tabKey: 'permissions' },
  { key: 'audit-logs', icon: <AuditOutlined />, label: '操作日志', tabKey: 'audit' },
];
const ADMIN_BOTTOM_MENUS = [
  { key: 'admin-roles', icon: <SafetyOutlined />, label: '角色与账号', tabKey: 'roles' },
  { key: 'admin-audit', icon: <AuditOutlined />, label: '全局日志', tabKey: 'global-audit' },
];

// 构建 Ant Design Menu 的 items（含分组标题）
function buildMenuItems() {
  const result: any[] = [];
  for (const group of MENU_GROUPS) {
    result.push({
      type: 'group',
      label: <span style={{
        fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
        color: 'var(--bo-group-label-color)',
        paddingLeft: 4,
      }}>{group.label}</span>,
      children: group.items.map(item => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
      })),
    });
  }
  return result;
}

// 打平所有菜单项 key（用于 selectedKeys 匹配）
const allMenuKeys: string[] = [];
for (const g of MENU_GROUPS) for (const i of g.items) allMenuKeys.push(i.key);

// ═══════════════════════════════════════════
// 权限 & 路由工具
// ═══════════════════════════════════════════

function hasPerm(permissions: Record<string, string>, permKey: string, parentKey?: string): boolean {
  if (!permKey) return true;
  const level = permissions[permKey];
  if (level === 'read' || level === 'edit') return true;
  if (parentKey) {
    const parentLevel = permissions[parentKey];
    if (parentLevel === 'read' || parentLevel === 'edit') return true;
  }
  return false;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const isTokenValid = useAuthStore((s) => s.isTokenValid);
  if (!token || !isTokenValid()) {
    const currentPath = window.location.pathname;
    if (currentPath !== '/login') sessionStorage.setItem('redirect_after_login', currentPath);
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PermRouteGuard({ permKey, parentKey, minRole, children }: {
  permKey?: string; parentKey?: string; minRole?: RoleKey; children: React.ReactNode;
}) {
  const roleKey = useAuthStore((s) => s.roleKey);
  const permissions = useAuthStore((s) => s.permissions);
  if (roleKey === 'developer') return <>{children}</>;
  if (minRole && hasMinRole(roleKey, minRole)) return <>{children}</>;
  if (permKey && hasPerm(permissions, permKey, parentKey)) return <>{children}</>;
  message.warning('权限不足，无法访问该页面');
  return <Navigate to="/dashboard" replace />;
}

// ═══════════════════════════════════════════
// 主布局
// ═══════════════════════════════════════════
function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  // 检测是否在AI工作室页面
  const isInAIStudio = location.pathname.startsWith('/ai-studio');
  const [searchParams] = React.useMemo(() => {
    // 简单解析 URL search params
    const params = new URLSearchParams(location.search);
    return [params];
  }, [location.search]);
  const [siderCollapsed, setSiderCollapsed] = React.useState(false);
  const { isDarkMode, toggleDarkMode } = useTheme();
  const logout = useAuthStore((s) => s.logout);
  const roleKey = useAuthStore((s) => s.roleKey);
  const username = useAuthStore((s) => s.username);
  const displayName = useAuthStore((s) => s.displayName);

  const isDevOrAdmin = roleKey === 'developer' || roleKey === 'manager';

  const ROLE_LABEL: Record<string, string> = { developer: '开发', manager: '管理', staff: '员工' };
  const ROLE_COLOR: Record<string, string> = { developer: '#8b5cf6', manager: '#3b82f6', staff: '#059669' };

  const menuItems = React.useMemo(() => buildMenuItems(), []);

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key.startsWith('/') || key.startsWith('/admin/')) {
      navigate(key);
    }
  };

  const getSelectedKeys = (): string[] => {
    const path = location.pathname;
    if (allMenuKeys.includes(path)) return [path];
    for (const k of allMenuKeys) {
      if (path.startsWith(k + '/')) return [k];
    }
    return [];
  };

  // 取首字母作为 avatar 文字（基于登录账号）
  const avatarText = (username || '?').charAt(0).toUpperCase();

  return (
    <>
    {/* ═══ Bozone 设计系统：全局样式变量 ═══ */}
    <style>{`
      :root {
        --bo-primary: #2563eb;
        --bo-success: #059669;
        --bo-warning: #d97706;
        --bo-danger: #dc2626;
        --bo-bg: #f5f3f0;
        --bo-sider-bg: #faf9f7;
        --bo-border: #e8e5e0;
        --bo-text-primary: #1d2129;
        --bo-text-secondary: #4e5969;
        --bo-text-tertiary: #86909c;
        --bo-logo-color: #1e293b;
        --bo-menu-bg: #faf9f7;
        --bo-content-bg: #f5f3f0;
        --bo-user-color: #475569;
        --bo-user-role-color: #94a3b8;
        --bo-sider-border: #e8e5e0;
        --bo-collapse-border: #e8e5e0;
        --bo-collapse-color: #94a3b8;
        --bo-scrollbar-thumb: rgba(0,0,0,0.12);
        /* 分组标签 */
        --bo-group-label-color: #94a3b8;
        /* 底部区域 */
        --bo-bottom-section-bg: transparent;
        --bo-bottom-section-border: rgba(0,0,0,0.06);
        --bo-bottom-item-color: #64748b;
        --bo-bottom-item-hover-bg: rgba(0,0,0,0.04);
        --bo-bottom-item-active-bg: rgba(37,99,235,0.10);
        --bo-bottom-item-active-color: #2563eb;
        /* 菜单选中态：圆角背景 */
        --bo-selected-bg: rgba(37,99,235,0.09);
        --bo-selected-color: #1d4ed8;
        /* 用户区 */
        --bo-avatar-bg: #e8e5e0;
        --bo-avatar-color: #64748b;
      }
      [data-theme='dark'] {
        --bo-bg: #0f172a;
        --bo-sider-bg: #151c2c;
        --bo-border: #1e293b;
        --bo-text-primary: #f1f5f9;
        --bo-text-secondary: #94a3b8;
        --bo-text-tertiary: #64748b;
        --bo-logo-color: #f1f5f9;
        --bo-menu-bg: #151c2c;
        --bo-content-bg: #0f172a;
        --bo-user-color: #cbd5e1;
        --bo-user-role-color: #64748b;
        --bo-sider-border: #1e293b;
        --bo-collapse-border: #1e293b;
        --bo-collapse-color: #64748b;
        --bo-scrollbar-thumb: rgba(255,255,255,0.18);
        --bo-group-label-color: #556275;
        --bo-bottom-section-bg: transparent;
        --bo-bottom-section-border: rgba(255,255,255,0.06);
        --bo-bottom-item-color: #94a3b8;
        --bo-bottom-item-hover-bg: rgba(255,255,255,0.04);
        --bo-bottom-item-active-bg: rgba(96,165,250,0.12);
        --bo-bottom-item-active-color: #60a5fa;
        --bo-selected-bg: rgba(96,165,250,0.14);
        --bo-selected-color: #93bbfd;
        --bo-avatar-bg: #243045;
        --bo-avatar-color: #94a3b8;
      }

      html, body, #root {
        margin: 0; padding: 0;
        background: var(--bo-bg);
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .ant-layout { background: transparent !important; }

      /* 滚动条 */
      ::-webkit-scrollbar { width: 5px; height: 5px; }
      ::-webkit-scrollbar-thumb { background-color: var(--bo-scrollbar-thumb); border-radius: 4px; }
      ::-webkit-scrollbar-track { background-color: transparent; }

      /* 按钮微阴影 */
      .ant-btn-primary { box-shadow: 0 2px 4px rgba(37,99,235,0.2); }
      .ant-btn-primary:hover { box-shadow: 0 4px 8px rgba(37,99,235,0.3); }

      /* Table */
      .ant-table-thead > tr > th::before { display: none !important; }
      .ant-table-wrapper .ant-table { border-radius: 8px; overflow: hidden; }

      /* Card */
      .ant-card { box-shadow: 0 1px 3px rgba(0,0,0,0.06); }

      /* 统计卡片顶线 */
      .stat-card-top-border { border-top: 3px solid var(--bo-primary); }

      /* ═══ 菜单样式（柔和圆角 + 舒适间距） ═══ */

      /* 分组标题间距 */
      .ant-menu-item-group-list { margin: 0; }
      .ant-menu-item-group { margin-bottom: 0; }
      .ant-menu-item-group:last-child { margin-bottom: 0; }

      /* 分组标题内边距 — 增加上方留白 */
      .ant-menu-item-group-title {
        padding: 16px 16px 6px 20px !important;
        font-size: 11px;
        line-height: 1.4;
      }
      .ant-menu-item-group:first-child .ant-menu-item-group-title {
        padding-top: 12px !important;
      }

      /* 菜单项：舒适高度 + 柔和圆角 */
      .ant-menu-inline .ant-menu-item {
        height: 38px !important;
        line-height: 38px !important;
        margin: 2px 10px !important;
        padding-inline: 12px !important;
        border-radius: 8px !important;
        font-size: 13.5px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }

      /* 子菜单 padding 也同步 */
      .ant-menu-inline .ant-menu-submenu-title {
        height: 38px !important;
        line-height: 38px !important;
        margin: 2px 10px !important;
        border-radius: 8px !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }

      /* 非选中图标颜色 — 柔化 */
      .ant-menu-light .ant-menu-item .anticon,
      .ant-menu-light .ant-menu-submenu-title .anticon {
        color: #94a3b8 !important;
        font-size: 15px;
        transition: color 0.2s;
      }
      .ant-menu-dark .ant-menu-item .anticon,
      .ant-menu-dark .ant-menu-submenu-title .anticon {
        color: #64748b !important;
        font-size: 15px;
        transition: color 0.2s;
      }

      /* 悬停态 — 更明显的柔和反馈 */
      .ant-menu-light .ant-menu-item:hover:not(.ant-menu-item-selected),
      .ant-menu-dark .ant-menu-item:hover:not(.ant-menu-item-selected) {
        background-color: rgba(37,99,235,0.06) !important;
      }
      .ant-menu-light .ant-menu-item:hover:not(.ant-menu-item-selected) .anticon,
      .ant-menu-dark .ant-menu-item:hover:not(.ant-menu-item-selected) .anticon {
        color: #6090e8 !important;
      }

      /* 选中态：柔和渐变背景 + 左侧装饰条 */
      .ant-menu-light .ant-menu-item-selected,
      .ant-menu-dark .ant-menu-item-selected {
        background: linear-gradient(135deg, rgba(37,99,235,0.10), rgba(59,130,246,0.08)) !important;
        color: var(--bo-selected-color) !important;
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(37,99,235,0.08);
        position: relative;
      }
      /* 去掉默认左边框 */
      .ant-menu-light .ant-menu-item-selected::after,
      .ant-menu-dark .ant-menu-item-selected::after {
        display: none !important;
      }
      /* 选中态左侧装饰竖线 */
      .ant-menu-light .ant-menu-item-selected::before,
      .ant-menu-dark .ant-menu-item-selected::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 18px;
        border-radius: 0 3px 3px 0;
        background: var(--bo-primary);
      }

      /* 选中图标颜色 */
      .ant-menu-light .ant-menu-item-selected .anticon { color: var(--bo-selected-color) !important; }
      .ant-menu-dark .ant-menu-item-selected .anticon { color: var(--bo-selected-color) !important; }
    `}</style>

    <Layout style={{ minHeight: '100vh', background: 'var(--bo-bg)' }}>
      {/* ═══ 侧边栏 ═══ */}
      <Sider
        width={220}
        collapsedWidth={56}
        collapsible
        collapsed={siderCollapsed || isInAIStudio}
        trigger={null}
        style={{
          background: 'var(--bo-sider-bg)',
          position: 'fixed', left: 0, top: 0, bottom: 0,
          overflow: 'hidden', zIndex: 100,
          borderRight: '1px solid var(--bo-sider-border)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column',
          // AI工作室页面隐藏主侧边栏
          visibility: isInAIStudio ? 'hidden' : 'visible',
          pointerEvents: isInAIStudio ? 'none' : 'auto',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* ── Logo 区域 ── */}
        <div style={{
          minHeight: 50,
          display: 'flex', alignItems: 'center',
          justifyContent: siderCollapsed ? 'center' : 'space-between',
          padding: siderCollapsed ? '0' : '0 12px 0 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-icon.png" alt="Bozone"
              style={{ width: 28, height: 28, flexShrink: 0 }}
            />
            {!siderCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{
                  fontSize: 15, fontWeight: 700,
                  color: 'var(--bo-logo-color)', lineHeight: 1.2,
                }}>博众智汇</span>
              </div>
            )}
          </div>

          {!siderCollapsed && (
            <div
              onClick={() => setSiderCollapsed(!siderCollapsed)}
              style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                width: 24, height: 24, borderRadius: 4,
                cursor: 'pointer', color: 'var(--bo-collapse-color)', fontSize: 12,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bo-bottom-item-hover-bg)';
                e.currentTarget.style.color = '#2563eb';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--bo-collapse-color)';
              }}
            >
              <MenuFoldOutlined />
            </div>
          )}
        </div>

        {/* ── 主菜单区 ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
          <Menu
            mode="inline"
            selectedKeys={getSelectedKeys()}
            items={menuItems}
            onClick={handleMenuClick}
            inlineCollapsed={siderCollapsed}
            inlineIndent={14}
            style={{
              borderRight: 0,
              background: 'var(--bo-menu-bg)',
              paddingTop: 2,
            }}
            theme={isDarkMode ? 'dark' : 'light'}
          />
        </div>

        {/* 折叠态展开按钮 */}
        {siderCollapsed && (
          <div style={{ borderTop: '1px solid var(--bo-collapse-border)', padding: '6px 0' }}>
            <div
              onClick={() => setSiderCollapsed(!siderCollapsed)}
              style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                padding: '4px 0', borderRadius: 4,
                cursor: 'pointer', color: 'var(--bo-collapse-color)', fontSize: 13,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#2563eb'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--bo-collapse-color)'; }}
            >
              <MenuUnfoldOutlined />
            </div>
          </div>
        )}

        {/* ── 系统设置（紧贴底部） ── */}
        {!siderCollapsed && (
          <div style={{ marginTop: 'auto' }}>
            <div style={{ borderTop: '1px solid var(--bo-bottom-section-border)', margin: '0 12px', paddingTop: 6 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3,
                color: 'var(--bo-group-label-color)',
                paddingLeft: 16, marginBottom: 2, lineHeight: 1.4,
              }}>系统</div>
              {SYSTEM_BOTTOM_MENUS.map(item => (
                <div key={item.key}
                  onClick={() => navigate(`/system-settings?tab=${item.tabKey}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                    color: location.pathname === '/system-settings' && searchParams.get('tab') === item.tabKey
                      ? 'var(--bo-bottom-item-active-color)' : 'var(--bo-bottom-item-color)',
                    fontWeight: (location.pathname === '/system-settings' && searchParams.get('tab') === item.tabKey) ? 600 : 400,
                    background: (location.pathname === '/system-settings' && searchParams.get('tab') === item.tabKey)
                      ? 'var(--bo-bottom-item-active-bg)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!(location.pathname === '/system-settings' && searchParams.get('tab') === item.tabKey))
                      e.currentTarget.style.background = 'var(--bo-bottom-item-hover-bg)';
                  }}
                  onMouseLeave={e => {
                    if (!(location.pathname === '/system-settings' && searchParams.get('tab') === item.tabKey))
                      e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>

            {isDevOrAdmin && (
              <div style={{ borderTop: '1px solid var(--bo-bottom-section-border)', margin: '0 12px', paddingTop: 4, paddingBottom: 2 }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3,
                  color: 'var(--bo-group-label-color)',
                  paddingLeft: 16, marginBottom: 2, lineHeight: 1.4,
                }}>权限</div>
                {ADMIN_BOTTOM_MENUS.map(item => (
                  <div key={item.key}
                    onClick={() => navigate(`/system-settings?tab=${item.tabKey}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                      color: location.pathname === '/system-settings' && searchParams.get('tab') === item.tabKey
                        ? 'var(--bo-bottom-item-active-color)' : 'var(--bo-bottom-item-color)',
                      fontWeight: (location.pathname === '/system-settings' && searchParams.get('tab') === item.tabKey) ? 600 : 400,
                      background: (location.pathname === '/system-settings' && searchParams.get('tab') === item.tabKey)
                        ? 'var(--bo-bottom-item-active-bg)' : 'transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 折叠态底部图标 */}
        {siderCollapsed && (
          <>
            <div style={{ borderTop: '1px solid var(--bo-collapse-border)', margin: '0 8px' }} />
            <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              {[...SYSTEM_BOTTOM_MENUS, ...(isDevOrAdmin ? ADMIN_BOTTOM_MENUS : [])].map(item => (
                <Tooltip key={item.key} title={item.label} placement="right">
                  <div
                    onClick={() => navigate(`/system-settings?tab=${item.tabKey}`)}
                    style={{
                      fontSize: 15, cursor: 'pointer', padding: 4, borderRadius: 4,
                      color: (location.pathname === '/system-settings' && searchParams.get('tab') === item.tabKey)
                        ? 'var(--bo-primary)' : 'var(--bo-group-label-color)',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </div>
                </Tooltip>
              ))}
            </div>
          </>
        )}

        {/* ── 用户区域（企业级） ── */}
        <div style={{
          marginTop: 'auto',
          borderTop: `1px solid var(${isDarkMode ? '--bo-border' : '--bo-bottom-section-border'})`,
          padding: siderCollapsed ? '12px 0 14px' : '12px 14px',
        }}>
          {siderCollapsed ? (
            <Dropdown
              trigger={['click']}
              placement="bottomLeft"
              dropdownRender={() => (
                <div style={{
                  width: 240, padding: '8px 0',
                  background: isDarkMode ? '#151c2c' : '#fff',
                  borderRadius: 10,
                  boxShadow: '0 6px 22px rgba(0,0,0,0.14)',
                  border: `1px solid ${isDarkMode ? '#1e293b' : '#f0f0f0'}`,
                }}>
                  {/* 用户信息卡 */}
                  <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar size={44} style={{
                      background: ROLE_COLOR[roleKey || 'staff'],
                      color: '#fff', fontSize: 18, fontWeight: 700, flexShrink: 0,
                    }}>{avatarText}</Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bo-text-primary)', lineHeight: 1.3 }}>
                        {username || 'User'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--bo-text-tertiary)', marginTop: 2 }}>
                        {username}@bozone.cn
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${isDarkMode ? '#2a3549' : '#f0f0f0'}`, margin: '4px 12px 8px' }} />
                  {/* 菜单项 */}
                  {[
                    { key: 'settings', icon: <SettingOutlined />, label: '系统设置',
                      onClick: () => navigate('/system-settings?tab=config') },
                    { key: 'theme', icon: isDarkMode ? <SunOutlined /> : <MoonOutlined />,
                      label: isDarkMode ? '切换亮色模式' : '切换暗色模式', onClick: toggleDarkMode },
                    { type: 'divider' as const },
                    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true,
                      onClick: () => { logout(); navigate('/login'); } },
                  ].map(item =>
                    item.type === 'divider'
                      ? <div key={`d-${item.key}`} style={{ height: 1, background: isDarkMode ? '#2a3549' : '#f0f0f0', margin: '4px 12px' }} />
                      : <div key={item.key} onClick={(item as any).onClick} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 20px', cursor: 'pointer',
                        transition: 'background 0.15s', fontSize: 13.5,
                        color: (item as any).danger ? '#dc2626' : 'var(--bo-text-primary)',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = isDarkMode ? '#1e293b' : '#f5f5f5'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ fontSize: 15, display: 'flex', alignItems: 'center' }}>{(item as any).icon}</span>
                        <span>{(item as any).label}</span>
                      </div>
                  )}
                </div>
              )}
            >
              <div style={{ cursor: 'pointer', textAlign: 'center' }}>
                <Badge dot status="success" offset={[0, 24]}>
                  <Avatar size={30} style={{
                    background: ROLE_COLOR[roleKey || 'staff'],
                    color: '#fff', fontSize: 13, fontWeight: 600,
                    display: 'block', margin: '0 auto',
                    boxShadow: `0 0 0 2px var(${isDarkMode ? '--bo-sider-bg' : '#faf9f7'})`,
                  }}>{avatarText}</Avatar>
                </Badge>
              </div>
            </Dropdown>
          ) : (
            <Dropdown
              trigger={['click']}
              placement="bottomLeft"
              dropdownRender={() => (
                <div style={{
                  width: 260, padding: '8px 0',
                  background: isDarkMode ? '#151c2c' : '#fff',
                  borderRadius: 10,
                  boxShadow: '0 6px 22px rgba(0,0,0,0.14)',
                  border: `1px solid ${isDarkMode ? '#1e293b' : '#f0f0f0'}`,
                }}>
                  {/* 用户信息卡 */}
                  <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Avatar size={48} style={{
                      background: ROLE_COLOR[roleKey || 'staff'],
                      color: '#fff', fontSize: 19, fontWeight: 700, flexShrink: 0,
                    }}>{avatarText}</Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 650, color: 'var(--bo-text-primary)', lineHeight: 1.3 }}>
                        {username || 'User'}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--bo-text-tertiary)', marginTop: 3 }}>
                        {username}@bozone.cn
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${isDarkMode ? '#2a3549' : '#f0f0f0'}`, margin: '6px 16px 8px' }} />
                  {/* 菜单项 */}
                  {[
                    { key: 'settings', icon: <SettingOutlined />, label: '账户设置',
                      onClick: () => navigate('/system-settings?tab=config') },
                    { key: 'theme', icon: isDarkMode ? <SunOutlined /> : <MoonOutlined />,
                      label: isDarkMode ? '切换亮色模式' : '切换暗色模式', onClick: toggleDarkMode },
                    { type: 'divider' as const },
                    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true,
                      onClick: () => { logout(); navigate('/login'); } },
                  ].map(item =>
                    item.type === 'divider'
                      ? <div key={`d-${item.key}`} style={{ height: 1, background: isDarkMode ? '#2a3549' : '#f0f0f0', margin: '4px 12px' }} />
                      : <div key={item.key} onClick={(item as any).onClick} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 20px', cursor: 'pointer',
                        transition: 'background 0.15s', fontSize: 13.5,
                        color: (item as any).danger ? '#dc2626' : 'var(--bo-text-primary)',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = isDarkMode ? '#1e293b' : '#f5f5f5'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ fontSize: 15, display: 'flex', alignItems: 'center' }}>{(item as any).icon}</span>
                        <span>{(item as any).label}</span>
                      </div>
                  )}
                </div>
              )}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 8px', borderRadius: 10, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
                onMouseLeave={e => e.currentTarget.style.background = 'transparent' }>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                  <Avatar size={36} style={{
                    background: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f0ece4',
                    color: ROLE_COLOR[roleKey || 'staff'], fontSize: 14, fontWeight: 700,
                    flexShrink: 0,
                  }}>{avatarText}</Avatar>
                  <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                    <div style={{
                      fontSize: 13.5, fontWeight: 600,
                      color: 'var(--bo-user-color)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {username || 'User'}
                    </div>
                    <div style={{
                      fontSize: 11.5, fontWeight: 400,
                      color: 'var(--bo-text-tertiary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {username}@bozone.cn
                    </div>
                  </div>
                </div>
                <CaretDownOutlined style={{ fontSize: 10, color: 'var(--bo-group-label-color)', flexShrink: 0 }} />
              </div>
            </Dropdown>
          )}
        </div>
        </div>
      </Sider>

      {/* ═══ 主内容区（无 Header） ═══ */}
      <Layout style={{
        marginLeft: isInAIStudio ? 0 : (siderCollapsed ? 56 : 220),
        background: isInAIStudio ? 'transparent' : 'var(--bo-content-bg)',
        transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <Content style={{
          padding: isInAIStudio ? 0 : '20px',
          height: isInAIStudio ? '100%' : '100vh', overflow: 'auto',
          background: 'transparent',
        }}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<PermRouteGuard permKey="products"><Products /></PermRouteGuard>} />
            <Route path="/shops" element={<PermRouteGuard permKey="shops"><ShopManagement /></PermRouteGuard>} />
            <Route path="/orders" element={<PermRouteGuard permKey="orders"><OrderManagement /></PermRouteGuard>} />
            <Route path="/finance" element={<PermRouteGuard permKey="finance"><Finance /></PermRouteGuard>} />
            <Route path="/influencers" element={<PermRouteGuard permKey="influencers"><Influencers /></PermRouteGuard>} />
            <Route path="/system-settings" element={<SystemSettings />} />
            <Route path="/skiis-workbody" element={<SkiisWorkbody />} />
            <Route path="/ai-studio/*" element={<AIStudioLayout />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
