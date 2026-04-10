import { Router } from 'express';
import { tagController } from '../controllers/tagController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(tagController.list as any));
router.post('/', asyncHandler(tagController.create as any));
router.put('/:id', asyncHandler(tagController.update as any));
router.delete('/:id', asyncHandler(tagController.delete as any));
router.post('/transaction/:transactionId', asyncHandler(tagController.addToTransaction as any));
router.delete('/transaction/:transactionId/:tagId', asyncHandler(tagController.removeFromTransaction as any));

export default router;
