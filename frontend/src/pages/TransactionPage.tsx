import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  DatePicker,
  Table,
  Tag,
  Alert,
  Typography,
  Space,
  Segmented,
  message,
  InputNumber,
  Popconfirm,
  Modal,
  Checkbox,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SwapOutlined,
  MinusCircleOutlined,
  DeleteOutlined,
  SearchOutlined,
  ExportOutlined,
  TagsOutlined,
  TagOutlined,
  FilterOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { apiService } from '../services/api';
import type { Account, Category, Transaction, PaginatedResponse, Tag as TagType, TransactionSummary } from '../types';
import { formatAmount } from '../utils/format';
import { getTransactionType } from '../utils/transaction';
import { useIsMobile } from '../hooks/useIsMobile';

const { Text } = Typography;
const { Option } = Select;

type EntryMode = 'expense' | 'income' | 'transfer';

interface EntryLine {
  key: string;
  accountId?: string;
  amount?: number;
}

const MODE_CONFIG: Record<EntryMode, {
  label: string;
  debitLabel: string;
  creditLabel: string;
  color: string;
}> = {
  expense: {
    label: '支出',
    debitLabel: '钱花在哪（借方）',
    creditLabel: '钱从哪出（贷方）',
    color: '#ef4444',
  },
  income: {
    label: '收入',
    debitLabel: '钱进到哪（借方）',
    creditLabel: '钱从哪来（贷方）',
    color: '#10b981',
  },
  transfer: {
    label: '转账',
    debitLabel: '转入账户（借方）',
    creditLabel: '转出账户（贷方）',
    color: '#4f46e5',
  },
};

const DEFAULT_TAG_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2', '#fa541c', '#2f54eb'];
const getTagColor = (tag: TagType, index?: number): string => {
  if (tag.color) return tag.color;
  return DEFAULT_TAG_COLORS[(index ?? 0) % DEFAULT_TAG_COLORS.length];
};

let keyCounter = 0;
const nextKey = () => `line_${++keyCounter}_${Date.now()}`;

const TransactionPage: React.FC = () => {
  const isMobile = useIsMobile();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [mode, setMode] = useState<EntryMode>('expense');

  const [date, setDate] = useState(dayjs());
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  const [debitLines, setDebitLines] = useState<EntryLine[]>([{ key: nextKey() }]);
  const [creditLines, setCreditLines] = useState<EntryLine[]>([{ key: nextKey() }]);

  // --- Tag state ---
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [transactionTagsMap, setTransactionTagsMap] = useState<Record<string, TagType[]>>({});
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagModalTransactionId, setTagModalTransactionId] = useState<string | null>(null);
  const [tagModalSelectedIds, setTagModalSelectedIds] = useState<string[]>([]);
  const [tagModalLoading, setTagModalLoading] = useState(false);

  // --- Summary state ---
  const [summary, setSummary] = useState<TransactionSummary | null>(null);

  // --- Search state ---
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Filter state ---
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [filterAccountId, setFilterAccountId] = useState<string | undefined>(undefined);
  const [filterCategoryId, setFilterCategoryId] = useState<string | undefined>(undefined);
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // --- Batch operation state ---
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // --- Entry form visible (for keyboard shortcut) ---
  const [entryFormVisible, setEntryFormVisible] = useState(true);

  const fetchAccounts = async () => {
    try {
      const data = await apiService.get<Account[]>('/accounts');
      setAccounts(data);
    } catch {
      message.error('获取账户列表失败');
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiService.get<Category[]>('/categories');
      setCategories(data);
    } catch {
      message.error('获取分类列表失败');
    }
  };

  const fetchTags = async () => {
    try {
      const data = await apiService.get<TagType[]>('/tags');
      setAllTags(data);
    } catch {
      message.error('获取标签列表失败');
    }
  };

  const fetchTransactions = useCallback(async (page = 1, pageSize?: number) => {
    setTransactionsLoading(true);
    try {
      const params: Record<string, any> = { page, limit: pageSize || pagination.limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterType) params.type = filterType;
      if (filterAccountId) params.accountId = filterAccountId;
      if (filterCategoryId) params.categoryId = filterCategoryId;
      if (filterDateRange?.[0]) params.startDate = filterDateRange[0].format('YYYY-MM-DD');
      if (filterDateRange?.[1]) params.endDate = filterDateRange[1].format('YYYY-MM-DD');
      if (filterTagIds.length > 0) params.tagIds = filterTagIds.join(',');

      const res = await apiService.get<PaginatedResponse<Transaction>>('/transactions', { params });
      setTransactions(res.data);
      setPagination((prev) => ({ ...prev, page, limit: pageSize || prev.limit, total: res.pagination.total }));
      if (res.summary) setSummary(res.summary);

      // Build transactionTagsMap from the tags relation included in the response
      const tagsMap: Record<string, TagType[]> = {};
      for (const tx of res.data) {
        if (tx.tags && tx.tags.length > 0) {
          tagsMap[tx.id] = tx.tags.map((rel) => rel.tag);
        }
      }
      setTransactionTagsMap(tagsMap);
    } catch {
      message.error('获取交易列表失败');
    } finally {
      setTransactionsLoading(false);
    }
  }, [pagination.limit, debouncedSearch, filterType, filterAccountId, filterCategoryId, filterDateRange, filterTagIds]);

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
    fetchTags();
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  // --- Search debounce ---
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchText]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      if (e.key === 'Escape') {
        if (tagModalVisible) {
          setTagModalVisible(false);
          return;
        }
      }

      if (isInputFocused) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEntryFormVisible(true);
        // scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tagModalVisible]);

  // Tag filtering is now server-side
  const filteredTransactions = transactions;

  const hasActiveFilters = !!(debouncedSearch || filterType || filterAccountId || filterCategoryId || filterDateRange);

  const paymentAccounts = accounts.filter((a) => ['asset', 'liability'].includes(a.accountType));
  const expenseAccounts = accounts.filter((a) => a.accountType === 'expense');
  const incomeAccounts = accounts.filter((a) => a.accountType === 'income');

  const getDebitOptions = (): Account[] => {
    if (mode === 'expense') return expenseAccounts;
    if (mode === 'income') return paymentAccounts;
    return paymentAccounts;
  };

  const getCreditOptions = (): Account[] => {
    if (mode === 'expense') return paymentAccounts;
    if (mode === 'income') return incomeAccounts;
    return paymentAccounts;
  };

  const relevantCategories = categories.filter((c) => {
    if (mode === 'transfer') return false;
    return c.type === mode;
  });

  const totalDebit = debitLines.reduce((s, l) => s + (l.amount || 0), 0);
  const totalCredit = creditLines.reduce((s, l) => s + (l.amount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005;
  const hasAmounts = totalDebit > 0 && totalCredit > 0;

  const updateDebitLine = (key: string, field: 'accountId' | 'amount', value: string | number | undefined) => {
    setDebitLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const updateCreditLine = (key: string, field: 'accountId' | 'amount', value: string | number | undefined) => {
    setCreditLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const addDebitLine = () => setDebitLines((prev) => [...prev, { key: nextKey() }]);
  const addCreditLine = () => setCreditLines((prev) => [...prev, { key: nextKey() }]);

  const removeDebitLine = (key: string) => {
    if (debitLines.length <= 1) return;
    setDebitLines((prev) => prev.filter((l) => l.key !== key));
  };

  const removeCreditLine = (key: string) => {
    if (creditLines.length <= 1) return;
    setCreditLines((prev) => prev.filter((l) => l.key !== key));
  };

  const handleModeChange = (val: string) => {
    setMode(val as EntryMode);
    setCategoryId(undefined);
    setDebitLines([{ key: nextKey() }]);
    setCreditLines([{ key: nextKey() }]);
  };

  const handleSubmit = async () => {
    const debitEntries = debitLines.filter((l) => l.accountId && l.amount && l.amount > 0);
    const creditEntries = creditLines.filter((l) => l.accountId && l.amount && l.amount > 0);

    if (debitEntries.length === 0 || creditEntries.length === 0) {
      message.error('借方和贷方都需要至少填写一条有效分录');
      return;
    }

    const dTotal = debitEntries.reduce((s, l) => s + (l.amount || 0), 0);
    const cTotal = creditEntries.reduce((s, l) => s + (l.amount || 0), 0);
    if (Math.abs(dTotal - cTotal) > 0.005) {
      message.error(`借贷不平衡！借方合计 ¥${dTotal.toFixed(2)} ≠ 贷方合计 ¥${cTotal.toFixed(2)}`);
      return;
    }

    setSubmitting(true);
    try {
      const entries = [
        ...debitEntries.map((l) => ({ accountId: l.accountId!, entryType: 'debit' as const, amount: l.amount! })),
        ...creditEntries.map((l) => ({ accountId: l.accountId!, entryType: 'credit' as const, amount: l.amount! })),
      ];

      await apiService.post('/transactions/manual', {
        date: date ? date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        description: description || undefined,
        categoryId: categoryId || undefined,
        entries,
      });

      message.success('记账成功');
      setDescription('');
      setCategoryId(undefined);
      setDate(dayjs());
      setDebitLines([{ key: nextKey() }]);
      setCreditLines([{ key: nextKey() }]);
      fetchTransactions(1);
    } catch (error: any) {
      message.error(error?.response?.data?.error || '记账失败');
    } finally {
      setSubmitting(false);
    }
  };

  const accountLabel = (type: string) => {
    const m: Record<string, string> = { asset: '资产', expense: '支出', income: '收入', liability: '负债' };
    return m[type] || type;
  };

  // --- Tag management ---
  const openTagModal = (transactionId: string) => {
    setTagModalTransactionId(transactionId);
    const currentTags = transactionTagsMap[transactionId] || [];
    setTagModalSelectedIds(currentTags.map((t) => t.id));
    setTagModalVisible(true);
  };

  const handleTagModalOk = async () => {
    if (!tagModalTransactionId) return;
    setTagModalLoading(true);
    try {
      const currentTags = transactionTagsMap[tagModalTransactionId] || [];
      const currentIds = currentTags.map((t) => t.id);
      const toAdd = tagModalSelectedIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !tagModalSelectedIds.includes(id));

      // Remove tags
      for (const tagId of toRemove) {
        await apiService.delete(`/tags/transaction/${tagModalTransactionId}/${tagId}`);
      }

      // Add tags
      if (toAdd.length > 0) {
        await apiService.post(`/tags/transaction/${tagModalTransactionId}`, { tagIds: toAdd });
      }

      // Update local cache
      const updatedTags = allTags.filter((t) => tagModalSelectedIds.includes(t.id));
      setTransactionTagsMap((prev) => ({
        ...prev,
        [tagModalTransactionId]: updatedTags,
      }));

      message.success('标签已更新');
      setTagModalVisible(false);
    } catch (error: any) {
      message.error(error?.response?.data?.error || '更新标签失败');
    } finally {
      setTagModalLoading(false);
    }
  };

  // --- Delete ---
  const handleDelete = async (id: string) => {
    try {
      await apiService.delete(`/transactions/${id}`);
      message.success('删除成功');
      fetchTransactions(pagination.page);
    } catch (error: any) {
      message.error(error?.response?.data?.error || '删除失败');
    }
  };

  const handleVoid = async (id: string) => {
    try {
      await apiService.put(`/transactions/${id}/void`);
      message.success('已作废');
      fetchTransactions(pagination.page);
    } catch (error: any) {
      message.error(error?.response?.data?.error || '作废失败');
    }
  };

  const showDeleteConfirm = (record: Transaction) => {
    const debits = record.entries?.filter((e) => e.entryType === 'debit') || [];
    const credits = record.entries?.filter((e) => e.entryType === 'credit') || [];
    const total = debits.reduce((s, e) => s + parseFloat(e.amount), 0);

    Modal.confirm({
      title: '确认删除交易',
      icon: null,
      content: (
        <div>
          <p>{record.description || '无描述'} — {formatAmount(total)}</p>
          <p style={{ fontSize: 12, color: '#64748b' }}>
            借方: {debits.map((e) => e.account?.name).join('、')} | 贷方: {credits.map((e) => e.account?.name).join('、')}
          </p>
          <p style={{ color: '#ef4444', fontSize: 13 }}>删除后不可恢复</p>
        </div>
      ),
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => handleDelete(record.id),
    });
  };

  // --- Batch operations ---
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的交易');
      return;
    }
    Modal.confirm({
      title: '批量删除',
      content: `确认删除选中的 ${selectedRowKeys.length} 条交易？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        let successCount = 0;
        let failCount = 0;
        for (const id of selectedRowKeys) {
          try {
            await apiService.delete(`/transactions/${id}`);
            successCount++;
          } catch {
            failCount++;
          }
        }
        message.success(`成功删除 ${successCount} 条${failCount > 0 ? `，失败 ${failCount} 条` : ''}`);
        setSelectedRowKeys([]);
        fetchTransactions(pagination.page);
      },
    });
  };

  const handleBatchExportCSV = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要导出的交易');
      return;
    }

    const selectedTransactions = filteredTransactions.filter((t) => selectedRowKeys.includes(t.id));
    const csvHeader = '日期,描述,类型,金额,借方账户,贷方账户,分类,状态';
    const csvRows = selectedTransactions.map((t) => {
      const txType = getTransactionType(t);
      const debits = t.entries?.filter((e) => e.entryType === 'debit') || [];
      const credits = t.entries?.filter((e) => e.entryType === 'credit') || [];
      const dTotal = debits.reduce((s, e) => s + parseFloat(e.amount), 0);
      const dNames = debits.map((e) => e.account?.name || '-').join('+');
      const cNames = credits.map((e) => e.account?.name || '-').join('+');
      const sanitizeCSV = (val: string): string => {
        const s = val.replace(/"/g, '""');
        return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      };
      const desc = sanitizeCSV(t.description || '');
      const categoryName = t.category?.name || '';
      const statusMap: Record<string, string> = { draft: '草稿', posted: '已记账', void: '已作废' };
      return `${dayjs(t.transactionDate).format('YYYY-MM-DD')},"${desc}",${txType.label},${dTotal.toFixed(2)},"${dNames}","${cNames}","${categoryName}",${statusMap[t.status] || t.status}`;
    });

    const csvContent = '\uFEFF' + csvHeader + '\n' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `交易导出_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success(`已导出 ${selectedTransactions.length} 条交易`);
  };

  // --- Expanded row ---
  const expandedRowRender = (record: Transaction) => {
    const debits = record.entries?.filter((e) => e.entryType === 'debit') || [];
    const credits = record.entries?.filter((e) => e.entryType === 'credit') || [];
    const totalD = debits.reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalC = credits.reduce((s, e) => s + parseFloat(e.amount), 0);
    return (
      <div style={{ padding: '8px 16px' }}>
        <Row gutter={isMobile ? 8 : 48}>
          <Col span={12}>
            <Text strong style={{ color: '#ef4444', fontSize: 12 }}>借方</Text>
            {debits.map((e) => (
              <Row key={e.id} justify="space-between" style={{ padding: '2px 0' }}>
                <Col><Text style={{ fontSize: 12 }}>{e.account?.name || '-'}</Text></Col>
                <Col><Text style={{ color: '#ef4444', fontSize: 12 }}>{formatAmount(e.amount)}</Text></Col>
              </Row>
            ))}
            <Row justify="space-between" style={{ borderTop: '1px solid #f1f5f9', marginTop: 4, paddingTop: 4 }}>
              <Col><Text strong style={{ fontSize: 12 }}>合计</Text></Col>
              <Col><Text strong style={{ color: '#ef4444', fontSize: 12 }}>{formatAmount(totalD)}</Text></Col>
            </Row>
          </Col>
          <Col span={12}>
            <Text strong style={{ color: '#10b981', fontSize: 12 }}>贷方</Text>
            {credits.map((e) => (
              <Row key={e.id} justify="space-between" style={{ padding: '2px 0' }}>
                <Col><Text style={{ fontSize: 12 }}>{e.account?.name || '-'}</Text></Col>
                <Col><Text style={{ color: '#10b981', fontSize: 12 }}>{formatAmount(e.amount)}</Text></Col>
              </Row>
            ))}
            <Row justify="space-between" style={{ borderTop: '1px solid #f1f5f9', marginTop: 4, paddingTop: 4 }}>
              <Col><Text strong style={{ fontSize: 12 }}>合计</Text></Col>
              <Col><Text strong style={{ color: '#10b981', fontSize: 12 }}>{formatAmount(totalC)}</Text></Col>
            </Row>
          </Col>
        </Row>
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <Tag color={Math.abs(totalD - totalC) < 0.01 ? 'green' : 'red'} style={{ fontSize: 11 }}>
            {Math.abs(totalD - totalC) < 0.01 ? '借贷平衡' : `差额: ${formatAmount(totalD - totalC)}`}
          </Tag>
        </div>
      </div>
    );
  };

  // --- Columns ---
  const columns: ColumnsType<Transaction> = [
    {
      title: '日期', dataIndex: 'transactionDate', key: 'transactionDate', width: isMobile ? 70 : 100,
      render: (d: string) => dayjs(d).format(isMobile ? 'MM/DD' : 'YYYY-MM-DD'),
    },
    {
      title: '描述', dataIndex: 'description', key: 'description', ellipsis: false,
      render: (t: string, r: Transaction) => {
        // Parse description: "主描述 [原始类型 · 支付方式]"
        const raw = t || '-';
        const bracketMatch = raw.match(/^(.+?)\s*\[(.+)\]$/);
        const mainDesc = bracketMatch ? bracketMatch[1] : raw;
        const metaInfo = bracketMatch ? bracketMatch[2] : null;
        const txInfo = getTransactionType(r);

        if (isMobile) {
          return (
            <div>
              <div style={{ fontSize: 13, lineHeight: 1.3 }}>{mainDesc}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3 }}>
                {txInfo.fromAccount} → {txInfo.toAccount}
                {metaInfo && <span> · {metaInfo}</span>}
              </div>
            </div>
          );
        }

        return (
          <Tooltip title={raw} placement="topLeft">
            <div>
              <div style={{ fontSize: 13, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mainDesc}</div>
              {metaInfo && (
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3 }}>{metaInfo}</div>
              )}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '类型', key: 'type', width: isMobile ? 48 : 64,
      render: (_: any, r: Transaction) => {
        const t = getTransactionType(r);
        return <Tag color={t.color} style={{ margin: 0, fontSize: 11 }}>{t.label}</Tag>;
      },
    },
    {
      title: '金额', key: 'amount', width: isMobile ? 90 : 110, align: 'right' as const,
      render: (_: any, r: Transaction) => {
        const t = getTransactionType(r);
        return <span style={{ color: t.color, fontWeight: 600, fontSize: 13 }}>{t.sign}{formatAmount(t.amount)}</span>;
      },
    },
    ...(isMobile ? [] : [{
      title: '分类' as const, key: 'category' as const, width: 90,
      render: (_: any, r: Transaction) => {
        if (!r.category) return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
        return <Text style={{ fontSize: 12 }}>{r.category.icon} {r.category.name}</Text>;
      },
    }]),
    ...(isMobile ? [] : [{
      title: '资金流向' as const, key: 'summary' as const, width: 200,
      render: (_: any, r: Transaction) => {
        const txType = getTransactionType(r);
        return (
          <Text style={{ fontSize: 12 }}>
            {txType.fromAccount}
            <span style={{ color: '#94a3b8', margin: '0 4px' }}>→</span>
            {txType.toAccount}
          </Text>
        );
      },
    }]),
    ...(isMobile ? [] : [{
      title: '标签' as const, key: 'tags' as const, width: 160,
      render: (_: any, r: Transaction) => {
        const txTags = transactionTagsMap[r.id] || [];
        return (
          <Space size={2} wrap>
            {txTags.map((tag, idx) => (
              <Tag key={tag.id} color={getTagColor(tag, idx)} style={{ fontSize: 11, margin: '1px 0' }}>
                {tag.name}
              </Tag>
            ))}
            <Tooltip title="管理标签">
              <Button
                type="text"
                size="small"
                icon={<TagOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />}
                onClick={(e) => { e.stopPropagation(); openTagModal(r.id); }}
                style={{ padding: '0 4px', height: 20 }}
              />
            </Tooltip>
          </Space>
        );
      },
    }]),
    {
      title: '状态', dataIndex: 'status', key: 'status', width: isMobile ? 56 : 72,
      render: (s: string) => {
        const cm: Record<string, string> = { draft: 'default', posted: 'green', void: 'red' };
        const lm: Record<string, string> = { draft: '草稿', posted: '已记账', void: '已作废' };
        return <Tag color={cm[s] || 'default'} style={{ fontSize: 11 }}>{lm[s] || s}</Tag>;
      },
    },
    {
      title: '操作', key: 'actions', width: isMobile ? 80 : 120, fixed: isMobile ? 'right' : undefined,
      render: (_: any, r: Transaction) => (
        <Space size={2}>
          {isMobile && (
            <Tooltip title="管理标签">
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: 12 }}
                icon={<TagOutlined />}
                onClick={() => openTagModal(r.id)}
              />
            </Tooltip>
          )}
          {r.status !== 'void' && (
            <Popconfirm title="确认作废？" onConfirm={() => handleVoid(r.id)} okText="作废" cancelText="取消">
              <Button type="link" size="small" danger style={{ padding: 0, fontSize: 12 }}>作废</Button>
            </Popconfirm>
          )}
          <Button type="link" size="small" danger style={{ padding: 0, fontSize: 12 }} onClick={() => showDeleteConfirm(r)}>删除</Button>
        </Space>
      ),
    },
  ];

  const renderLineItem = (
    line: EntryLine,
    accountOptions: Account[],
    updateFn: (key: string, field: 'accountId' | 'amount', value: string | number | undefined) => void,
    removeFn: (key: string) => void,
    canRemove: boolean,
    color: string,
  ) => (
    <Row gutter={6} align="middle" style={{ marginBottom: 6 }}>
      <Col flex="auto">
        <Select
          placeholder="选择账户"
          showSearch
          optionFilterProp="children"
          value={line.accountId}
          onChange={(v) => updateFn(line.key, 'accountId', v)}
          style={{ width: '100%' }}
          size="small"
        >
          {accountOptions.map((a) => (
            <Option key={a.id} value={a.id}>
              {a.icon} {a.name}
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>({accountLabel(a.accountType)})</Text>
            </Option>
          ))}
        </Select>
      </Col>
      <Col style={{ width: isMobile ? 100 : 130 }}>
        <InputNumber
          placeholder="金额"
          min={0}
          step={0.01}
          precision={2}
          value={line.amount}
          onChange={(v) => updateFn(line.key, 'amount', v || 0)}
          style={{ width: '100%' }}
          size="small"
          prefix={<span style={{ color, fontWeight: 600 }}>¥</span>}
        />
      </Col>
      <Col>
        {canRemove && (
          <Button type="text" danger size="small" icon={<MinusCircleOutlined />} onClick={() => removeFn(line.key)} />
        )}
      </Col>
    </Row>
  );

  const cfg = MODE_CONFIG[mode];

  // --- Row selection config ---
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  return (
    <div>
      <h1 className="page-title">交易记录</h1>

      {entryFormVisible && (
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: isMobile ? 12 : 16 } }}
        >
          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={24}>
              <Segmented
                block
                value={mode}
                onChange={handleModeChange}
                options={[
                  { label: <span style={{ color: '#ef4444', fontWeight: 500 }}>支出</span>, value: 'expense' },
                  { label: <span style={{ color: '#10b981', fontWeight: 500 }}>收入</span>, value: 'income' },
                  { label: <span style={{ color: '#4f46e5', fontWeight: 500 }}><SwapOutlined /> 转账</span>, value: 'transfer' },
                ]}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <DatePicker
                value={date}
                onChange={(d) => setDate(d || dayjs())}
                style={{ width: '100%' }}
                size="small"
                placeholder="选择日期"
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="描述"
                style={{ width: '100%' }}
                size="small"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Col>
            {mode !== 'transfer' && (
              <Col xs={24} sm={12} md={8}>
                <Select
                  placeholder="选择分类"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  style={{ width: '100%' }}
                  size="small"
                  value={categoryId}
                  onChange={(v) => setCategoryId(v)}
                >
                  {relevantCategories.map((c) => (
                    <Option key={c.id} value={c.id}>{c.icon} {c.name}</Option>
                  ))}
                </Select>
              </Col>
            )}
          </Row>

          {isMobile ? (
            <div>
              <Card
                size="small"
                title={<Text strong style={{ color: '#ef4444', fontSize: 13 }}>借方 — {cfg.debitLabel}</Text>}
                style={{ borderLeft: '3px solid #ef4444', marginBottom: 8 }}
                styles={{ body: { padding: '8px 10px' } }}
              >
                {debitLines.map((line) =>
                  renderLineItem(line, getDebitOptions(), updateDebitLine, removeDebitLine, debitLines.length > 1, '#ef4444'),
                )}
                <Row justify="space-between" align="middle" style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6, marginTop: 2 }}>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addDebitLine}>添加</Button>
                  <Text strong style={{ color: '#ef4444', fontSize: 13 }}>合计: {formatAmount(totalDebit)}</Text>
                </Row>
              </Card>

              {hasAmounts && (
                <div style={{ textAlign: 'center', padding: '6px 0' }}>
                  <Tag color={isBalanced ? 'green' : 'red'} style={{ fontSize: 12 }}>
                    {isBalanced ? '✓ 平衡' : `差额 ¥${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
                  </Tag>
                </div>
              )}

              <Card
                size="small"
                title={<Text strong style={{ color: '#10b981', fontSize: 13 }}>贷方 — {cfg.creditLabel}</Text>}
                style={{ borderLeft: '3px solid #10b981' }}
                styles={{ body: { padding: '8px 10px' } }}
              >
                {creditLines.map((line) =>
                  renderLineItem(line, getCreditOptions(), updateCreditLine, removeCreditLine, creditLines.length > 1, '#10b981'),
                )}
                <Row justify="space-between" align="middle" style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6, marginTop: 2 }}>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addCreditLine}>添加</Button>
                  <Text strong style={{ color: '#10b981', fontSize: 13 }}>合计: {formatAmount(totalCredit)}</Text>
                </Row>
              </Card>
            </div>
          ) : (
            <Row gutter={16}>
              <Col span={10}>
                <Card
                  size="small"
                  title={<Text strong style={{ color: '#ef4444' }}>借方 (Debit) — {cfg.debitLabel}</Text>}
                  style={{ borderLeft: '3px solid #ef4444' }}
                  styles={{ body: { padding: '10px 14px' } }}
                >
                  {debitLines.map((line) =>
                    renderLineItem(line, getDebitOptions(), updateDebitLine, removeDebitLine, debitLines.length > 1, '#ef4444'),
                  )}
                  <Row justify="space-between" align="middle" style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 4 }}>
                    <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addDebitLine}>添加借方</Button>
                    <Text strong style={{ color: '#ef4444' }}>合计: {formatAmount(totalDebit)}</Text>
                  </Row>
                </Card>
              </Col>
              <Col span={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '20px 0' }}>
                {hasAmounts && (
                  <Tag color={isBalanced ? 'green' : 'red'} style={{ fontSize: 13, padding: '4px 12px' }}>
                    {isBalanced ? '✓ 平衡' : `差额 ¥${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
                  </Tag>
                )}
              </Col>
              <Col span={10}>
                <Card
                  size="small"
                  title={<Text strong style={{ color: '#10b981' }}>贷方 (Credit) — {cfg.creditLabel}</Text>}
                  style={{ borderLeft: '3px solid #10b981' }}
                  styles={{ body: { padding: '10px 14px' } }}
                >
                  {creditLines.map((line) =>
                    renderLineItem(line, getCreditOptions(), updateCreditLine, removeCreditLine, creditLines.length > 1, '#10b981'),
                  )}
                  <Row justify="space-between" align="middle" style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 4 }}>
                    <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addCreditLine}>添加贷方</Button>
                    <Text strong style={{ color: '#10b981' }}>合计: {formatAmount(totalCredit)}</Text>
                  </Row>
                </Card>
              </Col>
            </Row>
          )}

          {hasAmounts && !isBalanced && (
            <Alert style={{ marginTop: 10 }} type="error" showIcon
              message={`借贷不平衡：借方 ¥${totalDebit.toFixed(2)}，贷方 ¥${totalCredit.toFixed(2)}，差额 ¥${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
            />
          )}

          <div style={{ marginTop: 12 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              loading={submitting}
              disabled={hasAmounts && !isBalanced}
              onClick={handleSubmit}
            >
              记账
            </Button>
          </div>
        </Card>
      )}

      <Card
        title={<span style={{ fontWeight: 600 }}>交易列表</span>}
        styles={{ body: { padding: isMobile ? 0 : undefined } }}
        extra={
          <Space size={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>按 N 新建 | Esc 关闭弹窗</Text>
            <Button icon={<ReloadOutlined />} onClick={() => fetchTransactions(pagination.page)} loading={transactionsLoading} size="small">
              刷新
            </Button>
          </Space>
        }
      >
        {/* Search & filter bar */}
        <div style={{ padding: isMobile ? '8px 12px' : '0 0 12px 0' }}>
          <Row gutter={[8, 8]} align="middle">
            <Col xs={16} sm={10} md={7}>
              <Input
                placeholder="搜索描述、账户..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                allowClear
                size="small"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Col>
            <Col xs={8} sm={4} md={3}>
              <Button
                size="small"
                icon={<FilterOutlined />}
                onClick={() => setShowFilters(!showFilters)}
                type={hasActiveFilters ? 'primary' : 'default'}
                ghost={hasActiveFilters}
                style={{ width: '100%' }}
              >
                {isMobile ? '' : '筛选'}
                {hasActiveFilters && !isMobile && ' *'}
              </Button>
            </Col>
            {allTags.length > 0 && !isMobile && (
              <Col sm={10} md={8}>
                <Select
                  mode="multiple"
                  placeholder="按标签筛选"
                  allowClear
                  size="small"
                  style={{ width: '100%' }}
                  value={filterTagIds}
                  onChange={(vals) => setFilterTagIds(vals)}
                  maxTagCount={3}
                  optionFilterProp="label"
                  options={allTags.map((tag) => ({
                    label: tag.name,
                    value: tag.id,
                  }))}
                  tagRender={(props) => {
                    const { label, closable, onClose } = props;
                    const tag = allTags.find((t) => t.name === label);
                    return (
                      <Tag
                        color={tag ? getTagColor(tag) : undefined}
                        closable={closable}
                        onClose={onClose}
                        style={{ marginRight: 3, fontSize: 11 }}
                      >
                        {label}
                      </Tag>
                    );
                  }}
                />
              </Col>
            )}
          </Row>

          {/* Expanded filter row */}
          {showFilters && (
            <Row gutter={[8, 8]} style={{ marginTop: 8 }} align="middle">
              <Col xs={24} sm={8} md={6}>
                <DatePicker.RangePicker
                  size="small"
                  style={{ width: '100%' }}
                  value={filterDateRange}
                  onChange={(dates) => setFilterDateRange(dates)}
                  placeholder={['开始日期', '结束日期']}
                  allowClear
                />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select
                  placeholder="交易类型"
                  allowClear
                  size="small"
                  style={{ width: '100%' }}
                  value={filterType}
                  onChange={(v) => setFilterType(v)}
                >
                  <Option value="expense"><Tag color="#ef4444" style={{ margin: 0, fontSize: 11 }}>支出</Tag></Option>
                  <Option value="income"><Tag color="#10b981" style={{ margin: 0, fontSize: 11 }}>收入</Tag></Option>
                  <Option value="transfer"><Tag color="#4f46e5" style={{ margin: 0, fontSize: 11 }}>转账</Tag></Option>
                </Select>
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select
                  placeholder="账户"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  size="small"
                  style={{ width: '100%' }}
                  value={filterAccountId}
                  onChange={(v) => setFilterAccountId(v)}
                >
                  {accounts.map((a) => (
                    <Option key={a.id} value={a.id}>{a.icon} {a.name}</Option>
                  ))}
                </Select>
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select
                  placeholder="分类"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  size="small"
                  style={{ width: '100%' }}
                  value={filterCategoryId}
                  onChange={(v) => setFilterCategoryId(v)}
                >
                  {categories.map((c) => (
                    <Option key={c.id} value={c.id}>{c.icon} {c.name}</Option>
                  ))}
                </Select>
              </Col>
              {hasActiveFilters && (
                <Col>
                  <Button
                    size="small"
                    type="link"
                    icon={<ClearOutlined />}
                    onClick={() => {
                      setSearchText('');
                      setFilterType(undefined);
                      setFilterAccountId(undefined);
                      setFilterCategoryId(undefined);
                      setFilterDateRange(null);
                    }}
                  >
                    清除筛选
                  </Button>
                </Col>
              )}
            </Row>
          )}
        </div>

        {/* Summary stats */}
        {summary && (
          <div style={{
            padding: isMobile ? '6px 12px' : '6px 0 10px 0',
            display: 'flex',
            gap: isMobile ? 8 : 16,
            flexWrap: 'wrap',
            fontSize: 12,
            color: '#64748b',
          }}>
            <span>
              收入 <Text strong style={{ color: '#10b981', fontSize: 13 }}>{formatAmount(summary.totalIncome)}</Text>
            </span>
            <span>
              支出 <Text strong style={{ color: '#ef4444', fontSize: 13 }}>{formatAmount(summary.totalExpense)}</Text>
            </span>
            <span>
              转账 <Text strong style={{ color: '#4f46e5', fontSize: 13 }}>{formatAmount(summary.totalTransfer)}</Text>
            </span>
            <span>
              结余 <Text strong style={{
                color: (summary.totalIncome - summary.totalExpense) >= 0 ? '#10b981' : '#ef4444',
                fontSize: 13,
              }}>
                {formatAmount(summary.totalIncome - summary.totalExpense)}
              </Text>
            </span>
          </div>
        )}

        {/* Batch operation bar */}
        {selectedRowKeys.length > 0 && (
          <div style={{
            padding: '8px 16px',
            background: '#f0f5ff',
            borderBottom: '1px solid #d6e4ff',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <Checkbox
              checked={selectedRowKeys.length === filteredTransactions.length && filteredTransactions.length > 0}
              indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < filteredTransactions.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedRowKeys(filteredTransactions.map((t) => t.id));
                } else {
                  setSelectedRowKeys([]);
                }
              }}
            >
              <Text style={{ fontSize: 13 }}>
                已选 <Text strong>{selectedRowKeys.length}</Text> 条
              </Text>
            </Checkbox>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
            >
              批量删除
            </Button>
            <Button
              size="small"
              icon={<ExportOutlined />}
              onClick={handleBatchExportCSV}
            >
              导出 CSV
            </Button>
            <Button
              size="small"
              type="link"
              onClick={() => setSelectedRowKeys([])}
            >
              取消选择
            </Button>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={filteredTransactions}
          rowKey="id"
          loading={transactionsLoading}
          rowSelection={rowSelection}
          expandable={{
            expandedRowRender,
            rowExpandable: (r) => (r.entries?.length || 0) > 0,
          }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: isMobile ? undefined : (t) => `共 ${t} 条记录`,
            onChange: (p, ps) => {
              fetchTransactions(p, ps);
            },
            size: 'small',
          }}
          size="small"
          locale={{ emptyText: '暂无交易记录' }}
          scroll={isMobile ? { x: 450 } : undefined}
        />
      </Card>

      {/* Tag management modal */}
      <Modal
        title={
          <Space>
            <TagsOutlined />
            <span>管理标签</span>
          </Space>
        }
        open={tagModalVisible}
        onOk={handleTagModalOk}
        onCancel={() => setTagModalVisible(false)}
        confirmLoading={tagModalLoading}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        {allTags.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#8c8c8c' }}>
            暂无标签，请先在标签管理页面创建标签
          </div>
        ) : (
          <div>
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 12, display: 'block' }}>
              选择要关联的标签（可多选）
            </Text>
            <Checkbox.Group
              value={tagModalSelectedIds}
              onChange={(vals) => setTagModalSelectedIds(vals as string[])}
              style={{ width: '100%' }}
            >
              <Row gutter={[8, 8]}>
                {allTags.map((tag, idx) => (
                  <Col key={tag.id} xs={12} sm={8}>
                    <Checkbox value={tag.id} style={{ width: '100%' }}>
                      <Tag color={getTagColor(tag, idx)} style={{ fontSize: 12 }}>
                        {tag.name}
                      </Tag>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionPage;
