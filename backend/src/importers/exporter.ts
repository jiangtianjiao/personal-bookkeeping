import { toYuan } from '../utils/amount';

export interface ExportableTransaction {
  transactionDate: Date | string;
  description?: string | null;
  category?: { name: string } | null;
  status: string;
  entries: {
    account: { name: string; accountType: string };
    entryType: string;
    amount: number; // cents
  }[];
}

export async function exportTransactions(
  transactions: ExportableTransaction[],
  format: 'csv' | 'tsv',
): Promise<Buffer> {
  const separator = format === 'tsv' ? '\t' : ',';
  const headers = ['Date', 'Description', 'Category', 'Account', 'Amount', 'Type'];

  const rows: string[] = [headers.join(separator)];

  for (const tx of transactions) {
    const date =
      tx.transactionDate instanceof Date
        ? tx.transactionDate.toISOString().split('T')[0]
        : new Date(tx.transactionDate).toISOString().split('T')[0];

    const description = tx.description || '';
    const category = tx.category?.name || '';

    // Determine transaction type and primary account from entries
    let type = 'expense';
    let accountName = '';
    let amount = 0;

    if (tx.entries.length >= 2) {
      const debitEntry = tx.entries.find((e) => e.entryType === 'debit');
      const creditEntry = tx.entries.find((e) => e.entryType === 'credit');

      if (debitEntry && creditEntry) {
        if (debitEntry.account.accountType === 'expense') {
          // Debit to expense account -> expense
          type = 'expense';
          accountName = debitEntry.account.name;
          amount = toYuan(debitEntry.amount);
        } else if (creditEntry.account.accountType === 'income') {
          // Credit from income account -> income
          type = 'income';
          accountName = creditEntry.account.name;
          amount = toYuan(creditEntry.amount);
        } else {
          // Other cases -> transfer
          type = 'transfer';
          accountName = creditEntry.account.name;
          amount = toYuan(creditEntry.amount);
        }
      }
    }

    const escapedDesc = escapeField(description, separator);
    const escapedCategory = escapeField(category, separator);
    const escapedAccount = escapeField(accountName, separator);

    rows.push(
      [date, escapedDesc, escapedCategory, escapedAccount, amount.toFixed(2), type].join(separator),
    );
  }

  return Buffer.from(rows.join('\n'), 'utf-8');
}

function escapeField(value: string, separator: string): string {
  if (
    value.includes(separator) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
