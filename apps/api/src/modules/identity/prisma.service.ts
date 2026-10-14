import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { currentImpersonationId } from '../common/impersonation-context.js';

// The pg adapter sends and parses timestamps as UTC wall-clock values, so every session must run in UTC;
// otherwise a server time zone such as Asia/Bangkok shifts each stored and read instant.
export const utcSession = '-c TimeZone=UTC';

type Write = { args: { data?: unknown }; query: (args: any) => Promise<unknown> };
const stamp = (data: unknown) => {
  const impersonationId = currentImpersonationId();
  if (!impersonationId || !data) return data;
  return Array.isArray(data) ? data.map((row) => ({ impersonationId, ...row })) : { impersonationId, ...(data as object) };
};
const stamped = ({ args, query }: Write) => query({ ...args, data: stamp(args.data) });

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/passionedu', options: utcSession }) });
    // Returning the extended client keeps PrismaService injectable while every Operation/AuditRecord write
    // (including inside $transaction) is attributed to the impersonating operator.
    return this.$extends({ query: { operation: { create: stamped, createMany: stamped }, auditRecord: { create: stamped, createMany: stamped } } }) as unknown as PrismaService;
  }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
