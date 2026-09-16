import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() { super({ adapter: new PrismaPg(process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/passionedu') }); }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
