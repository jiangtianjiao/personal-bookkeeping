import prisma from '../config/database';
import { toYuan } from '../utils/amount';
import { balanceService } from './balanceService';
import { AppError, NotFoundError, ConflictError } from '../errors/AppError';

const VALID_ACCOUNT_TYPES = ['asset', 'liability', 'income', 'expense'];

export const accountService = {
  async list(userId: string, filters?: { accountType?: string; isActive?: boolean }) {
    const where: any = { userId };
    if (filters?.accountType) where.accountType = filters.accountType;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    const accounts = await prisma.account.findMany({
      where,
      orderBy: [{ accountType: 'asc' }, { name: 'asc' }],
    });

    // Use batch query to compute all balances at once (avoids N+1)
    const balances = await balanceService.computeAllAccountBalances(userId);

    return accounts.map((account: { id: string; [key: string]: any }) => ({
      ...account,
      balance: toYuan(balances.get(account.id) ?? 0),
    }));
  },

  async getById(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new NotFoundError('Account');
    }

    const balance = await balanceService.computeAccountBalance(account.id, account.accountType);
    return { ...account, balance: toYuan(balance) };
  },

  async create(userId: string, data: { name: string; accountType: string; subtype?: string | null; currency?: string; parentId?: string | null; icon?: string | null }) {
    if (!data.name || !data.accountType) {
      throw new AppError(400, 'Account name and accountType are required.');
    }

    if (!VALID_ACCOUNT_TYPES.includes(data.accountType)) {
      throw new AppError(400, `Invalid account type. Must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`);
    }

    const existing = await prisma.account.findFirst({
      where: { userId, name: data.name },
    });
    if (existing) {
      throw new ConflictError('An account with this name already exists.');
    }

    const account = await prisma.account.create({
      data: {
        userId,
        name: data.name,
        accountType: data.accountType,
        subtype: data.subtype || null,
        currency: data.currency || 'CNY',
        parentId: data.parentId || null,
        icon: data.icon || null,
        isActive: true,
      },
    });

    return { ...account, balance: 0 };
  },

  async update(userId: string, accountId: string, data: { name?: string; accountType?: string; subtype?: string | null; currency?: string; parentId?: string | null; icon?: string | null; isActive?: boolean }) {
    const existing = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Account');
    }

    if (data.accountType && !VALID_ACCOUNT_TYPES.includes(data.accountType)) {
      throw new AppError(400, `Invalid account type. Must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`);
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.account.findFirst({
        where: { userId, name: data.name, id: { not: accountId } },
      });
      if (duplicate) {
        throw new ConflictError('An account with this name already exists.');
      }
    }

    const account = await prisma.account.update({
      where: { id: accountId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.accountType !== undefined && { accountType: data.accountType }),
        ...(data.subtype !== undefined && { subtype: data.subtype }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    const balance = await balanceService.computeAccountBalance(account.id, account.accountType);
    return { ...account, balance: toYuan(balance) };
  },

  async delete(userId: string, accountId: string) {
    const existing = await prisma.account.findFirst({
      where: { id: accountId, userId },
      include: { entries: true },
    });

    if (!existing) {
      throw new NotFoundError('Account');
    }

    if (existing.entries.length > 0) {
      throw new AppError(400, 'Cannot delete account with existing transaction entries. Consider deactivating it instead.');
    }

    await prisma.account.delete({ where: { id: accountId } });
    return { message: 'Account deleted successfully.' };
  },

  async getBalance(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new NotFoundError('Account');
    }

    const balance = await balanceService.computeAccountBalance(account.id, account.accountType);
    return {
      accountId: account.id,
      accountName: account.name,
      accountType: account.accountType,
      balance: toYuan(balance),
    };
  },
};
