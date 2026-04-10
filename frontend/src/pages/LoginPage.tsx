import React from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const [form] = Form.useForm<LoginFormValues>();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);

  const onFinish = async (values: LoginFormValues) => {
    try {
      await login({ email: values.email, password: values.password });
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      message.error(error?.response?.data?.message || '登录失败，请检查邮箱和密码');
    }
  };

  return (
    <div className="auth-container">
      <Card className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.15)',
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 24 }}>💰</span>
          </div>
          <Typography.Title level={4} style={{ marginBottom: 4, fontWeight: 700 }}>
            个人记账系统
          </Typography.Title>
          <p style={{ color: '#64748b', fontSize: 14 }}>登录您的账户</p>
        </div>
        <Form form={form} name="login" onFinish={onFinish} autoComplete="off" size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input prefix={<MailOutlined style={{ color: '#94a3b8' }} />} placeholder="邮箱" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="密码" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              style={{ height: 42, fontWeight: 600 }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
        <div className="auth-footer">
          还没有账户？ <Link to="/register" style={{ fontWeight: 600 }}>立即注册</Link>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
