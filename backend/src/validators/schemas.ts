import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(2).max(50),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  accountType: z.enum(['asset', 'liability', 'income', 'expense']),
  subtype: z.string().optional(),
  currency: z.string().length(3).optional(),
  parentId: z.string().nullable().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const quickEntrySchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date').optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  accountId: z.string().min(1),
  targetAccountId: z.string().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['income', 'expense', 'transfer']),
  icon: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const manualEntrySchema = z.object({
  date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  entries: z.array(z.object({
    accountId: z.string().min(1),
    entryType: z.enum(['debit', 'credit']),
    amount: z.number().positive(),
    description: z.string().optional(),
  })).min(2, 'At least 2 entries required'),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  accountType: z.enum(['asset', 'liability', 'income', 'expense']).optional(),
  subtype: z.string().optional(),
  currency: z.string().length(3).optional(),
  parentId: z.string().nullable().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createRuleSchema = z.object({
  title: z.string().min(1).max(255),
  strictMode: z.boolean().optional(),
  triggers: z.array(z.object({
    triggerType: z.enum(['description_contains', 'description_regex', 'amount_greater', 'amount_less', 'amount_between', 'account_is']),
    triggerValue: z.string().min(1),
  })).min(1),
  actions: z.array(z.object({
    actionType: z.enum(['set_category', 'add_tag', 'set_description', 'set_account', 'convert_type']),
    actionValue: z.string().min(1),
  })).min(1),
});

export const createBudgetSchema = z.object({
  name: z.string().min(1).max(100),
});

export const addBudgetLimitSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
});

export const createRecurringSchema = z.object({
  title: z.string().min(1).max(255),
  repeatFreq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  repeatInterval: z.number().int().positive().optional(),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date').optional(),
  templateData: z.string(),
});
