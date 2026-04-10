import { parse } from 'csv-parse/sync';
import { TransactionImporter, ParsedTransaction, ImportOptions } from './types';

export interface CsvColumnMapping {
  date: number; // date column index
  amount: number; // amount column index
  description?: number; // description column index
  type?: number; // type column index
  category?: number; // category column index
  account?: number; // account column index
}

export const defaultMapping: CsvColumnMapping = {
  date: 0,
  amount: 1,
  description: 2,
  type: 3,
  category: 4,
  account: 5,
};

export class CsvImporter implements TransactionImporter {
  constructor(
    private mapping: CsvColumnMapping = defaultMapping,
    private encoding?: string,
  ) {}

  async parseFile(data: Buffer, _options?: ImportOptions): Promise<ParsedTransaction[]> {
    let content = data.toString(this.encoding === 'utf-8' ? 'utf-8' : 'utf-8');

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const records: string[][] = parse(content, {
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });

    if (records.length < 2) {
      return [];
    }

    // First row is header, skip it
    const dataRows = records.slice(1);
    const results: ParsedTransaction[] = [];

    for (const row of dataRows) {
      const dateStr = row[this.mapping.date];
      const amountStr = row[this.mapping.amount];

      if (!dateStr || !amountStr) {
        continue;
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        continue;
      }

      const amount = parseFloat(amountStr.replace(/[^\d.\-]/g, ''));
      if (isNaN(amount) || amount === 0) {
        continue;
      }

      let type: 'income' | 'expense' | 'transfer' = amount > 0 ? 'income' : 'expense';

      if (this.mapping.type !== undefined && row[this.mapping.type]) {
        const typeStr = row[this.mapping.type].toLowerCase().trim();
        if (typeStr === 'income' || typeStr === '收入') {
          type = 'income';
        } else if (typeStr === 'expense' || typeStr === '支出') {
          type = 'expense';
        } else if (typeStr === 'transfer' || typeStr === '转账') {
          type = 'transfer';
        }
      }

      const description =
        this.mapping.description !== undefined && row[this.mapping.description]
          ? row[this.mapping.description].trim()
          : '';

      const category =
        this.mapping.category !== undefined && row[this.mapping.category]
          ? row[this.mapping.category].trim()
          : undefined;

      const accountName =
        this.mapping.account !== undefined && row[this.mapping.account]
          ? row[this.mapping.account].trim()
          : undefined;

      results.push({
        date,
        amount: Math.abs(amount),
        type,
        description,
        category,
        accountName,
      });
    }

    return results;
  }
}
