import { Injectable, Logger } from '@nestjs/common';
import { PhysicalPrisma } from '../prisma/physical.service';
import { LogicalPrisma } from '../prisma/logical.service';
import { buildLines, TxnType } from './double-entry';

export interface PostTxnInput {
  storeId: string;
  type: TxnType;
  amount: number;
  isPersonal: boolean;
  party?: string;
  sku?: string; // optional inventory movement
}

@Injectable()
export class PostingService {
  private readonly log = new Logger('PostingService');

  constructor(
    private readonly physical: PhysicalPrisma,
    private readonly logical: LogicalPrisma,
  ) {}

  /**
   * Posting flow:
   *  1. Build balanced double-entry lines.
   *  2. (Logical, one tx) write Transaction + lines, adjust inventory, write OUTBOX row.
   *  3. If NOT personal -> write Physical ledger_entries SYNCHRONOUSLY (direct).
   *     If personal -> Physical is skipped entirely.
   *  The outbox is later drained into the Logical ledger by OutboxWorker, so
   *  Logical = Physical + Personal.
   */
  async post(input: PostTxnInput) {
    const { storeId, type, amount, isPersonal, party, sku } = input;
    const lines = buildLines({ type, amount, isPersonal });

    // --- Step 2: Logical intake + outbox (atomic) ---
    const txn = await this.logical.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          storeId,
          type,
          isPersonal,
          amount,
          party,
          lines: { create: lines.map((l) => ({ accountCode: l.accountCode, debit: l.debit, credit: l.credit })) },
        },
      });

      if (sku) {
        const delta = type === 'PURCHASE' ? 1 : -1;
        await tx.inventoryItem.updateMany({
          where: { storeId, sku },
          data: { qty: { increment: delta } },
        });
      }

      await tx.outbox.create({
        data: {
          txnId: t.id,
          payload: { storeId, type, isPersonal, amount, lines } as any,
        },
      });

      return t;
    });

    // --- Step 3: Physical direct write (non-personal only) ---
    let physicalWritten = false;
    if (!isPersonal) {
      try {
        await this.physical.ledgerEntry.createMany({
          data: lines.map((l) => ({
            storeId,
            accountCode: l.accountCode,
            debit: l.debit,
            credit: l.credit,
            memo: `${type}${party ? ' · ' + party : ''}`,
            sourceTxnId: `${txn.id}:${l.accountCode}`,
          })),
          skipDuplicates: true,
        });
        physicalWritten = true;
      } catch (e) {
        this.log.error(`physical write failed for txn ${txn.id}: ${e}`);
      }
    }

    return {
      txnId: txn.id,
      isPersonal,
      physicalWritten,
      logicalPending: true, // worker will drain shortly
      lines,
    };
  }
}
