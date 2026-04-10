/** 元转分 */
export const toCents = (yuan: number): number => Math.round(yuan * 100);

/** 分转元 */
export const toYuan = (cents: number): number => cents / 100;
