/**
 * Seed: chart of accounts + 4 stores + inventory + curated transactions.
 * Writes intake/outbox to Logical and direct entries to Physical, mirroring the
 * PostingService (kept standalone so seeding needs no running API).
 */
import { PrismaClient as PhysicalClient } from '../node_modules/.prisma/physical';
import { PrismaClient as LogicalClient } from '../node_modules/.prisma/logical';
import { buildLines, TxnType } from '../src/posting/double-entry';

const physical = new PhysicalClient();
const logical = new LogicalClient();

const ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'ASSET' },
  { code: '1010', name: 'Bank', type: 'ASSET' },
  { code: '1200', name: 'Inventory — Gold', type: 'ASSET' },
  { code: '3000', name: 'Owner Drawings (Personal)', type: 'EQUITY' },
  { code: '4000', name: 'Sales', type: 'INCOME' },
  { code: '5000', name: 'Purchases', type: 'EXPENSE' },
];

const STORES = [
  { id: 'S1', name: 'Chennai — T. Nagar', region: 'South' },
  { id: 'S2', name: 'Mumbai — Zaveri Bazaar', region: 'West' },
  { id: 'S3', name: 'Delhi — Karol Bagh', region: 'North' },
  { id: 'S4', name: 'Kolkata — Bowbazar', region: 'East' },
];

// Curated transactions: a clear mix of business and personal across stores.
const TXNS: { storeId: string; type: TxnType; amount: number; isPersonal: boolean; party?: string; sku?: string }[] = [
  { storeId: 'S1', type: 'SALE', amount: 85000, isPersonal: false, party: 'Walk-in', sku: 'RING-22K' },
  { storeId: 'S1', type: 'PURCHASE', amount: 240000, isPersonal: false, party: 'MMTC Supplier', sku: 'BAR-24K' },
  { storeId: 'S1', type: 'SALE', amount: 60000, isPersonal: true, party: 'Owner family', sku: 'CHAIN-22K' }, // PERSONAL
  { storeId: 'S2', type: 'SALE', amount: 125000, isPersonal: false, party: 'Walk-in', sku: 'NECKLACE-22K' },
  { storeId: 'S2', type: 'PURCHASE', amount: 90000, isPersonal: true, party: 'Personal jeweller' }, // PERSONAL
  { storeId: 'S3', type: 'SALE', amount: 47000, isPersonal: false, party: 'Walk-in', sku: 'BANGLE-22K' },
  { storeId: 'S3', type: 'SALE', amount: 30000, isPersonal: true, party: 'Owner gift' }, // PERSONAL
  { storeId: 'S4', type: 'PURCHASE', amount: 180000, isPersonal: false, party: 'Bullion Co', sku: 'BAR-24K' },
];

const INVENTORY = [
  { storeId: 'S1', sku: 'RING-22K', metal: 'Gold', purity: '22K', weightG: 8.5, qty: 20 },
  { storeId: 'S1', sku: 'BAR-24K', metal: 'Gold', purity: '24K', weightG: 100, qty: 5 },
  { storeId: 'S1', sku: 'CHAIN-22K', metal: 'Gold', purity: '22K', weightG: 15, qty: 12 },
  { storeId: 'S2', sku: 'NECKLACE-22K', metal: 'Gold', purity: '22K', weightG: 35, qty: 8 },
  { storeId: 'S3', sku: 'BANGLE-22K', metal: 'Gold', purity: '22K', weightG: 12, qty: 25 },
  { storeId: 'S4', sku: 'BAR-24K', metal: 'Gold', purity: '24K', weightG: 100, qty: 10 },
];

async function reset() {
  // logical
  await logical.transactionLine.deleteMany();
  await logical.transaction.deleteMany();
  await logical.ledgerEntry.deleteMany();
  await logical.outbox.deleteMany();
  await logical.auditLog.deleteMany();
  await logical.inventoryItem.deleteMany();
  await logical.chartOfAccount.deleteMany();
  await logical.store.deleteMany();
  // physical
  await physical.ledgerEntry.deleteMany();
  await physical.chartOfAccount.deleteMany();
  await physical.store.deleteMany();
}

async function main() {
  await reset();

  for (const a of ACCOUNTS) {
    await physical.chartOfAccount.create({ data: a });
    await logical.chartOfAccount.create({ data: a });
  }
  for (const s of STORES) {
    await physical.store.create({ data: s });
    await logical.store.create({ data: s });
  }
  for (const item of INVENTORY) {
    await logical.inventoryItem.create({ data: item });
  }

  for (const t of TXNS) {
    const lines = buildLines({ type: t.type, amount: t.amount, isPersonal: t.isPersonal });
    const txn = await logical.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          storeId: t.storeId,
          type: t.type,
          isPersonal: t.isPersonal,
          amount: t.amount,
          party: t.party,
          lines: { create: lines },
        },
      });
      if (t.sku) {
        const delta = t.type === 'PURCHASE' ? 1 : -1;
        await tx.inventoryItem.updateMany({ where: { storeId: t.storeId, sku: t.sku }, data: { qty: { increment: delta } } });
      }
      // seed Logical ledger directly (simulates the outbox already drained)
      await tx.ledgerEntry.createMany({
        data: lines.map((l) => ({
          storeId: t.storeId,
          accountCode: l.accountCode,
          debit: l.debit,
          credit: l.credit,
          isPersonal: t.isPersonal,
          memo: t.type,
          sourceTxnId: `${created.id}:${l.accountCode}`,
        })),
      });
      return created;
    });

    if (!t.isPersonal) {
      await physical.ledgerEntry.createMany({
        data: lines.map((l) => ({
          storeId: t.storeId,
          accountCode: l.accountCode,
          debit: l.debit,
          credit: l.credit,
          memo: t.type,
          sourceTxnId: `${txn.id}:${l.accountCode}`,
        })),
      });
    }
  }

  const physCount = await physical.ledgerEntry.count();
  const logCount = await logical.ledgerEntry.count();
  console.log(`Seed done. Physical entries: ${physCount}, Logical entries: ${logCount}`);
  await physical.$disconnect();
  await logical.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await physical.$disconnect();
  await logical.$disconnect();
  process.exit(1);
});
