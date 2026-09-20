import { afterAll, afterEach, describe, expect, it } from 'vitest';
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
    await tx.leaveRequestDay.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.leaveRequest.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.attendanceRecord.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.evidenceReference.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.attendancePolicy.deleteMany({ where: { schoolId: { in: ids } } });
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
    await prisma.positionCapabilityGrant.create({ data: { schoolId: current.school.id, positionId: position.id, capability: 'ATTENDANCE_WRITE' } });
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
  it('expires confirmed evidence after two calendar months while retaining its audit handle and source fact', async () => {
    const current = await graph();
    const evidence = await prisma.evidenceReference.create({ data: { schoolId: current.school.id, contentType: 'image/jpeg', blob: new Uint8Array([1]), preview: new Uint8Array([1]), confirmedAt: new Date('2026-01-31T04:00:00.000Z'), confirmedStudentId: current.student.id, confirmedAttendanceOn: date('2026-01-30') } });
    await expect(attendance.cleanupExpiredEvidence(new Date('2026-03-30T04:00:00.000Z'))).resolves.toEqual({ deleted: 0 });
    await expect(attendance.cleanupExpiredEvidence(new Date('2026-03-31T04:00:00.000Z'))).resolves.toEqual({ deleted: 1 });
    await expect(prisma.evidenceReference.findUniqueOrThrow({ where: { id: evidence.id } })).resolves.toMatchObject({ id: evidence.id, blob: null, preview: null, deletionReason: 'RETENTION_EXPIRED' });
    expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: 'EVIDENCE_EXPIRED' } })).toBe(1);
  });
});
