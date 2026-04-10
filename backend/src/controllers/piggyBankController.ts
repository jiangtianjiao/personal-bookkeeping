import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { piggyBankService } from '../services/piggyBankService';

export const piggyBankController = {
  list: async (req: AuthRequest, res: Response): Promise<void> => {
    const piggyBanks = await piggyBankService.list(req.userId);
    res.json({ success: true, data: piggyBanks });
  },

  create: async (req: AuthRequest, res: Response): Promise<void> => {
    const piggyBank = await piggyBankService.create(req.userId, req.body);
    res.status(201).json({ success: true, data: piggyBank });
  },

  update: async (req: AuthRequest, res: Response): Promise<void> => {
    const piggyBank = await piggyBankService.update(req.userId, req.params.id, req.body);
    res.json({ success: true, data: piggyBank });
  },

  deposit: async (req: AuthRequest, res: Response): Promise<void> => {
    const piggyBank = await piggyBankService.deposit(req.userId, req.params.id, req.body.amount);
    res.json({ success: true, data: piggyBank });
  },

  withdraw: async (req: AuthRequest, res: Response): Promise<void> => {
    const piggyBank = await piggyBankService.withdraw(req.userId, req.params.id, req.body.amount);
    res.json({ success: true, data: piggyBank });
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await piggyBankService.delete(req.userId, req.params.id);
    res.json({ success: true, data: result });
  },
};
