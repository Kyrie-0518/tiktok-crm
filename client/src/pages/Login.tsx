import React from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../api';

export default function Login() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (values: any) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await api.post('/auth/login', {
        username: values.username,
        password: values.password,
      });
      const { token, username, display_name, permissions, role_name, role_key, email, identity } = res.data;
      setAuth(token, username, permissions || {}, role_name || '', role_key || 'staff', undefined, display_name || username);
      if (email) localStorage.setItem('erp_email', email);
      if (identity) localStorage.setItem('erp_identity', identity);
      message.success('登录成功');
      const redirect = new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
      navigate(redirect, { replace: true });
    } catch (e: any) {
      const msg = e.response?.data?.error || '登录失败，请检查网络连接';
      message.error(msg);
    } finally {
      setSubmitting(false);
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
              <Input
                prefix={<UserOutlined style={{ color: '#2563eb' }} />}
                placeholder="请输入账号"
                disabled={submitting}
                autoComplete="username"
              />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password
                prefix={<LockOutlined style={{ color: '#2563eb' }} />}
                placeholder="请输入密码"
                disabled={submitting}
                autoComplete="current-password"
                onPressEnter={() => form.submit()}
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 4 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={submitting}
                disabled={submitting}
                icon={submitting ? <LoadingOutlined /> : undefined}
                style={{
                  background: submitting ? undefined : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  borderRadius: 8, fontWeight: 600, height: 46, letterSpacing: 2,
                }}
              >
                {submitting ? '登录中...' : '登 录'}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
}
