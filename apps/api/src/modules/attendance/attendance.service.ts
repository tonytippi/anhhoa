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
const evidenceUploadRoute = "POST /api/teacher/schools/:schoolId/attendance-evidence";
const handoverRoute = "POST /api/teacher/schools/:schoolId/handovers";
const handoverEvidenceUploadRoute = "POST /api/teacher/schools/:schoolId/handover-evidence";
const expiredEvidenceMessage = "Tệp bằng chứng đã hết hạn";
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
  private hcmDay(instant: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const get = (type: string) => parts.find((part) => part.type === type)!.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }
  private pickedUpAt(value: unknown) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? null : instant;
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
      student?: { fullName: string; studentCode: string };
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
             studentName: request.student?.fullName,
             studentCode: request.student?.studentCode,
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
                operatingOn: this.day(item.day),
                calendarEffectiveFrom: item.calendarEffectiveFrom,
              })),
            },
          },
          include: { days: { orderBy: { operatingOn: "asc" } } },
        });
        if (facts.auto) await this.issueLeaveDaySources(tx, request);
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
        include: { days: { orderBy: { operatingOn: "asc" } }, student: { select: { fullName: true, studentCode: true } } },
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
        include: { days: { orderBy: { operatingOn: "asc" } }, student: { select: { fullName: true, studentCode: true } } },
        orderBy: { createdAt: "desc" },
      })
    ).map((request) => this.dto(request));
  }
  async appOperation(identityId: string, schoolId: string, operationId: string) {
    if (!uuid.test(operationId))
      throw new NotFoundException({ code: "OPERATION_NOT_FOUND", message: "Không tìm thấy thao tác." });
    const actor = await this.approver(identityId, schoolId);
    const operation = await this.prisma.operation.findFirst({
      where: {
        id: operationId,
        schoolId,
        actorType: "SCHOOL_MEMBERSHIP",
        actorReference: actor.id,
        route: { in: [approveRoute, rejectRoute] },
      },
    });
    if (!operation)
      throw new NotFoundException({ code: "OPERATION_NOT_FOUND", message: "Không tìm thấy thao tác." });
    return { id: operation.id, status: operation.status, outcome: operation.outcome };
  }
  async leaveDaySources(
    identityId: string,
    schoolId: string,
    limit = 100,
    cursor?: string,
  ) {
    await this.approver(identityId, schoolId);
    const cursorSource = cursor
      ? await this.prisma.leaveDaySource.findFirst({
          where: { id: cursor, schoolId, exclusions: { none: {} } },
          select: { operatingOn: true, id: true },
        })
      : null;
    if (cursor && !cursorSource)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { cursor: "Con trỏ không hợp lệ." },
      });
    const sources = await this.prisma.leaveDaySource.findMany({
      where: {
        schoolId,
        exclusions: { none: {} },
        ...(cursorSource
          ? {
              OR: [
                { operatingOn: { gt: cursorSource.operatingOn } },
                { operatingOn: cursorSource.operatingOn, id: { gt: cursorSource.id } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        studentId: true,
        operatingOn: true,
        leaveRequestId: true,
        leaveStatus: true,
      },
      orderBy: [{ operatingOn: "asc" }, { id: "asc" }],
      take: limit + 1,
    });
    const page = sources.slice(0, limit);
    return {
      data: page.map((source) => ({
        schoolId,
        studentId: source.studentId,
        operatingOn: source.operatingOn.toISOString().slice(0, 10),
        leaveRequestId: source.leaveRequestId,
        leaveStatus: source.leaveStatus,
        eligible: true,
      })),
      nextCursor: sources.length > limit ? page.at(-1)?.id ?? null : null,
    };
  }
  async overview(identityId: string, schoolId: string, requestedDate?: string) {
    const now = this.now();
    await this.overviewActor(identityId, schoolId);
    const date = requestedDate === undefined ? now.day : this.date(requestedDate, "date");
    const on = this.day(date);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        schoolId,
        lifecycle: "ENROLLED",
        effectiveFrom: { lte: on },
        OR: [{ endedOn: null }, { endedOn: { gt: on } }],
        classAssignments: { some: { effectiveFrom: { lte: on }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: on } }] } },
      },
      select: {
        studentId: true,
        classAssignments: {
          where: { effectiveFrom: { lte: on }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: on } }] },
          select: { classId: true, effectiveFrom: true, classroom: { select: { name: true } } },
        },
      },
    });
    // Historical overlap must not inflate a School's operational counts. The latest effective placement wins.
    const roster = enrollments.flatMap((enrollment) => enrollment.classAssignments.sort((left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime() || left.classId.localeCompare(right.classId)).slice(0, 1).map((assignment) => ({ studentId: enrollment.studentId, classId: assignment.classId, className: assignment.classroom.name })));
    const studentIds = roster.map((row) => row.studentId);
    const staff = await this.prisma.staffProfile.count({ where: { schoolId, employmentStatus: "ACTIVE" } });
    const [attendance, leaves, handovers] = studentIds.length
      ? await Promise.all([
          this.prisma.attendanceRecord.findMany({ where: { schoolId, attendanceOn: on, studentId: { in: studentIds } }, select: { studentId: true, state: true } }),
          this.prisma.leaveDaySource.findMany({ where: { schoolId, operatingOn: on, studentId: { in: studentIds }, exclusions: { none: {} } }, select: { studentId: true } }),
          this.prisma.handoverRecord.findMany({ where: { schoolId, handoverOn: on, studentId: { in: studentIds } }, select: { studentId: true } }),
        ])
      : [[], [], []] as const;
    const records = new Map(attendance.map((record) => [record.studentId, record.state]));
    const approvedLeaves = new Set(leaves.map((source) => source.studentId));
    const pickedUp = new Set(handovers.map((record) => record.studentId));
    const isToday = date === now.day;
    const unresolvedLabel = isToday ? "Chưa đến lớp" : "Nghỉ không phép";
    const classes = new Map<string, { classId: string; className: string; students: number; present: number; approvedLeave: number; pickedUp: number; unresolved: { label: string; count: number }; notRecorded: number }>();
    for (const row of roster) {
      const item = classes.get(row.classId) ?? { classId: row.classId, className: row.className, students: 0, present: 0, approvedLeave: 0, pickedUp: 0, unresolved: { label: unresolvedLabel, count: 0 }, notRecorded: 0 };
      item.students += 1;
      const state = records.get(row.studentId);
      if (state === "PRESENT") item.present += 1;
      else if (approvedLeaves.has(row.studentId)) item.approvedLeave += 1;
      else if (isToday || state === "ABSENT") item.unresolved.count += 1;
      else item.notRecorded += 1;
      if (pickedUp.has(row.studentId)) item.pickedUp += 1;
      classes.set(row.classId, item);
    }
    const rows = [...classes.values()].sort((left, right) => left.className.localeCompare(right.className, "vi"));
    const metrics = rows.reduce((total, item) => ({ students: total.students + item.students, staff, present: total.present + item.present, approvedLeave: total.approvedLeave + item.approvedLeave, pickedUp: total.pickedUp + item.pickedUp, unresolved: { label: unresolvedLabel, count: total.unresolved.count + item.unresolved.count }, notRecorded: total.notRecorded + item.notRecorded }), { students: 0, staff, present: 0, approvedLeave: 0, pickedUp: 0, unresolved: { label: unresolvedLabel, count: 0 }, notRecorded: 0 });
    return { date, isToday, metrics, classes: rows };
  }
  async teacherList(identityId: string, schoolId: string, classId?: string) {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: {
        schoolId,
        userIdentityId: identityId,
        status: "ACTIVE",
        school: { status: "ACTIVE" },
        boundStaffProfile: {
          boundAt: { not: null },
          boundByMembershipId: { not: null },
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
    const records = await this.prisma.attendanceRecord.findMany({ where: { schoolId, classId, attendanceOn: on }, select: { studentId: true, state: true, evidenceId: true, updatedAt: true, evidence: { select: { deletedAt: true } } } });
    const leaves = await this.prisma.leaveRequestDay.findMany({ where: { schoolId, operatingOn: on, leaveRequest: { status: { in: ["AUTO_APPROVED", "APPROVED"] } } }, select: { leaveRequest: { select: { studentId: true } } } });
    const byStudent = new Map(records.map((record) => [record.studentId, record]));
    const onLeave = new Set(leaves.map((leave) => leave.leaveRequest.studentId));
    return { classId, attendanceOn, staffProfileId: actor.staffProfileId, photoEvidenceMode: policy.photoEvidenceMode, students: rows.map((row) => {
      const record = byStudent.get(row.studentId);
      return { studentId: row.studentId, fullName: row.student.fullName, state: record?.state ?? (onLeave.has(row.studentId) ? "ON_LEAVE" : "NOT_RECORDED"), evidenceId: record?.evidenceId ?? null, evidenceAvailability: record?.evidenceId ? (record.evidence?.deletedAt ? "EXPIRED" : "AVAILABLE") : null, evidenceMessage: record?.evidence?.deletedAt ? expiredEvidenceMessage : null, updatedAt: record?.updatedAt?.toISOString() ?? null };
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
       const previous = await tx.attendanceRecord.findUnique({ where: { schoolId_classId_studentId_attendanceOn: { schoolId, classId, studentId, attendanceOn: this.day(attendanceOn) } }, select: { state: true, evidenceId: true, policyEffectiveFrom: true, membershipId: true, staffProfileId: true } });
       const facts = await this.attendanceFacts(tx, schoolId, classId, studentId, attendanceOn, state, evidenceId, current, previous?.evidenceId ?? null);
      const record = await tx.attendanceRecord.upsert({ where: { schoolId_classId_studentId_attendanceOn: { schoolId, classId, studentId, attendanceOn: this.day(attendanceOn) } }, create: { schoolId, classId, studentId, attendanceOn: this.day(attendanceOn), state, evidenceId: state === "PRESENT" ? evidenceId : null, policyEffectiveFrom: facts.policy.effectiveFrom, actorIdentityId: identityId, membershipId: current.id, staffProfileId: current.staffProfileId }, update: { state, evidenceId: state === "PRESENT" ? evidenceId : null, policyEffectiveFrom: facts.policy.effectiveFrom, actorIdentityId: identityId, membershipId: current.id, staffProfileId: current.staffProfileId } });
        if (record.evidenceId) await tx.evidenceReference.updateMany({ where: { id: record.evidenceId, schoolId, OR: [{ confirmedAt: null }, { confirmedStudentId: studentId, confirmedAttendanceOn: this.day(attendanceOn) }] }, data: { confirmedAt: new Date(), confirmedStudentId: studentId, confirmedAttendanceOn: this.day(attendanceOn) } });
        if (record.state === "PRESENT") await this.excludeLeaveDaySources(tx, schoolId, studentId, attendanceOn, record.id);
       await this.writeNotificationSource(tx, schoolId, "ATTENDANCE", record.id, studentId, attendanceOn, record.state);
       const outcome = { id: record.id, classId, studentId, attendanceOn, state: record.state, evidenceId: record.evidenceId, evidenceAvailability: record.evidenceId ? "AVAILABLE" : null, policyEffectiveFrom: record.policyEffectiveFrom.toISOString().slice(0, 10), updatedAt: record.updatedAt.toISOString() };
      await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: "SCHOOL_MEMBERSHIP", reference: current.id, membershipId: current.id }, "ATTENDANCE_RECORDED", { operationId: op, attendanceRecordId: record.id, classId, studentId, attendanceOn, state, evidenceId: record.evidenceId, policyEffectiveFrom: outcome.policyEffectiveFrom, previous }) });
      return outcome;
    });
  }
  async teacherOperation(identityId: string, schoolId: string, operationId: string) {
    if (!uuid.test(operationId)) throw new NotFoundException({ code: "OPERATION_NOT_FOUND", message: "Không tìm thấy thao tác." });
    const actor = await this.teacher(identityId, schoolId);
    const operation = await this.prisma.operation.findFirst({ where: { id: operationId, schoolId, actorType: "SCHOOL_MEMBERSHIP", actorReference: actor.id, route: { in: [attendanceRoute, evidenceUploadRoute, handoverRoute, handoverEvidenceUploadRoute] } } });
    if (!operation) throw new NotFoundException({ code: "OPERATION_NOT_FOUND", message: "Không tìm thấy thao tác." });
    const outcome = operation.outcome as { classId?: unknown; attendanceOn?: unknown } | null;
    if (operation.route === handoverRoute || operation.route === handoverEvidenceUploadRoute) await this.handoverTeacher(identityId, schoolId);
    else {
      if (typeof outcome?.classId !== "string" || typeof outcome.attendanceOn !== "string") throw new NotFoundException({ code: "OPERATION_NOT_FOUND", message: "Không tìm thấy thao tác." });
      await this.teacher(identityId, schoolId, outcome.classId, outcome.attendanceOn);
    }
    return { id: operation.id, status: operation.status, outcome: operation.outcome };
  }
  async handoverRoster(identityId: string, schoolId: string, handoverOn: string) {
    this.date(handoverOn, "handoverOn");
    await this.handoverTeacher(identityId, schoolId);
    const on = this.day(handoverOn);
    await this.operatingDay(this.prisma, schoolId, handoverOn, "Không thể bàn giao ngày không vận hành.");
    const policy = await this.prisma.handoverPolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: on } }, orderBy: { effectiveFrom: "desc" } });
    if (!policy) throw new ConflictException({ code: "HANDOVER_POLICY_NOT_CONFIGURED", message: "Trường chưa cấu hình chính sách bàn giao." });
    const students = await this.prisma.studentEnrollment.findMany({ where: { schoolId, lifecycle: "ENROLLED", effectiveFrom: { lte: on }, OR: [{ endedOn: null }, { endedOn: { gt: on } }] }, include: { student: { select: { id: true, fullName: true } } }, orderBy: [{ student: { fullName: "asc" } }, { studentId: "asc" }] });
    const records = await this.prisma.handoverRecord.findMany({ where: { schoolId, handoverOn: on }, include: { evidence: { select: { deletedAt: true } } } });
    const byStudent = new Map(records.map((record) => [record.studentId, record]));
    return { handoverOn, photoEvidenceMode: policy.photoEvidenceMode, students: students.map(({ student }) => {
      const record = byStudent.get(student.id);
      return { studentId: student.id, fullName: student.fullName, pickedUpAt: record?.pickedUpAt.toISOString() ?? null, evidenceId: record?.evidenceId ?? null, evidenceAvailability: record?.evidenceId ? (record.evidence?.deletedAt ? "EXPIRED" : "AVAILABLE") : null, evidenceMessage: record?.evidence?.deletedAt ? expiredEvidenceMessage : null };
    }) };
  }
  async recordHandover(identityId: string, schoolId: string, key: string, operationId: string, body: unknown) {
    const input = body as { studentId?: unknown; handoverOn?: unknown; pickedUpAt?: unknown; evidenceId?: unknown };
    const studentId = typeof input?.studentId === "string" ? input.studentId : "";
    const handoverOn = this.date(input?.handoverOn, "handoverOn");
    const pickedUpAt = this.pickedUpAt(input?.pickedUpAt);
    const evidenceId = typeof input?.evidenceId === "string" ? input.evidenceId : null;
    if (!uuid.test(studentId) || !pickedUpAt || this.hcmDay(pickedUpAt) !== handoverOn || pickedUpAt > new Date() || (evidenceId && !uuid.test(evidenceId))) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ.", fieldErrors: { ...(!uuid.test(studentId) ? { studentId: "Học sinh không hợp lệ." } : {}), ...(!pickedUpAt || this.hcmDay(pickedUpAt) !== handoverOn || pickedUpAt > new Date() ? { pickedUpAt: "Giờ trả trẻ phải thuộc ngày bàn giao và không ở tương lai." } : {}), ...(evidenceId && !uuid.test(evidenceId) ? { evidenceId: "Bằng chứng không hợp lệ." } : {}) } });
    const actor = await this.handoverTeacher(identityId, schoolId);
    return this.mutate({ actorType: "SCHOOL_MEMBERSHIP", actorReference: actor.id, membershipId: actor.id, route: handoverRoute, identityId, schoolId, key, operationId, body: { studentId, handoverOn, pickedUpAt: pickedUpAt.toISOString(), evidenceId }, valid: (tx) => this.handoverTeacher(identityId, schoolId, tx) }, async (tx, op) => {
      const current = await this.handoverTeacher(identityId, schoolId, tx);
      const facts = await this.handoverFacts(tx, schoolId, studentId, handoverOn, evidenceId, current);
      const existing = await tx.handoverRecord.findFirst({ where: { schoolId, studentId, handoverOn: this.day(handoverOn) } });
      if (existing) throw new ConflictException({ code: "HANDOVER_ALREADY_RECORDED", message: "Đã ghi nhận trả trẻ cho học sinh trong ngày này." });
      const record = await tx.handoverRecord.create({ data: { schoolId, studentId, handoverOn: this.day(handoverOn), pickedUpAt, evidenceId, policyEffectiveFrom: facts.policy.effectiveFrom, actorIdentityId: identityId, membershipId: current.id, staffProfileId: current.staffProfileId } });
      if (evidenceId) await tx.evidenceReference.update({ where: { id: evidenceId }, data: { confirmedAt: new Date(), confirmedStudentId: studentId } });
      await this.writeHandoverNotificationSource(tx, schoolId, record.id, studentId, handoverOn, pickedUpAt);
      const outcome = { id: record.id, studentId, handoverOn, pickedUpAt: pickedUpAt.toISOString(), evidenceId, policyEffectiveFrom: facts.policy.effectiveFrom.toISOString().slice(0, 10) };
      await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: "SCHOOL_MEMBERSHIP", reference: current.id, membershipId: current.id }, "HANDOVER_RECORDED", { operationId: op, handoverRecordId: record.id, studentId, handoverOn, pickedUpAt: outcome.pickedUpAt, evidenceId }) });
      return outcome;
    });
  }
  async uploadHandoverEvidence(identityId: string, schoolId: string, key: string, operationId: string, handoverOn: string, contentType: string | undefined, media: unknown) {
    this.date(handoverOn, "handoverOn");
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType ?? "") || !Buffer.isBuffer(media) || !media.length || media.length > 5 * 1024 * 1024) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Tệp bằng chứng không hợp lệ." });
    const actor = await this.handoverTeacher(identityId, schoolId);
    const bytes = new Uint8Array(media);
    return this.mutate({ actorType: "SCHOOL_MEMBERSHIP", actorReference: actor.id, membershipId: actor.id, route: handoverEvidenceUploadRoute, identityId, schoolId, key, operationId, body: { handoverOn, contentType, size: bytes.byteLength }, valid: (tx) => this.handoverTeacher(identityId, schoolId, tx) }, async (tx, op) => {
      const current = await this.handoverTeacher(identityId, schoolId, tx);
      const evidence = await tx.evidenceReference.create({ data: { schoolId, contentType: contentType!, blob: bytes, preview: bytes, uploadedHandoverOn: this.day(handoverOn), uploadedMembershipId: current.id, uploadedStaffProfileId: current.staffProfileId } });
      const outcome = { id: evidence.id, availability: "AVAILABLE", handoverOn };
      await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: "SCHOOL_MEMBERSHIP", reference: current.id, membershipId: current.id }, "HANDOVER_EVIDENCE_UPLOADED", { operationId: op, evidenceId: evidence.id, handoverOn, contentType, size: bytes.byteLength }) });
      return outcome;
    });
  }
  async uploadEvidence(identityId: string, schoolId: string, key: string, operationId: string, classId: string, attendanceOn: string, contentType: string | undefined, media: unknown) {
    this.date(attendanceOn, "attendanceOn");
    if (!uuid.test(classId) || !["image/jpeg", "image/png", "image/webp"].includes(contentType ?? "") || !Buffer.isBuffer(media) || !media.length || media.length > 5 * 1024 * 1024)
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Tệp bằng chứng không hợp lệ." });
    const actor = await this.teacher(identityId, schoolId, classId, attendanceOn);
    const bytes = new Uint8Array(media);
    return this.mutate({ actorType: "SCHOOL_MEMBERSHIP", actorReference: actor.id, membershipId: actor.id, route: evidenceUploadRoute, identityId, schoolId, key, operationId, body: { classId, attendanceOn, contentType, size: bytes.byteLength }, valid: (tx) => this.teacher(identityId, schoolId, classId, attendanceOn, tx) }, async (tx, op) => {
      const current = await this.teacher(identityId, schoolId, classId, attendanceOn, tx);
      const evidence = await tx.evidenceReference.create({ data: { schoolId, contentType: contentType!, blob: bytes, preview: bytes, uploadedClassId: classId, uploadedAttendanceOn: this.day(attendanceOn), uploadedMembershipId: current.id, uploadedStaffProfileId: current.staffProfileId } });
      const outcome = { id: evidence.id, availability: "AVAILABLE", classId, attendanceOn };
      await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: "SCHOOL_MEMBERSHIP", reference: current.id, membershipId: current.id }, "EVIDENCE_UPLOADED", { operationId: op, evidenceId: evidence.id, classId, attendanceOn, contentType, size: bytes.byteLength }) });
      return outcome;
    });
  }
  async readAttendanceEvidence(identityId: string, schoolId: string, evidenceId: string) {
    if (!uuid.test(evidenceId)) throw new NotFoundException({ code: "EVIDENCE_NOT_FOUND", message: "Không tìm thấy bằng chứng." });
    const evidence = await this.prisma.evidenceReference.findFirst({ where: { id: evidenceId, schoolId }, include: { attendanceRecords: { select: { classId: true, attendanceOn: true } } } });
    if (!evidence) throw new NotFoundException({ code: "EVIDENCE_NOT_FOUND", message: "Không tìm thấy bằng chứng." });
    const record = evidence.attendanceRecords[0];
    if (!record) throw new ForbiddenException({ code: "CAPABILITY_DENIED", message: "Bạn không có quyền thực hiện thao tác này." });
    await this.teacher(identityId, schoolId, record.classId, record.attendanceOn.toISOString().slice(0, 10));
    if (evidence.deletedAt || !evidence.blob) throw new ConflictException({ code: "EVIDENCE_EXPIRED", message: expiredEvidenceMessage });
    return { contentType: evidence.contentType, blob: evidence.blob };
  }
  async readHandoverEvidence(identityId: string, schoolId: string, evidenceId: string, audience: "teacher" | "app") {
    if (!uuid.test(evidenceId)) throw new NotFoundException({ code: "EVIDENCE_NOT_FOUND", message: "Không tìm thấy bằng chứng." });
    const evidence = await this.prisma.evidenceReference.findFirst({ where: { id: evidenceId, schoolId }, include: { handoverRecord: { select: { id: true } } } });
    if (!evidence?.handoverRecord) throw new NotFoundException({ code: "EVIDENCE_NOT_FOUND", message: "Không tìm thấy bằng chứng." });
    if (audience === "app") await this.handoverAdmin(identityId, schoolId);
    else await this.handoverTeacher(identityId, schoolId);
    if (evidence.deletedAt || !evidence.blob) throw new ConflictException({ code: "EVIDENCE_EXPIRED", message: expiredEvidenceMessage });
    return { contentType: evidence.contentType, blob: evidence.blob };
  }
  async cleanupExpiredEvidence(now = new Date()) {
    const due = await this.prisma.evidenceReference.findMany({ where: { confirmedAt: { not: null }, deletedAt: null } });
    let deleted = 0;
    for (const evidence of due) {
      const expiry = this.afterTwoHcmCalendarMonths(evidence.confirmedAt!);
      if (expiry > now) continue;
      const removed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.evidenceReference.updateMany({ where: { id: evidence.id, schoolId: evidence.schoolId, deletedAt: null }, data: { blob: null, preview: null, deletedAt: now, deletionReason: "RETENTION_EXPIRED" } });
        if (updated.count) await tx.auditRecord.create({ data: { schoolId: evidence.schoolId, action: "EVIDENCE_EXPIRED", provenance: { evidenceId: evidence.id, confirmedAt: evidence.confirmedAt!.toISOString() } } });
        return updated.count;
      });
      deleted += removed;
    }
    return { deleted };
  }
  // Future operational domains use this same durable source boundary without owning Parent delivery.
  private afterTwoHcmCalendarMonths(confirmedAt: Date) {
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(confirmedAt);
    const value = (type: string) => Number(local.find((part) => part.type === type)!.value);
    const month = value("month") + 2;
    const year = value("year") + Math.floor((month - 1) / 12);
    const normalizedMonth = ((month - 1) % 12) + 1;
    const day = Math.min(value("day"), new Date(Date.UTC(year, normalizedMonth, 0)).getUTCDate());
    return new Date(Date.UTC(year, normalizedMonth - 1, day, value("hour") - 7, value("minute"), value("second")));
  }
  private async writeNotificationSource(tx: Db, schoolId: string, sourceType: "ATTENDANCE", sourceRecordId: string, studentId: string, attendanceOn: string, state: "PRESENT" | "ABSENT") {
    try {
      await tx.notificationSourceEvent.create({ data: { schoolId, sourceType, sourceRecordId, studentId, attendanceOn: this.day(attendanceOn), state, payload: { schoolId, studentId, attendanceOn, state } } });
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") throw error;
    }
  }
  private async writeHandoverNotificationSource(tx: Db, schoolId: string, sourceRecordId: string, studentId: string, handoverOn: string, pickedUpAt: Date) {
    try {
      await tx.notificationSourceEvent.create({ data: { schoolId, sourceType: "HANDOVER", sourceRecordId, studentId, attendanceOn: this.day(handoverOn), pickedUpAt, payload: { schoolId, studentId, handoverOn, pickedUpAt: pickedUpAt.toISOString() } } });
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") throw error;
    }
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
    if (!uuid.test(leaveRequestId))
      throw new NotFoundException({
        code: "LEAVE_REQUEST_NOT_FOUND",
        message: "Không tìm thấy đơn nghỉ.",
      });
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
          where: { schoolId_id: { schoolId, id: request.id } },
          data: {
            status,
            rejectedReason: status === "REJECTED" ? reason : null,
            decidedAt: new Date(),
            decidedByMembershipId: actor.id,
          },
          include: { days: { orderBy: { operatingOn: "asc" } } },
        });
        if (status === "APPROVED") await this.issueLeaveDaySources(tx, updated);
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
  private async issueLeaveDaySources(
    tx: Db,
    request: { schoolId: string; id: string; studentId: string; status: string; days: Array<{ operatingOn: Date }> },
  ) {
    if (request.status !== "AUTO_APPROVED" && request.status !== "APPROVED") return;
    await tx.leaveDaySource.createMany({
      data: request.days.map((day) => ({
        schoolId: request.schoolId,
        studentId: request.studentId,
        operatingOn: day.operatingOn,
        leaveRequestId: request.id,
        leaveStatus: request.status,
      })),
      skipDuplicates: true,
    });
    const operatingOn = request.days.map((day) => day.operatingOn);
    const present = await tx.attendanceRecord.findMany({
      where: {
        schoolId: request.schoolId,
        studentId: request.studentId,
        state: "PRESENT",
        attendanceOn: { in: operatingOn },
      },
      select: { id: true, attendanceOn: true },
    });
    for (const attendance of present)
      await this.excludeLeaveDaySources(
        tx,
        request.schoolId,
        request.studentId,
        attendance.attendanceOn.toISOString().slice(0, 10),
        attendance.id,
      );
  }
  private async excludeLeaveDaySources(tx: Db, schoolId: string, studentId: string, attendanceOn: string, attendanceRecordId: string) {
    const source = await tx.leaveDaySource.findUnique({
      where: {
        schoolId_studentId_operatingOn: {
          schoolId,
          studentId,
          operatingOn: this.day(attendanceOn),
        },
      },
      select: { id: true },
    });
    if (source)
      await tx.leaveDaySourceExclusion.createMany({
        data: [{ schoolId, leaveDaySourceId: source.id, attendanceRecordId }],
        skipDuplicates: true,
      });
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
  private async overviewActor(identityId: string, schoolId: string, tx: Db = this.prisma) {
    const actor = await tx.schoolMembership.findFirst({ where: { schoolId, userIdentityId: identityId, status: "ACTIVE", school: { status: "ACTIVE" }, boundStaffProfile: { boundAt: { not: null }, boundByMembershipId: { not: null }, employmentStatus: "ACTIVE", primaryPosition: { status: "ACTIVE", grants: { some: { capability: "SCHOOL_CONTEXT_READ" } } } } }, select: { id: true } });
    if (!actor) throw new ForbiddenException({ code: "CAPABILITY_DENIED", message: "Bạn không có quyền thực hiện thao tác này." });
    return actor;
  }
  private async handoverTeacher(identityId: string, schoolId: string, tx: Db = this.prisma) {
    const actor = await tx.schoolMembership.findFirst({ where: { schoolId, userIdentityId: identityId, status: "ACTIVE", school: { status: "ACTIVE" }, boundStaffProfile: { boundAt: { not: null }, boundByMembershipId: { not: null }, employmentStatus: "ACTIVE", primaryPosition: { status: "ACTIVE", grants: { some: { capability: "HANDOVER_WRITE" } } } } }, select: { id: true, boundStaffProfile: { select: { id: true } } } });
    if (!actor?.boundStaffProfile) throw new ForbiddenException({ code: "CAPABILITY_DENIED", message: "Bạn không có quyền thực hiện thao tác này." });
    return { id: actor.id, staffProfileId: actor.boundStaffProfile.id };
  }
  private async handoverAdmin(identityId: string, schoolId: string, tx: Db = this.prisma) {
    const actor = await tx.schoolMembership.findFirst({ where: { schoolId, userIdentityId: identityId, status: "ACTIVE", school: { status: "ACTIVE" }, boundStaffProfile: { boundAt: { not: null }, boundByMembershipId: { not: null }, employmentStatus: "ACTIVE", primaryPosition: { status: "ACTIVE", grants: { some: { capability: "SETTINGS_MANAGE" } } } } }, select: { id: true } });
    if (!actor) throw new ForbiddenException({ code: "CAPABILITY_DENIED", message: "Bạn không có quyền thực hiện thao tác này." });
    return actor;
  }
  private async handoverFacts(tx: Db, schoolId: string, studentId: string, handoverOn: string, evidenceId: string | null, actor: { id: string; staffProfileId: string }) {
    const on = this.day(handoverOn);
    await this.operatingDay(tx, schoolId, handoverOn, "Không thể bàn giao ngày không vận hành.");
    const policy = await tx.handoverPolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: on } }, orderBy: { effectiveFrom: "desc" } });
    if (!policy) throw new ConflictException({ code: "HANDOVER_POLICY_NOT_CONFIGURED", message: "Trường chưa cấu hình chính sách bàn giao." });
    const enrollment = await tx.studentEnrollment.findFirst({ where: { schoolId, studentId, lifecycle: "ENROLLED", effectiveFrom: { lte: on }, OR: [{ endedOn: null }, { endedOn: { gt: on } }] } });
    if (!enrollment) throw new ConflictException({ code: "ROSTER_CONFLICT", message: "Học sinh không thuộc danh sách nhập học trong ngày này." });
    if (policy.photoEvidenceMode === "REQUIRED" && !evidenceId) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ.", fieldErrors: { evidenceId: "Cần bằng chứng khi ghi trả trẻ." } });
    if (evidenceId && !(await tx.evidenceReference.findFirst({ where: { id: evidenceId, schoolId, blob: { not: null }, deletedAt: null, uploadedHandoverOn: on, uploadedMembershipId: actor.id, uploadedStaffProfileId: actor.staffProfileId, confirmedAt: null }, select: { id: true } }))) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ.", fieldErrors: { evidenceId: "Bằng chứng không hợp lệ." } });
    return { policy };
  }
  private async attendanceFacts(tx: Db, schoolId: string, classId: string, studentId: string, attendanceOn: string, state: "PRESENT" | "ABSENT", evidenceId: string | null, actor?: { id: string; staffProfileId: string }, existingEvidenceId?: string | null) {
    const on = this.day(attendanceOn);
    await this.operatingDay(tx, schoolId, attendanceOn, "Không thể điểm danh ngày không vận hành.");
    const policy = await tx.attendancePolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: on } }, orderBy: { effectiveFrom: "desc" } });
    if (!policy) throw new ConflictException({ code: "ATTENDANCE_POLICY_NOT_CONFIGURED", message: "Trường chưa cấu hình chính sách điểm danh." });
    const enrollment = await tx.studentEnrollment.findFirst({ where: { schoolId, studentId, lifecycle: "ENROLLED", effectiveFrom: { lte: on }, OR: [{ endedOn: null }, { endedOn: { gt: on } }], classAssignments: { some: { classId, effectiveFrom: { lte: on }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: on } }] } } } });
    if (!enrollment) throw new ConflictException({ code: "ROSTER_CONFLICT", message: "Học sinh không thuộc danh sách lớp trong ngày này." });
    if (state === "PRESENT" && policy.photoEvidenceMode === "REQUIRED" && !evidenceId) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ.", fieldErrors: { evidenceId: "Cần bằng chứng khi ghi có mặt." } });
    if (state === "PRESENT" && evidenceId && !(await tx.evidenceReference.findFirst({ where: { id: evidenceId, schoolId, blob: { not: null }, deletedAt: null, uploadedClassId: classId, uploadedAttendanceOn: this.day(attendanceOn), uploadedMembershipId: actor?.id, uploadedStaffProfileId: actor?.staffProfileId, OR: [{ confirmedAt: null }, { id: existingEvidenceId, confirmedStudentId: studentId, confirmedAttendanceOn: this.day(attendanceOn) }] }, select: { id: true } }))) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ.", fieldErrors: { evidenceId: "Bằng chứng không hợp lệ." } });
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
  private async operatingDay(tx: Db, schoolId: string, day: string, message: string) {
    const on = this.day(day);
    const calendar = await this.calendar(tx, schoolId, day);
    if (on.getUTCDay() === 0 || calendar.holidays.some((holiday: { startsOn: Date; endsOn: Date }) => holiday.startsOn <= on && holiday.endsOn >= on)) throw new ConflictException({ code: "NON_OPERATING_DAY", message });
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
          boundAt: { not: null },
          boundByMembershipId: { not: null },
          employmentStatus: "ACTIVE",
          primaryPosition: {
            status: "ACTIVE",
            grants: { some: { capability: "LEAVE_REQUEST_DECIDE" } },
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
