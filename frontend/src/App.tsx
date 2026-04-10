import React, { Suspense } from 'react';
import { ConfigProvider, Spin, Result, Button, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TransactionPage from './pages/TransactionPage';
import AccountPage from './pages/AccountPage';
import ReportPage from './pages/ReportPage';
import SettingsPage from './pages/SettingsPage';
import './styles/global.css';

// Lazy-loaded pages
const ImportPage = React.lazy(() => import('./pages/ImportPage'));
const TagPage = React.lazy(() => import('./pages/TagPage'));
const RulePage = React.lazy(() => import('./pages/RulePage'));
const BudgetPage = React.lazy(() => import('./pages/BudgetPage'));
const RecurringPage = React.lazy(() => import('./pages/RecurringPage'));
const PiggyBankPage = React.lazy(() => import('./pages/PiggyBankPage'));

const LazyFallback = () => (
  <div style={{ textAlign: 'center', padding: '80px 0' }}>
    <Spin size="large" />
  </div>
);

class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="页面加载失败"
          subTitle="请检查网络连接后重试"
          extra={<Button type="primary" onClick={() => window.location.reload()}>重新加载</Button>}
        />
      );
    }
    return this.props.children;
  }
}

const LazyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ChunkErrorBoundary>
    <Suspense fallback={<LazyFallback />}>{children}</Suspense>
  </ChunkErrorBoundary>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

function App() {
  const isDark = useThemeStore((state) => state.isDark);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#4f46e5',
          borderRadius: 6,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
      }}
    >
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionPage />} />
          <Route path="accounts" element={<AccountPage />} />
          <Route path="reports" element={<ReportPage />} />
          <Route path="import" element={<LazyRoute><ImportPage /></LazyRoute>} />
          <Route path="tags" element={<LazyRoute><TagPage /></LazyRoute>} />
          <Route path="rules" element={<LazyRoute><RulePage /></LazyRoute>} />
          <Route path="budgets" element={<LazyRoute><BudgetPage /></LazyRoute>} />
          <Route path="recurring" element={<LazyRoute><RecurringPage /></LazyRoute>} />
          <Route path="piggy-banks" element={<LazyRoute><PiggyBankPage /></LazyRoute>} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
