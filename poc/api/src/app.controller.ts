import {
  Body, Controller, Get, Post, Query, Req, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PhysicalPrisma } from './prisma/physical.service';
import { LogicalPrisma } from './prisma/logical.service';
import { PostingService } from './posting/posting.service';
import { ConnectionRouterService, RouterTarget } from './router/connection-router.service';
import { AuditService } from './audit/audit.service';
import { roleOf } from './common/role';

@Controller()
export class AppController {
  constructor(
    private readonly physical: PhysicalPrisma,
    private readonly logical: LogicalPrisma,
    private readonly posting: PostingService,
    private readonly router: ConnectionRouterService,
    private readonly audit: AuditService,
  ) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  // ---- shared / employee-accessible ----

  @Get('stores')
  stores() {
    return this.logical.store.findMany({ orderBy: { id: 'asc' } });
  }

  @Get('inventory')
  inventory(@Query('store') store?: string) {
    return this.logical.inventoryItem.findMany({
      where: store ? { storeId: store } : undefined,
      orderBy: [{ storeId: 'asc' }, { sku: 'asc' }],
    });
  }

  @Post('transactions')
  async createTxn(@Body() body: any) {
    const { storeId, type, amount, isPersonal, party, sku } = body ?? {};
    if (!storeId || !type || amount == null) {
      throw new BadRequestException('storeId, type, amount are required');
    }
    return this.posting.post({
      storeId,
      type,
      amount: Number(amount),
      isPersonal: !!isPersonal,
      party,
      sku,
    });
  }

  // Physical reporting API — official books. Open to employees.
  @Get('ledger/physical')
  physicalLedger(@Query('store') store?: string) {
    return this.physical.ledgerEntry.findMany({
      where: store ? { storeId: store } : undefined,
      orderBy: { postedAt: 'desc' },
      take: 200,
    });
  }

  // ---- management-only (routed) ----

  // Logical ledger via the Connection Router. Management only; audited; masked.
  @Get('ledger/logical')
  async logicalLedger(
    @Req() req: Request,
    @Query('store') store?: string,
    @Query('unmask') unmask?: string,
  ) {
    const role = roleOf(req);
    if (role !== 'management') {
      throw new ForbiddenException('Logical ledger is restricted to management');
    }
    const rows = await this.logical.ledgerEntry.findMany({
      where: store ? { storeId: store } : undefined,
      orderBy: { postedAt: 'desc' },
      take: 200,
    });
    await this.audit.record(role, 'READ', 'ledger/logical', rows.length);

    const reveal = unmask === '1';
    return rows.map((r) =>
      r.isPersonal && !reveal
        ? { ...r, accountCode: r.accountCode, memo: 'Personal — •••••', debit: '•••••', credit: '•••••', masked: true }
        : { ...r, masked: false },
    );
  }

  @Get('reconciliation')
  async reconciliation(@Req() req: Request, @Query('store') store?: string) {
    const role = roleOf(req);
    if (role !== 'management') {
      throw new ForbiddenException('Reconciliation is restricted to management');
    }
    const where = store ? { storeId: store } : {};
    const sum = (rows: { debit: any; credit: any }[]) =>
      rows.reduce((s, r) => s + Number(r.debit) + Number(r.credit), 0);

    const phys = await this.physical.ledgerEntry.findMany({ where });
    const log = await this.logical.ledgerEntry.findMany({ where });
    const personal = log.filter((r) => r.isPersonal);

    const physicalTotal = round2(sum(phys));
    const logicalTotal = round2(sum(log));
    const personalTotal = round2(sum(personal));

    await this.audit.record(role, 'READ', 'reconciliation', log.length);
    return {
      physicalTotal,
      logicalTotal,
      personalTotal,
      identityHolds: round2(logicalTotal - physicalTotal) === personalTotal,
    };
  }

  // ---- Connection Router (real DB-switch) ----

  @Get('router/status')
  routerStatus() {
    return { target: this.router.getTarget() };
  }

  @Post('router/switch')
  async routerSwitch(@Req() req: Request, @Body() body: { target: RouterTarget }) {
    const role = roleOf(req);
    if (role !== 'management') {
      throw new ForbiddenException('Only management may switch the connection');
    }
    const target = this.router.switch(body?.target);
    await this.audit.record(role, 'ROUTER_SWITCH', `router:${target}`, 0);
    return { target };
  }

  // Routed management report — runs against whichever DB the router is bound to.
  @Get('ledger/report')
  async routedReport(@Req() req: Request, @Query('store') store?: string) {
    const role = roleOf(req);
    if (role !== 'management') {
      throw new ForbiddenException('Routed report is restricted to management');
    }
    const target = this.router.getTarget();
    const client: any = this.router.activeClient();
    const rows = await client.ledgerEntry.findMany({
      where: store ? { storeId: store } : undefined,
      orderBy: { postedAt: 'desc' },
      take: 200,
    });
    await this.audit.record(role, 'READ', `ledger/report:${target}`, rows.length);
    return { boundTo: target, rows };
  }

  @Get('audit')
  async auditList(@Req() req: Request) {
    const role = roleOf(req);
    if (role !== 'management') {
      throw new ForbiddenException('Audit log is restricted to management');
    }
    return this.audit.list();
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
