import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Button, Form, Input, Select, message, Spin, Typography, Row, Col,
  Tag, Tabs, Empty, Badge, Slider, InputNumber, Tooltip, Divider, Space,
} from 'antd';
import {
  ApiOutlined, ThunderboltOutlined,
  LinkOutlined, KeyOutlined, RobotOutlined,
  ExperimentOutlined, SaveOutlined, CheckCircleFilled,
  CloseCircleFilled, LoadingOutlined, ClockCircleOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import api from '../api';
import { formatDateTime } from '../utils/time';

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;

/* ══════════════════════════ Design Tokens (Apple + Linear style) ══════════════════════════ */
const DS = {
  bg: '#f5f3f0',
  cardBg: '#FFFFFF',
  cardBorder: '#e8e5e0',
  cardShadow: '0 1px 3px rgba(0,0,0,0.04)',
  cardHoverShadow: '0 4px 16px rgba(0,0,0,0.08)',
  primary: '#5B4CFA',
  primaryHover: '#6E5FFB',
  primaryLight: '#F4F2FF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  radius: 16,
  radiusSm: 10,
  inputHeight: 48,
};

/* ══════════════════════════ Types ══════════════════════════ */
interface AiChannel {
  id: number;
  name: string;
  provider: string;
  api_base: string;
  api_key: string;
  api_key_masked: string;
  model: string;
  status: 'enabled' | 'disabled';
  is_default: boolean;
  avg_latency?: number;
  success_count?: number;
  error_count?: number;
  last_used_at?: string;
  last_success_at?: string;
  last_error_at?: string;
  last_error_message?: string;
  last_test_result?: string;
  last_test_message?: string;
  last_tested_at?: string;
}

interface VideoModelConfig {
  model_type: string;
  api_url: string;
  api_key: string;
  api_key_masked: string;
  model_name: string;
  status: 'enabled' | 'disabled';
  last_tested_at: string | null;
  last_test_result: string;
  last_test_message: string;
  model_info?: any;
}

/* ══════════════════════════ AI 能力标签 ══════════════════════════ */
const AI_CAPABILITIES = [
  { key: 'prompt', label: 'Prompt 优化', icon: '✍️' },
  { key: 'vision', label: '商品理解', icon: '🔍' },
  { key: 'director', label: 'AI 导演', icon: '🎬' },
  { key: 'script', label: '视频脚本', icon: '📜' },
  { key: 'engine', label: 'Prompt 编排', icon: '⚙️' },
  { key: 'ocr', label: 'OCR 识别', icon: '👁️' },
  { key: 'copy', label: '营销文案', icon: '📝' },
];

/* ══════════════════════════ 视频模型定义 ══════════════════════════ */
const VIDEO_MODELS = [
  {
    type: 'seedance', name: 'Seedance', tag: '推荐', tagColor: 'purple',
    desc: '字节跳动视频生成', capabilities: ['图生视频', '文生视频', '首尾帧', '高清', '音频', '一致性'],
    ratings: { '图生': 5, '速度': 5, '一致性': 5 },
  },
  {
    type: 'kling', name: 'Kling', tag: '', tagColor: '',
    desc: '快手可灵视频模型', capabilities: ['图生视频', '文生视频', '运镜', '高清', '扩展'],
    ratings: { '运镜': 5, '人物': 5, '速度': 4 },
  },
  {
    type: 'minimax', name: 'MiniMax', tag: '', tagColor: '',
    desc: '海螺视频生成模型', capabilities: ['图生视频', '文生视频', '一致性', '高清'],
    ratings: { '一致性': 5, '速度': 4 },
  },
  {
    type: 'haiper', name: 'Haiper', tag: '', tagColor: '',
    desc: 'Haiper AI 视频模型', capabilities: ['图生视频', '文生视频', '镜头'],
    ratings: { '镜头': 5 },
  },
  {
    type: 'openai-sora', name: 'Sora', tag: '预留', tagColor: 'default',
    desc: 'OpenAI Sora', capabilities: ['文生视频', '图生视频', '扩展'],
    ratings: {},
  },
];

const MODEL_INFO = Object.fromEntries(VIDEO_MODELS.map(m => [m.type, m]));

/* ══════════════════════════ Helpers ══════════════════════════ */
function safeParse(s: string) { try { return JSON.parse(s); } catch { return {}; } }

/* ══════════════════════════ Component ══════════════════════════ */
export default function ApiConfig() {
  const [activeTab, setActiveTab] = useState('ai');

  /* ─────── AI 智能引擎 State ─────── */
  const [aiChannel, setAiChannel] = useState<AiChannel | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiForm] = Form.useForm();
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [aiTestMsg, setAiTestMsg] = useState('');
  const [aiTestLatency, setAiTestLatency] = useState<number | null>(null);

  /* ─────── 视频生成引擎 State ─────── */
  const [videoConfigs, setVideoConfigs] = useState<VideoModelConfig[]>([]);
  const [videoLoading, setVideoLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string>('seedance');
  const [videoForm] = Form.useForm();
  const [videoSaving, setVideoSaving] = useState(false);
  const [videoTesting, setVideoTesting] = useState(false);
  const [videoTestStatus, setVideoTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [videoTestMsg, setVideoTestMsg] = useState('');

  /* ══════════════════════════ AI 智能引擎 ══════════════════════════ */
  const fetchAiChannel = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await api.get('/ai-channels');
      const channels = res.data || [];
      // 优先取默认，否则取第一条
      const def = channels.find((c: any) => c.is_default && c.status === 'enabled')
        || channels.find((c: any) => c.status === 'enabled')
        || channels[0] || null;
      if (def) {
        setAiChannel(def);
        aiForm.setFieldsValue({
          provider: def.provider || 'deepseek',
          model: def.model || '',
          api_base: def.api_base || '',
          api_key: '',
        });
      }
    } catch { /* 表可能为空 */ }
    finally { setAiLoading(false); }
  }, [aiForm]);

  useEffect(() => { fetchAiChannel(); }, [fetchAiChannel]);

  const saveAiConfig = async () => {
    try {
      const values = await aiForm.validateFields();
      setAiSaving(true);
      const payload = {
        name: values.provider === 'deepseek' ? 'DeepSeek' : values.provider === 'volcengine' ? '火山引擎' : values.provider,
        provider: values.provider,
        api_base: values.api_base,
        api_key: values.api_key || undefined,
        model: values.model,
        status: 'enabled' as const,
        is_default: true,
        priority: 1,
      };
      if (aiChannel?.id) {
        await api.put(`/ai-channels/${aiChannel.id}`, payload);
      } else {
        await api.post('/ai-channels', payload);
      }
      message.success('配置已保存');
      fetchAiChannel();
    } catch (e: any) {
      if (e.response?.data?.error) message.error(e.response.data.error);
      else if (!e.errorFields) message.error('保存失败');
    } finally { setAiSaving(false); }
  };

  const testAi = async () => {
    if (!aiChannel?.id) { message.warning('请先保存配置'); return; }
    setAiTesting(true);
    setAiTestStatus('testing');
    setAiTestMsg('');
    setAiTestLatency(null);
    const t0 = Date.now();
    try {
      // 先保存
      const values = aiForm.getFieldsValue();
      await api.put(`/ai-channels/${aiChannel.id}`, {
        name: aiChannel.name,
        provider: values.provider,
        api_base: values.api_base,
        api_key: values.api_key || undefined,
        model: values.model,
        status: 'enabled',
        is_default: true,
        priority: 1,
      });
      const res = await api.post(`/ai-channels/${aiChannel.id}/test`);
      const latency = Date.now() - t0;
      if (res.data.success) {
        setAiTestStatus('success');
        setAiTestMsg('连接成功');
        setAiTestLatency(latency);
      } else {
        setAiTestStatus('error');
        setAiTestMsg(res.data.error || '连接失败');
      }
      fetchAiChannel();
    } catch (e: any) {
      setAiTestStatus('error');
      setAiTestMsg(e.response?.data?.error || e.message || '连接失败');
    } finally { setAiTesting(false); }
  };

  /* ══════════════════════════ 视频生成引擎 ══════════════════════════ */
  const fetchVideoConfigs = useCallback(async () => {
    setVideoLoading(true);
    try {
      const res = await api.get('/video-models/configs');
      const configured = res.data.filter((c: any) => c.is_configured !== false);
      setVideoConfigs(configured);
    } catch { /* empty */ }
    finally { setVideoLoading(false); }
  }, []);

  useEffect(() => { fetchVideoConfigs(); }, [fetchVideoConfigs]);

  useEffect(() => {
    // 切换视频模型时加载配置
    const cfg = videoConfigs.find(c => c.model_type === selectedVideo);
    videoForm.setFieldsValue({
      api_url: cfg?.api_url || '',
      model_name: cfg?.model_name || '',
      api_key: '',
      ratio: '16:9',
      duration: 5,
      resolution: '720p',
      count: 1,
      voice: true,
    });
    setVideoTestStatus(cfg?.last_test_result === 'success' ? 'success' : cfg?.last_test_result === 'failed' ? 'error' : 'idle');
    setVideoTestMsg(cfg?.last_test_message || '');
  }, [selectedVideo, videoConfigs, videoForm]);

  const saveVideoConfig = async () => {
    try {
      const values = await videoForm.validateFields();
      setVideoSaving(true);
      await api.put(`/video-models/configs/${selectedVideo}`, {
        api_url: values.api_url,
        api_key: values.api_key || undefined,
        model_name: values.model_name,
        status: 'enabled',
      });
      message.success('配置已保存');
      fetchVideoConfigs();
    } catch (e: any) {
      if (e.response?.data?.error) message.error(e.response.data.error);
      else if (!e.errorFields) message.error('保存失败');
    } finally { setVideoSaving(false); }
  };

  const testVideo = async () => {
    setVideoTesting(true);
    setVideoTestStatus('testing');
    setVideoTestMsg('');
    try {
      const values = videoForm.getFieldsValue();
      // 先保存
      await api.put(`/video-models/configs/${selectedVideo}`, {
        api_url: values.api_url,
        api_key: values.api_key || undefined,
        model_name: values.model_name,
        status: 'enabled',
      });
      const res = await api.post(`/video-models/configs/${selectedVideo}/test`, {
        api_url: values.api_url,
        api_key: values.api_key,
        model_name: values.model_name,
      });
      if (res.data.success) {
        setVideoTestStatus('success');
        setVideoTestMsg('连接成功');
      } else {
        setVideoTestStatus('error');
        setVideoTestMsg(res.data.error || '连接失败');
      }
      fetchVideoConfigs();
    } catch (e: any) {
      setVideoTestStatus('error');
      setVideoTestMsg(e.response?.data?.error || e.message || '连接失败');
    } finally { setVideoTesting(false); }
  };

  const currentVideoCfg = videoConfigs.find(c => c.model_type === selectedVideo);
  const currentVideoModel = MODEL_INFO[selectedVideo];
  const videoTestIsSuccess = currentVideoCfg?.last_test_result === 'success' || videoTestStatus === 'success';

  /* ══════════════════════════ Shared Styles ══════════════════════════ */
  const sectionTitle = (label: string) => (
    <Text style={{ fontSize: 14, fontWeight: 500, color: '#666', display: 'block', marginBottom: 16 }}>
      {label}
    </Text>
  );

  const inputStyle = { height: DS.inputHeight, borderRadius: DS.radiusSm, alignItems: 'center' as const };

  /* ══════════════════════════ Tab 1: AI 智能引擎 ══════════════════════════ */
  const renderAiTab = () => {
    if (aiLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

    const channel = aiChannel;
    const configed = !!channel?.api_base;

    return (
      <Card style={{
        borderRadius: DS.radius,
        border: `1px solid ${DS.cardBorder}`,
        boxShadow: DS.cardShadow,
        overflow: 'hidden',
      }} bodyStyle={{ padding: 0 }}>
        {/* ── Header ── */}
        <div style={{
          padding: '28px 32px 20px',
          borderBottom: `1px solid ${DS.cardBorder}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 600, color: DS.text }}>
              AI 智能引擎
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              整个后台所有 AI 能力统一使用该模型
            </Text>
          </div>
          {configed && (() => {
            // 在线：5 分钟内有成功调用
            // 异常：最近一次错误 > 最近一次成功
            // 待机：从未调用 / 超过 5 分钟无调用
            const now = Date.now();
            const lastOk = channel.last_success_at ? new Date(channel.last_success_at).getTime() : 0;
            const lastErr = channel.last_error_at ? new Date(channel.last_error_at).getTime() : 0;
            let liveStatus: 'success' | 'error' | 'default' = 'default';
            let liveText = '待机';
            if (channel.status !== 'enabled') {
              liveStatus = 'error'; liveText = '已禁用';
            } else if (lastErr > lastOk && lastErr > now - 5 * 60 * 1000) {
              liveStatus = 'error'; liveText = '异常';
            } else if (now - lastOk < 5 * 60 * 1000) {
              liveStatus = 'success'; liveText = '在线';
            } else if (lastOk > 0) {
              liveText = '待机';
            } else {
              liveText = '未调用';
            }
            return (
              <Badge
                status={liveStatus}
                text={<span style={{ fontSize: 13, color: liveStatus === 'success' ? DS.success : liveStatus === 'error' ? DS.error : DS.textSecondary }}>{liveText}</span>}
              />
            );
          })()}
        </div>

        <div style={{ padding: '24px 32px' }}>
          <Form form={aiForm} layout="vertical" size="large">
            {/* ── 基础配置 ── */}
            {sectionTitle('基础配置')}
            <Row gutter={20}>
              <Col span={8}>
                <Form.Item name="provider" label={<span style={{ fontSize: 13, fontWeight: 500 }}>模型厂商</span>}>
                  <Select style={{ ...inputStyle, width: '100%' }} size="large">
                    <Option value="deepseek">DeepSeek</Option>
                    <Option value="volcengine">火山引擎</Option>
                    <Option value="openai">OpenAI</Option>
                    <Option value="siliconflow">硅基流动</Option>
                    <Option value="custom">自定义</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item name="model" label={<span style={{ fontSize: 13, fontWeight: 500 }}>模型</span>}
                  extra="手动填写完整模型标识，例如 deepseek-chat / deepseek-reasoner / doubao-pro-32k">
                  <Input style={inputStyle} placeholder="deepseek-chat" prefix={<RobotOutlined style={{ color: DS.textTertiary }} />} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="api_base" label={<span style={{ fontSize: 13, fontWeight: 500 }}>接口地址</span>}>
              <Input style={inputStyle} placeholder="https://api.deepseek.com/v1" prefix={<LinkOutlined style={{ color: DS.textTertiary }} />} />
            </Form.Item>
            <Form.Item name="api_key" label={<span style={{ fontSize: 13, fontWeight: 500 }}>访问密钥</span>}
              extra={channel?.api_key_masked ? `当前密钥: ${channel.api_key_masked}（留空保持不变）` : ''}>
              <Input.Password style={inputStyle} placeholder="sk-..." prefix={<KeyOutlined style={{ color: DS.textTertiary }} />} />
            </Form.Item>

            <div style={{ height: 1, background: DS.cardBorder, margin: '32px -32px 24px' }} />

            {/* ── 当前支持能力 ── */}
            {sectionTitle('当前支持能力')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AI_CAPABILITIES.map(cap => (
                <Tooltip key={cap.key} title={cap.label}>
                  <Tag
                    style={{
                      border: `1px solid ${DS.cardBorder}`,
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 13,
                      color: DS.text,
                      background: DS.cardBg,
                      cursor: 'default',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = DS.primary;
                      e.currentTarget.style.color = DS.primary;
                      e.currentTarget.style.background = DS.primaryLight;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = DS.cardBorder;
                      e.currentTarget.style.color = DS.text;
                      e.currentTarget.style.background = DS.cardBg;
                    }}
                  >
                    {cap.label}
                  </Tag>
                </Tooltip>
              ))}
            </div>

            <div style={{ height: 1, background: DS.cardBorder, margin: '32px -32px 24px' }} />

            {/* ── 运行状态 ── */}
            {sectionTitle('运行状态')}
            {aiTestStatus === 'testing' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: DS.warning }}>
                <LoadingOutlined /> <Text style={{ color: DS.warning }}>连接模型中...</Text>
              </div>
            ) : aiTestStatus === 'success' ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CheckCircleFilled style={{ color: DS.success, fontSize: 16 }} />
                  <Text style={{ color: DS.success, fontWeight: 500 }}>{aiTestMsg}</Text>
                  {aiTestLatency && <Text type="secondary" style={{ fontSize: 12 }}>· 耗时 {(aiTestLatency / 1000).toFixed(2)}s</Text>}
                </div>
              </div>
            ) : aiTestStatus === 'error' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CloseCircleFilled style={{ color: DS.error, fontSize: 16 }} />
                <Text style={{ color: DS.error }}>{aiTestMsg}</Text>
              </div>
            ) : (
              <Row gutter={24}>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>成功调用</Text>
                  <Text style={{ fontSize: 18, fontWeight: 600, color: DS.text }}>{channel?.success_count ?? 0}<Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 4 }}>次</Text></Text>
                </Col>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>失败次数</Text>
                  <Text style={{ fontSize: 18, fontWeight: 600, color: (channel?.error_count ?? 0) > 0 ? DS.error : DS.text }}>{channel?.error_count ?? 0}<Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 4 }}>次</Text></Text>
                </Col>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>平均响应</Text>
                  <Text style={{ fontSize: 18, fontWeight: 600, color: DS.text }}>{channel?.avg_latency ? `${channel.avg_latency}ms` : '—'}</Text>
                </Col>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>最近调用</Text>
                  <Text style={{ fontSize: 14, fontWeight: 500, color: DS.text, display: 'block' }}>
                    {channel?.last_used_at ? formatDateTime(channel.last_used_at) : '—'}
                  </Text>
                </Col>
              </Row>
            )}
          </Form>
        </div>

        {/* ── Footer Actions ── */}
        <div style={{
          padding: '20px 32px',
          borderTop: `1px solid ${DS.cardBorder}`,
          display: 'flex', justifyContent: 'flex-end', gap: 12,
          background: '#FAFAFB',
        }}>
          <Button
            size="large"
            icon={aiTesting ? <LoadingOutlined /> : <ExperimentOutlined />}
            onClick={testAi}
            loading={aiTesting}
            style={{ borderRadius: 10, height: 44, paddingInline: 24, fontWeight: 500 }}
          >
            测试连接
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            onClick={saveAiConfig}
            loading={aiSaving}
            style={{
              borderRadius: 10, height: 44, paddingInline: 28, fontWeight: 500,
              background: `linear-gradient(135deg, ${DS.primary}, ${DS.primaryHover})`,
              border: 'none',
              boxShadow: `0 2px 8px rgba(91,76,250,0.3)`,
            }}
          >
            保存配置
          </Button>
        </div>
      </Card>
    );
  };

  /* ══════════════════════════ Tab 2: 视频生成引擎 ══════════════════════════ */
  const renderStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

  const renderVideoTab = () => {
    if (videoLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

    const cfg = currentVideoCfg;
    const mi = currentVideoModel;
    const isOnline = videoTestIsSuccess;

    return (
      <Row gutter={24} style={{ alignItems: 'stretch' }}>
        {/* ── 左侧：模型选择（340px） ── */}
        <Col style={{ width: 340, flexShrink: 0 }}>
          <Card style={{
            borderRadius: DS.radius, border: `1px solid ${DS.cardBorder}`,
            boxShadow: DS.cardShadow, height: '100%',
          }} bodyStyle={{ padding: '12px 8px' }}>
            <div style={{ padding: '0 8px 12px', fontSize: 13, fontWeight: 500, color: DS.textSecondary }}>
              模型选择
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {VIDEO_MODELS.map(m => {
                const vCfg = videoConfigs.find(c => c.model_type === m.type);
                const enabled = !!vCfg?.status && vCfg.status !== 'disabled';
                const isActive = selectedVideo === m.type;
                return (
                  <div
                    key={m.type}
                    onClick={() => setSelectedVideo(m.type)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: 12,
                      border: `1px solid ${isActive ? DS.primary : DS.cardBorder}`,
                      padding: '14px 16px',
                      background: isActive ? DS.primaryLight : DS.cardBg,
                      transition: 'all 0.2s',
                      boxShadow: isActive ? `0 0 0 2px rgba(91,76,250,0.15)` : undefined,
                    }}
                    onMouseEnter={e => {
                      if (!isActive) { e.currentTarget.style.background = '#F9FAFB'; }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) { e.currentTarget.style.background = DS.cardBg; }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 15, fontWeight: 600, color: DS.text }}>{m.name}</Text>
                      <Space size={4}>
                        {enabled && <Badge status="success" />}
                        {m.tag && <Tag style={{ margin: 0, borderRadius: 6, fontSize: 10 }} color={m.tagColor || 'default'}>{m.tag}</Tag>}
                      </Space>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                      {Object.entries(m.ratings).map(([k, v]) => (
                        <Text key={k} style={{ fontSize: 11, color: DS.textSecondary }}>
                          {k}<span style={{ color: '#F59E0B' }}>{renderStars(v)}</span>
                        </Text>
                      ))}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{m.desc}</Text>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>

        {/* ── 右侧：模型配置 ── */}
        <Col flex="1" style={{ minWidth: 0 }}>
          <Card style={{
            borderRadius: DS.radius, border: `1px solid ${DS.cardBorder}`,
            boxShadow: DS.cardShadow, height: '100%',
          }} bodyStyle={{ padding: 0 }}>
            {/* Header */}
            <div style={{
              padding: '28px 32px 20px',
              borderBottom: `1px solid ${DS.cardBorder}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <div>
                <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 600, color: DS.text }}>
                  {mi.name}
                </Title>
                <Space size={8}>
                  {cfg?.status === 'enabled'
                    ? <Badge status="success" text={<span style={{ fontSize: 12 }}>已启用</span>} />
                    : <Badge status="default" text={<span style={{ fontSize: 12 }}>未启用</span>} />}
                  {mi.tag && <Tag color={mi.tagColor || 'default'} style={{ borderRadius: 6 }}>{mi.tag}</Tag>}
                </Space>
              </div>
              {isOnline && (
                <Badge status="success" text={<span style={{ fontSize: 13, color: DS.success }}>在线</span>} />
              )}
            </div>

            <div style={{ padding: '24px 32px' }}>
              <Form form={videoForm} layout="vertical" size="large">
                {/* ── 基础配置 ── */}
                {sectionTitle('基础配置')}
                <Form.Item name="api_url" label={<span style={{ fontSize: 13, fontWeight: 500 }}>接口地址</span>}>
                  <Input style={inputStyle} placeholder="https://ark.cn-beijing.volces.com/api/v3"
                    prefix={<LinkOutlined style={{ color: DS.textTertiary }} />} />
                </Form.Item>
                <Row gutter={20}>
                  <Col span={12}>
                    <Form.Item name="model_name" label={<span style={{ fontSize: 13, fontWeight: 500 }}>模型名称</span>}>
                      <Input style={inputStyle} placeholder="doubao-seedance-1-0-pro-250528"
                        prefix={<RobotOutlined style={{ color: DS.textTertiary }} />} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="api_key" label={<span style={{ fontSize: 13, fontWeight: 500 }}>API Key</span>}
                      extra={cfg?.api_key_masked ? `当前: ${cfg.api_key_masked}` : ''}>
                      <Input.Password style={inputStyle} placeholder="请输入 API Key"
                        prefix={<KeyOutlined style={{ color: DS.textTertiary }} />} />
                    </Form.Item>
                  </Col>
                </Row>

                <div style={{ height: 1, background: DS.cardBorder, margin: '32px -32px 24px' }} />

                {/* ── 默认参数 ── */}
                {sectionTitle('默认生成参数')}
                <Row gutter={20}>
                  <Col span={8}>
                    <Form.Item name="ratio" label={<span style={{ fontSize: 13, fontWeight: 500 }}>默认比例</span>}>
                      <Select style={{ ...inputStyle, width: '100%' }} size="large">
                        <Option value="16:9">16:9</Option>
                        <Option value="9:16">9:16</Option>
                        <Option value="1:1">1:1</Option>
                        <Option value="4:3">4:3</Option>
                        <Option value="3:4">3:4</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="duration" label={<span style={{ fontSize: 13, fontWeight: 500 }}>时长</span>}>
                      <Select style={{ ...inputStyle, width: '100%' }} size="large">
                        {[3, 5, 8, 10, 15, 30].map(s => <Option key={s} value={s}>{s} 秒</Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="resolution" label={<span style={{ fontSize: 13, fontWeight: 500 }}>分辨率</span>}>
                      <Select style={{ ...inputStyle, width: '100%' }} size="large">
                        <Option value="540p">540P</Option>
                        <Option value="720p">720P</Option>
                        <Option value="1080p">1080P</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="count" label={<span style={{ fontSize: 13, fontWeight: 500 }}>数量</span>}>
                      <Select style={{ ...inputStyle, width: '100%' }} size="large">
                        {[1, 2, 3, 4].map(n => <Option key={n} value={n}>{n}</Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="voice" label={<span style={{ fontSize: 13, fontWeight: 500 }}>声音</span>}>
                      <Select style={{ ...inputStyle, width: '100%' }} size="large">
                        <Option value={true}>开启</Option>
                        <Option value={false}>关闭</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <div style={{ height: 1, background: DS.cardBorder, margin: '32px -32px 24px' }} />

                {/* ── 支持能力 ── */}
                {sectionTitle('支持能力')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {mi.capabilities.map(cap => (
                    <Tag key={cap} style={{
                      border: 'none', borderRadius: 8, padding: '6px 14px',
                      fontSize: 13, fontWeight: 500,
                      background: DS.primaryLight, color: DS.primary,
                    }}>{cap}</Tag>
                  ))}
                </div>

                <div style={{ height: 1, background: DS.cardBorder, margin: '32px -32px 24px' }} />

                {/* ── 状态 ── */}
                {sectionTitle('运行状态')}
                {videoTestStatus === 'testing' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: DS.warning }}>
                    <LoadingOutlined /> 连接模型中...
                  </div>
                ) : videoTestStatus === 'success' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircleFilled style={{ color: DS.success, fontSize: 16 }} />
                    <Text style={{ color: DS.success, fontWeight: 500 }}>连接成功</Text>
                  </div>
                ) : videoTestStatus === 'error' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CloseCircleFilled style={{ color: DS.error, fontSize: 16 }} />
                    <Text style={{ color: DS.error }}>{videoTestMsg}</Text>
                  </div>
                ) : cfg?.last_tested_at ? (
                  <Row gutter={24}>
                    <Col span={6}>
                      <Text type="secondary" style={{ fontSize: 12 }}>连接状态</Text>
                      <div><Badge status="success" text="在线" /></div>
                    </Col>
                    <Col span={6}>
                      <Text type="secondary" style={{ fontSize: 12 }}>测试时间</Text>
                      <Text style={{ fontSize: 14, fontWeight: 500, color: DS.text, display: 'block' }}>
                        {formatDateTime(cfg.last_tested_at)}
                      </Text>
                    </Col>
                  </Row>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>暂未测试</Text>
                )}
              </Form>
            </div>

            {/* Footer */}
            <div style={{
              padding: '20px 32px',
              borderTop: `1px solid ${DS.cardBorder}`,
              display: 'flex', justifyContent: 'flex-end', gap: 12,
              background: '#FAFAFB',
            }}>
              <Button
                size="large"
                icon={videoTesting ? <LoadingOutlined /> : <ExperimentOutlined />}
                onClick={testVideo}
                loading={videoTesting}
                style={{ borderRadius: 10, height: 44, paddingInline: 24, fontWeight: 500 }}
              >
                测试连接
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                onClick={saveVideoConfig}
                loading={videoSaving}
                style={{
                  borderRadius: 10, height: 44, paddingInline: 28, fontWeight: 500,
                  background: `linear-gradient(135deg, ${DS.primary}, ${DS.primaryHover})`,
                  border: 'none',
                  boxShadow: `0 2px 8px rgba(91,76,250,0.3)`,
                }}
              >
                保存配置
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    );
  };

  /* ══════════════════════════ Main ══════════════════════════ */
  return (
    <div style={{
      padding: 24, minHeight: '100%',
    }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `linear-gradient(135deg, ${DS.primary}, ${DS.primaryHover})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 20,
          boxShadow: `0 4px 14px rgba(91,76,250,0.25)`,
        }}>
          <ThunderboltOutlined />
        </div>
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: DS.text }}>
            AI 能力配置
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            配置和管理大模型、视频生成能力，所有 AI 服务统一入口
          </Text>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{
          background: 'transparent',
        }}
        tabBarStyle={{
          marginBottom: 24,
          borderBottom: `1px solid ${DS.cardBorder}`,
        }}
        items={[
          {
            key: 'ai',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, padding: '0 4px' }}>
                <ApiOutlined /> AI 智能引擎
              </span>
            ),
            children: renderAiTab(),
          },
          {
            key: 'video',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, padding: '0 4px' }}>
                <ThunderboltOutlined /> 视频生成引擎
              </span>
            ),
            children: renderVideoTab(),
          },
        ]}
      />
    </div>
  );
}
