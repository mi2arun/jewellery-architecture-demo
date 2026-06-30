import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LogicalPrisma } from '../prisma/logical.service';

interface OutboxPayload {
  storeId: string;
  type: string;
  isPersonal: boolean;
  amount: number;
  lines: { accountCode: string; debit: number; credit: number }[];
}

/**
 * In-process transactional-outbox worker.
 * Polls the Logical `outbox` table and writes ledger entries into the Logical
 * ledger. This is the event-driven path that lands EVERY transaction (business
 * and personal) in Logical. Idempotent via LedgerEntry.sourceTxnId unique key.
 */
@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('OutboxWorker');
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly logical: LogicalPrisma) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick(), 1000);
    this.log.log('outbox worker started (poll 1s)');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // avoid overlap
    this.running = true;
    try {
      const pending = await this.logical.outbox.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      for (const row of pending) {
        await this.process(row.id, row.txnId, row.payload as unknown as OutboxPayload);
      }
    } catch (e) {
      this.log.error(`tick failed: ${e}`);
    } finally {
      this.running = false;
    }
  }

  private async process(outboxId: string, txnId: string, payload: OutboxPayload) {
    try {
      await this.logical.ledgerEntry.createMany({
        data: payload.lines.map((l) => ({
          storeId: payload.storeId,
          accountCode: l.accountCode,
          debit: l.debit,
          credit: l.credit,
          isPersonal: payload.isPersonal,
          memo: payload.type,
          sourceTxnId: `${txnId}:${l.accountCode}`,
        })),
        skipDuplicates: true,
      });
      await this.logical.outbox.update({
        where: { id: outboxId },
        data: { status: 'done', processedAt: new Date() },
      });
    } catch (e) {
      this.log.error(`process outbox ${outboxId} failed: ${e}`);
      await this.logical.outbox.update({
        where: { id: outboxId },
        data: { status: 'error', processedAt: new Date() },
      });
    }
  }
}
