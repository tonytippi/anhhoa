import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found.');
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

  async authorizeStudent(parentId: string, studentId: string) {
    if (!this.isUuid(parentId) || !this.isUuid(studentId)) throw new UnauthorizedException('Parent is not authorized to access this resource.');
    const link = await this.findActiveLink(parentId, studentId);
    if (!link) throw new UnauthorizedException('Parent is not authorized to access this resource.');
    return { studentId: link.studentId };
  }

  async authorizeInvoice(parentId: string, invoiceId: string) {
    if (!this.isUuid(parentId) || !this.isUuid(invoiceId)) throw new UnauthorizedException('Parent is not authorized to access this resource.');
    const link = await this.prisma.studentParent.findFirst({
      where: {
        parentId,
        status: StudentParentStatus.ACTIVE,
        parent: { status: ParentStatus.ACTIVE },
        student: { invoices: { some: { id: invoiceId } } },
      },
      select: { studentId: true, student: { select: { invoices: { where: { id: invoiceId }, select: { id: true }, take: 1 } } } },
    });
    const invoice = link?.student.invoices[0];
    if (!link || !invoice) throw new UnauthorizedException('Parent is not authorized to access this resource.');
    return { invoiceId: invoice.id, studentId: link.studentId };
  }

  async bindGoogleSubject(email: string, googleSubject: string) {
    return this.prisma.$transaction(async (tx) => {
      const parent = await tx.parent.findFirst({ where: { emailNormalized: email, status: ParentStatus.ACTIVE, students: { some: { status: StudentParentStatus.ACTIVE } } } });
      if (!parent || (parent.googleSubject && parent.googleSubject !== googleSubject)) throw new UnauthorizedException('Parent is not authorized.');
      return parent.googleSubject ? parent : tx.parent.update({ where: { id: parent.id }, data: { googleSubject } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async activeParent(parentId: string) {
    return this.prisma.parent.findFirst({ where: { id: parentId, status: ParentStatus.ACTIVE, students: { some: { status: StudentParentStatus.ACTIVE } } } });
  }

  private async grantInTransaction(tx: Prisma.TransactionClient, studentId: string, emailNormalized: string) {
    const parent = await tx.parent.upsert({ where: { emailNormalized }, create: { emailNormalized, status: ParentStatus.ACTIVE }, update: { status: ParentStatus.ACTIVE } });
    const existing = await tx.studentParent.findUnique({ where: { parentId_studentId: { parentId: parent.id, studentId } } });
    if (!existing) return { outcome: 'created' as const, parent, link: await tx.studentParent.create({ data: { parentId: parent.id, studentId } }) };
    if (existing.status === StudentParentStatus.REVOKED) return { outcome: 'reactivated' as const, parent, link: await tx.studentParent.update({ where: { id: existing.id }, data: { status: StudentParentStatus.ACTIVE, revokedAt: null, revokedBy: null } }) };
    return { outcome: 'active' as const, parent, link: existing };
  }

  private findActiveLink(parentId: string, studentId: string) {
    return this.prisma.studentParent.findFirst({
      where: { parentId, studentId, status: StudentParentStatus.ACTIVE, parent: { status: ParentStatus.ACTIVE } },
      select: { studentId: true },
    });
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
