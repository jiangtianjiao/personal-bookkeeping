import crypto from 'crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import prisma from '../config/database';
import { AppError, NotFoundError } from '../errors/AppError';
import { parseEmailContent, ParsedEmailResult, ParsedEmailTransaction } from '../importers/emailParser';
import { suggestCategoryByMerchant } from '../importers/merchantCategories';
import { ruleService } from '../services/ruleService';
import { transactionService } from '../services/transactionService';
import { toCents } from '../utils/amount';
import { encrypt, decrypt } from '../utils/crypto';
import { isSafeRegex } from '../utils/regex';

interface EmailConfigData {
  host: string;
  port?: number;
  secure?: boolean;
  email: string;
  password: string;
}

// ===== Fetch result types =====

interface ParsedEmailTx {
  date: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  merchant?: string;
  cardLast4?: string;
  source: string;
  originalCategory?: string;
}

interface ParsedEmail {
  messageId: string;
  subject: string;
  from: string;
  emailDate: string;
  bankName: string;
  cardLast4?: string;
  billSummary?: { totalAmount: number; billPeriod?: string; dueDate?: string };
  transactions: ParsedEmailTx[];
}

interface FetchResult {
  emails: ParsedEmail[];
  errors: string[];
  skippedCount: number;
}

// ===== Preview result types =====

interface PreviewTx extends ParsedEmailTx {
  accountId?: string;
  targetAccountId?: string;
  categoryId?: string;
  suggestedCategoryName?: string;
  importedId: string;
  isDuplicate: boolean;
}

interface PreviewEmail {
  messageId: string;
  subject: string;
  from: string;
  emailDate: string;
  bankName: string;
  cardLast4?: string;
  billSummary?: { totalAmount: number; billPeriod?: string; dueDate?: string };
  transactions: PreviewTx[];
}

interface PreviewResult {
  emails: PreviewEmail[];
}

// ===== Import result types =====

interface ImportConfirmTx {
  date: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  accountId: string;
  targetAccountId?: string;
  categoryId?: string;
  importedId: string;
}

interface ImportConfirmEmail {
  messageId: string;
  subject: string;
  bankName?: string;
  cardLast4?: string;
  transactions: ImportConfirmTx[];
}

function computeImportedId(messageId: string, date: string, amount: number, description: string): string {
  const key = `${messageId}|${date}|${amount}|${description}`;
  return 'email_' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

export const emailImportService = {
  // ===== Config CRUD (unchanged) =====

  async getConfig(userId: string) {
    const config = await prisma.emailConfig.findUnique({
      where: { userId },
    });
    if (!config) return null;
    return {
      id: config.id,
      host: config.host,
      port: config.port,
      secure: config.secure,
      email: config.email,
      lastFetch: config.lastFetch,
    };
  },

  async saveConfig(userId: string, data: EmailConfigData) {
    if (!data.host || !data.email || !data.password) {
      throw new AppError(400, 'Host, email, and password are required.');
    }

    // 增强 SSRF 防护：覆盖 IPv6 私网地址
    const blockedPatterns = [
      /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^169\.254\./,
      /^0\./, /^localhost$/i, /^::1$/, /^\[::1\]$/,
      /^fc00:/i, /^fd[0-9a-f]{2}:/i, /^fe80:/i,  // IPv6 ULA + link-local
      /^::ffff:(127|10|172\.(1[6-9]|2\d|3[01])|192\.168|169\.254)\./i,  // IPv4-mapped IPv6
      /^\[.*\]$/,  // 任何 IPv6 bracket notation
    ];
    if (blockedPatterns.some(p => p.test(data.host))) {
      throw new AppError(400, 'Private or internal addresses are not allowed as IMAP host.');
    }
    // 限制 IMAP 端口范围
    const port = data.port || 993;
    if (port !== 993 && port !== 143) {
      throw new AppError(400, 'IMAP port must be 993 (SSL) or 143 (plain).');
    }

    const encryptedPassword = encrypt(data.password);

    return prisma.emailConfig.upsert({
      where: { userId },
      create: {
        userId,
        host: data.host,
        port: data.port || 993,
        secure: data.secure !== false,
        email: data.email,
        password: encryptedPassword,
      },
      update: {
        host: data.host,
        port: data.port || 993,
        secure: data.secure !== false,
        email: data.email,
        password: encryptedPassword,
      },
      select: {
        id: true,
        host: true,
        port: true,
        secure: true,
        email: true,
        lastFetch: true,
      },
    });
  },

  async deleteConfig(userId: string) {
    const config = await prisma.emailConfig.findUnique({ where: { userId } });
    if (!config) throw new NotFoundError('EmailConfig');
    await prisma.emailConfig.delete({ where: { userId } });
    return { message: 'Email config deleted.' };
  },

  async testConnection(userId: string) {
    const config = await prisma.emailConfig.findUnique({ where: { userId } });
    if (!config) throw new AppError(400, 'Email config not set.');

    const decryptedPassword = decrypt(config.password);

    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.email, pass: decryptedPassword },
      logger: false,
    });

    try {
      await client.connect();
      const mailboxes = await client.list();
      await client.logout();
      return {
        success: true,
        message: `Connected. Found ${mailboxes.length} mailbox(es).`,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Connection failed';
      throw new AppError(400, `IMAP connection failed: ${msg}`);
    }
  },

  // ===== New: fetchAndParse =====

  async fetchAndParse(userId: string, options?: { limit?: number; since?: string }): Promise<FetchResult> {
    const config = await prisma.emailConfig.findUnique({ where: { userId } });
    if (!config) throw new AppError(400, 'Email config not set.');

    const limit = options?.limit || 50;
    const sinceDate = options?.since
      ? new Date(options.since)
      : config.lastFetch || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Load already-processed messageIds for dedup
    const processedLogs = await prisma.emailImportLog.findMany({
      where: { userId },
      select: { messageId: true },
    });
    const processedIds = new Set(processedLogs.map((l) => l.messageId));

    const decryptedPassword = decrypt(config.password);

    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.email, pass: decryptedPassword },
      logger: false,
    });

    const emails: ParsedEmail[] = [];
    const errors: string[] = [];
    let skippedCount = 0;

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const messages = client.fetch(
          { since: sinceDate },
          { source: true, envelope: true, uid: true, headers: ['message-id'] },
        );

        let count = 0;
        for await (const msg of messages) {
          if (count >= limit) break;

          try {
            if (!msg.source) continue;
            const parsed = await simpleParser(msg.source as any);

            // Extract Message-ID header
            const messageId = (parsed as any).messageId || `uid_${msg.uid}`;

            // Skip already-processed emails
            if (processedIds.has(messageId)) {
              skippedCount++;
              count++;
              continue;
            }

            const subject = (parsed as any).subject || '';
            const from = (parsed as any).from?.text || '';
            const rawHtml = (parsed as any).html;
            const html = typeof rawHtml === 'string' ? rawHtml : '';
            const text = (parsed as any).text || '';
            const emailDate: Date = (parsed as any).date || new Date();

            const result = parseEmailContent(html, text, subject, from, emailDate);
            if (result && (result.transactions.length > 0 || result.billSummary)) {
              const parsedTxs: ParsedEmailTx[] = result.transactions.map((tx) => ({
                date: tx.date.toISOString(),
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                merchant: tx.merchant,
                cardLast4: tx.cardLast4,
                source: tx.source,
                originalCategory: tx.originalCategory,
              }));

              emails.push({
                messageId,
                subject,
                from,
                emailDate: emailDate.toISOString(),
                bankName: result.bankName,
                cardLast4: result.cardLast4,
                billSummary: result.billSummary
                  ? {
                      totalAmount: result.billSummary.totalAmount,
                      billPeriod: result.billSummary.billPeriod,
                      dueDate: result.billSummary.dueDate,
                    }
                  : undefined,
                transactions: parsedTxs,
              });
            }
          } catch (parseError: unknown) {
            const errMsg = parseError instanceof Error ? parseError.message : 'Parse error';
            errors.push(`Email parse error: ${errMsg}`);
          }

          count++;
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'IMAP error';
      throw new AppError(500, `Failed to fetch emails: ${msg}`);
    }

    // 不在此处更新 lastFetch，改为在 importConfirmed 成功后才更新
    // 避免用户未确认导入时下次拉取跳过这些邮件

    return { emails, errors, skippedCount };
  },

  // ===== New: preview =====

  async preview(userId: string, emails: ParsedEmail[]): Promise<PreviewResult> {
    // Load card-account mappings
    const mappings = await prisma.cardAccountMapping.findMany({
      where: { userId },
    });

    // Load user rules (with triggers & actions)
    const rules = await prisma.rule.findMany({
      where: { userId, isActive: true },
      include: {
        triggers: { orderBy: { order: 'asc' } },
        actions: { orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    });

    // Load user categories for name lookup
    const categories = await prisma.category.findMany({
      where: { userId },
    });
    const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

    // Load existing importedIds for duplicate detection
    const allImportedIds: string[] = [];
    for (const email of emails) {
      for (const tx of email.transactions) {
        allImportedIds.push(generateImportedId(email.messageId, tx.date, tx.amount, tx.description));
      }
    }
    const existingTxs = await prisma.transaction.findMany({
      where: { userId, importedId: { in: allImportedIds } },
      select: { importedId: true },
    });
    const existingImportedIds = new Set(existingTxs.map((t) => t.importedId));

    const previewEmails: PreviewEmail[] = [];

    for (const email of emails) {
      const previewTxs: PreviewTx[] = [];

      for (const tx of email.transactions) {
        const importedId = generateImportedId(email.messageId, tx.date, tx.amount, tx.description);
        const isDuplicate = existingImportedIds.has(importedId);

        // 1. Find account via CardAccountMapping
        let accountId: string | undefined;
        let targetAccountId: string | undefined;

        const txCardLast4 = tx.cardLast4 || email.cardLast4;
        const bankName = email.bankName;

        // Find matching mapping (specific card first, then bank-level)
        const exactMapping = mappings.find(
          (m) => m.bankName === bankName && m.cardLast4 === txCardLast4,
        );
        const bankMapping = mappings.find(
          (m) => m.bankName === bankName && !m.cardLast4,
        );
        const mapping = exactMapping || bankMapping;

        if (mapping) {
          if (tx.type === 'transfer') {
            // 还款: accountId = asset(银行卡), targetAccountId = liability(信用卡)
            // The mapping points to the credit card (liability), so for transfer we need
            // to find an asset account as the source. We'll set targetAccountId to the mapped card.
            targetAccountId = mapping.accountId;
            // accountId needs to be set by user or we leave it undefined
          } else {
            // expense/income: the mapped account is the credit card
            accountId = mapping.accountId;
          }
        }

        // 2. Try rule-based category suggestion
        let categoryId: string | undefined;
        let suggestedCategoryName: string | undefined;

        // Build a mock transaction object for rule matching
        const mockTx = {
          description: tx.description,
          entries: [
            {
              accountId: accountId || '',
              entryType: 'debit' as const,
              amount: toCents(tx.amount),
            },
          ],
        };

        for (const rule of rules) {
          const triggerResults = rule.triggers.map((trigger) => {
            switch (trigger.triggerType) {
              case 'description_contains':
                return (mockTx.description || '').toLowerCase().includes(trigger.triggerValue.toLowerCase());
              case 'description_regex': {
                if (trigger.triggerValue.length > 200) return false;
                if (!isSafeRegex(trigger.triggerValue)) return false;
                try {
                  const regex = new RegExp(trigger.triggerValue, 'i');
                  return regex.test(mockTx.description || '');
                } catch {
                  return false;
                }
              }
              case 'amount_greater': {
                const threshold = toCents(parseFloat(trigger.triggerValue));
                return toCents(tx.amount) > threshold;
              }
              case 'amount_less': {
                const threshold = toCents(parseFloat(trigger.triggerValue));
                return toCents(tx.amount) < threshold;
              }
              case 'amount_between': {
                const parts = trigger.triggerValue.split(',');
                if (parts.length !== 2) return false;
                const min = parseFloat(parts[0].trim());
                const max = parseFloat(parts[1].trim());
                if (isNaN(min) || isNaN(max) || min > max) return false;
                return toCents(tx.amount) >= toCents(min) && toCents(tx.amount) <= toCents(max);
              }
              case 'account_is': {
                return accountId === trigger.triggerValue;
              }
              default:
                return false;
            }
          });

          const shouldApply = rule.strictMode
            ? triggerResults.every(Boolean)
            : triggerResults.some(Boolean);

          if (shouldApply) {
            for (const action of rule.actions) {
              if (action.actionType === 'set_category') {
                categoryId = action.actionValue;
                break;
              }
            }
            if (categoryId) break;
          }
        }

        // 3. Fallback: merchant keyword category suggestion
        if (!categoryId) {
          const suggestedName = suggestCategoryByMerchant(tx.description, tx.merchant);
          if (suggestedName) {
            suggestedCategoryName = suggestedName;
            const catId = categoryByName.get(suggestedName);
            if (catId) {
              categoryId = catId;
            }
          }
        } else {
          // Look up category name for display
          const cat = categories.find((c) => c.id === categoryId);
          if (cat) suggestedCategoryName = cat.name;
        }

        previewTxs.push({
          ...tx,
          accountId,
          targetAccountId,
          categoryId,
          suggestedCategoryName,
          importedId,
          isDuplicate,
        });
      }

      previewEmails.push({
        messageId: email.messageId,
        subject: email.subject,
        from: email.from,
        emailDate: email.emailDate,
        bankName: email.bankName,
        cardLast4: email.cardLast4,
        billSummary: email.billSummary,
        transactions: previewTxs,
      });
    }

    return { emails: previewEmails };
  },

  // ===== New: importConfirmed =====

  async importConfirmed(userId: string, emails: ImportConfirmEmail[]) {
    const results = { imported: 0, skipped: 0, failed: 0, errors: [] as string[] };

    for (const email of emails) {
      for (let txIdx = 0; txIdx < email.transactions.length; txIdx++) {
        const tx = email.transactions[txIdx];
        try {
          // Generate importedId if missing
          const importedId = tx.importedId || computeImportedId(email.messageId, tx.date, tx.amount, tx.description);

          // Check duplicate by importedId
          const existing = await prisma.transaction.findFirst({
            where: { userId, importedId },
          });
          if (existing) {
            results.skipped++;
            continue;
          }

          if (tx.type === 'expense') {
            // expense: accountId = credit card (liability)
            await transactionService.quickEntry(userId, {
              amount: tx.amount,
              type: 'expense',
              accountId: tx.accountId,
              categoryId: tx.categoryId,
              description: tx.description,
              date: tx.date,
              importedId,
            });
          } else if (tx.type === 'transfer') {
            // transfer (还款): accountId = source (asset), targetAccountId = destination (liability)
            // 严格验证：两者都必须存在且不能相同（否则是无效自转账）
            if (!tx.accountId || !tx.targetAccountId || tx.accountId === tx.targetAccountId) {
              results.failed++;
              results.errors.push(`Skipped invalid transfer "${tx.description}": accountId and targetAccountId must differ.`);
              continue;
            }
            await transactionService.quickEntry(userId, {
              amount: tx.amount,
              type: 'transfer',
              accountId: tx.accountId,
              targetAccountId: tx.targetAccountId,
              categoryId: tx.categoryId,
              description: tx.description,
              date: tx.date,
              importedId,
            });
          } else if (tx.type === 'income') {
            // income (退款): accountId = credit card (liability)
            await transactionService.quickEntry(userId, {
              amount: tx.amount,
              type: 'income',
              accountId: tx.accountId,
              categoryId: tx.categoryId,
              description: tx.description,
              date: tx.date,
              importedId,
            });
          }

          results.imported++;
        } catch (err: unknown) {
          results.failed++;
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push(`Failed to import "${tx.description}": ${errMsg}`);
        }
      }

      // Write EmailImportLog
      if (email.transactions.length > 0) {
        try {
          await prisma.emailImportLog.upsert({
            where: {
              userId_messageId: {
                userId,
                messageId: email.messageId,
              },
            },
            create: {
              userId,
              messageId: email.messageId,
              subject: email.subject,
              bankName: email.bankName,
              cardLast4: email.cardLast4,
              txCount: email.transactions.length,
            },
            update: {
              txCount: email.transactions.length,
              processedAt: new Date(),
            },
          });
        } catch {
          // Non-critical: log write failure won't block import
        }
      }
    }

    // 导入成功后才更新 lastFetch
    if (results.imported > 0) {
      await prisma.emailConfig.updateMany({
        where: { userId },
        data: { lastFetch: new Date() },
      });
    }

    return results;
  },

  // ===== Import Logs =====

  async getImportLogs(userId: string, options?: { page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.emailImportLog.findMany({
        where: { userId },
        orderBy: { processedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailImportLog.count({ where: { userId } }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // ===== CardAccountMapping CRUD =====

  async listMappings(userId: string) {
    return prisma.cardAccountMapping.findMany({
      where: { userId },
      include: {
        account: {
          select: { id: true, name: true, accountType: true, subtype: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async saveMapping(userId: string, data: { bankName: string; cardLast4?: string; accountId: string }) {
    if (!data.bankName || !data.accountId) {
      throw new AppError(400, 'bankName and accountId are required.');
    }

    // Verify account belongs to user
    const account = await prisma.account.findFirst({
      where: { id: data.accountId, userId },
    });
    if (!account) throw new NotFoundError('Account');

    // Use findFirst + create/update because cardLast4 is nullable in the unique constraint
    const existing = await prisma.cardAccountMapping.findFirst({
      where: {
        userId,
        bankName: data.bankName,
        cardLast4: data.cardLast4 || null,
      },
    });

    if (existing) {
      return prisma.cardAccountMapping.update({
        where: { id: existing.id },
        data: { accountId: data.accountId },
        include: {
          account: {
            select: { id: true, name: true, accountType: true, subtype: true },
          },
        },
      });
    }

    return prisma.cardAccountMapping.create({
      data: {
        userId,
        bankName: data.bankName,
        cardLast4: data.cardLast4 || null,
        accountId: data.accountId,
      },
      include: {
        account: {
          select: { id: true, name: true, accountType: true, subtype: true },
        },
      },
    });
  },

  async deleteMapping(userId: string, id: string) {
    const mapping = await prisma.cardAccountMapping.findFirst({
      where: { id, userId },
    });
    if (!mapping) throw new NotFoundError('CardAccountMapping');

    await prisma.cardAccountMapping.delete({ where: { id } });
    return { message: 'Card mapping deleted.' };
  },

  async getCategorySuggestions(userId: string, descriptions: string[]): Promise<Record<string, { categoryId: string; categoryName: string; frequency: number }>> {
    if (!descriptions || descriptions.length === 0) return {};

    // 查询该用户所有有分类的交易，按 description + categoryId 分组统计频率
    const transactions = await prisma.transaction.findMany({
      where: { userId, categoryId: { not: null }, description: { not: null } },
      select: { description: true, categoryId: true },
    });

    // 加载所有分类名
    const categories = await prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    const catMap = new Map(categories.map(c => [c.id, c.name]));

    // 统计每个 description 的分类频率
    const freqMap = new Map<string, Map<string, number>>(); // desc -> (catId -> count)
    for (const tx of transactions) {
      if (!tx.description || !tx.categoryId) continue;
      // 提取商户名（取描述中 " - " 前的部分，或整个描述）
      const merchant = tx.description.split(' - ')[0].replace(/\s*\[.*\]$/, '').trim().toLowerCase();
      if (!freqMap.has(merchant)) freqMap.set(merchant, new Map());
      const catFreq = freqMap.get(merchant)!;
      catFreq.set(tx.categoryId, (catFreq.get(tx.categoryId) || 0) + 1);
    }

    // 对每个输入的 description，找到最频繁的分类
    const result: Record<string, { categoryId: string; categoryName: string; frequency: number }> = {};
    for (const desc of descriptions) {
      const merchant = desc.split(' - ')[0].replace(/\s*\[.*\]$/, '').trim().toLowerCase();
      const catFreq = freqMap.get(merchant);
      if (!catFreq) continue;

      let bestCatId = '';
      let bestFreq = 0;
      for (const [catId, freq] of catFreq) {
        if (freq > bestFreq) {
          bestCatId = catId;
          bestFreq = freq;
        }
      }
      if (bestCatId && bestFreq >= 2) { // 至少出现2次才建议
        const catName = catMap.get(bestCatId);
        if (catName) {
          result[desc] = { categoryId: bestCatId, categoryName: catName, frequency: bestFreq };
        }
      }
    }

    return result;
  },
};

// ===== Helpers =====

function generateImportedId(messageId: string, date: string, amount: number, description: string): string {
  const raw = `${messageId}|${date}|${amount}|${description}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  return `email_${hash}`;
}
