import prisma from '../config/database';

/**
 * Normal balance rules:
 * - Asset / Expense:   debit increases, credit decreases  => debits - credits
 * - Liability / Income: credit increases, debit decreases => credits - debits
 */
function applyNormalBalance(accountType: string, totalDebits: number, totalCredits: number): number {
  switch (accountType) {
    case 'asset':
    case 'expense':
      return totalDebits - totalCredits;
    case 'liability':
    case 'income':
      return totalCredits - totalDebits;
    default:
      return totalDebits - totalCredits;
  }
}

export const balanceService = {
  /**
   * Compute balance for a single account from its posted TransactionEntry records.
   */
  async computeAccountBalance(accountId: string, accountType: string): Promise<number> {
    const entries = await prisma.transactionEntry.findMany({
      where: {
        accountId,
        transaction: { status: 'posted' },
      },
      select: {
        entryType: true,
        amount: true,
      },
    });

    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of entries) {
      const amount = Number(entry.amount);
      if (entry.entryType === 'debit') {
        totalDebits += amount;
      } else {
        totalCredits += amount;
      }
    }

    return applyNormalBalance(accountType, totalDebits, totalCredits);
  },

  /**
   * Compute balances for all accounts belonging to a user in a single query.
   * Uses Prisma groupBy to avoid N+1 queries.
   * Returns Map<accountId, balance>.
   */
  async computeAllAccountBalances(userId: string): Promise<Map<string, number>> {
    // First get all accounts for the user so we know their types
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true, accountType: true },
    });

    const accountTypeMap = new Map<string, string>();
    for (const account of accounts) {
      accountTypeMap.set(account.id, account.accountType);
    }

    // Aggregate all posted entries grouped by accountId + entryType
    const aggregations = await prisma.transactionEntry.groupBy({
      by: ['accountId', 'entryType'],
      where: {
        accountId: { in: accounts.map((a: { id: string }) => a.id) },
        transaction: { status: 'posted' },
      },
      _sum: { amount: true },
    });

    // Build per-account debit/credit totals
    const debitTotals = new Map<string, number>();
    const creditTotals = new Map<string, number>();

    for (const agg of aggregations) {
      const amount = agg._sum.amount ?? 0;
      if (agg.entryType === 'debit') {
        debitTotals.set(agg.accountId, amount);
      } else {
        creditTotals.set(agg.accountId, amount);
      }
    }

    // Compute final balance per account
    const balances = new Map<string, number>();
    for (const account of accounts) {
      const totalDebits = debitTotals.get(account.id) ?? 0;
      const totalCredits = creditTotals.get(account.id) ?? 0;
      balances.set(account.id, applyNormalBalance(account.accountType, totalDebits, totalCredits));
    }

    return balances;
  },
};
