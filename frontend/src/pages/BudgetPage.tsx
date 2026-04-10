import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Progress,
  Space,
  Table,
  Popconfirm,
  Spin,
  Empty,
  Grid,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { apiService } from '../services/api';
import type { Budget, BudgetStatus } from '../types';
import { formatAmount } from '../utils/format';

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

const getProgressColor = (percentage: number): string => {
  if (percentage > 90) return '#ef4444';
  if (percentage > 75) return '#f59e0b';
  return '#10b981';
};

const BudgetPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetStatuses, setBudgetStatuses] = useState<Record<string, BudgetStatus>>({});
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [createForm] = Form.useForm();
  const [limitForm] = Form.useForm();

  const currentMonthStart = dayjs().startOf('month').format('YYYY-MM-DD');
  const currentMonthEnd = dayjs().endOf('month').format('YYYY-MM-DD');

  const fetchBudgetStatus = useCallback(async (budgetList: Budget[]) => {
    const statusMap: Record<string, BudgetStatus> = {};
    await Promise.all(
      budgetList.map(async (budget) => {
        try {
          const status = await apiService.get<BudgetStatus>(
            `/budgets/${budget.id}/status?startDate=${currentMonthStart}&endDate=${currentMonthEnd}`
          );
          statusMap[budget.id] = status;
        } catch {
          // 忽略单个预算状态获取失败
        }
      })
    );
    setBudgetStatuses(statusMap);
  }, [currentMonthStart, currentMonthEnd]);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.get<Budget[]>('/budgets');
      setBudgets(data);
      await fetchBudgetStatus(data);
    } catch {
      message.error('获取预算列表失败');
    } finally {
      setLoading(false);
    }
  }, [fetchBudgetStatus]);

  useEffect(() => {
    fetchBudgets();
  }, []);

  const handleCreateBudget = async (values: { name: string }) => {
    try {
      await apiService.post('/budgets', { name: values.name });
      message.success('预算创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchBudgets();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '创建预算失败');
    }
  };

  const handleAddLimit = async (values: { amount: number; dateRange: [dayjs.Dayjs, dayjs.Dayjs] }) => {
    if (!selectedBudgetId) return;
    try {
      await apiService.post(`/budgets/${selectedBudgetId}/limits`, {
        amount: values.amount,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
      });
      message.success('限额添加成功');
      setLimitModalVisible(false);
      limitForm.resetFields();
      setSelectedBudgetId(null);
      fetchBudgets();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '添加限额失败');
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await apiService.delete(`/budgets/${id}`);
      message.success('预算已删除');
      fetchBudgets();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除预算失败');
    }
  };

  const openLimitModal = (budgetId: string) => {
    setSelectedBudgetId(budgetId);
    limitForm.resetFields();
    limitForm.setFieldsValue({
      dateRange: [dayjs().startOf('month'), dayjs().endOf('month')],
    });
    setLimitModalVisible(true);
  };

  // 汇总数据
  const totalBudget = Object.values(budgetStatuses).reduce(
    (sum, s) => sum + (s.limit?.amount || 0),
    0
  );
  const totalSpent = Object.values(budgetStatuses).reduce(
    (sum, s) => sum + s.spent,
    0
  );
  const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const columns: ColumnsType<Budget> = [
    {
      title: '预算名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '本月限额',
      key: 'limit',
      width: isMobile ? 90 : 120,
      align: 'right',
      render: (_: any, record: Budget) => {
        const status = budgetStatuses[record.id];
        return status?.limit ? formatAmount(status.limit.amount) : '-';
      },
    },
    ...(!isMobile
      ? [
          {
            title: '已花费' as const,
            key: 'spent' as const,
            width: 120,
            align: 'right' as const,
            render: (_: any, record: Budget) => {
              const status = budgetStatuses[record.id];
              return status ? formatAmount(status.spent) : '-';
            },
          },
          {
            title: '剩余' as const,
            key: 'remaining' as const,
            width: 120,
            align: 'right' as const,
            render: (_: any, record: Budget) => {
              const status = budgetStatuses[record.id];
              if (!status) return '-';
              const color = status.remaining < 0 ? '#ef4444' : '#10b981';
              return <span style={{ color, fontWeight: 600 }}>{formatAmount(status.remaining)}</span>;
            },
          },
        ]
      : []),
    {
      title: '进度',
      key: 'progress',
      width: isMobile ? 100 : 160,
      render: (_: any, record: Budget) => {
        const status = budgetStatuses[record.id];
        if (!status || !status.limit) return '-';
        const pct = Math.min(status.percentage, 100);
        return (
          <Progress
            percent={pct}
            size="small"
            strokeColor={getProgressColor(status.percentage)}
            format={() => `${Math.round(status.percentage)}%`}
          />
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: isMobile ? 80 : 120,
      render: (_: any, record: Budget) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<DollarOutlined />}
            onClick={() => openLimitModal(record.id)}
            style={{ padding: 0 }}
          >
            {isMobile ? '' : '限额'}
          </Button>
          <Popconfirm
            title="确认删除该预算？"
            onConfirm={() => handleDeleteBudget(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{ padding: 0 }}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading && budgets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>预算管理</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            createForm.resetFields();
            setCreateModalVisible(true);
          }}
          size={isMobile ? 'small' : 'middle'}
        >
          新建预算
        </Button>
      </div>

      {/* 月度总预算概览 */}
      {totalBudget > 0 && (
        <Card
          styles={{ body: { padding: isMobile ? '16px' : '20px 24px' } }}
          style={{ marginBottom: 16 }}
        >
          <Row align="middle" gutter={16}>
            <Col flex="auto">
              <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 15 }}>
                本月总预算
              </div>
              <div style={{ color: '#64748b', fontSize: 13 }}>
                已花费 {formatAmount(totalSpent)} / 总预算 {formatAmount(totalBudget)}
              </div>
            </Col>
            <Col flex={isMobile ? '120px' : '200px'}>
              <Progress
                percent={Math.min(overallPercentage, 100)}
                strokeColor={getProgressColor(overallPercentage)}
                format={() => `${overallPercentage}%`}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 预算列表 */}
      <Card
        title={<span style={{ fontWeight: 600 }}>预算列表</span>}
        styles={{ body: { padding: isMobile ? 0 : undefined } }}
      >
        {budgets.length > 0 ? (
          <Table
            columns={columns}
            dataSource={budgets}
            rowKey="id"
            pagination={false}
            size="small"
            loading={loading}
            scroll={isMobile ? { x: 400 } : undefined}
          />
        ) : (
          <Empty
            description="暂无预算，点击右上角创建"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '40px 0' }}
          />
        )}
      </Card>

      {/* 创建预算 Modal */}
      <Modal
        title="新建预算"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={isMobile ? '90%' : 420}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateBudget}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="预算名称"
            rules={[{ required: true, message: '请输入预算名称' }]}
          >
            <Input placeholder="例如：餐饮、交通、娱乐" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">创建</Button>
              <Button onClick={() => {
                setCreateModalVisible(false);
                createForm.resetFields();
              }}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加限额 Modal */}
      <Modal
        title="添加预算限额"
        open={limitModalVisible}
        onCancel={() => {
          setLimitModalVisible(false);
          limitForm.resetFields();
          setSelectedBudgetId(null);
        }}
        footer={null}
        width={isMobile ? '90%' : 480}
      >
        <Form
          form={limitForm}
          layout="vertical"
          onFinish={handleAddLimit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="amount"
            label="限额金额（元）"
            rules={[{ required: true, message: '请输入限额金额' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="输入预算限额"
              prefix="¥"
            />
          </Form.Item>
          <Form.Item
            name="dateRange"
            label="生效日期范围"
            rules={[{ required: true, message: '请选择日期范围' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">添加</Button>
              <Button onClick={() => {
                setLimitModalVisible(false);
                limitForm.resetFields();
                setSelectedBudgetId(null);
              }}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BudgetPage;
