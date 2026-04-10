import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Switch,
  Table,
  Tag,
  Space,
  Popconfirm,
  Spin,
  Empty,
  Grid,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { apiService } from '../services/api';
import type { RecurringTransaction, RecurringCreateRequest, Category, Account } from '../types';
import { formatAmount } from '../utils/format';

const { Option } = Select;
const { useBreakpoint } = Grid;

const freqLabels: Record<string, string> = {
  daily: '天',
  weekly: '周',
  monthly: '月',
  yearly: '年',
};

const typeLabels: Record<string, { label: string; color: string }> = {
  income: { label: '收入', color: '#10b981' },
  expense: { label: '支出', color: '#ef4444' },
  transfer: { label: '转账', color: '#6366f1' },
};

interface TemplateData {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  accountId: string;
  categoryId?: string;
  description?: string;
}

const getFreqDescription = (freq: string, interval: number): string => {
  if (interval === 1) return `每${freqLabels[freq]}`;
  return `每${interval}${freqLabels[freq]}`;
};

const freqToUnit: Record<string, dayjs.ManipulateType> = {
  daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year',
};

const getNextTriggerDate = (record: RecurringTransaction): string | null => {
  if (!record.isActive) return null;
  const unit = freqToUnit[record.repeatFreq] || 'month';
  const start = dayjs(record.startDate);
  const last = record.lastTriggered ? dayjs(record.lastTriggered) : null;
  const base = last || start.subtract(record.repeatInterval, unit);

  let next = base.add(record.repeatInterval, unit);
  if (next.isBefore(start)) next = start;
  if (record.endDate && next.isAfter(dayjs(record.endDate))) return null;
  return next.format('YYYY-MM-DD');
};

const RecurringPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecurringTransaction | null>(null);
  const [processing, setProcessing] = useState(false);
  const [form] = Form.useForm();

  const fetchRecurring = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.get<RecurringTransaction[]>('/recurring');
      setRecurring(data);
    } catch {
      message.error('获取周期交易列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuxData = useCallback(async () => {
    try {
      const [cats, accs] = await Promise.all([
        apiService.get<Category[]>('/categories'),
        apiService.get<Account[]>('/accounts'),
      ]);
      setCategories(cats);
      setAccounts(accs);
    } catch {
      // 辅助数据加载失败不阻塞
    }
  }, []);

  useEffect(() => {
    fetchRecurring();
    fetchAuxData();
  }, []);

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      repeatFreq: 'monthly',
      repeatInterval: 1,
      templateType: 'expense',
      startDate: dayjs(),
    });
    setModalVisible(true);
  };

  const openEditModal = (record: RecurringTransaction) => {
    setEditingRecord(record);
    let template: TemplateData | null = null;
    try {
      template = JSON.parse(record.templateData);
    } catch {
      // ignore
    }
    form.setFieldsValue({
      title: record.title,
      repeatFreq: record.repeatFreq,
      repeatInterval: record.repeatInterval,
      startDate: dayjs(record.startDate),
      endDate: record.endDate ? dayjs(record.endDate) : undefined,
      templateType: template?.type || 'expense',
      templateAmount: template?.amount,
      templateAccountId: template?.accountId,
      templateCategoryId: template?.categoryId,
      templateDescription: template?.description,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    const templateData: TemplateData = {
      type: values.templateType,
      amount: values.templateAmount,
      accountId: values.templateAccountId,
      categoryId: values.templateCategoryId || undefined,
      description: values.templateDescription || undefined,
    };

    const payload: RecurringCreateRequest & { isActive?: boolean } = {
      title: values.title,
      repeatFreq: values.repeatFreq,
      repeatInterval: values.repeatInterval,
      startDate: values.startDate.format('YYYY-MM-DD'),
      endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : undefined,
      templateData: JSON.stringify(templateData),
    };

    try {
      if (editingRecord) {
        await apiService.put(`/recurring/${editingRecord.id}`, payload);
        message.success('周期交易更新成功');
      } else {
        await apiService.post('/recurring', payload);
        message.success('周期交易创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingRecord(null);
      fetchRecurring();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '操作失败');
    }
  };

  const handleToggleActive = async (record: RecurringTransaction, checked: boolean) => {
    try {
      await apiService.put(`/recurring/${record.id}`, {
        title: record.title,
        repeatFreq: record.repeatFreq,
        repeatInterval: record.repeatInterval,
        startDate: record.startDate,
        endDate: record.endDate || undefined,
        templateData: record.templateData,
        isActive: checked,
      });
      message.success(checked ? '已启用' : '已停用');
      fetchRecurring();
    } catch {
      message.error('状态更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiService.delete(`/recurring/${id}`);
      message.success('周期交易已删除');
      fetchRecurring();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除失败');
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      await apiService.post('/recurring/process');
      message.success('周期交易处理完成');
      fetchRecurring();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '处理失败');
    } finally {
      setProcessing(false);
    }
  };

  const columns: ColumnsType<RecurringTransaction> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: RecurringTransaction) => {
        let template: TemplateData | null = null;
        try { template = JSON.parse(record.templateData); } catch { /* ignore */ }
        const typeInfo = template ? typeLabels[template.type] : null;
        return (
          <Space size={6} direction={isMobile ? 'vertical' : 'horizontal'}>
            <span style={{ fontWeight: 500 }}>{title}</span>
            {typeInfo && (
              <Tag color={typeInfo.color} style={{ margin: 0, fontSize: 11 }}>
                {typeInfo.label}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '频率',
      key: 'freq',
      width: isMobile ? 70 : 100,
      render: (_: any, record: RecurringTransaction) =>
        getFreqDescription(record.repeatFreq, record.repeatInterval),
    },
    ...(!isMobile
      ? [
          {
            title: '金额' as const,
            key: 'amount' as const,
            width: 120,
            align: 'right' as const,
            render: (_: any, record: RecurringTransaction) => {
              let template: TemplateData | null = null;
              try { template = JSON.parse(record.templateData); } catch { /* ignore */ }
              if (!template) return '-';
              const color = typeLabels[template.type]?.color || '#333';
              return <span style={{ color, fontWeight: 600 }}>{formatAmount(template.amount)}</span>;
            },
          },
          {
            title: '下次执行' as const,
            key: 'nextTrigger' as const,
            width: 120,
            render: (_: any, record: RecurringTransaction) => {
              const next = getNextTriggerDate(record);
              return next || <span style={{ color: '#94a3b8' }}>-</span>;
            },
          },
        ]
      : []),
    {
      title: '状态',
      key: 'isActive',
      width: 70,
      render: (_: any, record: RecurringTransaction) => (
        <Switch
          size="small"
          checked={record.isActive}
          onChange={(checked) => handleToggleActive(record, checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: isMobile ? 70 : 100,
      render: (_: any, record: RecurringTransaction) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
            style={{ padding: 0 }}
          />
          <Popconfirm
            title="确认删除该周期交易？"
            onConfirm={() => handleDelete(record.id)}
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

  const templateType = Form.useWatch('templateType', form);

  if (loading && recurring.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>周期交易</h1>
        <Space>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleProcess}
            loading={processing}
            size={isMobile ? 'small' : 'middle'}
          >
            {isMobile ? '执行' : '手动执行'}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            size={isMobile ? 'small' : 'middle'}
          >
            {isMobile ? '新建' : '新建周期交易'}
          </Button>
        </Space>
      </div>

      <Card
        title={<span style={{ fontWeight: 600 }}>周期交易列表</span>}
        styles={{ body: { padding: isMobile ? 0 : undefined } }}
      >
        {recurring.length > 0 ? (
          <Table
            columns={columns}
            dataSource={recurring}
            rowKey="id"
            pagination={false}
            size="small"
            loading={loading}
            scroll={isMobile ? { x: 400 } : undefined}
          />
        ) : (
          <Empty
            description="暂无周期交易，点击右上角创建"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '40px 0' }}
          />
        )}
      </Card>

      {/* 创建/编辑 Modal */}
      <Modal
        title={editingRecord ? '编辑周期交易' : '新建周期交易'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingRecord(null);
        }}
        footer={null}
        width={isMobile ? '95%' : 560}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="例如：房租、工资、会员订阅" />
          </Form.Item>

          <Space size={12} style={{ display: 'flex' }}>
            <Form.Item
              name="repeatFreq"
              label="频率"
              rules={[{ required: true, message: '请选择频率' }]}
              style={{ flex: 1 }}
            >
              <Select>
                <Option value="daily">每日</Option>
                <Option value="weekly">每周</Option>
                <Option value="monthly">每月</Option>
                <Option value="yearly">每年</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="repeatInterval"
              label="间隔"
              rules={[{ required: true, message: '请输入间隔' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space size={12} style={{ display: 'flex' }}>
            <Form.Item
              name="startDate"
              label="开始日期"
              rules={[{ required: true, message: '请选择开始日期' }]}
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="endDate"
              label="结束日期（可选）"
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Card
            size="small"
            title={<span style={{ fontSize: 13, fontWeight: 600 }}>交易模板</span>}
            style={{ marginBottom: 16 }}
          >
            <Form.Item
              name="templateType"
              label="交易类型"
              rules={[{ required: true, message: '请选择交易类型' }]}
            >
              <Select>
                <Option value="income">收入</Option>
                <Option value="expense">支出</Option>
                <Option value="transfer">转账</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="templateAmount"
              label="金额"
              rules={[{ required: true, message: '请输入金额' }]}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" placeholder="输入金额" />
            </Form.Item>

            <Form.Item
              name="templateAccountId"
              label="账户"
              rules={[{ required: true, message: '请选择账户' }]}
            >
              <Select placeholder="选择账户">
                {accounts.map((acc) => (
                  <Option key={acc.id} value={acc.id}>{acc.name}</Option>
                ))}
              </Select>
            </Form.Item>

            {templateType !== 'transfer' && (
              <Form.Item name="templateCategoryId" label="分类">
                <Select placeholder="选择分类（可选）" allowClear>
                  {categories
                    .filter((c) => c.type === templateType)
                    .map((cat) => (
                      <Option key={cat.id} value={cat.id}>
                        {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                      </Option>
                    ))}
                </Select>
              </Form.Item>
            )}

            <Form.Item name="templateDescription" label="描述">
              <Input placeholder="可选描述" />
            </Form.Item>
          </Card>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingRecord ? '保存' : '创建'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
                setEditingRecord(null);
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RecurringPage;
