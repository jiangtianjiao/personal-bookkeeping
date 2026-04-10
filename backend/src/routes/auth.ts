import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../validators/schemas';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), asyncHandler(authController.register as any));
router.post('/login', validate(loginSchema), asyncHandler(authController.login as any));

// Protected routes
router.get('/profile', authMiddleware, asyncHandler(authController.getProfile as any));
router.put('/profile', authMiddleware, asyncHandler(authController.updateProfile as any));
router.put('/change-password', authMiddleware, asyncHandler(authController.changePassword as any));

export default router;
