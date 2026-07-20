import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Button, Form, Input, Select, message, Spin, Space, Typography, Modal, Row, Col,
  Tag, Tabs, Empty, Popconfirm, Badge, Alert
} from 'antd';
import {
  ApiOutlined, ThunderboltOutlined, DeleteOutlined,
  EditOutlined, LinkOutlined, KeyOutlined, RobotOutlined, ReloadOutlined,
  ExperimentOutlined, EyeInvisibleOutlined, PlusOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SaveOutlined, StarFilled,
} from '@ant-design/icons';
import api from '../api';

const { Text, Title } = Typography;
const { Option } = Select;

/* ══════════════════════════ Types ══════════════════════════ */
interface AiChannel {
  id: number;
  name: string;
  provider: string;
  api_base: string;
  api_key: string;
  api_key_masked: string;
  model: string;
  models: string[];
  priority: number;
  status: 'enabled' | 'disabled';
  is_default: boolean;
}

interface VideoModelConfig {
  id?: number;
  user_id: number;
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
  is_configured?: boolean;
}

/* ══════════════════════════ Design Tokens ══════════════════════════ */
const T = {
  bg: '#f5f3f0',
  cardBg: '#FFFFFF',
  primary: '#2563eb',
  primaryHover: '#3b82f6',
  border: '#e8e5e0',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  success: '#059669',
  error: '#dc2626',
};

const VIDEO_MODEL_TYPES = [
  { type: 'seedance', name: '火山引擎 Seedance', icon: '🌋', desc: '字节跳动视频生成模型', color: '#2563eb' },
  { type: 'kling', name: '快手可灵 Kling', icon: '⚡', desc: '快手视频生成模型', color: '#ff9500' },
  { type: 'minimax', name: 'MiniMax 海螺', icon: '🎯', desc: 'MiniMax 视频生成模型', color: '#5856d6' },
  { type: 'haiper', name: 'Haiper AI', icon: '🌊', desc: 'Haiper 视频生成模型', color: '#00ced1' },
  { type: 'openai-sora', name: 'OpenAI Sora', icon: '🤖', desc: 'OpenAI Sora 视频生成', color: '#10a37f' },
  { type: 'custom', name: '自定义模型', icon: '🔧', desc: 'OpenAI 兼容格式 API', color: '#666' },
];

const DEFAULT_MODEL_NAMES: Record<string, string> = {
  seedance: 'doubao-seedance-1-0-pro-250528',
  kling: 'kling-v1',
  minimax: 'abab6-video-01',
  haiper: 'haiper-video-v2',
  'openai-sora': 'sora-turbo',
};

/* ══════════════════════════ Component ══════════════════════════ */
export default function ApiConfig() {
  const [activeTab, setActiveTab] = useState('llm');

  /* ── 语言大模型 State ── */
  const [channels, setChannels] = useState<AiChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [llmModalVisible, setLlmModalVisible] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AiChannel | null>(null);
  const [llmForm] = Form.useForm();
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmTesting, setLlmTesting] = useState<number | null>(null);

  /* ── 视频大模型 State ── */
  const [videoConfigs, setVideoConfigs] = useState<VideoModelConfig[]>([]);
  const [videoAvailable, setVideoAvailable] = useState<any[]>([]);
  const [videoLoading, setVideoLoading] = useState(true);
  const [selectedVideoType, setSelectedVideoType] = useState<string | null>(null);
  const [videoEditConfig, setVideoEditConfig] = useState<VideoModelConfig | null>(null);
  const [videoForm] = Form.useForm();
  const [videoSaving, setVideoSaving] = useState(false);
  const [videoTesting, setVideoTesting] = useState(false);

  /* ══════════════════════════ 语言大模型 ══════════════════════════ */
  const fetchChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const res = await api.get('/ai-channels');
      setChannels(res.data || []);
    } catch (e: any) {
      message.error('加载AI通道失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const openLlmModal = (channel?: AiChannel) => {
    setEditingChannel(channel || null);
    llmForm.setFieldsValue({
      name: channel?.name || '',
      provider: channel?.provider || 'deepseek',
      api_base: channel?.api_base || '',
      model: channel?.model || '',
      api_key: '',
      status: channel?.status || 'enabled',
      is_default: channel?.is_default || false,
      priority: channel?.priority || 100,
    });
    setLlmModalVisible(true);
  };

  const saveChannel = async () => {
    try {
      const values = await llmForm.validateFields();
      setLlmSaving(true);
      if (editingChannel) {
        await api.put(`/ai-channels/${editingChannel.id}`, {
          name: values.name, provider: values.provider, api_base: values.api_base,
          api_key: values.api_key || undefined, model: values.model,
          status: values.status, is_default: values.is_default, priority: values.priority,
        });
        message.success('渠道已更新');
      } else {
        await api.post('/ai-channels', {
          name: values.name, provider: values.provider, api_base: values.api_base,
          api_key: values.api_key, model: values.model,
          status: values.status, is_default: values.is_default, priority: values.priority,
        });
        message.success('渠道已添加');
      }
      setLlmModalVisible(false);
      fetchChannels();
    } catch (e: any) {
      if (e.response?.data?.error) message.error(e.response.data.error);
      else if (!e.errorFields) message.error('保存失败');
    } finally {
      setLlmSaving(false);
    }
  };

  const deleteChannel = async (id: number) => {
    try {
      await api.delete(`/ai-channels/${id}`);
      message.success('渠道已删除');
      fetchChannels();
    } catch (e: any) {
      message.error('删除失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const testChannel = async (channel: AiChannel) => {
    setLlmTesting(channel.id);
    try {
      const res = await api.post(`/ai-channels/${channel.id}/test`);
      if (res.data.success) {
        message.success('连接成功！AI 服务可用');
      } else {
        message.error(res.data.error || '连接失败');
      }
    } catch (e: any) {
      message.error('测试失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLlmTesting(null);
    }
  };

  /* ══════════════════════════ 视频大模型 ══════════════════════════ */
  const fetchVideoConfigs = useCallback(async () => {
    setVideoLoading(true);
    try {
      const res = await api.get('/video-models/configs');
      const configured = res.data.filter((c: any) => c.is_configured !== false);
      const available = res.data.filter((c: any) => c.is_configured === false);
      setVideoConfigs(configured);
      setVideoAvailable(available);
    } catch (e: any) {
      message.error('加载视频模型配置失败');
    } finally {
      setVideoLoading(false);
    }
  }, []);

  useEffect(() => { fetchVideoConfigs(); }, [fetchVideoConfigs]);

  const selectVideoModel = async (modelType: string) => {
    try {
      const res = await api.get(`/video-models/configs/${modelType}`);
      setVideoEditConfig(res.data);
      setSelectedVideoType(modelType);
      videoForm.setFieldsValue({
        api_url: res.data.api_url || '',
        api_key: '',
        model_name: res.data.model_name || DEFAULT_MODEL_NAMES[modelType] || '',
        status: res.data.status || 'enabled',
      });
    } catch (e: any) {
      message.error('加载配置失败');
    }
  };

  const saveVideoConfig = async () => {
    if (!selectedVideoType) return;
    try {
      const values = await videoForm.validateFields();
      setVideoSaving(true);
      await api.put(`/video-models/configs/${selectedVideoType}`, {
        api_url: values.api_url,
        api_key: values.api_key || undefined,
        model_name: values.model_name,
        status: values.status || 'enabled',
      });
      message.success('视频模型配置已保存');
      fetchVideoConfigs();
    } catch (e: any) {
      if (e.response?.data?.error) message.error(e.response.data.error);
      else if (!e.errorFields) message.error('保存失败');
    } finally {
      setVideoSaving(false);
    }
  };

  const testVideoConfig = async () => {
    if (!selectedVideoType) return;
    try {
      const values = await videoForm.getFieldsValue();
      setVideoTesting(true);

      // 先保存
      await api.put(`/video-models/configs/${selectedVideoType}`, {
        api_url: values.api_url,
        api_key: values.api_key || undefined,
        model_name: values.model_name,
        status: values.status,
      });

      const res = await api.post(`/video-models/configs/${selectedVideoType}/test`, {
        api_url: values.api_url,
        api_key: values.api_key,
        model_name: values.model_name,
      });
      if (res.data.success) {
        message.success('测试通过！');
      } else {
        message.error(res.data.error || '测试失败');
      }
      fetchVideoConfigs();
    } catch (e: any) {
      message.error('测试失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setVideoTesting(false);
    }
  };

  const deleteVideoConfig = async (modelType: string) => {
    try {
      await api.delete(`/video-models/configs/${modelType}`);
      message.success('配置已删除');
      if (selectedVideoType === modelType) {
        setSelectedVideoType(null);
        setVideoEditConfig(null);
        videoForm.resetFields();
      }
      fetchVideoConfigs();
    } catch (e: any) {
      message.error('删除失败');
    }
  };

  /* ══════════════════════════ Render: 语言大模型 Tab ══════════════════════════ */
  const renderLlmTab = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text type="secondary">语言大模型用于 Owen 智能对话、AI Engine Prompt 优化等文本分析场景</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openLlmModal()} style={{ borderRadius: 8 }}>
          添加渠道
        </Button>
      </div>

      {channelsLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin tip="加载中..." /></div>
      ) : channels.length === 0 ? (
        <Empty description="暂无AI渠道，点击「添加渠道」创建" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {channels.map(ch => (
            <Card
              key={ch.id}
              size="small"
              style={{
                borderRadius: 12,
                border: `1px solid ${ch.is_default ? T.primary : T.border}`,
                boxShadow: ch.is_default ? `0 0 0 1px ${T.primary}33` : undefined,
              }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              <Row align="middle" gutter={16}>
                <Col flex="auto">
                  <Space size={12} align="start">
                    {/* Icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 18, flexShrink: 0,
                    }}><ApiOutlined /></div>
                    {/* Info */}
                    <div>
                      <Space size={6}>
                        <Text strong style={{ fontSize: 15 }}>{ch.name}</Text>
                        {ch.is_default && <Tag color="blue" style={{ margin: 0, fontSize: 11 }}><StarFilled /> 默认</Tag>}
                        {ch.status === 'enabled'
                          ? <Badge status="success" text={<span style={{ fontSize: 11 }}>已启用</span>} />
                          : <Badge status="default" text={<span style={{ fontSize: 11 }}>已禁用</span>} />
                        }
                      </Space>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{ch.api_base}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}> · 模型: <Text code style={{ fontSize: 11 }}>{ch.model}</Text></Text>
                      </div>
                      {ch.api_key_masked && (
                        <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>
                          <EyeInvisibleOutlined style={{ marginRight: 4 }} />{ch.api_key_masked}
                        </div>
                      )}
                    </div>
                  </Space>
                </Col>
                <Col>
                  <Space size={6}>
                    <Button size="small" icon={<ExperimentOutlined />} loading={llmTesting === ch.id}
                      onClick={(e) => { e.stopPropagation(); testChannel(ch); }} style={{ borderRadius: 6 }}>
                      测试
                    </Button>
                    <Button size="small" icon={<EditOutlined />}
                      onClick={() => openLlmModal(ch)} style={{ borderRadius: 6 }}>编辑</Button>
                    <Popconfirm title="确定删除此渠道？" onConfirm={() => deleteChannel(ch.id)} okText="删除" cancelText="取消">
                      <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
                    </Popconfirm>
                  </Space>
                </Col>
              </Row>
            </Card>
          ))}
        </div>
      )}

      {/* LLM Edit Modal */}
      <Modal
        title={editingChannel ? '编辑语言大模型渠道' : '添加语言大模型渠道'}
        open={llmModalVisible}
        onCancel={() => setLlmModalVisible(false)}
        onOk={saveChannel}
        confirmLoading={llmSaving}
        width={520}
        okText="保存" cancelText="取消"
      >
        <Form form={llmForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="渠道名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如 DeepSeek、火山引擎" />
          </Form.Item>
          <Form.Item name="provider" label="服务商">
            <Select>
              <Option value="deepseek">DeepSeek</Option>
              <Option value="volcengine">火山引擎</Option>
              <Option value="openai">OpenAI</Option>
              <Option value="siliconflow">硅基流动</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </Form.Item>
          <Form.Item name="api_base" label="API 基地址" rules={[{ required: true, message: '请输入 API 地址' }]}
            extra="会在此地址后自动拼接 /chat/completions">
            <Input placeholder="https://api.deepseek.com/v1" prefix={<LinkOutlined />} />
          </Form.Item>
          <Form.Item name="model" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="deepseek-chat" prefix={<RobotOutlined />} />
          </Form.Item>
          <Form.Item name="api_key" label="API Key" extra={editingChannel ? '留空则保持原密钥不变' : ''}>
            <Input.Password placeholder="请输入 API Key" prefix={<KeyOutlined />} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select>
                  <Option value="enabled">启用</Option>
                  <Option value="disabled">禁用</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_default" label="设为默认" valuePropName="checked">
                <Select>
                  <Option value={true}>是</Option>
                  <Option value={false}>否</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="priority" label="优先级（越小越优先）">
            <Select>
              <Option value={1}>最高</Option>
              <Option value={50}>高</Option>
              <Option value={100}>默认</Option>
              <Option value={200}>低</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  /* ══════════════════════════ Render: 视频大模型 Tab ══════════════════════════ */
  const renderVideoTab = () => {
    const typeInfo = (type: string) => VIDEO_MODEL_TYPES.find(m => m.type === type) || VIDEO_MODEL_TYPES.find(m => m.type === 'custom')!;

    return (
      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          视频大模型用于 AI 工作室的视频生成。支持 Seedance、Kling、MiniMax 等多种模型。
        </Text>
        {videoLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin tip="加载中..." /></div>
        ) : (
          <Row gutter={24}>
            {/* 左侧：模型列表 */}
            <Col span={8}>
              {videoConfigs.length > 0 && (
                <Card title="已配置模型" size="small" style={{ marginBottom: 12, borderRadius: 10 }}>
                  <Space direction="vertical" style={{ width: '100%' }} size={6}>
                    {videoConfigs.map(cfg => {
                      const info = typeInfo(cfg.model_type);
                      const active = selectedVideoType === cfg.model_type;
                      return (
                        <Card
                          key={cfg.model_type} size="small" hoverable
                          style={{
                            cursor: 'pointer',
                            borderColor: active ? T.primary : T.border,
                            borderRadius: 8,
                          }}
                          bodyStyle={{ padding: 10 }}
                          onClick={() => selectVideoModel(cfg.model_type)}
                        >
                          <Space>
                            <span style={{ fontSize: 20 }}>{info.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{info.name}</div>
                              <Text type="secondary" style={{ fontSize: 11 }}>{cfg.model_name}</Text>
                            </div>
                            {cfg.status === 'enabled'
                              ? <Badge status="success" />
                              : <Badge status="default" />}
                          </Space>
                        </Card>
                      );
                    })}
                  </Space>
                </Card>
              )}

              <Card title="可添加模型" size="small" style={{ borderRadius: 10 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  {videoAvailable.map((type: any) => {
                    const info = typeInfo(type.type);
                    return (
                      <Card
                        key={type.type} size="small" hoverable
                        style={{ cursor: 'pointer', borderStyle: 'dashed', borderRadius: 8 }}
                        bodyStyle={{ padding: 10 }}
                        onClick={() => selectVideoModel(type.type)}
                      >
                        <Space>
                          <span style={{ fontSize: 18 }}>{info.icon}</span>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 12 }}>{info.name}</div>
                            <Text type="secondary" style={{ fontSize: 10 }}>{info.desc}</Text>
                          </div>
                        </Space>
                      </Card>
                    );
                  })}
                </Space>
              </Card>
            </Col>

            {/* 右侧：配置表单 */}
            <Col span={16}>
              {selectedVideoType ? (
                <Card
                  title={<Space><span style={{ fontSize: 22 }}>{typeInfo(selectedVideoType).icon}</span>{typeInfo(selectedVideoType).name}</Space>}
                  extra={
                    videoEditConfig?.id && (
                      <Popconfirm title="确定删除此配置？" onConfirm={() => deleteVideoConfig(selectedVideoType)} okText="删除" cancelText="取消">
                        <Button danger size="small" icon={<DeleteOutlined />}>删除配置</Button>
                      </Popconfirm>
                    )
                  }
                  style={{ borderRadius: 10 }}
                >
                  {videoEditConfig?.last_tested_at && (
                    <Alert
                      type={videoEditConfig.last_test_result === 'success' ? 'success' : 'error'}
                      showIcon style={{ marginBottom: 16, borderRadius: 8 }}
                      message={videoEditConfig.last_test_result === 'success' ? '测试通过' : '测试失败'}
                      description={videoEditConfig.last_test_message}
                    />
                  )}
                  <Form form={videoForm} layout="vertical">
                    <Form.Item name="api_url" label="API 接口地址"
                      rules={[{ required: true, message: '请输入 API 地址' }]}>
                      <Input placeholder="https://ark.cn-beijing.volces.com/api/v3" prefix={<LinkOutlined />} />
                    </Form.Item>
                    <Form.Item name="model_name" label="模型名称"
                      rules={[{ required: true, message: '请输入模型名称' }]}
                      extra="在模型提供方控制台中获取">
                      <Input placeholder={DEFAULT_MODEL_NAMES[selectedVideoType] || 'model-name'} prefix={<RobotOutlined />} />
                    </Form.Item>
                    <Form.Item name="api_key" label="API Key"
                      extra={videoEditConfig?.api_key_masked ? `当前密钥: ${videoEditConfig.api_key_masked}` : '作为 Bearer Token 使用'}>
                      <Input.Password placeholder={videoEditConfig?.api_key_masked ? '留空保持原密钥' : '请输入 API Key'} prefix={<KeyOutlined />} />
                    </Form.Item>
                    <Form.Item name="status" label="状态">
                      <Select>
                        <Option value="enabled">启用</Option>
                        <Option value="disabled">禁用</Option>
                      </Select>
                    </Form.Item>
                  </Form>
                  <Space>
                    <Button type="primary" icon={<SaveOutlined />} onClick={saveVideoConfig} loading={videoSaving} style={{ borderRadius: 8 }}>
                      保存配置
                    </Button>
                    <Button icon={<ThunderboltOutlined />} onClick={testVideoConfig} loading={videoTesting} style={{ borderRadius: 8 }}>
                      测试连接
                    </Button>
                  </Space>
                </Card>
              ) : (
                <Card style={{ borderRadius: 10 }}>
                  <Empty description="请从左侧选择一个模型进行配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </Card>
              )}
            </Col>
          </Row>
        )}
      </div>
    );
  };

  /* ══════════════════════════ Main Render ══════════════════════════ */
  return (
    <div style={{ padding: '20px 24px', background: T.bg, minHeight: '100%' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `linear-gradient(135deg, ${T.primary}, ${T.primaryHover})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18, boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
        }}>
          <ApiOutlined />
        </div>
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.textPrimary }}>
            API 管理
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>管理所有 AI 模型配置，包括语言大模型和视频大模型</Text>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'llm',
            label: <span><ApiOutlined /> 语言大模型</span>,
            children: renderLlmTab(),
          },
          {
            key: 'video',
            label: <span><ThunderboltOutlined /> 视频大模型</span>,
            children: renderVideoTab(),
          },
        ]}
        style={{
          background: T.cardBg,
          borderRadius: 12,
          padding: '0 20px 20px',
          border: `1px solid ${T.border}`,
        }}
        tabBarStyle={{ marginBottom: 0 }}
      />
    </div>
  );
}
