import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { recurringService } from '../services/recurringService';

export const recurringController = {
  list: async (req: AuthRequest, res: Response): Promise<void> => {
    const items = await recurringService.list(req.userId);
    res.json({ success: true, data: items });
  },

  create: async (req: AuthRequest, res: Response): Promise<void> => {
    const item = await recurringService.create(req.userId, req.body);
    res.status(201).json({ success: true, data: item });
  },

  update: async (req: AuthRequest, res: Response): Promise<void> => {
    const item = await recurringService.update(req.userId, req.params.id, req.body);
    res.json({ success: true, data: item });
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await recurringService.delete(req.userId, req.params.id);
    res.json({ success: true, data: result });
  },

  process: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await recurringService.processRecurring(req.userId);
    res.json({ success: true, data: result });
  },
};
