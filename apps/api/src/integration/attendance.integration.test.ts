import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../modules/identity/prisma.service.js';
import { AttendanceService } from '../modules/attendance/attendance.service.js';

const prisma = new PrismaService();
const attendance = new AttendanceService(prisma);
const schools: string[] = [];
const parentProfiles: string[] = [];
const uuid = () => crypto.randomUUID();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function graph() {
  const school = await prisma.school.create({ data: { name: 'Attendance', slug: `attendance-${uuid()}`, studentCodePrefix: 'AT' } });
  schools.push(school.id);
  const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const membership = await prisma.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: identity.id } });
  const year = await prisma.schoolYear.create({ data: { schoolId: school.id, name: 'Năm 2026', startsOn: date('2026-01-01'), endsOn: date('2027-01-01') } });
  const classroom = await prisma.class.create({ data: { schoolId: school.id, schoolYearId: year.id, name: 'Mầm' } });
  const student = await prisma.student.create({ data: { schoolId: school.id, studentCode: `AT-${uuid()}`, fullName: 'Bé An', dateOfBirth: date('2022-01-01') } });
  const enrollment = await prisma.studentEnrollment.create({ data: { schoolId: school.id, studentId: student.id, schoolYearId: year.id, classId: classroom.id, lifecycle: 'ENROLLED', effectiveFrom: date('2026-01-01'), schoolYearName: year.name, schoolYearStartsOn: year.startsOn, schoolYearEndsOn: year.endsOn, className: classroom.name } });
  await prisma.enrollmentClassAssignment.create({ data: { schoolId: school.id, enrollmentId: enrollment.id, schoolYearId: year.id, classId: classroom.id, effectiveFrom: date('2026-01-01'), reason: 'Xếp lớp đầu năm' } });
  const parent = await prisma.parentProfile.create({ data: { emailNormalized: `${uuid()}@example.com`, fullName: 'Phụ huynh', phone: '0900000000' } });
  parentProfiles.push(parent.id);
  await prisma.studentParent.create({ data: { schoolId: school.id, studentId: student.id, parentProfileId: parent.id } });
  await prisma.schoolCalendarVersion.create({ data: { schoolId: school.id, effectiveFrom: date('2026-01-01'), actorIdentityId: identity.id, membershipId: membership.id } });
  return { school, identity, membership, year, classroom, student, parent };
}

async function request(input: Awaited<ReturnType<typeof graph>>) {
  return prisma.leaveRequest.create({ data: { schoolId: input.school.id, studentId: input.student.id, parentProfileId: input.parent.id, status: 'PENDING', policyEffectiveFrom: date('2026-01-01'), policyDeadlineLocalTime: '08:00' } });
}

afterEach(async () => {
  const ids = schools.splice(0);
  if (ids.length) await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.auditRecord.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.operation.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.notificationSourceEvent.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.leaveDaySourceExclusion.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.leaveDaySource.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.leaveRequestDay.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.leaveRequest.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.attendanceRecord.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.handoverRecord.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.evidenceReference.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.attendancePolicy.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.handoverPolicy.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.leavePolicy.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolCalendarVersion.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.studentParent.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.staffClassAssignment.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.enrollmentClassAssignment.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.studentEnrollment.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.student.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.class.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolYear.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.staffProfile.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.positionCapabilityGrant.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolPosition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolMembership.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.school.deleteMany({ where: { id: { in: ids } } });
  });
  await prisma.parentProfile.deleteMany({ where: { id: { in: parentProfiles.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('attendance PostgreSQL invariants', () => {
  it('requires StudentParent provenance and rejects cross-School LeaveRequest graphs', async () => {
    const current = await graph(); const foreign = await graph();
    const unlinked = await prisma.parentProfile.create({ data: { emailNormalized: `${uuid()}@example.com`, fullName: 'Không liên kết', phone: '0900000001' } });
    parentProfiles.push(unlinked.id);
    const data = { status: 'PENDING' as const, policyEffectiveFrom: date('2026-01-01'), policyDeadlineLocalTime: '08:00' };
    await expect(prisma.leaveRequest.create({ data: { schoolId: current.school.id, studentId: current.student.id, parentProfileId: unlinked.id, ...data } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.leaveRequest.create({ data: { schoolId: foreign.school.id, studentId: current.student.id, parentProfileId: current.parent.id, ...data } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('requires a real calendar snapshot and an ENROLLED interval for every LeaveRequestDay', async () => {
    const current = await graph(); const leaveRequest = await request(current);
    await expect(prisma.leaveRequestDay.create({ data: { schoolId: current.school.id, leaveRequestId: leaveRequest.id, operatingOn: date('2026-01-02'), calendarEffectiveFrom: date('2026-02-01') } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.leaveRequestDay.create({ data: { schoolId: current.school.id, leaveRequestId: leaveRequest.id, operatingOn: date('2025-12-31'), calendarEffectiveFrom: date('2026-01-01') } })).rejects.toBeTruthy();
  });

  it('rejects invalid terminal LeaveRequest metadata', async () => {
    const current = await graph();
    await expect(prisma.leaveRequest.create({ data: { schoolId: current.school.id, studentId: current.student.id, parentProfileId: current.parent.id, status: 'APPROVED', policyEffectiveFrom: date('2026-01-01'), policyDeadlineLocalTime: '08:00' } })).rejects.toBeTruthy();
  });

  it('keeps LeavePolicy append-only and unique by School effective date', async () => {
    const current = await graph();
    const policy = await prisma.leavePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date('2026-01-01'), nextDayDeadlineLocalTime: '08:00', actorIdentityId: current.identity.id, membershipId: current.membership.id } });
    await expect(prisma.leavePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date('2026-01-01'), nextDayDeadlineLocalTime: '09:00', actorIdentityId: current.identity.id, membershipId: current.membership.id } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.leavePolicy.update({ where: { id: policy.id }, data: { nextDayDeadlineLocalTime: '09:00' } })).rejects.toBeTruthy();
    await expect(prisma.leavePolicy.delete({ where: { id: policy.id } })).rejects.toBeTruthy();
  });

  it('enforces attendance School graph, one current fact, and enrolled placement in PostgreSQL', async () => {
    const current = await graph(); const foreign = await graph();
    const position = await prisma.schoolPosition.create({ data: { schoolId: current.school.id, code: `ATT-${uuid()}`, name: `Điểm danh ${uuid()}` } });
    const staff = await prisma.staffProfile.create({ data: { schoolId: current.school.id, primaryPositionId: position.id, fullName: 'Cô An', email: `${uuid()}@example.com`, phone: '0900000002', dateOfBirth: date('1990-01-01'), gender: 'Nữ', address: 'Hà Nội' } });
    const policy = await prisma.attendancePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date('2026-01-01'), photoEvidenceMode: 'OPTIONAL', reason: 'Điểm danh', actorIdentityId: current.identity.id, membershipId: current.membership.id } });
    const data = { schoolId: current.school.id, classId: current.classroom.id, studentId: current.student.id, attendanceOn: date('2026-02-09'), state: 'PRESENT' as const, policyEffectiveFrom: policy.effectiveFrom, actorIdentityId: current.identity.id, membershipId: current.membership.id, staffProfileId: staff.id };
    await expect(prisma.attendanceRecord.create({ data })).resolves.toMatchObject({ state: 'PRESENT' });
    await expect(prisma.attendanceRecord.create({ data })).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.attendanceRecord.create({ data: { ...data, classId: foreign.classroom.id } })).rejects.toBeTruthy();
    await expect(prisma.attendanceRecord.create({ data: { ...data, attendanceOn: date('2025-12-31') } })).rejects.toBeTruthy();
  });

  it('writes, replays, audits, and projects actual attendance ahead of confirmed leave', async () => {
    const current = await graph();
    const position = await prisma.schoolPosition.create({ data: { schoolId: current.school.id, code: `TEACHER-${uuid()}`, name: `Giáo viên ${uuid()}` } });
    await prisma.positionCapabilityGrant.createMany({ data: ['ATTENDANCE_WRITE', 'LEAVE_REQUEST_DECIDE'].map((capability) => ({ schoolId: current.school.id, positionId: position.id, capability })) });
    const staff = await prisma.staffProfile.create({ data: { schoolId: current.school.id, primaryPositionId: position.id, schoolMembershipId: current.membership.id, boundAt: new Date(), boundByMembershipId: current.membership.id, fullName: 'Cô An', email: `${uuid()}@example.com`, phone: '0900000003', dateOfBirth: date('1990-01-01'), gender: 'Nữ', address: 'Hà Nội' } });
    await prisma.staffClassAssignment.create({ data: { schoolId: current.school.id, staffProfileId: staff.id, schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: date('2026-01-01'), reason: 'Dạy lớp' , schoolYearName: current.year.name, schoolYearStartsOn: current.year.startsOn, schoolYearEndsOn: current.year.endsOn, className: current.classroom.name } });
    await prisma.attendancePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date('2026-01-01'), photoEvidenceMode: 'OPTIONAL', reason: 'Điểm danh', actorIdentityId: current.identity.id, membershipId: current.membership.id } });
    const leave = await prisma.leaveRequest.create({ data: { schoolId: current.school.id, studentId: current.student.id, parentProfileId: current.parent.id, status: 'APPROVED', policyEffectiveFrom: date('2026-01-01'), policyDeadlineLocalTime: '08:00', decidedAt: new Date(), decidedByMembershipId: current.membership.id } });
    await prisma.leaveRequestDay.create({ data: { schoolId: current.school.id, leaveRequestId: leave.id, operatingOn: date('2026-02-09'), calendarEffectiveFrom: date('2026-01-01') } });
    const key = uuid(); const operationId = uuid(); const body = { classId: current.classroom.id, studentId: current.student.id, attendanceOn: '2026-02-09', state: 'PRESENT' };
    const first = await attendance.record(current.identity.id, current.school.id, key, operationId, body);
    const replay = await attendance.record(current.identity.id, current.school.id, key, operationId, body);
    expect(replay).toEqual(first);
    expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: 'ATTENDANCE_RECORDED' } })).toBe(1);
    const source = await prisma.notificationSourceEvent.findUniqueOrThrow({ where: { schoolId_sourceType_sourceRecordId: { schoolId: current.school.id, sourceType: 'ATTENDANCE', sourceRecordId: (first.outcome as { id: string }).id } } });
    expect(source.payload).toEqual({ schoolId: current.school.id, studentId: current.student.id, attendanceOn: '2026-02-09', state: 'PRESENT' });
    expect(await prisma.notificationSourceEvent.count({ where: { schoolId: current.school.id } })).toBe(1);
    await expect(attendance.record(current.identity.id, current.school.id, key, uuid(), { ...body, state: 'ABSENT' })).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_CONFLICT' } });
    await expect(attendance.teacherRoster(current.identity.id, current.school.id, current.classroom.id, '2026-02-09')).resolves.toMatchObject({ students: [{ studentId: current.student.id, state: 'PRESENT' }] });
  });
  it('decides a pending leave with the capability, replays once, blocks revoke, and exports a Finance-free source', async () => {
    const current = await graph();
    const position = await prisma.schoolPosition.create({ data: { schoolId: current.school.id, code: `DECIDER-${uuid()}`, name: `Duyệt nghỉ ${uuid()}` } });
    await prisma.positionCapabilityGrant.create({ data: { schoolId: current.school.id, positionId: position.id, capability: 'LEAVE_REQUEST_DECIDE' } });
    await prisma.staffProfile.create({ data: { schoolId: current.school.id, primaryPositionId: position.id, schoolMembershipId: current.membership.id, boundAt: new Date(), boundByMembershipId: current.membership.id, fullName: 'Kế toán', email: `${uuid()}@example.com`, phone: '0900000006', dateOfBirth: date('1990-01-01'), gender: 'Nữ', address: 'Hà Nội' } });
    const leave = await request(current);
    await prisma.leaveRequestDay.create({ data: { schoolId: current.school.id, leaveRequestId: leave.id, operatingOn: date('2026-02-09'), calendarEffectiveFrom: date('2026-01-01') } });
    const key = uuid(); const operationId = uuid();
    const first = await attendance.decide(current.identity.id, current.school.id, leave.id, 'APPROVED', key, operationId, {});
    expect(await attendance.decide(current.identity.id, current.school.id, leave.id, 'APPROVED', key, operationId, {})).toEqual(first);
    expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: 'LEAVE_REQUEST_APPROVED' } })).toBe(1);
    expect(await prisma.leaveDaySource.findMany({ where: { schoolId: current.school.id, leaveRequestId: leave.id } })).toHaveLength(1);
    const rejected = await request(current);
    const rejectionKey = uuid();
    await attendance.decide(current.identity.id, current.school.id, rejected.id, 'REJECTED', rejectionKey, uuid(), { reason: 'Thiếu thông tin' });
    await expect(attendance.decide(current.identity.id, current.school.id, rejected.id, 'REJECTED', rejectionKey, uuid(), { reason: 'Lý do khác' })).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_CONFLICT' } });
    await expect(attendance.leaveDaySources(current.identity.id, current.school.id)).resolves.toEqual({ data: [{ schoolId: current.school.id, studentId: current.student.id, operatingOn: '2026-02-09', leaveRequestId: leave.id, leaveStatus: 'APPROVED', eligible: true }], nextCursor: null });
    await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: current.school.id, positionId: position.id, capability: 'LEAVE_REQUEST_DECIDE' } });
    await expect(attendance.appOperation(current.identity.id, current.school.id, operationId)).rejects.toMatchObject({ response: { code: 'CAPABILITY_DENIED' } });
  });
  it('returns a School-scoped operational queue with separate pending leave and attendance-gap destinations', async () => {
    const current = await graph(); const foreign = await graph();
    const position = await prisma.schoolPosition.create({ data: { schoolId: current.school.id, code: `QUEUE-${uuid()}`, name: `Hàng đợi ${uuid()}` } });
    await prisma.positionCapabilityGrant.createMany({ data: ['OPERATIONAL_QUEUE_READ', 'SETTINGS_MANAGE'].map((capability) => ({ schoolId: current.school.id, positionId: position.id, capability })) });
    await prisma.staffProfile.create({ data: { schoolId: current.school.id, primaryPositionId: position.id, schoolMembershipId: current.membership.id, boundAt: new Date(), boundByMembershipId: current.membership.id, fullName: 'Quản lý hàng đợi', email: `${uuid()}@example.com`, phone: '0900000010', dateOfBirth: date('1990-01-01'), gender: 'Nữ', address: 'Hà Nội' } });
    const unrecordedStudent = await prisma.student.create({ data: { schoolId: current.school.id, studentCode: `AT-${uuid()}`, fullName: 'Bé Bình', dateOfBirth: date('2022-01-01') } });
    const unrecordedEnrollment = await prisma.studentEnrollment.create({ data: { schoolId: current.school.id, studentId: unrecordedStudent.id, schoolYearId: current.year.id, classId: current.classroom.id, lifecycle: 'ENROLLED', effectiveFrom: date('2026-01-01'), schoolYearName: current.year.name, schoolYearStartsOn: current.year.startsOn, schoolYearEndsOn: current.year.endsOn, className: current.classroom.name } });
    await prisma.enrollmentClassAssignment.create({ data: { schoolId: current.school.id, enrollmentId: unrecordedEnrollment.id, schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: date('2026-01-01'), reason: 'Xếp lớp đầu năm' } });
    const leave = await request(current);
    await prisma.leaveRequestDay.create({ data: { schoolId: current.school.id, leaveRequestId: leave.id, operatingOn: date('2026-02-09'), calendarEffectiveFrom: date('2026-01-01') } });
    await expect(attendance.operationalQueue(current.identity.id, current.school.id, '2026-02-09')).resolves.toMatchObject({ schoolId: current.school.id, operating: true, classes: [{ classId: current.classroom.id, attendanceGapCount: 1, pendingLeaveCount: 1 }] });
    await expect(attendance.operationalQueueItems(current.identity.id, current.school.id, '2026-02-09', current.classroom.id, 'NOT_RECORDED')).resolves.toMatchObject({ students: [{ studentId: unrecordedStudent.id }] });
    await expect(attendance.operationalQueueItems(current.identity.id, current.school.id, '2026-02-09', current.classroom.id, 'PENDING')).resolves.toMatchObject({ students: [{ studentId: current.student.id }] });
    await expect(attendance.operationalQueue(current.identity.id, current.school.id, '2026-02-08', current.classroom.id)).resolves.toMatchObject({ operating: false, classes: [] });
    await expect(attendance.operationalQueueItems(current.identity.id, current.school.id, '2026-02-08', current.classroom.id, 'NOT_RECORDED')).resolves.toMatchObject({ operating: false, students: [] });
    await expect(attendance.operationalQueueItems(current.identity.id, current.school.id, '2026-02-09', foreign.classroom.id, 'PENDING')).rejects.toMatchObject({ response: { code: 'CLASS_NOT_FOUND' } });
    await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: current.school.id, positionId: position.id, capability: 'OPERATIONAL_QUEUE_READ' } });
    await expect(attendance.operationalQueue(current.identity.id, current.school.id, '2026-02-09')).rejects.toMatchObject({ response: { code: 'CAPABILITY_DENIED' } });
  });
  it('issues one AUTO_APPROVED source through the parent leave flow and excludes it after public PRESENT recording', async () => {
    const current = await graph();
    await prisma.parentProfile.update({ where: { id: current.parent.id }, data: { userIdentityId: current.identity.id, boundAt: new Date() } });
    await prisma.leavePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date('2026-01-01'), nextDayDeadlineLocalTime: '15:00', actorIdentityId: current.identity.id, membershipId: current.membership.id } });
    const position = await prisma.schoolPosition.create({ data: { schoolId: current.school.id, code: `AUTO-${uuid()}`, name: `Điểm danh ${uuid()}` } });
    await prisma.positionCapabilityGrant.createMany({ data: ['ATTENDANCE_WRITE', 'LEAVE_REQUEST_DECIDE'].map((capability) => ({ schoolId: current.school.id, positionId: position.id, capability })) });
    const staff = await prisma.staffProfile.create({ data: { schoolId: current.school.id, primaryPositionId: position.id, schoolMembershipId: current.membership.id, boundAt: new Date(), boundByMembershipId: current.membership.id, fullName: 'Cô An', email: `${uuid()}@example.com`, phone: '0900000008', dateOfBirth: date('1990-01-01'), gender: 'Nữ', address: 'Hà Nội' } });
    await prisma.staffClassAssignment.create({ data: { schoolId: current.school.id, staffProfileId: staff.id, schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: date('2026-01-01'), reason: 'Dạy lớp', schoolYearName: current.year.name, schoolYearStartsOn: current.year.startsOn, schoolYearEndsOn: current.year.endsOn, className: current.classroom.name } });
    await prisma.attendancePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date('2026-01-01'), photoEvidenceMode: 'OPTIONAL', reason: 'Điểm danh', actorIdentityId: current.identity.id, membershipId: current.membership.id } });
    vi.spyOn(attendance as any, 'now').mockReturnValue({ day: '2026-02-08', time: '08:00' });
    await attendance.create(current.identity.id, current.school.id, uuid(), uuid(), { studentId: current.student.id, startsOn: '2026-02-09', endsOn: '2026-02-09' });
    expect(await prisma.leaveDaySource.count({ where: { schoolId: current.school.id, studentId: current.student.id, operatingOn: date('2026-02-09') } })).toBe(1);
    await attendance.record(current.identity.id, current.school.id, uuid(), uuid(), { classId: current.classroom.id, studentId: current.student.id, attendanceOn: '2026-02-09', state: 'PRESENT' });
    await expect(attendance.leaveDaySources(current.identity.id, current.school.id)).resolves.toEqual({ data: [], nextCursor: null });
    vi.restoreAllMocks();
  });
  it('excludes only PRESENT from the immutable leave source and retains ABSENT', async () => {
    const current = await graph();
    const position = await prisma.schoolPosition.create({ data: { schoolId: current.school.id, code: `SOURCE-${uuid()}`, name: `Nguồn nghỉ ${uuid()}` } });
    await prisma.positionCapabilityGrant.createMany({ data: ['LEAVE_REQUEST_DECIDE', 'ATTENDANCE_WRITE'].map((capability) => ({ schoolId: current.school.id, positionId: position.id, capability })) });
    const staff = await prisma.staffProfile.create({ data: { schoolId: current.school.id, primaryPositionId: position.id, schoolMembershipId: current.membership.id, boundAt: new Date(), boundByMembershipId: current.membership.id, fullName: 'Quản lý', email: `${uuid()}@example.com`, phone: '0900000007', dateOfBirth: date('1990-01-01'), gender: 'Nữ', address: 'Hà Nội' } });
    await prisma.staffClassAssignment.create({ data: { schoolId: current.school.id, staffProfileId: staff.id, schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: date('2026-01-01'), reason: 'Dạy lớp', schoolYearName: current.year.name, schoolYearStartsOn: current.year.startsOn, schoolYearEndsOn: current.year.endsOn, className: current.classroom.name } });
    const policy = await prisma.attendancePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date('2026-01-01'), photoEvidenceMode: 'OPTIONAL', reason: 'Điểm danh', actorIdentityId: current.identity.id, membershipId: current.membership.id } });
    const leave = await request(current);
    await prisma.leaveRequestDay.create({ data: { schoolId: current.school.id, leaveRequestId: leave.id, operatingOn: date('2026-02-09'), calendarEffectiveFrom: date('2026-01-01') } });
    await attendance.decide(current.identity.id, current.school.id, leave.id, 'APPROVED', uuid(), uuid(), {});
    await prisma.attendanceRecord.create({ data: { schoolId: current.school.id, classId: current.classroom.id, studentId: current.student.id, attendanceOn: date('2026-02-09'), state: 'ABSENT', policyEffectiveFrom: policy.effectiveFrom, actorIdentityId: current.identity.id, membershipId: current.membership.id, staffProfileId: staff.id } });
    expect((await attendance.leaveDaySources(current.identity.id, current.school.id)).data).toHaveLength(1);
    const attendanceRecord = await prisma.attendanceRecord.update({ where: { schoolId_classId_studentId_attendanceOn: { schoolId: current.school.id, classId: current.classroom.id, studentId: current.student.id, attendanceOn: date('2026-02-09') } }, data: { state: 'PRESENT' } });
    const source = await prisma.leaveDaySource.findFirstOrThrow({ where: { schoolId: current.school.id, leaveRequestId: leave.id } });
    await prisma.leaveDaySourceExclusion.create({ data: { schoolId: current.school.id, leaveDaySourceId: source.id, attendanceRecordId: attendanceRecord.id } });
    await expect(attendance.leaveDaySources(current.identity.id, current.school.id)).resolves.toEqual({ data: [], nextCursor: null });
  });
  it('expires confirmed evidence after two calendar months while retaining its audit handle and source fact', async () => {
    const current = await graph();
    const evidence = await prisma.evidenceReference.create({ data: { schoolId: current.school.id, contentType: 'image/jpeg', blob: new Uint8Array([1]), preview: new Uint8Array([1]), confirmedAt: new Date('2026-01-31T04:00:00.000Z'), confirmedStudentId: current.student.id, confirmedAttendanceOn: date('2026-01-30') } });
    await expect(attendance.cleanupExpiredEvidence(new Date('2026-03-30T04:00:00.000Z'))).resolves.toEqual({ deleted: 0 });
    await expect(attendance.cleanupExpiredEvidence(new Date('2026-03-31T04:00:00.000Z'))).resolves.toEqual({ deleted: 1 });
    await expect(prisma.evidenceReference.findUniqueOrThrow({ where: { id: evidence.id } })).resolves.toMatchObject({ id: evidence.id, blob: null, preview: null, deletionReason: 'RETENTION_EXPIRED' });
    expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: 'EVIDENCE_EXPIRED' } })).toBe(1);
  });
  it('records handover without a Class assignment, replays once, and emits only the handover source payload', async () => {
    const current = await graph();
    const position = await prisma.schoolPosition.create({ data: { schoolId: current.school.id, code: `HANDOVER-${uuid()}`, name: `Bàn giao ${uuid()}` } });
    await prisma.positionCapabilityGrant.create({ data: { schoolId: current.school.id, positionId: position.id, capability: 'HANDOVER_WRITE' } });
    await prisma.staffProfile.create({ data: { schoolId: current.school.id, primaryPositionId: position.id, schoolMembershipId: current.membership.id, boundAt: new Date(), boundByMembershipId: current.membership.id, fullName: 'Cô Bàn giao', email: `${uuid()}@example.com`, phone: '0900000004', dateOfBirth: date('1990-01-01'), gender: 'Nữ', address: 'Hà Nội' } });
    await prisma.handoverPolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date('2026-01-01'), photoEvidenceMode: 'OPTIONAL', reason: 'Bàn giao', actorIdentityId: current.identity.id, membershipId: current.membership.id } });
    const body = { studentId: current.student.id, handoverOn: '2026-02-09', pickedUpAt: '2026-02-09T10:00:00+07:00', evidenceId: null };
    const key = uuid(); const operationId = uuid();
    const first = await attendance.recordHandover(current.identity.id, current.school.id, key, operationId, body);
    const replay = await attendance.recordHandover(current.identity.id, current.school.id, key, operationId, body);
    expect(replay).toEqual(first);
    const source = await prisma.notificationSourceEvent.findFirstOrThrow({ where: { schoolId: current.school.id, sourceType: 'HANDOVER' } });
    expect(source.payload).toEqual({ schoolId: current.school.id, studentId: current.student.id, handoverOn: '2026-02-09', pickedUpAt: '2026-02-09T03:00:00.000Z' });
    expect(source.state).toBeNull();
    expect(source.pickedUpAt?.toISOString()).toBe('2026-02-09T03:00:00.000Z');
    await expect(attendance.recordHandover(current.identity.id, current.school.id, uuid(), uuid(), body)).rejects.toMatchObject({ response: { code: 'HANDOVER_ALREADY_RECORDED' } });
  });
  it('denies a foreign Student and rejects missing required evidence before handover persistence', async () => {
    const current = await graph(); const foreign = await graph();
    const position = await prisma.schoolPosition.create({ data: { schoolId: current.school.id, code: `HANDOVER-${uuid()}`, name: `Bàn giao ${uuid()}` } });
    await prisma.positionCapabilityGrant.create({ data: { schoolId: current.school.id, positionId: position.id, capability: 'HANDOVER_WRITE' } });
    await prisma.staffProfile.create({ data: { schoolId: current.school.id, primaryPositionId: position.id, schoolMembershipId: current.membership.id, boundAt: new Date(), boundByMembershipId: current.membership.id, fullName: 'Cô Bàn giao', email: `${uuid()}@example.com`, phone: '0900000005', dateOfBirth: date('1990-01-01'), gender: 'Nữ', address: 'Hà Nội' } });
    await prisma.handoverPolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date('2026-01-01'), photoEvidenceMode: 'REQUIRED', reason: 'Bàn giao', actorIdentityId: current.identity.id, membershipId: current.membership.id } });
    const shared = { handoverOn: '2026-02-09', pickedUpAt: '2026-02-09T10:00:00+07:00' };
    await expect(attendance.recordHandover(current.identity.id, current.school.id, uuid(), uuid(), { ...shared, studentId: foreign.student.id, evidenceId: null })).rejects.toMatchObject({ response: { code: 'ROSTER_CONFLICT' } });
    await expect(attendance.recordHandover(current.identity.id, current.school.id, uuid(), uuid(), { ...shared, studentId: current.student.id, evidenceId: null })).rejects.toMatchObject({ response: { fieldErrors: { evidenceId: expect.any(String) } } });
    expect(await prisma.handoverRecord.count({ where: { schoolId: current.school.id } })).toBe(0);
  });
});
