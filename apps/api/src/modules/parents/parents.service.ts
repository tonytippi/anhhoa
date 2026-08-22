import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ParentStatus, Prisma, StudentParentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  async grant(studentId: string, email: string) {
    const emailNormalized = email.trim().toLowerCase();
    if (!emailNormalized) throw new BadRequestException('Parent email is required.');

    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException('Student not found.');

      const parent = await tx.parent.upsert({
        where: { emailNormalized },
        create: { emailNormalized, status: ParentStatus.ACTIVE },
        update: {},
      });
      const existing = await tx.studentParent.findUnique({ where: { parentId_studentId: { parentId: parent.id, studentId } } });

      if (!existing) {
        return { outcome: 'created' as const, parent, link: await tx.studentParent.create({ data: { parentId: parent.id, studentId } }) };
      }
      if (existing.status === StudentParentStatus.REVOKED) {
        return {
          outcome: 'reactivated' as const,
          parent,
          link: await tx.studentParent.update({ where: { id: existing.id }, data: { status: StudentParentStatus.ACTIVE, revokedAt: null, revokedBy: null } }),
        };
      }
      return { outcome: 'active' as const, parent, link: existing };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async revoke(parentId: string, studentId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const link = await tx.studentParent.findUnique({ where: { parentId_studentId: { parentId, studentId } } });
      if (!link || link.status !== StudentParentStatus.ACTIVE) throw new NotFoundException('Active parent-student link not found.');
      return tx.studentParent.update({
        where: { id: link.id },
        data: { status: StudentParentStatus.REVOKED, revokedAt: new Date(), revokedBy: adminId },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
