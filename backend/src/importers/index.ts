import { TransactionImporter } from './types';
import { CsvImporter, defaultMapping } from './csv';
import { AlipayImporter } from './alipay';
import { WeChatImporter } from './wechat';
import { WeChatXlsxImporter } from './wechatXlsx';
import { AppError } from '../errors/AppError';

export function getImporter(fileType: string): TransactionImporter {
  switch (fileType) {
    case 'csv':
      return new CsvImporter(defaultMapping);
    case 'alipay':
      return new AlipayImporter();
    case 'wechat':
      return new WeChatImporter();
    case 'wechat_xlsx':
      return new WeChatXlsxImporter();
    default:
      throw new AppError(400, `Unsupported file type: ${fileType}`);
  }
}

export { TransactionImporter, CsvImporter, AlipayImporter, WeChatImporter, WeChatXlsxImporter };
export type { ParsedTransaction, ImportOptions } from './types';
