/**
 * 移动端欧文聊天界面
 * 路由: /m/kyrie?token=MOBILE_TOKEN
 * 特性: 语音输入、快捷指令、全屏沉浸、PWA支持
 */
import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Typography, Space, Tag, message, Tooltip, Spin } from 'antd';
import {
  SendOutlined, LoadingOutlined, AudioOutlined, ThunderboltOutlined,
  BarChartOutlined, DollarOutlined, UserOutlined, ShopOutlined, BookOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import api from '../api';

const { Text } = Typography;

const QUICK_COMMANDS = [
  { label: '询盘', query: '帮我完成今天的询盘工作', icon: <BarChartOutlined /> },
  { label: '利润', query: '分析本月各店铺利润情况', icon: <DollarOutlined /> },
  { label: '达人', query: '生成本周达人合作汇总报告', icon: <UserOutlined /> },
  { label: '发货', query: '查看当前待发货订单', icon: <ShopOutlined /> },
  { label: '知识', query: '马来西亚TikTok Shop最新佣金政策', icon: <BookOutlined /> },
];

interface ChatMessage {
  id: string; role: 'user' | 'assistant'; content: string;
  toolCalls?: any[]; latency?: number; timestamp: number;
}

const TOOL_LABELS: Record<string, string> = {
  get_shop_stats: '店铺数据', get_order_list: '订单列表', get_finance_overview: '财务利润',
  get_influencer_summary: '达人概况', get_ad_overview: '广告数据', get_product_performance: '产品表现',
  search_knowledge: '知识库', get_exchange_rate: '汇率配置',
};

export default function MobileKyrie() {
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome', role: 'assistant',
    content: '### 👋 你好\n\n我是欧文，有什么需要我帮你盘一下的？',
    timestamp: Date.now(),
  }]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [listening, setListening] = useState(false);

  const msgEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  // ── 自动登录 ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mobileToken = params.get('token');
    if (!mobileToken) {
      setInitError('缺少登录token，请在PC端系统设置中扫码访问');
      setInitializing(false);
      return;
    }

    fetch('/api/auth/mobile-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_token: mobileToken }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
          // 更新 api 模块的默认 headers（如果 api 模块支持）
          (api.defaults?.headers as any)['Authorization'] = `Bearer ${data.token}`;
        } else {
          setInitError(data.error || '登录失败');
        }
      })
      .catch(() => setInitError('网络错误，请检查连接'))
      .finally(() => setInitializing(false));
  }, []);

  // ── 滚动 ──
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, progressText]);
  useEffect(() => { if (!sending && !initializing) inputRef.current?.focus(); }, [sending, initializing]);

  // ── 语音输入 ──
  const startVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { message.warning('当前浏览器不支持语音输入'); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    setListening(true);

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setInputValue(prev => prev + text);
      setListening(false);
    };
    recognition.onerror = () => {
      message.error('语音识别失败，请重试');
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognition.start();
  };

  // ── 发送消息 ──
  const sendMessage = async (query: string) => {
    if (!query.trim() || sending) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: query, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSending(true);
    setProgressText('正在分析...');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      setProgressText('');

      if (!data.success) throw new Error(data.error || '请求失败');
      let header = '';
      if (data.toolCalls?.length) {
        header = `⚡ 调用 ${data.toolCalls.length} 个工具\n\n`;
        if (data.latency_ms) header += `⏱ ${(data.latency_ms / 1000).toFixed(1)}s\n\n`;
      }
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: 'assistant',
        content: header + (data.report || '无内容'),
        toolCalls: data.toolCalls, latency: data.latency_ms, timestamp: Date.now(),
      }]);
    } catch (err: any) {
      setProgressText('');
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: 'assistant',
        content: `❌ ${err.message}`, timestamp: Date.now(),
      }]);
    } finally { setSending(false); }
  };

  // ── 快捷指令 ──
  const handleQuick = (cmd: typeof QUICK_COMMANDS[0]) => {
    setInputValue(cmd.query);
    inputRef.current?.focus();
  };

  // ── 加载中 ──
  if (initializing) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7' }}>
        <Spin tip="正在验证身份..." />
      </div>
    );
  }

  // ── 登录失败 ──
  if (initError) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#faf9f7', padding: 40 }}>
        <Text type="danger" style={{ fontSize: 16, marginBottom: 12 }}>{initError}</Text>
        <Text type="secondary" style={{ fontSize: 13 }}>请在PC端 系统设置 → 移动端入口 → 扫码</Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#faf9f7', overflow: 'hidden' }}>
      {/* ── 顶部：快捷指令 ── */}
      <div style={{ padding: '8px 12px', background: '#fff', borderBottom: '1px solid #e8e5e0', overflowX: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {QUICK_COMMANDS.map(cmd => (
          <Button key={cmd.label} size="small" icon={cmd.icon} onClick={() => handleQuick(cmd)}
            style={{ marginRight: 8, borderRadius: 20, height: 34, fontSize: 13 }}>{cmd.label}</Button>
        ))}
      </div>

      {/* ── 对话流 ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 600, margin: '0 auto' }}>
          {messages.map((msg, idx) => {
            if (idx === 0 && messages.length === 1) return null; // 隐藏欢迎语
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%',
                  background: msg.role === 'user' ? '#2563eb' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#334155',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                  padding: '10px 14px', fontSize: 14, lineHeight: 1.6,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  border: msg.role === 'user' ? 'none' : '1px solid #e8e5e0',
                }}>
                  {msg.toolCalls?.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      {msg.toolCalls.map((tc: any, i: number) => (
                        <Tag key={i} color="blue" style={{ fontSize: 10, borderRadius: 4, marginRight: 4 }}>
                          {TOOL_LABELS[tc.tool] || tc.tool}
                        </Tag>
                      ))}
                    </div>
                  )}
                  <div className="wb-mobile"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                </div>
              </div>
            );
          })}
          {sending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ background: '#fff', borderRadius: '4px 18px 18px 18px', padding: '10px 16px', border: '1px solid #e8e5e0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <LoadingOutlined style={{ color: '#2563eb' }} /><Text type="secondary" style={{ fontSize: 13 }}>{progressText}</Text>
              </div>
            </div>
          )}
          <div ref={msgEndRef} />
        </div>
      </div>

      {/* ── 底部输入区 ── */}
      <div style={{ flexShrink: 0, background: '#fff', borderTop: '1px solid #e8e5e0', padding: '10px 12px 14px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          {/* 语音按钮 */}
          <Button
            icon={<AudioOutlined />} type="text"
            onClick={startVoice}
            style={{
              height: 44, width: 44, borderRadius: 12, flexShrink: 0,
              background: listening ? '#fee2e2' : '#f1f5f9',
              color: listening ? '#dc2626' : '#64748b', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          />

          {/* 输入框 */}
          <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 24, padding: '4px 4px 4px 14px', display: 'flex', alignItems: 'flex-end' }}>
            <Input.TextArea
              ref={inputRef} value={inputValue} disabled={sending}
              onChange={e => setInputValue(e.target.value)}
              onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendMessage(inputValue); } }}
              placeholder="告诉欧文你想做什么..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              style={{ flex: 1, border: 'none', outline: 'none', boxShadow: 'none', fontSize: 15, lineHeight: 1.5, resize: 'none', background: 'transparent', padding: '8px 0' }}
            />
            <Button type="primary" icon={sending ? <LoadingOutlined /> : <SendOutlined />}
              onClick={() => sendMessage(inputValue)} loading={sending} disabled={!inputValue.trim()}
              style={{ height: 40, width: 40, borderRadius: 20, background: '#2563eb', border: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !inputValue.trim() ? 0.4 : 1 }}
            />
          </div>
        </div>
      </div>

      <style>{`
        .wb-mobile h1, .wb-mobile h2, .wb-mobile h3 { margin: 8px 0 4px; font-size: 15px; font-weight: 600; color: inherit; }
        .wb-mobile p { margin: 2px 0; color: inherit; }
        .wb-mobile ul, .wb-mobile ol { margin: 4px 0; padding-left: 18px; }
        .wb-mobile table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12px; }
        .wb-mobile th, .wb-mobile td { padding: 5px 8px; border: 1px solid #e2e8f0; text-align: left; }
        .wb-mobile th { background: #f1f5f9; }
        .wb-mobile code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
        .wb-mobile pre { background: #1e293b; color: #e2e8f0; padding: 8px 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
        .wb-mobile pre code { background: none; color: inherit; padding: 0; }
        .wb-mobile strong { color: inherit; font-weight: 600; }
        .wb-mobile blockquote { border-left: 3px solid #2563eb; padding-left: 10px; margin: 6px 0; color: #64748b; background: rgba(37,99,235,0.04); padding: 6px 10px; border-radius: 0 4px 4px 0; }
      `}</style>
    </div>
  );
}
