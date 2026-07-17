import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SettingOutlined, AuditOutlined, SafetyOutlined, KeyOutlined,
  GlobalOutlined, DatabaseOutlined, UserOutlined, DesktopOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import api from '../api';
import type { AxiosResponse } from 'axios';

interface OnlineUser {
  ip: string;
  username: string;
  os: string;
  browser: string;
  last_seen: string;
  request_count: number;
  recent_paths: string[];
  user_agent_raw: string;
}

interface OnlineUsersResponse {
  online_count: number;
  window_seconds: number;
  data: OnlineUser[];
}

interface AdminCard {
  key: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  path: string;
  adminOnly?: boolean;
}

const CARDS: AdminCard[] = [
  {
    key: 'config',
    title: '系统配置',
    desc: '站点参数、API密钥、通知模板',
    icon: <SettingOutlined />,
    color: '#4568FF',
    bgColor: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(37,99,235,0.04))',
    borderColor: 'rgba(37,99,235,0.15)',
    path: '/system-settings?tab=config',
  },
  {
    key: 'permissions',
    title: '用户与权限',
    desc: '账号管理、角色分配、权限控制',
    icon: <KeyOutlined />,
    color: '#8b5cf6',
    bgColor: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.04))',
    borderColor: 'rgba(139,92,246,0.15)',
    path: '/system-settings?tab=permissions',
  },
  {
    key: 'audit',
    title: '操作日志',
    desc: '查看系统操作记录与审计日志',
    icon: <AuditOutlined />,
    color: '#059669',
    bgColor: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(5,150,105,0.04))',
    borderColor: 'rgba(5,150,105,0.15)',
    path: '/system-settings?tab=audit',
  },
  {
    key: 'roles',
    title: '角色与账号',
    desc: '角色模板、账号创建与管理',
    icon: <SafetyOutlined />,
    color: '#d97706',
    bgColor: 'linear-gradient(135deg, rgba(217,119,6,0.08), rgba(217,119,6,0.04))',
    borderColor: 'rgba(217,119,6,0.15)',
    path: '/system-settings?tab=roles',
    adminOnly: true,
  },
  {
    key: 'global-audit',
    title: '全局日志',
    desc: '全系统操作审计追踪',
    icon: <GlobalOutlined />,
    color: '#dc2626',
    bgColor: 'linear-gradient(135deg, rgba(220,38,38,0.08), rgba(220,38,38,0.04))',
    borderColor: 'rgba(220,38,38,0.15)',
    path: '/system-settings?tab=global-audit',
    adminOnly: true,
  },
  {
    key: 'database',
    title: '数据管理',
    desc: '数据库备份、迁移与清理',
    icon: <DatabaseOutlined />,
    color: '#0891b2',
    bgColor: 'linear-gradient(135deg, rgba(8,145,178,0.08), rgba(8,145,178,0.04))',
    borderColor: 'rgba(8,145,178,0.15)',
    path: '/system-settings?tab=config',
    adminOnly: true,
  },
];

export default function AdminDashboard({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const roleKey = useAuthStore((s) => s.roleKey);
  const isDevOrAdmin = roleKey === 'developer' || roleKey === 'manager';

  const visibleCards = CARDS.filter(c => !c.adminOnly || isDevOrAdmin);

  // ── 在线用户 ──
  const [onlineData, setOnlineData] = React.useState<OnlineUsersResponse | null>(null);
  const [onlineLoading, setOnlineLoading] = React.useState(false);
  const fetchOnlineUsers = async () => {
    if (!isDevOrAdmin) return;
    setOnlineLoading(true);
    try {
      const { data }: AxiosResponse<OnlineUsersResponse> = await api.get('/admin/online-users');
      setOnlineData(data);
    } catch { /* 后台静默失败 */ } finally {
      setOnlineLoading(false);
    }
  };
  React.useEffect(() => {
    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 30_000); // 每 30 秒刷新
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso + 'Z');
    // 仅今天显示时分秒，否则显示完整日期
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('zh-CN', { hour12: false });
    }
    return d.toLocaleString('zh-CN', { hour12: false });
  };

  return (
    <div style={{ padding: embedded ? '0' : '24px 28px' }}>
      {/* 页面标题（独立使用场景显示） */}
      {!embedded && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #4568FF, #6B8CFF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20,
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
            }}>
              <SafetyOutlined />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--bo-text-primary)', lineHeight: 1.3 }}>
                管理后台
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--bo-text-tertiary)' }}>
                智汇系统管理中心
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 在线用户面板 ── */}
      {isDevOrAdmin && onlineData !== null && (
        <div style={{
          marginBottom: 24,
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #EEF1F6',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}>
          {/* 面板头部 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: onlineData.data.length > 0 ? '1px solid #EEF1F6' : 'none',
            background: 'linear-gradient(135deg, rgba(37,99,235,0.04), rgba(59,130,246,0.02))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, #4568FF, #6B8CFF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14,
              }}>
                <DesktopOutlined />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#172033' }}>实时在线</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 28, height: 22, borderRadius: 6,
                background: onlineData.online_count > 0 ? '#059669' : '#94a3b8',
                color: '#fff', fontSize: 12, fontWeight: 600,
                padding: '0 8px',
              }}>
                {onlineData.online_count}
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>5分钟内</span>
            </div>
            <div
              onClick={fetchOnlineUsers}
              style={{
                cursor: 'pointer', color: '#64748b', fontSize: 14,
                opacity: onlineLoading ? 0.4 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <ReloadOutlined spin={onlineLoading} />
            </div>
          </div>

          {/* 在线列表 */}
          {onlineData.data.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: 13, color: '#475569',
              }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>IP 地址</th>
                    <th style={thStyle}>用户</th>
                    <th style={thStyle}>操作系统</th>
                    <th style={thStyle}>浏览器</th>
                    <th style={thStyle}>请求数</th>
                    <th style={thStyle}>最后活跃</th>
                    <th style={thStyle}>最近访问</th>
                  </tr>
                </thead>
                <tbody>
                  {onlineData.data.map((u, idx) => (
                    <tr key={u.ip} style={{
                      borderBottom: idx < onlineData.data.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                    }}>
                      <td style={tdStyle}>
                        <code style={{
                          background: '#f1f5f9', padding: '2px 6px', borderRadius: 4,
                          fontSize: 12, fontFamily: 'monospace',
                        }}>
                          {u.ip}
                        </code>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: '#22c55e',
                            boxShadow: '0 0 4px rgba(34,197,94,0.4)',
                            flexShrink: 0,
                          }} />
                          {u.username}
                        </span>
                      </td>
                      <td style={tdStyle}>{u.os}</td>
                      <td style={tdStyle}>{u.browser}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 22, height: 20, borderRadius: 4,
                          background: '#e2e8f0', color: '#334155',
                          fontSize: 11, fontWeight: 600, padding: '0 6px',
                        }}>
                          {u.request_count}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>
                          {formatTime(u.last_seen)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 160 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {u.recent_paths.map((p, i) => (
                            <span key={i} style={{
                              display: 'inline-block',
                              background: '#f1f5f9', color: '#64748b',
                              padding: '1px 6px', borderRadius: 3,
                              fontSize: 11, fontFamily: 'monospace',
                              maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              padding: '28px 20px', textAlign: 'center',
              color: '#94a3b8', fontSize: 13,
            }}>
              <UserOutlined style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
              暂无在线用户 — 等待第一个请求到达...
            </div>
          )}
        </div>
      )}

      {/* 卡片网格 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {visibleCards.map(card => (
          <div
            key={card.key}
            onClick={() => navigate(card.path)}
            style={{
              padding: '24px 22px',
              borderRadius: 14,
              background: '#fff',
              border: `1px solid ${card.borderColor}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
            }}
          >
            {/* 顶部装饰条 */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: 3,
              background: card.bgColor.replace(/rgba\(([\d,]+)\)/, 'rgba($1,1)'),
              borderRadius: '14px 14px 0 0',
            }} />
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: card.bgColor,
                border: `1px solid ${card.borderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: card.color, fontSize: 20,
              }}>
                {card.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 600,
                  color: 'var(--bo-text-primary)',
                }}>
                  {card.title}
                </div>
              </div>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: card.bgColor,
                color: card.color, fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 4,
                fontWeight: 600,
              }}>
                →
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 共享表格样式
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 600,
  color: '#64748b', borderBottom: '1px solid #EEF1F6', whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 14px', whiteSpace: 'nowrap',
};
