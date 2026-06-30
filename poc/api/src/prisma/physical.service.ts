import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// Generated into a custom output dir to avoid colliding with the logical client.
import { PrismaClient } from '../../node_modules/.prisma/physical';

@Injectable()
export class PhysicalPrisma extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
