import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ruleService } from '../services/ruleService';
import { transactionService } from '../services/transactionService';

export const ruleController = {
  list: async (req: AuthRequest, res: Response): Promise<void> => {
    const rules = await ruleService.list(req.userId);
    res.json({ success: true, data: rules });
  },

  create: async (req: AuthRequest, res: Response): Promise<void> => {
    const rule = await ruleService.create(req.userId, req.body);
    res.status(201).json({ success: true, data: rule });
  },

  update: async (req: AuthRequest, res: Response): Promise<void> => {
    const rule = await ruleService.update(req.userId, req.params.id, req.body);
    res.json({ success: true, data: rule });
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await ruleService.delete(req.userId, req.params.id);
    res.json({ success: true, data: result });
  },

  apply: async (req: AuthRequest, res: Response): Promise<void> => {
    const transaction = await transactionService.getById(req.userId, req.params.transactionId);
    const result = await ruleService.applyRules(req.userId, transaction);
    res.json({ success: true, data: result });
  },
};
