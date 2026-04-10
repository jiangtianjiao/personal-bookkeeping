import prisma from '../config/database';
import { toCents, toYuan } from '../utils/amount';
import { AppError, NotFoundError } from '../errors/AppError';

export interface QuickEntryData {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  targetAccountId?: string;
  categoryId?: string;
  description?: string;
  date?: string;
  importedId?: string;
}

export interface ManualEntryData {
  date: string;
  description?: string;
  categoryId?: string;
  status?: 'draft' | 'posted';
  entries: {
    accountId: string;
    entryType: 'debit' | 'credit';
    amount: number;
  }[];
}

export interface TransactionFilters {
  status?: string;
  categoryId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  type?: 'income' | 'expense' | 'transfer';
  tagIds?: string[];
  page?: number;
  limit?: number;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  totalTransfer: number;
  count: number;
}

export interface UpdateTransactionData {
  description?: string;
  categoryId?: string;
  status?: string;
  date?: string;
  entries?: {
    accountId: string;
    entryType: 'debit' | 'credit';
    amount: number;
  }[];
}

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

const TRANSACTION_INCLUDE = {
  entries: {
    include: {
      account: {
        select: { id: true, name: true, accountType: true },
      },
    },
    orderBy: { lineNo: 'asc' as const },
  },
  category: {
    select: { id: true, name: true, type: true, icon: true },
  },
  tags: {
    include: {
      tag: true,
    },
  },
};

export const transactionService = {
  quickEntry: async (userId: string, data: QuickEntryData) => {
    const { amount, type, accountId, targetAccountId, categoryId, description, date } = data;

    if (!amount || !type || !accountId) {
      throw new AppError(400, 'amount, type, and accountId are required.');
    }

    if (amount <= 0) {
      throw new AppError(400, 'Amount must be greater than zero.');
    }

    if (!['income', 'expense', 'transfer'].includes(type)) {
      throw new AppError(400, 'type must be one of: income, expense, transfer');
    }

    const amountCents = toCents(amount);

    return prisma.$transaction(async (tx: any) => {
      const userAccount = await tx.account.findFirst({
        where: { id: accountId, userId },
      });

      if (!userAccount) {
        throw new NotFoundError('Account');
      }

      let entries: { accountId: string; entryType: 'debit' | 'credit'; amount: number }[] = [];

      if (type === 'expense') {
        let expenseAccountId: string;

        if (categoryId) {
          const category = await tx.category.findFirst({
            where: { id: categoryId, userId },
          });
          if (!category) {
            throw new NotFoundError('Category');
          }

          let expenseAccount = await tx.account.findFirst({
            where: { userId, name: category.name, accountType: 'expense' },
          });

          if (!expenseAccount) {
            expenseAccount = await tx.account.create({
              data: {
                userId,
                name: category.name,
                accountType: 'expense',
                icon: category.icon,
              },
            });
          }

          expenseAccountId = expenseAccount.id;
        } else {
          let generalExpense = await tx.account.findFirst({
            where: { userId, name: 'General Expense', accountType: 'expense' },
          });
          if (!generalExpense) {
            generalExpense = await tx.account.create({
              data: {
                userId,
                name: 'General Expense',
                accountType: 'expense',
              },
            });
          }
          expenseAccountId = generalExpense.id;
        }

        entries = [
          { accountId: expenseAccountId, entryType: 'debit', amount: amountCents },
          { accountId: userAccount.id, entryType: 'credit', amount: amountCents },
        ];
      } else if (type === 'income') {
        let incomeAccountId: string;

        if (categoryId) {
          const category = await tx.category.findFirst({
            where: { id: categoryId, userId },
          });
          if (!category) {
            throw new NotFoundError('Category');
          }

          let incomeAccount = await tx.account.findFirst({
            where: { userId, name: category.name, accountType: 'income' },
          });

          if (!incomeAccount) {
            incomeAccount = await tx.account.create({
              data: {
                userId,
                name: category.name,
                accountType: 'income',
                icon: category.icon,
              },
            });
          }

          incomeAccountId = incomeAccount.id;
        } else {
          let generalIncome = await tx.account.findFirst({
            where: { userId, name: 'General Income', accountType: 'income' },
          });
          if (!generalIncome) {
            generalIncome = await tx.account.create({
              data: {
                userId,
                name: 'General Income',
                accountType: 'income',
              },
            });
          }
          incomeAccountId = generalIncome.id;
        }

        entries = [
          { accountId: userAccount.id, entryType: 'debit', amount: amountCents },
          { accountId: incomeAccountId, entryType: 'credit', amount: amountCents },
        ];
      } else if (type === 'transfer') {
        if (!targetAccountId) {
          throw new AppError(400, 'targetAccountId is required for transfers.');
        }

        const targetAccount = await tx.account.findFirst({
          where: { id: targetAccountId, userId },
        });

        if (!targetAccount) {
          throw new NotFoundError('Target account');
        }

        entries = [
          { accountId: targetAccount.id, entryType: 'debit', amount: amountCents },
          { accountId: userAccount.id, entryType: 'credit', amount: amountCents },
        ];
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          transactionDate: date ? new Date(date) : new Date(),
          description: description || `${type.charAt(0).toUpperCase() + type.slice(1)} transaction`,
          categoryId: categoryId || null,
          importedId: data.importedId || null,
          status: 'posted',
          entries: {
            create: entries.map((entry, index) => ({
              accountId: entry.accountId,
              entryType: entry.entryType,
              amount: entry.amount,
              lineNo: index + 1,
            })),
          },
        },
        include: TRANSACTION_INCLUDE,
      });

      return formatTransactionAmounts(transaction);
    });
  },

  manualEntry: async (userId: string, data: ManualEntryData) => {
    const { date, description, categoryId, status, entries } = data;

    if (!date || !entries || !Array.isArray(entries) || entries.length < 2) {
      throw new AppError(400, 'date and at least 2 entries are required.');
    }

    for (const entry of entries) {
      if (!entry.accountId || !entry.entryType || !entry.amount) {
        throw new AppError(400, 'Each entry must have accountId, entryType, and amount.');
      }
      if (!['debit', 'credit'].includes(entry.entryType)) {
        throw new AppError(400, 'entryType must be "debit" or "credit".');
      }
      if (entry.amount <= 0) {
        throw new AppError(400, 'Entry amount must be greater than zero.');
      }
    }

    const entriesInCents = entries.map((e) => ({
      ...e,
      amount: toCents(e.amount),
    }));

    const totalDebits = entriesInCents
      .filter((e) => e.entryType === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalCredits = entriesInCents
      .filter((e) => e.entryType === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);

    if (totalDebits !== totalCredits) {
      throw new AppError(
        400,
        `Double-entry imbalance: total debits (${toYuan(totalDebits).toFixed(2)}) must equal total credits (${toYuan(totalCredits).toFixed(2)}).`,
      );
    }

    const accountIds = [...new Set(entries.map((e) => e.accountId))];
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, userId },
    });

    if (accounts.length !== accountIds.length) {
      const foundIds = accounts.map((a: { id: string }) => a.id);
      const missingIds = accountIds.filter((id) => !foundIds.includes(id));
      throw new AppError(
        400,
        `One or more accounts not found or do not belong to the user. Missing: ${missingIds.join(', ')}`,
      );
    }

    const transactionStatus = status && ['draft', 'posted'].includes(status) ? status : 'posted';

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        transactionDate: new Date(date),
        description: description || null,
        categoryId: categoryId || null,
        status: transactionStatus,
        entries: {
          create: entriesInCents.map((entry, index) => ({
            accountId: entry.accountId,
            entryType: entry.entryType,
            amount: entry.amount,
            lineNo: index + 1,
          })),
        },
      },
      include: TRANSACTION_INCLUDE,
    });

    return formatTransactionAmounts(transaction);
  },

  list: async (userId: string, filters: TransactionFilters) => {
    const { status, categoryId, accountId, startDate, endDate, search, type, tagIds } = filters;
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = new Date(startDate);
      if (endDate) where.transactionDate.lte = new Date(endDate);
    }

    if (accountId) {
      where.entries = { some: { accountId } };
    }

    // SQLite doesn't support mode: 'insensitive', so we search both original
    // and lowercased description using OR conditions
    if (search) {
      const lowerSearch = search.toLowerCase();
      where.OR = [
        { description: { contains: search } },
        { description: { contains: lowerSearch } },
        { description: { contains: search.toUpperCase() } },
        // Also search via entry descriptions and account names
        { entries: { some: { description: { contains: search } } } },
        { entries: { some: { account: { name: { contains: search } } } } },
        { entries: { some: { description: { contains: lowerSearch } } } },
        { entries: { some: { account: { name: { contains: lowerSearch } } } } },
      ];
    }

    // Apply type filter at the database level via entry account types
    if (type === 'expense') {
      where.entries = {
        ...where.entries,
        some: { ...((where.entries as any)?.some || {}), entryType: 'debit', account: { accountType: 'expense' } },
      };
    } else if (type === 'income') {
      where.entries = {
        ...where.entries,
        some: { ...((where.entries as any)?.some || {}), entryType: 'credit', account: { accountType: 'income' } },
      };
    } else if (type === 'transfer') {
      where.AND = [
        ...(where.AND || []),
        { NOT: { entries: { some: { entryType: 'debit', account: { accountType: 'expense' } } } } },
        { NOT: { entries: { some: { entryType: 'credit', account: { accountType: 'income' } } } } },
      ];
    }

    if (tagIds && tagIds.length > 0) {
      where.tags = { some: { tagId: { in: tagIds } } };
    }

    // Get total count and paginated transactions from database
    const [total, paginatedTransactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: TRANSACTION_INCLUDE,
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // 用数据库聚合替代全量加载
    const [incomeAgg, expenseAgg, totalDebitAgg] = await Promise.all([
      prisma.transactionEntry.aggregate({
        where: {
          entryType: 'credit',
          account: { userId, accountType: 'income' },
          transaction: where,
        },
        _sum: { amount: true },
      }),
      prisma.transactionEntry.aggregate({
        where: {
          entryType: 'debit',
          account: { userId, accountType: 'expense' },
          transaction: where,
        },
        _sum: { amount: true },
      }),
      prisma.transactionEntry.aggregate({
        where: {
          entryType: 'debit',
          transaction: where,
        },
        _sum: { amount: true },
      }),
    ]);

    const totalIncomeCents = incomeAgg._sum.amount || 0;
    const totalExpenseCents = expenseAgg._sum.amount || 0;
    const totalAllCents = totalDebitAgg._sum.amount || 0;

    const summary: TransactionSummary = {
      totalIncome: toYuan(totalIncomeCents),
      totalExpense: toYuan(totalExpenseCents),
      totalTransfer: Math.max(0, toYuan(totalAllCents - totalIncomeCents - totalExpenseCents)),
      count: total,
    };

    const resultTransactions = paginatedTransactions.map((tx) =>
      formatTransactionAmounts(tx),
    );

    return {
      transactions: resultTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    };
  },

  getById: async (userId: string, transactionId: string) => {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: TRANSACTION_INCLUDE,
    });

    if (!transaction) {
      throw new NotFoundError('Transaction');
    }

    return formatTransactionAmounts(transaction);
  },

  update: async (userId: string, transactionId: string, data: UpdateTransactionData) => {
    const { description, categoryId, status, date, entries } = data;

    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Transaction');
    }

    if (existing.status === 'void') {
      throw new AppError(400, 'Cannot update a voided transaction.');
    }

    let entriesInCents: { accountId: string; entryType: 'debit' | 'credit'; amount: number }[] | undefined;

    if (entries && Array.isArray(entries)) {
      entriesInCents = entries.map((e) => ({
        ...e,
        amount: toCents(e.amount),
      }));

      const totalDebits = entriesInCents
        .filter((e) => e.entryType === 'debit')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalCredits = entriesInCents
        .filter((e) => e.entryType === 'credit')
        .reduce((sum, e) => sum + e.amount, 0);

      if (totalDebits !== totalCredits) {
        throw new AppError(
          400,
          `Double-entry imbalance: total debits (${toYuan(totalDebits).toFixed(2)}) must equal total credits (${toYuan(totalCredits).toFixed(2)}).`,
        );
      }
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      if (entriesInCents && Array.isArray(entriesInCents)) {
        await tx.transactionEntry.deleteMany({
          where: { transactionId },
        });

        await tx.transaction.update({
          where: { id: transactionId },
          data: {
            ...(description !== undefined && { description }),
            ...(categoryId !== undefined && { categoryId }),
            ...(status !== undefined && { status }),
            ...(date !== undefined && { transactionDate: new Date(date) }),
            entries: {
              create: entriesInCents.map((entry: any, index: number) => ({
                accountId: entry.accountId,
                entryType: entry.entryType,
                amount: entry.amount,
                lineNo: index + 1,
              })),
            },
          },
        });
      } else {
        await tx.transaction.update({
          where: { id: transactionId },
          data: {
            ...(description !== undefined && { description }),
            ...(categoryId !== undefined && { categoryId }),
            ...(status !== undefined && { status }),
            ...(date !== undefined && { transactionDate: new Date(date) }),
          },
        });
      }

      return tx.transaction.findUnique({
        where: { id: transactionId },
        include: TRANSACTION_INCLUDE,
      });
    });

    return formatTransactionAmounts(updated);
  },

  voidTransaction: async (userId: string, transactionId: string) => {
    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Transaction');
    }

    if (existing.status === 'void') {
      throw new AppError(400, 'Transaction is already voided.');
    }

    const transaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'void' },
      include: {
        entries: {
          include: {
            account: {
              select: { id: true, name: true, accountType: true },
            },
          },
        },
      },
    });

    return formatTransactionAmounts(transaction);
  },

  deleteTransaction: async (userId: string, transactionId: string) => {
    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Transaction');
    }

    await prisma.transaction.delete({
      where: { id: transactionId },
    });

    return { message: 'Transaction deleted successfully.' };
  },
};
