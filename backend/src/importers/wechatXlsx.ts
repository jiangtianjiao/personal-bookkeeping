import readXlsxFile from 'read-excel-file/node';
import { TransactionImporter, ParsedTransaction, ImportOptions } from './types';

const VALID_STATUSES = ['支付成功', '已转账', '已收钱', '朋友已收钱', '已存入零钱'];
const SKIP_STATUSES = ['已退款', '已全额退款', '对方已退还'];

export class WeChatXlsxImporter implements TransactionImporter {
  async parseFile(data: Buffer, _options?: ImportOptions): Promise<ParsedTransaction[]> {
    const raw: any = await readXlsxFile(data);

    // read-excel-file may return [{sheet, data}] or Row[][]
    let rows: any[][];
    if (Array.isArray(raw) && raw.length > 0 && raw[0]?.data) {
      rows = raw[0].data;
    } else {
      rows = raw;
    }

    if (!Array.isArray(rows) || rows.length < 2) return [];

    // Find header row containing '交易时间'
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (Array.isArray(row) && row.some((cell: any) => String(cell || '').trim() === '交易时间')) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) return [];

    // Map header columns
    const headerRow = rows[headerIdx] as any[];
    const header = headerRow.map((cell: any) => String(cell || '').trim());
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

    const dataRows = rows.slice(headerIdx + 1);
    const results: ParsedTransaction[] = [];

    for (const row of dataRows) {
      if (!Array.isArray(row)) continue;

      const cell = (idx: number | undefined): string => {
        if (idx === undefined || idx >= row.length) return '';
        const val = row[idx];
        if (val === null || val === undefined) return '';
        return String(val).trim();
      };

      // Filter by status
      const status = cell(statusCol);
      if (SKIP_STATUSES.includes(status)) continue;
      if (status && !VALID_STATUSES.includes(status)) continue;

      const dateStr = cell(dateCol);
      if (!dateStr) continue;

      // Date: could be Date object, JS Date string, or YYYY-MM-DD string
      let date: Date;
      const rawDate = row[dateCol];
      if (rawDate instanceof Date) {
        date = rawDate;
      } else {
        // Try parsing various formats
        date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          // Try extracting date from strings like "Thu Apr 09 2026 06:22:32 GMT+0800 (..."
          const match = dateStr.match(/(\w+ \w+ \d+ \d+ \d+:\d+:\d+)/);
          if (match) {
            date = new Date(match[1]);
          }
          if (isNaN(date.getTime())) continue;
        }
      }

      // Amount: strip ¥ prefix and whitespace
      const amountStr = cell(amountCol);
      if (!amountStr) continue;
      const amount = parseFloat(amountStr.replace(/[¥￥,\s]/g, ''));
      if (isNaN(amount) || amount === 0) continue;

      // Direction
      const direction = cell(directionCol);
      let txType: 'income' | 'expense' | 'transfer';
      if (direction === '收入') {
        txType = 'income';
      } else if (direction === '支出') {
        txType = 'expense';
      } else {
        txType = 'transfer';
      }

      const counterparty = cell(counterpartyCol);
      const productDesc = cell(descCol);
      const description = productDesc && productDesc !== '/'
        ? counterparty && counterparty !== '/'
          ? `${counterparty} - ${productDesc}`
          : productDesc
        : counterparty && counterparty !== '/'
          ? counterparty
          : '';

      if (!description) continue;

      const txTypeStr = cell(typeCol);
      const accountName = cell(payMethodCol);

      results.push({
        date,
        amount,
        type: txType,
        description,
        category: txTypeStr || undefined,
        accountName: accountName && accountName !== '/' ? accountName : undefined,
        currency: 'CNY',
      });
    }

    return results;
  }
}
