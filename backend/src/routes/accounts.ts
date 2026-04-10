import { Router } from 'express';
import { accountController } from '../controllers/accountController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createAccountSchema, updateAccountSchema } from '../validators/schemas';

const router = Router();

// All routes are protected
router.use(authMiddleware);

router.get('/', asyncHandler(accountController.list as any));
router.get('/:id', asyncHandler(accountController.getById as any));
router.get('/:id/balance', asyncHandler(accountController.getBalance as any));
router.post('/', validate(createAccountSchema), asyncHandler(accountController.create as any));
router.put('/:id', validate(updateAccountSchema), asyncHandler(accountController.update as any));
router.delete('/:id', asyncHandler(accountController.delete as any));

export default router;
