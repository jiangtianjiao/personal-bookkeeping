import React, { useState } from 'react';
import { Layout, Menu, theme, Dropdown, Space, Avatar, Drawer, Grid, Button, Switch } from 'antd';
import {
  DashboardOutlined,
  AccountBookOutlined,
  TransactionOutlined,
  FileTextOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  CloseOutlined,
  ImportOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  FundOutlined,
  SyncOutlined,
  SaveOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = useBreakpoint();
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isDark = useThemeStore((state) => state.isDark);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const isMobile = !screens.md;

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/' || path === '') return 'dashboard';
    if (path.startsWith('/transactions')) return 'transactions';
    if (path.startsWith('/accounts')) return 'accounts';
    if (path.startsWith('/reports')) return 'reports';
    if (path.startsWith('/import')) return 'import';
    if (path.startsWith('/tags')) return 'tags';
    if (path.startsWith('/rules')) return 'rules';
    if (path.startsWith('/budgets')) return 'budgets';
    if (path.startsWith('/recurring')) return 'recurring';
    if (path.startsWith('/piggy-banks')) return 'piggy-banks';
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const nav = (path: string) => {
    navigate(path);
    if (isMobile) setDrawerOpen(false);
  };

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表板', onClick: () => nav('/') },
    { key: 'transactions', icon: <TransactionOutlined />, label: '交易记录', onClick: () => nav('/transactions') },
    { key: 'accounts', icon: <AccountBookOutlined />, label: '账户管理', onClick: () => nav('/accounts') },
    { key: 'reports', icon: <FileTextOutlined />, label: '财务报表', onClick: () => nav('/reports') },
    { type: 'divider' as const },
    { key: 'import', icon: <ImportOutlined />, label: '数据导入', onClick: () => nav('/import') },
    { key: 'tags', icon: <TagsOutlined />, label: '标签管理', onClick: () => nav('/tags') },
    { key: 'rules', icon: <ThunderboltOutlined />, label: '规则引擎', onClick: () => nav('/rules') },
    { key: 'budgets', icon: <FundOutlined />, label: '预算管理', onClick: () => nav('/budgets') },
    { key: 'recurring', icon: <SyncOutlined />, label: '周期交易', onClick: () => nav('/recurring') },
    { key: 'piggy-banks', icon: <SaveOutlined />, label: '存钱罐', onClick: () => nav('/piggy-banks') },
    { type: 'divider' as const },
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置', onClick: () => nav('/settings') },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/settings'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const selectedKey = getSelectedKey();

  const menuContent = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selectedKey]}
      items={menuItems}
      style={{ borderRight: 0 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          width={260}
          styles={{
            body: { padding: 0 },
            header: { display: 'none' },
          }}
          style={{ background: '#001529' }}
        >
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>个人记账系统</span>
            <Button
              type="text"
              icon={<CloseOutlined style={{ color: 'rgba(255,255,255,0.65)' }} />}
              onClick={() => setDrawerOpen(false)}
              style={{ width: 32, height: 32 }}
            />
          </div>
          {menuContent}
        </Drawer>
      ) : (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={220}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'sticky',
            top: 0,
            left: 0,
          }}
        >
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '0 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span
              style={{
                color: '#fff',
                fontSize: collapsed ? 14 : 17,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {collapsed ? '记账' : '个人记账系统'}
            </span>
          </div>
          {menuContent}
        </Sider>
      )}

      <Layout>
        <Header
          style={{
            padding: 0,
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: isMobile ? 16 : 24,
            height: 56,
            lineHeight: '56px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            onClick={() => isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed)}
            style={{
              fontSize: 17,
              padding: '0 20px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'color 0.2s',
            }}
          >
            {isMobile ? <MenuUnfoldOutlined /> : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
          </div>
          <Space size={16}>
            <Switch
              checkedChildren={<BulbOutlined />}
              unCheckedChildren={<BulbOutlined />}
              checked={isDark}
              onChange={toggleTheme}
              size="small"
            />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size={28} icon={<UserOutlined />} style={{ background: '#4f46e5' }} />
                {!isMobile && <span style={{ fontSize: 14 }}>{user?.username || '游客'}</span>}
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content
          className="app-layout-content"
          style={{
            margin: isMobile ? 0 : '20px',
            padding: isMobile ? 12 : 20,
            minHeight: 280,
            background: isMobile ? 'var(--bg-body)' : colorBgContainer,
            borderRadius: isMobile ? 0 : borderRadiusLG,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
