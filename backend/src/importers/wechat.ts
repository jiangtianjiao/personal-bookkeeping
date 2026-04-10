import { parse } from 'csv-parse/sync';
import { TransactionImporter, ParsedTransaction, ImportOptions } from './types';

const VALID_STATUSES = ['支付成功', '已转账', '已收钱', '朋友已收钱', '已存入零钱'];
const SKIP_STATUSES = ['已退款', '已全额退款', '对方已退还'];

export class WeChatImporter implements TransactionImporter {
  async parseFile(data: Buffer, _options?: ImportOptions): Promise<ParsedTransaction[]> {
    // WeChat CSV is UTF-8 with BOM
    let content = data.toString('utf-8');

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const lines = content.split(/\r?\n/);

    // Find the header row containing '交易时间'
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('交易时间')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return [];
    }

    // Rejoin from header row onward for CSV parsing
    const csvContent = lines.slice(headerIndex).join('\n');

    const records: string[][] = parse(csvContent, {
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });

    if (records.length < 2) {
      return [];
    }

    // Map header columns
    const header = records[0].map((h) => h.trim());
    const colIndex: Record<string, number> = {};
    header.forEach((col, idx) => {
      colIndex[col] = idx;
    });

    const dateCol = colIndex['交易时间'];
    const typeCol = colIndex['交易类型'];
    const counterpartyCol = colIndex['交易对方'];
    const descCol = colIndex['商品'];
    const directionCol = colIndex['收/支'];
    const amountCol = colIndex['金额(元)'] ?? colIndex['金额(¥)'] ?? colIndex['金额（元）'];
    const payMethodCol = colIndex['支付方式'];
    const statusCol = colIndex['当前状态'];

    if (dateCol === undefined || amountCol === undefined || directionCol === undefined) {
      return [];
    }

    const dataRows = records.slice(1);
    const results: ParsedTransaction[] = [];

    for (const row of dataRows) {
      // Filter by status
      const status = statusCol !== undefined ? row[statusCol]?.trim() : '';
      if (SKIP_STATUSES.includes(status)) {
        continue;
      }
      if (status && !VALID_STATUSES.includes(status)) {
        continue;
      }

      const dateStr = row[dateCol]?.trim();
      if (!dateStr) continue;

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;

      // Amount has '¥' prefix (e.g. "¥123.45"), strip it
      const amountStr = row[amountCol]?.trim();
      if (!amountStr) continue;

      const amount = parseFloat(amountStr.replace(/[¥￥,\s]/g, ''));
      if (isNaN(amount) || amount === 0) continue;

      // Direction: 收入/支出/不计收支
      const direction = row[directionCol]?.trim();
      let txType: 'income' | 'expense' | 'transfer';
      if (direction === '收入') {
        txType = 'income';
      } else if (direction === '支出') {
        txType = 'expense';
      } else {
        txType = 'transfer';
      }

      const counterparty = counterpartyCol !== undefined ? row[counterpartyCol]?.trim() : '';
      const productDesc = descCol !== undefined ? row[descCol]?.trim() : '';
      const description = productDesc
        ? counterparty
          ? `${counterparty} - ${productDesc}`
          : productDesc
        : counterparty || '';

      const txTypeStr = typeCol !== undefined ? row[typeCol]?.trim() : undefined;
      const accountName = payMethodCol !== undefined ? row[payMethodCol]?.trim() : undefined;

      results.push({
        date,
        amount,
        type: txType,
        description,
        category: txTypeStr || undefined,
        accountName: accountName || undefined,
        currency: 'CNY',
      });
    }

    return results;
  }
}
