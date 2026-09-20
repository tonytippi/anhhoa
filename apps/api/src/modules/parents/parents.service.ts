import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { auditData } from "../common/audit.js";
import { requestFingerprint } from "../common/mutation-protection.js";
import { isOperationIdempotencyCollision } from "../common/operation-idempotency.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { PrismaService } from "../identity/prisma.service.js";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}
  private async actor(identityId: string, schoolId: string) {
    return this.authorization.resolve(
      identityId,
      schoolId,
      "app",
      "ROSTER_MANAGE",
    );
  }
  private contact(body: any) {
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName =
      typeof body?.fullName === "string" ? body.fullName.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const fieldErrors: Record<string, string> = {};
    if (!emailPattern.test(email)) fieldErrors.email = "Email không hợp lệ.";
    if (!fullName || fullName.length > 100)
      fieldErrors.fullName = "Họ và tên cần từ 1 đến 100 ký tự.";
    if (!/^[0-9+() .-]{6,30}$/.test(phone))
      fieldErrors.phone = "Số điện thoại không hợp lệ.";
    if (Object.keys(fieldErrors).length)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors,
      });
    return { email, fullName, phone };
  }
  private dto(link: any) {
    return {
      id: link.id,
      studentId: link.studentId,
      status: link.status,
      createdAt: link.createdAt.toISOString(),
      revokedAt: link.revokedAt?.toISOString() ?? null,
      parent: {
        fullName: link.parentProfile.fullName,
        email: link.parentProfile.emailNormalized,
        phone: link.parentProfile.phone,
        bound: Boolean(link.parentProfile.userIdentityId),
      },
    };
  }
  async links(identityId: string, schoolId: string, studentId: string) {
    await this.actor(identityId, schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true },
    });
    if (!student)
      throw new NotFoundException({
        code: "STUDENT_NOT_FOUND",
        message: "Không tìm thấy học sinh.",
      });
    return (
      await this.prisma.studentParent.findMany({
        where: { schoolId, studentId },
        include: { parentProfile: true },
        orderBy: { createdAt: "asc" },
      })
    ).map((link) => this.dto(link));
  }
  async create(
    identityId: string,
    schoolId: string,
    studentId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const contact = this.contact(body);
    const operation = await this.mutate(
      actor,
      identityId,
      schoolId,
      "POST /api/app/schools/:schoolId/roster/students/:studentId/parents",
      key,
      operationId,
      { studentId, ...contact },
      async (tx, operationId) => {
        const student = await tx.student.findFirst({
          where: { id: studentId, schoolId },
          select: { id: true },
        });
        if (!student)
          throw new NotFoundException({
            code: "STUDENT_NOT_FOUND",
            message: "Không tìm thấy học sinh.",
          });
        const profile = await tx.parentProfile.upsert({
          where: { emailNormalized: contact.email },
          create: {
            emailNormalized: contact.email,
            fullName: contact.fullName,
            phone: contact.phone,
          },
          update: { fullName: contact.fullName, phone: contact.phone },
        });
        const existing = await tx.studentParent.findUnique({
          where: {
            schoolId_studentId_parentProfileId: {
              schoolId,
              studentId,
              parentProfileId: profile.id,
            },
          },
          include: { parentProfile: true },
        });
        const link = existing
          ? await tx.studentParent.update({
              where: { id: existing.id },
              data: { status: "ACTIVE", revokedAt: null },
              include: { parentProfile: true },
            })
          : await tx.studentParent.create({
              data: { schoolId, studentId, parentProfileId: profile.id },
              include: { parentProfile: true },
            });
        await tx.auditRecord.create({
          data: auditData(
            schoolId,
            {
              identityId,
              type: "SCHOOL_MEMBERSHIP",
              reference: actor.membershipId,
              membershipId: actor.membershipId,
            },
            existing ? "STUDENT_PARENT_REACTIVATED" : "STUDENT_PARENT_CREATED",
            {
              operationId,
              studentId,
              studentParentId: link.id,
              parentProfileId: profile.id,
            },
          ),
        });
        return this.dto(link);
      },
    );
    return {
      id: (operation as { id: string }).id,
      status: (operation as { status: string }).status,
      outcome: (operation as { outcome: unknown }).outcome,
    };
  }
  async revoke(
    identityId: string,
    schoolId: string,
    linkId: string,
    key: string,
    operationId: string,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const operation = await this.mutate(
      actor,
      identityId,
      schoolId,
      "POST /api/app/schools/:schoolId/roster/student-parents/:linkId/revoke",
      key,
      operationId,
      { linkId },
      async (tx, operationId) => {
        const target = await tx.studentParent.findFirst({
          where: { id: linkId, schoolId },
          include: { parentProfile: true },
        });
        if (!target)
          throw new NotFoundException({
            code: "STUDENT_PARENT_NOT_FOUND",
            message: "Không tìm thấy liên kết phụ huynh.",
          });
        const link =
          target.status === "REVOKED"
            ? target
            : await tx.studentParent.update({
                where: { id: target.id },
                data: { status: "REVOKED", revokedAt: new Date() },
                include: { parentProfile: true },
              });
        if (target.status === "ACTIVE")
          await tx.auditRecord.create({
            data: auditData(
              schoolId,
              {
                identityId,
                type: "SCHOOL_MEMBERSHIP",
                reference: actor.membershipId,
                membershipId: actor.membershipId,
              },
              "STUDENT_PARENT_REVOKED",
              {
                operationId,
                studentId: target.studentId,
                studentParentId: target.id,
                parentProfileId: target.parentProfileId,
              },
            ),
          });
        return this.dto(link);
      },
    );
    return {
      id: (operation as { id: string }).id,
      status: (operation as { status: string }).status,
      outcome: (operation as { outcome: unknown }).outcome,
    };
  }
  async admit(tx: any, emailNormalized: string, googleSubject: string) {
    const profile = await tx.parentProfile.findUnique({
      where: { emailNormalized },
    });
    if (!profile)
      throw new UnauthorizedException({
        code: "PARENT_ACCESS_DENIED",
        message: "Không có liên kết phụ huynh đang hiệu lực.",
      });
    const subject = await tx.userIdentity.findUnique({
      where: { googleSubject },
    });
    const email = await tx.userIdentity.findUnique({
      where: { emailNormalized },
    });
    if (
      (subject && subject.emailNormalized !== emailNormalized) ||
      (email?.googleSubject && email.googleSubject !== googleSubject) ||
      (profile.userIdentityId &&
        profile.userIdentityId !== (subject?.id ?? email?.id))
    )
      throw new UnauthorizedException({
        code: "PARENT_ACCESS_DENIED",
        message: "Danh tính phụ huynh không khớp.",
      });
    const identity =
      subject ??
      email ??
      (await tx.userIdentity.create({
        data: { emailNormalized, googleSubject },
      }));
    if (!identity.googleSubject)
      await tx.userIdentity.update({
        where: { id: identity.id },
        data: { googleSubject },
      });
    await tx.parentProfile.update({
      where: { id: profile.id },
      data: {
        userIdentityId: identity.id,
        boundAt: profile.boundAt ?? new Date(),
      },
    });
    // Lock the authorization edges so a concurrent revoke cannot race cookie admission.
    await tx.$queryRaw`SELECT "StudentParent"."id" FROM "StudentParent" INNER JOIN "School" ON "School"."id" = "StudentParent"."schoolId" WHERE "StudentParent"."parentProfileId" = ${profile.id}::uuid AND "StudentParent"."status" = 'ACTIVE' AND "School"."status" = 'ACTIVE' FOR UPDATE`;
    const active = await tx.studentParent.count({
      where: {
        parentProfileId: profile.id,
        status: "ACTIVE",
        school: { status: "ACTIVE" },
      },
    });
    if (!active)
      throw new UnauthorizedException({
        code: "PARENT_ACCESS_DENIED",
        message: "Không có liên kết phụ huynh đang hiệu lực.",
      });
    return identity;
  }
  async context(identityId: string) {
    const profile = await this.prisma.parentProfile.findFirst({
      where: { userIdentityId: identityId },
      include: {
        studentParents: {
          where: { status: "ACTIVE", school: { status: "ACTIVE" } },
          include: {
            school: { select: { id: true, name: true } },
            student: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!profile || !profile.studentParents.length)
      throw new UnauthorizedException({
        code: "PARENT_ACCESS_DENIED",
        message: "Không có liên kết phụ huynh đang hiệu lực.",
      });
    return {
      schools: profile.studentParents.map((link) => ({
        schoolId: link.school.id,
        schoolName: link.school.name,
        student: { id: link.student.id, fullName: link.student.fullName },
      })),
    };
  }
  private async mutate(
    actor: { membershipId: string },
    identityId: string,
    schoolId: string,
    route: string,
    key: string,
    operationId: string,
    body: unknown,
    work: (tx: any, operationId: string) => Promise<unknown>,
  ) {
    if (!uuid.test(key) || !uuid.test(operationId))
      throw new UnauthorizedException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Cần Idempotency-Key và X-Operation-Id UUID.",
      });
    const fingerprint = requestFingerprint(body);
    const existing = await this.prisma.operation.findFirst({
      where: {
        schoolId,
        actorReference: actor.membershipId,
        actorType: "SCHOOL_MEMBERSHIP",
        route,
        idempotencyKey: key,
      },
    });
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new ConflictException({
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency-Key đã dùng cho yêu cầu khác.",
        });
      await this.actor(identityId, schoolId);
      return {
        id: existing.id,
        status: existing.status,
        outcome: existing.outcome,
      };
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "School" WHERE "id" = ${schoolId}::uuid FOR UPDATE`;
        const current = await tx.schoolMembership.findFirst({
          where: {
            id: actor.membershipId,
            schoolId,
            userIdentityId: identityId,
            status: "ACTIVE",
            school: { status: "ACTIVE" },
            boundStaffProfile: { employmentStatus: "ACTIVE", primaryPosition: { status: "ACTIVE", grants: { some: { capability: "ROSTER_MANAGE" } } } },
          },
        });
        if (!current)
          throw new ForbiddenException({
            code: "CAPABILITY_DENIED",
            message: "Bạn không có quyền thực hiện thao tác này.",
          });
        const operation = await tx.operation.create({
          data: {
            id: operationId,
            schoolId,
            membershipId: actor.membershipId,
            actorIdentityId: identityId,
            actorType: "SCHOOL_MEMBERSHIP",
            actorReference: actor.membershipId,
            route,
            idempotencyKey: key,
            fingerprint,
          },
        });
        const outcome = await work(tx, operation.id);
        return tx.operation.update({
          where: { id: operation.id },
          data: { status: "COMPLETED", outcome: outcome as object },
        });
      });
    } catch (error) {
      if (!isOperationIdempotencyCollision(error)) throw error;
      const replay = await this.prisma.operation.findFirst({
        where: {
          schoolId,
          actorReference: actor.membershipId,
          actorType: "SCHOOL_MEMBERSHIP",
          route,
          idempotencyKey: key,
        },
      });
      if (replay?.fingerprint === fingerprint) {
        await this.actor(identityId, schoolId);
        return replay;
      }
      throw new ConflictException({
        code: "IDEMPOTENCY_CONFLICT",
        message:
          "Không thể xác nhận thao tác trùng lặp. Hãy đối soát thao tác trước khi thử lại.",
      });
    }
  }
}
