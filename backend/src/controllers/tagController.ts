import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { tagService } from '../services/tagService';

export const tagController = {
  list: async (req: AuthRequest, res: Response): Promise<void> => {
    const tags = await tagService.list(req.userId);
    res.json({ success: true, data: tags });
  },

  create: async (req: AuthRequest, res: Response): Promise<void> => {
    const tag = await tagService.create(req.userId, req.body);
    res.status(201).json({ success: true, data: tag });
  },

  update: async (req: AuthRequest, res: Response): Promise<void> => {
    const tag = await tagService.update(req.userId, req.params.id, req.body);
    res.json({ success: true, data: tag });
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await tagService.delete(req.userId, req.params.id);
    res.json({ success: true, data: result });
  },

  addToTransaction: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await tagService.addToTransaction(req.userId, req.params.transactionId, req.body.tagIds);
    res.json({ success: true, data: result });
  },

  removeFromTransaction: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await tagService.removeFromTransaction(req.userId, req.params.transactionId, req.params.tagId);
    res.json({ success: true, data: result });
  },
};
