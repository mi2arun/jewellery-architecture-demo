// Builds balanced double-entry lines for a transaction.
// Invariant: sum(debit) === sum(credit).

export type TxnType = 'SALE' | 'PURCHASE';

export interface PostingLine {
  accountCode: string;
  debit: number;
  credit: number;
}

export interface BuildInput {
  type: TxnType;
  amount: number;
  isPersonal: boolean;
}

/**
 * Account codes (see seed chart of accounts):
 *  1000 Cash, 1010 Bank, 1200 Inventory,
 *  3000 Owner Drawings (Personal),
 *  4000 Sales, 5000 Purchases
 */
export function buildLines({ type, amount, isPersonal }: BuildInput): PostingLine[] {
  if (amount <= 0) throw new Error('amount must be > 0');

  let lines: PostingLine[];

  if (type === 'SALE') {
    if (isPersonal) {
      // Owner takes goods for personal use: Dr Drawings / Cr Inventory
      lines = [
        { accountCode: '3000', debit: amount, credit: 0 },
        { accountCode: '1200', debit: 0, credit: amount },
      ];
    } else {
      // Business sale: Dr Cash / Cr Sales
      lines = [
        { accountCode: '1000', debit: amount, credit: 0 },
        { accountCode: '4000', debit: 0, credit: amount },
      ];
    }
  } else if (type === 'PURCHASE') {
    if (isPersonal) {
      // Owner-funded personal purchase: Dr Drawings / Cr Bank
      lines = [
        { accountCode: '3000', debit: amount, credit: 0 },
        { accountCode: '1010', debit: 0, credit: amount },
      ];
    } else {
      // Business purchase: Dr Purchases / Cr Bank
      lines = [
        { accountCode: '5000', debit: amount, credit: 0 },
        { accountCode: '1010', debit: 0, credit: amount },
      ];
    }
  } else {
    throw new Error(`unknown transaction type: ${type}`);
  }

  assertBalanced(lines);
  return lines;
}

export function assertBalanced(lines: PostingLine[]): void {
  const dr = round2(lines.reduce((s, l) => s + l.debit, 0));
  const cr = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (dr !== cr) {
    throw new Error(`unbalanced entry: debit ${dr} !== credit ${cr}`);
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
