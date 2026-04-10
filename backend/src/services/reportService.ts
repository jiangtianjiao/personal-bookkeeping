import prisma from '../config/database';
import { toYuan } from '../utils/amount';
import { balanceService } from './balanceService';

/** Convert transaction entries amount from cents to yuan for API response */
function formatTransactionAmounts(transaction: any): any {
  if (!transaction) return transaction;
  if (transaction.entries) {
    return {
      ...transaction,
      entries: transaction.entries.map((entry: any) => ({
        ...entry,
        amount: toYuan(entry.amount),
      })),
    };
  }
  return transaction;
}

export const reportService = {
  /**
   * Balance Sheet: Assets - Liabilities = Net Worth
   */
  async getBalanceSheet(userId: string, asOfDate: Date) {
    const accounts = await prisma.account.findMany({
      where: {
        userId,
        accountType: { in: ['asset', 'liability'] },
        isActive: true,
      },
      orderBy: [{ accountType: 'asc' }, { name: 'asc' }],
    });

    const accountIds = accounts.map((a: { id: string }) => a.id);

    // Single groupBy query instead of N+1 per-account queries
    const aggregations = await prisma.transactionEntry.groupBy({
      by: ['accountId', 'entryType'],
      where: {
        accountId: { in: accountIds },
        transaction: {
          status: 'posted',
          transactionDate: { lte: asOfDate },
        },
      },
      _sum: { amount: true },
    });

    // Build per-account debit/credit totals
    const debitTotals = new Map<string, number>();
    const creditTotals = new Map<string, number>();
    for (const agg of aggregations) {
      const amount = agg._sum.amount ?? 0;
      if (agg.entryType === 'debit') {
        debitTotals.set(agg.accountId, amount);
      } else {
        creditTotals.set(agg.accountId, amount);
      }
    }

    const assetAccounts: any[] = [];
    const liabilityAccounts: any[] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const account of accounts) {
      const totalDebits = debitTotals.get(account.id) ?? 0;
      const totalCredits = creditTotals.get(account.id) ?? 0;

      const balance = account.accountType === 'asset'
        ? totalDebits - totalCredits
        : totalCredits - totalDebits;

      const accountData = {
        accountId: account.id,
        accountName: account.name,
        accountType: account.accountType,
        balance,
      };

      if (account.accountType === 'asset') {
        assetAccounts.push(accountData);
        totalAssets += balance;
      } else {
        liabilityAccounts.push(accountData);
        totalLiabilities += balance;
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    return {
      asOfDate: asOfDate.toISOString(),
      assets: assetAccounts.map((a) => ({ ...a, balance: toYuan(a.balance) })),
      liabilities: liabilityAccounts.map((a) => ({ ...a, balance: toYuan(a.balance) })),
      totalAssets: toYuan(totalAssets),
      totalLiabilities: toYuan(totalLiabilities),
      netWorth: toYuan(netWorth),
    };
  },

  /**
   * Income / Expense Summary for a given period.
   */
  async getIncomeExpense(userId: string, startDate: Date, endDate: Date) {
    const accounts = await prisma.account.findMany({
      where: {
        userId,
        accountType: { in: ['income', 'expense'] },
      },
      orderBy: [{ accountType: 'asc' }, { name: 'asc' }],
    });

    const accountIds = accounts.map((a: { id: string }) => a.id);

    // Single groupBy query instead of N+1 per-account queries
    const aggregations = await prisma.transactionEntry.groupBy({
      by: ['accountId', 'entryType'],
      where: {
        accountId: { in: accountIds },
        transaction: {
          status: 'posted',
          transactionDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      _sum: { amount: true },
    });

    // Build per-account debit/credit totals
    const debitTotals = new Map<string, number>();
    const creditTotals = new Map<string, number>();
    for (const agg of aggregations) {
      const amount = agg._sum.amount ?? 0;
      if (agg.entryType === 'debit') {
        debitTotals.set(agg.accountId, amount);
      } else {
        creditTotals.set(agg.accountId, amount);
      }
    }

    const incomeItems: any[] = [];
    const expenseItems: any[] = [];
    let totalIncome = 0;
    let totalExpense = 0;

    for (const account of accounts) {
      const totalDebits = debitTotals.get(account.id) ?? 0;
      const totalCredits = creditTotals.get(account.id) ?? 0;

      const balance = account.accountType === 'expense'
        ? totalDebits - totalCredits
        : totalCredits - totalDebits;

      if (balance === 0) continue;

      if (account.accountType === 'income') {
        totalIncome += balance;
        incomeItems.push({
          categoryId: account.id,
          categoryName: account.name,
          amount: balance,
          percentage: 0,
        });
      } else {
        totalExpense += balance;
        expenseItems.push({
          categoryId: account.id,
          categoryName: account.name,
          amount: balance,
          percentage: 0,
        });
      }
    }

    for (const item of incomeItems) {
      item.percentage = totalIncome > 0 ? (item.amount / totalIncome) * 100 : 0;
    }
    for (const item of expenseItems) {
      item.percentage = totalExpense > 0 ? (item.amount / totalExpense) * 100 : 0;
    }

    const netIncome = totalIncome - totalExpense;

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      income: incomeItems.map((i) => ({ ...i, amount: toYuan(i.amount) })),
      expenses: expenseItems.map((i) => ({ ...i, amount: toYuan(i.amount) })),
      totalIncome: toYuan(totalIncome),
      totalExpenses: toYuan(totalExpense),
      netIncome: toYuan(netIncome),
    };
  },

  /**
   * Trial Balance: all accounts with debit/credit totals.
   */
  async getTrialBalance(userId: string, asOfDate: Date) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [{ accountType: 'asc' }, { name: 'asc' }],
    });

    const accountIds = accounts.map((a: { id: string }) => a.id);

    // Single groupBy query instead of N+1 per-account queries
    const aggregations = await prisma.transactionEntry.groupBy({
      by: ['accountId', 'entryType'],
      where: {
        accountId: { in: accountIds },
        transaction: {
          status: 'posted',
          transactionDate: { lte: asOfDate },
        },
      },
      _sum: { amount: true },
    });

    // Build per-account debit/credit totals
    const debitTotals = new Map<string, number>();
    const creditTotals = new Map<string, number>();
    for (const agg of aggregations) {
      const amount = agg._sum.amount ?? 0;
      if (agg.entryType === 'debit') {
        debitTotals.set(agg.accountId, amount);
      } else {
        creditTotals.set(agg.accountId, amount);
      }
    }

    const trialBalanceEntries: any[] = [];
    let grandTotalDebits = 0;
    let grandTotalCredits = 0;

    for (const account of accounts) {
      const totalDebits = debitTotals.get(account.id) ?? 0;
      const totalCredits = creditTotals.get(account.id) ?? 0;

      let balance: number;
      let balanceType: 'debit' | 'credit';
      switch (account.accountType) {
        case 'asset':
        case 'expense':
          balance = totalDebits - totalCredits;
          balanceType = 'debit';
          break;
        case 'liability':
        case 'income':
          balance = totalCredits - totalDebits;
          balanceType = 'credit';
          break;
        default:
          balance = totalDebits - totalCredits;
          balanceType = 'debit';
      }

      if (balance !== 0) {
        const debitBalance = balanceType === 'debit' ? balance : 0;
        const creditBalance = balanceType === 'credit' ? balance : 0;

        grandTotalDebits += debitBalance;
        grandTotalCredits += creditBalance;

        trialBalanceEntries.push({
          id: account.id,
          name: account.name,
          accountType: account.accountType,
          debit: debitBalance,
          credit: creditBalance,
        });
      }
    }

    return {
      asOfDate,
      accounts: trialBalanceEntries.map((e) => ({
        ...e,
        debit: toYuan(e.debit),
        credit: toYuan(e.credit),
      })),
      totals: {
        debits: toYuan(grandTotalDebits),
        credits: toYuan(grandTotalCredits),
        isBalanced: grandTotalDebits === grandTotalCredits,
      },
    };
  },

  /**
   * Dashboard: monthly totals, recent transactions, account balances summary.
   */
  async getDashboard(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Monthly totals: sum all income/expense entries for this month
    const monthlyEntries = await prisma.transactionEntry.findMany({
      where: {
        account: { userId },
        transaction: {
          status: 'posted',
          transactionDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      },
      include: {
        account: {
          select: { accountType: true },
        },
      },
    });

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    for (const entry of monthlyEntries) {
      const amount = Number(entry.amount);
      if (entry.account.accountType === 'income' && entry.entryType === 'credit') {
        monthlyIncome += amount;
      } else if (entry.account.accountType === 'expense' && entry.entryType === 'debit') {
        monthlyExpense += amount;
      }
    }

    // Recent transactions (last 10)
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        status: 'posted',
      },
      include: {
        entries: {
          include: {
            account: {
              select: { id: true, name: true, accountType: true },
            },
          },
          orderBy: { lineNo: 'asc' },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
      take: 10,
    });

    // Account balances summary (batch query)
    const balances = await balanceService.computeAllAccountBalances(userId);

    const allAccounts = await prisma.account.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: [{ accountType: 'asc' }, { name: 'asc' }],
    });

    const accountBalances = allAccounts.map((account: { id: string; name: string; accountType: string; icon: string | null; [key: string]: any }) => ({
      id: account.id,
      name: account.name,
      accountType: account.accountType,
      icon: account.icon,
      balance: balances.get(account.id) ?? 0,
    }));

    const totalAssets = accountBalances
      .filter((a: { accountType: string }) => a.accountType === 'asset')
      .reduce((sum: number, a: { balance: number }) => sum + a.balance, 0);
    const totalLiabilities = accountBalances
      .filter((a: { accountType: string }) => a.accountType === 'liability')
      .reduce((sum: number, a: { balance: number }) => sum + a.balance, 0);

    return {
      monthlyIncome: toYuan(monthlyIncome),
      monthlyExpenses: toYuan(monthlyExpense),
      netWorth: toYuan(totalAssets - totalLiabilities),
      totalAssets: toYuan(totalAssets),
      totalLiabilities: toYuan(totalLiabilities),
      accountBalances: accountBalances.map((a: { balance: number; [key: string]: any }) => ({
        ...a,
        balance: toYuan(a.balance),
      })),
      recentTransactions: recentTransactions.map(formatTransactionAmounts),
    };
  },

  /**
   * Trend: aggregated income/expense for multiple periods.
   */
  async getTrend(userId: string, granularity: 'weekly' | 'monthly' | 'quarterly' | 'yearly', periods: number = 12) {
    const now = new Date();
    const results = [];

    for (let i = periods - 1; i >= 0; i--) {
      let start: Date, end: Date;
      if (granularity === 'monthly') {
        start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      } else if (granularity === 'weekly') {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const day = d.getDay();
        start = new Date(d); start.setDate(d.getDate() - day); start.setHours(0, 0, 0, 0);
        end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
      } else if (granularity === 'quarterly') {
        const q = Math.floor(now.getMonth() / 3) - i;
        const year = now.getFullYear() + Math.floor(q / 4);
        const quarter = ((q % 4) + 4) % 4;
        start = new Date(year, quarter * 3, 1);
        end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59);
      } else { // yearly
        start = new Date(now.getFullYear() - i, 0, 1);
        end = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59);
      }

      const incomeEntries = await prisma.transactionEntry.aggregate({
        where: {
          entryType: 'credit',
          account: { userId, accountType: 'income' },
          transaction: { userId, status: 'posted', transactionDate: { gte: start, lte: end } },
        },
        _sum: { amount: true },
      });

      const expenseEntries = await prisma.transactionEntry.aggregate({
        where: {
          entryType: 'debit',
          account: { userId, accountType: 'expense' },
          transaction: { userId, status: 'posted', transactionDate: { gte: start, lte: end } },
        },
        _sum: { amount: true },
      });

      results.push({
        period: { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] },
        income: toYuan(incomeEntries._sum.amount || 0),
        expense: toYuan(expenseEntries._sum.amount || 0),
      });
    }

    return results;
  },
};
