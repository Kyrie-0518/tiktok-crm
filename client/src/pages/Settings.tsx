import { useEffect, useState } from 'react';
import { Card, Button, Modal, Form, Input, Space, message, List, Spin, Alert, Tag } from 'antd';
import { ThunderboltOutlined, RobotOutlined, SettingOutlined, SendOutlined } from '@ant-design/icons';
import api from '../api';
import { useAIStore } from '../stores/aiStore';
import { useIsDeveloper, useIsManager, useHasPerm } from '../stores/authStore';

export default function Settings() {
  const [backups, setBackups] = useState<any[]>([]);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm] = Form.useForm();

  // AI 配置 — 从服务端数据库加载
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiApiBase, setAiApiBase] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiTesting, setAiTesting] = useState(false);
  const [aiConfigLoading, setAiConfigLoading] = useState(true);

  // 飞书配置
  const [feishuWebhookUrl, setFeishuWebhookUrl] = useState('');
  const [feishuSaved, setFeishuSaved] = useState(false);

  // Role-based visibility
  const isDeveloper = useIsDeveloper();
  const isManager = useIsManager();
  const canEditSettings = useHasPerm('settings-config', 'edit');

  useEffect(() => {
    // Load AI config from server
    useAIStore.getState().loadConfig().then(() => {
      const s = useAIStore.getState();
      setAiApiKey(s.apiKey || '');
      setAiApiBase(s.apiBase || 'https://api.deepseek.com/v1');
      setAiModel(s.model || 'deepseek-chat');
      setAiConfigLoading(false);
    });
    // Load Feishu config
    api.get('/settings').then(r => {
      const settings = r.data || {};
      if (settings.feishu_webhook) {
        setFeishuWebhookUrl(settings.feishu_webhook.url || '');
      }
    }).catch(() => {});
  }, []);

  const handleSaveAIConfig = async () => {
    try {
      await useAIStore.getState().saveConfig(aiApiKey, aiApiBase, aiModel);
      message.success('AI 配置已保存（所有设备同步）');
    } catch {
      message.error('保存失败');
    }
  };

  const handleTestAI = async () => {
    setAiTesting(true);
    try {
      const key = aiApiKey || useAIStore.getState().apiKey;
      if (!key) { message.error('请先填写 API Key'); setAiTesting(false); return; }
      const res = await api.post('/ai/test-config');
      if (res.data.success) {
        message.success(`${res.data.message}（模型: ${res.data.model || '-'}）`);
      } else {
        message.error(res.data.error || '测试失败');
      }
    } catch (e: any) {
      message.error(`连接失败: ${e.response?.data?.error || e.message}`, 8);
    } finally {
      setAiTesting(false);
    }
  };

  const handleSaveFeishu = async () => {
    try {
      await api.put('/settings', {
        feishu_webhook: { url: feishuWebhookUrl },
      });
      setFeishuSaved(true);
      message.success('飞书配置已保存');
      setTimeout(() => setFeishuSaved(false), 3000);
    } catch (e: any) {
      message.error(e.response?.data?.error || '保存失败');
    }
  };

  const loadData = async () => {
    const r = await api.get('/settings/backup/list').catch(() => ({ data: [] }));
    setBackups(r.data);
  };

  useEffect(() => { loadData(); }, []);

  const handleChangePassword = async (values: any) => {
    try {
      await api.put('/auth/password', values);
      setPasswordModalOpen(false);
      passwordForm.resetFields();
      message.success('密码修改成功');
    } catch (e: any) {
      message.error(e.response?.data?.error || '修改失败');
    }
  };

  const handleBackup = async () => {
    try {
      await api.post('/settings/backup/trigger');
      message.success('备份成功');
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '备份失败');
    }
  };

  return (
    <div style={{ padding: '20px 24px', background: '#f5f3f0', minHeight: '100%' }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18,
        }}>
          <SettingOutlined />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>系统设置</h2>
          <span style={{ fontSize: 12, color: '#999' }}>AI配置 · 飞书集成 · 数据备份</span>
        </div>
      </div>


      {/* Data Backup — developer can trigger, manager+ can view */}
      {(isDeveloper || isManager) && (
        <Card title="数据备份" style={{ marginBottom: 16 }}
          extra={<Space>
            <span style={{ color: '#999', fontSize: 12 }}>系统每日凌晨2:00自动备份</span>
            {isDeveloper && <Button type="primary" onClick={handleBackup}>手动备份</Button>}
          </Space>}
        >
          {backups.length > 0 ? (
            <List
              size="small"
              bordered
              dataSource={backups.slice(0, 10)}
              renderItem={(item: any) => (
                <List.Item>
                  <span>{item.name}</span>
                  <Space>
                    <Tag>{item.size}</Tag>
                    <span style={{ color: '#999', fontSize: 12 }}>{item.date}</span>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无备份记录</div>
          )}
        </Card>
      )}

      {/* AI 配置 — developer + manager */}
      {isManager && (
        <Card title="AI 配置" style={{ marginBottom: 16 }}>
          {aiConfigLoading ? (
            <div style={{ textAlign: 'center', padding: 20 }}><Spin tip="加载配置中..." /></div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>API Key</div>
                <Input.Password
                  value={aiApiKey} onChange={e => setAiApiKey(e.target.value)}
                  placeholder="sk-..." style={{ maxWidth: 500 }}
                />
              </div>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>API Base URL</div>
                <Input
                  value={aiApiBase} onChange={e => setAiApiBase(e.target.value)}
                  placeholder="https://api.deepseek.com/v1" style={{ maxWidth: 500 }}
                />
              </div>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>模型名称</div>
                <Input
                  value={aiModel} onChange={e => setAiModel(e.target.value)}
                  placeholder="deepseek-chat" style={{ maxWidth: 500 }}
                />
              </div>
              <Space>
                {canEditSettings && <Button type="primary" onClick={handleSaveAIConfig}>保存配置</Button>}
                <Button icon={<ThunderboltOutlined />} onClick={handleTestAI} loading={aiTesting}>测试连接</Button>
              </Space>
            </Space>
          )}
        </Card>
      )}

      {/* 飞书集成配置 — manager+ */}
      {isManager && (
        <Card
          title={<span><RobotOutlined style={{ color: '#3370ff', marginRight: 8 }} />飞书集成配置</span>}
          style={{ marginBottom: 16 }}
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="如何获取飞书 Webhook 地址？"
            description={
              <div style={{ fontSize: 12 }}>
                1. 打开飞书群 → 群设置 → 群机器人 → 添加自定义机器人<br />
                2. 设置机器人名称（如：虾掌柜汇报助手）→ 复制 Webhook 地址<br />
                3. 将地址粘贴到下方输入框中保存即可
              </div>
            }
          />
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>飞书群 Webhook 地址</div>
              <Input
                value={feishuWebhookUrl}
                onChange={e => setFeishuWebhookUrl(e.target.value)}
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxx"
                style={{ maxWidth: 600 }}
              />
              <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                达人BD提交日报/周报时，会自动推送到此飞书群
              </div>
            </div>
            {canEditSettings && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSaveFeishu}
                style={{ background: feishuSaved ? '#52c41a' : '#2563eb' }}
              >
                {feishuSaved ? '已保存 ✓' : '保存飞书配置'}
              </Button>
            )}
          </Space>
        </Card>
      )}

      {/* System Info — all roles */}
      <Card title="系统信息">
        <p><strong>系统名称：</strong>博众智汇全域跨境经营管理系统</p>
        <p><strong>品牌寓意：</strong>博纳四方商机，汇聚众家智慧。以专业数字化架构融合前沿人工智能技术，全面赋能跨境出海商业发展，一体化统筹店铺运维、产品管理、订单流转全链路业务，深度搭载 AI 智能内容创作体系，一站式构建跨境出海完整运营生态。</p>
        <p><strong>业务定位：</strong>集跨境 ERP 综合管理与 AI 智能创意创作于一体，既可实现店铺、商品、订单全流程精细化管控，也能完成海外市场竞品研判、营销脚本定制、跨境带货短视频智能生成，全方位适配 TikTok 等海外主流平台出海运营全场景需求。</p>
        <p><strong>技术栈：</strong>React + Ant Design + Express + SQLite</p>
        <p><strong>数据存储：</strong>本地SQLite数据库（server/data/erp.db）</p>
        <p><strong>当前版本：</strong>v1.3.0</p>
        <p><strong>版权声明：</strong>© 博众智汇 全域跨境经营管理系统 版权所有</p>
      </Card>

      {/* Change Password Modal */}
      <Modal title="修改密码" open={passwordModalOpen} onCancel={() => setPasswordModalOpen(false)} onOk={() => passwordForm.submit()}>
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}
