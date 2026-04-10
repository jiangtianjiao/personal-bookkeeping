import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { importController } from '../controllers/importController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and XLSX files are allowed.') as any, false);
    }
  },
});

// All routes are protected
router.use(authMiddleware);

router.post('/import/upload', upload.single('file'), asyncHandler(importController.importFile as any));
router.get('/export', asyncHandler(importController.exportFile as any));

// Email config endpoints
router.get('/email-config', asyncHandler(importController.getEmailConfig as any));
router.post('/email-config', asyncHandler(importController.saveEmailConfig as any));
router.delete('/email-config', asyncHandler(importController.deleteEmailConfig as any));
router.post('/email-config/test', asyncHandler(importController.testEmailConnection as any));

// Email import endpoints
router.get('/email-import/fetch', asyncHandler(importController.fetchEmails as any));
router.post('/email-import/preview', asyncHandler(importController.previewEmails as any));
router.post('/email-import/confirm', asyncHandler(importController.importEmailTransactions as any));
router.get('/email-import/logs', asyncHandler(importController.getImportLogs as any));
router.get('/email-import/category-suggestions', asyncHandler(importController.getCategorySuggestions as any));

// Card-account mapping endpoints
router.get('/card-mappings', asyncHandler(importController.listCardMappings as any));
router.post('/card-mappings', asyncHandler(importController.saveCardMapping as any));
router.delete('/card-mappings/:id', asyncHandler(importController.deleteCardMapping as any));

export default router;
