import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { IDEMPOTENCY_CONFLICT, DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  fingerprint(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

  async getForAdmin(id: string, adminId: string) {
    const operation = await this.prisma.operation.findFirst({ where: { id, adminId } });
    if (!operation) throw new NotFoundException('Operation not found.');
    return operation.response;
  }

  async replayOrConflict(tx: Prisma.TransactionClient, adminId: string, route: string, id: string, fingerprint: string): Promise<unknown | undefined> {
    // A transaction-scoped advisory lock serializes concurrent requests before an Operation row exists.
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${`${adminId}:${route}:${id}`}))`;
    const operation = await tx.operation.findFirst({ where: { id, adminId, route } });
    if (!operation) return undefined;
    if (operation.fingerprint !== fingerprint) throw new DomainException(IDEMPOTENCY_CONFLICT, 'Idempotency key was already used for another request.');
    return operation.response;
  }

  async complete(tx: Prisma.TransactionClient, input: { id: string; adminId: string; route: string; fingerprint: string; response: Prisma.InputJsonValue }) {
    await tx.operation.create({ data: input });
  }
}
