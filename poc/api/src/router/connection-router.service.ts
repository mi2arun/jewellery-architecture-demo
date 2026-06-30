import { Injectable, Logger } from '@nestjs/common';
import { PhysicalPrisma } from '../prisma/physical.service';
import { LogicalPrisma } from '../prisma/logical.service';

export type RouterTarget = 'physical' | 'logical';

/**
 * Connection Router — the real DB-switch from the architecture animation.
 * Holds the active ledger-DB binding for the management reporting plane and
 * exposes the currently-bound Prisma client. Switched live via /router/switch.
 * Only ONE connection is active at a time, exactly as the diagram shows.
 *
 * (POC: a single process-wide binding stands in for a per-management-session
 * binding; the mechanics — explicit, stateful, audited switch — are real.)
 */
@Injectable()
export class ConnectionRouterService {
  private readonly log = new Logger('ConnectionRouter');
  private target: RouterTarget = 'physical'; // default binding

  constructor(
    private readonly physical: PhysicalPrisma,
    private readonly logical: LogicalPrisma,
  ) {}

  getTarget(): RouterTarget {
    return this.target;
  }

  switch(target: RouterTarget): RouterTarget {
    if (target !== 'physical' && target !== 'logical') {
      throw new Error(`invalid router target: ${target}`);
    }
    this.target = target;
    this.log.log(`router bound to: ${target}`);
    return this.target;
  }

  /** The ledger DB client the management reports currently run against. */
  activeClient(): PhysicalPrisma | LogicalPrisma {
    return this.target === 'physical' ? this.physical : this.logical;
  }
}
