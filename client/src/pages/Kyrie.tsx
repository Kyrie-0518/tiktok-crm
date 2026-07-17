import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Input, Button, Typography, Space, Tag, message, Tooltip, Card, Modal, Badge, Avatar, Dropdown,
} from 'antd';
import {
  SendOutlined, ThunderboltOutlined, BarChartOutlined,
  DollarOutlined, BookOutlined, UserOutlined,
  ClearOutlined, LoadingOutlined, ShopOutlined,
  ClockCircleOutlined, PlusOutlined, DeleteOutlined,
  StarOutlined, StarFilled, CopyOutlined,
  EditOutlined, SearchOutlined, GlobalOutlined,
  HomeOutlined, RobotOutlined, RiseOutlined,
  AppstoreOutlined, SettingOutlined, ApiOutlined,
  SyncOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  BellOutlined, ArrowUpOutlined, ArrowDownOutlined,
  FundOutlined, PictureOutlined, ShoppingOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api';

const { Text, Title } = Typography;

// ════════════════════════════════════════
//  DESIGN TOKENS
// ════════════════════════════════════════
const T = {
  bg: '#F6F8FC',
  cardBg: '#FFFFFF',
  cardShadow: '0 6px 24px rgba(15,23,42,.06)',
  cardBorder: '#EAEDF5',
  cardRadius: 24,
  primary: '#4F6BFF',
  primaryHover: '#3F5AF5',
  primaryLight: '#EEF3FF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  sidebarWidth: 260,
  headerHeight: 72,
  chatBarHeight: 88,
  spacing: { xs: 8, sm: 16, md: 24, lg: 32, xl: 48 },
};

const AGENT_REQUEST_TIMEOUT_MS = 180_000;

// ════════════════════════════════════════
//  SIDEBAR NAV
// ════════════════════════════════════════
const NAV_ITEMS = [
  { key: 'dashboard', icon: <HomeOutlined />, label: '工作台' },
  { key: 'chat', icon: <RobotOutlined />, label: 'AI助手' },
  { key: 'analytics', icon: <FundOutlined />, label: '数据分析' },
  { key: 'products', icon: <AppstoreOutlined />, label: '商品' },
  { key: 'orders', icon: <ShoppingOutlined />, label: '订单' },
  { key: 'finance', icon: <DollarOutlined />, label: '利润' },
  { key: 'influencer', icon: <UserOutlined />, label: '达人' },
  { key: 'ads', icon: <BarChartOutlined />, label: '广告' },
  { key: 'knowledge', icon: <BookOutlined />, label: '知识库' },
  { key: 'settings', icon: <SettingOutlined />, label: '设置' },
];

// ════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════
interface ChatMessage {
  id: string; role: 'user' | 'assistant';
  content: string; toolCalls?: { tool: string; args: any }[];
  latency?: number; timestamp: number;
}
interface Session {
  id: string; name: string; messages: ChatMessage[];
  createdAt: number; favorite: boolean;
}
interface KpiCard {
  label: string; value: string; change: string;
  changeUp: boolean; icon: React.ReactNode;
  bg: string; color: string;
}
interface AgentTask {
  time: string; title: string; status: 'done' | 'running' | 'waiting';
}

const TOOL_LABELS: Record<string, string> = {
  get_shop_stats: '店铺数据', get_order_list: '订单列表',
  get_finance_overview: '财务利润', get_influencer_summary: '达人概况',
  get_ad_overview: '广告数据', get_product_performance: '产品表现',
  search_knowledge: '知识库', get_exchange_rate: '汇率',
  get_tiktok_ad_data: 'TikTok广告',
};

const AI_SUGGESTIONS = [
  { text: '今日利润同比下降 12%，建议检查广告花费', color: '#EF4444' },
  { text: '3 个 SKU 库存低于安全水位，需要补货', color: '#F59E0B' },
  { text: '达人 @alex_beauty 昨日带货转化率 +23%', color: '#22C55E' },
  { text: '物流异常：2 个订单超时未发货', color: '#EF4444' },
];

const MOCK_TASKS: AgentTask[] = [
  { time: '09:12', title: '利润分析', status: 'done' },
  { time: '09:18', title: '广告检查', status: 'done' },
  { time: '09:25', title: '达人汇总', status: 'done' },
  { time: '09:40', title: '日报生成', status: 'done' },
  { time: '10:05', title: '库存扫描', status: 'done' },
  { time: '10:15', title: '询盘复盘', status: 'running' },
];

function makeWelcomeMsg(): ChatMessage {
  return { id: 'welcome', role: 'assistant', content: '你好，我是欧文。有什么需要帮你分析的？', timestamp: Date.now() };
}

// ════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════
export default function Kyrie() {
  // ── 导航 ──
  const [activeNav, setActiveNav] = useState('dashboard');

  // ── 聊天状态（保留核心逻辑） ──
  const [messages, setMessages] = useState<ChatMessage[]>([makeWelcomeMsg()]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const msgEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  const hasRealConversation = messages.length > 1;
  const userMessages = messages.filter(m => m.role === 'user');

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, progressText]);
  useEffect(() => { if (!sending) inputRef.current?.focus(); }, [sending]);
  useEffect(() => {
    if (currentSessionId && messages.length > 1) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...messages] } : s));
    }
  }, [messages, currentSessionId]);

  // ── 发送消息 ──
  const sendMessage = async (query: string) => {
    if (!query.trim() || sending) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: query, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSending(true);
    setProgressText('分析中...');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      timer = setTimeout(() => setProgressText('调取系统数据...'), 1500);
      const res = await api.post('/agent/chat', { query: query.trim() }, { timeout: AGENT_REQUEST_TIMEOUT_MS });
      setProgressText('');
      const data = res.data;
      let header = '';
      if (data.toolCalls?.length) {
        header = `⚡ 调用了 ${data.toolCalls.length} 个工具：${data.toolCalls.map((tc: any) => TOOL_LABELS[tc.tool] || tc.tool).join(' → ')}\n\n`;
        if (data.latency_ms) header += `⏱ ${(data.latency_ms / 1000).toFixed(1)}s\n\n---\n\n`;
      }
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: 'assistant',
        content: header + (data.report || '分析完成'),
        toolCalls: data.toolCalls, latency: data.latency_ms, timestamp: Date.now(),
      }]);
    } catch (err: any) {
      setProgressText('');
      const msg = err.code === 'ECONNABORTED' ? '超时，请重试' : err.response?.data?.error || err.message || '请求失败';
      message.error(msg);
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: `❌ ${msg}`, timestamp: Date.now() }]);
    } finally { if (timer) clearTimeout(timer); setSending(false); }
  };

  // ── 会话管理 ──
  const handleNewSession = () => {
    if (hasRealConversation && !currentSessionId) {
      const name = userMessages[0]?.content?.slice(0, 30) || '新会话';
      const newId = `s-${Date.now()}`;
      setSessions(prev => [{ id: newId, name, messages: [...messages], createdAt: Date.now(), favorite: false }, ...prev]);
      setCurrentSessionId(newId);
    } else if (hasRealConversation && currentSessionId) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...messages] } : s));
    }
    setMessages([makeWelcomeMsg()]); setInputValue('');
  };

  const loadSession = (s: Session) => { setMessages(s.messages); setInputValue(''); setCurrentSessionId(s.id); setActiveNav('chat'); };
  const deleteSession = (id: string, e: React.MouseEvent) => { e.stopPropagation(); Modal.confirm({ title: '删除会话', okType: 'danger', onOk: () => setSessions(prev => prev.filter(s => s.id !== id)) }); };
  const toggleFavorite = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setSessions(prev => prev.map(s => s.id === id ? { ...s, favorite: !s.favorite } : s)); };

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => b.createdAt - a.createdAt), [sessions]);
  const filteredSessions = sortedSessions.filter(s => !sessionSearch || s.name.toLowerCase().includes(sessionSearch.toLowerCase()));

  // ── KPI 数据 ──
  const kpiCards: KpiCard[] = [
    { label: 'GMV', value: 'RM 126,320', change: '12.8%', changeUp: true, icon: <DollarOutlined />, bg: '#EEF3FF', color: '#4F6BFF' },
    { label: '利润', value: 'RM 38,450', change: '5.2%', changeUp: true, icon: <RiseOutlined />, bg: '#FFF6E8', color: '#F59E0B' },
    { label: '订单', value: '1,284', change: '8.1%', changeUp: true, icon: <ShoppingOutlined />, bg: '#F2F7FF', color: '#3B82F6' },
    { label: '广告 ROAS', value: '4.59', change: '0.8%', changeUp: false, icon: <BarChartOutlined />, bg: '#F6F0FF', color: '#8B5CF6' },
    { label: '达人', value: '32', change: '15.3%', changeUp: true, icon: <UserOutlined />, bg: '#F0FDF4', color: '#22C55E' },
    { label: '库存', value: '98.5%', change: '0.3%', changeUp: false, icon: <AppstoreOutlined />, bg: '#FFF1F2', color: '#EF4444' },
  ];

  // ── JSX ──
  return (
    <div style={{ display: 'flex', height: '100vh', background: T.bg, fontFamily: '"PingFang SC", -apple-system, "Inter", sans-serif', overflow: 'hidden' }}>

      {/* ═══════════════════ LEFT SIDEBAR 260px ═══════════════════ */}
      <div style={{ width: T.sidebarWidth, flexShrink: 0, background: T.cardBg, borderRight: `1px solid ${T.cardBorder}`, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Logo */}
        <div style={{ height: T.headerHeight, display: 'flex', alignItems: 'center', padding: `0 ${T.spacing.md}px`, gap: 12, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, #6B8CFF, ${T.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${T.primary}40` }}>
            <ThunderboltOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, lineHeight: 1.2 }}>Bozone</div>
            <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1 }}>AI Workspace</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: `16px 12px`, overflow: 'auto' }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {NAV_ITEMS.map(item => {
              const active = activeNav === item.key;
              return (
                <div key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, height: 40, padding: '0 14px', borderRadius: 12,
                    cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 500,
                    color: active ? '#fff' : T.textSecondary,
                    background: active ? T.primary : 'transparent',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#F5F7FF'; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; } }}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.key === 'chat' && (
                    <Badge count={sending ? 0 : messages.length - 1} size="small" style={{ marginLeft: 'auto' }} styles={{ indicator: { background: T.textTertiary } }} />
                  )}
                </div>
              );
            })}
          </Space>
        </nav>

        {/* Session list */}
        <div style={{ borderTop: `1px solid ${T.cardBorder}`, flexShrink: 0, maxHeight: 260, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: T.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>最近对话</Text>
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleNewSession} style={{ color: T.textTertiary, fontSize: 12 }} />
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
            {filteredSessions.slice(0, 6).map(s => (
              <div key={s.id}
                onClick={() => loadSession(s)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                  fontSize: 13, color: T.textSecondary, transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F5F7FF'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text ellipsis style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, display: 'block' }}>{s.name}</Text>
                  <Text style={{ fontSize: 11, color: T.textTertiary }}>
                    {new Date(s.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {' '}· {s.messages.filter(m => m.role === 'user').length} 问
                  </Text>
                </div>
                <Space size={1} style={{ flexShrink: 0, marginLeft: 4 }}>
                  {s.favorite ? <StarFilled style={{ color: '#F59E0B', fontSize: 12 }} /> : <StarOutlined style={{ fontSize: 12, color: T.textTertiary }} />}
                  <Button type="text" size="small" icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                    onClick={e => deleteSession(s.id, e)} style={{ color: T.textTertiary, minWidth: 22, height: 22, padding: 0 }} />
                </Space>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════ MAIN CONTENT ═══════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* ── HEADER 72px ── */}
        <header style={{
          height: T.headerHeight, flexShrink: 0, background: T.cardBg, borderBottom: `1px solid ${T.cardBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${T.spacing.lg}px`,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>欢迎回来</div>
            <Text style={{ fontSize: 13, color: T.textTertiary }}>今天是 {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</Text>
          </div>
          <Space size={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#F0FDF4', fontSize: 12, color: '#16A34A' }}>
              <Badge status="success" /> 欧文在线
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.textTertiary }}>
              已连接 <span style={{ color: T.primary, fontWeight: 600 }}>TikTok Shop</span> · <span style={{ color: T.primary, fontWeight: 600 }}>Ads</span> · <span style={{ color: T.primary, fontWeight: 600 }}>ERP</span>
            </div>
            <BellOutlined style={{ fontSize: 18, color: T.textSecondary, cursor: 'pointer' }} />
            <Avatar size={36} style={{ background: T.primary }} icon={<UserOutlined />} />
          </Space>
        </header>

        {/* ── MAIN AREA (DASHBOARD or CHAT) ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: `${T.spacing.lg}px`, paddingBottom: T.chatBarHeight + 16 }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>

            {activeNav === 'dashboard' && (
              <>
                {/*── KPI Row (Bento Grid) ──*/}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                  {kpiCards.map(kpi => (
                    <Card key={kpi.label}
                      hoverable
                      style={{
                        borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`,
                        boxShadow: T.cardShadow, transition: 'all 0.2s',
                      }}
                      bodyStyle={{ padding: '20px 24px' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                          <Text style={{ fontSize: 13, color: T.textTertiary, fontWeight: 500 }}>{kpi.label}</Text>
                          <div style={{ fontSize: 28, fontWeight: 700, color: T.textPrimary, marginTop: 4, fontFamily: '"Inter", -apple-system, sans-serif' }}>
                            {kpi.value}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            {kpi.changeUp ? <ArrowUpOutlined style={{ color: '#22C55E', fontSize: 12 }} /> : <ArrowDownOutlined style={{ color: '#EF4444', fontSize: 12 }} />}
                            <Text style={{ fontSize: 12, color: kpi.changeUp ? '#22C55E' : '#EF4444', fontWeight: 600 }}>{kpi.change}</Text>
                            <Text style={{ fontSize: 12, color: T.textTertiary }}>vs 昨日</Text>
                          </div>
                        </div>
                        <div style={{
                          width: 48, height: 48, borderRadius: 16, background: kpi.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22, color: kpi.color,
                        }}>
                          {kpi.icon}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/*── Trend Chart + AI Suggestions ──*/}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
                  <Card style={{ borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow }}
                    bodyStyle={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Text strong style={{ fontSize: 16, color: T.textPrimary }}>GMV 趋势</Text>
                      <Space size={8}>
                        {['7天', '30天', '90天'].map(p => <Tag key={p} style={{ borderRadius: 8, cursor: 'pointer', border: 'none', background: p === '7天' ? T.primaryLight : '#F1F5F9', color: p === '7天' ? T.primary : T.textSecondary, fontSize: 12 }}>{p}</Tag>)}
                      </Space>
                    </div>
                    {/* 简易柱状图占位 */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 180, padding: '8px 0' }}>
                      {[126, 142, 108, 168, 132, 156, 148].map((v, i) => {
                        const h = `${(v / 180) * 100}%`;
                        const days = ['7/9', '7/10', '7/11', '7/12', '7/13', '7/14', '7/15'];
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 11, color: T.textPrimary, fontWeight: 600 }}>{v}</Text>
                            <div style={{
                              width: '100%', height: h, borderRadius: '10px 10px 4px 4px',
                              background: `linear-gradient(180deg, ${T.primary}88, ${T.primary})`,
                              minHeight: 4, transition: 'height 0.3s',
                            }} />
                            <Text style={{ fontSize: 11, color: T.textTertiary }}>{days[i]}</Text>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  {/* AI Suggestions */}
                  <Card style={{ borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow }}
                    bodyStyle={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 10, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ThunderboltOutlined style={{ color: T.primary, fontSize: 14 }} />
                      </div>
                      <Text strong style={{ fontSize: 16, color: T.textPrimary }}>AI 建议</Text>
                    </div>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {AI_SUGGESTIONS.map((s, i) => (
                        <div key={i}
                          style={{
                            padding: '12px 16px', borderRadius: 16, cursor: 'pointer',
                            background: '#FAFBFC', border: '1px solid transparent',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = T.primaryLight; e.currentTarget.style.borderColor = T.primary + '20'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#FAFBFC'; e.currentTarget.style.borderColor = 'transparent'; }}
                          onClick={() => { setInputValue(s.text); inputRef.current?.focus(); }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: 3, background: s.color, marginTop: 6, flexShrink: 0 }} />
                            <Text style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>{s.text}</Text>
                          </div>
                        </div>
                      ))}
                    </Space>
                  </Card>
                </div>

                {/*── Recent Agent Tasks ──*/}
                <Card style={{ borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow }}
                  bodyStyle={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <ClockCircleOutlined style={{ color: T.textSecondary }} />
                    <Text strong style={{ fontSize: 16, color: T.textPrimary }}>最近任务</Text>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {MOCK_TASKS.map((t, i) => (
                      <div key={i}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                          borderRadius: 16, background: '#FAFBFC', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = T.primaryLight; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FAFBFC'; }}
                      >
                        {t.status === 'done' ? (
                          <CheckCircleOutlined style={{ color: '#22C55E', fontSize: 18 }} />
                        ) : t.status === 'running' ? (
                          <SyncOutlined spin style={{ color: T.primary, fontSize: 18 }} />
                        ) : (
                          <ClockCircleOutlined style={{ color: T.textTertiary, fontSize: 18 }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <Text style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, display: 'block' }}>{t.title}</Text>
                          <Text style={{ fontSize: 11, color: T.textTertiary }}>{t.time}</Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {/*── Chat View ──*/}
            {activeNav === 'chat' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map(msg => {
                  if (msg.id === 'welcome') return null;
                  return (
                    <div key={msg.id}
                      style={{
                        display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      }}>
                      <div style={{
                        maxWidth: msg.role === 'user' ? '70%' : '100%',
                        background: msg.role === 'user' ? T.primary : '#FAFBFC',
                        color: msg.role === 'user' ? '#fff' : T.textSecondary,
                        borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
                        padding: msg.role === 'user' ? '12px 18px' : '16px 20px',
                        fontSize: 14, lineHeight: 1.65,
                        boxShadow: msg.role === 'user' ? `0 2px 8px ${T.primary}30` : '0 1px 3px rgba(0,0,0,.04)',
                        border: msg.role === 'user' ? 'none' : `1px solid ${T.cardBorder}`,
                      }}>
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <Space wrap size={[4, 4]}>
                              {msg.toolCalls.map((tc, i) => (
                                <Tag key={i} color="blue" style={{ borderRadius: 8, fontSize: 11 }}>🔧 {TOOL_LABELS[tc.tool] || tc.tool}</Tag>
                              ))}
                              {msg.latency && <Tag style={{ borderRadius: 8, fontSize: 11 }}>⏱ {(msg.latency / 1000).toFixed(1)}s</Tag>}
                            </Space>
                          </div>
                        )}
                        <div className="wb-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                        {msg.role === 'assistant' && (
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.cardBorder}`, textAlign: 'right' }}>
                            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => navigator.clipboard.writeText(msg.content)}
                              style={{ color: T.textTertiary, fontSize: 12 }}>复制</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {sending && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ background: '#FAFBFC', borderRadius: '4px 20px 20px 20px', padding: '14px 20px', border: `1px solid ${T.cardBorder}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LoadingOutlined style={{ color: T.primary }} /><Text style={{ fontSize: 14, color: T.textSecondary }}>{progressText}</Text>
                    </div>
                  </div>
                )}
                <div ref={msgEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════ BOTTOM CHAT BAR 88px ═══════════════════ */}
        <div style={{
          flexShrink: 0, background: T.cardBg, borderTop: `1px solid ${T.cardBorder}`,
          padding: '12px 32px', height: T.chatBarHeight, display: 'flex', alignItems: 'center',
        }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Left: quick actions */}
            <Space size={4}>
              <Button type="text" icon={<PlusOutlined />} style={{ color: T.textTertiary, borderRadius: 10 }} />
              <Button type="text" icon={<PictureOutlined />} style={{ color: T.textTertiary, borderRadius: 10 }} />
              <Button type="text" icon={<BookOutlined />} style={{ color: T.textTertiary, borderRadius: 10 }} />
            </Space>
            {/* Input */}
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', background: '#F8FAFC',
              border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: '3px 3px 3px 16px',
            }}>
              <Input.TextArea
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); sendMessage(inputValue); } }}
                placeholder="告诉欧文今天需要完成什么... 例如：帮我分析利润 / 检查达人 / 生成日报"
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={sending}
                style={{
                  flex: 1, border: 'none', outline: 'none', boxShadow: 'none', fontSize: 14, lineHeight: 1.6,
                  resize: 'none', background: 'transparent', padding: '6px 0',
                }}
              />
              <Button
                type="primary"
                icon={sending ? <LoadingOutlined /> : <SendOutlined />}
                onClick={() => sendMessage(inputValue)}
                loading={sending}
                disabled={!inputValue.trim()}
                style={{
                  height: 40, width: 40, borderRadius: 12, background: T.primary, border: 'none',
                  boxShadow: `0 2px 8px ${T.primary}40`, opacity: !inputValue.trim() ? 0.4 : 1,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ Markdown Styles ═══════ */}
      <style>{`
        .wb-markdown { color: inherit; }
        .wb-markdown h1, .wb-markdown h2, .wb-markdown h3 { margin-top: 14px; margin-bottom: 8px; font-weight: 600; color: inherit; }
        .wb-markdown h1 { font-size: 19px; border-bottom: 2px solid #EAEDF5; padding-bottom: 6px; }
        .wb-markdown h2 { font-size: 17px; }
        .wb-markdown h3 { font-size: 15px; }
        .wb-markdown p { margin: 4px 0; color: inherit; }
        .wb-markdown ul, .wb-markdown ol { margin: 6px 0; padding-left: 20px; }
        .wb-markdown li { margin: 2px 0; }
        .wb-markdown strong { font-weight: 600; }
        .wb-markdown table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
        .wb-markdown th { background: #F1F5F9; padding: 8px 12px; text-align: left; border: 1px solid #EAEDF5; font-weight: 600; color: #334155; }
        .wb-markdown td { padding: 8px 12px; border: 1px solid #EAEDF5; color: #475569; }
        .wb-markdown code { background: #F1F5F9; padding: 1px 5px; border-radius: 4px; font-size: 12px; color: #8B5CF6; }
        .wb-markdown pre { background: #1E293B; color: #E2E8F0; padding: 12px 16px; border-radius: 12px; overflow-x: auto; font-size: 13px; margin: 8px 0; }
        .wb-markdown pre code { background: none; color: inherit; padding: 0; }
        .wb-markdown hr { border: none; border-top: 1px solid #EAEDF5; margin: 14px 0; }
      `}</style>
    </div>
  );
}
