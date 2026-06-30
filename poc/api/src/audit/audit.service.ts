import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { LogicalPrisma } from '../prisma/logical.service';

/**
 * Hash-chained audit log. Each row hashes (prevHash + its own fields), so any
 * deletion or edit breaks the chain — tamper-evident, as described in the
 * secured-reporting design.
 */
@Injectable()
export class AuditService {
  constructor(private readonly logical: LogicalPrisma) {}

  async record(actorRole: string, action: string, resource: string, rowCount = 0) {
    const last = await this.logical.auditLog.findFirst({ orderBy: { ts: 'desc' } });
    const prevHash = last?.rowHash ?? 'GENESIS';
    const ts = new Date();
    const rowHash = createHash('sha256')
      .update(`${prevHash}|${actorRole}|${action}|${resource}|${rowCount}|${ts.toISOString()}`)
      .digest('hex');
    return this.logical.auditLog.create({
      data: { actorRole, action, resource, rowCount, prevHash, rowHash, ts },
    });
  }

  list() {
    return this.logical.auditLog.findMany({ orderBy: { ts: 'desc' }, take: 100 });
  }
}
