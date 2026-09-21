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
const lifecycles = new Set([
  "TRIAL",
  "WAITING_FOR_CLASS",
  "SCHEDULED_TO_START",
  "ENROLLED",
  "ON_LEAVE",
  "WITHDRAWN",
  "GRADUATED",
]);
const terminal = new Set(["ON_LEAVE", "WITHDRAWN", "GRADUATED"]);
const route = {
  schoolYear: "POST /api/app/schools/:schoolId/roster/school-years",
  class:
    "POST /api/app/schools/:schoolId/roster/school-years/:schoolYearId/classes",
  rename: "POST /api/app/schools/:schoolId/roster/classes/:classId/name",
  archive: "POST /api/app/schools/:schoolId/roster/classes/:classId/archive",
  student: "POST /api/app/schools/:schoolId/roster/students",
  lifecycle:
    "POST /api/app/schools/:schoolId/roster/enrollments/:enrollmentId/lifecycle",
  staff: "POST /api/app/schools/:schoolId/roster/staff",
  staffUpdate: "POST /api/app/schools/:schoolId/roster/staff/:staffId",
  assignment:
    "POST /api/app/schools/:schoolId/roster/staff/:staffId/assignments",
  assignmentChange:
    "POST /api/app/schools/:schoolId/roster/staff-assignments/:assignmentId/change",
  assignmentEnd:
    "POST /api/app/schools/:schoolId/roster/staff-assignments/:assignmentId/end",
  position: "POST /api/app/schools/:schoolId/roster/positions",
  positionRename:
    "POST /api/app/schools/:schoolId/roster/positions/:positionId/name",
  positionInactive:
    "POST /api/app/schools/:schoolId/roster/positions/:positionId/inactivate",
  positionGrant:
    "POST /api/app/schools/:schoolId/roster/positions/:positionId/grants",
  positionRevoke:
    "POST /api/app/schools/:schoolId/roster/positions/:positionId/grants/:capability/revoke",
  transition: "POST /api/app/schools/:schoolId/roster/transitions",
  closeYear: "POST /api/app/schools/:schoolId/roster/close-year",
};

@Injectable()
export class RosterService {
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
  private name(value: unknown, field = "name") {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name || name.length > 100)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { [field]: "Tên cần từ 1 đến 100 ký tự." },
      });
    return name;
  }
  private date(value: unknown, field: string) {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { [field]: "Ngày không hợp lệ." },
      });
    return value;
  }
  private dateValue(value: unknown, field: string) {
    return new Date(`${this.date(value, field)}T00:00:00.000Z`);
  }
  private businessToday() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}-${parts.find((part) => part.type === "day")!.value}`;
  }
  private schoolYearDto(value: any) {
    const today = this.businessToday();
    return {
      id: value.id,
      name: value.name,
      startsOn: value.startsOn.toISOString().slice(0, 10),
      endsOn: value.endsOn.toISOString().slice(0, 10),
      isActive:
        value.startsOn.toISOString().slice(0, 10) <= today &&
        today < value.endsOn.toISOString().slice(0, 10),
      closedAt: value.closedAt?.toISOString() ?? null,
    };
  }
  private classDto(value: any, activeStudentCount = 0) {
    return {
      id: value.id,
      schoolYearId: value.schoolYearId,
      name: value.name,
      status: value.status,
      activeStudentCount,
      createdAt: value.createdAt.toISOString(),
      updatedAt: value.updatedAt.toISOString(),
    };
  }
  private enrollmentDto(value: any) {
    const current = (value.classAssignments ?? []).find(
      (item: any) => !item.effectiveTo,
    );
    return {
      id: value.id,
      schoolYearId: value.schoolYearId,
      classId: current?.classId ?? value.classId,
      lifecycle: value.lifecycle,
      effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
      endedOn: value.endedOn?.toISOString().slice(0, 10) ?? null,
      schoolYear: {
        name: value.schoolYearName,
        startsOn: value.schoolYearStartsOn.toISOString().slice(0, 10),
        endsOn: value.schoolYearEndsOn.toISOString().slice(0, 10),
      },
      classroom: { name: current?.classroom?.name ?? value.className },
      classAssignmentHistory: (value.classAssignments ?? []).map(
        (item: any) => ({
          id: item.id,
          classId: item.classId,
          className: item.classroom?.name ?? null,
          effectiveFrom: item.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: item.effectiveTo?.toISOString().slice(0, 10) ?? null,
          reason: item.reason,
        }),
      ),
      lifecycleHistory: (value.lifecycleTransitions ?? []).map((item: any) => ({
        id: item.id,
        previousLifecycle: item.previousLifecycle,
        lifecycle: item.lifecycle,
        effectiveFrom: item.effectiveFrom.toISOString().slice(0, 10),
        endedOn: item.endedOn?.toISOString().slice(0, 10) ?? null,
        changedAt: item.createdAt.toISOString(),
      })),
    };
  }
  private studentDto(value: any) {
    return {
      id: value.id,
      studentCode: value.studentCode,
      fullName: value.fullName,
      dateOfBirth: value.dateOfBirth.toISOString().slice(0, 10),
      enrollments: value.enrollments.map((item: any) =>
        this.enrollmentDto(item),
      ),
    };
  }
  private staffDto(value: any) {
    return {
      id: value.id,
      fullName: value.fullName,
      email: value.email,
      phone: value.phone,
      dateOfBirth: value.dateOfBirth.toISOString().slice(0, 10),
      gender: value.gender,
      address: value.address,
      employmentStatus: value.employmentStatus,
      primaryPositionId: value.primaryPositionId,
      primaryPosition: value.primaryPosition
        ? {
            id: value.primaryPosition.id,
            code: value.primaryPosition.code,
            name: value.primaryPosition.name,
            status: value.primaryPosition.status,
          }
        : null,
      schoolMembershipId: value.schoolMembershipId,
      boundAt: value.boundAt?.toISOString() ?? null,
      createdAt: value.createdAt.toISOString(),
      updatedAt: value.updatedAt.toISOString(),
    };
  }
  private assignmentDto(value: any) {
    return {
      id: value.id,
      staffProfileId: value.staffProfileId,
      effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: value.effectiveTo?.toISOString().slice(0, 10) ?? null,
      reason: value.reason,
      endReason: value.endReason ?? null,
      staff: { fullName: value.staffProfile.fullName },
      schoolYear: {
        id: value.schoolYearId,
        name: value.schoolYearName,
        startsOn: value.schoolYearStartsOn.toISOString().slice(0, 10),
        endsOn: value.schoolYearEndsOn.toISOString().slice(0, 10),
      },
      classroom: { id: value.classId, name: value.className },
      access: { status: "NOT_PROVIDED" },
    };
  }
  async schoolYears(identityId: string, schoolId: string) {
    await this.actor(identityId, schoolId);
    return (
      await this.prisma.schoolYear.findMany({
        where: { schoolId },
        orderBy: { startsOn: "desc" },
      })
    ).map((item) => this.schoolYearDto(item));
  }
  async classes(identityId: string, schoolId: string, schoolYearId: string) {
    await this.actor(identityId, schoolId);
    await this.year(schoolId, schoolYearId);
    const classes = await this.prisma.class.findMany({
      where: { schoolId, schoolYearId },
      orderBy: { createdAt: "asc" },
    });
    const counts = await this.prisma.enrollmentClassAssignment.groupBy({
      by: ["classId"],
      where: {
        schoolId,
        schoolYearId,
        effectiveTo: null,
        enrollment: { lifecycle: "ENROLLED", endedOn: null },
      },
      _count: { id: true },
    });
    const countByClass = new Map(
      counts.map((item) => [item.classId, item._count.id]),
    );
    return classes.map((item) =>
      this.classDto(item, countByClass.get(item.id) ?? 0),
    );
  }
  async students(
    identityId: string,
    schoolId: string,
    schoolYearId: string,
    classId?: string,
  ) {
    await this.actor(identityId, schoolId);
    await this.year(schoolId, schoolYearId);
    if (
      classId &&
      (!uuid.test(classId) ||
        !(await this.prisma.class.findFirst({
          where: { id: classId, schoolId, schoolYearId },
        })))
    )
      throw new NotFoundException({
        code: "CLASS_NOT_FOUND",
        message: "Không tìm thấy lớp.",
      });
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        schoolId,
        schoolYearId,
        ...(classId
          ? { classAssignments: { some: { classId, effectiveTo: null } } }
          : {}),
      },
      include: {
        student: {
          include: {
            enrollments: {
              where: { schoolId },
              orderBy: { createdAt: "asc" },
              include: {
                lifecycleTransitions: { orderBy: { createdAt: "asc" } },
                classAssignments: {
                  orderBy: { effectiveFrom: "asc" },
                  include: { classroom: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return enrollments.map((item) => this.studentDto(item.student));
  }
  async student(identityId: string, schoolId: string, studentId: string) {
    await this.actor(identityId, schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: {
        enrollments: {
          where: { schoolId },
          orderBy: { createdAt: "asc" },
          include: {
            lifecycleTransitions: { orderBy: { createdAt: "asc" } },
            classAssignments: { orderBy: { effectiveFrom: "asc" } },
          },
        },
      },
    });
    if (!student)
      throw new NotFoundException({
        code: "STUDENT_NOT_FOUND",
        message: "Không tìm thấy học sinh.",
      });
    return this.studentDto(student);
  }
  async staff(identityId: string, schoolId: string) {
    await this.actor(identityId, schoolId);
    return (
      await this.prisma.staffProfile.findMany({
        where: { schoolId },
        include: { primaryPosition: true },
        orderBy: { fullName: "asc" },
      })
    ).map((item) => this.staffDto(item));
  }
  async positions(identityId: string, schoolId: string) {
    await this.actor(identityId, schoolId);
    return (
      await this.prisma.schoolPosition.findMany({
        where: { schoolId },
        include: { grants: true },
        orderBy: { name: "asc" },
      })
    ).map((position) => ({
      id: position.id,
      code: position.code,
      name: position.name,
      status: position.status,
      capabilities: position.grants.map((grant) => grant.capability),
    }));
  }
  async operation(identityId: string, schoolId: string, operationId: string) {
    const actor = await this.authorization.resolve(identityId, schoolId, "app");
    if (!uuid.test(operationId))
      throw new NotFoundException({
        code: "OPERATION_NOT_FOUND",
        message: "Không tìm thấy thao tác.",
      });
    const operation = await this.prisma.operation.findFirst({
      where: {
        id: operationId,
        schoolId,
        actorIdentityId: identityId,
        actorType: "SCHOOL_MEMBERSHIP",
        actorReference: actor.membershipId,
      },
    });
    if (!operation)
      throw new NotFoundException({
        code: "OPERATION_NOT_FOUND",
        message: "Không tìm thấy thao tác.",
      });
    return {
      id: operation.id,
      status: operation.status,
      outcome: operation.outcome,
      createdAt: operation.createdAt.toISOString(),
      updatedAt: operation.updatedAt.toISOString(),
    };
  }
  async createPosition(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const input = this.positionInput(body);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.position,
      key,
      operationId,
      input,
      async (tx, operation) => {
        const position = await tx.schoolPosition.create({
          data: { schoolId, code: input.code, name: input.name },
        });
        await tx.positionCapabilityGrant.createMany({
          data: input.capabilities.map((capability) => ({
            schoolId,
            positionId: position.id,
            capability,
          })),
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "SCHOOL_POSITION_CREATED",
          operation,
          {
            positionId: position.id,
            reason: input.reason,
            capabilities: input.capabilities,
          },
        );
        return {
          id: position.id,
          code: position.code,
          name: position.name,
          status: position.status,
          capabilities: input.capabilities,
        };
      },
    );
  }
  async renamePosition(
    identityId: string,
    schoolId: string,
    positionId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const name = this.name(body?.name);
    const reason = this.reason(body?.reason);
    return this.positionMutation(
      actor,
      identityId,
      schoolId,
      positionId,
      route.positionRename,
      key,
      operationId,
      { positionId, name, reason },
      async (tx, position, operation) => {
        const updated = await tx.schoolPosition.update({
          where: { id: position.id },
          data: { name },
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "SCHOOL_POSITION_RENAMED",
          operation,
          { positionId, reason },
        );
        return {
          id: updated.id,
          code: updated.code,
          name: updated.name,
          status: updated.status,
        };
      },
    );
  }
  async inactivatePosition(
    identityId: string,
    schoolId: string,
    positionId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const reason = this.reason(body?.reason);
    return this.positionMutation(
      actor,
      identityId,
      schoolId,
      positionId,
      route.positionInactive,
      key,
      operationId,
      { positionId, reason },
      async (tx, position, operation) => {
        if (position.status === "ACTIVE")
          await this.keepRosterManager(tx, schoolId, positionId);
        const updated =
          position.status === "INACTIVE"
            ? position
            : await tx.schoolPosition.update({
                where: { id: position.id },
                data: { status: "INACTIVE" },
              });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "SCHOOL_POSITION_INACTIVATED",
          operation,
          { positionId, reason },
        );
        return {
          id: updated.id,
          code: updated.code,
          name: updated.name,
          status: updated.status,
        };
      },
    );
  }
  async grantPositionCapability(
    identityId: string,
    schoolId: string,
    positionId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const capability = this.capability(body?.capability);
    const reason = this.reason(body?.reason);
    return this.positionMutation(
      actor,
      identityId,
      schoolId,
      positionId,
      route.positionGrant,
      key,
      operationId,
      { positionId, capability, reason },
      async (tx, position, operation) => {
        if (position.status !== "ACTIVE")
          throw new ConflictException({
            code: "POSITION_NOT_ACTIVE",
            message: "Chức danh không còn hiệu lực.",
          });
        await tx.positionCapabilityGrant.upsert({
          where: {
            schoolId_positionId_capability: {
              schoolId,
              positionId,
              capability,
            },
          },
          create: { schoolId, positionId, capability },
          update: {},
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "POSITION_CAPABILITY_GRANTED",
          operation,
          { positionId, capability, reason },
        );
        return { positionId, capability };
      },
    );
  }
  async revokePositionCapability(
    identityId: string,
    schoolId: string,
    positionId: string,
    capability: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const validCapability = this.capability(capability);
    const reason = this.reason(body?.reason);
    return this.positionMutation(
      actor,
      identityId,
      schoolId,
      positionId,
      route.positionRevoke,
      key,
      operationId,
      { positionId, capability: validCapability, reason },
      async (tx, _position, operation) => {
        if (validCapability === "ROSTER_MANAGE")
          await this.keepRosterManager(tx, schoolId, positionId);
        await tx.positionCapabilityGrant.deleteMany({
          where: { schoolId, positionId, capability: validCapability },
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "POSITION_CAPABILITY_REVOKED",
          operation,
          { positionId, capability: validCapability, reason },
        );
        return { positionId, capability: validCapability };
      },
    );
  }
  async assignments(
    identityId: string,
    schoolId: string,
    schoolYearId: string,
  ) {
    await this.actor(identityId, schoolId);
    await this.year(schoolId, schoolYearId);
    const assignments = await this.prisma.staffClassAssignment.findMany({
      where: { schoolId, schoolYearId },
      include: { staffProfile: true },
      orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    });
    return assignments.map((item) => this.assignmentDto(item));
  }
  async createStaff(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const profile = this.staffInput(body);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.staff,
      key,
      operationId,
      profile,
      async (tx, operation) => {
        const binding = await this.staffBinding(
          tx,
          schoolId,
          profile.schoolMembershipId,
        );
        await this.activePosition(tx, schoolId, profile.primaryPositionId);
        const staff = await tx.staffProfile.create({
          data: {
            schoolId,
            ...profile,
            schoolMembershipId: binding,
            boundAt: binding ? new Date() : null,
            boundByMembershipId: binding ? actor.membershipId : null,
            dateOfBirth: this.dateValue(profile.dateOfBirth, "dateOfBirth"),
          },
          include: { primaryPosition: true },
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "STAFF_PROFILE_CREATED",
          operation,
          {
            staffProfileId: staff.id,
            primaryPositionId: profile.primaryPositionId,
            schoolMembershipId: binding,
          },
        );
        return this.staffDto(staff);
      },
    );
  }
  async updateStaff(
    identityId: string,
    schoolId: string,
    staffId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    if (!uuid.test(staffId))
      throw new NotFoundException({
        code: "STAFF_NOT_FOUND",
        message: "Không tìm thấy nhân sự.",
      });
    const profile = this.staffInput(body);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.staffUpdate,
      key,
      operationId,
      { staffId, ...profile },
      async (tx, operation) => {
        const existing = await tx.staffProfile.findFirst({
          where: { id: staffId, schoolId },
        });
        if (!existing)
          throw new NotFoundException({
            code: "STAFF_NOT_FOUND",
            message: "Không tìm thấy nhân sự.",
          });
        const binding = await this.staffBinding(
          tx,
          schoolId,
          profile.schoolMembershipId,
        );
        await this.activePosition(tx, schoolId, profile.primaryPositionId);
        const staff = await tx.staffProfile.update({
          where: { id: staffId },
          data: {
            ...profile,
            schoolMembershipId: binding,
            boundAt:
              binding === existing.schoolMembershipId
                ? existing.boundAt
                : binding
                  ? new Date()
                  : null,
            boundByMembershipId:
              binding === existing.schoolMembershipId
                ? existing.boundByMembershipId
                : binding
                  ? actor.membershipId
                  : null,
            dateOfBirth: this.dateValue(profile.dateOfBirth, "dateOfBirth"),
          },
          include: { primaryPosition: true },
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "STAFF_PROFILE_UPDATED",
          operation,
          {
            staffProfileId: staffId,
            primaryPositionId: profile.primaryPositionId,
            previousSchoolMembershipId: existing.schoolMembershipId,
            schoolMembershipId: binding,
          },
        );
        return this.staffDto(staff);
      },
    );
  }
  async createAssignment(
    identityId: string,
    schoolId: string,
    staffId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    if (!uuid.test(staffId))
      throw new NotFoundException({
        code: "STAFF_NOT_FOUND",
        message: "Không tìm thấy nhân sự.",
      });
    const input = this.assignmentInput(body);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.assignment,
      key,
      operationId,
      { staffId, ...input },
      async (tx, operation) => {
        const assignment = await this.writeAssignment(
          tx,
          schoolId,
          staffId,
          input,
        );
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "STAFF_CLASS_ASSIGNED",
          operation,
          {
            staffProfileId: staffId,
            assignmentId: assignment.id,
            reason: input.reason,
          },
        );
        return this.assignmentDto(assignment);
      },
    );
  }
  async changeAssignment(
    identityId: string,
    schoolId: string,
    assignmentId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    if (!uuid.test(assignmentId))
      throw new NotFoundException({
        code: "STAFF_ASSIGNMENT_NOT_FOUND",
        message: "Không tìm thấy phân công.",
      });
    const input = this.assignmentChangeInput(body);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.assignmentChange,
      key,
      operationId,
      { assignmentId, ...input },
      async (tx, operation) => {
        const existing = await tx.staffClassAssignment.findFirst({
          where: { id: assignmentId, schoolId },
        });
        if (!existing)
          throw new NotFoundException({
            code: "STAFF_ASSIGNMENT_NOT_FOUND",
            message: "Không tìm thấy phân công.",
          });
        for (const yearId of [
          existing.schoolYearId,
          input.schoolYearId,
        ].sort()) {
          await this.lockYear(tx, schoolId, yearId);
          this.openYear(await this.year(schoolId, yearId, tx));
        }
        if (existing.effectiveTo)
          throw new ConflictException({
            code: "STAFF_ASSIGNMENT_ENDED",
            message: "Phân công đã kết thúc chỉ có thể xem.",
          });
        const assignment = await this.writeAssignment(
          tx,
          schoolId,
          existing.staffProfileId,
          { ...input, effectiveTo: null },
          assignmentId,
        );
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "STAFF_CLASS_ASSIGNMENT_CHANGED",
          operation,
          {
            staffProfileId: existing.staffProfileId,
            assignmentId,
            reason: input.reason,
          },
        );
        return this.assignmentDto(assignment);
      },
    );
  }
  async endAssignment(
    identityId: string,
    schoolId: string,
    assignmentId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    if (!uuid.test(assignmentId))
      throw new NotFoundException({
        code: "STAFF_ASSIGNMENT_NOT_FOUND",
        message: "Không tìm thấy phân công.",
      });
    const effectiveTo = this.dateValue(body?.effectiveTo, "effectiveTo");
    const reason = this.reason(body?.reason);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.assignmentEnd,
      key,
      operationId,
      { assignmentId, effectiveTo: body?.effectiveTo, reason },
      async (tx, operation) => {
        const assignment = await tx.staffClassAssignment.findFirst({
          where: { id: assignmentId, schoolId },
          include: { staffProfile: true },
        });
        if (!assignment)
          throw new NotFoundException({
            code: "STAFF_ASSIGNMENT_NOT_FOUND",
            message: "Không tìm thấy phân công.",
          });
        await this.lockYear(tx, schoolId, assignment.schoolYearId);
        this.openYear(await this.year(schoolId, assignment.schoolYearId, tx));
        if (assignment.effectiveTo)
          throw new ConflictException({
            code: "STAFF_ASSIGNMENT_ENDED",
            message: "Phân công đã kết thúc chỉ có thể xem.",
          });
        this.assignmentInterval(
          assignment,
          assignment.effectiveFrom,
          effectiveTo,
        );
        const updated = await tx.staffClassAssignment.update({
          where: { id: assignmentId },
          data: { effectiveTo, endReason: reason },
          include: { staffProfile: true },
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "STAFF_CLASS_ASSIGNMENT_ENDED",
          operation,
          { staffProfileId: assignment.staffProfileId, assignmentId, reason },
        );
        return this.assignmentDto(updated);
      },
    );
  }
  async createSchoolYear(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const name = this.name(body?.name);
    const startsOn = this.date(body?.startsOn, "startsOn");
    const endsOn = this.date(body?.endsOn, "endsOn");
    if (startsOn >= endsOn)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { endsOn: "Ngày kết thúc phải sau ngày bắt đầu." },
      });
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.schoolYear,
      key,
      operationId,
      { name, startsOn, endsOn },
      async (tx, operation) => {
        const year = await tx.schoolYear.create({
          data: {
            schoolId,
            name,
            startsOn: new Date(`${startsOn}T00:00:00.000Z`),
            endsOn: new Date(`${endsOn}T00:00:00.000Z`),
          },
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "SCHOOL_YEAR_CREATED",
          operation,
          { schoolYearId: year.id },
        );
        return this.schoolYearDto(year);
      },
    );
  }
  async createClass(
    identityId: string,
    schoolId: string,
    schoolYearId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const name = this.name(body?.name);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.class,
      key,
      operationId,
      { schoolYearId, name },
      async (tx, operation) => {
        await this.lockYear(tx, schoolId, schoolYearId);
        const year = await this.year(schoolId, schoolYearId, tx);
        this.openYear(year);
        const classroom = await tx.class.create({
          data: { schoolId, schoolYearId, name },
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "CLASS_CREATED",
          operation,
          { classId: classroom.id },
        );
        return this.classDto(classroom);
      },
    );
  }
  async renameClass(
    identityId: string,
    schoolId: string,
    classId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const name = this.name(body?.name);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.rename,
      key,
      operationId,
      { classId, name },
      async (tx, operation) => {
        const classroom = await this.lockClass(tx, schoolId, classId);
        await this.lockYear(tx, schoolId, classroom.schoolYearId);
        this.openYear(await this.year(schoolId, classroom.schoolYearId, tx));
        if (classroom.status === "ARCHIVED")
          throw new ConflictException({
            code: "CLASS_ARCHIVED",
            message: "Lớp đã lưu trữ chỉ có thể xem.",
          });
        const updated = await tx.class.update({
          where: { id: classId },
          data: { name },
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "CLASS_RENAMED",
          operation,
          { classId },
        );
        return this.classDto(updated);
      },
    );
  }
  async archiveClass(
    identityId: string,
    schoolId: string,
    classId: string,
    key: string,
    operationId: string,
  ) {
    const actor = await this.actor(identityId, schoolId);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.archive,
      key,
      operationId,
      { classId },
      async (tx, operation) => {
        const classroom = await this.lockClass(tx, schoolId, classId);
        await this.lockYear(tx, schoolId, classroom.schoolYearId);
        this.openYear(await this.year(schoolId, classroom.schoolYearId, tx));
        const activeStudentCount = await tx.enrollmentClassAssignment.count({
          where: {
            schoolId,
            classId,
            effectiveTo: null,
            enrollment: { lifecycle: "ENROLLED", endedOn: null },
          },
        });
        const openStaffAssignmentCount = await tx.staffClassAssignment.count({
          where: { schoolId, classId, effectiveTo: null },
        });
        if (classroom.status === "ARCHIVED")
          return this.classDto(classroom, activeStudentCount);
        if (activeStudentCount)
          throw new ConflictException({
            code: "CLASS_HAS_ACTIVE_STUDENTS",
            message: "Lớp còn học sinh đang nhập học.",
            activeStudentCount,
          });
        if (openStaffAssignmentCount)
          throw new ConflictException({
            code: "CLASS_HAS_OPEN_STAFF_ASSIGNMENTS",
            message: "Lớp còn phân công nhân sự chưa kết thúc.",
            openStaffAssignmentCount,
          });
        const updated = await tx.class.update({
          where: { id: classId },
          data: { status: "ARCHIVED" },
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "CLASS_ARCHIVED",
          operation,
          { classId },
        );
        return this.classDto(updated);
      },
    );
  }
  async createStudent(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const fullName = this.name(body?.fullName, "fullName");
    const dateOfBirth = this.dateValue(body?.dateOfBirth, "dateOfBirth");
    const schoolYearId =
      typeof body?.schoolYearId === "string" ? body.schoolYearId : "";
    const classId = typeof body?.classId === "string" ? body.classId : "";
    const lifecycle = typeof body?.lifecycle === "string" ? body.lifecycle : "";
    const effectiveFrom = this.dateValue(body?.effectiveFrom, "effectiveFrom");
    const endedOn =
      body?.endedOn == null || body.endedOn === ""
        ? null
        : this.dateValue(body.endedOn, "endedOn");
    this.lifecycleInterval(lifecycle, effectiveFrom, endedOn);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.student,
      key,
      operationId,
      {
        fullName,
        dateOfBirth: body.dateOfBirth,
        schoolYearId,
        classId,
        lifecycle,
        effectiveFrom: body.effectiveFrom,
        endedOn: body.endedOn ?? null,
      },
      async (tx, operation) => {
        await this.lockYear(tx, schoolId, schoolYearId);
        const year = await this.year(schoolId, schoolYearId, tx);
        this.activeYear(year);
        this.yearInterval(year, effectiveFrom, endedOn);
        const classroom = await this.lockClass(tx, schoolId, classId);
        if (classroom.schoolYearId !== schoolYearId)
          throw new NotFoundException({
            code: "CLASS_NOT_FOUND",
            message: "Không tìm thấy lớp.",
          });
        if (classroom.status === "ARCHIVED")
          throw new ConflictException({
            code: "CLASS_ARCHIVED",
            message: "Lớp đã lưu trữ chỉ có thể xem.",
          });
        const school = await tx.school.update({
          where: { id: schoolId },
          data: { studentCodeSequence: { increment: 1 } },
          select: { studentCodePrefix: true, studentCodeSequence: true },
        });
        const student = await tx.student.create({
          data: {
            schoolId,
            studentCode: `${school.studentCodePrefix}${school.studentCodeSequence}`,
            fullName,
            dateOfBirth,
          },
        });
        const enrollment = await tx.studentEnrollment.create({
          data: {
            schoolId,
            studentId: student.id,
            schoolYearId,
            classId,
            lifecycle,
            effectiveFrom,
            endedOn,
            schoolYearName: year.name,
            schoolYearStartsOn: year.startsOn,
            schoolYearEndsOn: year.endsOn,
            className: classroom.name,
          },
        });
        await tx.enrollmentClassAssignment.create({
          data: {
            schoolId,
            enrollmentId: enrollment.id,
            schoolYearId,
            classId,
            effectiveFrom,
            effectiveTo: endedOn,
            reason: "Khởi tạo enrollment",
          },
        });
        await this.transition(
          tx,
          schoolId,
          enrollment,
          null,
          identityId,
          actor.membershipId,
          operation,
        );
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "STUDENT_ENROLLMENT_CREATED",
          operation,
          { studentId: student.id, enrollmentId: enrollment.id },
        );
        return this.studentDto({
          ...student,
          enrollments: [
            { ...enrollment, lifecycleTransitions: [], classAssignments: [] },
          ],
        });
      },
    );
  }
  async changeLifecycle(
    identityId: string,
    schoolId: string,
    enrollmentId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const lifecycle = typeof body?.lifecycle === "string" ? body.lifecycle : "";
    const endedOn =
      body?.endedOn == null || body.endedOn === ""
        ? null
        : this.dateValue(body.endedOn, "endedOn");
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.lifecycle,
      key,
      operationId,
      { enrollmentId, lifecycle, endedOn: body?.endedOn ?? null },
      async (tx, operation) => {
        const enrollment = await tx.studentEnrollment.findFirst({
          where: { id: enrollmentId, schoolId },
        });
        if (!enrollment)
          throw new NotFoundException({
            code: "ENROLLMENT_NOT_FOUND",
            message: "Không tìm thấy enrollment.",
          });
        const classroom = await this.lockClass(tx, schoolId, enrollment.classId);
        await this.lockYear(tx, schoolId, enrollment.schoolYearId);
        this.openYear(await this.year(schoolId, enrollment.schoolYearId, tx));
        if (lifecycle === "ENROLLED" && classroom.status === "ARCHIVED")
          throw new ConflictException({
            code: "CLASS_ARCHIVED",
            message: "Lớp đã lưu trữ chỉ có thể xem.",
          });
        this.lifecycleInterval(lifecycle, enrollment.effectiveFrom, endedOn);
        this.yearInterval(enrollment, enrollment.effectiveFrom, endedOn);
        const placement = await tx.enrollmentClassAssignment.findFirst({
          where: { schoolId, enrollmentId, effectiveTo: null },
        });
        if (terminal.has(lifecycle)) {
          if (placement) {
            if (placement.effectiveFrom >= endedOn!)
              throw new BadRequestException({
                code: "VALIDATION_ERROR",
                message: "Dữ liệu không hợp lệ.",
                fieldErrors: {
                  endedOn: "Ngày kết thúc phải sau ngày hiệu lực phân lớp.",
                },
              });
            await tx.enrollmentClassAssignment.update({
              where: { id: placement.id },
              data: { effectiveTo: endedOn },
            });
          }
        } else if (!placement && enrollment.endedOn) {
          const prior = await tx.enrollmentClassAssignment.findFirst({
            where: { schoolId, enrollmentId },
            orderBy: { effectiveTo: "desc" },
          });
          if (
            !prior ||
            !prior.effectiveTo ||
            prior.effectiveTo >=
              (await this.year(schoolId, enrollment.schoolYearId, tx)).endsOn
          )
            throw new ConflictException({
              code: "PLACEMENT_REACTIVATION_INVALID",
              message:
                "Không thể khôi phục enrollment khi không có phân lớp hợp lệ.",
            });
          const classroom = await this.lockClass(tx, schoolId, prior.classId);
          if (classroom.status === "ARCHIVED")
            throw new ConflictException({
              code: "CLASS_ARCHIVED",
              message: "Lớp đã lưu trữ chỉ có thể xem.",
            });
          await tx.enrollmentClassAssignment.create({
            data: {
              schoolId,
              enrollmentId,
              schoolYearId: enrollment.schoolYearId,
              classId: prior.classId,
              effectiveFrom: prior.effectiveTo,
              reason: "Khôi phục enrollment",
            },
          });
        }
        const updated = await tx.studentEnrollment.update({
          where: { id: enrollment.id },
          data: { lifecycle, endedOn },
        });
        await this.transition(
          tx,
          schoolId,
          updated,
          enrollment.lifecycle,
          identityId,
          actor.membershipId,
          operation,
        );
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "STUDENT_ENROLLMENT_LIFECYCLE_CHANGED",
          operation,
          {
            enrollmentId,
            previousLifecycle: enrollment.lifecycle,
            lifecycle,
            endedOn: body?.endedOn ?? null,
          },
        );
        return this.enrollmentDto({ ...updated, lifecycleTransitions: [] });
      },
    );
  }
  async previewTransition(identityId: string, schoolId: string, body: any) {
    await this.actor(identityId, schoolId);
    return this.transitionPreview(
      this.prisma,
      schoolId,
      this.transitionInput(body),
    );
  }
  async previewCloseYear(identityId: string, schoolId: string, body: any) {
    await this.actor(identityId, schoolId);
    return this.closeYearPreview(this.prisma, schoolId, body);
  }
  async transitionEnrollments(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const input = this.transitionInput(body);
    const selectedEnrollmentIds = Array.isArray(body?.selectedEnrollmentIds)
      ? body.selectedEnrollmentIds
          .filter((id: unknown): id is string => typeof id === "string")
          .sort()
      : [];
    const fingerprint =
      typeof body?.previewFingerprint === "string"
        ? body.previewFingerprint
        : "";
    if (
      !fingerprint ||
      !selectedEnrollmentIds.length ||
      body?.confirmation !== "CHUYỂN DANH BỘ"
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Cần xác nhận đúng tên thao tác và danh sách học sinh.",
      });
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.transition,
      key,
      operationId,
      { ...input, selectedEnrollmentIds, previewFingerprint: fingerprint },
      async (tx, operation) => {
        const preview = await this.transitionPreview(tx, schoolId, input, true);
        if (
          preview.fingerprint !== fingerprint ||
          JSON.stringify(
            preview.movable.map((item: any) => item.enrollmentId).sort(),
          ) !== JSON.stringify(selectedEnrollmentIds)
        )
          throw new ConflictException({
            code: "TRANSITION_PREVIEW_STALE",
            message: "Kết quả xem trước đã thay đổi. Hãy xem trước lại.",
          });
        const effectiveFrom = this.dateValue(
          input.effectiveFrom,
          "effectiveFrom",
        );
        for (const item of preview.movable) {
          const enrollment = await tx.studentEnrollment.findFirstOrThrow({
            where: { id: item.enrollmentId, schoolId },
          });
          await tx.enrollmentClassAssignment.update({
            where: { id: item.assignmentId },
            data: { effectiveTo: effectiveFrom },
          });
          if (input.kind === "CLASS_TRANSFER")
            await tx.enrollmentClassAssignment.create({
              data: {
                schoolId,
                enrollmentId: enrollment.id,
                schoolYearId: input.destinationSchoolYearId,
                classId: input.destinationClassId,
                effectiveFrom,
                reason: input.reason,
              },
            });
          else {
            const destination = await this.year(
              schoolId,
              input.destinationSchoolYearId,
              tx,
            );
            const classroom = await this.lockClass(
              tx,
              schoolId,
              input.destinationClassId,
            );
            await tx.studentEnrollment.create({
              data: {
                schoolId,
                studentId: enrollment.studentId,
                schoolYearId: destination.id,
                classId: classroom.id,
                lifecycle: "ENROLLED",
                effectiveFrom,
                schoolYearName: destination.name,
                schoolYearStartsOn: destination.startsOn,
                schoolYearEndsOn: destination.endsOn,
                className: classroom.name,
                classAssignments: {
                  create: {
                    schoolYearId: destination.id,
                    classId: classroom.id,
                    effectiveFrom,
                    reason: input.reason,
                  },
                },
              },
            });
          }
        }
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "ROSTER_TRANSITION_COMPLETED",
          operation,
          {
            ...input,
            previewFingerprint: fingerprint,
            enrollmentIds: selectedEnrollmentIds,
          },
        );
        return {
          previewFingerprint: fingerprint,
          movedEnrollmentIds: selectedEnrollmentIds,
        };
      },
    );
  }
  async closeYear(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const schoolYearId =
      typeof body?.schoolYearId === "string" ? body.schoolYearId : "";
    const effectiveTo = this.date(body?.effectiveTo, "effectiveTo");
    const reason = this.reason(body?.reason);
    const previewFingerprint =
      typeof body?.previewFingerprint === "string"
        ? body.previewFingerprint
        : "";
    if (body?.confirmation !== "ĐÓNG NĂM HỌC" || !previewFingerprint)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Cần xác nhận đúng tên thao tác.",
      });
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route.closeYear,
      key,
      operationId,
      { schoolYearId, effectiveTo, reason, previewFingerprint },
      async (tx, operation) => {
        await this.lockYear(tx, schoolId, schoolYearId);
        const preview = await this.closeYearPreview(tx, schoolId, {
          schoolYearId,
          effectiveTo,
          reason,
        });
        if (preview.fingerprint !== previewFingerprint)
          throw new ConflictException({
            code: "CLOSE_YEAR_PREVIEW_STALE",
            message: "Kết quả xem trước đã thay đổi. Hãy xem trước lại.",
          });
        const end = this.dateValue(effectiveTo, "effectiveTo");
        for (const assignment of preview.assignments)
          await tx.enrollmentClassAssignment.update({
            where: { id: assignment.assignmentId },
            data: { effectiveTo: end },
          });
        await tx.schoolYear.update({
          where: { id: schoolYearId },
          data: {
            closedAt: new Date(),
            closedByMembershipId: actor.membershipId,
            closeOperationId: operation,
          },
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "SCHOOL_YEAR_CLOSED",
          operation,
          {
            schoolYearId,
            effectiveTo,
            reason,
            previewFingerprint,
            closedAssignmentCount: preview.assignments.length,
          },
        );
        return {
          schoolYearId,
          effectiveTo,
          closedAssignmentCount: preview.assignments.length,
        };
      },
    );
  }
  private transitionInput(body: any) {
    const kind =
      body?.kind === "CLASS_TRANSFER" || body?.kind === "YEAR_TRANSITION"
        ? body.kind
        : "";
    if (!kind)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { kind: "Loại chuyển danh bộ không hợp lệ." },
      });
    const sourceSchoolYearId =
      typeof body?.sourceSchoolYearId === "string"
        ? body.sourceSchoolYearId
        : "";
    const sourceClassId =
      typeof body?.sourceClassId === "string" ? body.sourceClassId : "";
    const destinationSchoolYearId =
      typeof body?.destinationSchoolYearId === "string"
        ? body.destinationSchoolYearId
        : "";
    const destinationClassId =
      typeof body?.destinationClassId === "string"
        ? body.destinationClassId
        : "";
    return {
      kind,
      sourceSchoolYearId,
      sourceClassId,
      destinationSchoolYearId,
      destinationClassId,
      effectiveFrom: this.date(body?.effectiveFrom, "effectiveFrom"),
      reason: this.reason(body?.reason),
    };
  }
  private async transitionPreview(
    client: any,
    schoolId: string,
    input: any,
    lock = false,
  ) {
    if (lock)
      for (const yearId of [
        input.sourceSchoolYearId,
        input.destinationSchoolYearId,
      ].sort())
        await this.lockYear(client, schoolId, yearId);
    const sourceYear = await this.year(
      schoolId,
      input.sourceSchoolYearId,
      client,
    );
    const destinationYear = await this.year(
      schoolId,
      input.destinationSchoolYearId,
      client,
    );
    if (sourceYear.closedAt || destinationYear.closedAt)
      throw new ConflictException({
        code: "SCHOOL_YEAR_CLOSED",
        message: "Năm học đã đóng chỉ có thể xem.",
      });
    const effective = this.dateValue(input.effectiveFrom, "effectiveFrom");
    if (
      input.kind === "CLASS_TRANSFER" &&
      (input.sourceSchoolYearId !== input.destinationSchoolYearId ||
        input.sourceClassId === input.destinationClassId)
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Chuyển lớp phải sang lớp khác trong cùng năm học.",
        fieldErrors: {
          destinationClassId: "Lớp đích phải khác lớp nguồn và cùng năm học.",
        },
      });
    if (
      input.kind === "YEAR_TRANSITION" &&
      (input.sourceSchoolYearId === input.destinationSchoolYearId ||
        destinationYear.startsOn < sourceYear.endsOn ||
        effective < sourceYear.endsOn)
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Chuyển năm phải sang năm kế tiếp sau năm nguồn.",
        fieldErrors: {
          effectiveFrom:
            "Ngày chuyển năm phải không sớm hơn ngày kết thúc năm nguồn.",
        },
      });
    const sourceClass = await this.lockClass(
      client,
      schoolId,
      input.sourceClassId,
    );
    const destinationClass = await this.lockClass(
      client,
      schoolId,
      input.destinationClassId,
    );
    if (
      sourceClass.schoolYearId !== sourceYear.id ||
      destinationClass.schoolYearId !== destinationYear.id ||
      destinationClass.status === "ARCHIVED"
    )
      throw new NotFoundException({
        code: "CLASS_NOT_FOUND",
        message: "Không tìm thấy lớp hợp lệ.",
      });
    this.assignmentInterval(destinationYear, effective, null);
    if (input.kind === "CLASS_TRANSFER")
      this.assignmentInterval(sourceYear, effective, null);
    const assignments = await client.enrollmentClassAssignment.findMany({
      where: {
        schoolId,
        schoolYearId: sourceYear.id,
        classId: sourceClass.id,
        effectiveTo: null,
      },
      include: { enrollment: { include: { student: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (
      assignments.some(
        (assignment: any) => effective <= assignment.effectiveFrom,
      )
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          effectiveFrom: "Ngày chuyển phải sau ngày hiệu lực phân lớp nguồn.",
        },
      });
    if (lock)
      for (const assignment of assignments)
        await client.$queryRaw`SELECT 1 FROM "EnrollmentClassAssignment" WHERE "id" = ${assignment.id}::uuid FOR UPDATE`;
    const movable: any[] = [];
    const excluded: any[] = [];
    for (const assignment of assignments) {
      const enrollment = assignment.enrollment;
      let reason: string | undefined;
      if (enrollment.lifecycle !== "ENROLLED")
        reason = "Enrollment không còn đang nhập học.";
      else if (
        input.kind === "YEAR_TRANSITION" &&
        (await client.studentEnrollment.findFirst({
          where: {
            schoolId,
            studentId: enrollment.studentId,
            schoolYearId: destinationYear.id,
          },
        }))
      )
        reason = "Học sinh đã có enrollment trong năm học đích.";
      if (reason)
        excluded.push({
          enrollmentId: enrollment.id,
          student: {
            id: enrollment.student.id,
            fullName: enrollment.student.fullName,
          },
          reason,
        });
      else
        movable.push({
          enrollmentId: enrollment.id,
          assignmentId: assignment.id,
          student: {
            id: enrollment.student.id,
            fullName: enrollment.student.fullName,
          },
          source: { schoolYearId: sourceYear.id, classId: sourceClass.id },
          destination: {
            schoolYearId: destinationYear.id,
            classId: destinationClass.id,
          },
          effectiveFrom: input.effectiveFrom,
          reason: input.reason,
        });
    }
    const fingerprint = requestFingerprint({
      input,
      movable: movable.map(({ enrollmentId, assignmentId }) => ({
        enrollmentId,
        assignmentId,
      })),
    });
    return {
      kind: input.kind,
      source: {
        schoolYearId: sourceYear.id,
        schoolYearName: sourceYear.name,
        classId: sourceClass.id,
        className: sourceClass.name,
      },
      destination: {
        schoolYearId: destinationYear.id,
        schoolYearName: destinationYear.name,
        classId: destinationClass.id,
        className: destinationClass.name,
      },
      effectiveFrom: input.effectiveFrom,
      reason: input.reason,
      movable,
      excluded,
      fingerprint,
    };
  }
  private async closeYearPreview(client: any, schoolId: string, body: any) {
    const schoolYearId =
      typeof body?.schoolYearId === "string" ? body.schoolYearId : "";
    const effectiveTo = this.date(body?.effectiveTo, "effectiveTo");
    const reason = this.reason(body?.reason);
    const year = await this.year(schoolId, schoolYearId, client);
    if (year.closedAt)
      throw new ConflictException({
        code: "SCHOOL_YEAR_CLOSED",
        message: "Năm học đã được đóng.",
      });
    const end = this.dateValue(effectiveTo, "effectiveTo");
    if (end < year.startsOn || end > year.endsOn)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { effectiveTo: "Ngày đóng phải nằm trong năm học." },
      });
    const assignments = await client.enrollmentClassAssignment.findMany({
      where: { schoolId, schoolYearId, effectiveTo: null },
      include: { enrollment: { include: { student: true } } },
    });
    if (assignments.some((item: any) => item.effectiveFrom >= end))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          effectiveTo: "Ngày đóng phải sau ngày hiệu lực phân lớp.",
        },
      });
    return {
      schoolYearId,
      effectiveTo,
      reason,
      assignments: assignments.map((item: any) => ({
        assignmentId: item.id,
        enrollmentId: item.enrollmentId,
        student: { fullName: item.enrollment.student.fullName },
        source: {
          classId: item.classId,
          effectiveFrom: item.effectiveFrom.toISOString().slice(0, 10),
        },
      })),
      fingerprint: requestFingerprint({
        schoolYearId,
        effectiveTo,
        reason,
        assignmentIds: assignments.map((item: any) => item.id).sort(),
      }),
    };
  }
  private text(value: unknown, field: string, label: string, limit = 200) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > limit)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { [field]: `${label} cần từ 1 đến ${limit} ký tự.` },
      });
    return text;
  }
  private email(value: unknown) {
    const email = this.text(value, "email", "Email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { email: "Email không hợp lệ." },
      });
    return email;
  }
  private staffInput(body: any) {
    const employmentStatus = body?.employmentStatus ?? "ACTIVE";
    const primaryPositionId =
      typeof body?.primaryPositionId === "string" ? body.primaryPositionId : "";
    const schoolMembershipId =
      body?.schoolMembershipId == null || body.schoolMembershipId === ""
        ? null
        : body.schoolMembershipId;
    if (
      !["ACTIVE", "INACTIVE"].includes(employmentStatus) ||
      !uuid.test(primaryPositionId) ||
      (schoolMembershipId !== null &&
        (typeof schoolMembershipId !== "string" ||
          !uuid.test(schoolMembershipId)))
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          employmentStatus: "Trạng thái nhân sự không hợp lệ.",
          primaryPositionId: "Chức danh không hợp lệ.",
          schoolMembershipId: "Membership không hợp lệ.",
        },
      });
    return {
      fullName: this.name(body?.fullName, "fullName"),
      email: this.email(body?.email),
      phone: this.text(body?.phone, "phone", "Số điện thoại", 30),
      dateOfBirth: this.date(body?.dateOfBirth, "dateOfBirth"),
      gender: this.text(body?.gender, "gender", "Giới tính", 30),
      address: this.text(body?.address, "address", "Địa chỉ", 500),
      employmentStatus,
      primaryPositionId,
      schoolMembershipId,
    };
  }
  private capability(value: unknown) {
    const capability = typeof value === "string" ? value : "";
    const catalog = new Set([
      "SCHOOL_CONTEXT_READ",
      "ACCESS_MANAGE",
      "ROSTER_MANAGE",
      "SETTINGS_MANAGE",
      "CLASS_LEAVE_READ",
      "LEAVE_REQUEST_DECIDE",
      "ATTENDANCE_WRITE",
      "DAILY_JOURNAL_WRITE",
      "HANDOVER_WRITE",
      "WORKFORCE_MANAGE",
      "TIMEKEEPING_IMPORT",
      "TIMEKEEPING_REVIEW",
      "LATE_CARE_MANAGE",
      "PAYROLL_PREPARE",
      "PAYROLL_RECONCILE",
      "PAYROLL_APPROVE",
      "PAYROLL_REOPEN",
      "PAYROLL_PAYOUT_CONFIRM",
      "PAYROLL_REPORT_READ",
    ]);
    if (!catalog.has(capability))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { capability: "Capability phải thuộc danh mục hệ thống." },
      });
    return capability;
  }
  private positionInput(body: any) {
    const code =
      typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    const capabilities: string[] = Array.isArray(body?.capabilities)
      ? [
          ...new Set(
            (body.capabilities as unknown[]).filter(
              (value): value is string => typeof value === "string",
            ),
          ),
        ]
      : [];
    const catalog = new Set([
      "SCHOOL_CONTEXT_READ",
      "ACCESS_MANAGE",
      "ROSTER_MANAGE",
      "SETTINGS_MANAGE",
      "CLASS_LEAVE_READ",
      "LEAVE_REQUEST_DECIDE",
      "ATTENDANCE_WRITE",
      "DAILY_JOURNAL_WRITE",
      "HANDOVER_WRITE",
      "WORKFORCE_MANAGE",
      "TIMEKEEPING_IMPORT",
      "TIMEKEEPING_REVIEW",
      "LATE_CARE_MANAGE",
      "PAYROLL_PREPARE",
      "PAYROLL_RECONCILE",
      "PAYROLL_APPROVE",
      "PAYROLL_REOPEN",
      "PAYROLL_PAYOUT_CONFIRM",
      "PAYROLL_REPORT_READ",
    ]);
    if (
      !/^[A-Z][A-Z0-9_]{1,49}$/.test(code) ||
      capabilities.some((capability) => !catalog.has(capability))
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          code: "Mã chức danh không hợp lệ.",
          capabilities: "Capability phải thuộc danh mục hệ thống.",
        },
      });
    return {
      code,
      name: this.name(body?.name),
      capabilities,
      reason: this.reason(body?.reason),
    };
  }
  private reason(value: unknown) {
    return this.text(value, "reason", "Lý do", 500);
  }
  private assignmentInput(body: any) {
    const schoolYearId =
      typeof body?.schoolYearId === "string" ? body.schoolYearId : "";
    const classId = typeof body?.classId === "string" ? body.classId : "";
    return {
      schoolYearId,
      classId,
      effectiveFrom: this.dateValue(body?.effectiveFrom, "effectiveFrom"),
      effectiveTo:
        body?.effectiveTo == null || body.effectiveTo === ""
          ? null
          : this.dateValue(body.effectiveTo, "effectiveTo"),
      reason: this.reason(body?.reason),
    };
  }
  private assignmentChangeInput(body: any) {
    if (body?.effectiveTo != null && body.effectiveTo !== "")
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          effectiveTo:
            "Ngày kết thúc chỉ được ghi nhận khi kết thúc phân công.",
        },
      });
    return this.assignmentInput({ ...body, effectiveTo: null });
  }
  private assignmentInterval(
    year: any,
    effectiveFrom: Date,
    effectiveTo: Date | null,
  ) {
    if (effectiveTo && effectiveFrom >= effectiveTo)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { effectiveTo: "Ngày kết thúc phải sau ngày hiệu lực." },
      });
    if (
      effectiveFrom < year.startsOn ||
      effectiveFrom >= year.endsOn ||
      (effectiveTo &&
        (effectiveTo <= year.startsOn || effectiveTo > year.endsOn))
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          effectiveFrom: "Ngày hiệu lực phải nằm trong năm học.",
          ...(effectiveTo
            ? { effectiveTo: "Ngày kết thúc phải nằm trong năm học." }
            : {}),
        },
      });
  }
  private async staffBinding(
    tx: any,
    schoolId: string,
    membershipId: string | null,
  ) {
    if (!membershipId) return null;
    const membership = await tx.schoolMembership.findFirst({
      where: { id: membershipId, schoolId, status: "ACTIVE" },
    });
    if (!membership)
      throw new NotFoundException({
        code: "MEMBERSHIP_NOT_FOUND",
        message: "Không tìm thấy membership đang hiệu lực.",
      });
    return membershipId;
  }
  private async activePosition(tx: any, schoolId: string, positionId: string) {
    const position = await tx.schoolPosition.findFirst({
      where: { id: positionId, schoolId, status: "ACTIVE" },
    });
    if (!position)
      throw new ConflictException({
        code: "POSITION_NOT_ACTIVE",
        message: "Chức danh không thuộc trường hoặc không còn hiệu lực.",
      });
  }
  private async keepRosterManager(tx: any, schoolId: string, positionId: string) {
    const target = await tx.schoolPosition.findFirst({
      where: {
        id: positionId,
        schoolId,
        status: "ACTIVE",
        grants: { some: { capability: "ROSTER_MANAGE" } },
      },
      select: { id: true },
    });
    if (!target) return;
    const otherActiveBoundManagers = await tx.staffProfile.count({
      where: {
        schoolId,
        primaryPositionId: { not: positionId },
        employmentStatus: "ACTIVE",
        schoolMembershipId: { not: null },
        schoolMembership: { status: "ACTIVE" },
        primaryPosition: {
          status: "ACTIVE",
          grants: { some: { capability: "ROSTER_MANAGE" } },
        },
      },
    });
    if (!otherActiveBoundManagers)
      throw new ConflictException({
        code: "LAST_ROSTER_MANAGER",
        message: "Trường phải còn ít nhất một nhân sự quản lý danh bộ đang hiệu lực.",
      });
  }
  private async positionMutation(
    actor: { membershipId: string },
    identityId: string,
    schoolId: string,
    positionId: string,
    command: string,
    key: string,
    operationId: string,
    body: unknown,
    work: (tx: any, position: any, operation: string) => Promise<unknown>,
  ) {
    if (!uuid.test(positionId))
      throw new NotFoundException({
        code: "POSITION_NOT_FOUND",
        message: "Không tìm thấy chức danh.",
      });
    return this.mutate(
      actor,
      identityId,
      schoolId,
      command,
      key,
      operationId,
      body,
      async (tx, operation) => {
        const position = await tx.schoolPosition.findFirst({
          where: { id: positionId, schoolId },
        });
        if (!position)
          throw new NotFoundException({
            code: "POSITION_NOT_FOUND",
            message: "Không tìm thấy chức danh.",
          });
        return work(tx, position, operation);
      },
    );
  }
  private async writeAssignment(
    tx: any,
    schoolId: string,
    staffId: string,
    input: {
      schoolYearId: string;
      classId: string;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      reason: string;
    },
    assignmentId?: string,
  ) {
    const staff = await tx.staffProfile.findFirst({
      where: {
        id: staffId,
        schoolId,
        employmentStatus: "ACTIVE",
        primaryPosition: {
          status: "ACTIVE",
          grants: {
            some: {
              capability: {
                in: [
                  "CLASS_LEAVE_READ",
                  "ATTENDANCE_WRITE",
                  "DAILY_JOURNAL_WRITE",
                ],
              },
            },
          },
        },
      },
    });
    if (!staff)
      throw new ConflictException({
        code: "STAFF_NOT_ASSIGNABLE",
        message: "Nhân sự cần chức danh hiệu lực có capability vận hành lớp.",
      });
    await this.lockYear(tx, schoolId, input.schoolYearId);
    const year = await this.year(schoolId, input.schoolYearId, tx);
    this.openYear(year);
    this.assignmentInterval(year, input.effectiveFrom, input.effectiveTo);
    const classroom = await this.lockClass(tx, schoolId, input.classId);
    if (classroom.schoolYearId !== input.schoolYearId)
      throw new NotFoundException({
        code: "CLASS_NOT_FOUND",
        message: "Không tìm thấy lớp.",
      });
    if (classroom.status === "ARCHIVED")
      throw new ConflictException({
        code: "CLASS_ARCHIVED",
        message: "Lớp đã lưu trữ chỉ có thể xem.",
      });
    const data = {
      schoolId,
      staffProfileId: staffId,
      schoolYearId: input.schoolYearId,
      classId: input.classId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      reason: input.reason,
      schoolYearName: year.name,
      schoolYearStartsOn: year.startsOn,
      schoolYearEndsOn: year.endsOn,
      className: classroom.name,
    };
    try {
      return assignmentId
        ? await tx.staffClassAssignment.update({
            where: { id: assignmentId },
            data,
            include: { staffProfile: true },
          })
        : await tx.staffClassAssignment.create({
            data,
            include: { staffProfile: true },
          });
    } catch (error) {
      if (this.assignmentConflict(error))
        throw new ConflictException({
          code: "STAFF_CLASS_ASSIGNMENT_OVERLAP",
          message: "Khoảng phân công cùng nhân sự và lớp bị chồng lấn.",
        });
      throw error;
    }
  }
  private lifecycleInterval(
    lifecycle: string,
    effectiveFrom: Date,
    endedOn: Date | null,
  ) {
    if (!lifecycles.has(lifecycle))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { lifecycle: "Trạng thái enrollment không hợp lệ." },
      });
    if (endedOn && effectiveFrom >= endedOn)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { endedOn: "Ngày kết thúc phải sau ngày bắt đầu." },
      });
    if (
      (terminal.has(lifecycle) && !endedOn) ||
      (!terminal.has(lifecycle) && endedOn)
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          endedOn: terminal.has(lifecycle)
            ? "Trạng thái kết thúc cần ngày kết thúc."
            : "Trạng thái đang hiệu lực không có ngày kết thúc.",
        },
      });
  }
  private yearInterval(year: any, effectiveFrom: Date, endedOn: Date | null) {
    if (
      effectiveFrom < year.startsOn ||
      effectiveFrom >= year.endsOn ||
      (endedOn && (endedOn < year.startsOn || endedOn >= year.endsOn))
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          effectiveFrom: "Ngày enrollment phải nằm trong năm học.",
          ...(endedOn
            ? { endedOn: "Ngày kết thúc phải nằm trong năm học." }
            : {}),
        },
      });
  }
  private activeYear(year: any) {
    this.openYear(year);
    const today = this.businessToday();
    if (
      !(
        year.startsOn.toISOString().slice(0, 10) <= today &&
        today < year.endsOn.toISOString().slice(0, 10)
      )
    )
      throw new ConflictException({
        code: "SCHOOL_YEAR_NOT_ACTIVE",
        message: "Chỉ có thể tạo enrollment trong năm học đang hoạt động.",
      });
  }
  private openYear(year: any) {
    if (year.closedAt)
      throw new ConflictException({
        code: "SCHOOL_YEAR_CLOSED",
        message: "Năm học đã đóng chỉ có thể xem.",
      });
  }
  private async year(
    schoolId: string,
    schoolYearId: string,
    client: any = this.prisma,
  ) {
    if (!uuid.test(schoolYearId))
      throw new NotFoundException({
        code: "SCHOOL_YEAR_NOT_FOUND",
        message: "Không tìm thấy năm học.",
      });
    const year = await client.schoolYear.findFirst({
      where: { id: schoolYearId, schoolId },
    });
    if (!year)
      throw new NotFoundException({
        code: "SCHOOL_YEAR_NOT_FOUND",
        message: "Không tìm thấy năm học.",
      });
    return year;
  }
  private async lockYear(tx: any, schoolId: string, schoolYearId: string) {
    await this.year(schoolId, schoolYearId, tx);
    await tx.$queryRaw`SELECT 1 FROM "SchoolYear" WHERE "id" = ${schoolYearId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
  }
  private async lockClass(tx: any, schoolId: string, classId: string) {
    if (!uuid.test(classId))
      throw new NotFoundException({
        code: "CLASS_NOT_FOUND",
        message: "Không tìm thấy lớp.",
      });
    await tx.$queryRaw`SELECT 1 FROM "Class" WHERE "id" = ${classId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
    const classroom = await tx.class.findFirst({
      where: { id: classId, schoolId },
    });
    if (!classroom)
      throw new NotFoundException({
        code: "CLASS_NOT_FOUND",
        message: "Không tìm thấy lớp.",
      });
    return classroom;
  }
  private async transition(
    tx: any,
    schoolId: string,
    enrollment: any,
    previousLifecycle: string | null,
    actorIdentityId: string,
    membershipId: string,
    operationId: string,
  ) {
    await tx.studentEnrollmentLifecycleTransition.create({
      data: {
        schoolId,
        enrollmentId: enrollment.id,
        previousLifecycle,
        lifecycle: enrollment.lifecycle,
        effectiveFrom: enrollment.effectiveFrom,
        endedOn: enrollment.endedOn,
        actorIdentityId,
        membershipId,
        operationId,
      },
    });
  }
  private async audit(
    tx: any,
    schoolId: string,
    identityId: string,
    membershipId: string,
    action: string,
    operationId: string,
    provenance: object,
  ) {
    await tx.auditRecord.create({
      data: auditData(
        schoolId,
        {
          identityId,
          type: "SCHOOL_MEMBERSHIP",
          reference: membershipId,
          membershipId,
        },
        action,
        { operationId, ...provenance },
      ),
    });
  }
  private async mutate(
    actor: { membershipId: string },
    identityId: string,
    schoolId: string,
    command: string,
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
        route: command,
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
        const active = await tx.school.findFirst({
          where: { id: schoolId, status: "ACTIVE" },
          select: { id: true },
        });
        if (!active)
          throw new NotFoundException({
            code: "SCHOOL_CONTEXT_DENIED",
            message: "Không thể truy cập ngữ cảnh trường này.",
          });
        const current = await tx.schoolMembership.findFirst({
          where: {
            id: actor.membershipId,
            schoolId,
            userIdentityId: identityId,
            status: "ACTIVE",
            boundStaffProfile: { employmentStatus: "ACTIVE", primaryPosition: { status: "ACTIVE", grants: { some: { capability: "ROSTER_MANAGE" } } } },
          },
        });
        if (!current)
          throw new ForbiddenException({
            code: "CAPABILITY_DENIED",
            message: "Bạn không có quyền thực hiện thao tác này.",
          });
        const op = await tx.operation.create({
          data: {
            id: operationId,
            schoolId,
            membershipId: actor.membershipId,
            actorIdentityId: identityId,
            actorType: "SCHOOL_MEMBERSHIP",
            actorReference: actor.membershipId,
            route: command,
            idempotencyKey: key,
            fingerprint,
          },
        });
        const outcome = await work(tx, op.id);
        const completed = await tx.operation.update({
          where: { id: op.id },
          data: { status: "COMPLETED", outcome: outcome as never },
        });
        return {
          id: completed.id,
          status: completed.status,
          outcome: completed.outcome,
        };
      });
    } catch (error) {
      if (isOperationIdempotencyCollision(error)) {
        const collision = await this.prisma.operation.findFirst({
          where: {
            schoolId,
            actorReference: actor.membershipId,
            actorType: "SCHOOL_MEMBERSHIP",
            route: command,
            idempotencyKey: key,
          },
        });
        if (collision && collision.fingerprint === fingerprint) {
          await this.actor(identityId, schoolId);
          return {
            id: collision.id,
            status: collision.status,
            outcome: collision.outcome,
          };
        }
      }
      if (command === route.schoolYear && this.schoolYearConflict(error))
        throw new ConflictException({
          code: "SCHOOL_YEAR_OVERLAP",
          message: "Năm học bị trùng khoảng thời gian.",
        });
      throw error;
    }
  }
  private schoolYearConflict(error: unknown) {
    return Boolean(
      error &&
        typeof error === "object" &&
        (error as { code?: string; meta?: unknown }).code === "P2039" &&
        JSON.stringify((error as { meta?: unknown }).meta).includes(
          "SchoolYear_school_interval_excl",
        ),
    );
  }
  private assignmentConflict(error: unknown) {
    return Boolean(
      error &&
        typeof error === "object" &&
        (error as { code?: string; meta?: unknown }).code === "P2039" &&
        JSON.stringify((error as { meta?: unknown }).meta).includes(
          "StaffClassAssignment_staff_class_interval_excl",
        ),
    );
  }
}
