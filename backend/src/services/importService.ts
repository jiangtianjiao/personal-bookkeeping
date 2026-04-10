import crypto from 'crypto';
import prisma from '../config/database';
import { toCents, toYuan } from '../utils/amount';
import { AppError } from '../errors/AppError';
import { getImporter } from '../importers';
import { ImportOptions, ParsedTransaction } from '../importers/types';
import { exportTransactions, ExportableTransaction } from '../importers/exporter';
import { suggestCategoryByMerchant } from '../importers/merchantCategories';

function computeHash(tx: ParsedTransaction): string {
  const key = `${tx.date.toISOString()}|${tx.amount}|${tx.type}|${tx.description}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

export const importService = {
  importFile: async (
    userId: string,
    fileType: string,
    data: Buffer,
    options?: ImportOptions,
  ): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> => {
    const importer = getImporter(fileType);
    const parsed = await importer.parseFile(data, options);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // === Pre-load all user accounts ===
    const allAccounts = await prisma.account.findMany({
      where: { userId },
    });

    // === Pre-load all user categories ===
    const allCategories = await prisma.category.findMany({
      where: { userId },
    });

    // === Compute all hashes and batch check for existing imports ===
    const allHashes = parsed.map(tx => computeHash(tx));
    const existingImports = await prisma.transaction.findMany({
      where: { userId, importedId: { in: allHashes.filter(Boolean) } },
      select: { importedId: true },
    });
    const existingHashSet = new Set(existingImports.map(t => t.importedId));

    // === In-memory caches for accounts and categories ===
    const accountCache = new Map<string, string>(); // "name|type" -> id
    for (const a of allAccounts) {
      accountCache.set(`${a.name}|${a.accountType}`, a.id);
    }
    const categoryCache = new Map<string, string>(); // "name|type" -> id
    for (const c of allCategories) {
      categoryCache.set(`${c.name}|${c.type}`, c.id);
    }

    // Alias map for fuzzy account matching
    const ACCOUNT_ALIASES: Record<string, string[]> = {
      '零钱': ['微信', '零钱', '微信钱包', '微信零钱'],
      '零钱通': ['微信', '零钱通'],
      '信用卡': ['信用卡', '信用'],
      '花呗': ['花呗', '蚂蚁花呗'],
      '余额宝': ['余额宝'],
      '银行卡': ['银行', '储蓄'],
    };

    for (let i = 0; i < parsed.length; i++) {
      const tx = parsed[i];
      try {
        const hash = allHashes[i];

        // Dedup check via pre-loaded hash set
        if (existingHashSet.has(hash)) {
          skipped++;
          continue;
        }

        // Resolve account (fuzzy matching for payment method names)
        let accountId = options?.defaultAccountId;
        if (tx.accountName && !accountId) {
          const paymentName = tx.accountName;

          // Try exact match from cache first
          const exactAsset = accountCache.get(`${paymentName}|asset`);
          const exactLiability = accountCache.get(`${paymentName}|liability`);
          if (exactAsset) {
            accountId = exactAsset;
          } else if (exactLiability) {
            accountId = exactLiability;
          } else {
            // Fuzzy match using in-memory allAccounts array
            const assetLiabilityAccounts = allAccounts.filter(
              a => a.accountType === 'asset' || a.accountType === 'liability',
            );
            let matchedAccount: typeof allAccounts[0] | undefined;
            for (const acct of assetLiabilityAccounts) {
              const acctName = acct.name.toLowerCase();
              const pName = paymentName.toLowerCase();
              // Direct substring match
              if (acctName.includes(pName) || pName.includes(acctName)) {
                matchedAccount = acct;
                break;
              }
              // Alias matching
              for (const [key, aliases] of Object.entries(ACCOUNT_ALIASES)) {
                if (pName.includes(key.toLowerCase())) {
                  if (aliases.some(a => acctName.includes(a.toLowerCase()))) {
                    matchedAccount = acct;
                    break;
                  }
                }
              }
              if (matchedAccount) break;
              // Credit card with last 4 digits: "招商银行信用卡(5583)"
              const cardMatch = paymentName.match(/(.+)信用卡/);
              if (cardMatch && acct.accountType === 'liability') {
                matchedAccount = acct;
                break;
              }
            }
            if (matchedAccount) accountId = matchedAccount.id;
          }
        }

        if (!accountId) {
          // Find or create a default account (check cache first)
          const defaultCacheKey = 'Default Account|asset';
          const cachedDefaultId = accountCache.get(defaultCacheKey);
          if (cachedDefaultId) {
            accountId = cachedDefaultId;
          } else {
            let defaultAccount = allAccounts.find(
              a => a.name === 'Default Account' && a.accountType === 'asset',
            );
            if (!defaultAccount) {
              defaultAccount = await prisma.account.create({
                data: {
                  userId,
                  name: 'Default Account',
                  accountType: 'asset',
                  subtype: 'checking',
                },
              });
              allAccounts.push(defaultAccount);
              accountCache.set(defaultCacheKey, defaultAccount.id);
            }
            accountId = defaultAccount.id;
          }
        }

        // Resolve category: use merchant keyword matching for better classification
        let categoryId = options?.defaultCategoryId || null;
        let categoryName = tx.category;

        // Try merchant keyword matching first (more accurate than raw category like "商户消费")
        const merchantCategory = suggestCategoryByMerchant(tx.description || '', tx.category);
        if (merchantCategory) {
          categoryName = merchantCategory;
        }

        if (categoryName && !categoryId) {
          const categoryType = tx.type === 'transfer' ? 'expense' : tx.type;
          const catCacheKey = `${categoryName}|${categoryType}`;
          const cachedCatId = categoryCache.get(catCacheKey);
          if (cachedCatId) {
            categoryId = cachedCatId;
          } else {
            // Create category (not in cache means it doesn't exist yet)
            const newCategory = await prisma.category.create({
              data: {
                userId,
                name: categoryName,
                type: categoryType,
              },
            });
            categoryId = newCategory.id;
            allCategories.push(newCategory);
            categoryCache.set(catCacheKey, newCategory.id);
          }
        }

        const amountCents = toCents(tx.amount);

        // Build double-entry entries
        let entries: { accountId: string; entryType: 'debit' | 'credit'; amount: number }[];

        if (tx.type === 'expense') {
          // Find or create expense account (check cache first)
          const expenseName = categoryName || 'General Expense';
          const expenseCacheKey = `${expenseName}|expense`;
          let expenseAccountId = accountCache.get(expenseCacheKey);
          if (!expenseAccountId) {
            const newExpenseAccount = await prisma.account.create({
              data: { userId, name: expenseName, accountType: 'expense' },
            });
            expenseAccountId = newExpenseAccount.id;
            allAccounts.push(newExpenseAccount);
            accountCache.set(expenseCacheKey, newExpenseAccount.id);
          }

          entries = [
            { accountId: expenseAccountId, entryType: 'debit', amount: amountCents },
            { accountId: accountId!, entryType: 'credit', amount: amountCents },
          ];
        } else if (tx.type === 'income') {
          const incomeName = categoryName || 'General Income';
          const incomeCacheKey = `${incomeName}|income`;
          let incomeAccountId = accountCache.get(incomeCacheKey);
          if (!incomeAccountId) {
            const newIncomeAccount = await prisma.account.create({
              data: { userId, name: incomeName, accountType: 'income' },
            });
            incomeAccountId = newIncomeAccount.id;
            allAccounts.push(newIncomeAccount);
            accountCache.set(incomeCacheKey, newIncomeAccount.id);
          }

          entries = [
            { accountId: accountId!, entryType: 'debit', amount: amountCents },
            { accountId: incomeAccountId, entryType: 'credit', amount: amountCents },
          ];
        } else {
          // Transfer - use the same account for both sides if no related account
          let targetAccountId = accountId!;
          if (tx.relatedAccountName) {
            // Look up related account from cache/allAccounts in memory
            const relatedAccount = allAccounts.find(
              a => a.name === tx.relatedAccountName && a.accountType === 'asset',
            );
            if (relatedAccount) {
              targetAccountId = relatedAccount.id;
            }
          }

          entries = [
            { accountId: targetAccountId, entryType: 'debit', amount: amountCents },
            { accountId: accountId!, entryType: 'credit', amount: amountCents },
          ];
        }

        // Build enriched description: preserve original payment method and transaction type
        let enrichedDesc = tx.description || `${tx.type} transaction`;
        const metaParts: string[] = [];
        if (tx.category && tx.category !== categoryName) {
          // Original WeChat tx type (e.g. "商户消费") differs from matched category
          metaParts.push(tx.category);
        }
        if (tx.accountName) {
          metaParts.push(tx.accountName);
        }
        if (metaParts.length > 0) {
          enrichedDesc += ` [${metaParts.join(' · ')}]`;
        }

        await prisma.transaction.create({
          data: {
            userId,
            transactionDate: tx.date,
            description: enrichedDesc,
            categoryId,
            status: 'posted',
            importedId: hash,
            entries: {
              create: entries.map((entry, index) => ({
                accountId: entry.accountId,
                entryType: entry.entryType,
                amount: entry.amount,
                lineNo: index + 1,
              })),
            },
          },
        });

        // 同步更新去重集合，防止文件内重复行触发唯一约束
        existingHashSet.add(hash);

        imported++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    return { imported, skipped, errors };
  },

  exportTransactions: async (
    userId: string,
    format: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      accountId?: string;
    },
  ): Promise<Buffer> => {
    const validFormat = format === 'tsv' ? 'tsv' : 'csv';

    const where: any = { userId, status: 'posted' };

    if (filters?.startDate || filters?.endDate) {
      where.transactionDate = {};
      if (filters.startDate) where.transactionDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.transactionDate.lte = new Date(filters.endDate);
    }

    if (filters?.accountId) {
      where.entries = { some: { accountId: filters.accountId } };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        entries: {
          include: {
            account: {
              select: { id: true, name: true, accountType: true },
            },
          },
          orderBy: { lineNo: 'asc' as const },
        },
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
    });

    return exportTransactions(transactions as unknown as ExportableTransaction[], validFormat);
  },
};
