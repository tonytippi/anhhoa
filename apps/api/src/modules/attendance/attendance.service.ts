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
import { PrismaService } from "../identity/prisma.service.js";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxLeaveDays = 62;
const parentRoute = "POST /api/parent/schools/:schoolId/leave-requests";
const approveRoute =
  "POST /api/app/schools/:schoolId/leave-requests/:leaveRequestId/approve";
const rejectRoute =
  "POST /api/app/schools/:schoolId/leave-requests/:leaveRequestId/reject";
const attendanceRoute = "POST /api/teacher/schools/:schoolId/attendance";
type Db =
  | PrismaService
  | { [key: string]: any; $queryRaw: PrismaService["$queryRaw"] };
type LeaveFacts = {
  policy: { effectiveFrom: Date; nextDayDeadlineLocalTime: string };
  operating: Array<{ day: string; calendarEffectiveFrom: Date }>;
  excluded: string[];
  auto: boolean;
};

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

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
  private day(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  private now() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (type: string) =>
      parts.find((part) => part.type === type)!.value;
    return {
      day: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${get("hour")}:${get("minute")}`,
    };
  }
  private dto(
    request: {
      id: string;
      studentId: string;
      status: string;
      createdAt: Date;
      rejectedReason: string | null;
      decidedAt: Date | null;
      days: Array<{ operatingOn: Date }>;
    },
    parent = false,
  ) {
    return {
      id: request.id,
      studentId: request.studentId,
      status: request.status,
      startsOn: request.days[0]?.operatingOn.toISOString().slice(0, 10) ?? null,
      operatingDates: request.days.map((item) =>
        item.operatingOn.toISOString().slice(0, 10),
      ),
      createdAt: request.createdAt.toISOString(),
      ...(parent
        ? {}
        : {
            rejectedReason: request.rejectedReason,
            decidedAt: request.decidedAt?.toISOString() ?? null,
          }),
    };
  }
  private async parent(
    identityId: string,
    schoolId: string,
    tx: Db = this.prisma,
  ) {
    const parent = await tx.parentProfile.findFirst({
      where: { userIdentityId: identityId },
      select: { id: true },
    });
    if (!parent)
      throw new ForbiddenException({
        code: "PARENT_ACCESS_DENIED",
        message: "Không có quyền truy cập.",
      });
    const school = await tx.school.findFirst({
      where: { id: schoolId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!school)
      throw new NotFoundException({
        code: "SCHOOL_CONTEXT_DENIED",
        message: "Không thể truy cập ngữ cảnh trường này.",
      });
    return parent;
  }

  async create(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: unknown,
  ) {
    const parent = await this.parent(identityId, schoolId);
    const input = body as {
      studentId?: unknown;
      startsOn?: unknown;
      endsOn?: unknown;
    };
    const studentId =
      typeof input?.studentId === "string" ? input.studentId : "";
    const startsOn = this.date(input?.startsOn, "startsOn");
    const endsOn = this.date(input?.endsOn, "endsOn");
    if (
      !uuid.test(studentId) ||
      startsOn > endsOn ||
      this.dates(startsOn, endsOn).length > maxLeaveDays
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          ...(startsOn > endsOn
            ? { endsOn: "Ngày kết thúc không được trước ngày bắt đầu." }
            : this.dates(startsOn, endsOn).length > maxLeaveDays
              ? { endsOn: `Khoảng nghỉ không quá ${maxLeaveDays} ngày.` }
              : { studentId: "Học sinh không hợp lệ." }),
        },
      });
    return this.parentMutate(
      parent.id,
      identityId,
      schoolId,
      key,
      operationId,
      { studentId, startsOn, endsOn },
      (tx) =>
        this.leaveCreateFacts(
          tx,
          schoolId,
          parent.id,
          studentId,
          startsOn,
          endsOn,
        ),
      async (tx, op, facts) => {
        if (!facts)
          throw new Error("Leave facts are required for leave creation.");
        const request = await tx.leaveRequest.create({
          data: {
            schoolId,
            studentId,
            parentProfileId: parent.id,
            status: facts.auto ? "AUTO_APPROVED" : "PENDING",
            policyEffectiveFrom: facts.policy.effectiveFrom,
            policyDeadlineLocalTime: facts.policy.nextDayDeadlineLocalTime,
            days: {
              create: facts.operating.map((item) => ({
                schoolId,
                operatingOn: this.day(item.day),
                calendarEffectiveFrom: item.calendarEffectiveFrom,
              })),
            },
          },
          include: { days: { orderBy: { operatingOn: "asc" } } },
        });
        const outcome = {
          ...this.dto(request, true),
          excludedDates: facts.excluded,
        };
        await tx.auditRecord.create({
          data: auditData(
            schoolId,
            { identityId, type: "PARENT_PROFILE", reference: parent.id },
            "LEAVE_REQUEST_CREATED",
            {
              operationId: op,
              leaveRequestId: request.id,
              status: request.status,
            },
          ),
        });
        return outcome;
      },
    );
  }
  async parentList(identityId: string, schoolId: string, studentId?: string) {
    const parent = await this.parent(identityId, schoolId);
    const links = await this.prisma.studentParent.findMany({
      where: {
        schoolId,
        parentProfileId: parent.id,
        status: "ACTIVE",
        ...(studentId ? { studentId } : {}),
      },
      select: { studentId: true },
    });
    return (
      await this.prisma.leaveRequest.findMany({
        where: {
          schoolId,
          parentProfileId: parent.id,
          studentId: { in: links.map((link) => link.studentId) },
        },
        include: { days: { orderBy: { operatingOn: "asc" } } },
        orderBy: { createdAt: "desc" },
      })
    ).map((request) => this.dto(request, true));
  }
  async parentRead(identityId: string, schoolId: string, id: string) {
    const parent = await this.parent(identityId, schoolId);
    const request = await this.prisma.leaveRequest.findFirst({
      where: {
        id,
        schoolId,
        parentProfileId: parent.id,
        student: {
          parentLinks: {
            some: { parentProfileId: parent.id, status: "ACTIVE" },
          },
        },
      },
      include: { days: { orderBy: { operatingOn: "asc" } } },
    });
    if (!request)
      throw new NotFoundException({
        code: "LEAVE_REQUEST_NOT_FOUND",
        message: "Không tìm thấy đơn nghỉ.",
      });
    return this.dto(request, true);
  }
  async parentOperation(
    identityId: string,
    schoolId: string,
    operationId: string,
  ) {
    const parent = await this.parent(identityId, schoolId);
    if (!uuid.test(operationId))
      throw new NotFoundException({
        code: "OPERATION_NOT_FOUND",
        message: "Không tìm thấy thao tác.",
      });
    const operation = await this.prisma.operation.findFirst({
      where: {
        id: operationId,
        schoolId,
        actorType: "PARENT_PROFILE",
        actorReference: parent.id,
        route: parentRoute,
      },
    });
    const outcome = operation?.outcome as { studentId?: string } | null;
    if (
      !operation ||
      !outcome?.studentId ||
      !(await this.prisma.studentParent.findFirst({
        where: {
          schoolId,
          studentId: outcome.studentId,
          parentProfileId: parent.id,
          status: "ACTIVE",
        },
      }))
    )
      throw new NotFoundException({
        code: "OPERATION_NOT_FOUND",
        message: "Không tìm thấy thao tác.",
      });
    return {
      id: operation.id,
      status: operation.status,
      outcome: operation.outcome,
    };
  }
  async appList(identityId: string, schoolId: string) {
    await this.approver(identityId, schoolId);
    return (
      await this.prisma.leaveRequest.findMany({
        where: { schoolId },
        include: { days: { orderBy: { operatingOn: "asc" } } },
        orderBy: { createdAt: "desc" },
      })
    ).map((request) => this.dto(request));
  }
  async teacherList(identityId: string, schoolId: string, classId?: string) {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: {
        schoolId,
        userIdentityId: identityId,
        status: "ACTIVE",
        school: { status: "ACTIVE" },
        boundStaffProfile: {
          employmentStatus: "ACTIVE",
          primaryPosition: {
            status: "ACTIVE",
            grants: { some: { capability: "CLASS_LEAVE_READ" } },
          },
        },
      },
      select: { id: true, boundStaffProfile: { select: { id: true } } },
    });
    if (!membership?.boundStaffProfile)
      throw new ForbiddenException({
        code: "CAPABILITY_DENIED",
        message: "Bạn không có quyền thực hiện thao tác này.",
      });
    const assignments = await this.prisma.staffClassAssignment.findMany({
      where: {
        schoolId,
        staffProfileId: membership.boundStaffProfile.id,
        ...(classId ? { classId } : {}),
      },
      select: { classId: true, effectiveFrom: true, effectiveTo: true },
    });
    const requests = await this.prisma.leaveRequest.findMany({
      where: { schoolId },
      include: {
        days: { orderBy: { operatingOn: "asc" } },
        student: {
          include: {
            enrollments: {
              where: { schoolId, lifecycle: "ENROLLED" },
              include: { classAssignments: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return requests
      .filter((request) =>
        request.days.some((leaveDay) =>
          assignments.some((assignment) => {
            if (
              leaveDay.operatingOn < assignment.effectiveFrom ||
              (assignment.effectiveTo &&
                leaveDay.operatingOn >= assignment.effectiveTo)
            )
              return false;
            return request.student.enrollments.some(
              (enrollment) =>
                enrollment.effectiveFrom <= leaveDay.operatingOn &&
                (!enrollment.endedOn ||
                  leaveDay.operatingOn < enrollment.endedOn) &&
                enrollment.classAssignments.some(
                  (placement) =>
                    placement.classId === assignment.classId &&
                    placement.effectiveFrom <= leaveDay.operatingOn &&
                    (!placement.effectiveTo ||
                      leaveDay.operatingOn < placement.effectiveTo),
                ),
            );
          }),
        ),
      )
      .map((request) => this.dto(request));
  }
  async teacherRoster(identityId: string, schoolId: string, classId: string, attendanceOn: string) {
    this.date(attendanceOn, "attendanceOn");
    const actor = await this.teacher(identityId, schoolId, classId, attendanceOn);
    const on = this.day(attendanceOn);
    const calendar = await this.calendar(this.prisma, schoolId, attendanceOn);
    if (on.getUTCDay() === 0 || calendar.holidays.some((holiday: { startsOn: Date; endsOn: Date }) => holiday.startsOn <= on && holiday.endsOn >= on)) throw new ConflictException({ code: "NON_OPERATING_DAY", message: "Không thể điểm danh ngày không vận hành." });
    const policy = await this.prisma.attendancePolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: on } }, orderBy: { effectiveFrom: "desc" } });
    if (!policy) throw new ConflictException({ code: "ATTENDANCE_POLICY_NOT_CONFIGURED", message: "Trường chưa cấu hình chính sách điểm danh." });
    const rows = await this.prisma.studentEnrollment.findMany({
      where: { schoolId, lifecycle: "ENROLLED", effectiveFrom: { lte: on }, OR: [{ endedOn: null }, { endedOn: { gt: on } }], classAssignments: { some: { classId, effectiveFrom: { lte: on }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: on } }] } } },
      include: { student: { select: { id: true, fullName: true } }, classAssignments: { where: { classId, effectiveFrom: { lte: on }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: on } }] } } },
    });
    const records = await this.prisma.attendanceRecord.findMany({ where: { schoolId, classId, attendanceOn: on }, select: { studentId: true, state: true, evidenceId: true, updatedAt: true } });
    const leaves = await this.prisma.leaveRequestDay.findMany({ where: { schoolId, operatingOn: on, leaveRequest: { status: { in: ["AUTO_APPROVED", "APPROVED"] } } }, select: { leaveRequest: { select: { studentId: true } } } });
    const byStudent = new Map(records.map((record) => [record.studentId, record]));
    const onLeave = new Set(leaves.map((leave) => leave.leaveRequest.studentId));
    return { classId, attendanceOn, staffProfileId: actor.staffProfileId, photoEvidenceMode: policy.photoEvidenceMode, students: rows.map((row) => {
      const record = byStudent.get(row.studentId);
      return { studentId: row.studentId, fullName: row.student.fullName, state: record?.state ?? (onLeave.has(row.studentId) ? "ON_LEAVE" : "NOT_RECORDED"), evidenceId: record?.evidenceId ?? null, updatedAt: record?.updatedAt?.toISOString() ?? null };
    }) };
  }
  async record(identityId: string, schoolId: string, key: string, operationId: string, body: unknown) {
    const input = body as { classId?: unknown; studentId?: unknown; attendanceOn?: unknown; state?: unknown; evidenceId?: unknown };
    const classId = typeof input?.classId === "string" ? input.classId : "";
    const studentId = typeof input?.studentId === "string" ? input.studentId : "";
    const attendanceOn = this.date(input?.attendanceOn, "attendanceOn");
    const state = input?.state === "PRESENT" || input?.state === "ABSENT" ? input.state : null;
    const evidenceId = typeof input?.evidenceId === "string" ? input.evidenceId : null;
    if (!uuid.test(classId) || !uuid.test(studentId) || !state || (evidenceId && !uuid.test(evidenceId))) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ.", fieldErrors: { ...(!uuid.test(classId) ? { classId: "Lớp không hợp lệ." } : {}), ...(!uuid.test(studentId) ? { studentId: "Học sinh không hợp lệ." } : {}), ...(!state ? { state: "Trạng thái điểm danh không hợp lệ." } : {}), ...(evidenceId && !uuid.test(evidenceId) ? { evidenceId: "Bằng chứng không hợp lệ." } : {}) } });
    const actor = await this.teacher(identityId, schoolId, classId, attendanceOn);
    return this.mutate({ actorType: "SCHOOL_MEMBERSHIP", actorReference: actor.id, membershipId: actor.id, route: attendanceRoute, identityId, schoolId, key, operationId, body: { classId, studentId, attendanceOn, state, evidenceId }, valid: (tx) => this.teacher(identityId, schoolId, classId, attendanceOn, tx) }, async (tx, op) => {
      const current = await this.teacher(identityId, schoolId, classId, attendanceOn, tx);
      const facts = await this.attendanceFacts(tx, schoolId, classId, studentId, attendanceOn, state, evidenceId);
      const previous = await tx.attendanceRecord.findUnique({ where: { schoolId_classId_studentId_attendanceOn: { schoolId, classId, studentId, attendanceOn: this.day(attendanceOn) } }, select: { state: true, evidenceId: true, policyEffectiveFrom: true, membershipId: true, staffProfileId: true } });
      const record = await tx.attendanceRecord.upsert({ where: { schoolId_classId_studentId_attendanceOn: { schoolId, classId, studentId, attendanceOn: this.day(attendanceOn) } }, create: { schoolId, classId, studentId, attendanceOn: this.day(attendanceOn), state, evidenceId: state === "PRESENT" ? evidenceId : null, policyEffectiveFrom: facts.policy.effectiveFrom, actorIdentityId: identityId, membershipId: current.id, staffProfileId: current.staffProfileId }, update: { state, evidenceId: state === "PRESENT" ? evidenceId : null, policyEffectiveFrom: facts.policy.effectiveFrom, actorIdentityId: identityId, membershipId: current.id, staffProfileId: current.staffProfileId } });
      const outcome = { id: record.id, classId, studentId, attendanceOn, state: record.state, evidenceId: record.evidenceId, policyEffectiveFrom: record.policyEffectiveFrom.toISOString().slice(0, 10), updatedAt: record.updatedAt.toISOString() };
      await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: "SCHOOL_MEMBERSHIP", reference: current.id, membershipId: current.id }, "ATTENDANCE_RECORDED", { operationId: op, attendanceRecordId: record.id, classId, studentId, attendanceOn, state, evidenceId: record.evidenceId, policyEffectiveFrom: outcome.policyEffectiveFrom, previous }) });
      return outcome;
    });
  }
  async teacherOperation(identityId: string, schoolId: string, operationId: string) {
    if (!uuid.test(operationId)) throw new NotFoundException({ code: "OPERATION_NOT_FOUND", message: "Không tìm thấy thao tác." });
    const actor = await this.teacher(identityId, schoolId);
    const operation = await this.prisma.operation.findFirst({ where: { id: operationId, schoolId, actorType: "SCHOOL_MEMBERSHIP", actorReference: actor.id, route: attendanceRoute } });
    if (!operation) throw new NotFoundException({ code: "OPERATION_NOT_FOUND", message: "Không tìm thấy thao tác." });
    const outcome = operation.outcome as { classId?: unknown; attendanceOn?: unknown } | null;
    if (typeof outcome?.classId !== "string" || typeof outcome.attendanceOn !== "string") throw new NotFoundException({ code: "OPERATION_NOT_FOUND", message: "Không tìm thấy thao tác." });
    await this.teacher(identityId, schoolId, outcome.classId, outcome.attendanceOn);
    return { id: operation.id, status: operation.status, outcome: operation.outcome };
  }
  async decide(
    identityId: string,
    schoolId: string,
    leaveRequestId: string,
    status: "APPROVED" | "REJECTED",
    key: string,
    operationId: string,
    body: unknown,
  ) {
    const actor = await this.approver(identityId, schoolId);
    const reason =
      typeof (body as { reason?: unknown })?.reason === "string"
        ? (body as { reason: string }).reason.trim()
        : "";
    if (status === "REJECTED" && (!reason || reason.length > 500))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { reason: "Cần lý do từ 1 đến 500 ký tự." },
      });
    const route = status === "APPROVED" ? approveRoute : rejectRoute;
    return this.appMutate(
      actor.id,
      identityId,
      schoolId,
      route,
      key,
      operationId,
      { leaveRequestId, reason: reason || null },
      async (tx, op) => {
        const request = await tx.leaveRequest.findFirst({
          where: { id: leaveRequestId, schoolId },
          include: { days: { orderBy: { operatingOn: "asc" } } },
        });
        if (!request)
          throw new NotFoundException({
            code: "LEAVE_REQUEST_NOT_FOUND",
            message: "Không tìm thấy đơn nghỉ.",
          });
        if (request.status !== "PENDING")
          throw new ConflictException({
            code: "LEAVE_REQUEST_TERMINAL",
            message: "Đơn nghỉ đã được quyết định.",
          });
        const updated = await tx.leaveRequest.update({
          where: { id: request.id },
          data: {
            status,
            rejectedReason: status === "REJECTED" ? reason : null,
            decidedAt: new Date(),
            decidedByMembershipId: actor.id,
          },
          include: { days: { orderBy: { operatingOn: "asc" } } },
        });
        await tx.auditRecord.create({
          data: auditData(
            schoolId,
            {
              identityId,
              type: "SCHOOL_MEMBERSHIP",
              reference: actor.id,
              membershipId: actor.id,
            },
            `LEAVE_REQUEST_${status}`,
            { operationId: op, leaveRequestId },
          ),
        });
        return this.dto(updated);
      },
    );
  }
  private dates(start: string, end: string) {
    const result: string[] = [];
    for (
      let current = this.day(start), last = this.day(end);
      current <= last;
      current.setUTCDate(current.getUTCDate() + 1)
    )
      result.push(current.toISOString().slice(0, 10));
    return result;
  }
  private async teacher(identityId: string, schoolId: string, classId?: string, attendanceOn?: string, tx: Db = this.prisma) {
    const actor = await tx.schoolMembership.findFirst({ where: { schoolId, userIdentityId: identityId, status: "ACTIVE", school: { status: "ACTIVE" }, boundStaffProfile: { boundAt: { not: null }, boundByMembershipId: { not: null }, employmentStatus: "ACTIVE", primaryPosition: { status: "ACTIVE", grants: { some: { capability: "ATTENDANCE_WRITE" } } } } }, select: { id: true, boundStaffProfile: { select: { id: true } } } });
    if (!actor?.boundStaffProfile) throw new ForbiddenException({ code: "CAPABILITY_DENIED", message: "Bạn không có quyền thực hiện thao tác này." });
    if (classId && attendanceOn) {
      const assignment = await tx.staffClassAssignment.findFirst({ where: { schoolId, staffProfileId: actor.boundStaffProfile.id, classId, effectiveFrom: { lte: this.day(attendanceOn) }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: this.day(attendanceOn) } }] } });
      if (!assignment) throw new ForbiddenException({ code: "CAPABILITY_DENIED", message: "Bạn không có quyền thực hiện thao tác này." });
    }
    return { id: actor.id, staffProfileId: actor.boundStaffProfile.id };
  }
  private async attendanceFacts(tx: Db, schoolId: string, classId: string, studentId: string, attendanceOn: string, state: "PRESENT" | "ABSENT", evidenceId: string | null) {
    const on = this.day(attendanceOn);
    const calendar = await this.calendar(tx, schoolId, attendanceOn);
    if (on.getUTCDay() === 0 || calendar.holidays.some((holiday: { startsOn: Date; endsOn: Date }) => holiday.startsOn <= on && holiday.endsOn >= on)) throw new ConflictException({ code: "NON_OPERATING_DAY", message: "Không thể điểm danh ngày không vận hành." });
    const policy = await tx.attendancePolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: on } }, orderBy: { effectiveFrom: "desc" } });
    if (!policy) throw new ConflictException({ code: "ATTENDANCE_POLICY_NOT_CONFIGURED", message: "Trường chưa cấu hình chính sách điểm danh." });
    const enrollment = await tx.studentEnrollment.findFirst({ where: { schoolId, studentId, lifecycle: "ENROLLED", effectiveFrom: { lte: on }, OR: [{ endedOn: null }, { endedOn: { gt: on } }], classAssignments: { some: { classId, effectiveFrom: { lte: on }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: on } }] } } } });
    if (!enrollment) throw new ConflictException({ code: "ROSTER_CONFLICT", message: "Học sinh không thuộc danh sách lớp trong ngày này." });
    if (state === "PRESENT" && policy.photoEvidenceMode === "REQUIRED" && !evidenceId) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ.", fieldErrors: { evidenceId: "Cần bằng chứng khi ghi có mặt." } });
    if (state === "PRESENT" && evidenceId && !(await tx.evidenceReference.findFirst({ where: { id: evidenceId, schoolId }, select: { id: true } }))) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ.", fieldErrors: { evidenceId: "Bằng chứng không hợp lệ." } });
    return { policy };
  }
  private async calendar(tx: Db, schoolId: string, day: string) {
    const calendar = await tx.schoolCalendarVersion.findFirst({
      where: { schoolId, effectiveFrom: { lte: this.day(day) } },
      include: { holidays: true },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!calendar)
      throw new ConflictException({
        code: "SCHOOL_CALENDAR_NOT_CONFIGURED",
        message: "Trường chưa cấu hình lịch vận hành.",
      });
    return calendar;
  }
  private async nextOperating(tx: Db, schoolId: string, from: string) {
    for (const day of this.dates(
      from,
      new Date(this.day(from).getTime() + 370 * 86400000)
        .toISOString()
        .slice(0, 10),
    )) {
      if (day <= from || this.day(day).getUTCDay() === 0) continue;
      const calendar = await this.calendar(tx, schoolId, day);
      if (
        !calendar.holidays.some(
          (holiday: { startsOn: Date; endsOn: Date }) =>
            holiday.startsOn <= this.day(day) &&
            holiday.endsOn >= this.day(day),
        )
      )
        return day;
    }
    throw new ConflictException({
      code: "SCHOOL_CALENDAR_NOT_CONFIGURED",
      message: "Không thể xác định ngày vận hành tiếp theo.",
    });
  }
  private async approver(
    identityId: string,
    schoolId: string,
    tx: Db = this.prisma,
  ) {
    const actor = await tx.schoolMembership.findFirst({
      where: {
        schoolId,
        userIdentityId: identityId,
        status: "ACTIVE",
        school: { status: "ACTIVE" },
        boundStaffProfile: {
          employmentStatus: "ACTIVE",
          primaryPosition: {
            status: "ACTIVE",
            grants: { some: { capability: "SETTINGS_MANAGE" } },
          },
        },
      },
    });
    if (!actor)
      throw new ForbiddenException({
        code: "CAPABILITY_DENIED",
        message: "Bạn không có quyền thực hiện thao tác này.",
      });
    return actor;
  }
  private async leaveCreateFacts(
    tx: Db,
    schoolId: string,
    parentId: string,
    studentId: string,
    startsOn: string,
    endsOn: string,
  ): Promise<LeaveFacts> {
    const link = await tx.studentParent.findFirst({
      where: {
        schoolId,
        studentId,
        parentProfileId: parentId,
        status: "ACTIVE",
      },
    });
    if (!link)
      throw new ForbiddenException({
        code: "CAPABILITY_DENIED",
        message: "Bạn không có quyền tạo đơn nghỉ.",
      });
    const submitted = this.now();
    const policy = await tx.leavePolicy.findFirst({
      where: { schoolId, effectiveFrom: { lte: this.day(submitted.day) } },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!policy)
      throw new ConflictException({
        code: "LEAVE_POLICY_NOT_CONFIGURED",
        message: "Trường chưa cấu hình chính sách nghỉ.",
      });
    const operating: LeaveFacts["operating"] = [];
    const excluded: string[] = [];
    for (const value of this.dates(startsOn, endsOn)) {
      const calendar = await this.calendar(tx, schoolId, value);
      const date = this.day(value);
      if (
        date.getUTCDay() === 0 ||
        calendar.holidays.some(
          (holiday: { startsOn: Date; endsOn: Date }) =>
            holiday.startsOn <= date && holiday.endsOn >= date,
        )
      )
        excluded.push(value);
      else
        operating.push({
          day: value,
          calendarEffectiveFrom: calendar.effectiveFrom,
        });
    }
    if (!operating.length)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Không có ngày vận hành trong khoảng đã chọn.",
        fieldErrors: { startsOn: "Khoảng ngày chỉ gồm ngày không vận hành." },
      });
    for (const item of operating) {
      const enrolled = await tx.studentEnrollment.findFirst({
        where: {
          schoolId,
          studentId,
          lifecycle: "ENROLLED",
          effectiveFrom: { lte: this.day(item.day) },
          OR: [{ endedOn: null }, { endedOn: { gt: this.day(item.day) } }],
        },
      });
      if (!enrolled)
        throw new ForbiddenException({
          code: "CAPABILITY_DENIED",
          message: "Học sinh không nhập học trong toàn bộ ngày nghỉ.",
        });
    }
    const first = operating[0]!.day;
    return {
      policy,
      operating,
      excluded,
      auto:
        first === (await this.nextOperating(tx, schoolId, submitted.day)) &&
        operating.length === 1 &&
        submitted.time <= policy.nextDayDeadlineLocalTime,
    };
  }
  private async parentMutate(
    parentId: string,
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: unknown,
    preflight: (tx: Db) => Promise<LeaveFacts>,
    work: (tx: Db, operationId: string, facts?: LeaveFacts) => Promise<unknown>,
  ) {
    return this.mutate(
      {
        actorType: "PARENT_PROFILE",
        actorReference: parentId,
        route: parentRoute,
        identityId,
        schoolId,
        key,
        operationId,
        body,
        valid: (tx: Db) => this.parent(identityId, schoolId, tx),
        preflight,
      },
      work,
    );
  }
  private async appMutate(
    membershipId: string,
    identityId: string,
    schoolId: string,
    route: string,
    key: string,
    operationId: string,
    body: unknown,
    work: (tx: Db, operationId: string) => Promise<unknown>,
  ) {
    return this.mutate(
      {
        actorType: "SCHOOL_MEMBERSHIP",
        actorReference: membershipId,
        membershipId,
        route,
        identityId,
        schoolId,
        key,
        operationId,
        body,
        valid: (tx: Db) => this.approver(identityId, schoolId, tx),
      },
      work,
    );
  }
  private async mutate(
    input: {
      actorType: "PARENT_PROFILE" | "SCHOOL_MEMBERSHIP";
      actorReference: string;
      membershipId?: string;
      route: string;
      identityId: string;
      schoolId: string;
      key: string;
      operationId: string;
      body: unknown;
      valid: (tx: Db) => Promise<unknown>;
      preflight?: (tx: Db) => Promise<LeaveFacts>;
    },
    work: (tx: Db, operationId: string, facts?: LeaveFacts) => Promise<unknown>,
  ) {
    if (!uuid.test(input.key) || !uuid.test(input.operationId))
      throw new UnauthorizedException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Cần Idempotency-Key và X-Operation-Id UUID.",
      });
    const fingerprint = requestFingerprint(input.body);
    const replay = async () => {
      await input.valid(this.prisma);
      const existing = await this.prisma.operation.findFirst({
        where: {
          schoolId: input.schoolId,
          actorType: input.actorType,
          actorReference: input.actorReference,
          route: input.route,
          idempotencyKey: input.key,
        },
      });
      if (!existing) return null;
      if (existing.fingerprint !== fingerprint)
        throw new ConflictException({
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency-Key đã dùng cho yêu cầu khác.",
        });
      return {
        id: existing.id,
        status: existing.status,
        outcome: existing.outcome,
      };
    };
    const existing = await replay();
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "School" WHERE "id" = ${input.schoolId}::uuid FOR UPDATE`;
        await input.valid(tx);
        const facts = input.preflight ? await input.preflight(tx) : undefined;
        const operation = await tx.operation.create({
          data: {
            id: input.operationId,
            schoolId: input.schoolId,
            membershipId: input.membershipId,
            actorIdentityId: input.identityId,
            actorType: input.actorType,
            actorReference: input.actorReference,
            route: input.route,
            idempotencyKey: input.key,
            fingerprint,
          },
        });
        const outcome = await work(tx, operation.id, facts);
        const completed = await tx.operation.update({
          where: { id: operation.id },
          data: { status: "COMPLETED", outcome: outcome as object },
        });
        return {
          id: completed.id,
          status: completed.status,
          outcome: completed.outcome,
        };
      });
    } catch (error) {
      if (isOperationIdempotencyCollision(error)) {
        const value = await replay();
        if (value) return value;
      }
      throw error;
    }
  }
}
