import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { importService } from '../services/importService';
import { emailImportService } from '../services/emailImportService';
import { AppError } from '../errors/AppError';

/** Auto-detect file format from filename and content */
function detectFileFormat(filename: string, buffer: Buffer): string {
  const name = filename.toLowerCase();

  // XLSX detection by extension or magic bytes (PK zip header)
  if (name.endsWith('.xlsx') || (buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    return 'wechat_xlsx';
  }

  // CSV content detection
  const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 2000));

  // Alipay: contains "支付宝" or specific alipay headers
  if (content.includes('支付宝交易记录') || content.includes('支付宝（中国）')) {
    return 'alipay';
  }

  // WeChat CSV: contains "微信支付" or specific wechat headers
  if (content.includes('微信支付账单') || content.includes('微信支付-')) {
    return 'wechat';
  }

  // WeChat/Alipay detection by column headers
  if (content.includes('交易对方') && content.includes('商品') && content.includes('收/支')) {
    return 'wechat';
  }
  if (content.includes('交易对方') && content.includes('商品说明') && content.includes('收/支')) {
    return 'alipay';
  }

  return 'csv';
}

export const importController = {
  importFile: async (req: AuthRequest, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      throw new AppError(400, 'No file uploaded.');
    }

    let fileType = (req.query.type as string) || (req.query.format as string) || '';

    // Auto-detect format if not specified
    if (!fileType || fileType === 'auto') {
      fileType = detectFileFormat(file.originalname, file.buffer);
    }

    if (!['csv', 'alipay', 'wechat', 'wechat_xlsx'].includes(fileType)) {
      throw new AppError(400, `Unsupported file type: ${fileType}. Supported: csv, alipay, wechat, wechat_xlsx`);
    }

    const options = {
      defaultAccountId: req.body.defaultAccountId || undefined,
      defaultCategoryId: req.body.defaultCategoryId || undefined,
      timezone: req.body.timezone || undefined,
    };

    const result = await importService.importFile(req.userId, fileType, file.buffer, options);

    res.json({
      success: true,
      data: result,
    });
  },

  exportFile: async (req: AuthRequest, res: Response): Promise<void> => {
    const format = (req.query.format as string) || 'csv';
    if (!['csv', 'tsv'].includes(format)) {
      throw new AppError(400, 'Supported export formats: csv, tsv');
    }

    const filters = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      accountId: req.query.accountId as string | undefined,
    };

    const data = await importService.exportTransactions(req.userId, format, filters);

    const contentType = format === 'tsv' ? 'text/tab-separated-values' : 'text/csv';
    const extension = format === 'tsv' ? 'tsv' : 'csv';

    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename="transactions.${extension}"`);
    res.send(data);
  },

  // ===== Email config endpoints (unchanged) =====

  getEmailConfig: async (req: AuthRequest, res: Response): Promise<void> => {
    const config = await emailImportService.getConfig(req.userId);
    res.json({ success: true, data: config });
  },

  saveEmailConfig: async (req: AuthRequest, res: Response): Promise<void> => {
    const config = await emailImportService.saveConfig(req.userId, req.body);
    res.json({ success: true, data: config });
  },

  deleteEmailConfig: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await emailImportService.deleteConfig(req.userId);
    res.json({ success: true, data: result });
  },

  testEmailConnection: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await emailImportService.testConnection(req.userId);
    res.json({ success: true, data: result });
  },

  // ===== Email import endpoints (refactored) =====

  fetchEmails: async (req: AuthRequest, res: Response): Promise<void> => {
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      since: req.query.since as string | undefined,
    };
    const result = await emailImportService.fetchAndParse(req.userId, options);
    res.json({ success: true, data: result });
  },

  previewEmails: async (req: AuthRequest, res: Response): Promise<void> => {
    const { emails } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new AppError(400, 'emails array is required.');
    }
    const result = await emailImportService.preview(req.userId, emails);
    res.json({ success: true, data: result });
  },

  importEmailTransactions: async (req: AuthRequest, res: Response): Promise<void> => {
    const { emails } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new AppError(400, 'emails array is required.');
    }
    const result = await emailImportService.importConfirmed(req.userId, emails);
    res.json({ success: true, data: result });
  },

  getImportLogs: async (req: AuthRequest, res: Response): Promise<void> => {
    const options = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    const result = await emailImportService.getImportLogs(req.userId, options);
    res.json({ success: true, data: result });
  },

  // ===== Card mapping endpoints =====

  listCardMappings: async (req: AuthRequest, res: Response): Promise<void> => {
    const mappings = await emailImportService.listMappings(req.userId);
    res.json({ success: true, data: mappings });
  },

  saveCardMapping: async (req: AuthRequest, res: Response): Promise<void> => {
    const mapping = await emailImportService.saveMapping(req.userId, req.body);
    res.json({ success: true, data: mapping });
  },

  deleteCardMapping: async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await emailImportService.deleteMapping(req.userId, req.params.id);
    res.json({ success: true, data: result });
  },

  getCategorySuggestions: async (req: AuthRequest, res: Response): Promise<void> => {
    const descriptionsParam = req.query.descriptions as string;
    if (!descriptionsParam) {
      res.json({ success: true, data: {} });
      return;
    }
    const descriptions = descriptionsParam.split('||'); // 用 || 分隔，因为描述可能含逗号
    const result = await emailImportService.getCategorySuggestions(req.userId, descriptions);
    res.json({ success: true, data: result });
  },
};
