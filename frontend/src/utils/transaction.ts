import type { Transaction } from '../types';

export interface TransactionTypeInfo {
  label: string;
  color: string;
  sign: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  fromAccount?: string;
  toAccount?: string;
  description?: string;
}

export const getTransactionType = (record: Transaction): TransactionTypeInfo => {
  const debits = record.entries?.filter((e) => e.entryType === 'debit') || [];
  const credits = record.entries?.filter((e) => e.entryType === 'credit') || [];

  const debitTotal = debits.reduce((s, e) => s + parseFloat(e.amount), 0);

  const debitNames = debits.map((e) => e.account?.name || '-').join('、');
  const creditNames = credits.map((e) => e.account?.name || '-').join('、');

  const hasExpenseDebit = debits.some((e) => e.account?.accountType === 'expense');
  const hasIncomeCredit = credits.some((e) => e.account?.accountType === 'income');

  // 支出：借方有支出类账户
  if (hasExpenseDebit) {
    return {
      label: '支出',
      color: '#ef4444',
      sign: '-',
      type: 'expense',
      amount: debitTotal,
      fromAccount: creditNames,
      toAccount: debitNames,
      description: `${creditNames} → ${debitNames}`,
    };
  }

  // 收入：贷方有收入类账户
  if (hasIncomeCredit) {
    return {
      label: '收入',
      color: '#10b981',
      sign: '+',
      type: 'income',
      amount: debitTotal,
      fromAccount: creditNames,
      toAccount: debitNames,
      description: `${creditNames} → ${debitNames}`,
    };
  }

  // 转账：贷方是来源（转出），借方是目标（转入）
  return {
    label: '转账',
    color: '#4f46e5',
    sign: '',
    type: 'transfer',
    amount: debitTotal,
    fromAccount: creditNames,
    toAccount: debitNames,
    description: `${creditNames} → ${debitNames}`,
  };
};
