import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  message,
  Empty,
} from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiService } from '../services/api';
import type { Account, AccountType, AccountSubtype, AccountCreateRequest } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

const { Option } = Select;

const accountTypeLabels: Record<AccountType, string> = {
  asset: '资产',
  liability: '负债',
  income: '收入',
  expense: '支出',
};

const accountTypeColors: Record<AccountType, string> = {
  asset: '#4f46e5',
  liability: '#ef4444',
  income: '#06b6d4',
  expense: '#f59e0b',
};

const accountTypeBg: Record<AccountType, string> = {
  asset: '#eef2ff',
  liability: '#fef2f2',
  income: '#ecfeff',
  expense: '#fffbeb',
};

const currencyOptions = [
  { value: 'CNY', label: 'CNY - 人民币' },
  { value: 'USD', label: 'USD - 美元' },
  { value: 'EUR', label: 'EUR - 欧元' },
  { value: 'JPY', label: 'JPY - 日元' },
  { value: 'GBP', label: 'GBP - 英镑' },
  { value: 'HKD', label: 'HKD - 港币' },
];

const subtypesByAccountType: Record<string, { value: AccountSubtype; label: string }[]> = {
  asset: [
    { value: 'cash', label: '现金' },
    { value: 'checking', label: '活期' },
    { value: 'savings', label: '储蓄' },
    { value: 'investment', label: '投资' },
    { value: 'virtual', label: '虚拟' },
  ],
  liability: [
    { value: 'credit_card', label: '信用卡' },
    { value: 'debt', label: '借款' },
    { value: 'receivables', label: '应收' },
  ],
};

const subtypeLabels: Record<string, string> = {
  cash: '现金',
  checking: '活期',
  savings: '储蓄',
  investment: '投资',
  virtual: '虚拟',
  credit_card: '信用卡',
  debt: '借款',
  receivables: '应收',
};

const AccountPage: React.FC = () => {
  const isMobile = useIsMobile();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form] = Form.useForm();
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType>('asset');

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<Account[]>('/accounts');
      setAccounts(data);
    } catch {
      message.error('获取账户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAdd = () => {
    setEditingAccount(null);
    form.resetFields();
    setSelectedAccountType('asset');
    setModalVisible(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setSelectedAccountType(account.accountType);
    form.setFieldsValue({
      name: account.name,
      accountType: account.accountType,
      currency: account.currency || 'CNY',
      subtype: account.subtype,
      icon: account.icon,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: AccountCreateRequest) => {
    try {
      if (editingAccount) {
        await apiService.put(`/accounts/${editingAccount.id}`, values);
        message.success('账户更新成功');
      } else {
        await apiService.post('/accounts', values);
        message.success('账户创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingAccount(null);
      fetchAccounts();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '操作失败');
    }
  };

  const handleAccountTypeChange = (value: AccountType) => {
    setSelectedAccountType(value);
    form.setFieldValue('subtype', undefined);
  };

  const groupedAccounts: Record<AccountType, Account[]> = {
    asset: accounts.filter((a) => a.accountType === 'asset'),
    liability: accounts.filter((a) => a.accountType === 'liability'),
    income: accounts.filter((a) => a.accountType === 'income'),
    expense: accounts.filter((a) => a.accountType === 'expense'),
  };

  const getColumns = (): ColumnsType<Account> => [
    {
      title: '账户名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Account) => (
        <Space size={6}>
          {record.icon && <span>{record.icon}</span>}
          <span style={{ fontWeight: 500 }}>{name}</span>
          {record.currency && record.currency !== 'CNY' && (
            <Tag color="blue" style={{ fontSize: 10, margin: 0, lineHeight: '16px', padding: '0 4px' }}>
              {record.currency}
            </Tag>
          )}
        </Space>
      ),
    },
    ...(isMobile ? [] : [{
      title: '类型' as const,
      dataIndex: 'accountType' as const,
      key: 'accountType' as const,
      width: 80,
      render: (type: AccountType) => (
        <Tag color={accountTypeColors[type]} style={{ fontSize: 12 }}>{accountTypeLabels[type]}</Tag>
      ),
    }]),
    ...(isMobile ? [] : [{
      title: '子类型' as const,
      dataIndex: 'subtype' as const,
      key: 'subtype' as const,
      width: 80,
      render: (subtype: string) => subtype ? (
        <span style={{ fontSize: 12, color: '#64748b' }}>{subtypeLabels[subtype] || subtype}</span>
      ) : '-',
    }]),
    ...(isMobile ? [] : [{
      title: '币种' as const,
      dataIndex: 'currency' as const,
      key: 'currency' as const,
      width: 60,
      render: (currency: string) => (
        <span style={{ fontSize: 12, color: '#64748b' }}>{currency || 'CNY'}</span>
      ),
    }]),
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 60,
      render: (isActive: boolean) => (
        <Tag color={isActive ? '#10b981' : '#94a3b8'} style={{ fontSize: 11 }}>{isActive ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 56,
      render: (_: any, record: Account) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} style={{ padding: 0 }} />
      ),
    },
  ];

  const currentSubtypes = subtypesByAccountType[selectedAccountType] || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>账户管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size={isMobile ? 'small' : 'middle'}>
          新建账户
        </Button>
      </div>

      <Row gutter={[12, 12]}>
        {(Object.keys(accountTypeLabels) as AccountType[]).map((type) => (
          <Col xs={24} md={12} key={type}>
            <Card
              title={
                <Space size={6}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: accountTypeBg[type],
                    color: accountTypeColors[type],
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {accountTypeLabels[type][0]}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{accountTypeLabels[type]}账户</span>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>({groupedAccounts[type].length})</span>
                </Space>
              }
              size="small"
              styles={{ body: { padding: isMobile ? 0 : undefined } }}
            >
              {groupedAccounts[type].length > 0 ? (
                <Table
                  columns={getColumns()}
                  dataSource={groupedAccounts[type]}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  loading={loading}
                  showHeader={!isMobile}
                />
              ) : (
                <Empty
                  description={`暂无${accountTypeLabels[type]}账户`}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ padding: '16px 0' }}
                />
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title={editingAccount ? '编辑账户' : '新建账户'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingAccount(null);
        }}
        footer={null}
        width={isMobile ? '90%' : 480}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ accountType: 'asset', currency: 'CNY' }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="账户名称"
            rules={[{ required: true, message: '请输入账户名称' }]}
          >
            <Input placeholder="例如：支付宝、银行卡、工资" />
          </Form.Item>

          <Form.Item
            name="accountType"
            label="账户类型"
            rules={[{ required: true, message: '请选择账户类型' }]}
          >
            <Select placeholder="选择类型" onChange={handleAccountTypeChange}>
              {(Object.keys(accountTypeLabels) as AccountType[]).map((type) => (
                <Option key={type} value={type}>
                  <Space>
                    <Tag color={accountTypeColors[type]} style={{ margin: 0 }}>{accountTypeLabels[type]}</Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {currentSubtypes.length > 0 && (
            <Form.Item name="subtype" label="账户子类型">
              <Select placeholder="选择子类型（可选）" allowClear>
                {currentSubtypes.map((st) => (
                  <Option key={st.value} value={st.value}>{st.label}</Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="currency" label="币种">
            <Select placeholder="选择币种">
              {currencyOptions.map((c) => (
                <Option key={c.value} value={c.value}>{c.label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="icon" label="图标">
            <Input placeholder="可选，账户图标" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingAccount ? '保存' : '创建'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
                setEditingAccount(null);
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

export default AccountPage;
