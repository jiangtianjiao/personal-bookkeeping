import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Spin, Tag, Grid, message, Progress, Empty } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  WalletOutlined,
  AccountBookOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  FundOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiService } from '../services/api';
import type { DashboardOverview, Transaction, Budget, BudgetStatus, PiggyBank } from '../types';
import { formatAmount } from '../utils/format';
import { getTransactionType } from '../utils/transaction';

const { useBreakpoint } = Grid;

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardOverview | null>(null);
  const [budgetStatuses, setBudgetStatuses] = useState<BudgetStatus[]>([]);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [piggyBanks, setPiggyBanks] = useState<PiggyBank[]>([]);
  const [piggyLoading, setPiggyLoading] = useState(false);
  const screens = useBreakpoint();

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<DashboardOverview>('/reports/dashboard');
      setDashboardData(data);
    } catch {
      message.error('获取仪表板数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgets = async () => {
    setBudgetLoading(true);
    try {
      const budgets = await apiService.get<Budget[]>('/budgets');
      if (budgets.length === 0) {
        setBudgetStatuses([]);
        return;
      }
      const now = new Date();
      const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const statuses = await Promise.all(
        budgets.map((b) =>
          apiService
            .get<BudgetStatus>(`/budgets/${b.id}/status?startDate=${startDate}&endDate=${endDate}`)
            .catch(() => null)
        )
      );
      setBudgetStatuses(statuses.filter((s): s is BudgetStatus => s !== null));
    } catch {
      // budgets API may not be available
    } finally {
      setBudgetLoading(false);
    }
  };

  const fetchPiggyBanks = async () => {
    setPiggyLoading(true);
    try {
      const data = await apiService.get<PiggyBank[]>('/piggy-banks');
      setPiggyBanks(data);
    } catch {
      // piggy-banks API may not be available
    } finally {
      setPiggyLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchBudgets();
    fetchPiggyBanks();
  }, []);

  const recentTransactions: Transaction[] = dashboardData?.recentTransactions || [];

  const statCards = [
    {
      title: '总资产',
      value: dashboardData?.totalAssets || 0,
      icon: <DollarOutlined />,
      color: '#4f46e5',
      bg: '#eef2ff',
    },
    {
      title: '总负债',
      value: dashboardData?.totalLiabilities || 0,
      icon: <AccountBookOutlined />,
      color: '#ef4444',
      bg: '#fef2f2',
    },
    {
      title: '净资产',
      value: dashboardData?.netWorth || 0,
      icon: <WalletOutlined />,
      color: '#10b981',
      bg: '#ecfdf5',
    },
    {
      title: '本月收入',
      value: dashboardData?.monthlyIncome || 0,
      icon: <RiseOutlined />,
      color: '#06b6d4',
      bg: '#ecfeff',
    },
    {
      title: '本月支出',
      value: dashboardData?.monthlyExpenses || 0,
      icon: <FallOutlined />,
      color: '#f59e0b',
      bg: '#fffbeb',
    },
    {
      title: '本月结余',
      value: (dashboardData?.monthlyIncome || 0) - (dashboardData?.monthlyExpenses || 0),
      icon: (dashboardData?.monthlyIncome || 0) >= (dashboardData?.monthlyExpenses || 0) ? <ArrowUpOutlined /> : <ArrowDownOutlined />,
      color: (dashboardData?.monthlyIncome || 0) >= (dashboardData?.monthlyExpenses || 0) ? '#10b981' : '#ef4444',
      bg: (dashboardData?.monthlyIncome || 0) >= (dashboardData?.monthlyExpenses || 0) ? '#ecfdf5' : '#fef2f2',
    },
  ];

  const columns: ColumnsType<Transaction> = [
    {
      title: '日期',
      dataIndex: 'transactionDate',
      key: 'transactionDate',
      width: screens.md ? 100 : 70,
      render: (date: string) => {
        const d = new Date(date);
        return screens.md ? `${d.getMonth() + 1}/${d.getDate()}` : `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    ...(screens.md
      ? [
          {
            title: '分类' as const,
            dataIndex: 'category' as const,
            key: 'category' as const,
            width: 80,
            render: (category: any) => category?.name || '-',
          },
        ]
      : []),
    {
      title: '类型',
      key: 'transactionType',
      width: 56,
      render: (_: any, record: Transaction) => {
        const { label, color } = getTransactionType(record);
        return <Tag color={color} style={{ margin: 0, fontSize: 11 }}>{label}</Tag>;
      },
    },
    {
      title: '金额',
      key: 'amount',
      width: screens.md ? 120 : 90,
      align: 'right' as const,
      render: (_: any, record: Transaction) => {
        const txType = getTransactionType(record);
        return (
          <span style={{ color: txType.color, fontWeight: 600, fontSize: 13 }}>
            {txType.sign}{formatAmount(txType.amount)}
          </span>
        );
      },
    },
  ];

  const getBudgetProgressColor = (percentage: number): string => {
    if (percentage > 90) return '#ef4444';
    if (percentage >= 75) return '#f59e0b';
    return '#10b981';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">财务概览</h1>

      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {statCards.map((card) => (
          <Col xs={12} sm={12} md={8} lg={8} xl={4} key={card.title}>
            <Card
              className="stat-card"
              styles={{
                body: {
                  padding: screens.md ? '16px 20px' : '12px 14px',
                },
              }}
            >
              <Statistic
                title={card.title}
                value={card.value}
                precision={2}
                prefix={
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: card.bg,
                    color: card.color,
                    marginRight: 8,
                    fontSize: 14,
                  }}>
                    {card.icon}
                  </span>
                }
                suffix="元"
                valueStyle={{ color: card.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title={<span style={{ fontWeight: 600 }}>最近交易</span>}
        styles={{ body: { padding: screens.md ? undefined : 8 } }}
        style={{ marginBottom: 20 }}
      >
        <Table
          columns={columns}
          dataSource={recentTransactions}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无交易记录' }}
          scroll={screens.md ? undefined : { x: 300 }}
        />
      </Card>

      {/* 预算概览 */}
      <Card
        title={
          <span style={{ fontWeight: 600 }}>
            <FundOutlined style={{ marginRight: 8, color: '#4f46e5' }} />
            预算概览
          </span>
        }
        loading={budgetLoading}
        style={{ marginBottom: 20 }}
        styles={{ body: { padding: screens.md ? '16px 24px' : '12px 16px' } }}
      >
        {budgetStatuses.length > 0 ? (
          <Row gutter={[16, 16]}>
            {budgetStatuses.map((status) => {
              const pct = Math.min(status.percentage, 100);
              const limitAmount = status.limit?.amount || 0;
              return (
                <Col xs={24} sm={12} md={8} key={status.budget.id}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0',
                    background: '#fafafa',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{status.budget.name}</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {formatAmount(status.spent)} / {formatAmount(limitAmount)}
                      </span>
                    </div>
                    <Progress
                      percent={Math.round(pct)}
                      strokeColor={getBudgetProgressColor(pct)}
                      size="small"
                      format={(p) => `${p}%`}
                    />
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      剩余: {formatAmount(Math.max(status.remaining, 0))}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        ) : (
          <Empty description="暂无预算" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      {/* 存钱罐进度 */}
      <Card
        title={
          <span style={{ fontWeight: 600 }}>
            <SaveOutlined style={{ marginRight: 8, color: '#f59e0b' }} />
            存钱罐
          </span>
        }
        loading={piggyLoading}
        styles={{ body: { padding: screens.md ? '16px 24px' : '12px 16px' } }}
      >
        {piggyBanks.length > 0 ? (
          <Row gutter={[16, 16]}>
            {piggyBanks.map((pb) => {
              const pct = pb.targetAmount > 0 ? Math.min((pb.currentAmount / pb.targetAmount) * 100, 100) : 0;
              return (
                <Col xs={24} sm={12} md={8} key={pb.id}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0',
                    background: '#fafafa',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{pb.name}</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {formatAmount(pb.currentAmount)} / {formatAmount(pb.targetAmount)}
                      </span>
                    </div>
                    <Progress
                      percent={Math.round(pct)}
                      strokeColor={pct >= 100 ? '#10b981' : '#4f46e5'}
                      size="small"
                      format={(p) => `${p}%`}
                    />
                    {pb.targetDate && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        目标日期: {new Date(pb.targetDate).toLocaleDateString('zh-CN')}
                      </div>
                    )}
                  </div>
                </Col>
              );
            })}
          </Row>
        ) : (
          <Empty description="暂无存钱罐" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </div>
  );
};

export default DashboardPage;
