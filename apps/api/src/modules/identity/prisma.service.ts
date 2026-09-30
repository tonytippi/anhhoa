import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// The pg adapter sends and parses timestamps as UTC wall-clock values, so every session must run in UTC;
// otherwise a server time zone such as Asia/Bangkok shifts each stored and read instant.
export const utcSession = '-c TimeZone=UTC';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() { super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/passionedu', options: utcSession }) }); }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
