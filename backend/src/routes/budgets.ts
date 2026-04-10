import { Router } from 'express';
import { budgetController } from '../controllers/budgetController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createBudgetSchema, addBudgetLimitSchema } from '../validators/schemas';

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(budgetController.list as any));
router.post('/', validate(createBudgetSchema), asyncHandler(budgetController.create as any));
router.post('/:id/limits', validate(addBudgetLimitSchema), asyncHandler(budgetController.addLimit as any));
router.get('/:id/status', asyncHandler(budgetController.getStatus as any));
router.delete('/:id', asyncHandler(budgetController.delete as any));

export default router;
