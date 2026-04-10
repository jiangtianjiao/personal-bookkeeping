import prisma from '../config/database';
import { AppError, NotFoundError } from '../errors/AppError';
import { transactionService } from '../services/transactionService';

interface CreateRecurringData {
  title: string;
  repeatFreq: string;
  repeatInterval?: number;
  startDate: string;
  endDate?: string;
  templateData: string;
}

interface UpdateRecurringData {
  title?: string;
  isActive?: boolean;
  repeatFreq?: string;
  repeatInterval?: number;
  startDate?: string;
  endDate?: string | null;
  templateData?: string;
}

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

export const recurringService = {
  async list(userId: string) {
    return prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { startDate: 'asc' },
    });
  },

  async create(userId: string, data: CreateRecurringData) {
    if (!data.title) {
      throw new AppError(400, 'Title is required.');
    }
    if (!data.repeatFreq || !VALID_FREQUENCIES.includes(data.repeatFreq)) {
      throw new AppError(400, `repeatFreq must be one of: ${VALID_FREQUENCIES.join(', ')}`);
    }
    if (!data.startDate) {
      throw new AppError(400, 'startDate is required.');
    }
    if (!data.templateData) {
      throw new AppError(400, 'templateData is required.');
    }

    // Validate templateData is valid JSON
    try {
      JSON.parse(data.templateData);
    } catch {
      throw new AppError(400, 'templateData must be a valid JSON string.');
    }

    return prisma.recurringTransaction.create({
      data: {
        userId,
        title: data.title,
        repeatFreq: data.repeatFreq,
        repeatInterval: data.repeatInterval || 1,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        templateData: data.templateData,
      },
    });
  },

  async update(userId: string, id: string, data: UpdateRecurringData) {
    const existing = await prisma.recurringTransaction.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundError('RecurringTransaction');
    }

    if (data.repeatFreq && !VALID_FREQUENCIES.includes(data.repeatFreq)) {
      throw new AppError(400, `repeatFreq must be one of: ${VALID_FREQUENCIES.join(', ')}`);
    }

    if (data.templateData) {
      try {
        JSON.parse(data.templateData);
      } catch {
        throw new AppError(400, 'templateData must be a valid JSON string.');
      }
    }

    return prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.repeatFreq !== undefined && { repeatFreq: data.repeatFreq }),
        ...(data.repeatInterval !== undefined && { repeatInterval: data.repeatInterval }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.templateData !== undefined && { templateData: data.templateData }),
      },
    });
  },

  async delete(userId: string, id: string) {
    const existing = await prisma.recurringTransaction.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundError('RecurringTransaction');
    }

    await prisma.recurringTransaction.delete({ where: { id } });
    return { message: 'Recurring transaction deleted successfully.' };
  },

  async processRecurring(userId: string) {
    const now = new Date();
    const recurrings = await prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
    });

    const created: any[] = [];

    for (const recurring of recurrings) {
      const nextDue = getNextDueDate(recurring);
      if (!nextDue || nextDue > now) continue;

      const template = JSON.parse(recurring.templateData);

      try {
        let transaction;
        if (template.entries) {
          transaction = await transactionService.manualEntry(userId, {
            date: now.toISOString(),
            description: template.description || recurring.title,
            categoryId: template.categoryId || null,
            status: 'posted',
            entries: template.entries,
          });
        } else {
          transaction = await transactionService.quickEntry(userId, {
            amount: template.amount,
            type: template.type,
            accountId: template.accountId,
            targetAccountId: template.targetAccountId,
            categoryId: template.categoryId,
            description: template.description || recurring.title,
            date: now.toISOString(),
          });
        }

        await prisma.recurringTransaction.update({
          where: { id: recurring.id },
          data: { lastTriggered: now },
        });

        created.push(transaction);
      } catch (error) {
        // Skip failed recurring, continue with others
        console.error(`Failed to process recurring ${recurring.id}:`, error);
      }
    }

    return { processed: created.length, transactions: created };
  },
};

function getNextDueDate(recurring: any): Date | null {
  const { repeatFreq, repeatInterval, startDate, lastTriggered } = recurring;
  const base = lastTriggered ? new Date(lastTriggered) : new Date(startDate);

  const next = new Date(base);

  switch (repeatFreq) {
    case 'daily':
      next.setDate(next.getDate() + repeatInterval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + repeatInterval * 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + repeatInterval);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + repeatInterval);
      break;
    default:
      return null;
  }

  // If never triggered, the first due date is startDate itself
  if (!lastTriggered) {
    return new Date(startDate);
  }

  return next;
}
