export interface ImportOptions {
  defaultAccountId?: string;
  defaultCategoryId?: string;
  timezone?: string;
}

export interface ParsedTransaction {
  date: Date;
  amount: number; // in yuan (converted to cents before DB insert)
  type: 'income' | 'expense' | 'transfer';
  description: string;
  category?: string; // category name (for matching or creating)
  accountName?: string; // account name
  relatedAccountName?: string;
  currency?: string;
}

export interface TransactionImporter {
  parseFile(data: Buffer, options?: ImportOptions): Promise<ParsedTransaction[]>;
}
