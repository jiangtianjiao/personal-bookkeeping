import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Progress,
  Space,
  Tag,
  Grid,
  message,
  Popconfirm,
  Empty,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TrophyOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService } from '../services/api';
import { formatAmount } from '../utils/format';
import type { PiggyBank, Account } from '../types';

const { useBreakpoint } = Grid;
const { Option } = Select;

const getProgressColor = (percent: number): string => {
  if (percent >= 100) return '#52c41a';
  if (percent > 80) return '#10b981';
  if (percent >= 50) return '#06b6d4';
  return '#4f46e5';
};

const PiggyBankPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [piggyBanks, setPiggyBanks] = useState<PiggyBank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBank, setEditingBank] = useState<PiggyBank | null>(null);
  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [amountAction, setAmountAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedBank, setSelectedBank] = useState<PiggyBank | null>(null);
  const [form] = Form.useForm();
  const [amountForm] = Form.useForm();

  const fetchPiggyBanks = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<PiggyBank[]>('/piggy-banks');
      setPiggyBanks(data);
    } catch {
      message.error('获取存钱罐列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const data = await apiService.get<Account[]>('/accounts');
      setAccounts(data);
    } catch {
      // 静默处理，账户列表非关键
    }
  };

  useEffect(() => {
    fetchPiggyBanks();
    fetchAccounts();
  }, []);

  const handleAdd = () => {
    setEditingBank(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (bank: PiggyBank) => {
    setEditingBank(bank);
    form.setFieldsValue({
      name: bank.name,
      targetAmount: bank.targetAmount,
      currency: bank.currency,
      targetDate: bank.targetDate ? dayjs(bank.targetDate) : undefined,
      accountId: bank.accountId || undefined,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload: any = {
        name: values.name,
        targetAmount: values.targetAmount,
        currency: values.currency || 'CNY',
      };
      if (values.targetDate) {
        payload.targetDate = values.targetDate.format('YYYY-MM-DD');
      }
      if (values.accountId) {
        payload.accountId = values.accountId;
      }

      if (editingBank) {
        await apiService.put(`/piggy-banks/${editingBank.id}`, payload);
        message.success('存钱罐更新成功');
      } else {
        await apiService.post('/piggy-banks', payload);
        message.success('存钱罐创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingBank(null);
      fetchPiggyBanks();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiService.delete(`/piggy-banks/${id}`);
      message.success('存钱罐已删除');
      fetchPiggyBanks();
    } catch {
      message.error('删除失败');
    }
  };

  const openAmountModal = (bank: PiggyBank, action: 'deposit' | 'withdraw') => {
    setSelectedBank(bank);
    setAmountAction(action);
    amountForm.resetFields();
    setAmountModalVisible(true);
  };

  const handleAmountSubmit = async (values: { amount: number }) => {
    if (!selectedBank) return;
    try {
      await apiService.patch(`/piggy-banks/${selectedBank.id}/${amountAction}`, {
        amount: values.amount,
      });
      message.success(amountAction === 'deposit' ? '存入成功' : '取出成功');
      setAmountModalVisible(false);
      amountForm.resetFields();
      setSelectedBank(null);
      fetchPiggyBanks();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '操作失败');
    }
  };

  const renderBankCard = (bank: PiggyBank) => {
    const percent = bank.targetAmount > 0
      ? Math.min(Math.round((bank.currentAmount / bank.targetAmount) * 100), 100)
      : 0;
    const isCompleted = bank.currentAmount >= bank.targetAmount;
    const progressColor = getProgressColor(percent);

    return (
      <Col xs={24} sm={12} md={8} key={bank.id}>
        <Card
          size="small"
          style={{
            borderColor: isCompleted ? '#52c41a' : undefined,
            background: isCompleted ? '#f6ffed' : undefined,
          }}
          styles={{
            body: { padding: isMobile ? 14 : 18 },
          }}
          actions={[
            <Button
              type="link"
              size="small"
              style={{ color: '#10b981' }}
              onClick={() => openAmountModal(bank, 'deposit')}
            >
              存入
            </Button>,
            <Button
              type="link"
              size="small"
              style={{ color: '#f59e0b' }}
              onClick={() => openAmountModal(bank, 'withdraw')}
              disabled={bank.currentAmount <= 0}
            >
              取出
            </Button>,
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(bank)}
            />,
            <Popconfirm
              title="确定删除该存钱罐？"
              onConfirm={() => handleDelete(bank.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>,
          ]}
        >
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Space size={6}>
                {isCompleted ? (
                  <TrophyOutlined style={{ color: '#faad14', fontSize: 18 }} />
                ) : (
                  <WalletOutlined style={{ color: '#4f46e5', fontSize: 18 }} />
                )}
                <span style={{ fontWeight: 600, fontSize: 15 }}>{bank.name}</span>
              </Space>
              {isCompleted && (
                <Tag color="success" style={{ margin: 0 }}>已达成</Tag>
              )}
              {!bank.isActive && (
                <Tag color="default" style={{ margin: 0 }}>已停用</Tag>
              )}
            </div>
          </div>

          <Progress
            percent={percent}
            strokeColor={progressColor}
            size="small"
            format={(p) => `${p}%`}
          />

          <div style={{ marginTop: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#64748b' }}>已存</span>
              <span style={{ fontWeight: 600, color: progressColor }}>
                {formatAmount(bank.currentAmount)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#64748b' }}>目标</span>
              <span style={{ fontWeight: 500 }}>
                {formatAmount(bank.targetAmount)}
              </span>
            </div>
            {bank.targetDate && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>目标日期</span>
                <span style={{ color: '#64748b' }}>
                  {dayjs(bank.targetDate).format('YYYY-MM-DD')}
                </span>
              </div>
            )}
            {bank.account && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>关联账户</span>
                <span style={{ color: '#64748b' }}>{bank.account.name}</span>
              </div>
            )}
          </div>
        </Card>
      </Col>
    );
  };

  if (loading && piggyBanks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>存钱罐</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size={isMobile ? 'small' : 'middle'}>
          新建存钱罐
        </Button>
      </div>

      {piggyBanks.length > 0 ? (
        <Row gutter={[12, 12]}>
          {piggyBanks.map(renderBankCard)}
        </Row>
      ) : (
        <Card>
          <Empty
            description="暂无存钱罐，创建一个开始攒钱吧"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              创建存钱罐
            </Button>
          </Empty>
        </Card>
      )}

      {/* 创建/编辑 Modal */}
      <Modal
        title={editingBank ? '编辑存钱罐' : '新建存钱罐'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingBank(null);
        }}
        footer={null}
        width={isMobile ? '90%' : 480}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ currency: 'CNY' }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入存钱罐名称' }]}
          >
            <Input placeholder="例如：旅行基金、新手机" />
          </Form.Item>

          <Form.Item
            name="targetAmount"
            label="目标金额"
            rules={[{ required: true, message: '请输入目标金额' }]}
          >
            <InputNumber
              min={0.01}
              step={100}
              precision={2}
              placeholder="0.00"
              style={{ width: '100%' }}
              addonAfter="元"
            />
          </Form.Item>

          <Form.Item name="currency" label="币种">
            <Select>
              <Option value="CNY">CNY - 人民币</Option>
              <Option value="USD">USD - 美元</Option>
              <Option value="EUR">EUR - 欧元</Option>
              <Option value="JPY">JPY - 日元</Option>
            </Select>
          </Form.Item>

          <Form.Item name="targetDate" label="目标日期">
            <DatePicker style={{ width: '100%' }} placeholder="选择目标日期（可选）" />
          </Form.Item>

          <Form.Item name="accountId" label="关联账户">
            <Select placeholder="选择关联账户（可选）" allowClear>
              {accounts.map((account) => (
                <Option key={account.id} value={account.id}>
                  {account.icon ? `${account.icon} ` : ''}{account.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingBank ? '保存' : '创建'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
                setEditingBank(null);
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 存入/取出 Modal */}
      <Modal
        title={amountAction === 'deposit' ? '存入金额' : '取出金额'}
        open={amountModalVisible}
        onCancel={() => {
          setAmountModalVisible(false);
          amountForm.resetFields();
          setSelectedBank(null);
        }}
        footer={null}
        width={isMobile ? '90%' : 400}
      >
        {selectedBank && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{selectedBank.name}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              当前：{formatAmount(selectedBank.currentAmount)} / 目标：{formatAmount(selectedBank.targetAmount)}
            </div>
          </div>
        )}
        <Form
          form={amountForm}
          layout="vertical"
          onFinish={handleAmountSubmit}
        >
          <Form.Item
            name="amount"
            label={amountAction === 'deposit' ? '存入金额' : '取出金额'}
            rules={[
              { required: true, message: '请输入金额' },
              {
                validator: (_, value) => {
                  if (value && value <= 0) {
                    return Promise.reject('金额必须大于 0');
                  }
                  if (amountAction === 'withdraw' && selectedBank && value > selectedBank.currentAmount) {
                    return Promise.reject('取出金额不能超过当前余额');
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              min={0.01}
              step={10}
              precision={2}
              placeholder="0.00"
              style={{ width: '100%' }}
              addonAfter="元"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                确定
              </Button>
              <Button onClick={() => {
                setAmountModalVisible(false);
                amountForm.resetFields();
                setSelectedBank(null);
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

export default PiggyBankPage;
