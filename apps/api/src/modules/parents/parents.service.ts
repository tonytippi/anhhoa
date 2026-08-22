import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ParentStatus, Prisma, StudentParentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { OperationsService } from '../operations/operations.service.js';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService, private readonly operations: OperationsService = new OperationsService(prisma)) {}

  async list(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found.');
    const links = await this.prisma.studentParent.findMany({ where: { studentId }, include: { parent: { select: { id: true, emailNormalized: true } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return { data: links.map((link) => ({ parentId: link.parentId, email: link.parent.emailNormalized, status: link.status, createdAt: link.createdAt.toISOString(), revokedAt: link.revokedAt?.toISOString() ?? null })) };
  }

  async grantBatch(studentId: string, emails: string[], operationId: string, adminId: string) {
    const normalized = emails.map((email) => email.trim().toLowerCase());
    if (!normalized.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new BadRequestException('Each parent email must be valid.');
    if (new Set(normalized).size !== normalized.length) throw new BadRequestException('Parent emails must be unique.');
    const route = `/students/${studentId}/parents/grant`;
    const fingerprint = this.operations.fingerprint({ studentId, emails: normalized });
    return this.withOperation(adminId, route, operationId, fingerprint, async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException('Student not found.');
      const outcomes = [];
      for (const email of normalized) outcomes.push(await this.grantInTransaction(tx, studentId, email));
      return { data: { operationId, outcomes: outcomes.map(({ outcome, parent, link }) => ({ email: parent.emailNormalized, outcome, parentId: parent.id, status: link.status })) } };
    });
  }

  async revokeWithOperation(studentId: string, parentId: string, operationId: string, adminId: string) {
    const route = `/students/${studentId}/parents/${parentId}/revoke`;
    const fingerprint = this.operations.fingerprint({ studentId, parentId });
    return this.withOperation(adminId, route, operationId, fingerprint, async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException('Student not found.');
      const link = await tx.studentParent.findUnique({ where: { parentId_studentId: { parentId, studentId } }, include: { parent: { select: { emailNormalized: true } } } });
      if (!link || link.status !== StudentParentStatus.ACTIVE) throw new NotFoundException('Active parent-student link not found.');
      const revoked = await tx.studentParent.update({ where: { id: link.id }, data: { status: StudentParentStatus.REVOKED, revokedAt: new Date(), revokedBy: adminId } });
      return { data: { operationId, parentId, email: link.parent.emailNormalized, status: revoked.status } };
    });
  }

  async grant(studentId: string, email: string) {
    const emailNormalized = email.trim().toLowerCase();
    if (!emailNormalized) throw new BadRequestException('Parent email is required.');

    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException('Student not found.');

      return this.grantInTransaction(tx, studentId, emailNormalized);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async revoke(parentId: string, studentId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const admin = await tx.admin.findUnique({ where: { id: adminId } });
      if (!admin) throw new NotFoundException('Admin not found.');
      const link = await tx.studentParent.findUnique({ where: { parentId_studentId: { parentId, studentId } } });
      if (!link || link.status !== StudentParentStatus.ACTIVE) throw new NotFoundException('Active parent-student link not found.');
      return tx.studentParent.update({
        where: { id: link.id },
        data: { status: StudentParentStatus.REVOKED, revokedAt: new Date(), revokedBy: adminId },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async grantInTransaction(tx: Prisma.TransactionClient, studentId: string, emailNormalized: string) {
    const parent = await tx.parent.upsert({ where: { emailNormalized }, create: { emailNormalized, status: ParentStatus.ACTIVE }, update: { status: ParentStatus.ACTIVE } });
    const existing = await tx.studentParent.findUnique({ where: { parentId_studentId: { parentId: parent.id, studentId } } });
    if (!existing) return { outcome: 'created' as const, parent, link: await tx.studentParent.create({ data: { parentId: parent.id, studentId } }) };
    if (existing.status === StudentParentStatus.REVOKED) return { outcome: 'reactivated' as const, parent, link: await tx.studentParent.update({ where: { id: existing.id }, data: { status: StudentParentStatus.ACTIVE, revokedAt: null, revokedBy: null } }) };
    return { outcome: 'active' as const, parent, link: existing };
  }

  private async withOperation(adminId: string, route: string, operationId: string, fingerprint: string, action: (tx: Prisma.TransactionClient) => Promise<{ data: unknown }>) {
    for (let attempt = 0; attempt < 3; attempt += 1) try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await this.operations.acquireOrReplay(tx, adminId, route, operationId, fingerprint);
        if (replay !== undefined) return replay as { data: unknown };
        const result = await action(tx);
        await this.operations.complete(tx, { id: operationId, adminId, route, fingerprint, response: result as Prisma.InputJsonValue });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(error.code)) throw error;
    }
    throw new Error('Unreachable operation retry state.');
  }
}
