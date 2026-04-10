import { Router } from 'express';
import { recurringController } from '../controllers/recurringController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createRecurringSchema } from '../validators/schemas';

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(recurringController.list as any));
router.post('/', validate(createRecurringSchema), asyncHandler(recurringController.create as any));
router.put('/:id', asyncHandler(recurringController.update as any));
router.delete('/:id', asyncHandler(recurringController.delete as any));
router.post('/process', asyncHandler(recurringController.process as any));

export default router;
