const accountingKnowledge = [
  {
    content: `复式记账法基本规则：
- 资产类账户(asset)：借方增加，贷方减少，正常余额在借方
- 负债类账户(liability)：贷方增加，借方减少，正常余额在贷方
- 收入类账户(income)：贷方增加，借方减少
- 支出类账户(expense)：借方增加，贷方减少
- 每笔交易借贷必须平衡：总借方金额 = 总贷方金额`,
    metadata: { topic: 'double_entry_rules' },
  },
  {
    content: `常见记账场景的会计分录：
1. 工资收入：借 银行存款(资产)，贷 工资收入(收入)
2. 餐饮消费：借 餐饮支出(支出)，贷 银行存款/支付宝(资产)
3. 转账：借 目标账户(资产)，贷 源账户(资产)
4. 信用卡还款：借 信用卡(负债)，贷 银行存款(资产)
5. 理财收益：借 银行存款(资产)，贷 投资收益(收入)
6. 房租支出：借 住房支出(支出)，贷 银行存款(资产)
7. 购物消费：借 购物支出(支出)，贷 信用卡/支付宝(负债/资产)`,
    metadata: { topic: 'common_entries' },
  },
  {
    content: `账户类型说明：
- asset(资产)：银行卡余额、支付宝余额、微信钱包、现金、投资等
- liability(负债)：信用卡、花呗、借呗、贷款等
- income(收入)：工资、兼职、投资收益、红包等
- expense(支出)：餐饮、交通、购物、住房、医疗、教育、娱乐等`,
    metadata: { topic: 'account_types' },
  },
  {
    content: `快速记账使用说明：
- 支出(expense)：系统自动借记支出账户，贷记支付账户（如银行卡）
- 收入(income)：系统自动借记收款账户，贷记收入账户
- 转账(transfer)：系统自动借记目标账户，贷记源账户
- 只需提供：金额、类型、账户名称、分类名称（可选）
- 系统会自动查找对应账户，找不到会自动创建`,
    metadata: { topic: 'quick_entry_usage' },
  },
  {
    content: `财务报表说明：
- 资产负债表(Balance Sheet)：反映某一时点的资产、负债和净资产状况
- 收支报表(Income/Expense)：反映某段时间内的收入和支出情况
- 净资产 = 总资产 - 总负债
- 月度结余 = 月收入 - 月支出`,
    metadata: { topic: 'reports' },
  },
];

export function getKnowledgeBase() {
  return accountingKnowledge;
}

export function searchKnowledge(query: string): string {
  const q = query.toLowerCase();
  const relevant = accountingKnowledge.filter(k => {
    const c = k.content.toLowerCase();
    const keywords = q.split(/\s+/);
    return keywords.some(kw => c.includes(kw));
  });

  if (relevant.length === 0) {
    return accountingKnowledge.map(k => k.content).join('\n\n');
  }

  return relevant.map(k => k.content).join('\n\n');
}
