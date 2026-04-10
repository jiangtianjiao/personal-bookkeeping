import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { accountService } from '../services/accountService';

export const accountController = {
  list: async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    const { accountType, isActive } = req.query;

    const filters: { accountType?: string; isActive?: boolean } = {};
    if (accountType) filters.accountType = accountType as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const data = await accountService.list(userId, filters);
    res.json({ success: true, data });
  },

  getById: async (req: AuthRequest, res: Response): Promise<void> => {
    const data = await accountService.getById(req.userId, req.params.id);
    res.json({ success: true, data });
  },

  create: async (req: AuthRequest, res: Response): Promise<void> => {
    const data = await accountService.create(req.userId, req.body);
    res.status(201).json({ success: true, data });
  },

  update: async (req: AuthRequest, res: Response): Promise<void> => {
    const data = await accountService.update(req.userId, req.params.id, req.body);
    res.json({ success: true, data });
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    const data = await accountService.delete(req.userId, req.params.id);
    res.json({ success: true, data });
  },

  getBalance: async (req: AuthRequest, res: Response): Promise<void> => {
    const data = await accountService.getBalance(req.userId, req.params.id);
    res.json({ success: true, data });
  },
};
