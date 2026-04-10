import { Router } from 'express';
import { transactionController } from '../controllers/transactionController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { quickEntrySchema, manualEntrySchema } from '../validators/schemas';

const router = Router();

// All routes are protected
router.use(authMiddleware);

router.post('/quick', validate(quickEntrySchema), asyncHandler(transactionController.quickEntry as any));
router.post('/manual', validate(manualEntrySchema), asyncHandler(transactionController.manualEntry as any));
router.get('/', asyncHandler(transactionController.list as any));
router.get('/:id', asyncHandler(transactionController.getById as any));
router.put('/:id', asyncHandler(transactionController.update as any));
router.put('/:id/void', asyncHandler(transactionController.void as any));
router.delete('/:id', asyncHandler(transactionController.delete as any));

export default router;
