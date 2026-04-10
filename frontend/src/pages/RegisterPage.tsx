import React from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface RegisterFormValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const RegisterPage: React.FC = () => {
  const [form] = Form.useForm<RegisterFormValues>();
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);

  const onFinish = async (values: RegisterFormValues) => {
    try {
      await register({ username: values.username, email: values.email, password: values.password });
      message.success('注册成功，请登录');
      navigate('/login');
    } catch (error: any) {
      message.error(error?.response?.data?.message || '注册失败，请稍后重试');
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
          <p style={{ color: '#64748b', fontSize: 14 }}>创建新账户</p>
        </div>
        <Form form={form} name="register" onFinish={onFinish} autoComplete="off" size="large">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 2, message: '用户名至少2个字符' },
              { max: 20, message: '用户名不能超过20个字符' },
            ]}
          >
            <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="用户名" />
          </Form.Item>

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
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="密码" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="确认密码" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              style={{ height: 42, fontWeight: 600 }}
            >
              注册
            </Button>
          </Form.Item>
        </Form>
        <div className="auth-footer">
          已有账户？ <Link to="/login" style={{ fontWeight: 600 }}>立即登录</Link>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
