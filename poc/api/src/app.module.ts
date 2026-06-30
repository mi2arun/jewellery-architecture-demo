import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PhysicalPrisma } from './prisma/physical.service';
import { LogicalPrisma } from './prisma/logical.service';
import { PostingService } from './posting/posting.service';
import { OutboxWorker } from './outbox/outbox.worker';
import { ConnectionRouterService } from './router/connection-router.service';
import { AuditService } from './audit/audit.service';

@Module({
  controllers: [AppController],
  providers: [
    PhysicalPrisma,
    LogicalPrisma,
    PostingService,
    OutboxWorker,
    ConnectionRouterService,
    AuditService,
  ],
})
export class AppModule {}
