export const formatAmount = (amount: string | number | undefined | null): string => {
  const num = Number(amount);
  if (isNaN(num)) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(num);
};
