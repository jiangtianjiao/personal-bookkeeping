import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { reportService } from '../services/reportService';
import { AppError } from '../errors/AppError';

export const reportController = {
  balanceSheet: async (req: AuthRequest, res: Response): Promise<void> => {
    const { asOfDate, date } = req.query;
    const dateParam = (asOfDate || date) as string | undefined;
    const dateFilter = dateParam ? new Date(dateParam) : new Date();

    const data = await reportService.getBalanceSheet(req.userId, dateFilter);
    res.json({ success: true, data });
  },

  incomeExpense: async (req: AuthRequest, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const periodStart = startDate ? new Date(startDate as string) : defaultStart;
    const periodEnd = endDate ? new Date(endDate as string) : defaultEnd;

    const data = await reportService.getIncomeExpense(req.userId, periodStart, periodEnd);
    res.json({ success: true, data });
  },

  trialBalance: async (req: AuthRequest, res: Response): Promise<void> => {
    const { asOfDate } = req.query;
    const dateFilter = asOfDate ? new Date(asOfDate as string) : new Date();

    const data = await reportService.getTrialBalance(req.userId, dateFilter);
    res.json({ success: true, data });
  },

  dashboard: async (req: AuthRequest, res: Response): Promise<void> => {
    const data = await reportService.getDashboard(req.userId);
    res.json({ success: true, data });
  },

  getTrend: async (req: AuthRequest, res: Response): Promise<void> => {
    const granularity = (req.query.granularity as string) || 'monthly';
    const periods = req.query.periods ? parseInt(req.query.periods as string, 10) : 12;
    if (!['weekly', 'monthly', 'quarterly', 'yearly'].includes(granularity)) {
      throw new AppError(400, 'granularity must be weekly, monthly, quarterly, or yearly');
    }
    const data = await reportService.getTrend(req.userId, granularity as any, Math.min(periods, 24));
    res.json({ success: true, data });
  },
};
