import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SettingOutlined, AuditOutlined, SafetyOutlined, KeyOutlined,
  GlobalOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';

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
    color: '#2563eb',
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

  return (
    <div style={{ padding: embedded ? '0' : '24px 28px' }}>
      {/* 页面标题（独立使用场景显示） */}
      {!embedded && (
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
