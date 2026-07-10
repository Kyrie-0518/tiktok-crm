import React, { useState, useRef, useEffect } from 'react';
import {
  Card, Input, Button, Typography, Space, Tag, message, Tooltip, Divider, Empty
} from 'antd';
import {
  SendOutlined, ThunderboltOutlined,
  BarChartOutlined, DollarOutlined,
  BookOutlined, UserOutlined,
  ClearOutlined, LoadingOutlined,
  ShopOutlined, ClockCircleOutlined,
  MessageOutlined, PlusOutlined,
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

export default function SkiisWorkbody() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '### 👋 你好，我是欧文\n\n告诉我你的目标，我会自动调取系统数据并生成分析。',
      timestamp: Date.now(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [progressText, setProgressText] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progressText]);

  useEffect(() => {
    if (!sending) inputRef.current?.focus();
  }, [sending]);

  const sendMessage = async (query: string) => {
    if (!query.trim() || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSending(true);
    setProgressText('🤔 正在分析你的需求...');

    try {
      const progressTimer = setTimeout(() => setProgressText('🔍 正在调取系统数据...'), 1500);
      const res = await api.post('/agent/chat', { query: query.trim() });
      clearTimeout(progressTimer);

      const data = res.data;
      setProgressText('');

      let header = '';
      if (data.toolCalls?.length) {
        const toolSummary = data.toolCalls
          .map((tc: any) => TOOL_LABELS[tc.tool] || tc.tool)
          .join(' → ');
        header = `⚡ **自动调用了 ${data.toolCalls.length} 个工具**：${toolSummary}\n\n`;
        if (data.latency_ms) header += `⏱️ 耗时 ${(data.latency_ms / 1000).toFixed(1)}s\n\n`;
        header += '---\n\n';
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: header + (data.report || '分析完成，但未生成报告内容。'),
        toolCalls: data.toolCalls,
        latency: data.latency_ms,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setProgressText('');
      const errMsg = err.response?.data?.error || err.message || '请求失败';
      message.error(errMsg);
      const errorMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `❌ **出错了**：${errMsg}\n\n请检查后端服务是否正常运行。`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleQuickCommand = (cmd: typeof QUICK_COMMANDS[0]) => {
    setInputValue(cmd.query);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '### 👋 对话已清空\n\n我是欧文，随时为你服务。直接告诉我你的需求即可。',
      timestamp: Date.now(),
    }]);
  };

  const scrollToMessage = (id: string) => {
    const el = messageRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const userMessages = messages.filter(m => m.role === 'user');

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 80px)', padding: '0 0 0 0' }}>
      {/* ── 左侧：对话主区域 ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* 页面标题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexShrink: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ThunderboltOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#1e293b', letterSpacing: 0.5 }}>欧文</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              全栈运营智能体 · 一句话驱动全模块数据分析
            </Text>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Button icon={<ClearOutlined />} size="small" onClick={handleClear} style={{ borderRadius: 8 }}>
              清空对话
            </Button>
          </div>
        </div>

        {/* 对话 + 输入合并卡片 */}
        <Card
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            border: '1px solid #e8e5e0', overflow: 'hidden',
          }}
          bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        >
          {/* 消息列表 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {messages.map((msg, idx) => (
                <div
                  key={msg.id}
                  ref={el => messageRefs.current[msg.id] = el}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: msg.role === 'user' ? '82%' : '90%',
                      background: msg.role === 'user' ? '#2563eb' : '#f8fafc',
                      color: msg.role === 'user' ? '#ffffff' : '#334155',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                      padding: msg.role === 'user' ? '14px 18px' : '16px 20px',
                      fontSize: 15,
                      lineHeight: 1.75,
                      boxShadow: msg.role === 'user'
                        ? '0 2px 8px rgba(37,99,235,0.25)'
                        : '0 1px 3px rgba(0,0,0,0.04)',
                      border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                    }}
                  >
                    {/* 工具调用标签 */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <Space wrap size={[4, 4]}>
                          {msg.toolCalls.map((tc: any, i: number) => (
                            <Tooltip key={i} title={tc.args ? JSON.stringify(tc.args) : ''}>
                              <Tag
                                color="blue"
                                style={{ fontSize: 11, borderRadius: 6, cursor: 'default' }}
                              >
                                🔧 {TOOL_LABELS[tc.tool] || tc.tool}
                              </Tag>
                            </Tooltip>
                          ))}
                          {msg.latency && (
                            <Tag color="default" style={{ fontSize: 11, borderRadius: 6 }}>
                              ⏱ {(msg.latency / 1000).toFixed(1)}s
                            </Tag>
                          )}
                        </Space>
                      </div>
                    )}

                    <div className="workbody-markdown">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}

              {sending && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    background: '#f8fafc', borderRadius: '4px 18px 18px 18px',
                    padding: '12px 20px', border: '1px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <LoadingOutlined style={{ color: '#2563eb' }} />
                    <Text type="secondary" style={{ fontSize: 13 }}>{progressText}</Text>
                  </div>
                </div>
              )}
              <div ref={msgEndRef} />
            </div>
          </div>

          {/* 合并输入区域 */}
          <div style={{
            borderTop: '1px solid #e8e5e0',
            background: '#faf9f7',
            padding: '16px 24px 20px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 12,
              background: '#fff', border: '1px solid #d1d5db',
              borderRadius: 16, padding: '8px 8px 8px 16px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <Input.TextArea
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    sendMessage(inputValue);
                  }
                }}
                placeholder="告诉欧文你想做什么，例如：帮我完成今日询盘 / 分析本月利润 / 查看待发货订单..."
                autoSize={{ minRows: 3, maxRows: 6 }}
                disabled={sending}
                style={{
                  flex: 1, border: 'none', outline: 'none', boxShadow: 'none',
                  fontSize: 15, lineHeight: 1.6, resize: 'none',
                  background: 'transparent', padding: '8px 0',
                }}
              />
              <Button
                type="primary"
                icon={sending ? <LoadingOutlined /> : <SendOutlined />}
                onClick={() => sendMessage(inputValue)}
                loading={sending}
                disabled={!inputValue.trim()}
                style={{
                  height: 44, width: 44, borderRadius: 12,
                  background: '#2563eb', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                  opacity: !inputValue.trim() ? 0.5 : 1,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 4px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Enter 发送 · Shift+Enter 换行
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                AI 生成内容仅供参考
              </Text>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 右侧：快捷指令 + 历史对话 ── */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 快捷指令 */}
        <Card
          title={<Space><ThunderboltOutlined /> <span>快捷场景</span></Space>}
          style={{ borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}
          bodyStyle={{ padding: 12 }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {QUICK_COMMANDS.map(cmd => (
              <Button
                key={cmd.label}
                block
                size="small"
                icon={cmd.icon}
                onClick={() => handleQuickCommand(cmd)}
                style={{
                  borderRadius: 10, textAlign: 'left', height: 40,
                  border: '1px solid #e2e8f0', background: '#fff', color: '#475569',
                }}
              >
                {cmd.label}
              </Button>
            ))}
          </Space>
        </Card>

        {/* 历史对话 */}
        <Card
          title={<Space><ClockCircleOutlined /> <span>当前会话</span></Space>}
          style={{ flex: 1, borderRadius: 14, border: '1px solid #e8e5e0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}
          bodyStyle={{ padding: 12, overflow: 'auto' }}
        >
          {userMessages.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无对话记录" />
          ) : (
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {userMessages.map((msg, i) => (
                <Button
                  key={msg.id}
                  block
                  size="small"
                  icon={<MessageOutlined />}
                  onClick={() => scrollToMessage(msg.id)}
                  style={{
                    borderRadius: 10, textAlign: 'left', height: 'auto',
                    padding: '8px 12px', whiteSpace: 'normal', lineHeight: 1.4,
                    border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569',
                  }}
                >
                  <Text ellipsis style={{ width: '100%', fontSize: 12 }}>
                    {i + 1}. {msg.content.slice(0, 40)}{msg.content.length > 40 ? '...' : ''}
                  </Text>
                </Button>
              ))}
            </Space>
          )}
        </Card>
      </div>

      <style>{`
        .workbody-markdown { color: inherit; }
        .workbody-markdown h1, .workbody-markdown h2, .workbody-markdown h3 {
          margin-top: 14px; margin-bottom: 8px;
          color: inherit; font-weight: 600;
        }
        .workbody-markdown h1 { font-size: 19px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        .workbody-markdown h2 { font-size: 17px; }
        .workbody-markdown h3 { font-size: 15px; }
        .workbody-markdown p { margin: 4px 0; color: inherit; }
        .workbody-markdown ul, .workbody-markdown ol { margin: 6px 0; padding-left: 20px; }
        .workbody-markdown li { margin: 2px 0; color: inherit; }
        .workbody-markdown strong { color: inherit; font-weight: 600; }
        .workbody-markdown table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
        .workbody-markdown th { background: #f1f5f9; padding: 8px 12px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; color: #334155; }
        .workbody-markdown td { padding: 8px 12px; border: 1px solid #e2e8f0; color: #475569; }
        .workbody-markdown code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 12px; color: #7c3aed; }
        .workbody-markdown pre { background: #1e293b; color: #e2e8f0; padding: 12px 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; margin: 8px 0; }
        .workbody-markdown pre code { background: none; color: inherit; padding: 0; }
        .workbody-markdown hr { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
        .workbody-markdown blockquote { border-left: 3px solid #2563eb; padding-left: 12px; margin: 8px 0; color: #64748b; background: rgba(37,99,235,0.04); padding: 8px 12px; border-radius: 0 6px 6px 0; }
      `}</style>
    </div>
  );
}

