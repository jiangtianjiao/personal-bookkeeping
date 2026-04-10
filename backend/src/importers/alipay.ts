import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { TransactionImporter, ParsedTransaction, ImportOptions } from './types';

const VALID_STATUSES = ['交易成功', '支付成功', '还款成功', '退款成功'];
const SKIP_STATUSES = ['交易关闭'];

export class AlipayImporter implements TransactionImporter {
  async parseFile(data: Buffer, _options?: ImportOptions): Promise<ParsedTransaction[]> {
    // GB18030 -> UTF-8
    let content = iconv.decode(data, 'gb18030');

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
    const categoryCol = colIndex['交易分类'];
    const counterpartyCol = colIndex['交易对方'];
    const descCol = colIndex['商品说明'];
    const amountCol = colIndex['金额(元)'] ?? colIndex['金额（元）'];
    const directionCol = colIndex['收/支'];
    const statusCol = colIndex['交易状态'];
    const payMethodCol = colIndex['收/支方式'] ?? colIndex['支付方式'];

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

      // Amount is a plain number (e.g. "123.45")
      const amountStr = row[amountCol]?.trim();
      if (!amountStr) continue;

      const amount = parseFloat(amountStr.replace(/[^\d.]/g, ''));
      if (isNaN(amount) || amount === 0) continue;

      // Direction: 收入/支出/不计收支
      const direction = row[directionCol]?.trim();
      let type: 'income' | 'expense' | 'transfer';
      if (direction === '收入') {
        type = 'income';
      } else if (direction === '支出') {
        type = 'expense';
      } else {
        // '不计收支' or other - treat as transfer
        type = 'transfer';
      }

      const counterparty = counterpartyCol !== undefined ? row[counterpartyCol]?.trim() : '';
      const productDesc = descCol !== undefined ? row[descCol]?.trim() : '';
      const description = productDesc
        ? counterparty
          ? `${counterparty} - ${productDesc}`
          : productDesc
        : counterparty || '';

      const category = categoryCol !== undefined ? row[categoryCol]?.trim() : undefined;
      const accountName = payMethodCol !== undefined ? row[payMethodCol]?.trim() : undefined;

      results.push({
        date,
        amount,
        type,
        description,
        category: category || undefined,
        accountName: accountName || undefined,
        currency: 'CNY',
      });
    }

    return results;
  }
}
