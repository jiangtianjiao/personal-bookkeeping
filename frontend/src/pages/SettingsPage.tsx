import React, { useState } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Avatar,
  Form,
  Input,
  Button,
  Select,
  Switch,
  Space,
  Divider,
  Modal,
  message,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  GlobalOutlined,
  BulbOutlined,
  DownloadOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  GithubOutlined,
  SaveOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { apiService } from '../services/api';

const { Option } = Select;

const currencyOptions = [
  { value: 'CNY', label: 'CNY - 人民币' },
  { value: 'USD', label: 'USD - 美元' },
  { value: 'EUR', label: 'EUR - 欧元' },
  { value: 'JPY', label: 'JPY - 日元' },
  { value: 'GBP', label: 'GBP - 英镑' },
  { value: 'HKD', label: 'HKD - 港币' },
];

const SettingsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { isDark, toggleTheme } = useThemeStore();

  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState('CNY');

  const handleProfileUpdate = async (values: { username: string }) => {
    setProfileLoading(true);
    try {
      await apiService.put('/auth/profile', { username: values.username });
      message.success('用户名更新成功');
    } catch {
      message.error('更新失败，请稍后重试');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (values: { currentPassword: string; newPassword: string }) => {
    setPasswordLoading(true);
    try {
      await apiService.put('/auth/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('密码修改成功');
      passwordForm.resetFields();
    } catch {
      message.error('密码修改失败，请检查当前密码是否正确');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const response = await apiService.get('/export?format=csv', {
        responseType: 'blob',
      });
      const blob = new Blob([response as any], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookkeeping-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('数据导出成功');
    } catch {
      message.error('导出失败，请稍后重试');
    } finally {
      setExportLoading(false);
    }
  };

  const handleClearData = () => {
    Modal.confirm({
      title: '确认清除所有数据？',
      icon: <ExclamationCircleOutlined />,
      content: '此操作不可恢复，所有交易、账户、分类等数据将被永久删除。',
      okText: '确认清除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        message.info('功能开发中，敬请期待');
      },
    });
  };

  return (
    <div>
      <h1 className="page-title">系统设置</h1>

      {/* 账户信息 */}
      <Card title={<span style={{ fontWeight: 600 }}>账户信息</span>} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <Avatar size={56} icon={<UserOutlined />} style={{ background: '#4f46e5', fontSize: 24 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{user?.username || '-'}</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>{user?.email || '-'}</div>
          </div>
        </div>
        <Descriptions column={1} size="small" labelStyle={{ color: '#64748b', fontWeight: 500 }}>
          <Descriptions.Item label="邮箱">
            {user?.email || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="注册时间">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="账户状态">
            <Tag color="#10b981" style={{ fontSize: 12 }}>正常</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 个人资料编辑 */}
      <Card
        title={
          <span style={{ fontWeight: 600 }}>
            <UserOutlined style={{ marginRight: 8 }} />
            个人资料
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleProfileUpdate}
          initialValues={{ username: user?.username || '' }}
          style={{ maxWidth: 400 }}
        >
          <Form.Item label="邮箱">
            <Input value={user?.email || ''} disabled prefix={<span style={{ color: '#94a3b8' }}>@</span>} />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入新用户名" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={profileLoading} icon={<SaveOutlined />}>
              保存修改
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 修改密码 */}
      <Card
        title={
          <span style={{ fontWeight: 600 }}>
            <LockOutlined style={{ marginRight: 8 }} />
            修改密码
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={passwordLoading} icon={<LockOutlined />}>
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 偏好设置 */}
      <Card
        title={
          <span style={{ fontWeight: 600 }}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            偏好设置
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        <div style={{ maxWidth: 400 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 500 }}>默认币种</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>新建账户和交易时的默认货币</div>
            </div>
            <Select
              value={defaultCurrency}
              onChange={setDefaultCurrency}
              style={{ width: 180 }}
            >
              {currencyOptions.map((c) => (
                <Option key={c.value} value={c.value}>{c.label}</Option>
              ))}
            </Select>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500 }}>
                <BulbOutlined style={{ marginRight: 8 }} />
                深色模式
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>切换明暗主题</div>
            </div>
            <Switch checked={isDark} onChange={toggleTheme} />
          </div>
        </div>
      </Card>

      {/* 数据管理 */}
      <Card
        title={
          <span style={{ fontWeight: 600 }}>
            <DownloadOutlined style={{ marginRight: 8 }} />
            数据管理
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500 }}>导出数据</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>导出所有数据为 CSV 格式</div>
            </div>
            <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exportLoading}>
              导出
            </Button>
          </div>
          <Divider style={{ margin: 0 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, color: '#ef4444' }}>清除所有数据</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>永久删除所有数据，此操作不可恢复</div>
            </div>
            <Button danger icon={<DeleteOutlined />} onClick={handleClearData}>
              清除
            </Button>
          </div>
        </Space>
      </Card>

      {/* 关于 */}
      <Card
        title={
          <span style={{ fontWeight: 600 }}>
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            关于系统
          </span>
        }
        size="small"
      >
        <div style={{ color: '#64748b', fontSize: 13, lineHeight: 2 }}>
          <p style={{ margin: '0 0 4px' }}>
            <strong>个人复式记账系统</strong> - 基于复式记账原理的个人财务管理工具
          </p>
          <p style={{ margin: '0 0 4px' }}>版本: v1.0.0</p>
          <p style={{ margin: '0 0 4px' }}>技术栈: React 18 + TypeScript + Ant Design 5 + Node.js + PostgreSQL</p>
          <p style={{ margin: 0 }}>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#4f46e5' }}
            >
              <GithubOutlined style={{ marginRight: 4 }} />
              GitHub
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
