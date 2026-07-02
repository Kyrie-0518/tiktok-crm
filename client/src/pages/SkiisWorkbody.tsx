import React, { useState, useRef, useEffect } from 'react';
import {
  Card, Input, Button, Typography, Space, Tag, message, Tooltip,
} from 'antd';
import {
  SendOutlined, ThunderboltOutlined,
  BarChartOutlined, DollarOutlined,
  BookOutlined, UserOutlined,
  ClearOutlined, LoadingOutlined,
  ShopOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import api from '../api';

const { Text, Title } = Typography;

const QUICK_COMMANDS = [
  { label: '📊 日常询盘', query: '帮我完成今天的询盘工作：查看昨日各店铺销售数据、达人视频表现、广告花费、订单发货情况，复盘整体数据，找出问题并给出优化建议', icon: <BarChartOutlined /> },
  { label: '💰 利润诊断', query: '分析本月各店铺利润情况，定位亏损的订单和产品，给出改进建议', icon: <DollarOutlined /> },
  { label: '🤝 达人汇报', query: '生成本周达人合作汇总报告：达人数量、带货数据、佣金支出、合作表现', icon: <UserOutlined /> },
  { label: '📦 发货核查', query: '查看当前有哪些待发货订单，按店铺汇总，提醒超时未发货的异常订单', icon: <ShopOutlined /> },
  { label: '📚 知识问答', query: '马来西亚TikTok Shop最新佣金政策和物流规则', icon: <BookOutlined /> },
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
      content: `### 👋 你好，我是欧文\n\n我是你的**跨境电商全栈运营智能体**，拥有对系统所有模块的完全访问权限：\n\n- 🏪 **店铺管理** — 多店铺销售数据、趋势分析\n- 📦 **订单管理** — 订单状态、发货跟踪、异常检测\n- 💰 **财务核算** — 利润拆解、ROI分析、成本诊断\n- 🤝 **达人BD** — 达人合作数据、带货表现\n- 📢 **广告管理** — 广告花费、ROAS、账单\n- 📚 **跨境知识库** — 60+篇政策/规则/运营知识\n\n我最大的特点是**自主决策**：你只需要告诉我目标，我会自动判断需要调取哪些数据、用什么分析框架、如何输出报告。\n\n例如直接说「帮我询盘」，我会自动跑完整个日常运营复盘流程 👇`,
      timestamp: Date.now(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [progressText, setProgressText] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

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
      // 模拟进度更新
      const progressTimer = setTimeout(() => setProgressText('🔍 正在调取系统数据...'), 1500);

      const res = await api.post('/agent/chat', { query: query.trim() });
      clearTimeout(progressTimer);

      const data = res.data;
      setProgressText('');

      // 构建工具调用摘要
      let header = '';
      if (data.toolCalls?.length) {
        const toolSummary = data.toolCalls
          .map((tc: any) => TOOL_LABELS[tc.tool] || tc.tool)
          .join(' → ');
        header = `⚡ **自动调用了 ${data.toolCalls.length} 个工具**：${toolSummary}\n\n`;
        if (data.latency_ms) {
          header += `⏱️ 耗时 ${(data.latency_ms / 1000).toFixed(1)}s\n\n`;
        }
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

  const handleQuickCommand = (query: string) => {
    sendMessage(query);
  };

  const handleClear = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '### 👋 对话已清空\n\n我是欧文，随时为你服务。直接告诉我你的需求即可。',
      timestamp: Date.now(),
    }]);
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* ── 页面标题 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
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

      {/* ── 对话区域 ── */}
      <Card
        style={{
          flex: 1, overflow: 'auto', marginBottom: 12,
          borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
        bodyStyle={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '88%',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #7c3aed, #3b82f6)'
                    : 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                  color: msg.role === 'user' ? '#fff' : '#334155',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                  padding: '14px 18px',
                  fontSize: 14,
                  lineHeight: 1.75,
                  boxShadow: msg.role === 'user'
                    ? '0 2px 10px rgba(124,58,237,0.3)'
                    : '0 1px 3px rgba(0,0,0,0.06)',
                  border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                }}
              >
                {/* 仅欢迎消息显示快捷指令 */}
                {idx === 0 && (
                  <div style={{ marginTop: 12, marginBottom: 4 }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 500 }}>
                      💡 快捷场景
                    </div>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      {QUICK_COMMANDS.map(cmd => (
                        <Button
                          key={cmd.label}
                          block
                          size="small"
                          icon={cmd.icon}
                          onClick={() => handleQuickCommand(cmd.query)}
                          style={{
                            borderRadius: 8,
                            fontSize: 12,
                            textAlign: 'left',
                            height: 32,
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                            color: '#475569',
                          }}
                        >
                          {cmd.label}
                        </Button>
                      ))}
                    </Space>
                  </div>
                )}

                {/* 工具调用标签 */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <Space wrap size={[4, 4]}>
                      {msg.toolCalls.map((tc: any, i: number) => (
                        <Tooltip key={i} title={tc.args ? JSON.stringify(tc.args) : ''}>
                          <Tag
                            color="purple"
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

                {/* 消息正文 */}
                <div className="workbody-markdown">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {/* 执行进度 */}
          {sending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: '#f8fafc', borderRadius: '4px 16px 16px 16px',
                padding: '12px 20px', border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <LoadingOutlined style={{ color: '#7c3aed' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>{progressText}</Text>
              </div>
            </div>
          )}
          <div ref={msgEndRef} />
        </div>
      </Card>

      {/* ── 输入区域 ── */}
      <div style={{ flexShrink: 0 }}>
        <Card
          style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '12px 16px' }}
        >
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
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={sending}
            style={{
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              fontSize: 14,
              background: '#f8fafc',
              resize: 'none',
              paddingRight: 60,
            }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginTop: 8,
          }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Enter 发送 · Shift+Enter 换行
            </Text>
            <Button
              type="primary"
              icon={sending ? <LoadingOutlined /> : <SendOutlined />}
              onClick={() => sendMessage(inputValue)}
              loading={sending}
              disabled={!inputValue.trim()}
              style={{
                borderRadius: 8,
                background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                border: 'none',
                boxShadow: '0 2px 8px rgba(124,58,237,0.35)',
              }}
            >
              发送
            </Button>
          </div>
        </Card>
      </div>

      <style>{`
        .workbody-markdown h1, .workbody-markdown h2, .workbody-markdown h3 {
          margin-top: 14px; margin-bottom: 8px;
          color: #1e293b; font-weight: 600;
        }
        .workbody-markdown h1 { font-size: 19px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        .workbody-markdown h2 { font-size: 17px; }
        .workbody-markdown h3 { font-size: 15px; }
        .workbody-markdown p { margin: 4px 0; color: #475569; }
        .workbody-markdown ul, .workbody-markdown ol { margin: 6px 0; padding-left: 20px; }
        .workbody-markdown li { margin: 2px 0; color: #475569; }
        .workbody-markdown strong { color: #1e293b; }
        .workbody-markdown table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
        .workbody-markdown th { background: #f1f5f9; padding: 8px 12px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; color: #334155; }
        .workbody-markdown td { padding: 8px 12px; border: 1px solid #e2e8f0; color: #475569; }
        .workbody-markdown code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 12px; color: #7c3aed; }
        .workbody-markdown pre { background: #1e293b; color: #e2e8f0; padding: 12px 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; margin: 8px 0; }
        .workbody-markdown pre code { background: none; color: inherit; padding: 0; }
        .workbody-markdown hr { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
        .workbody-markdown blockquote { border-left: 3px solid #7c3aed; padding-left: 12px; margin: 8px 0; color: #64748b; background: rgba(124,58,237,0.04); padding: 8px 12px; border-radius: 0 6px 6px 0; }
      `}</style>
    </div>
  );
}
