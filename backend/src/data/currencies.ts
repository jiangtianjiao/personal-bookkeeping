export interface Currency {
  code: string;
  name: string;
  symbol: string;
  precision: number;
}

export const CURRENCIES: Currency[] = [
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', precision: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', precision: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', precision: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', precision: 0 },
  { code: 'GBP', name: 'British Pound', symbol: '£', precision: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', precision: 2 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', precision: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', precision: 0 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', precision: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', precision: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', precision: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', precision: 2 },
];

export const CURRENCY_MAP = new Map(CURRENCIES.map((c) => [c.code, c]));
