import prisma from '../config/database';
import { toCents, toYuan } from '../utils/amount';
import { AppError, NotFoundError, ConflictError } from '../errors/AppError';

export const budgetService = {
  async list(userId: string) {
    return prisma.budget.findMany({
      where: { userId },
      include: { limits: { orderBy: { startDate: 'desc' } } },
      orderBy: { name: 'asc' },
    });
  },

  async create(userId: string, data: { name: string }) {
    if (!data.name) {
      throw new AppError(400, 'Budget name is required.');
    }

    const existing = await prisma.budget.findFirst({
      where: { userId, name: data.name },
    });
    if (existing) {
      throw new ConflictError('A budget with this name already exists.');
    }

    return prisma.budget.create({
      data: {
        userId,
        name: data.name,
      },
      include: { limits: true },
    });
  },

  async addLimit(
    userId: string,
    budgetId: string,
    data: { amount: number; currency?: string; startDate: string; endDate: string },
  ) {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });
    if (!budget) {
      throw new NotFoundError('Budget');
    }

    if (!data.amount || data.amount <= 0) {
      throw new AppError(400, 'Amount must be greater than zero.');
    }
    if (!data.startDate || !data.endDate) {
      throw new AppError(400, 'startDate and endDate are required.');
    }

    return prisma.budgetLimit.create({
      data: {
        budgetId,
        amount: toCents(data.amount),
        currency: data.currency || 'CNY',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    });
  },

  async getStatus(
    userId: string,
    budgetId: string,
    startDate: string,
    endDate: string,
  ) {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
      include: { limits: true },
    });
    if (!budget) {
      throw new NotFoundError('Budget');
    }

    if (!startDate || !endDate) {
      throw new AppError(400, 'startDate and endDate query parameters are required.');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Find matching limit for this period
    const limit = budget.limits.find(
      (l: any) => new Date(l.startDate) <= end && new Date(l.endDate) >= start,
    );

    // Sum expense entries in the period (debit entries on expense accounts)
    // When the budget is tied to a specific category, only count that category's expenses
    const transactionWhere: any = {
      userId,
      status: 'posted',
      transactionDate: {
        gte: start,
        lte: end,
      },
    };
    if (budget.categoryId) {
      transactionWhere.categoryId = budget.categoryId;
    }

    const expenseEntries = await prisma.transactionEntry.aggregate({
      where: {
        entryType: 'debit',
        account: {
          userId,
          accountType: 'expense',
        },
        transaction: transactionWhere,
      },
      _sum: { amount: true },
    });

    const spentCents = expenseEntries._sum.amount || 0;
    const limitCents = limit ? limit.amount : 0;
    const remainingCents = limitCents - spentCents;
    const percentage = limitCents > 0 ? Math.round((spentCents / limitCents) * 10000) / 100 : 0;

    return {
      budget: { id: budget.id, name: budget.name },
      limit: limit ? { id: limit.id, amount: toYuan(limit.amount), currency: limit.currency } : null,
      spent: toYuan(spentCents),
      remaining: toYuan(remainingCents),
      percentage,
    };
  },

  async delete(userId: string, budgetId: string) {
    const existing = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });
    if (!existing) {
      throw new NotFoundError('Budget');
    }

    await prisma.budget.delete({ where: { id: budgetId } });
    return { message: 'Budget deleted successfully.' };
  },
};
