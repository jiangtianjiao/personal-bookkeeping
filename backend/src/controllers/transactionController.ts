import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { transactionService } from '../services/transactionService';

export const transactionController = {
  quickEntry: async (req: AuthRequest, res: Response): Promise<void> => {
    const transaction = await transactionService.quickEntry(req.userId, req.body);
    res.status(201).json({ success: true, data: transaction });
  },

  manualEntry: async (req: AuthRequest, res: Response): Promise<void> => {
    const transaction = await transactionService.manualEntry(req.userId, req.body);
    res.status(201).json({ success: true, data: transaction });
  },

  list: async (req: AuthRequest, res: Response): Promise<void> => {
    const { page, limit, status, categoryId, accountId, startDate, endDate, search, type, tagIds } = req.query;
    const result = await transactionService.list(req.userId, {
      status: status as string | undefined,
      categoryId: categoryId as string | undefined,
      accountId: accountId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      search: search as string | undefined,
      type: type as 'income' | 'expense' | 'transfer' | undefined,
      tagIds: tagIds ? (tagIds as string).split(',') : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json({
      success: true,
      data: result.transactions,
      pagination: result.pagination,
      summary: result.summary,
    });
  },

  getById: async (req: AuthRequest, res: Response): Promise<void> => {
    const transaction = await transactionService.getById(req.userId, req.params.id);
    res.json({ success: true, data: transaction });
  },

  update: async (req: AuthRequest, res: Response): Promise<void> => {
    const updated = await transactionService.update(req.userId, req.params.id, req.body);
    res.json({ success: true, data: updated });
  },

  void: async (req: AuthRequest, res: Response): Promise<void> => {
    const transaction = await transactionService.voidTransaction(req.userId, req.params.id);
    res.json({ success: true, data: transaction });
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await transactionService.deleteTransaction(req.userId, req.params.id);
    res.json({ success: true, data: result });
  },
};
