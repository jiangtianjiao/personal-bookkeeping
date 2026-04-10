import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Upload,
  Button,
  Select,
  Table,
  Tag,
  Statistic,
  Alert,
  message,
  Grid,
  Typography,
  Space,
  Tabs,
  Form,
  Input,
  InputNumber,
  Switch,
  Empty,
  Steps,
  Collapse,
  Checkbox,
  Modal,
  Result,
  DatePicker,
} from 'antd';
import {
  UploadOutlined,
  InboxOutlined,
  DownloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  MailOutlined,
  ApiOutlined,
  SyncOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BankOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { apiService } from '../services/api';
import type { ImportResult, Transaction, Account, Category } from '../types';
import { formatAmount } from '../utils/format';
import { getTransactionType } from '../utils/transaction';

const { Dragger } = Upload;
const { useBreakpoint } = Grid;
const { Text } = Typography;
const { Option } = Select;

// Email config types
interface EmailConfig {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  email: string;
  lastFetch: string | null;
}

interface ParsedEmailTx {
  date: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  merchant?: string;
  cardLast4?: string;
  source: string;
  originalCategory?: string;
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  suggestedAccountId?: string;
}

interface ParsedEmail {
  messageId: string;
  subject: string;
  from: string;
  emailDate: string;
  bankName: string;
  cardLast4?: string;
  billSummary?: { totalAmount: number; billPeriod?: string; dueDate?: string };
  transactions: ParsedEmailTx[];
}

interface FetchResult {
  emails: ParsedEmail[];
  errors: string[];
  skippedCount: number;
}

interface CardMapping {
  id: string;
  bankName: string;
  cardLast4?: string;
  accountId: string;
  account: { id: string; name: string; accountType: string };
}

type ImportFormat = 'auto' | 'csv' | 'alipay' | 'wechat' | 'wechat_xlsx';

interface FormatOption {
  label: string;
  value: ImportFormat;
  description: string;
  accept: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    label: '自动检测',
    value: 'auto',
    description: '根据文件内容自动识别格式（支持 支付宝/微信/通用CSV/XLSX）',
    accept: '.csv,.xlsx',
  },
  {
    label: '支付宝',
    value: 'alipay',
    description: '支付宝账单 CSV 文件（从支付宝 App 或网页端导出）',
    accept: '.csv',
  },
  {
    label: '微信支付 (CSV)',
    value: 'wechat',
    description: '微信支付账单 CSV 文件（从微信 App 导出）',
    accept: '.csv',
  },
  {
    label: '微信支付 (XLSX)',
    value: 'wechat_xlsx',
    description: '微信支付账单 XLSX 文件（从微信申请的账单流水文件）',
    accept: '.xlsx',
  },
  {
    label: '通用 CSV',
    value: 'csv',
    description: '标准 CSV 格式，需包含日期、金额、描述等字段',
    accept: '.csv',
  },
];

const ImportPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [format, setFormat] = useState<ImportFormat>('auto');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const selectedFormat = FORMAT_OPTIONS.find((f) => f.value === format)!;

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }

    const file = fileList[0];
    if (!file.originFileObj) {
      message.error('文件读取失败，请重新选择');
      return;
    }

    const formData = new FormData();
    formData.append('file', file.originFileObj);

    setUploading(true);
    setResult(null);

    try {
      const data = await apiService.post<ImportResult>(
        `/import/upload?format=${format}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setResult(data);
      setFileList([]);

      if (data.imported > 0) {
        message.success(`成功导入 ${data.imported} 条交易`);
      } else if (data.skipped > 0) {
        message.info(`${data.skipped} 条记录被跳过（可能是重复数据）`);
      } else {
        message.warning('未导入任何交易');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.error || '导入失败，请检查文件格式');
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await apiService.get('/export?format=csv', {
        responseType: 'blob',
      });
      const blob = new Blob([response as any], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookkeeping_export_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      const fileName = file.name.toLowerCase();
      const isValidFormat = fileName.endsWith('.csv') || fileName.endsWith('.xlsx');
      if (!isValidFormat) {
        message.error('只支持 CSV 或 XLSX 格式文件');
        return Upload.LIST_IGNORE;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过 10MB');
        return Upload.LIST_IGNORE;
      }
      setFileList([{ ...file, originFileObj: file } as any]);
      return false;
    },
    fileList,
    onRemove: () => {
      setFileList([]);
    },
    maxCount: 1,
    accept: selectedFormat.accept,
  };

  const columns: ColumnsType<Transaction> = [
    {
      title: '日期',
      dataIndex: 'transactionDate',
      key: 'transactionDate',
      width: isMobile ? 70 : 100,
      render: (d: string) => dayjs(d).format(isMobile ? 'MM/DD' : 'YYYY-MM-DD'),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    ...(isMobile
      ? []
      : [
          {
            title: '类型' as const,
            key: 'type' as const,
            width: 64,
            render: (_: any, r: Transaction) => {
              const t = getTransactionType(r);
              return (
                <Tag color={t.color} style={{ margin: 0, fontSize: 11 }}>
                  {t.label}
                </Tag>
              );
            },
          },
        ]),
    {
      title: '金额',
      key: 'amount',
      width: isMobile ? 90 : 110,
      align: 'right' as const,
      render: (_: any, r: Transaction) => {
        const t = getTransactionType(r);
        const dTotal =
          r.entries
            ?.filter((e) => e.entryType === 'debit')
            .reduce((s, e) => s + parseFloat(e.amount), 0) || 0;
        return (
          <span style={{ color: t.color, fontWeight: 600, fontSize: 13 }}>
            {t.sign}
            {formatAmount(dTotal)}
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 56 : 72,
      render: (s: string) => {
        const cm: Record<string, string> = { draft: 'default', posted: 'green', void: 'red' };
        const lm: Record<string, string> = { draft: '草稿', posted: '已记账', void: '已作废' };
        return (
          <Tag color={cm[s] || 'default'} style={{ fontSize: 11 }}>
            {lm[s] || s}
          </Tag>
        );
      },
    },
  ];

  // ===== Email Import State =====
  const EMAIL_PRESETS = [
    { label: 'QQ邮箱', host: 'imap.qq.com', port: 993, secure: true, hint: '需使用授权码，非QQ密码' },
    { label: '163邮箱', host: 'imap.163.com', port: 993, secure: true, hint: '需开启IMAP并获取授权码' },
    { label: 'Gmail', host: 'imap.gmail.com', port: 993, secure: true, hint: '需开启应用专用密码' },
    { label: 'Outlook', host: 'outlook.office365.com', port: 993, secure: true, hint: '' },
    { label: '自定义', host: '', port: 993, secure: true, hint: '' },
  ];

  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [emailConfigLoading, setEmailConfigLoading] = useState(false);
  const [emailForm] = Form.useForm();
  const [testingConnection, setTestingConnection] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('QQ邮箱');
  const [showConfigForm, setShowConfigForm] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [fetchedEmails, setFetchedEmails] = useState<ParsedEmail[]>([]);
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const [fetchSkippedCount, setFetchSkippedCount] = useState(0);
  const [selectedTxKeys, setSelectedTxKeys] = useState<Record<string, React.Key[]>>({});
  const [excludedEmails, setExcludedEmails] = useState<Set<string>>(new Set());
  const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});
  const [rememberMappings, setRememberMappings] = useState<Record<string, boolean>>({});
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [previewEmails, setPreviewEmails] = useState<ParsedEmail[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importingEmails, setImportingEmails] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [savedMappings, setSavedMappings] = useState<CardMapping[]>([]);
  const [quickImporting, setQuickImporting] = useState(false);
  const [fetchSince, setFetchSince] = useState<dayjs.Dayjs | null>(null);
  const [fetchLimit, setFetchLimit] = useState<number>(100);

  const fetchEmailConfig = useCallback(async () => {
    try {
      const data = await apiService.get<EmailConfig | null>('/email-config');
      setEmailConfig(data);
      if (data) {
        emailForm.setFieldsValue({ host: data.host, port: data.port, secure: data.secure, email: data.email, password: '' });
        // Detect preset from host
        const matchedPreset = EMAIL_PRESETS.find((p) => p.host === data.host && p.label !== '自定义');
        setSelectedPreset(matchedPreset ? matchedPreset.label : '自定义');
        if (data.lastFetch) {
          setFetchSince(dayjs(data.lastFetch));
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailForm]);

  const fetchAuxData = useCallback(async () => {
    try {
      const [accs, cats] = await Promise.all([
        apiService.get<Account[]>('/accounts'),
        apiService.get<Category[]>('/categories'),
      ]);
      setAccounts(accs);
      setCategories(cats);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchEmailConfig();
    fetchAuxData();
  }, [fetchEmailConfig, fetchAuxData]);

  // Load saved mappings on mount
  useEffect(() => {
    const loadMappings = async () => {
      try {
        const data = await apiService.get<CardMapping[]>('/card-mappings');
        setSavedMappings(data);
      } catch { /* ignore */ }
    };
    loadMappings();
  }, []);

  const handlePresetChange = (presetLabel: string) => {
    setSelectedPreset(presetLabel);
    const preset = EMAIL_PRESETS.find((p) => p.label === presetLabel);
    if (preset && preset.label !== '自定义') {
      emailForm.setFieldsValue({ host: preset.host, port: preset.port, secure: preset.secure });
    }
  };

  const handleSaveEmailConfig = async (values: { host: string; port: number; secure: boolean; email: string; password: string }) => {
    setEmailConfigLoading(true);
    try {
      const data = await apiService.post<EmailConfig>('/email-config', values);
      setEmailConfig(data);
      setShowConfigForm(false);
      message.success('邮箱配置已保存');
    } catch (error: unknown) {
      const msg = (error as any)?.response?.data?.error?.message || '保存失败';
      message.error(msg);
    } finally {
      setEmailConfigLoading(false);
    }
  };

  const handleDeleteEmailConfig = async () => {
    try {
      await apiService.delete('/email-config');
      setEmailConfig(null);
      emailForm.resetFields();
      setShowConfigForm(false);
      message.success('邮箱配置已删除');
    } catch { message.error('删除失败'); }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const data = await apiService.post<{ success: boolean; message: string }>('/email-config/test');
      message.success(data.message || '连接成功');
    } catch (error: unknown) {
      const msg = (error as any)?.response?.data?.error?.message || '连接失败';
      message.error(msg);
    } finally {
      setTestingConnection(false);
    }
  };

  // Fetch emails with params
  const handleFetchEmails = async () => {
    setFetchingEmails(true);
    setFetchedEmails([]);
    setFetchErrors([]);
    setFetchSkippedCount(0);
    try {
      const params: Record<string, any> = {};
      if (fetchLimit) params.limit = fetchLimit;
      if (fetchSince) params.since = fetchSince.toISOString();
      const data = await apiService.get<FetchResult>('/email-import/fetch', { params });
      setFetchedEmails(data.emails);
      setFetchErrors(data.errors);
      setFetchSkippedCount(data.skippedCount);
      // Initialize selection: all transactions selected per email
      const keys: Record<string, React.Key[]> = {};
      data.emails.forEach((email) => {
        keys[email.messageId] = email.transactions.map((_, i) => `${email.messageId}_${i}`);
      });
      setSelectedTxKeys(keys);
      setExcludedEmails(new Set());
      if (data.emails.length === 0) message.info('未找到可识别的账单邮件');
      else message.success(`识别到 ${data.emails.length} 封邮件`);
      fetchEmailConfig();
    } catch (error: unknown) {
      const msg = (error as any)?.response?.data?.error?.message || '拉取邮件失败';
      message.error(msg);
    } finally {
      setFetchingEmails(false);
    }
  };

  // Load mappings and preview
  const handleLoadMappingsAndPreview = async () => {
    setPreviewLoading(true);
    try {
      const [mappingsData, previewData] = await Promise.all([
        apiService.get<CardMapping[]>('/card-mappings'),
        apiService.post<{ emails: ParsedEmail[] }>('/email-import/preview', { emails: getActiveEmails() }),
      ]);
      setSavedMappings(mappingsData);
      setPreviewEmails(previewData.emails);

      // Auto-fill account mappings from saved mappings
      const autoMappings: Record<string, string> = {};
      const autoRemember: Record<string, boolean> = {};
      mappingsData.forEach((m) => {
        const key = makeMappingKey(m.bankName, m.cardLast4);
        autoMappings[key] = m.accountId;
        autoRemember[key] = true;
      });
      setAccountMappings((prev) => ({ ...autoMappings, ...prev }));
      setRememberMappings((prev) => ({ ...autoRemember, ...prev }));

      // Auto-fill category overrides from preview suggestions
      const overrides: Record<string, string> = {};
      previewData.emails.forEach((email) => {
        email.transactions.forEach((tx, i) => {
          const txKey = `${email.messageId}_${i}`;
          if (tx.suggestedCategoryId) {
            overrides[txKey] = tx.suggestedCategoryId;
          }
        });
      });
      setCategoryOverrides((prev) => ({ ...overrides, ...prev }));
    } catch (error: unknown) {
      const msg = (error as any)?.response?.data?.error?.message || '加载映射/预览失败';
      message.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirm import
  const handleConfirmImport = async () => {
    setImportingEmails(true);
    try {
      // Save new mappings
      const mappingPromises: Promise<any>[] = [];
      Object.entries(rememberMappings).forEach(([key, shouldRemember]) => {
        if (shouldRemember && accountMappings[key]) {
          const existing = savedMappings.find((m) => makeMappingKey(m.bankName, m.cardLast4) === key);
          if (!existing || existing.accountId !== accountMappings[key]) {
            const [bankName, cardLast4] = key.split('|');
            mappingPromises.push(
              apiService.post('/card-mappings', {
                bankName,
                cardLast4: cardLast4 || undefined,
                accountId: accountMappings[key],
              }),
            );
          }
        }
      });
      await Promise.all(mappingPromises);

      // Build confirm payload using preview data (has importedId etc.)
      const sourceEmails = previewEmails.length > 0 ? previewEmails : getActiveEmails();
      const emailPayload = sourceEmails
        .filter((e) => !excludedEmails.has(e.messageId))
        .map((email) => {
          const mappingKey = makeMappingKey(email.bankName, email.cardLast4);
          const accountId = accountMappings[mappingKey] || '';
          const selectedKeys = selectedTxKeys[email.messageId] || [];
          const transactions = email.transactions
            .map((tx: any, i: number) => {
              const txKey = `${email.messageId}_${i}`;
              if (!selectedKeys.includes(txKey)) return null;

              // For transfer (还款): accountId = asset account (转出方), targetAccountId = liability (信用卡)
              const isTransfer = tx.type === 'transfer';
              // tx.accountId = asset account (from preview), tx.targetAccountId = liability (mapped credit card)
              const txAccountId = isTransfer
                ? (tx.accountId || tx.suggestedAccountId || '')
                : accountId;
              const txTargetAccountId = isTransfer
                ? (tx.targetAccountId || accountId)
                : undefined;

              return {
                date: tx.date,
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                categoryId: categoryOverrides[txKey] || tx.suggestedCategoryId || tx.categoryId || undefined,
                accountId: txAccountId,
                targetAccountId: txTargetAccountId,
                importedId: tx.importedId || `email_${email.messageId}_${i}`,
              };
            })
            .filter(Boolean);
          return {
            messageId: email.messageId,
            subject: email.subject || '',
            bankName: email.bankName,
            cardLast4: email.cardLast4,
            transactions,
          };
        });

      const data = await apiService.post<{ imported: number; skipped: number; failed: number }>(
        '/email-import/confirm',
        { emails: emailPayload },
      );
      setImportResult(data);
      message.success(`成功导入 ${data.imported} 条交易`);
    } catch (error: unknown) {
      const msg = (error as any)?.response?.data?.error?.message || '导入失败';
      message.error(msg);
    } finally {
      setImportingEmails(false);
    }
  };

  // Quick import
  const handleQuickImport = async () => {
    setQuickImporting(true);
    try {
      // 1. Fetch emails
      const fetchData = await apiService.get<FetchResult>('/email-import/fetch', { params: { limit: 100 } });
      if (fetchData.emails.length === 0) {
        message.info('没有新的邮件账单');
        return;
      }

      // 2. Preview (get mappings and classification suggestions)
      const [mappings, previewData] = await Promise.all([
        apiService.get<CardMapping[]>('/card-mappings'),
        apiService.post<{ emails: ParsedEmail[] }>('/email-import/preview', { emails: fetchData.emails }),
      ]);

      // 3. Check if all cards have mappings
      const allBankCards = new Set<string>();
      fetchData.emails.forEach((e) => allBankCards.add(`${e.bankName}|${e.cardLast4 || ''}`));
      const mappedCards = new Set(mappings.map((m) => `${m.bankName}|${m.cardLast4 || ''}`));
      const unmapped = [...allBankCards].filter((c) => !mappedCards.has(c));

      if (unmapped.length > 0) {
        // Has unmapped cards, fall back to normal flow
        message.warning('部分银行卡需要首次映射，请完成映射后导入');
        setFetchedEmails(fetchData.emails);
        setFetchErrors(fetchData.errors);
        setFetchSkippedCount(fetchData.skippedCount);
        // Initialize selection
        const keys: Record<string, React.Key[]> = {};
        fetchData.emails.forEach((email) => {
          keys[email.messageId] = email.transactions.map((_, i) => `${email.messageId}_${i}`);
        });
        setSelectedTxKeys(keys);
        setExcludedEmails(new Set());
        // Load mappings and preview data
        setSavedMappings(mappings);
        setPreviewEmails(previewData.emails);
        const autoMappings: Record<string, string> = {};
        const autoRemember: Record<string, boolean> = {};
        mappings.forEach((m) => {
          const key = makeMappingKey(m.bankName, m.cardLast4);
          autoMappings[key] = m.accountId;
          autoRemember[key] = true;
        });
        setAccountMappings(autoMappings);
        setRememberMappings(autoRemember);
        // Auto-fill category overrides
        const overrides: Record<string, string> = {};
        previewData.emails.forEach((email) => {
          email.transactions.forEach((tx, i) => {
            const txKey = `${email.messageId}_${i}`;
            if (tx.suggestedCategoryId) overrides[txKey] = tx.suggestedCategoryId;
          });
        });
        setCategoryOverrides(overrides);
        setCurrentStep(1); // Jump to mapping step
        return;
      }

      // 4. All mapped, build payload and show confirm modal
      // Auto-fill mappings for confirm
      const autoMappings: Record<string, string> = {};
      const autoRemember: Record<string, boolean> = {};
      mappings.forEach((m) => {
        const key = makeMappingKey(m.bankName, m.cardLast4);
        autoMappings[key] = m.accountId;
        autoRemember[key] = true;
      });

      // Count stats
      let totalCount = 0;
      let totalExpense = 0;
      let totalIncome = 0;
      fetchData.emails.forEach((email) => {
        email.transactions.forEach((tx) => {
          totalCount++;
          if (tx.type === 'expense') totalExpense += tx.amount;
          else if (tx.type === 'income') totalIncome += tx.amount;
        });
      });

      // Set state for confirm
      setFetchedEmails(fetchData.emails);
      setSavedMappings(mappings);
      setPreviewEmails(previewData.emails);
      setAccountMappings(autoMappings);
      setRememberMappings(autoRemember);
      const keys: Record<string, React.Key[]> = {};
      fetchData.emails.forEach((email) => {
        keys[email.messageId] = email.transactions.map((_, i) => `${email.messageId}_${i}`);
      });
      setSelectedTxKeys(keys);
      setExcludedEmails(new Set());
      const overrides: Record<string, string> = {};
      previewData.emails.forEach((email) => {
        email.transactions.forEach((tx, i) => {
          const txKey = `${email.messageId}_${i}`;
          if (tx.suggestedCategoryId) overrides[txKey] = tx.suggestedCategoryId;
        });
      });
      setCategoryOverrides(overrides);

      Modal.confirm({
        title: '一键导入确认',
        content: (
          <div>
            <p>识别到 <strong>{fetchData.emails.length}</strong> 封邮件，共 <strong>{totalCount}</strong> 条交易</p>
            {totalExpense > 0 && <p>支出: <span style={{ color: '#ef4444', fontWeight: 600 }}>-{formatAmount(totalExpense)}</span></p>}
            {totalIncome > 0 && <p>收入: <span style={{ color: '#10b981', fontWeight: 600 }}>+{formatAmount(totalIncome)}</span></p>}
            <p style={{ color: '#64748b', fontSize: 12 }}>所有银行卡已有映射，分类将使用智能建议</p>
          </div>
        ),
        okText: '确认导入',
        cancelText: '取消',
        onOk: () => handleConfirmImport(),
      });
    } catch (error: unknown) {
      const msg = (error as any)?.response?.data?.error?.message || '一键导入失败';
      message.error(msg);
    } finally {
      setQuickImporting(false);
    }
  };

  // Reset wizard
  const resetWizard = () => {
    setCurrentStep(0);
    setFetchedEmails([]);
    setImportResult(null);
    setSelectedTxKeys({});
    setExcludedEmails(new Set());
    setAccountMappings({});
    setCategoryOverrides({});
    setPreviewEmails([]);
  };

  // Helper: get active (non-excluded) emails with selected transactions
  const getActiveEmails = useCallback(() => {
    return fetchedEmails.filter((e) => !excludedEmails.has(e.messageId));
  }, [fetchedEmails, excludedEmails]);

  // Helper: make mapping key
  const makeMappingKey = (bankName: string, cardLast4?: string) => `${bankName}|${cardLast4 || ''}`;

  // Helper: find tx by key from fetched emails
  const findTxByKey = useCallback((txKey: string): ParsedEmailTx | null => {
    for (const email of fetchedEmails) {
      for (let i = 0; i < email.transactions.length; i++) {
        if (`${email.messageId}_${i}` === txKey) return email.transactions[i];
      }
    }
    return null;
  }, [fetchedEmails]);

  // Helper: get all selected tx keys
  const getAllSelectedTxKeys = useCallback((): string[] => {
    const allKeys: string[] = [];
    getActiveEmails().forEach((email) => {
      const keys = selectedTxKeys[email.messageId] || [];
      keys.forEach((k) => allKeys.push(k as string));
    });
    return allKeys;
  }, [getActiveEmails, selectedTxKeys]);

  // Batch category change
  const handleCategoryChange = (txKey: string, categoryId: string, description: string) => {
    setCategoryOverrides((prev) => ({ ...prev, [txKey]: categoryId }));

    // Find same merchant transactions
    const merchant = description.split(' - ')[0].trim();
    const allKeys = getAllSelectedTxKeys();
    const sameMerchantKeys = allKeys.filter((key) => {
      const tx = findTxByKey(key);
      return tx && tx.description.split(' - ')[0].trim() === merchant && key !== txKey && !categoryOverrides[key];
    });

    if (sameMerchantKeys.length > 0) {
      Modal.confirm({
        title: '批量分类',
        content: `发现 ${sameMerchantKeys.length} 条相同商户的交易，是否统一分类？`,
        okText: '统一分类',
        cancelText: '仅此条',
        onOk: () => {
          const updates: Record<string, string> = {};
          sameMerchantKeys.forEach((k) => { updates[k] = categoryId; });
          setCategoryOverrides((prev) => ({ ...prev, ...updates }));
        },
      });
    }
  };

  // Computed: unique bank+card combos from active emails
  const uniqueBankCards = React.useMemo(() => {
    const seen = new Set<string>();
    const items: { bankName: string; cardLast4?: string; key: string }[] = [];
    getActiveEmails().forEach((email) => {
      const key = makeMappingKey(email.bankName, email.cardLast4);
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ bankName: email.bankName, cardLast4: email.cardLast4, key });
      }
    });
    return items;
  }, [getActiveEmails]);

  // Computed: total stats for active selected transactions
  const activeStats = React.useMemo(() => {
    let totalExpense = 0;
    let totalIncome = 0;
    let totalTransfer = 0;
    let expenseCount = 0;
    let incomeCount = 0;
    let transferCount = 0;
    let totalTxCount = 0;
    const byBank: Record<string, { expense: number; income: number; transfer: number; count: number }> = {};

    getActiveEmails().forEach((email) => {
      const keys = selectedTxKeys[email.messageId] || [];
      email.transactions.forEach((tx, i) => {
        const txKey = `${email.messageId}_${i}`;
        if (!keys.includes(txKey)) return;
        totalTxCount++;
        const bankKey = `${email.bankName}${email.cardLast4 ? ` *${email.cardLast4}` : ''}`;
        if (!byBank[bankKey]) byBank[bankKey] = { expense: 0, income: 0, transfer: 0, count: 0 };
        byBank[bankKey].count++;
        if (tx.type === 'expense') { totalExpense += tx.amount; expenseCount++; byBank[bankKey].expense += tx.amount; }
        else if (tx.type === 'income') { totalIncome += tx.amount; incomeCount++; byBank[bankKey].income += tx.amount; }
        else { totalTransfer += tx.amount; transferCount++; byBank[bankKey].transfer += tx.amount; }
      });
    });
    return { totalExpense, totalIncome, totalTransfer, expenseCount, incomeCount, transferCount, totalTxCount, byBank };
  }, [getActiveEmails, selectedTxKeys]);

  // Computed: classification stats
  const classificationStats = React.useMemo(() => {
    let classified = 0;
    let unclassified = 0;
    getActiveEmails().forEach((email) => {
      const keys = selectedTxKeys[email.messageId] || [];
      email.transactions.forEach((_, i) => {
        const txKey = `${email.messageId}_${i}`;
        if (!keys.includes(txKey)) return;
        if (categoryOverrides[txKey]) classified++;
        else unclassified++;
      });
    });
    return { classified, unclassified };
  }, [getActiveEmails, selectedTxKeys, categoryOverrides]);

  // Check if all bank cards are mapped
  const allMapped = React.useMemo(() => {
    return uniqueBankCards.every((bc) => accountMappings[bc.key]);
  }, [uniqueBankCards, accountMappings]);

  // ===== Render =====
  const fileImportTab = (
    <>
      <Row gutter={[16, 16]}>
        {/* 导入区域 */}
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={<span style={{ fontWeight: 600 }}>导入交易数据</span>}
            styles={{ body: { padding: isMobile ? 12 : 20 } }}
          >
            {/* 格式选择 */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                选择文件格式
              </Text>
              <Select
                value={format}
                onChange={(v) => {
                  setFormat(v);
                  setFileList([]);
                }}
                style={{ width: '100%' }}
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
              <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                {selectedFormat.description}
              </Text>
            </div>

            {/* 文件上传 */}
            <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#4f46e5' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域</p>
              <p className="ant-upload-hint">
                支持 CSV / XLSX 格式，文件大小不超过 10MB
              </p>
            </Dragger>

            {/* 上传按钮 */}
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={uploading}
              disabled={fileList.length === 0}
              onClick={handleUpload}
              style={{ width: '100%' }}
            >
              {uploading ? '导入中...' : '开始导入'}
            </Button>
          </Card>
        </Col>

        {/* 右侧：导出 + 格式说明 */}
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title={<span style={{ fontWeight: 600 }}>导出数据</span>}
            style={{ marginBottom: 16 }}
            styles={{ body: { padding: isMobile ? 12 : 20 } }}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
              将所有交易数据导出为 CSV 文件，可用于备份或在其他软件中使用。
            </Text>
            <Button
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={handleExport}
              block
            >
              导出 CSV
            </Button>
          </Card>

          <Card
            size="small"
            title={<span style={{ fontWeight: 600 }}>格式说明</span>}
            styles={{ body: { padding: isMobile ? 12 : 20 } }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {FORMAT_OPTIONS.map((opt) => (
                <div key={opt.value}>
                  <Text strong style={{ fontSize: 13 }}>
                    <FileTextOutlined style={{ marginRight: 6, color: '#4f46e5' }} />
                    {opt.label}
                  </Text>
                  <Text
                    type="secondary"
                    style={{ display: 'block', fontSize: 12, marginTop: 2, paddingLeft: 20 }}
                  >
                    {opt.description}
                  </Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 导入结果 (file import) */}
      {result && (
        <Card
          size="small"
          title={<span style={{ fontWeight: 600 }}>导入结果</span>}
          style={{ marginTop: 16 }}
          styles={{ body: { padding: isMobile ? 12 : 20 } }}
        >
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={8}>
              <Card styles={{ body: { padding: isMobile ? '8px 10px' : '12px 16px' } }}>
                <Statistic
                  title="成功导入"
                  value={result.imported}
                  suffix="条"
                  valueStyle={{ color: '#10b981', fontSize: isMobile ? 20 : 24 }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={8}>
              <Card styles={{ body: { padding: isMobile ? '8px 10px' : '12px 16px' } }}>
                <Statistic
                  title="跳过"
                  value={result.skipped}
                  suffix="条"
                  valueStyle={{ color: '#f59e0b', fontSize: isMobile ? 20 : 24 }}
                  prefix={<MinusCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={8}>
              <Card styles={{ body: { padding: isMobile ? '8px 10px' : '12px 16px' } }}>
                <Statistic
                  title="失败"
                  value={(result.failed || result.errors?.length || 0)}
                  suffix="条"
                  valueStyle={{ color: '#ef4444', fontSize: isMobile ? 20 : 24 }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {(result.failed || result.errors?.length || 0) > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${(result.failed || result.errors?.length || 0)} 条记录导入失败，请检查文件格式是否正确`}
              style={{ marginBottom: 16 }}
            />
          )}

          {result.transactions && result.transactions.length > 0 && (
            <>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                导入的交易明细
              </Text>
              <Table
                columns={columns}
                dataSource={result.transactions}
                rowKey="id"
                size="small"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showTotal: isMobile ? undefined : (t) => `共 ${t} 条记录`,
                  size: 'small',
                }}
                locale={{ emptyText: '暂无数据' }}
                scroll={isMobile ? { x: 400 } : undefined}
              />
            </>
          )}
        </Card>
      )}
    </>
  );

  // ===== Step renderers =====

  // Config form component (reused in Step 0)
  const renderConfigForm = () => {
    const currentPreset = EMAIL_PRESETS.find((p) => p.label === selectedPreset);
    const isCustom = selectedPreset === '自定义';

    return (
      <Card size="small" title={<span style={{ fontWeight: 600 }}><MailOutlined style={{ marginRight: 8 }} />邮箱配置</span>}
        styles={{ body: { padding: isMobile ? 12 : 20 } }}>
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="使用说明"
          description={<span style={{ fontSize: 12 }}>1. 创建一个专用邮箱用于接收账单<br/>2. 在下方配置该邮箱的 IMAP 信息<br/>3. 收到银行/支付邮件时手动转发到此邮箱<br/>4. 点击"拉取邮件"自动解析交易信息</span>}
        />
        <Form form={emailForm} layout="vertical" size="small" onFinish={handleSaveEmailConfig}
          initialValues={{ port: 993, secure: true }}>
          <Form.Item label="邮箱类型">
            <Select value={selectedPreset} onChange={handlePresetChange}>
              {EMAIL_PRESETS.map((p) => (
                <Option key={p.label} value={p.label}>{p.label}</Option>
              ))}
            </Select>
          </Form.Item>
          {isCustom && (
            <>
              <Form.Item label="IMAP 服务器" name="host" rules={[{ required: true, message: '请输入 IMAP 地址' }]}>
                <Input placeholder="如 imap.qq.com / imap.gmail.com" />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="端口" name="port"><InputNumber style={{ width: '100%' }} /></Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="SSL/TLS" name="secure" valuePropName="checked"><Switch /></Form.Item>
                </Col>
              </Row>
            </>
          )}
          {/* Hidden fields for non-custom presets */}
          {!isCustom && (
            <>
              <Form.Item name="host" hidden><Input /></Form.Item>
              <Form.Item name="port" hidden><InputNumber /></Form.Item>
              <Form.Item name="secure" hidden valuePropName="checked"><Switch /></Form.Item>
            </>
          )}
          <Form.Item label="邮箱地址" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input placeholder="your-bills@qq.com" />
          </Form.Item>
          <Form.Item label="密码/授权码" name="password" rules={[{ required: !emailConfig, message: '请输入密码' }]}>
            <Input.Password placeholder={emailConfig ? '留空保持不变' : '请输入密码或授权码'} />
          </Form.Item>
          {currentPreset?.hint && (
            <div style={{ marginTop: -12, marginBottom: 16, fontSize: 12, color: '#f59e0b' }}>
              {currentPreset.hint}
            </div>
          )}
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={emailConfigLoading}>保存配置</Button>
              {emailConfig && <Button icon={<DeleteOutlined />} danger onClick={handleDeleteEmailConfig}>删除</Button>}
            </Space>
            <Space>
              {emailConfig && <Button icon={<ApiOutlined />} loading={testingConnection} onClick={handleTestConnection}>测试连接</Button>}
              {emailConfig && showConfigForm && <Button onClick={() => setShowConfigForm(false)}>取消</Button>}
            </Space>
          </Space>
        </Form>
      </Card>
    );
  };

  // Email list rendering (reused in Step 0)
  const renderEmailList = () => {
    const catTagColors: Record<string, string> = { '消费': 'red', '还款': 'green', '分期': 'orange', '退款': 'cyan' };

    return (
      <>
        {/* Top stats */}
        <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
          <Col xs={8}>
            <Card size="small" styles={{ body: { padding: '8px 12px', textAlign: 'center' } }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>识别邮件</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#4f46e5' }}>{fetchedEmails.length}</div>
            </Card>
          </Col>
          <Col xs={8}>
            <Card size="small" styles={{ body: { padding: '8px 12px', textAlign: 'center' } }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>交易条数</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#4f46e5' }}>
                {fetchedEmails.reduce((s, e) => s + e.transactions.length, 0)}
              </div>
            </Card>
          </Col>
          <Col xs={8}>
            <Card size="small" styles={{ body: { padding: '8px 12px', textAlign: 'center' } }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>已跳过</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{fetchSkippedCount}</div>
            </Card>
          </Col>
        </Row>

        {fetchErrors.length > 0 && (
          <Alert type="warning" showIcon closable style={{ marginBottom: 12 }}
            message={`${fetchErrors.length} 封邮件解析失败`}
            description={fetchErrors.slice(0, 3).join('; ')}
          />
        )}

        {/* Collapse by email */}
        <Collapse
          defaultActiveKey={getActiveEmails().map((e) => e.messageId)}
          items={fetchedEmails.map((email) => {
            const isExcluded = excludedEmails.has(email.messageId);
            const emailSelectedKeys = selectedTxKeys[email.messageId] || [];
            const allKeys = email.transactions.map((_, i) => `${email.messageId}_${i}`);
            const allSelected = allKeys.length > 0 && allKeys.every((k) => emailSelectedKeys.includes(k));
            const someSelected = emailSelectedKeys.length > 0 && !allSelected;
            const txExpense = email.transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
            const txIncome = email.transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const detailTotal = email.transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
            const hasMismatch = email.billSummary && Math.abs(email.billSummary.totalAmount - detailTotal) > 0.01;

            const txColumns: ColumnsType<ParsedEmailTx & { _txKey: string }> = [
              {
                title: '日期', dataIndex: 'date', key: 'date', width: isMobile ? 70 : 100,
                sorter: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
                defaultSortOrder: 'descend',
                render: (d: string) => dayjs(d).format(isMobile ? 'MM/DD' : 'YYYY-MM-DD'),
              },
              {
                title: '描述', dataIndex: 'description', key: 'description', ellipsis: true,
                render: (desc: string, record) => (
                  <span>
                    {record.originalCategory && (
                      <Tag color={catTagColors[record.originalCategory] || 'default'} style={{ fontSize: 11 }}>
                        {record.originalCategory}
                      </Tag>
                    )}
                    {desc}
                  </span>
                ),
              },
              {
                title: '金额', dataIndex: 'amount', key: 'amount', width: isMobile ? 90 : 110, align: 'right',
                sorter: (a, b) => a.amount - b.amount,
                render: (v: number, r) => {
                  const color = r.type === 'income' ? '#10b981' : r.type === 'transfer' ? '#1677ff' : '#ef4444';
                  const sign = r.type === 'income' ? '+' : r.type === 'transfer' ? '' : '-';
                  return <span style={{ color, fontWeight: 600, fontSize: 13 }}>{sign}{formatAmount(v)}</span>;
                },
              },
              ...(!isMobile ? [{
                title: '卡号' as const, dataIndex: 'cardLast4' as const, key: 'cardLast4', width: 70,
                render: (v: string) => v ? <span style={{ color: '#94a3b8', fontSize: 12 }}>*{v}</span> : '-',
              }] : []),
            ];

            return {
              key: email.messageId,
              collapsible: isExcluded ? ('disabled' as const) : undefined,
              label: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 8 }}>
                  <Space>
                    <Checkbox
                      checked={!isExcluded && allSelected}
                      indeterminate={!isExcluded && someSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (isExcluded) {
                          setExcludedEmails((prev) => { const n = new Set(prev); n.delete(email.messageId); return n; });
                        }
                        setSelectedTxKeys((prev) => ({
                          ...prev,
                          [email.messageId]: (allSelected) ? [] : allKeys,
                        }));
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <BankOutlined style={{ color: '#4f46e5' }} />
                    <Text strong>{email.bankName}{email.cardLast4 ? ` *${email.cardLast4}` : ''}</Text>
                  </Space>
                  <Space size={16}>
                    <Tag color="blue">{email.transactions.length} 条明细</Tag>
                    {email.billSummary && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        账单: {formatAmount(email.billSummary.totalAmount)}
                      </Text>
                    )}
                    <Text style={{ fontWeight: 600, color: '#ef4444' }}>-{formatAmount(txExpense)}</Text>
                    {txIncome > 0 && <Text style={{ fontWeight: 600, color: '#10b981' }}>+{formatAmount(txIncome)}</Text>}
                    <Button
                      size="small"
                      danger={!isExcluded}
                      type={isExcluded ? 'primary' : 'text'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExcludedEmails((prev) => {
                          const n = new Set(prev);
                          if (isExcluded) n.delete(email.messageId);
                          else n.add(email.messageId);
                          return n;
                        });
                      }}
                    >
                      {isExcluded ? '恢复' : '排除'}
                    </Button>
                  </Space>
                </div>
              ),
              style: isExcluded ? { opacity: 0.5 } : undefined,
              children: isExcluded ? (
                <Alert type="info" message="该邮件已被排除，不会导入" />
              ) : (
                <>
                  {email.billSummary && (
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message={
                        <span>
                          本期应还: <Text strong>{formatAmount(email.billSummary.totalAmount)}</Text>
                          {email.billSummary.billPeriod && <span style={{ marginLeft: 16 }}>账单周期: {email.billSummary.billPeriod}</span>}
                          {email.billSummary.dueDate && <span style={{ marginLeft: 16 }}>还款日: {dayjs(email.billSummary.dueDate).format('YYYY-MM-DD')}</span>}
                        </span>
                      }
                    />
                  )}
                  <Table
                    rowSelection={{
                      selectedRowKeys: emailSelectedKeys,
                      onChange: (keys) => setSelectedTxKeys((prev) => ({ ...prev, [email.messageId]: keys })),
                    }}
                    columns={txColumns}
                    dataSource={email.transactions.map((tx, i) => ({ ...tx, _txKey: `${email.messageId}_${i}`, key: `${email.messageId}_${i}` }))}
                    size="small"
                    pagination={email.transactions.length > 20 ? { pageSize: 20, showTotal: (t) => `共 ${t} 条` } : false}
                    scroll={isMobile ? { x: 400 } : undefined}
                    summary={() => {
                      const selKeys = emailSelectedKeys;
                      const selTxs = email.transactions.filter((_, i) => selKeys.includes(`${email.messageId}_${i}`));
                      const selTotal = selTxs.reduce((s, t) => s + t.amount, 0);
                      return (
                        <Table.Summary>
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={isMobile ? 3 : 4}>
                              <Space>
                                <Text type="secondary">已选 {selKeys.length} / {email.transactions.length} 条</Text>
                                <Text strong>合计: {formatAmount(selTotal)}</Text>
                                {hasMismatch && (
                                  <Tag color="warning" icon={<WarningOutlined />}>
                                    与账单差异: {formatAmount(Math.abs((email.billSummary?.totalAmount || 0) - selTotal))}
                                  </Tag>
                                )}
                              </Space>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        </Table.Summary>
                      );
                    }}
                  />
                </>
              ),
            };
          })}
        />
      </>
    );
  };

  // Step 0: Fetch & Select
  const renderStep0 = () => (
    <>
      {/* Config section */}
      {emailConfig && !showConfigForm ? (
        // Compact summary when configured
        <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
              <Space size={4}>
                <MailOutlined style={{ color: '#4f46e5' }} />
                <Text strong>{emailConfig.email}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                上次拉取: {emailConfig.lastFetch ? dayjs(emailConfig.lastFetch).format('YYYY-MM-DD HH:mm') : '从未'}
              </Text>
            </Space>
            <Space>
              <Button size="small" icon={<EditOutlined />} onClick={() => setShowConfigForm(true)}>修改配置</Button>
              <Button size="small" icon={<DeleteOutlined />} danger onClick={handleDeleteEmailConfig}>删除配置</Button>
            </Space>
          </div>
        </Card>
      ) : (
        // Show full config form
        <div style={{ marginBottom: 16 }}>
          {renderConfigForm()}
        </div>
      )}

      {/* Fetch control area */}
      {emailConfig && !showConfigForm && (
        <Card size="small" title={<span style={{ fontWeight: 600 }}><SyncOutlined /> 拉取邮件</span>}
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: isMobile ? 12 : 20 } }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 0 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>开始日期</Text>
              <DatePicker
                value={fetchSince}
                onChange={(date) => setFetchSince(date)}
                placeholder="选择开始日期"
                size="middle"
                style={{ width: 160 }}
              />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>数量限制</Text>
              <Select value={fetchLimit} onChange={setFetchLimit} style={{ width: 100 }} size="middle">
                <Option value={50}>50 封</Option>
                <Option value={100}>100 封</Option>
                <Option value={200}>200 封</Option>
              </Select>
            </div>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              loading={fetchingEmails}
              onClick={handleFetchEmails}
              size="middle"
            >
              {fetchingEmails ? '拉取中...' : '拉取邮件'}
            </Button>
            {emailConfig && savedMappings.length > 0 && (
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={quickImporting}
                onClick={handleQuickImport}
                size="middle"
                style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
              >
                一键导入
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Show config form when editing */}
      {emailConfig && showConfigForm && (
        <div style={{ marginBottom: 16 }}>
          {renderConfigForm()}
        </div>
      )}

      {/* Email list (shown inline after fetch) */}
      {fetchedEmails.length > 0 && renderEmailList()}
    </>
  );

  // Step 1: Mapping, Classification & Confirm
  const renderStep1 = () => {
    const emailsToShow = previewEmails.length > 0 ? previewEmails : getActiveEmails();

    return (
      <>
        {/* Import result */}
        {importResult && (
          <Result
            status="success"
            title="导入完成"
            subTitle={`成功导入 ${importResult.imported} 条，跳过 ${importResult.skipped} 条`}
            extra={[
              <Button key="new" onClick={resetWizard}>开始新的导入</Button>,
              <Button key="view" type="primary" onClick={() => { window.location.href = '/transactions'; }}>查看交易</Button>,
            ]}
          />
        )}

        {!importResult && (
          <>
            {/* Account Mapping Section */}
            <Card
              size="small"
              title={<span style={{ fontWeight: 600 }}><BankOutlined style={{ marginRight: 8 }} />账户映射</span>}
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: isMobile ? 12 : 20 } }}
            >
              {uniqueBankCards.length === 0 ? (
                <Empty description="无银行卡需要映射" />
              ) : (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {uniqueBankCards.map((bc) => {
                    const mapped = accountMappings[bc.key];
                    return (
                      <div key={bc.key} style={{
                        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                        padding: '8px 12px', background: mapped ? '#f0fdf4' : '#fef2f2', borderRadius: 6,
                        border: `1px solid ${mapped ? '#bbf7d0' : '#fecaca'}`,
                      }}>
                        <Space>
                          <BankOutlined style={{ color: '#4f46e5', fontSize: 16 }} />
                          <Text strong>{bc.bankName}</Text>
                          {bc.cardLast4 && <Text type="secondary">*{bc.cardLast4}</Text>}
                        </Space>
                        <span style={{ color: '#94a3b8' }}>&rarr;</span>
                        <Select
                          value={mapped || undefined}
                          onChange={(v) => setAccountMappings((prev) => ({ ...prev, [bc.key]: v }))}
                          placeholder="选择账户"
                          style={{ minWidth: 180, flex: 1 }}
                          size="small"
                          status={mapped ? undefined : 'warning'}
                        >
                          {accounts
                            .filter((a) => a.accountType === 'asset' || a.accountType === 'liability')
                            .map((a) => (
                              <Option key={a.id} value={a.id}>
                                <Tag color={a.accountType === 'asset' ? 'green' : 'orange'} style={{ fontSize: 10, marginRight: 4 }}>
                                  {a.accountType === 'asset' ? '资产' : '负债'}
                                </Tag>
                                {a.name}
                              </Option>
                            ))}
                        </Select>
                        <Checkbox
                          checked={rememberMappings[bc.key] || false}
                          onChange={(e) => setRememberMappings((prev) => ({ ...prev, [bc.key]: e.target.checked }))}
                        >
                          <Text style={{ fontSize: 12 }}>记住</Text>
                        </Checkbox>
                        {!mapped && <Tag color="warning" icon={<WarningOutlined />}>未映射</Tag>}
                      </div>
                    );
                  })}
                </Space>
              )}
            </Card>

            {/* Category Preview Section */}
            <Card
              size="small"
              title={
                <span style={{ fontWeight: 600 }}>
                  分类预览
                  {previewLoading && <SyncOutlined spin style={{ marginLeft: 8 }} />}
                </span>
              }
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {classificationStats.classified} 条已分类 / {classificationStats.unclassified} 条未分类
                </Text>
              }
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: isMobile ? 12 : 20 } }}
            >
              {previewLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <SyncOutlined spin style={{ fontSize: 24, color: '#4f46e5' }} />
                  <div style={{ marginTop: 8, color: '#64748b' }}>正在加载分类建议...</div>
                </div>
              ) : (
                <Collapse
                  size="small"
                  items={emailsToShow.map((email) => {
                    const emailSelectedKeys = selectedTxKeys[email.messageId] || [];
                    return {
                      key: email.messageId,
                      label: (
                        <Space>
                          <BankOutlined />
                          <Text strong>{email.bankName}{email.cardLast4 ? ` *${email.cardLast4}` : ''}</Text>
                          <Tag color="blue">{emailSelectedKeys.length} 条已选</Tag>
                        </Space>
                      ),
                      children: (() => {
                        type TxRow = ParsedEmailTx & { _txKey: string; key: string };
                        const classifyColumns: ColumnsType<TxRow> = [
                          {
                            title: '描述', dataIndex: 'description', key: 'description', ellipsis: true,
                            render: (desc: string) => <Text style={{ fontSize: 12 }}>{desc}</Text>,
                          },
                          {
                            title: '金额', dataIndex: 'amount', key: 'amount', width: 100, align: 'right',
                            render: (v: number, r) => {
                              const color = r.type === 'income' ? '#10b981' : r.type === 'transfer' ? '#1677ff' : '#ef4444';
                              return <span style={{ color, fontWeight: 600 }}>{formatAmount(v)}</span>;
                            },
                          },
                          {
                            title: '分类', key: 'category', width: isMobile ? 120 : 180,
                            render: (_: any, record) => {
                              const override = categoryOverrides[record._txKey];
                              return (
                                <Space size={4}>
                                  {override ? (
                                    <CheckCircleOutlined style={{ color: '#10b981', fontSize: 12 }} />
                                  ) : (
                                    <QuestionCircleOutlined style={{ color: '#f59e0b', fontSize: 12 }} />
                                  )}
                                  <Select
                                    value={override || undefined}
                                    onChange={(v) => handleCategoryChange(record._txKey, v, record.description)}
                                    placeholder="选择分类"
                                    size="small"
                                    style={{ width: isMobile ? 90 : 140 }}
                                    allowClear
                                    onClear={() => setCategoryOverrides((prev) => {
                                      const next = { ...prev };
                                      delete next[record._txKey];
                                      return next;
                                    })}
                                  >
                                    {categories
                                      .filter((c) => c.type === record.type || c.type === 'expense')
                                      .map((c) => (
                                        <Option key={c.id} value={c.id}>{c.name}</Option>
                                      ))}
                                  </Select>
                                </Space>
                              );
                            },
                          },
                        ];
                        return (
                          <Table<TxRow>
                            size="small"
                            dataSource={email.transactions
                              .map((tx, i) => ({ ...tx, _txKey: `${email.messageId}_${i}`, key: `${email.messageId}_${i}` }))
                              .filter((tx) => emailSelectedKeys.includes(tx._txKey))
                            }
                            pagination={false}
                            scroll={isMobile ? { x: 500 } : undefined}
                            columns={classifyColumns}
                          />
                        );
                      })(),
                    };
                  })}
                />
              )}
            </Card>

            {/* Summary & Confirm Section */}
            <Card size="small" title={<span style={{ fontWeight: 600 }}>汇总确认</span>}
              styles={{ body: { padding: isMobile ? 16 : 24 } }}>
              {/* Summary by type */}
              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col xs={8}>
                  <Card size="small" styles={{ body: { padding: '12px 16px', textAlign: 'center', background: '#fef2f2' } }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{activeStats.expenseCount} 笔支出</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{formatAmount(activeStats.totalExpense)}</div>
                  </Card>
                </Col>
                <Col xs={8}>
                  <Card size="small" styles={{ body: { padding: '12px 16px', textAlign: 'center', background: '#f0fdf4' } }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{activeStats.incomeCount} 笔收入(退款)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{formatAmount(activeStats.totalIncome)}</div>
                  </Card>
                </Col>
                <Col xs={8}>
                  <Card size="small" styles={{ body: { padding: '12px 16px', textAlign: 'center', background: '#eff6ff' } }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{activeStats.transferCount} 笔转账(还款)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>{formatAmount(activeStats.totalTransfer)}</div>
                  </Card>
                </Col>
              </Row>

              {/* By bank summary */}
              {Object.keys(activeStats.byBank).length > 0 && (
                <Card size="small" title="按银行汇总" style={{ marginBottom: 16 }}>
                  {Object.entries(activeStats.byBank).map(([bank, data]) => (
                    <div key={bank} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <Space>
                        <BankOutlined style={{ color: '#4f46e5' }} />
                        <Text strong>{bank}</Text>
                        <Text type="secondary">({data.count} 条)</Text>
                      </Space>
                      <Space size={16}>
                        {data.expense > 0 && <Text style={{ color: '#ef4444' }}>-{formatAmount(data.expense)}</Text>}
                        {data.income > 0 && <Text style={{ color: '#10b981' }}>+{formatAmount(data.income)}</Text>}
                        {data.transfer > 0 && <Text style={{ color: '#1677ff' }}>{formatAmount(data.transfer)}</Text>}
                      </Space>
                    </div>
                  ))}
                </Card>
              )}

              {/* Mapping warnings */}
              {!allMapped && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="存在未映射的银行卡，请在上方完成映射"
                />
              )}

              <Button
                type="primary"
                block
                size="large"
                loading={importingEmails}
                disabled={!allMapped || activeStats.totalTxCount === 0}
                onClick={handleConfirmImport}
                icon={<CheckCircleOutlined />}
              >
                确认导入 {activeStats.totalTxCount} 条交易
              </Button>
            </Card>
          </>
        )}
      </>
    );
  };

  // Step navigation
  const canGoNext = () => {
    switch (currentStep) {
      case 0: return fetchedEmails.length > 0 && Object.values(selectedTxKeys).some((keys) => keys.length > 0);
      default: return false;
    }
  };

  const handleStepNext = () => {
    if (currentStep === 0) {
      handleLoadMappingsAndPreview();
      setCurrentStep(1);
    }
  };

  const handleStepPrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const emailImportTab = (
    <div>
      <Steps
        current={currentStep}
        style={{ marginBottom: 24 }}
        size={isMobile ? 'small' : 'default'}
        items={[
          { title: '拉取与选择', icon: <MailOutlined /> },
          { title: '映射分类与确认', icon: <CheckCircleOutlined /> },
        ]}
        onChange={(step) => {
          if (step <= currentStep) {
            if (step === 1 && currentStep === 0) {
              handleLoadMappingsAndPreview();
            }
            setCurrentStep(step);
          }
        }}
      />

      <div style={{ minHeight: 300 }}>
        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
      </div>

      {/* Navigation buttons */}
      {!importResult && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleStepPrev}
            disabled={currentStep === 0}
          >
            上一步
          </Button>
          {currentStep === 0 && (
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={handleStepNext}
              disabled={!canGoNext()}
            >
              下一步
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <h1 className="page-title">数据导入</h1>
      <Tabs defaultActiveKey="file" items={[
        { key: 'file', label: <span><FileTextOutlined /> 文件导入</span>, children: fileImportTab },
        { key: 'email', label: <span><MailOutlined /> 邮件导入</span>, children: emailImportTab },
      ]} />
    </div>
  );
};

export default ImportPage;
