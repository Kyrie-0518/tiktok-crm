import React, { useEffect, useState } from 'react';
import { Card, Button, Input, Space, message, Typography, Tag, Alert, Divider, Spin } from 'antd';
import {
  RobotOutlined, WechatOutlined, ThunderboltOutlined,
  CopyOutlined, SaveOutlined, ReloadOutlined, CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import api from '../api';

const { Text, Title } = Typography;

interface BotConfig {
  platform: string;
  name: string;
  icon: React.ReactNode;
  envKeys: string[];
  instructions: string;
}

const BOT_CONFIGS: BotConfig[] = [
  {
    platform: 'wecom',
    name: '企业微信',
    icon: <WechatOutlined />,
    envKeys: ['WECOM_CORP_ID', 'WECOM_AGENT_ID', 'WECOM_SECRET', 'WECOM_TOKEN', 'WECOM_ENCODING_AES_KEY'],
    instructions: `1. 登录 work.weixin.qq.com → 应用管理 → 自建应用 → 创建应用
2. 在「我的企业」→「企业信息」获取 CorpID
3. 在应用详情页获取 AgentId 和 Secret
4. 在「接收消息」→「设置API接收」：
   - URL: https://bvefdvp.cn/api/bot/wecom/callback
   - Token: 随机字符串（自己设定）
   - EncodingAESKey: 随机43位（点随机获取）
5. 在下方填入上述5个参数，保存即可`,
  },
  {
    platform: 'feishu',
    name: '飞书',
    icon: <ThunderboltOutlined />,
    envKeys: ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_VERIFICATION_TOKEN', 'FEISHU_ENCRYPT_KEY'],
    instructions: `1. 登录 open.feishu.cn → 开发者后台 → 创建企业自建应用
2. 在「凭证与基础信息」获取 App ID 和 App Secret
3. 在「应用功能」→ 添加「机器人」能力
4. 在「事件订阅」→ 配置请求地址：
   URL: https://bvefdvp.cn/api/bot/feishu/callback
5. 在「安全设置」→ 查看「事件加密」Encrypt Key（如果关闭了事件加密，该项留空）
6. 在下方填入4个参数，保存即可`,
  },
];

export default function BotManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>({});
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});

  // 从后端获取当前配置
  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/api-configs/bot');
      setConfigs(res.data.configs || {});
      setStatuses(res.data.statuses || {});
    } catch (e: any) {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (platform: string, envKeys: string[]) => {
    const values = configs[platform] || {};
    const missing = envKeys.filter(k => !values[k]);
    if (missing.length > 0) {
      message.warning(`请填写所有必填项：${missing.join(', ')}`);
      return;
    }

    setSaving(platform);
    try {
      const res = await api.put('/admin/api-configs/bot', { platform, values });
      if (res.data.success) {
        message.success(`${BOT_CONFIGS.find(b => b.platform === platform)?.name} 配置已保存，重启服务后生效`);
        setStatuses(prev => ({ ...prev, [platform]: true }));
      } else {
        message.error(res.data.error || '保存失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.error || '保存失败');
    } finally {
      setSaving(null);
    }
  };

  const handleClear = async (platform: string) => {
    try {
      await api.delete(`/admin/api-configs/bot/${platform}`);
      setConfigs(prev => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
      setStatuses(prev => ({ ...prev, [platform]: false }));
      message.success('配置已清空');
    } catch (e: any) {
      message.error('清空失败');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin tip="加载配置中..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', background: '#f5f3f0', minHeight: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
          <RobotOutlined style={{ marginRight: 8, color: '#2563eb' }} />
          Bot 管理中心
        </Title>
        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
          配置企业微信和飞书机器人，让团队成员在聊天软件里直接使用欧文智能体
        </Text>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: 20 }}>
        {BOT_CONFIGS.map(bot => {
          const values = configs[bot.platform] || {};
          const configured = statuses[bot.platform];
          return (
            <Card
              key={bot.platform}
              title={
                <Space>
                  <span style={{ fontSize: 18, color: '#2563eb' }}>{bot.icon}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{bot.name} Bot</span>
                  {configured ? (
                    <Tag color="success" icon={<CheckCircleOutlined />} style={{ borderRadius: 6 }}>已配置</Tag>
                  ) : (
                    <Tag icon={<CloseCircleOutlined />} style={{ borderRadius: 6 }}>未配置</Tag>
                  )}
                </Space>
              }
              style={{
                borderRadius: 12, border: '1px solid #e8e5e0',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
              bodyStyle={{ padding: 20 }}
            >
              {/* 配置说明 */}
              <Alert
                type="info" showIcon
                message="接入步骤"
                description={
                  <div style={{ fontSize: 12, whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                    {bot.instructions}
                  </div>
                }
                style={{ marginBottom: 16, borderRadius: 8 }}
              />

              {/* 参数表单 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bot.envKeys.map(key => (
                  <div key={key}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontFamily: 'monospace' }}>
                      {key}
                    </div>
                    <Input.Password
                      placeholder={`请输入 ${key}`}
                      value={values[key] || ''}
                      onChange={e => {
                        setConfigs(prev => ({
                          ...prev,
                          [bot.platform]: { ...(prev[bot.platform] || {}), [key]: e.target.value }
                        }));
                      }}
                      style={{ borderRadius: 8 }}
                    />
                  </div>
                ))}
              </div>

              <Divider style={{ margin: '16px 0' }} />

              {/* 操作按钮 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ⚠️ 保存后需重启Docker服务：docker compose down && docker compose up -d
                </Text>
                <Space>
                  <Button
                    size="small" danger icon={<CloseCircleOutlined />}
                    onClick={() => handleClear(bot.platform)}
                  >
                    清空
                  </Button>
                  <Button
                    type="primary" size="small"
                    icon={<SaveOutlined />}
                    loading={saving === bot.platform}
                    onClick={() => handleSave(bot.platform, bot.envKeys)}
                  >
                    保存配置
                  </Button>
                </Space>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 回调地址 */}
      <Card
        title="回调地址"
        style={{
          marginTop: 20, borderRadius: 12, border: '1px solid #e8e5e0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
        bodyStyle={{ padding: 20 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tag color="green" style={{ borderRadius: 6 }}>企业微信</Tag>
            <Text code style={{ fontSize: 13, flex: 1 }}>https://bvefdvp.cn/api/bot/wecom/callback</Text>
            <Button size="small" icon={<CopyOutlined />} onClick={() => {
              navigator.clipboard.writeText('https://bvefdvp.cn/api/bot/wecom/callback');
              message.success('已复制');
            }}>复制</Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tag color="blue" style={{ borderRadius: 6 }}>飞书</Tag>
            <Text code style={{ fontSize: 13, flex: 1 }}>https://bvefdvp.cn/api/bot/feishu/callback</Text>
            <Button size="small" icon={<CopyOutlined />} onClick={() => {
              navigator.clipboard.writeText('https://bvefdvp.cn/api/bot/feishu/callback');
              message.success('已复制');
            }}>复制</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
