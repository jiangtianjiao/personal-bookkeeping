import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { categoryService } from '../services/categoryService';

export const categoryController = {
  list: async (req: AuthRequest, res: Response): Promise<void> => {
    const { type } = req.query;
    const categories = await categoryService.list(req.userId, type as string | undefined);
    res.json({ success: true, data: categories });
  },

  getById: async (req: AuthRequest, res: Response): Promise<void> => {
    const category = await categoryService.getById(req.userId, req.params.id);
    res.json({ success: true, data: category });
  },

  create: async (req: AuthRequest, res: Response): Promise<void> => {
    const category = await categoryService.create(req.userId, req.body);
    res.status(201).json({ success: true, data: category });
  },

  update: async (req: AuthRequest, res: Response): Promise<void> => {
    const category = await categoryService.update(req.userId, req.params.id, req.body);
    res.json({ success: true, data: category });
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await categoryService.delete(req.userId, req.params.id);
    res.json({ success: true, data: result });
  },
};
