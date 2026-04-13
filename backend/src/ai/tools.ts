import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import prisma from '../config/database';

let _currentUserId: string | null = null;

export function setToolContext(userId: string) {
  _currentUserId = userId;
}

export function clearToolContext() {
  _currentUserId = null;
}

function getUserId(): string {
  if (!_currentUserId) throw new Error('未登录，请先登录');
  return _currentUserId;
}

const accountListSchema = z.object({
  accountType: z.enum(['asset', 'liability', 'income', 'expense']).optional().describe('账户类型筛选'),
});

export const accountListTool = new DynamicStructuredTool({
  name: 'list_accounts',
  description: '查询用户的所有账户列表，可按类型筛选（asset资产/liability负债/income收入/expense支出）',
  schema: accountListSchema,
  func: async ({ accountType }) => {
    const userId = getUserId();

    const where: any = { userId, isActive: true };
    if (accountType) where.accountType = accountType;

    const accounts = await prisma.account.findMany({
      where,
      orderBy: [{ accountType: 'asc' }, { name: 'asc' }],
    });

    const results = await Promise.all(
      accounts.map(async (a) => {
        const entries = await prisma.transactionEntry.findMany({
          where: { accountId: a.id, transaction: { status: 'posted' } },
          select: { entryType: true, amount: true },
        });
        let d = 0, c = 0;
        for (const e of entries) {
          const amt = Number(e.amount);
          if (e.entryType === 'debit') d += amt; else c += amt;
        }
        const bal = (a.accountType === 'asset' || a.accountType === 'expense') ? d - c : c - d;
        return { id: a.id, name: a.name, type: a.accountType, balance: bal };
      })
    );
    return JSON.stringify(results);
  },
});

export const quickEntrySchema = z.object({
  amount: z.number().positive().describe('金额'),
  type: z.enum(['income', 'expense', 'transfer']).describe('类型：income收入/expense支出/transfer转账'),
  accountName: z.string().describe('支付/收款账户名称'),
  targetAccountName: z.string().optional().describe('转账目标账户名称（仅转账时需要）'),
  categoryName: z.string().optional().describe('分类名称'),
  description: z.string().optional().describe('描述'),
  date: z.string().optional().describe('日期，格式YYYY-MM-DD'),
});

export const quickEntryTool = new DynamicStructuredTool({
  name: 'quick_entry',
  description: '快速记账：创建收入/支出/转账交易。会自动查找对应账户和分类，如不存在会自动创建。',
  schema: quickEntrySchema,
  func: async (input) => {
    const userId = getUserId();
    const { amount, type, accountName, targetAccountName, categoryName, description, date } = input;

    const userAccount = await prisma.account.findFirst({
      where: { userId, name: accountName },
    });
    if (!userAccount) return JSON.stringify({ error: `未找到账户「${accountName}」，请先创建账户或检查名称` });

    let entries: { accountId: string; entryType: 'debit' | 'credit'; amount: number }[] = [];

    if (type === 'expense') {
      let expAccount = await prisma.account.findFirst({
        where: { userId, name: categoryName || 'General Expense', accountType: 'expense' },
      });
      if (!expAccount) {
        expAccount = await prisma.account.create({
          data: { userId, name: categoryName || 'General Expense', accountType: 'expense' },
        });
      }
      entries = [
        { accountId: expAccount.id, entryType: 'debit', amount },
        { accountId: userAccount.id, entryType: 'credit', amount },
      ];
    } else if (type === 'income') {
      let incAccount = await prisma.account.findFirst({
        where: { userId, name: categoryName || 'General Income', accountType: 'income' },
      });
      if (!incAccount) {
        incAccount = await prisma.account.create({
          data: { userId, name: categoryName || 'General Income', accountType: 'income' },
        });
      }
      entries = [
        { accountId: userAccount.id, entryType: 'debit', amount },
        { accountId: incAccount.id, entryType: 'credit', amount },
      ];
    } else {
      if (!targetAccountName) return JSON.stringify({ error: '转账需要提供目标账户名称' });
      const target = await prisma.account.findFirst({ where: { userId, name: targetAccountName } });
      if (!target) return JSON.stringify({ error: `未找到目标账户「${targetAccountName}」` });
      entries = [
        { accountId: target.id, entryType: 'debit', amount },
        { accountId: userAccount.id, entryType: 'credit', amount },
      ];
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        transactionDate: date ? new Date(date) : new Date(),
        description: description || `${type === 'income' ? '收入' : type === 'expense' ? '支出' : '转账'}记录`,
        status: 'posted',
        entries: { create: entries.map((e, i) => ({ ...e, lineNo: i + 1 })) },
      },
      include: {
        entries: { include: { account: { select: { id: true, name: true, accountType: true } } } },
      },
    });

    return JSON.stringify({
      success: true,
      message: `记账成功！${type === 'income' ? '收入' : type === 'expense' ? '支出' : '转账'} ¥${amount}`,
      transactionId: transaction.id,
      entries: transaction.entries.map(e => ({
        account: e.account.name,
        type: e.entryType === 'debit' ? '借' : '贷',
        amount: Number(e.amount),
      })),
    });
  },
});

const queryTransactionsSchema = z.object({
  startDate: z.string().optional().describe('开始日期 YYYY-MM-DD'),
  endDate: z.string().optional().describe('结束日期 YYYY-MM-DD'),
  accountName: z.string().optional().describe('账户名称筛选'),
  type: z.enum(['income', 'expense', 'transfer']).optional().describe('交易类型'),
  limit: z.number().optional().describe('返回条数，默认10'),
});

export const queryTransactionsTool = new DynamicStructuredTool({
  name: 'query_transactions',
  description: '查询交易记录：按日期范围、账户、类型筛选交易',
  schema: queryTransactionsSchema,
  func: async (input) => {
    const userId = getUserId();
    const { startDate, endDate, accountName, type, limit = 10 } = input;
    const where: any = { userId, status: 'posted' };

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = new Date(startDate);
      if (endDate) where.transactionDate.lte = new Date(endDate);
    }

    if (accountName) {
      const acc = await prisma.account.findFirst({ where: { userId, name: accountName } });
      if (acc) where.entries = { some: { accountId: acc.id } };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        entries: {
          include: { account: { select: { name: true, accountType: true } } },
          orderBy: { lineNo: 'asc' },
        },
      },
      orderBy: { transactionDate: 'desc' },
      take: limit,
    });

    const results = transactions.map(t => ({
      date: t.transactionDate.toISOString().split('T')[0],
      description: t.description,
      entries: t.entries.map(e => ({
        account: e.account.name,
        type: e.entryType === 'debit' ? '借' : '贷',
        amount: Number(e.amount),
      })),
    }));

    return JSON.stringify({ count: results.length, transactions: results });
  },
});

const getReportSchema = z.object({
  reportType: z.enum(['balance_sheet', 'income_expense', 'dashboard']).describe('报表类型'),
  startDate: z.string().optional().describe('开始日期（收支报表用）'),
  endDate: z.string().optional().describe('结束日期（收支报表用）'),
  asOfDate: z.string().optional().describe('截止日期（资产负债表用）'),
});

export const getReportTool = new DynamicStructuredTool({
  name: 'get_report',
  description: '获取财务报表：资产负债表(balance_sheet)、收支报表(income_expense)、仪表板概览(dashboard)',
  schema: getReportSchema,
  func: async (input) => {
    const userId = getUserId();
    const { reportType, startDate, endDate, asOfDate } = input;

    if (reportType === 'dashboard') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const monthlyEntries = await prisma.transactionEntry.findMany({
        where: {
          account: { userId },
          transaction: { status: 'posted', transactionDate: { gte: monthStart, lte: monthEnd } },
        },
        include: { account: { select: { accountType: true } } },
      });

      let monthlyIncome = 0, monthlyExpense = 0;
      for (const e of monthlyEntries) {
        const amt = Number(e.amount);
        if (e.account.accountType === 'income' && e.entryType === 'credit') monthlyIncome += amt;
        else if (e.account.accountType === 'expense' && e.entryType === 'debit') monthlyExpense += amt;
      }

      const allAccounts = await prisma.account.findMany({ where: { userId, isActive: true, accountType: { in: ['asset', 'liability'] } } });
      let totalAssets = 0, totalLiabilities = 0;
      for (const a of allAccounts) {
        const entries = await prisma.transactionEntry.findMany({
          where: { accountId: a.id, transaction: { status: 'posted' } },
          select: { entryType: true, amount: true },
        });
        let d = 0, c = 0;
        for (const e of entries) { const amt = Number(e.amount); if (e.entryType === 'debit') d += amt; else c += amt; }
        const bal = a.accountType === 'asset' ? d - c : c - d;
        if (a.accountType === 'asset') totalAssets += bal; else totalLiabilities += bal;
      }

      return JSON.stringify({
        monthlyIncome, monthlyExpense,
        netMonthly: monthlyIncome - monthlyExpense,
        totalAssets, totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
      });
    }

    return JSON.stringify({ message: `报表类型 ${reportType} 暂时只支持dashboard概览` });
  },
});

const createAccountSchema = z.object({
  name: z.string().describe('账户名称'),
  accountType: z.enum(['asset', 'liability', 'income', 'expense']).describe('账户类型'),
});

export const createAccountTool = new DynamicStructuredTool({
  name: 'create_account',
  description: '创建新账户。账户类型：asset(资产如银行卡/支付宝)、liability(负债如信用卡/花呗)、income(收入)、expense(支出)',
  schema: createAccountSchema,
  func: async ({ name, accountType }) => {
    const userId = getUserId();

    const existing = await prisma.account.findFirst({ where: { userId, name } });
    if (existing) return JSON.stringify({ error: `账户「${name}」已存在` });

    const account = await prisma.account.create({
      data: { userId, name, accountType, isActive: true },
    });
    return JSON.stringify({ success: true, account: { id: account.id, name: account.name, type: account.accountType } });
  },
});

export const allTools = [
  accountListTool,
  quickEntryTool,
  queryTransactionsTool,
  getReportTool,
  createAccountTool,
];
