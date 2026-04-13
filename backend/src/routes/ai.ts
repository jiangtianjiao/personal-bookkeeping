import { Router } from 'express';
import { aiController } from '../controllers/aiController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.post('/chat', aiController.chat);
router.get('/history', aiController.getHistory);
router.delete('/history', aiController.clearHistory);

export default router;
