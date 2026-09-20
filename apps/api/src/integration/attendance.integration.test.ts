import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../modules/identity/prisma.service.js';

const prisma = new PrismaService();
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
  await prisma.studentEnrollment.create({ data: { schoolId: school.id, studentId: student.id, schoolYearId: year.id, classId: classroom.id, lifecycle: 'ENROLLED', effectiveFrom: date('2026-01-01'), schoolYearName: year.name, schoolYearStartsOn: year.startsOn, schoolYearEndsOn: year.endsOn, className: classroom.name } });
  const parent = await prisma.parentProfile.create({ data: { emailNormalized: `${uuid()}@example.com`, fullName: 'Phụ huynh', phone: '0900000000' } });
  parentProfiles.push(parent.id);
  await prisma.studentParent.create({ data: { schoolId: school.id, studentId: student.id, parentProfileId: parent.id } });
  await prisma.schoolCalendarVersion.create({ data: { schoolId: school.id, effectiveFrom: date('2026-01-01'), actorIdentityId: identity.id, membershipId: membership.id } });
  return { school, identity, membership, student, parent };
}

async function request(input: Awaited<ReturnType<typeof graph>>) {
  return prisma.leaveRequest.create({ data: { schoolId: input.school.id, studentId: input.student.id, parentProfileId: input.parent.id, status: 'PENDING', policyEffectiveFrom: date('2026-01-01'), policyDeadlineLocalTime: '08:00' } });
}

afterEach(async () => {
  const ids = schools.splice(0);
  if (ids.length) await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.leaveRequestDay.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.leaveRequest.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.leavePolicy.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolCalendarVersion.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.studentParent.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.studentEnrollment.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.student.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.class.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolYear.deleteMany({ where: { schoolId: { in: ids } } });
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
});
