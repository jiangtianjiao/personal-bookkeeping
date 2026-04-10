import { Router } from 'express';
import { ruleController } from '../controllers/ruleController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createRuleSchema } from '../validators/schemas';

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(ruleController.list as any));
router.post('/', validate(createRuleSchema), asyncHandler(ruleController.create as any));
router.put('/:id', asyncHandler(ruleController.update as any));
router.delete('/:id', asyncHandler(ruleController.delete as any));
router.post('/apply/:transactionId', asyncHandler(ruleController.apply as any));

export default router;
