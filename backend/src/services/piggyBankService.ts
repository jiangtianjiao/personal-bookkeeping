import prisma from '../config/database';
import { toCents, toYuan } from '../utils/amount';
import { AppError, NotFoundError } from '../errors/AppError';

interface CreatePiggyBankData {
  name: string;
  targetAmount: number;
  currency?: string;
  targetDate?: string;
  accountId?: string;
}

interface UpdatePiggyBankData {
  name?: string;
  targetAmount?: number;
  currency?: string;
  targetDate?: string | null;
  accountId?: string | null;
  isActive?: boolean;
}

function validateAmount(amount: unknown, label: string): void {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new AppError(400, `${label} must be a positive number.`);
  }
}

async function validateAccountOwnership(userId: string, accountId: string): Promise<void> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) {
    throw new AppError(400, 'Account not found or does not belong to you.');
  }
}

/** Convert piggy bank amounts from cents to yuan for API response */
function formatPiggyBankAmounts(pb: any): any {
  if (!pb) return pb;
  return {
    ...pb,
    targetAmount: toYuan(pb.targetAmount),
    currentAmount: toYuan(pb.currentAmount),
  };
}

export const piggyBankService = {
  async list(userId: string) {
    const results = await prisma.piggyBank.findMany({
      where: { userId },
      include: { account: true },
      orderBy: { createdAt: 'desc' },
    });
    return results.map(formatPiggyBankAmounts);
  },

  async create(userId: string, data: CreatePiggyBankData) {
    if (!data.name) {
      throw new AppError(400, 'Piggy bank name is required.');
    }
    validateAmount(data.targetAmount, 'Target amount');

    if (data.accountId) {
      await validateAccountOwnership(userId, data.accountId);
    }

    const created = await prisma.piggyBank.create({
      data: {
        userId,
        name: data.name,
        targetAmount: toCents(data.targetAmount),
        currency: data.currency || 'CNY',
        ...(data.targetDate && { targetDate: new Date(data.targetDate) }),
        ...(data.accountId && { accountId: data.accountId }),
      },
      include: { account: true },
    });
    return formatPiggyBankAmounts(created);
  },

  async update(userId: string, piggyBankId: string, data: UpdatePiggyBankData) {
    const existing = await prisma.piggyBank.findFirst({
      where: { id: piggyBankId, userId },
    });
    if (!existing) {
      throw new NotFoundError('PiggyBank');
    }

    if (data.targetAmount !== undefined) {
      validateAmount(data.targetAmount, 'Target amount');
    }

    if (data.accountId) {
      await validateAccountOwnership(userId, data.accountId);
    }

    const updated = await prisma.piggyBank.update({
      where: { id: piggyBankId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.targetAmount !== undefined && { targetAmount: toCents(data.targetAmount) }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.targetDate !== undefined && {
          targetDate: data.targetDate ? new Date(data.targetDate) : null,
        }),
        ...(data.accountId !== undefined && { accountId: data.accountId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { account: true },
    });
    return formatPiggyBankAmounts(updated);
  },

  async deposit(userId: string, piggyBankId: string, amount: number) {
    validateAmount(amount, 'Deposit amount');
    const depositCents = toCents(amount);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.piggyBank.findFirst({
        where: { id: piggyBankId, userId },
      });
      if (!existing) {
        throw new NotFoundError('PiggyBank');
      }

      const result = await tx.piggyBank.update({
        where: { id: piggyBankId },
        data: { currentAmount: { increment: depositCents } },
        include: { account: true },
      });
      return formatPiggyBankAmounts(result);
    });
  },

  async withdraw(userId: string, piggyBankId: string, amount: number) {
    validateAmount(amount, 'Withdraw amount');
    const withdrawCents = toCents(amount);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.piggyBank.findFirst({
        where: { id: piggyBankId, userId },
      });
      if (!existing) {
        throw new NotFoundError('PiggyBank');
      }

      if (withdrawCents > existing.currentAmount) {
        throw new AppError(400, 'Insufficient balance in piggy bank.');
      }

      const result = await tx.piggyBank.update({
        where: { id: piggyBankId },
        data: { currentAmount: { decrement: withdrawCents } },
        include: { account: true },
      });
      return formatPiggyBankAmounts(result);
    });
  },

  async delete(userId: string, piggyBankId: string) {
    const existing = await prisma.piggyBank.findFirst({
      where: { id: piggyBankId, userId },
    });
    if (!existing) {
      throw new NotFoundError('PiggyBank');
    }

    await prisma.piggyBank.delete({ where: { id: piggyBankId } });
    return { message: 'Piggy bank deleted successfully.' };
  },
};
