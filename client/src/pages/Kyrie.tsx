import React, { useState, useRef, useEffect } from 'react';
import {
  Card, Input, Button, Typography, Space, Tag, message, Tooltip,
  Empty, Drawer, Modal
} from 'antd';
import {
  SendOutlined, ThunderboltOutlined,
  BarChartOutlined, DollarOutlined,
  BookOutlined, UserOutlined,
  ClearOutlined, LoadingOutlined,
  ShopOutlined, ClockCircleOutlined,
  MessageOutlined, PlusOutlined,
  HistoryOutlined, DeleteOutlined,
  StarOutlined, StarFilled, CopyOutlined,
  ExportOutlined, EditOutlined, SearchOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import api from '../api';

const { Text, Title } = Typography;

const QUICK_COMMANDS = [
  { label: '日常询盘', query: '帮我完成今天的询盘工作：查看昨日各店铺销售数据、达人视频表现、广告花费、订单发货情况，复盘整体数据，找出问题并给出优化建议', icon: <BarChartOutlined /> },
  { label: '利润诊断', query: '分析本月各店铺利润情况，定位亏损的订单和产品，给出改进建议', icon: <DollarOutlined /> },
  { label: '达人汇报', query: '生成本周达人合作汇总报告：达人数量、带货数据、佣金支出、合作表现', icon: <UserOutlined /> },
  { label: '发货核查', query: '查看当前有哪些待发货订单，按店铺汇总，提醒超时未发货的异常订单', icon: <ShopOutlined /> },
  { label: '知识问答', query: '马来西亚TikTok Shop最新佣金政策和物流规则', icon: <BookOutlined /> },
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { tool: string; args: any }[];
  latency?: number;
  timestamp: number;
}

interface Session {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  favorite: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  get_shop_stats: '店铺销售数据',
  get_order_list: '订单列表',
  get_finance_overview: '财务利润',
  get_influencer_summary: '达人概况',
  get_ad_overview: '广告数据',
  get_product_performance: '产品表现',
  search_knowledge: '知识库',
  get_exchange_rate: '汇率配置',
};

function makeWelcomeMsg(): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: '### 👋 你好，我是欧文\n\n告诉我你的目标，我会自动调取系统数据并生成分析报告。',
    timestamp: Date.now(),
  };
}

export default function Kyrie() {
  // ── 核心状态 ──
  const [messages, setMessages] = useState<ChatMessage[]>([makeWelcomeMsg()]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [progressText, setProgressText] = useState('');

  // ── 抽屉 & 弹窗 ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // ── refs ──
  const msgEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── 自动滚动 & 聚焦 ──
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, progressText]);
  useEffect(() => { if (!sending) inputRef.current?.focus(); }, [sending]);

  // ── 是否有实际对话（非欢迎消息） ──
  const hasRealConversation = messages.length > 1;
  // 是否首次对话（仅欢迎消息时显示介绍卡片）
  const isFirstVisit = messages.length === 1 && messages[0].id === 'welcome';
  // 当前会话的用户消息
  const userMessages = messages.filter(m => m.role === 'user');

  // ════════════════════════════════════════
  //  发送消息
  // ════════════════════════════════════════
  const sendMessage = async (query: string) => {
    if (!query.trim() || sending) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: query, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSending(true);
    setProgressText('正在分析你的需求...');

    try {
      const timer = setTimeout(() => setProgressText('正在调取系统数据...'), 1500);
      const res = await api.post('/agent/chat', { query: query.trim() });
      clearTimeout(timer);
      setProgressText('');

      const data = res.data;
      let header = '';
      if (data.toolCalls?.length) {
        const summary = data.toolCalls.map((tc: any) => TOOL_LABELS[tc.tool] || tc.tool).join(' → ');
        header = `⚡ 自动调用了 ${data.toolCalls.length} 个工具：${summary}\n\n`;
        if (data.latency_ms) header += `⏱ 耗时 ${(data.latency_ms / 1000).toFixed(1)}s\n\n`;
        header += '---\n\n';
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`, role: 'assistant',
        content: header + (data.report || '分析完成，但未生成报告内容。'),
        toolCalls: data.toolCalls, latency: data.latency_ms, timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setProgressText('');
      const errMsg = err.response?.data?.error || err.message || '请求失败';
      message.error(errMsg);
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: 'assistant',
        content: `❌ 出错了：${errMsg}`, timestamp: Date.now(),
      }]);
    } finally { setSending(false); }
  };

  // ════════════════════════════════════════
  //  快捷指令：填入输入框（不直接发送）
  // ════════════════════════════════════════
  const handleQuickCommand = (cmd: typeof QUICK_COMMANDS[0]) => {
    setInputValue(cmd.query);
    inputRef.current?.focus();
  };

  // ════════════════════════════════════════
  //  新建会话
  // ════════════════════════════════════════
  const handleNewSession = () => {
    if (hasRealConversation) {
      const firstName = userMessages[0]?.content?.slice(0, 30) || '新会话';
      const session: Session = {
        id: `s-${Date.now()}`,
        name: firstName,
        messages: [...messages],
        createdAt: Date.now(),
        favorite: false,
      };
      setSessions(prev => [session, ...prev]);
    }
    setMessages([makeWelcomeMsg()]);
    setInputValue('');
  };

  // ════════════════════════════════════════
  //  清空对话（二次确认）
  // ════════════════════════════════════════
  const handleClear = () => {
    Modal.confirm({
      title: '清空当前对话',
      content: '当前对话内容将被清空（已保存的历史会话不受影响），确认继续？',
      okText: '确认清空',
      cancelText: '取消',
      onOk: () => {
        if (hasRealConversation) {
          const firstName = userMessages[0]?.content?.slice(0, 30) || '未命名';
          const session: Session = { id: `s-${Date.now()}`, name: firstName, messages: [...messages], createdAt: Date.now(), favorite: false };
          setSessions(prev => [session, ...prev]);
        }
        setMessages([makeWelcomeMsg()]);
        setInputValue('');
      },
    });
  };

  // ════════════════════════════════════════
  //  加载历史会话
  // ════════════════════════════════════════
  const loadSession = (session: Session) => {
    setMessages(session.messages);
    setInputValue('');
    setDrawerOpen(false);
  };

  // ════════════════════════════════════════
  //  删除历史会话
  // ════════════════════════════════════════
  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: '删除会话',
      content: '删除后不可恢复',
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: () => setSessions(prev => prev.filter(s => s.id !== id)),
    });
  };

  // ════════════════════════════════════════
  //  收藏切换
  // ════════════════════════════════════════
  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.map(s => s.id === id ? { ...s, favorite: !s.favorite } : s));
  };

  // ════════════════════════════════════════
  //  重命名会话
  // ════════════════════════════════════════
  const startRename = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditName(name);
  };
  const confirmRename = (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name: editName || '未命名' } : s));
    setEditingSessionId(null);
  };

  // ════════════════════════════════════════
  //  定位到某条消息
  // ════════════════════════════════════════
  const scrollToMessage = (id: string) => {
    setDrawerOpen(false);
    setTimeout(() => {
      const el = messageRefs.current[id];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // ════════════════════════════════════════
  //  复制文本
  // ════════════════════════════════════════
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content).then(() => message.success('已复制到剪贴板'));
  };

  // ════════════════════════════════════════
  //  搜索过滤
  // ════════════════════════════════════════
  const filteredSessions = sessions.filter(s => {
    if (!sessionSearch) return true;
    const q = sessionSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.messages.some(m => m.content.toLowerCase().includes(q));
  });
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  // ════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* ─── 1. 顶部导航栏 ─── */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 0', background: '#fff', borderBottom: '1px solid #e8e5e0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ThunderboltOutlined style={{ fontSize: 16, color: '#fff' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#2563eb' }}>欧文</span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>全栈运营智能体</span>
        </div>

        <Space size={4}>
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleNewSession}
            style={{ color: '#64748b', borderRadius: 8, height: 32 }}>
            新建会话
          </Button>
          <Tooltip title="查看历史会话">
            <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => setDrawerOpen(true)}
              style={{ color: '#64748b', borderRadius: 8, height: 32 }}>
              会话归档
            </Button>
          </Tooltip>
          <Button type="text" size="small" icon={<ClearOutlined />} onClick={handleClear}
            style={{ color: '#64748b', borderRadius: 8, height: 32 }}>
            清空
          </Button>
        </Space>
      </div>

      {/* ─── 2. 横向快捷场景条 ─── */}
      <div style={{
        flexShrink: 0, padding: '10px 0', background: '#faf9f7',
        borderBottom: '1px solid #f0ede8',
      }}>
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2,
          scrollbarWidth: 'thin',
        }}>
          {QUICK_COMMANDS.map(cmd => (
            <Button key={cmd.label} size="small" icon={cmd.icon}
              onClick={() => handleQuickCommand(cmd)}
              style={{
                borderRadius: 6, height: 36, flexShrink: 0,
                border: '1px solid #e2e8f0', background: '#fff', color: '#475569',
                fontSize: 13, padding: '0 14px',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#eff6ff';
                e.currentTarget.style.color = '#2563eb';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.color = '#475569';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              {cmd.label}
            </Button>
          ))}
          <Button size="small" icon={<PlusOutlined />}
            style={{
              borderRadius: 6, height: 36, flexShrink: 0,
              border: '1px dashed #d1d5db', background: 'transparent', color: '#94a3b8',
              fontSize: 13, padding: '0 14px',
            }}
            onClick={() => message.info('自定义模板功能即将上线')}
          >
            自定义模板
          </Button>
        </div>
      </div>

      {/* ─── 3. 主对话区域 ─── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: '#faf9f7' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 介绍卡片（仅首次/无对话时显示） */}
          {isFirstVisit && (
            <div style={{
              background: '#fff', borderRadius: 10, padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #e8e5e0',
              lineHeight: 1.6,
            }}>
              <Space style={{ marginBottom: 12 }}>
                <Tag color="blue" style={{ borderRadius: 6, fontSize: 12 }}>跨模块综合分析</Tag>
                <Tag color="orange" style={{ borderRadius: 6, fontSize: 12 }}>达人</Tag>
                <Tag color="purple" style={{ borderRadius: 6, fontSize: 12 }}>广告</Tag>
                <Tag color="green" style={{ borderRadius: 6, fontSize: 12 }}>财务</Tag>
                <Tag style={{ borderRadius: 6, fontSize: 12 }}>产品</Tag>
              </Space>
              <Text style={{ color: '#475569', fontSize: 13 }}>
                我拥有对系统 <strong style={{ color: '#1e293b' }}>店铺 / 订单 / 产品 / 财务 / 达人 / 广告</strong> 的全模块数据访问权限。<br />
                你只需告诉我目标，我会自动判断需要调取哪些数据、用什么分析框架、如何输出报告。
              </Text>
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0f9ff', borderRadius: 8, borderLeft: '3px solid #2563eb' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>💡 试试说：</Text>
                <Space size={16} style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>"帮我完成今日询盘"</Text>
                  <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>"分析本月利润情况"</Text>
                  <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>"查看待发货订单"</Text>
                </Space>
              </div>
            </div>
          )}

          {/* 对话消息流 */}
          {messages.map((msg, idx) => (
            <div key={msg.id}
              ref={el => messageRefs.current[msg.id] = el}
              style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              <div style={{
                maxWidth: msg.role === 'user' ? '80%' : '95%',
                minWidth: msg.role === 'assistant' && idx !== 0 ? '100%' : undefined,
                background: msg.role === 'user' ? '#2563eb' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#334155',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                padding: msg.role === 'user' ? '12px 16px' : '16px 20px',
                fontSize: msg.role === 'user' ? 14 : 15,
                lineHeight: 1.7,
                boxShadow: msg.role === 'user'
                  ? '0 2px 8px rgba(37,99,235,0.2)'
                  : '0 1px 4px rgba(0,0,0,0.04)',
                border: msg.role === 'user' ? 'none' : '1px solid #e8e5e0',
              }}>
                {/* 工具调用标签 */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <Space wrap size={[4, 4]}>
                      {msg.toolCalls.map((tc: any, i: number) => (
                        <Tooltip key={i} title={tc.args ? JSON.stringify(tc.args) : ''}>
                          <Tag color="blue" style={{ fontSize: 11, borderRadius: 6 }}>🔧 {TOOL_LABELS[tc.tool] || tc.tool}</Tag>
                        </Tooltip>
                      ))}
                      {msg.latency && <Tag color="default" style={{ fontSize: 11, borderRadius: 6 }}>⏱ {(msg.latency / 1000).toFixed(1)}s</Tag>}
                    </Space>
                  </div>
                )}

                <div className="wb-markdown">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {/* AI 消息右下角操作按钮 */}
                {msg.role === 'assistant' && idx > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 12, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                    <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyMessage(msg.content)}
                      style={{ color: '#94a3b8', height: 26, fontSize: 12 }}>复制</Button>
                    <Button type="text" size="small" icon={<ExportOutlined />} onClick={() => message.info('导出功能开发中')}
                      style={{ color: '#94a3b8', height: 26, fontSize: 12 }}>导出</Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 执行进度 */}
          {sending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: '#fff', borderRadius: '4px 18px 18px 18px',
                padding: '14px 20px', border: '1px solid #e8e5e0',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <LoadingOutlined style={{ color: '#2563eb' }} />
                <Text type="secondary" style={{ fontSize: 14 }}>{progressText}</Text>
              </div>
            </div>
          )}
          <div ref={msgEndRef} />
        </div>
      </div>

      {/* ─── 4. 底部输入区 ─── */}
      <div style={{
        flexShrink: 0, background: '#fff', borderTop: '1px solid #e8e5e0',
        padding: '14px 24px 18px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            background: '#f8fafc', border: '1px solid #d1d5db',
            borderRadius: 14, padding: '8px 8px 8px 16px',
            transition: 'border-color 0.2s',
          }}>
            <Input.TextArea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) { e.preventDefault(); sendMessage(inputValue); }
              }}
              placeholder="告诉欧文你想做什么，例如：帮我完成今日询盘 / 分析本月利润..."
              autoSize={{ minRows: 3, maxRows: 6 }}
              disabled={sending}
              style={{
                flex: 1, border: 'none', outline: 'none', boxShadow: 'none',
                fontSize: 15, lineHeight: 1.6, resize: 'none',
                background: 'transparent', padding: '8px 0',
              }}
            />
            <Button
              type="primary" icon={sending ? <LoadingOutlined /> : <SendOutlined />}
              onClick={() => sendMessage(inputValue)} loading={sending}
              disabled={!inputValue.trim()}
              style={{
                height: 44, width: 44, borderRadius: 12,
                background: '#2563eb', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                opacity: !inputValue.trim() ? 0.45 : 1,
              }}
            />
          </div>
          <div style={{ marginTop: 6, padding: '0 4px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Shift + Enter 换行 · Enter 发送</Text>
          </div>
        </div>
      </div>

      {/* ═══ 右侧悬浮抽屉：会话管理 ═══ */}
      <Drawer
        title={null} open={drawerOpen} onClose={() => setDrawerOpen(false)}
        width={360} closable={false}
        styles={{ body: { padding: 0 }, header: { display: 'none' } }}
        maskStyle={{ background: 'rgba(15,23,42,0.2)' }}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 抽屉头部 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: '1px solid #e8e5e0',
          }}>
            <Space>
              <HistoryOutlined style={{ color: '#2563eb', fontSize: 18 }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>会话管理</span>
            </Space>
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setDrawerOpen(false)}
              style={{ color: '#94a3b8' }} />
          </div>

          {/* 搜索 */}
          <div style={{ padding: '12px 20px' }}>
            <Input prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="搜索历史会话..."
              size="small" value={sessionSearch}
              onChange={e => setSessionSearch(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </div>

          {/* 历史会话列表 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 12px' }}>
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>历史会话</Text>
            {sortedSessions.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史会话" style={{ marginTop: 40 }} />
            ) : (
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {sortedSessions.map(s => (
                  <div key={s.id}
                    onClick={() => loadSession(s)}
                    style={{
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      background: '#f8fafc', border: '1px solid #e8e5e0',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#bfdbfe'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e5e0'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {/* 名称区域 */}
                      {editingSessionId === s.id ? (
                        <Input size="small" value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onBlur={() => confirmRename(s.id)}
                          onPressEnter={() => confirmRename(s.id)}
                          autoFocus
                          style={{ fontSize: 13, flex: 1, marginRight: 8 }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {s.favorite && <StarFilled style={{ color: '#f59e0b', fontSize: 12 }} />}
                            <Text ellipsis style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>
                              {s.name}
                            </Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {new Date(s.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            &nbsp;· {s.messages.filter(m => m.role === 'user').length} 轮对话
                          </Text>
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <Space size={2} style={{ flexShrink: 0, marginLeft: 8 }}>
                        <Button type="text" size="small"
                          icon={s.favorite ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined />}
                          onClick={e => toggleFavorite(s.id, e)}
                          style={{ color: '#94a3b8', minWidth: 28, height: 28 }} />
                        <Button type="text" size="small" icon={<EditOutlined />}
                          onClick={e => startRename(s.id, s.name, e)}
                          style={{ color: '#94a3b8', minWidth: 28, height: 28 }} />
                        <Button type="text" size="small" icon={<DeleteOutlined />}
                          onClick={e => deleteSession(s.id, e)}
                          style={{ color: '#94a3b8', minWidth: 28, height: 28 }} />
                      </Space>
                    </div>
                  </div>
                ))}
              </Space>
            )}
          </div>

          {/* 分割线 + 当前会话明细 */}
          <div style={{
            borderTop: '1px solid #e8e5e0', padding: '16px 20px',
            maxHeight: 240, overflow: 'auto',
          }}>
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>当前会话</Text>
            {userMessages.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>暂无提问记录</Text>
            ) : (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {userMessages.map((msg, i) => (
                  <Button key={msg.id} block size="small" icon={<MessageOutlined />}
                    onClick={() => scrollToMessage(msg.id)}
                    style={{
                      borderRadius: 8, textAlign: 'left', height: 'auto',
                      padding: '6px 10px', border: '1px solid #e2e8f0',
                      background: '#fff', color: '#475569', fontSize: 12,
                    }}>
                    <Text ellipsis style={{ width: '100%', fontSize: 12 }}>
                      {i + 1}. {msg.content.slice(0, 35)}{msg.content.length > 35 ? '...' : ''}
                    </Text>
                  </Button>
                ))}
              </Space>
            )}
          </div>
        </div>
      </Drawer>

      {/* ═══ 全局样式 ═══ */}
      <style>{`
        .wb-markdown { color: inherit; }
        .wb-markdown h1, .wb-markdown h2, .wb-markdown h3 { margin-top: 14px; margin-bottom: 8px; color: inherit; font-weight: 600; }
        .wb-markdown h1 { font-size: 19px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        .wb-markdown h2 { font-size: 17px; }
        .wb-markdown h3 { font-size: 15px; }
        .wb-markdown p { margin: 4px 0; color: inherit; }
        .wb-markdown ul, .wb-markdown ol { margin: 6px 0; padding-left: 20px; }
        .wb-markdown li { margin: 2px 0; color: inherit; }
        .wb-markdown strong { color: inherit; font-weight: 600; }
        .wb-markdown table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
        .wb-markdown th { background: #f1f5f9; padding: 8px 12px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; color: #334155; }
        .wb-markdown td { padding: 8px 12px; border: 1px solid #e2e8f0; color: #475569; }
        .wb-markdown code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 12px; color: #7c3aed; }
        .wb-markdown pre { background: #1e293b; color: #e2e8f0; padding: 12px 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; margin: 8px 0; }
        .wb-markdown pre code { background: none; color: inherit; padding: 0; }
        .wb-markdown hr { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
        .wb-markdown blockquote { border-left: 3px solid #2563eb; padding-left: 12px; margin: 8px 0; color: #64748b; background: rgba(37,99,235,0.04); padding: 8px 12px; border-radius: 0 6px 6px 0; }
      `}</style>
    </div>
  );
}
