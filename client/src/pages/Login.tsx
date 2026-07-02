import React from 'react';
import { Form, Input, Button, Card, message, Modal } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../api';

export default function Login() {
  const [form] = Form.useForm();
  const [changePwForm] = Form.useForm();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const isTokenValid = useAuthStore((s) => s.isTokenValid);
  const [forceChangeOpen, setForceChangeOpen] = React.useState(false);
  const [pendingPassword, setPendingPassword] = React.useState<string>('');

  React.useEffect(() => {
    if (token && isTokenValid()) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, isTokenValid]);

  const handleSubmit = async (values: any) => {
    try {
      const { data } = await api.post('/auth/login', {
        username: values.username,
        password: values.password,
      });
      setAuth(
        data.token, data.username, data.permissions || {},
        data.role_name || '', data.role_key || 'staff', undefined,
        data.display_name
      );

      if (data.require_password_change) {
        setPendingPassword(values.password);
        setForceChangeOpen(true);
        return;
      }

      message.success('登录成功');
      const redirectPath = sessionStorage.getItem('redirect_after_login') || '/dashboard';
      sessionStorage.removeItem('redirect_after_login');
      navigate(redirectPath, { replace: true });
    } catch (e: any) {
      message.error(e.response?.data?.error || '登录失败');
    }
  };

  const handleForceChangePassword = async (values: any) => {
    try {
      await api.put('/auth/password', { oldPassword: pendingPassword, newPassword: values.newPassword });
      setForceChangeOpen(false);
      changePwForm.resetFields();
      message.success('密码修改成功，欢迎进入系统！');
      const redirectPath = sessionStorage.getItem('redirect_after_login') || '/dashboard';
      sessionStorage.removeItem('redirect_after_login');
      navigate(redirectPath, { replace: true });
    } catch (e: any) {
      message.error(e.response?.data?.error || '密码修改失败');
    }
  };

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow-x: hidden; }
        #root { min-height: 100vh; }
      `}</style>
      <div style={{
        minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
        position: 'relative', overflow: 'hidden', width: '100%',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: "url('/login-bg.png')", backgroundSize: 'cover',
          backgroundPosition: 'center', backgroundRepeat: 'no-repeat', zIndex: 0,
        }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(135deg, rgba(15,30,60,0.45) 0%, rgba(10,20,50,0.35) 50%, rgba(20,40,80,0.4) 100%)',
          zIndex: 1,
        }} />

        <Card style={{
          width: 420, borderRadius: 16, background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(37,99,235,0.18)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(37,99,235,0.08), 0 0 40px rgba(37,99,235,0.06)',
          zIndex: 2, position: 'relative',
        }} bordered={false}>
          <div style={{ textAlign: 'center', marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src="/logo-icon.png" alt="" style={{ width: 64, height: 64, objectFit: 'contain', display: 'block' }} />
            <img src="/logo-title.png" alt="博众智汇" style={{ width: 240, height: 'auto', marginTop: 8, display: 'block' }} />
            <p style={{ color: '#999', fontSize: 12, margin: '6px 0 0', letterSpacing: 2 }}>全域跨境经营管理系统</p>
          </div>

          <Form form={form} onFinish={handleSubmit} layout="vertical" size="large">
            <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
              <Input prefix={<UserOutlined style={{ color: '#2563eb' }} />} placeholder="请输入账号" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined style={{ color: '#2563eb' }} />} placeholder="请输入密码" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 4 }}>
              <Button type="primary" htmlType="submit" block size="large"
                style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', borderRadius: 8, fontWeight: 600, height: 46, letterSpacing: 2 }}>
                登 录
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>

      <Modal title="首次登录 - 请修改密码" open={forceChangeOpen} closable={false} maskClosable={false} footer={null} width={420}>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>为了您的账户安全，请设置一个新的密码后再使用系统。</p>
        <Form form={changePwForm} onFinish={handleForceChangePassword} layout="vertical" size="middle">
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入至少6位的新密码" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']}
            rules={[{ required: true, message: '请确认新密码' }, ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            })]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" style={{ borderRadius: 8 }}>
            确认修改并进入系统
          </Button>
        </Form>
      </Modal>
    </>
  );
}
