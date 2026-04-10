import { Router } from 'express';
import { reportController } from '../controllers/reportController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// All routes are protected
router.use(authMiddleware);

router.get('/balance-sheet', asyncHandler(reportController.balanceSheet as any));
router.get('/income-expense', asyncHandler(reportController.incomeExpense as any));
router.get('/trial-balance', asyncHandler(reportController.trialBalance as any));
router.get('/dashboard', asyncHandler(reportController.dashboard as any));
router.get('/trend', asyncHandler(reportController.getTrend as any));

export default router;
