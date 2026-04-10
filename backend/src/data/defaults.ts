export interface DefaultAccount {
  name: string;
  accountType: string;
  icon: string;
}

export interface DefaultCategory {
  name: string;
  type: string;
  icon: string;
  sortOrder: number;
}

export const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  { name: '现金', accountType: 'asset', icon: '💵' },
  { name: '银行卡', accountType: 'asset', icon: '🏦' },
  { name: '支付宝', accountType: 'asset', icon: '💙' },
  { name: '微信钱包', accountType: 'asset', icon: '💚' },
  { name: '信用卡', accountType: 'liability', icon: '💳' },
  { name: '日常支出', accountType: 'expense', icon: '💸' },
  { name: '工资收入', accountType: 'income', icon: '💰' },
  { name: '其他收入', accountType: 'income', icon: '💡' },
  { name: '其他支出', accountType: 'expense', icon: '📌' },
];

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: '餐饮', type: 'expense', icon: '🍜', sortOrder: 0 },
  { name: '交通', type: 'expense', icon: '🚌', sortOrder: 1 },
  { name: '购物', type: 'expense', icon: '🛒', sortOrder: 2 },
  { name: '居住', type: 'expense', icon: '🏠', sortOrder: 3 },
  { name: '医疗', type: 'expense', icon: '🏥', sortOrder: 4 },
  { name: '教育', type: 'expense', icon: '📚', sortOrder: 5 },
  { name: '娱乐', type: 'expense', icon: '🎮', sortOrder: 6 },
  { name: '通讯', type: 'expense', icon: '📱', sortOrder: 7 },
  { name: '日用', type: 'expense', icon: '🧴', sortOrder: 8 },
  { name: '服饰', type: 'expense', icon: '👔', sortOrder: 9 },
  { name: '其他支出', type: 'expense', icon: '📌', sortOrder: 10 },
  { name: '工资', type: 'income', icon: '💰', sortOrder: 11 },
  { name: '奖金', type: 'income', icon: '🎁', sortOrder: 12 },
  { name: '兼职', type: 'income', icon: '💼', sortOrder: 13 },
  { name: '投资收益', type: 'income', icon: '📈', sortOrder: 14 },
  { name: '红包礼金', type: 'income', icon: '🧧', sortOrder: 15 },
  { name: '其他收入', type: 'income', icon: '💡', sortOrder: 16 },
];
