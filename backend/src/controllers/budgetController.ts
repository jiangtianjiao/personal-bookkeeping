import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { budgetService } from '../services/budgetService';

export const budgetController = {
  list: async (req: AuthRequest, res: Response): Promise<void> => {
    const budgets = await budgetService.list(req.userId);
    res.json({ success: true, data: budgets });
  },

  create: async (req: AuthRequest, res: Response): Promise<void> => {
    const budget = await budgetService.create(req.userId, req.body);
    res.status(201).json({ success: true, data: budget });
  },

  addLimit: async (req: AuthRequest, res: Response): Promise<void> => {
    const limit = await budgetService.addLimit(req.userId, req.params.id, req.body);
    res.status(201).json({ success: true, data: limit });
  },

  getStatus: async (req: AuthRequest, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;
    const status = await budgetService.getStatus(
      req.userId,
      req.params.id,
      startDate as string,
      endDate as string,
    );
    res.json({ success: true, data: status });
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await budgetService.delete(req.userId, req.params.id);
    res.json({ success: true, data: result });
  },
};
