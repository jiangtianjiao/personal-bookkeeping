import { Router } from 'express';
import { categoryController } from '../controllers/categoryController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createCategorySchema } from '../validators/schemas';

const router = Router();

// All routes are protected
router.use(authMiddleware);

router.get('/', asyncHandler(categoryController.list as any));
router.get('/:id', asyncHandler(categoryController.getById as any));
router.post('/', validate(createCategorySchema), asyncHandler(categoryController.create as any));
router.put('/:id', asyncHandler(categoryController.update as any));
router.delete('/:id', asyncHandler(categoryController.delete as any));

export default router;
