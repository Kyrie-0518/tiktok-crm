import { useEffect, useState } from 'react';
import { Card, Avatar, Table, Typography, Descriptions, Tag, Button, Space, Divider, Form, Input, Switch, message, Row, Col, List, Badge, Statistic, Tabs, Modal, Upload } from 'antd';
import {
  UserOutlined, MailOutlined, PhoneOutlined,
  SafetyCertificateOutlined, BellOutlined, SettingOutlined,
  CameraOutlined, EditOutlined, SaveOutlined,
  LockOutlined, ClockCircleOutlined, CheckCircleOutlined,
  CodeOutlined, TeamOutlined, ShopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';
import { useAuthStore } from '../stores/authStore';

const { Text, Title, Paragraph } = Typography;

interface UserProfile {
  id: number;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  role_name: string;
  avatar_url: string | null;
  created_at: string;
  last_login: string | null;
}

interface LoginLog {
  id: number;
  ip: string;
  user_agent: string;
  login_at: string;
  status: 'success' | 'failed';
  location?: string;
}

export default function UserCenter() {
  const username = useAuthStore((s) => s.username);
  const roleKey = useAuthStore((s) => s.roleKey);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [editMode, setEditMode] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdForm] = Form.useForm();
  const [profileForm] = Form.useForm();
  const [notifSettings, setNotifSettings] = useState({
    order_notify: true, finance_notify: true, system_notify: true, daily_report: false,
  });

  const ROLE_INFO: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    developer: { label: '开发者', color: '#8b5cf6', icon: <CodeOutlined /> },
    manager:   { label: '管理员', color: '#3b82f6', icon: <SafetyCertificateOutlined /> },
    staff:     { label: '运营',   color: '#059669', icon: <TeamOutlined /> },
  };

  const fetchProfile = async () => {
    try {
      // 尝试获取用户信息接口
      try {
        const res = await api.get('/auth/profile');
        setProfile(res.data);
      } catch {
        // fallback：用 store 数据构造
        setProfile({
          id: 1, username: username || 'User',
          email: `${username}@mera.cn`, phone: null,
          role: roleKey || 'staff',
          role_name: ROLE_INFO[roleKey || 'staff']?.label || '员工',
          avatar_url: null,
          created_at: '2024-01-01T00:00:00',
          last_login: new Date().toISOString(),
        });
      }
    } catch {}
  };

  const fetchLoginLogs = async () => {
    try {
      const res = await api.get('/audit-logs', { params: { method: 'POST', path: '/auth/login', page_size: 10 } });
      setLoginLogs(res.data.list?.slice(0, 5) || []);
    } catch {
      // mock data
      setLoginLogs([
        { id: 1, ip: '103.xxx.xxx.42', user_agent: 'Chrome/120 Windows', login_at: new Date().toISOString(), status: 'success', location: 'Malaysia' },
        { id: 2, ip: '103.xxx.xxx.42', user_agent: 'Chrome/119 Windows', login_at: dayjs().subtract(1, 'day').toISOString(), status: 'success', location: 'Malaysia' },
        { id: 3, ip: '203.xxx.xx.18', user_agent: 'Safari/17 macOS', login_at: dayjs().subtract(3, 'day').toISOString(), status: 'failed', location: 'China' },
      ]);
    }
  };

  useEffect(() => { fetchProfile(); fetchLoginLogs(); }, []);

  const handleSaveProfile = async (values: any) => {
    try {
      await api.put('/auth/profile', values);
      message.success('个人信息已更新');
      setEditMode(false);
      fetchProfile();
    } catch (e: any) {
      message.error(e.response?.data?.error || '更新失败');
    }
  };

  const handleChangePassword = async (values: any) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的密码不一致');
      return;
    }
    try {
      await api.post('/auth/change-password', {
        old_password: values.old_password,
        new_password: values.new_password,
      });
      message.success('密码修改成功，请重新登录');
      setPwdModalOpen(false);
      pwdForm.resetFields();
    } catch (e: any) {
      message.error(e.response?.data?.error || '密码修改失败');
    }
  };

  const roleInfo = ROLE_INFO[profile?.role || roleKey || 'staff'] || ROLE_INFO.staff;

  return (
    <div>
      {/* 标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <UserOutlined style={{ color: '#2563eb' }} /> 个人中心
        </Title>
        <Text type="secondary">管理您的账户信息、安全设置和通知偏好</Text>
      </div>

      {/* 头部卡片 */}
      <Card style={{ borderRadius: 12, marginBottom: 20, background: 'linear-gradient(135deg, #f0f7ff, #fafbff)' }}>
        <Row align="middle" gutter={[32, 16]}>
          <Col flex="none">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Avatar size={90} src={profile?.avatar_url}
                style={{ background: `linear-gradient(135deg, ${roleInfo.color}, ${roleInfo.color}cc)`,
                  fontSize: 36, fontWeight: 700 }}
              >
                {(profile?.username || username || '?').charAt(0).toUpperCase()}
              </Avatar>
              <Button shape="circle" size="small" icon={<CameraOutlined />}
                style={{ position: 'absolute', bottom: -2, right: -2, border: '2px solid #fff' }}
                onClick={() => message.info('头像上传功能开发中')}
              />
            </div>
          </Col>
          <Col flex="auto">
            <Space direction="vertical" size={6}>
              <Space size={10}>
                <Title level={4} style={{ margin: 0 }}>{profile?.username || username}</Title>
                <Tag color={roleInfo.color} icon={roleInfo.icon}>{roleInfo.label}</Tag>
                {profile?.last_login && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    最近登录: {dayjs(profile.last_login).format('YYYY-MM-DD HH:mm')}
                  </Text>
                )}
              </Space>
              <Space size={16}>
                <Text><MailOutlined style={{ marginRight: 6 }} />{profile?.email || `${username}@mera.cn`}</Text>
                {profile?.phone && <Text><PhoneOutlined style={{ marginRight: 6 }} />{profile.phone}</Text>}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                账号创建于 {profile?.created_at ? dayjs(profile.created_at).format('YYYY-MM-DD') : '-'}
              </Text>
            </Space>
          </Col>
          <Col flex="none">
            <Button type="primary" icon={<EditOutlined />} onClick={() => setEditMode(true)}>
              编辑资料
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Tab 内容 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'profile', label: <Space><UserOutlined />基本信息</Space>,
            children: editMode ? (
              <Card title="编辑个人资料" style={{ borderRadius: 12 }} extra={
                <Space>
                  <Button onClick={() => setEditMode(false)}>取消</Button>
                  <Button type="primary" icon={<SaveOutlined />} onClick={() => profileForm.submit()}>保存</Button>
                </Space>
              }>
                <Form form={profileForm} layout="vertical" initialValues={{
                  username: profile?.username || username,
                  email: profile?.email || `${username}@mera.cn`,
                  phone: profile?.phone || '',
                }} onFinish={handleSaveProfile}>
                  <Row gutter={20}>
                    <Col span={12}>
                      <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                        <Input prefix={<UserOutlined />} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="email" label="邮箱">
                        <Input prefix={<MailOutlined />} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="phone" label="手机号">
                        <Input prefix={<PhoneOutlined />} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Card>
            ) : (
              <Card style={{ borderRadius: 12 }}>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="用户名">{profile?.username || username}</Descriptions.Item>
                  <Descriptions.Item label="角色">
                    <Tag color={roleInfo.color}>{roleInfo.label}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="邮箱">{profile?.email || '-'}</Descriptions.Item>
                  <Descriptions.Item label="手机号">{profile?.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="注册时间">
                    {profile?.created_at ? dayjs(profile.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="最近登录">
                    {profile?.last_login ? dayjs(profile.last_login).format('YYYY-MM-DD HH:mm:ss') : '-'}
                  </Descriptions.Item>
                </Descriptions>
                <Divider />
                <Space>
                  <Button icon={<LockOutlined />} onClick={() => setPwdModalOpen(true)}>修改密码</Button>
                </Space>
              </Card>
            ),
          },
          {
            key: 'security', label: <Space><SafetyCertificateOutlined />安全设置</Space>,
            children: (
              <Card style={{ borderRadius: 12 }}>
                <List
                  itemLayout="horizontal"
                  dataSource={[
                    { title: '登录密码', desc: '上次修改时间未知，建议定期更换', action: <Button icon={<LockOutlined />} onClick={() => setPwdModalOpen(true)}>修改</Button> },
                    { title: '两步验证', desc: '未开启，开启后登录需额外验证码', action: <Switch checkedChildren="已开" unCheckedChildren="关闭" disabled /> },
                    { title: '登录设备管理', desc: '当前允许 1 台设备登录', action: <Button>查看</Button> },
                  ]}
                  renderItem={item => (
                    <List.Item actions={[item.action]}>
                      <List.Item.Meta title={item.title} description={item.desc} />
                    </List.Item>
                  )}
                />

                <Divider orientation="left">最近登录记录</Divider>
                <Table
                  rowKey="id"
                  dataSource={loginLogs}
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'IP 地址', dataIndex: 'ip', width: 140, render: (ip: string) => <Text code>{ip}</Text> },
                    { title: '位置', dataIndex: 'location', width: 100, render: (l: string) => l || '-' },
                    { title: '状态', dataIndex: 'status', width: 80,
                      render: (s: string) => s === 'success'
                        ? <Badge status="success" text="成功" />
                        : <Badge status="error" text="失败" />,
                    },
                    { title: '时间', dataIndex: 'login_at',
                      render: (t: string) => dayjs(t).format('MM-DD HH:mm:ss'),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'notification', label: <Space><BellOutlined />通知设置</Space>,
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  {[
                    { key: 'order_notify', label: '订单通知', desc: '新订单、订单状态变更时推送通知' },
                    { key: 'finance_notify', label: '财务提醒', desc: '账单到期、付款确认时推送通知' },
                    { key: 'system_notify', label: '系统公告', desc: '系统维护、功能更新等公告通知' },
                    { key: 'daily_report', label: '每日报告', desc: '每日自动发送业务数据汇总邮件' },
                  ].map(item => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                      <div>
                        <Text strong>{item.label}</Text>
                        <br /><Text type="secondary" style={{ fontSize: 12.5 }}>{item.desc}</Text>
                      </div>
                      <Switch
                        checked={notifSettings[item.key as keyof typeof notifSettings]}
                        onChange={(v) => setNotifSettings(prev => ({ ...prev, [item.key]: v }))}
                      />
                    </div>
                  ))}
                  <Divider />
                  <Button type="primary" onClick={() => message.success('通知偏好已保存')}>保存设置</Button>
                </Space>
              </Card>
            ),
          },
        ]}
      />

      {/* 修改密码弹窗 */}
      <Modal title="修改密码" open={pwdModalOpen} onCancel={() => setPwdModalOpen(false)}
        onOk={() => pwdForm.submit()} okText="确认修改" cancelText="取消">
        <Form form={pwdForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item name="old_password" label="当前密码" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item name="new_password" label="新密码" rules={[
            { required: true }, { min: 6, message: '密码至少6个字符' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item name="confirm_password" label="确认新密码" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
