// User Types
export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Account Types
export type AccountType = 'asset' | 'liability' | 'income' | 'expense';
export type AccountSubtype = 'cash' | 'checking' | 'credit_card' | 'savings' | 'investment' | 'debt' | 'receivables' | 'virtual';

export interface Account {
  id: string;
  userId: string;
  name: string;
  accountType: AccountType;
  subtype?: AccountSubtype;
  currency?: string;
  parentId?: string;
  icon?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountCreateRequest {
  name: string;
  accountType: AccountType;
  subtype?: AccountSubtype;
  currency?: string;
  parentId?: string;
  icon?: string;
}

// Category Types
export type CategoryType = 'income' | 'expense' | 'transfer';

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon?: string;
  isSystem: boolean;
  sortOrder: number;
}

export interface CategoryCreateRequest {
  name: string;
  type: CategoryType;
  icon?: string;
}

// Transaction Types
export type TransactionStatus = 'draft' | 'posted' | 'void';
export type EntryType = 'debit' | 'credit';

export interface TransactionEntry {
  id: string;
  transactionId: string;
  accountId: string;
  entryType: EntryType;
  amount: string;
  description?: string;
  lineNo: number;
  account?: {
    id: string;
    name: string;
    accountType: string;
  };
}

export interface TransactionTagRelation {
  transactionId: string;
  tagId: string;
  tag: Tag;
}

export interface Transaction {
  id: string;
  userId: string;
  transactionDate: string;
  description?: string;
  categoryId?: string;
  status: TransactionStatus;
  entries: TransactionEntry[];
  category?: Category;
  tags?: TransactionTagRelation[];
  createdAt: string;
  updatedAt: string;
}

export interface TransactionCreateRequest {
  date: string;
  description?: string;
  entries: {
    accountId: string;
    entryType: EntryType;
    amount: number;
    description?: string;
  }[];
}

export interface QuickEntryRequest {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  categoryId?: string;
  description?: string;
  date?: string;
}

// Report Types
export interface BalanceSheetData {
  asOfDate: string;
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface AccountBalance {
  accountId: string;
  accountName: string;
  balance: number;
  accountType: AccountType;
}

export interface IncomeExpenseData {
  period: {
    startDate: string;
    endDate: string;
  };
  income: CategorySummary[];
  expenses: CategorySummary[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
}

// Tag Types
export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface TagCreateRequest {
  name: string;
  color?: string;
}

// Rule Types
export interface RuleTrigger {
  id: string;
  ruleId: string;
  triggerType: string;
  triggerValue: string;
  order: number;
}

export interface RuleAction {
  id: string;
  ruleId: string;
  actionType: string;
  actionValue: string;
  order: number;
}

export interface Rule {
  id: string;
  userId: string;
  title: string;
  isActive: boolean;
  order: number;
  strictMode: boolean;
  triggers: RuleTrigger[];
  actions: RuleAction[];
  createdAt: string;
  updatedAt: string;
}

export interface RuleCreateRequest {
  title: string;
  strictMode?: boolean;
  triggers: { triggerType: string; triggerValue: string; order?: number }[];
  actions: { actionType: string; actionValue: string; order?: number }[];
}

// Budget Types
export interface BudgetLimit {
  id: string;
  budgetId: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  name: string;
  categoryId?: string;
  category?: Category;
  limits: BudgetLimit[];
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCreateRequest {
  name: string;
  categoryId?: string;
}

export interface BudgetStatus {
  budget: { id: string; name: string };
  limit: { id: string; amount: number; currency: string } | null;
  spent: number;
  remaining: number;
  percentage: number;
}

// Recurring Transaction Types
export interface RecurringTransaction {
  id: string;
  userId: string;
  title: string;
  isActive: boolean;
  repeatFreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  repeatInterval: number;
  startDate: string;
  endDate: string | null;
  lastTriggered: string | null;
  templateData: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringCreateRequest {
  title: string;
  repeatFreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  repeatInterval?: number;
  startDate: string;
  endDate?: string;
  templateData: string;
}

// Import Types
export interface ImportResult {
  imported: number;
  skipped: number;
  failed?: number;
  errors?: string[];
  transactions?: Transaction[];
}

// PiggyBank Types
export interface PiggyBank {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: string | null;
  accountId: string | null;
  account?: Account;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PiggyBankCreateRequest {
  name: string;
  targetAmount: number;
  currency?: string;
  targetDate?: string;
  accountId?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  totalTransfer: number;
  count: number;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: TransactionSummary;
}

// Dashboard Types
export interface DashboardOverview {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  recentTransactions: Transaction[];
}
