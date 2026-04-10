import prisma from '../config/database';
import { toCents } from '../utils/amount';
import { isSafeRegex } from '../utils/regex';
import { AppError, NotFoundError } from '../errors/AppError';

interface TriggerData {
  triggerType: string;
  triggerValue: string;
}

interface ActionData {
  actionType: string;
  actionValue: string;
}

interface CreateRuleData {
  title: string;
  strictMode?: boolean;
  triggers: TriggerData[];
  actions: ActionData[];
}

interface UpdateRuleData {
  title?: string;
  isActive?: boolean;
  order?: number;
  strictMode?: boolean;
  triggers?: TriggerData[];
  actions?: ActionData[];
}

const RULE_INCLUDE = {
  triggers: { orderBy: { order: 'asc' as const } },
  actions: { orderBy: { order: 'asc' as const } },
};

const VALID_TRIGGER_TYPES = ['description_contains', 'amount_greater', 'amount_less', 'description_regex', 'amount_between', 'account_is'];
const VALID_ACTION_TYPES = ['set_category', 'add_tag', 'set_description', 'set_account', 'convert_type'];

export const ruleService = {
  async list(userId: string) {
    return prisma.rule.findMany({
      where: { userId },
      include: RULE_INCLUDE,
      orderBy: { order: 'asc' },
    });
  },

  async create(userId: string, data: CreateRuleData) {
    if (!data.title) {
      throw new AppError(400, 'Rule title is required.');
    }
    if (!data.triggers || data.triggers.length === 0) {
      throw new AppError(400, 'At least one trigger is required.');
    }
    if (!data.actions || data.actions.length === 0) {
      throw new AppError(400, 'At least one action is required.');
    }

    for (const t of data.triggers) {
      if (!VALID_TRIGGER_TYPES.includes(t.triggerType)) {
        throw new AppError(400, `Invalid triggerType: ${t.triggerType}. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`);
      }
    }
    for (const a of data.actions) {
      if (!VALID_ACTION_TYPES.includes(a.actionType)) {
        throw new AppError(400, `Invalid actionType: ${a.actionType}. Must be one of: ${VALID_ACTION_TYPES.join(', ')}`);
      }
    }

    return prisma.rule.create({
      data: {
        userId,
        title: data.title,
        strictMode: data.strictMode !== undefined ? data.strictMode : true,
        triggers: {
          create: data.triggers.map((t, index) => ({
            triggerType: t.triggerType,
            triggerValue: t.triggerValue,
            order: index,
          })),
        },
        actions: {
          create: data.actions.map((a, index) => ({
            actionType: a.actionType,
            actionValue: a.actionValue,
            order: index,
          })),
        },
      },
      include: RULE_INCLUDE,
    });
  },

  async update(userId: string, ruleId: string, data: UpdateRuleData) {
    const existing = await prisma.rule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!existing) {
      throw new NotFoundError('Rule');
    }

    if (data.triggers) {
      for (const t of data.triggers) {
        if (!VALID_TRIGGER_TYPES.includes(t.triggerType)) {
          throw new AppError(400, `Invalid triggerType: ${t.triggerType}. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`);
        }
      }
    }
    if (data.actions) {
      for (const a of data.actions) {
        if (!VALID_ACTION_TYPES.includes(a.actionType)) {
          throw new AppError(400, `Invalid actionType: ${a.actionType}. Must be one of: ${VALID_ACTION_TYPES.join(', ')}`);
        }
      }
    }

    return prisma.$transaction(async (tx: any) => {
      if (data.triggers) {
        await tx.ruleTrigger.deleteMany({ where: { ruleId } });
      }
      if (data.actions) {
        await tx.ruleAction.deleteMany({ where: { ruleId } });
      }

      return tx.rule.update({
        where: { id: ruleId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.order !== undefined && { order: data.order }),
          ...(data.strictMode !== undefined && { strictMode: data.strictMode }),
          ...(data.triggers && {
            triggers: {
              create: data.triggers.map((t, index) => ({
                triggerType: t.triggerType,
                triggerValue: t.triggerValue,
                order: index,
              })),
            },
          }),
          ...(data.actions && {
            actions: {
              create: data.actions.map((a, index) => ({
                actionType: a.actionType,
                actionValue: a.actionValue,
                order: index,
              })),
            },
          }),
        },
        include: RULE_INCLUDE,
      });
    });
  },

  async delete(userId: string, ruleId: string) {
    const existing = await prisma.rule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!existing) {
      throw new NotFoundError('Rule');
    }

    await prisma.rule.delete({ where: { id: ruleId } });
    return { message: 'Rule deleted successfully.' };
  },

  async applyRules(userId: string, transaction: any) {
    const rules = await prisma.rule.findMany({
      where: { userId, isActive: true },
      include: RULE_INCLUDE,
      orderBy: { order: 'asc' },
    });

    const modified = { ...transaction };

    for (const rule of rules) {
      const triggerResults = rule.triggers.map((trigger: any) => {
        switch (trigger.triggerType) {
          case 'description_contains':
            return (modified.description || '').toLowerCase().includes(trigger.triggerValue.toLowerCase());
          case 'amount_greater': {
            const threshold = toCents(parseFloat(trigger.triggerValue));
            const txAmount = getTransactionAmount(modified);
            return txAmount > threshold;
          }
          case 'amount_less': {
            const threshold = toCents(parseFloat(trigger.triggerValue));
            const txAmount = getTransactionAmount(modified);
            return txAmount < threshold;
          }
          case 'description_regex': {
            if (trigger.triggerValue.length > 200) return false;
            if (!isSafeRegex(trigger.triggerValue)) return false;
            try {
              const regex = new RegExp(trigger.triggerValue, 'i');
              return regex.test(modified.description || '');
            } catch {
              return false;
            }
          }
          case 'amount_between': {
            const parts = trigger.triggerValue.split(',');
            if (parts.length !== 2) return false;
            const min = parseFloat(parts[0].trim());
            const max = parseFloat(parts[1].trim());
            if (isNaN(min) || isNaN(max) || min > max) return false;
            const txAmt = getTransactionAmount(modified);
            return txAmt >= toCents(min) && txAmt <= toCents(max);
          }
          case 'account_is': {
            if (!modified.entries || modified.entries.length === 0) return false;
            return modified.entries.some((e: any) => e.accountId === trigger.triggerValue);
          }
          default:
            return false;
        }
      });

      const shouldApply = rule.strictMode
        ? triggerResults.every(Boolean)
        : triggerResults.some(Boolean);

      if (shouldApply) {
        for (const action of rule.actions) {
          switch (action.actionType) {
            case 'set_category':
              modified.categoryId = action.actionValue;
              break;
            case 'add_tag':
              await prisma.transactionTag.upsert({
                where: {
                  transactionId_tagId: {
                    transactionId: modified.id,
                    tagId: action.actionValue,
                  },
                },
                create: {
                  transactionId: modified.id,
                  tagId: action.actionValue,
                },
                update: {},
              });
              break;
            case 'set_description':
              modified.description = action.actionValue;
              break;
            case 'set_account':
              // Update the first debit entry's accountId
              if (modified.entries && modified.entries.length > 0) {
                const debitEntry = modified.entries.find((e: any) => e.entryType === 'debit');
                if (debitEntry) {
                  await prisma.transactionEntry.update({
                    where: { id: debitEntry.id },
                    data: { accountId: action.actionValue },
                  });
                  debitEntry.accountId = action.actionValue;
                }
              }
              break;
            case 'convert_type':
              // TODO: Not implemented – Transaction model has no `type` field.
              // This action type is accepted but currently has no effect.
              break;
          }
        }

        // Persist category/description changes
        await prisma.transaction.update({
          where: { id: modified.id },
          data: {
            ...(modified.categoryId && { categoryId: modified.categoryId }),
            ...(modified.description !== undefined && { description: modified.description }),
          },
        });
      }
    }

    return modified;
  },
};

/** Extract total debit amount (in cents) from a transaction with entries */
function getTransactionAmount(transaction: any): number {
  if (!transaction.entries || transaction.entries.length === 0) return 0;
  return transaction.entries
    .filter((e: any) => e.entryType === 'debit')
    .reduce((sum: number, e: any) => sum + e.amount, 0);
}
