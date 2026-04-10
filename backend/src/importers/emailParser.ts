/**
 * Bank email parsers - extract transaction info from forwarded bank notification emails.
 * Handles both direct bank emails and forwarded emails (Fw:/转发).
 */

export interface ParsedEmailTransaction {
  date: Date;
  amount: number; // in yuan
  type: 'income' | 'expense' | 'transfer';
  description: string;
  merchant?: string;
  cardLast4?: string;
  source: string; // which parser matched
  originalCategory?: string; // bank's category label, e.g. 还款, 消费, 分期
}

export interface ParsedEmailResult {
  bankName: string;
  cardLast4?: string;
  billSummary?: {
    totalAmount: number;
    billDate: Date;
    billPeriod?: string;
    dueDate?: string;
  };
  transactions: ParsedEmailTransaction[];
}

interface EmailParserRule {
  name: string;
  senderPatterns: RegExp[];
  subjectPatterns: RegExp[];
  parse: (text: string, subject: string, date: Date) => ParsedEmailResult | null;
}

// ===== Helpers =====

/** Extract original sender from forwarded email body */
function extractOriginalSender(text: string): string {
  const patterns = [
    /发件人[：:]\s*(.+?)(?:\n|<br)/i,
    /From[：:]\s*(.+?)(?:\n|<br)/i,
    /原始邮件.*?发件人[：:]\s*(.+?)(?:\n|<br)/i,
  ];
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) return match[1].trim();
  }
  return '';
}

/** Strip Fw:/Re:/转发: prefixes from subject */
function cleanSubject(subject: string): string {
  return subject.replace(/^(?:Fw|Fwd|Re|转发)[：:]\s*/i, '').trim();
}

/** Extract card last 4 digits */
function extractCardLast4(text: string): string | undefined {
  const match = text.match(/(?:尾号|末四位|卡号[^\d]*)(\d{4})/);
  return match ? match[1] : undefined;
}

/** Extract date from email body */
function extractDateFromBody(text: string, fallback: Date): Date {
  const patterns = [
    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日号]?\s*(\d{1,2}):(\d{1,2})/,
    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/,
  ];
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) {
      const [, y, m, d, h, min] = match;
      return new Date(
        parseInt(y), parseInt(m) - 1, parseInt(d),
        h ? parseInt(h) : 0, min ? parseInt(min) : 0,
      );
    }
  }
  return fallback;
}

/** Strip HTML tags to plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|tr|td|th|li|h\d)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Determine transaction type from originalCategory */
function typeFromCategory(category: string, defaultType: 'income' | 'expense'): 'income' | 'expense' | 'transfer' {
  if (/还款/.test(category)) return 'transfer';
  if (/退款/.test(category)) return 'income';
  return defaultType;
}

// ===== Parsers =====

const parsers: EmailParserRule[] = [
  // ===== 招商银行信用卡月度账单 =====
  {
    name: '招商银行账单',
    senderPatterns: [/cmbchina/i, /cmb/i, /招商银行/],
    subjectPatterns: [/招商银行.*账单/, /招商银行.*信用卡/],
    parse: (text, _subject, emailDate) => {
      const transactions: ParsedEmailTransaction[] = [];
      const cardLast4 = extractCardLast4(text);

      let billSummary: ParsedEmailResult['billSummary'] | undefined;

      // 月度账单格式：提取"本期应还金额 New Balance"
      const balanceMatch = text.match(
        /本期应还金额\s*(?:New Balance)?\s*[¥￥]?\s*([\d,]+\.?\d*)/i,
      );
      if (balanceMatch) {
        const amount = parseFloat(balanceMatch[1].replace(/,/g, ''));
        if (amount > 0) {
          const monthMatch = text.match(/(\d{4})\s*年?\s*(\d{1,2})\s*月/);
          const billDate = monthMatch
            ? new Date(parseInt(monthMatch[1]), parseInt(monthMatch[2]) - 1, 1)
            : emailDate;

          const dueDateMatch = text.match(/到期还款日\s*(?:Payment Due Date)?\s*(\d{4}[年\-\/]\d{1,2}[月\-\/]\d{1,2})/i);

          billSummary = {
            totalAmount: amount,
            billDate,
            billPeriod: monthMatch ? `${monthMatch[1]}年${monthMatch[2]}月` : undefined,
            dueDate: dueDateMatch ? dueDateMatch[1] : undefined,
          };
        }
      }

      // 提取账单中的交易明细行
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

      const isValidMMDD = (s: string): boolean => {
        if (!/^\d{4}$/.test(s)) return false;
        const mm = parseInt(s.substring(0, 2));
        const dd = parseInt(s.substring(2, 4));
        return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
      };

      let detailStart = -1;
      for (let idx = 0; idx < lines.length; idx++) {
        if (lines[idx] === '交易日' || /^Trans\s*Date$/i.test(lines[idx])) {
          detailStart = idx;
          break;
        }
      }

      if (detailStart >= 0) {
        let i = detailStart;
        while (i < lines.length && /^(交易日|记账日|交易摘要|人民币金额|卡号末四位|交易地金额|交易地|Trans|Post|Description|RMB|Card|Original|Country)/i.test(lines[i])) {
          i++;
        }

        let currentCategory = '';

        while (i < lines.length) {
          if (/^[★●]/.test(lines[i]) || /上述交易摘要/.test(lines[i])) break;

          if (/^(?:还款|分期|退款|消费|取现|其他)$/.test(lines[i])) {
            currentCategory = lines[i];
            i++;
            continue;
          }

          if (!isValidMMDD(lines[i])) { i++; continue; }

          const transDateStr = lines[i];
          i++;

          if (i < lines.length && isValidMMDD(lines[i])) {
            i++;
          }

          if (i >= lines.length) break;
          const description = lines[i];
          i++;

          if (i >= lines.length) break;
          const amtMatch = lines[i].match(/^[¥￥]\s*(-?[\d,]+\.?\d*)$/);
          if (!amtMatch) { continue; }
          const amountStr = amtMatch[1];
          i++;

          let cardLast4Str = '';
          if (i < lines.length && /^\d{4}$/.test(lines[i])) {
            cardLast4Str = lines[i];
            i++;
          }

          if (i < lines.length && /^-?[\d,]+\.?\d*$/.test(lines[i])) {
            i++;
          }

          if (i < lines.length && /^[A-Z]{2}$/.test(lines[i])) {
            i++;
          }

          const amount = parseFloat(amountStr.replace(/,/g, ''));
          if (isNaN(amount) || amount === 0) continue;

          const mm = parseInt(transDateStr.substring(0, 2));
          const dd = parseInt(transDateStr.substring(2, 4));
          const year = emailDate.getFullYear();
          const txDate = new Date(year, mm - 1, dd);

          const defaultType = amount < 0 ? 'income' : 'expense';
          const txType = currentCategory ? typeFromCategory(currentCategory, defaultType) : defaultType;

          transactions.push({
            date: txDate,
            amount: Math.abs(amount),
            type: txType,
            description,
            merchant: description,
            cardLast4: cardLast4Str || undefined,
            source: '招商银行明细',
            originalCategory: currentCategory || undefined,
          });
        }
      }

      if (!billSummary && transactions.length === 0) return null;

      return {
        bankName: '招商银行',
        cardLast4,
        billSummary,
        transactions,
      };
    },
  },

  // ===== 中国农业银行信用卡账单 =====
  {
    name: '农业银行账单',
    senderPatterns: [/abchina/i, /农业银行/],
    subjectPatterns: [/农业银行/, /金穗信用卡/],
    parse: (text, _subject, emailDate) => {
      const transactions: ParsedEmailTransaction[] = [];
      const cardLast4 = extractCardLast4(text);

      let billSummary: ParsedEmailResult['billSummary'] | undefined;

      // 提取总账单金额
      const balanceMatch = text.match(
        /本期应还款额.*?New Balance\s*\n\s*人民币\(CNY\)\s*(-?[\d,]+\.?\d*)/i,
      );
      if (balanceMatch) {
        const amount = Math.abs(parseFloat(balanceMatch[1].replace(/,/g, '')));
        if (amount > 0) {
          const cycleMatch = text.match(/账单周期.*?(\d{4}\/\d{2}\/\d{2})-(\d{4}\/\d{2}\/\d{2})/);
          const billDate = cycleMatch ? new Date(cycleMatch[2]) : emailDate;

          const dueDateMatch = text.match(/到期还款日[：:]\s*(\d{4}\/\d{2}\/\d{2})/i);

          billSummary = {
            totalAmount: amount,
            billDate,
            billPeriod: cycleMatch ? `${cycleMatch[1]}~${cycleMatch[2]}` : undefined,
            dueDate: dueDateMatch ? dueDateMatch[1] : undefined,
          };
        }
      }

      // 提取交易明细
      const detailPattern = /^(\d{6})\s+(\d{6})\s+(?:(\d{4})\s+)?(.+?)\s+([\d,]+\.?\d*)\/CNY\s+(-?[\d,]+\.?\d*)\/CNY\s*$/gm;

      // 先逐行检测分类标题
      const lineArray = text.split('\n');
      const categoryMap = new Map<number, string>();
      lineArray.forEach((line, idx) => {
        const trimmed = line.trim();
        if (/^●\s*(还款|分期|消费|退款|取现|其他)/.test(trimmed)) {
          categoryMap.set(idx, trimmed.replace(/^●\s*/, ''));
        }
      });

      let match;
      while ((match = detailPattern.exec(text)) !== null) {
        const [, transDateStr, , cardNo, description, , settAmtStr] = match;
        const settAmt = parseFloat(settAmtStr.replace(/,/g, ''));
        if (isNaN(settAmt) || settAmt === 0) continue;

        const yy = parseInt(transDateStr.substring(0, 2));
        const mm = parseInt(transDateStr.substring(2, 4));
        const dd = parseInt(transDateStr.substring(4, 6));
        const year = yy < 50 ? 2000 + yy : 1900 + yy;
        const txDate = new Date(year, mm - 1, dd);

        const matchPos = text.substring(0, match.index).split('\n').length - 1;
        let cat = '';
        for (const [lineIdx, catName] of categoryMap) {
          if (lineIdx <= matchPos) cat = catName;
        }

        const defaultType: 'income' | 'expense' = settAmt > 0 ? 'income' : 'expense';
        const txType = cat ? typeFromCategory(cat, defaultType) : defaultType;

        transactions.push({
          date: txDate,
          amount: Math.abs(settAmt),
          type: txType,
          description: description.trim(),
          merchant: description.trim(),
          cardLast4: cardNo || undefined,
          source: '农业银行明细',
          originalCategory: cat || undefined,
        });
      }

      if (!billSummary && transactions.length === 0) return null;

      return {
        bankName: '农业银行',
        cardLast4,
        billSummary,
        transactions,
      };
    },
  },

  // ===== 招商银行交易通知（单笔） =====
  {
    name: '招商银行交易',
    senderPatterns: [/cmbchina/i, /cmb/i, /招商银行/],
    subjectPatterns: [/交易提醒/, /消费提醒/, /招商银行/],
    parse: (text, _subject, emailDate) => {
      const amountPatterns = [
        /(?:消费|支出|扣款)\s*(?:人民币|RMB|¥|￥)\s*([\d,]+\.?\d*)/,
        /(?:还款|退款|入账)\s*(?:人民币|RMB|¥|￥)\s*([\d,]+\.?\d*)/,
        /(?:人民币|RMB|¥|￥)\s*([\d,]+\.?\d*)\s*(?:消费|支出|扣款)/,
      ];

      for (const pat of amountPatterns) {
        const match = text.match(pat);
        if (match) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (amount <= 0) continue;

          const isRepayment = /还款/.test(text);
          const isRefund = /退款/.test(text);
          let txType: 'income' | 'expense' | 'transfer' = 'expense';
          let originalCategory: string | undefined;

          if (isRepayment) {
            txType = 'transfer';
            originalCategory = '还款';
          } else if (isRefund) {
            txType = 'income';
            originalCategory = '退款';
          } else if (/入账/.test(text)) {
            txType = 'income';
            originalCategory = '入账';
          } else if (/消费|支出|扣款/.test(text)) {
            originalCategory = '消费';
          }

          const merchantMatch = text.match(/(?:商户|商家|交易对方|收款方)[：:]\s*(.+?)(?:\s|$|[，,。；])/);

          return {
            bankName: '招商银行',
            cardLast4: extractCardLast4(text),
            transactions: [{
              date: extractDateFromBody(text, emailDate),
              amount,
              type: txType,
              description: merchantMatch?.[1]?.trim() || '招商银行交易',
              merchant: merchantMatch?.[1]?.trim(),
              cardLast4: extractCardLast4(text),
              source: '招商银行',
              originalCategory,
            }],
          };
        }
      }
      return null;
    },
  },

  // ===== 工商银行 =====
  {
    name: '工商银行',
    senderPatterns: [/icbc/i, /工商银行/],
    subjectPatterns: [/工商银行/, /工行/],
    parse: (text, _subject, emailDate) => {
      const amountMatch = text.match(/(?:人民币|RMB|¥|￥)\s*([\d,]+\.?\d*)/);
      if (!amountMatch) return null;
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount <= 0) return null;

      const isRepayment = /还款/.test(text);
      const isRefund = /退款/.test(text);
      const isExpense = /支出|消费|扣款|转出/.test(text);

      let txType: 'income' | 'expense' | 'transfer' = 'income';
      let originalCategory: string | undefined;

      if (isRepayment) {
        txType = 'transfer';
        originalCategory = '还款';
      } else if (isRefund) {
        txType = 'income';
        originalCategory = '退款';
      } else if (isExpense) {
        txType = 'expense';
        originalCategory = '消费';
      }

      const merchantMatch = text.match(/(?:商户|对方|摘要)[：:]\s*(.+?)(?:\s|$|[，,。；])/);
      const cardLast4 = extractCardLast4(text);

      return {
        bankName: '工商银行',
        cardLast4,
        transactions: [{
          date: extractDateFromBody(text, emailDate),
          amount,
          type: txType,
          description: merchantMatch?.[1]?.trim() || '工商银行交易',
          merchant: merchantMatch?.[1]?.trim(),
          cardLast4,
          source: '工商银行',
          originalCategory,
        }],
      };
    },
  },

  // ===== 建设银行 =====
  {
    name: '建设银行',
    senderPatterns: [/ccb\.com/i, /建设银行/],
    subjectPatterns: [/建设银行/, /建行/],
    parse: (text, _subject, emailDate) => {
      const amountMatch = text.match(/(?:人民币|RMB|¥|￥)\s*([\d,]+\.?\d*)/);
      if (!amountMatch) return null;
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount <= 0) return null;

      const isRepayment = /还款/.test(text);
      const isRefund = /退款/.test(text);
      const isExpense = /支出|消费|扣款/.test(text);

      let txType: 'income' | 'expense' | 'transfer' = 'income';
      let originalCategory: string | undefined;

      if (isRepayment) {
        txType = 'transfer';
        originalCategory = '还款';
      } else if (isRefund) {
        txType = 'income';
        originalCategory = '退款';
      } else if (isExpense) {
        txType = 'expense';
        originalCategory = '消费';
      }

      const merchantMatch = text.match(/(?:商户|对方|摘要)[：:]\s*(.+?)(?:\s|$|[，,。；])/);
      const cardLast4 = extractCardLast4(text);

      return {
        bankName: '建设银行',
        cardLast4,
        transactions: [{
          date: extractDateFromBody(text, emailDate),
          amount,
          type: txType,
          description: merchantMatch?.[1]?.trim() || '建设银行交易',
          merchant: merchantMatch?.[1]?.trim(),
          cardLast4,
          source: '建设银行',
          originalCategory,
        }],
      };
    },
  },

  // ===== 支付宝 =====
  {
    name: '支付宝',
    senderPatterns: [/alipay/i, /支付宝/],
    subjectPatterns: [/支付宝/],
    parse: (text, _subject, emailDate) => {
      const amountMatch = text.match(/(?:人民币|RMB|¥|￥)\s*([\d,]+\.?\d*)/);
      if (!amountMatch) return null;
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount <= 0) return null;

      const isRefund = /退款/.test(text);
      const isIncome = /收入|转入|到账/.test(text);

      let txType: 'income' | 'expense' | 'transfer' = 'expense';
      let originalCategory: string | undefined;

      if (isRefund) {
        txType = 'income';
        originalCategory = '退款';
      } else if (isIncome) {
        txType = 'income';
      }

      const merchantMatch = text.match(/(?:商户|对方|交易对方)[：:]\s*(.+?)(?:\s|$|[，,。；])/);

      return {
        bankName: '支付宝',
        transactions: [{
          date: extractDateFromBody(text, emailDate),
          amount,
          type: txType,
          description: merchantMatch?.[1]?.trim() || '支付宝交易',
          merchant: merchantMatch?.[1]?.trim(),
          source: '支付宝',
          originalCategory,
        }],
      };
    },
  },

  // ===== 通用解析器 (fallback) =====
  {
    name: '通用',
    senderPatterns: [/.*/],
    subjectPatterns: [/交易|消费|支出|收入|扣款|还款|转账|到账/],
    parse: (text, subject, emailDate) => {
      const amountMatch = text.match(/(?:人民币|RMB|¥|￥)\s*([\d,]+\.?\d*)|([\d,]+\.?\d*)\s*元/);
      if (!amountMatch) return null;
      const amount = parseFloat((amountMatch[1] || amountMatch[2]).replace(/,/g, ''));
      if (amount <= 0 || amount > 1000000) return null;

      const isRepayment = /还款/.test(text + subject);
      const isRefund = /退款/.test(text + subject);
      const isIncome = /收入|转入|到账/.test(text + subject);

      let txType: 'income' | 'expense' | 'transfer' = 'expense';
      let originalCategory: string | undefined;

      if (isRepayment) {
        txType = 'transfer';
        originalCategory = '还款';
      } else if (isRefund) {
        txType = 'income';
        originalCategory = '退款';
      } else if (isIncome) {
        txType = 'income';
      }

      const merchantMatch = text.match(/(?:商户|商家|对方|交易对方|收款方|摘要|备注)[：:]\s*(.+?)(?:\s|$|[，,。；])/);

      return {
        bankName: '通用',
        cardLast4: extractCardLast4(text),
        transactions: [{
          date: extractDateFromBody(text, emailDate),
          amount,
          type: txType,
          description: merchantMatch?.[1]?.trim() || cleanSubject(subject).slice(0, 50),
          merchant: merchantMatch?.[1]?.trim(),
          cardLast4: extractCardLast4(text),
          source: '通用解析',
          originalCategory,
        }],
      };
    },
  },
];

/** Skip non-financial emails */
const SKIP_SUBJECTS = [/安全提醒/, /两步验证/, /密码/, /登录/, /验证码/, /安全码/];

export function parseEmailContent(
  html: string,
  plainText: string,
  subject: string,
  from: string,
  emailDate: Date,
): ParsedEmailResult | null {
  // Skip security/verification emails
  if (SKIP_SUBJECTS.some((p) => p.test(subject))) return null;

  const text = plainText || stripHtml(html);
  const cleanedSubject = cleanSubject(subject);

  // For forwarded emails, extract original sender from body
  const isForwarded = /^(?:Fw|Fwd|转发)[：:]/i.test(subject);
  const effectiveFrom = isForwarded ? extractOriginalSender(text) || from : from;

  for (const parser of parsers) {
    const senderMatch = parser.senderPatterns.some((p) => p.test(effectiveFrom));
    const subjectMatch = parser.subjectPatterns.some((p) => p.test(cleanedSubject));

    if (senderMatch || subjectMatch) {
      const result = parser.parse(text, cleanedSubject, emailDate);
      if (result && (result.transactions.length > 0 || result.billSummary)) {
        return result;
      }
    }
  }

  return null;
}
