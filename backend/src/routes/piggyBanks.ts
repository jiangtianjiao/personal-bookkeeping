import { Router } from 'express';
import { piggyBankController } from '../controllers/piggyBankController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(piggyBankController.list as any));
router.post('/', asyncHandler(piggyBankController.create as any));
router.put('/:id', asyncHandler(piggyBankController.update as any));
router.patch('/:id/deposit', asyncHandler(piggyBankController.deposit as any));
router.patch('/:id/withdraw', asyncHandler(piggyBankController.withdraw as any));
router.delete('/:id', asyncHandler(piggyBankController.delete as any));

export default router;
