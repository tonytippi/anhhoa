import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { OperationState, Prisma } from '@prisma/client';
import { IDEMPOTENCY_CONFLICT, DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  fingerprint(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

  async getForAdmin(id: string, adminId: string) {
    const operation = await this.prisma.operation.findFirst({ where: { id, adminId } });
    if (!operation) throw new NotFoundException('Operation not found.');
    if (operation.state === OperationState.PENDING) return { data: { operationId: operation.id, state: OperationState.PENDING } };
    return operation.response;
  }

  async acquireOrReplay(tx: Prisma.TransactionClient, adminId: string, route: string, id: string, fingerprint: string): Promise<unknown | undefined> {
    await tx.$queryRaw`SELECT id FROM "Operation" WHERE id = ${id}::uuid FOR UPDATE`;
    const operation = await tx.operation.findUnique({ where: { id } });
    if (!operation) {
      await tx.operation.create({ data: { id, adminId, route, fingerprint, state: OperationState.PENDING } });
      return undefined;
    }
    if (operation.adminId !== adminId || operation.route !== route) throw new DomainException(IDEMPOTENCY_CONFLICT, 'Idempotency key was already used for another request.');
    if (operation.fingerprint !== fingerprint) throw new DomainException(IDEMPOTENCY_CONFLICT, 'Idempotency key was already used for another request.');
    // A pending row from the previous protocol is recovered by this transaction.
    if (operation.state === OperationState.PENDING) return undefined;
    return operation.response;
  }

  async complete(tx: Prisma.TransactionClient, input: { id: string; adminId: string; route: string; fingerprint: string; response: Prisma.InputJsonValue }) {
    await tx.operation.update({ where: { id: input.id }, data: { state: OperationState.COMPLETED, response: input.response } });
  }
}
