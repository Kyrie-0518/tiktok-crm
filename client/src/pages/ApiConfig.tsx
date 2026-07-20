import React, { useEffect, useState } from 'react';
import {
  Card, Button, Form, Input, Tag, message, Spin, Space, Typography, Modal, Row, Col, Select
} from 'antd';
import {
  ApiOutlined, ThunderboltOutlined, DeleteOutlined,
  EditOutlined, LinkOutlined, KeyOutlined, RobotOutlined, ReloadOutlined,
  ExperimentOutlined, EyeInvisibleOutlined, SearchOutlined
} from '@ant-design/icons';
import api from '../api';

const { Text, Title } = Typography;
const { Option } = Select;

interface ApiConfigItem {
  type: 'llm' | 'video';
  name: string;
  description: string;
  configured: boolean;
  enabled: boolean;
  api_url: string;
  query_endpoint?: string;
  model_name: string;
  api_key_masked: string;
  has_key: boolean;
  model_type?: string;
}

const ICONS: Record<string, any> = {
  llm: <ApiOutlined />,
  video: <ThunderboltOutlined />,
};

const ICON_BG: Record<string, string> = {
  llm: 'linear-gradient(135deg, #059669, #10b981)',
  video: 'linear-gradient(135deg, #2563eb, #3b82f6)',
};

export default function ApiConfig() {
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState<ApiConfigItem[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<'llm' | 'video' | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [testingType, setTestingType] = useState<string | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/api-configs');
      setConfigs(res.data.configs || []);
    } catch (e: any) {
      message.error('加载配置失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleEdit = (cfg: ApiConfigItem) => {
    setEditingType(cfg.type);
    const defaultQuery = cfg.api_url ? `${cfg.api_url.replace(/\/+$/, '')}/contents/generations/tasks/{id}` : '';
    form.setFieldsValue({
      api_url: cfg.api_url,
      query_endpoint: cfg.query_endpoint || defaultQuery,
      model_name: cfg.model_name,
      api_key: '',
      status: cfg.enabled ? 'enabled' : 'disabled',
    });
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api.put(`/admin/api-configs/${editingType}`, {
        api_url: values.api_url,
        api_key: values.api_key || undefined,
        model_name: values.model_name,
        status: values.status,
      });
      message.success('配置保存成功');
      setEditModalVisible(false);
      fetchConfigs();
    } catch (e: any) {
      if (e.response?.data?.error) message.error(e.response.data.error);
      else if (!e.errorFields) message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (type: string) => {
    Modal.confirm({
      title: '确定清空此配置？',
      content: '清空后相关功能将无法使用，确认继续？',
      okText: '清空',
      okType: 'danger',
      onOk: async () => {
        try {
          await api.delete(`/admin/api-configs/${type}`);
          message.success('配置已清空');
          fetchConfigs();
        } catch (e: any) {
          message.error('清空失败: ' + (e.response?.data?.error || e.message));
        }
      },
    });
  };

  const handleTest = async (cfg: ApiConfigItem) => {
    if (!cfg.api_url || !cfg.model_name || !cfg.has_key) {
      message.warning('请先编辑并保存完整配置（含API密钥）后再测试');
      return;
    }
    setTestingType(cfg.type);
    try {
      const res = await api.post(`/admin/api-configs/${cfg.type}/test`, {
        api_url: cfg.api_url,
        api_key: '', // 后端从已保存的配置中读取密钥
        model_name: cfg.model_name,
      });
      if (res.data.success) {
        message.success(res.data.message);
      } else {
        message.error(res.data.error || '连接失败');
      }
    } catch (e: any) {
      message.error('测试失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setTestingType(null);
    }
  };

  const renderConfigCard = (cfg: ApiConfigItem) => {
    return (
      <Card
        key={cfg.type}
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          border: '1px solid #e8e5e0',
          marginBottom: 16,
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 24 }}
      >
        <Row gutter={[24, 16]}>
          {/* 左侧：图标 + 信息 */}
          <Col flex="1">
            <Space align="start" size={16}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: ICON_BG[cfg.type] || '#ccc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 20, flexShrink: 0,
              }}>
                {ICONS[cfg.type]}
              </div>
              <div>
                <Space size={8} align="center" style={{ marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 16 }}>{cfg.name}</Text>
                  {cfg.configured ? (
                    <Tag color="success" style={{ fontSize: 12, margin: 0 }}>已配置</Tag>
                  ) : (
                    <Tag color="default" style={{ fontSize: 12, margin: 0 }}>未配置</Tag>
                  )}
                  {cfg.enabled ? (
                    <Tag color="processing" style={{ fontSize: 12, margin: 0 }}>已启用</Tag>
                  ) : (
                    <Tag style={{ fontSize: 12, margin: 0 }}>未启用</Tag>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                  {cfg.description}
                </Text>
              </div>
            </Space>

            {/* 详情字段 */}
            <div style={{ marginTop: 20, paddingLeft: 60 }}>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  提交接口 (POST)
                </Text>
                <div style={{ fontSize: 13, color: '#1e293b', fontFamily: 'monospace', marginTop: 2, wordBreak: 'break-all' }}>
                  {cfg.api_url ? `${cfg.api_url.replace(/\/+$/, '')}/contents/generations/tasks` : '—'}
                </div>
              </div>
              {cfg.type === 'video' && (
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    查询接口 (GET)
                  </Text>
                  <div style={{ fontSize: 13, color: '#1e293b', fontFamily: 'monospace', marginTop: 2, wordBreak: 'break-all' }}>
                    {cfg.query_endpoint || (cfg.api_url ? `${cfg.api_url.replace(/\/+$/, '')}/contents/generations/tasks/{id}` : '—')}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  模型
                </Text>
                <div style={{ fontSize: 13, color: '#1e293b', fontFamily: 'monospace', marginTop: 2 }}>
                  {cfg.model_name || '—'}
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  API密钥
                </Text>
                <div style={{ fontSize: 13, color: '#1e293b', fontFamily: 'monospace', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {cfg.api_key_masked ? (
                    <>
                      <EyeInvisibleOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                      {cfg.api_key_masked}
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
            </div>
          </Col>

          {/* 右侧：操作按钮 */}
          <Col>
            <Space direction="vertical" size={8} style={{ alignItems: 'flex-end' }}>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleClear(cfg.type)}
              >
                清空配置
              </Button>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(cfg)}
              >
                编辑
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<ExperimentOutlined />}
                loading={testingType === cfg.type}
                onClick={() => handleTest(cfg)}
              >
                测试连接
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
    );
  };

  return (
    <div style={{ padding: '20px 24px', background: '#f5f3f0', minHeight: '100%' }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
            API管理
          </Title>
          <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
            配置团队使用的大模型API密钥，未配置的功能将不可用
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchConfigs} loading={loading}>
          刷新
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin tip="加载配置中..." />
        </div>
      ) : (
        <>
          {configs.map(renderConfigCard)}

          {/* 编辑弹窗 */}
          <Modal
            title={editingType === 'llm' ? '编辑语言大模型配置' : '编辑视频大模型配置'}
            open={editModalVisible}
            onCancel={() => setEditModalVisible(false)}
            onOk={handleSave}
            confirmLoading={saving}
            width={520}
            okText="保存"
            cancelText="取消"
          >
            <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
              <Form.Item
                name="api_url"
                label="提交接口地址 (POST)"
                extra={editingType === 'video' ? '用于提交视频生成任务，路径: /contents/generations/tasks' : ''}
                rules={[{ required: true, message: '请输入 API 接口地址' }]}
              >
                <Input
                  placeholder={editingType === 'llm' ? 'https://api.deepseek.com/v1' : 'https://ark.cn-beijing.volces.com/api/v3'}
                  prefix={<LinkOutlined />}
                />
              </Form.Item>

              {editingType === 'video' && (
                <Form.Item
                  name="query_endpoint"
                  label="查询接口地址 (GET)"
                  extra="用于查询异步任务状态，{id} 将被替换为任务ID"
                >
                  <Input
                    placeholder="https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}"
                    prefix={<SearchOutlined />}
                  />
                </Form.Item>
              )}

              <Form.Item
                name="model_name"
                label="模型名称"
                rules={[{ required: true, message: '请输入模型名称' }]}
              >
                <Input
                  placeholder={editingType === 'llm' ? 'deepseek-chat' : 'doubao-seedance-2-0-260128'}
                  prefix={<RobotOutlined />}
                />
              </Form.Item>

              <Form.Item
                name="api_key"
                label="API Key"
                extra="留空则保持原密钥不变"
              >
                <Input.Password placeholder="请输入新的 API Key" prefix={<KeyOutlined />} />
              </Form.Item>

              <Form.Item
                name="status"
                label="状态"
                initialValue="enabled"
              >
                <Select>
                  <Option value="enabled">启用</Option>
                  <Option value="disabled">禁用</Option>
                </Select>
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </div>
  );
}
