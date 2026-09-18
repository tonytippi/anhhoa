import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AuthorizationService } from '../modules/authorization/authorization.service.js';
import { PrismaService } from '../modules/identity/prisma.service.js';
import { RosterService } from '../modules/roster/roster.service.js';
import { ParentsService } from '../modules/parents/parents.service.js';

const prisma = new PrismaService();
const authorization = new AuthorizationService(prisma);
const roster = new RosterService(prisma, authorization);
const parents = new ParentsService(prisma, authorization);
const schools: string[] = [];
const uuid = () => crypto.randomUUID();
const dates = { startsOn: '2026-01-01', endsOn: '2027-01-01' };

async function school(prefix = 'S') {
  const item = await prisma.school.create({ data: { name: 'Roster', slug: `roster-${uuid()}`, studentCodePrefix: prefix } });
  schools.push(item.id);
  return item;
}

async function actor(schoolId: string, role: 'SCHOOL_ADMIN' | 'FINANCE_MANAGER' = 'SCHOOL_ADMIN') {
  const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const membership = await prisma.schoolMembership.create({ data: { schoolId, userIdentityId: identity.id } });
  await prisma.schoolRoleGrant.create({ data: { schoolId, membershipId: membership.id, role } });
  return identity;
}

async function graph(prefix = 'S') {
  const current = await school(prefix);
  const admin = await actor(current.id);
  const year = await roster.createSchoolYear(admin.id, current.id, uuid(), uuid(), { name: 'Năm 2026', ...dates });
  const classroom = await roster.createClass(admin.id, current.id, (year.outcome as { id: string }).id, uuid(), uuid(), { name: 'Mầm' });
  return { current, admin, year: year.outcome as { id: string }, classroom: classroom.outcome as { id: string } };
}

async function createStudent(input: Awaited<ReturnType<typeof graph>>, overrides: object = {}) {
  return roster.createStudent(input.admin.id, input.current.id, uuid(), uuid(), {
    fullName: 'Bé An', dateOfBirth: '2022-01-01', schoolYearId: input.year.id, classId: input.classroom.id,
    lifecycle: 'ENROLLED', effectiveFrom: '2026-01-01', endedOn: null, ...overrides,
  });
}

afterEach(async () => {
  await prisma.auditRecord.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.operation.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.studentEnrollmentLifecycleTransition.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.staffClassAssignment.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.staffProfile.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.studentParent.deleteMany({ where: { schoolId: { in: schools } } });
  const profiles = await prisma.parentProfile.findMany({ where: { studentParents: { none: {} } }, select: { id: true } });
  await prisma.parentProfile.deleteMany({ where: { id: { in: profiles.map((profile) => profile.id) } } });
  await prisma.studentEnrollment.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.student.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.class.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.schoolYear.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.schoolRoleGrant.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.schoolMembership.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.school.deleteMany({ where: { id: { in: schools.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('roster PostgreSQL invariants', () => {
  it('keeps the existing SchoolYear interval, tenant graph, and Class replay guarantees', async () => {
    const a = await school(); const b = await school(); const admin = await actor(a.id); const other = await actor(b.id);
    const first = await roster.createSchoolYear(admin.id, a.id, uuid(), uuid(), { name: 'A', startsOn: '2026-01-01', endsOn: '2026-06-01' });
    await roster.createSchoolYear(admin.id, a.id, uuid(), uuid(), { name: 'Adjacent', startsOn: '2026-06-01', endsOn: '2027-01-01' });
    await roster.createSchoolYear(other.id, b.id, uuid(), uuid(), { name: 'B', startsOn: '2026-01-01', endsOn: '2026-06-01' });
    await expect(roster.createSchoolYear(admin.id, a.id, uuid(), uuid(), { name: 'Overlap', startsOn: '2026-05-01', endsOn: '2026-07-01' })).rejects.toMatchObject({ status: 409 });
    const key = uuid(); const created = await roster.createClass(admin.id, a.id, (first.outcome as { id: string }).id, key, uuid(), { name: 'Mầm' });
    await expect(roster.createClass(admin.id, a.id, (first.outcome as { id: string }).id, key, uuid(), { name: 'Khác' })).rejects.toMatchObject({ status: 409 });
    expect(await roster.createClass(admin.id, a.id, (first.outcome as { id: string }).id, key, uuid(), { name: 'Mầm' })).toEqual(created);
  });

  it('generates immutable School-scoped codes, persists snapshots, and replays an identical student command', async () => {
    const a = await graph('PE'); const b = await graph('AB');
    const key = uuid(); const first = await roster.createStudent(a.admin.id, a.current.id, key, uuid(), { fullName: 'Bé An', dateOfBirth: '2022-01-01', schoolYearId: a.year.id, classId: a.classroom.id, lifecycle: 'ENROLLED', effectiveFrom: '2026-01-01' });
    const replay = await roster.createStudent(a.admin.id, a.current.id, key, uuid(), { fullName: 'Bé An', dateOfBirth: '2022-01-01', schoolYearId: a.year.id, classId: a.classroom.id, lifecycle: 'ENROLLED', effectiveFrom: '2026-01-01' });
    const second = await createStudent(a, { fullName: 'Bé Bình' }); const other = await createStudent(b);
    expect(first.outcome).toMatchObject({ studentCode: 'PE1', enrollments: [{ schoolYear: { name: 'Năm 2026' }, classroom: { name: 'Mầm' } }] });
    expect(second.outcome).toMatchObject({ studentCode: 'PE2' }); expect(other.outcome).toMatchObject({ studentCode: 'AB1' }); expect(replay).toEqual(first);
    await prisma.class.update({ where: { id: a.classroom.id }, data: { name: 'Đã đổi' } });
    expect((await roster.student(a.admin.id, a.current.id, (first.outcome as { id: string }).id)).enrollments[0]).toMatchObject({ classroom: { name: 'Mầm' } });
    await expect(prisma.student.create({ data: { schoolId: a.current.id, studentCode: 'pe1', fullName: 'Trùng mã', dateOfBirth: new Date('2022-01-01T00:00:00Z') } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects invalid lifecycle, interval, foreign graph, and archived enrollment without a durable write', async () => {
    const current = await graph(); const foreign = await graph(); const before = await prisma.operation.count({ where: { schoolId: current.current.id } });
    await expect(createStudent(current, { lifecycle: 'UNKNOWN' })).rejects.toMatchObject({ status: 400 });
    await expect(createStudent(current, { endedOn: '2026-01-01' })).rejects.toMatchObject({ status: 400 });
    await expect(createStudent(current, { lifecycle: 'WITHDRAWN' })).rejects.toMatchObject({ status: 400 });
    await expect(createStudent(current, { classId: foreign.classroom.id })).rejects.toMatchObject({ status: 404 });
    await roster.archiveClass(current.admin.id, current.current.id, current.classroom.id, uuid(), uuid());
    await expect(createStudent(current)).rejects.toMatchObject({ status: 409 });
    await expect(createStudent(current, { lifecycle: 'TRIAL' })).rejects.toMatchObject({ status: 409 });
    await expect(prisma.student.count({ where: { schoolId: current.current.id } })).resolves.toBe(0);
    await expect(prisma.operation.count({ where: { schoolId: current.current.id } })).resolves.toBe(before + 1);
  });

  it('enforces one enrollment per Student and SchoolYear while retaining stopped lifecycle history', async () => {
    const current = await graph(); const created = await createStudent(current); const student = created.outcome as { id: string; enrollments: [{ id: string }] };
    await roster.changeLifecycle(current.admin.id, current.current.id, student.enrollments[0].id, uuid(), uuid(), { lifecycle: 'WITHDRAWN', endedOn: '2026-06-01' });
    await expect(prisma.studentEnrollment.create({ data: { schoolId: current.current.id, studentId: student.id, schoolYearId: current.year.id, classId: current.classroom.id, lifecycle: 'TRIAL', effectiveFrom: new Date('2026-06-01T00:00:00Z'), schoolYearName: 'Năm 2026', schoolYearStartsOn: new Date('2026-01-01T00:00:00Z'), schoolYearEndsOn: new Date('2027-01-01T00:00:00Z'), className: 'Mầm' } })).rejects.toMatchObject({ code: 'P2002' });
    await roster.changeLifecycle(current.admin.id, current.current.id, student.enrollments[0].id, uuid(), uuid(), { lifecycle: 'ENROLLED' });
    expect((await roster.student(current.admin.id, current.current.id, student.id)).enrollments).toMatchObject([{ lifecycle: 'ENROLLED', endedOn: null, lifecycleHistory: [{ previousLifecycle: null, lifecycle: 'ENROLLED' }, { previousLifecycle: 'ENROLLED', lifecycle: 'WITHDRAWN', endedOn: '2026-06-01' }, { previousLifecycle: 'WITHDRAWN', lifecycle: 'ENROLLED' }] }]);
  });

  it('enforces the selected SchoolYear-Class relationship in PostgreSQL', async () => {
    const current = await graph(); const second = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01' });
    await expect(prisma.studentEnrollment.create({ data: { schoolId: current.current.id, studentId: (await prisma.student.create({ data: { schoolId: current.current.id, studentCode: 'S-direct', fullName: 'Direct', dateOfBirth: new Date('2022-01-01T00:00:00Z') } })).id, schoolYearId: (second.outcome as { id: string }).id, classId: current.classroom.id, lifecycle: 'TRIAL', effectiveFrom: new Date('2027-01-01T00:00:00Z'), schoolYearName: 'Năm 2027', schoolYearStartsOn: new Date('2027-01-01T00:00:00Z'), schoolYearEndsOn: new Date('2028-01-01T00:00:00Z'), className: 'Mầm' } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('blocks active archive, returns archived Class idempotently, and makes its graph read-only', async () => {
    const current = await graph(); const created = await createStudent(current); const enrollment = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0];
    await expect(roster.archiveClass(current.admin.id, current.current.id, current.classroom.id, uuid(), uuid())).rejects.toMatchObject({ status: 409, response: { activeStudentCount: 1 } });
    await roster.changeLifecycle(current.admin.id, current.current.id, enrollment.id, uuid(), uuid(), { lifecycle: 'WITHDRAWN', endedOn: '2026-06-01' });
    const archived = await roster.archiveClass(current.admin.id, current.current.id, current.classroom.id, uuid(), uuid());
    expect(archived.outcome).toMatchObject({ status: 'ARCHIVED', activeStudentCount: 0 });
    expect((await roster.archiveClass(current.admin.id, current.current.id, current.classroom.id, uuid(), uuid())).outcome).toMatchObject({ status: 'ARCHIVED' });
    await expect(roster.renameClass(current.admin.id, current.current.id, current.classroom.id, uuid(), uuid(), { name: 'Không được' })).rejects.toMatchObject({ status: 409 });
    await expect(roster.changeLifecycle(current.admin.id, current.current.id, enrollment.id, uuid(), uuid(), { lifecycle: 'ENROLLED' })).rejects.toMatchObject({ status: 409 });
  });

  it('serializes archive against activation so no ENROLLED enrollment references an archived Class', async () => {
    const current = await graph(); const created = await createStudent(current, { lifecycle: 'TRIAL' }); const enrollment = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0];
    const [archive, activate] = await Promise.allSettled([
      roster.archiveClass(current.admin.id, current.current.id, current.classroom.id, uuid(), uuid()),
      roster.changeLifecycle(current.admin.id, current.current.id, enrollment.id, uuid(), uuid(), { lifecycle: 'ENROLLED' }),
    ]);
    expect([archive, activate].filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const classroom = await prisma.class.findUniqueOrThrow({ where: { id: current.classroom.id } });
    const active = await prisma.studentEnrollment.count({ where: { schoolId: current.current.id, classId: current.classroom.id, lifecycle: 'ENROLLED' } });
    expect(classroom.status === 'ARCHIVED' && active > 0).toBe(false);
  });

  it('serializes archive against new ENROLLED Student creation', async () => {
    const current = await graph();
    const [archive, create] = await Promise.allSettled([roster.archiveClass(current.admin.id, current.current.id, current.classroom.id, uuid(), uuid()), createStudent(current)]);
    expect([archive, create].filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const classroom = await prisma.class.findUniqueOrThrow({ where: { id: current.classroom.id } });
    const active = await prisma.studentEnrollment.count({ where: { schoolId: current.current.id, classId: current.classroom.id, lifecycle: 'ENROLLED', endedOn: null } });
    expect(classroom.status === 'ARCHIVED' && active > 0).toBe(false);
  });

  it('requires the server-active SchoolYear and keeps enrollment dates within its half-open interval', async () => {
    const current = await graph();
    await expect(createStudent(current, { effectiveFrom: '2027-01-01' })).rejects.toMatchObject({ status: 400 });
    await expect(createStudent(current, { lifecycle: 'WITHDRAWN', endedOn: '2027-01-01' })).rejects.toMatchObject({ status: 400 });
    const past = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Cũ', startsOn: '2025-01-01', endsOn: '2026-01-01' });
    const pastClass = await roster.createClass(current.admin.id, current.current.id, (past.outcome as { id: string }).id, uuid(), uuid(), { name: 'Lớp cũ' });
    await expect(createStudent(current, { schoolYearId: (past.outcome as { id: string }).id, classId: (pastClass.outcome as { id: string }).id, effectiveFrom: '2025-06-01' })).rejects.toMatchObject({ status: 409 });
  });

  it('isolates foreign enrollment lifecycle, Class writes, Student reads, audits, and operations', async () => {
    const current = await graph(); const foreign = await graph(); const created = await createStudent(foreign); const enrollmentId = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0].id; const studentId = (created.outcome as { id: string }).id;
    await expect(roster.changeLifecycle(current.admin.id, current.current.id, enrollmentId, uuid(), uuid(), { lifecycle: 'WITHDRAWN', endedOn: '2026-06-01' })).rejects.toMatchObject({ status: 404 });
    await expect(roster.renameClass(current.admin.id, current.current.id, foreign.classroom.id, uuid(), uuid(), { name: 'X' })).rejects.toMatchObject({ status: 404 });
    await expect(roster.archiveClass(current.admin.id, current.current.id, foreign.classroom.id, uuid(), uuid())).rejects.toMatchObject({ status: 404 });
    await expect(roster.student(current.admin.id, current.current.id, studentId)).rejects.toMatchObject({ status: 404 });
    expect(await prisma.auditRecord.count({ where: { schoolId: current.current.id } })).toBeGreaterThan(0);
    expect(await prisma.studentEnrollment.findUnique({ where: { id: enrollmentId } })).toMatchObject({ lifecycle: 'ENROLLED' });
  });

  it('serializes concurrent Student codes and rejects direct invalid lifecycle and interval writes', async () => {
    const current = await graph('CC');
    const created = await Promise.all(Array.from({ length: 5 }, (_, index) => createStudent(current, { fullName: `Bé ${index}` })));
    expect(created.map((item) => (item.outcome as { studentCode: string }).studentCode).sort()).toEqual(['CC1', 'CC2', 'CC3', 'CC4', 'CC5']);
    const student = await prisma.student.create({ data: { schoolId: current.current.id, studentCode: 'CC-direct', fullName: 'Direct', dateOfBirth: new Date('2022-01-01T00:00:00Z') } });
    await expect(prisma.studentEnrollment.create({ data: { schoolId: current.current.id, studentId: student.id, schoolYearId: current.year.id, classId: current.classroom.id, lifecycle: 'ENROLLED', effectiveFrom: new Date('2025-12-31T00:00:00Z'), schoolYearName: 'Năm 2026', schoolYearStartsOn: new Date('2026-01-01T00:00:00Z'), schoolYearEndsOn: new Date('2027-01-01T00:00:00Z'), className: 'Mầm' } })).rejects.toBeTruthy();
    await expect(prisma.studentEnrollment.create({ data: { schoolId: current.current.id, studentId: student.id, schoolYearId: current.year.id, classId: current.classroom.id, lifecycle: 'WITHDRAWN', effectiveFrom: new Date('2026-01-01T00:00:00Z'), schoolYearName: 'Năm 2026', schoolYearStartsOn: new Date('2026-01-01T00:00:00Z'), schoolYearEndsOn: new Date('2027-01-01T00:00:00Z'), className: 'Mầm' } })).rejects.toBeTruthy();
  });

  it('persists normalized pending links, retains revoke history, and isolates foreign StudentParent IDs', async () => {
    const current = await graph(); const foreign = await graph(); const created = await createStudent(current); const other = await createStudent(foreign); const studentId = (created.outcome as { id: string }).id; const otherStudentId = (other.outcome as { id: string }).id;
    const key = uuid(); const linked = await parents.create(current.admin.id, current.current.id, studentId, key, uuid(), { fullName: 'Mai Trần', email: ' MAI@Example.com ', phone: '0900000000' });
    const replay = await parents.create(current.admin.id, current.current.id, studentId, key, uuid(), { fullName: 'Mai Trần', email: ' MAI@Example.com ', phone: '0900000000' });
    expect(linked).toEqual(replay); expect(linked.outcome).toMatchObject({ status: 'ACTIVE', parent: { email: 'mai@example.com', bound: false } });
    expect(await prisma.userIdentity.count({ where: { emailNormalized: 'mai@example.com' } })).toBe(0);
    const profile = await prisma.parentProfile.findUniqueOrThrow({ where: { emailNormalized: 'mai@example.com' } }); const linkId = (linked.outcome as { id: string }).id;
    const foreignLink = await parents.create(foreign.admin.id, foreign.current.id, otherStudentId, uuid(), uuid(), { fullName: 'Mai Trần', email: 'mai@example.com', phone: '0900000000' });
    await expect(parents.revoke(current.admin.id, current.current.id, (foreignLink.outcome as { id: string }).id, uuid(), uuid())).rejects.toMatchObject({ status: 404 });
    await parents.revoke(current.admin.id, current.current.id, linkId, uuid(), uuid());
    expect(await prisma.studentParent.findUniqueOrThrow({ where: { id: linkId } })).toMatchObject({ status: 'REVOKED', revokedAt: expect.any(Date), parentProfileId: profile.id });
    const reactivated = await parents.create(current.admin.id, current.current.id, studentId, uuid(), uuid(), { fullName: 'Mai Trần', email: 'mai@example.com', phone: '0900000000' });
    expect(reactivated.outcome).toMatchObject({ id: linkId, status: 'ACTIVE' });
    expect(await prisma.auditRecord.count({ where: { schoolId: current.current.id, action: { in: ['STUDENT_PARENT_CREATED', 'STUDENT_PARENT_REVOKED', 'STUDENT_PARENT_REACTIVATED'] } } })).toBe(3);
  });

  it('persists only Staff profile fields and retains School-scoped assignment history with audit and replay', async () => {
    const current = await graph();
    const profile = { fullName: 'Cô Mai', email: ' MAI@Example.com ', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội' };
    const key = uuid(); const created = await roster.createStaff(current.admin.id, current.current.id, key, uuid(), profile);
    expect(await roster.createStaff(current.admin.id, current.current.id, key, uuid(), profile)).toEqual(created);
    expect(created.outcome).toMatchObject({ fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội' });
    expect(await prisma.userIdentity.count({ where: { emailNormalized: 'mai@example.com' } })).toBe(0);
    const staffId = (created.outcome as { id: string }).id;
    const assignment = await roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-01-01', reason: 'Phân công đầu năm' });
    const assignmentId = (assignment.outcome as { id: string }).id;
    await roster.endAssignment(current.admin.id, current.current.id, assignmentId, uuid(), uuid(), { effectiveTo: '2026-06-01', reason: 'Điều chuyển' });
    await prisma.class.update({ where: { id: current.classroom.id }, data: { name: 'Tên lớp mới' } });
    expect(await roster.assignments(current.admin.id, current.current.id, current.year.id)).toMatchObject([{ id: assignmentId, effectiveTo: '2026-06-01', reason: 'Phân công đầu năm', endReason: 'Điều chuyển', schoolYear: { name: 'Năm 2026' }, classroom: { name: 'Mầm' }, access: { status: 'NOT_PROVIDED' } }]);
    expect(await prisma.auditRecord.count({ where: { schoolId: current.current.id, action: { in: ['STAFF_PROFILE_CREATED', 'STAFF_CLASS_ASSIGNED', 'STAFF_CLASS_ASSIGNMENT_ENDED'] } } })).toBe(3);
  });

  it('enforces Staff assignment tenant graph and half-open overlap while allowing adjacent and distinct Class intervals', async () => {
    const current = await graph(); const foreign = await graph();
    const second = await roster.createClass(current.admin.id, current.current.id, current.year.id, uuid(), uuid(), { name: 'Chồi' });
    const created = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội' });
    const staffId = (created.outcome as { id: string }).id;
    const input = { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-01-01', effectiveTo: '2026-06-01', reason: 'Đầu năm' };
    await roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), input);
    await roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), { ...input, effectiveFrom: '2026-06-01', effectiveTo: null, reason: 'Tiếp nối' });
    await roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), { ...input, classId: (second.outcome as { id: string }).id, effectiveFrom: '2026-03-01', effectiveTo: null, reason: 'Kiêm nhiệm' });
    await expect(roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), { ...input, effectiveFrom: '2026-05-01', reason: 'Chồng lấn' })).rejects.toMatchObject({ status: 409, response: { code: 'STAFF_CLASS_ASSIGNMENT_OVERLAP' } });
    await expect(roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), { ...input, classId: foreign.classroom.id, reason: 'Lớp ngoại trường' })).rejects.toMatchObject({ status: 404 });
    await expect(roster.archiveClass(current.admin.id, current.current.id, (second.outcome as { id: string }).id, uuid(), uuid())).rejects.toMatchObject({ status: 409, response: { code: 'CLASS_HAS_OPEN_STAFF_ASSIGNMENTS', openStaffAssignmentCount: 1 } });
    const secondAssignment = await prisma.staffClassAssignment.findFirstOrThrow({ where: { schoolId: current.current.id, classId: (second.outcome as { id: string }).id } });
    await roster.endAssignment(current.admin.id, current.current.id, secondAssignment.id, uuid(), uuid(), { effectiveTo: '2026-06-01', reason: 'Kết thúc kiêm nhiệm' });
    await roster.archiveClass(current.admin.id, current.current.id, (second.outcome as { id: string }).id, uuid(), uuid());
    await expect(roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), { ...input, classId: (second.outcome as { id: string }).id, reason: 'Lớp lưu trữ' })).rejects.toMatchObject({ status: 409 });
    expect(await prisma.staffClassAssignment.count({ where: { schoolId: current.current.id } })).toBe(3);
  });

  it('keeps ended assignments read-only with a separate end reason and validates stable UUIDs', async () => {
    const current = await graph();
    const created = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội' });
    const staffId = (created.outcome as { id: string }).id;
    await expect(roster.updateStaff(current.admin.id, current.current.id, 'not-a-uuid', uuid(), uuid(), {})).rejects.toMatchObject({ status: 404, response: { code: 'STAFF_NOT_FOUND' } });
    await expect(roster.createAssignment(current.admin.id, current.current.id, 'not-a-uuid', uuid(), uuid(), {})).rejects.toMatchObject({ status: 404, response: { code: 'STAFF_NOT_FOUND' } });
    const assignment = await roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-01-01', reason: 'Lý do gốc' });
    const assignmentId = (assignment.outcome as { id: string }).id;
    await roster.endAssignment(current.admin.id, current.current.id, assignmentId, uuid(), uuid(), { effectiveTo: '2026-06-01', reason: 'Lý do kết thúc' });
    await expect(roster.changeAssignment(current.admin.id, current.current.id, assignmentId, uuid(), uuid(), { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-01-01', reason: 'Không được sửa' })).rejects.toMatchObject({ status: 409, response: { code: 'STAFF_ASSIGNMENT_ENDED' } });
    await expect(roster.changeAssignment(current.admin.id, current.current.id, 'not-a-uuid', uuid(), uuid(), {})).rejects.toMatchObject({ status: 404, response: { code: 'STAFF_ASSIGNMENT_NOT_FOUND' } });
    expect(await roster.assignments(current.admin.id, current.current.id, current.year.id)).toMatchObject([{ id: assignmentId, reason: 'Lý do gốc', endReason: 'Lý do kết thúc', effectiveTo: '2026-06-01', staff: { fullName: 'Cô Mai' } }]);
  });

  it('persists Staff updates with a separate audit record', async () => {
    const current = await graph();
    const created = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội' });
    const staffId = (created.outcome as { id: string }).id;
    const updated = await roster.updateStaff(current.admin.id, current.current.id, staffId, uuid(), uuid(), { fullName: 'Cô Mai mới', email: 'MOI@example.com', phone: '0900000001', dateOfBirth: '1991-01-01', gender: 'Khác', address: 'Đà Nẵng' });
    expect(updated.outcome).toMatchObject({ id: staffId, fullName: 'Cô Mai mới', email: 'moi@example.com', phone: '0900000001', dateOfBirth: '1991-01-01', gender: 'Khác', address: 'Đà Nẵng' });
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.current.id, action: 'STAFF_PROFILE_UPDATED' } })).toMatchObject({ provenance: { staffProfileId: staffId } });
  });

  it('validates every open assignment change before writing', async () => {
    const current = await graph(); const foreign = await graph();
    const otherYear = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01' });
    const staff = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội' });
    const staffId = (staff.outcome as { id: string }).id;
    const first = await roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-01-01', effectiveTo: '2026-03-01', reason: 'Đợt một' });
    const second = await roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-03-01', reason: 'Đợt hai' });
    const assignmentId = (second.outcome as { id: string }).id;
    const base = { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-02-01', reason: 'Sửa' };
    await expect(roster.changeAssignment(current.admin.id, current.current.id, assignmentId, uuid(), uuid(), base)).rejects.toMatchObject({ status: 409, response: { code: 'STAFF_CLASS_ASSIGNMENT_OVERLAP' } });
    await expect(roster.changeAssignment(current.admin.id, current.current.id, assignmentId, uuid(), uuid(), { ...base, effectiveFrom: '2027-01-01' })).rejects.toMatchObject({ status: 400 });
    await expect(roster.changeAssignment(current.admin.id, current.current.id, assignmentId, uuid(), uuid(), { ...base, schoolYearId: (otherYear.outcome as { id: string }).id, effectiveFrom: '2027-01-01' })).rejects.toMatchObject({ status: 404, response: { code: 'CLASS_NOT_FOUND' } });
    await expect(roster.changeAssignment(current.admin.id, current.current.id, assignmentId, uuid(), uuid(), { ...base, effectiveTo: '2026-04-01' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { effectiveTo: expect.any(String) } } });
    await prisma.class.update({ where: { id: current.classroom.id }, data: { status: 'ARCHIVED' } });
    await expect(roster.changeAssignment(current.admin.id, current.current.id, assignmentId, uuid(), uuid(), { ...base, effectiveFrom: '2026-03-01' })).rejects.toMatchObject({ status: 409, response: { code: 'CLASS_ARCHIVED' } });
    const foreignStaff = await roster.createStaff(foreign.admin.id, foreign.current.id, uuid(), uuid(), { fullName: 'Cô Ngoại', email: 'ngoai@example.com', phone: '0900000002', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Huế' });
    const foreignAssignment = await roster.createAssignment(foreign.admin.id, foreign.current.id, (foreignStaff.outcome as { id: string }).id, uuid(), uuid(), { schoolYearId: foreign.year.id, classId: foreign.classroom.id, effectiveFrom: '2026-01-01', reason: 'Ngoại trường' });
    await expect(roster.changeAssignment(current.admin.id, current.current.id, (foreignAssignment.outcome as { id: string }).id, uuid(), uuid(), base)).rejects.toMatchObject({ status: 404 });
    await expect(roster.endAssignment(current.admin.id, current.current.id, (foreignAssignment.outcome as { id: string }).id, uuid(), uuid(), { effectiveTo: '2026-06-01', reason: 'Không được' })).rejects.toMatchObject({ status: 404 });
    expect((first.outcome as { id: string }).id).toBeTruthy();
  });

  it('lets exactly one concurrent overlapping assignment succeed and returns the stable conflict to the loser', async () => {
    const current = await graph();
    const staff = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội' });
    const staffId = (staff.outcome as { id: string }).id;
    const input = { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-01-01', reason: 'Phân công đồng thời' };
    const results = await Promise.allSettled([roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), input), roster.createAssignment(current.admin.id, current.current.id, staffId, uuid(), uuid(), input)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((item): item is PromiseRejectedResult => item.status === 'rejected')!;
    expect(rejected.reason).toMatchObject({ status: 409, response: { code: 'STAFF_CLASS_ASSIGNMENT_OVERLAP' } });
    expect(await prisma.staffClassAssignment.count({ where: { schoolId: current.current.id } })).toBe(1);
  });

  it('rejects direct Staff assignment composite graph violations and retains closed-year history', async () => {
    const current = await graph(); const foreign = await graph();
    const staff = await prisma.staffProfile.create({ data: { schoolId: current.current.id, fullName: 'Direct', email: 'direct@example.com', phone: '0900000000', dateOfBirth: new Date('1990-01-01T00:00:00Z'), gender: 'Nữ', address: 'Hà Nội' } });
    const data = { schoolId: current.current.id, staffProfileId: staff.id, schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: new Date('2026-01-01T00:00:00Z'), reason: 'Direct', schoolYearName: 'Năm 2026', schoolYearStartsOn: new Date('2026-01-01T00:00:00Z'), schoolYearEndsOn: new Date('2027-01-01T00:00:00Z'), className: 'Mầm' };
    await expect(prisma.staffClassAssignment.create({ data: { ...data, staffProfileId: (await prisma.staffProfile.create({ data: { schoolId: foreign.current.id, fullName: 'Foreign', email: 'foreign@example.com', phone: '0900000001', dateOfBirth: new Date('1990-01-01T00:00:00Z'), gender: 'Nữ', address: 'Huế' } })).id } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.staffClassAssignment.create({ data: { ...data, classId: foreign.classroom.id } })).rejects.toMatchObject({ code: 'P2003' });
    const otherYear = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01' });
    await expect(prisma.staffClassAssignment.create({ data: { ...data, schoolYearId: (otherYear.outcome as { id: string }).id } })).rejects.toMatchObject({ code: 'P2003' });
    const past = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Năm 2025', startsOn: '2025-01-01', endsOn: '2026-01-01' });
    const pastClass = await roster.createClass(current.admin.id, current.current.id, (past.outcome as { id: string }).id, uuid(), uuid(), { name: 'Lớp cũ' });
    await roster.createAssignment(current.admin.id, current.current.id, staff.id, uuid(), uuid(), { schoolYearId: (past.outcome as { id: string }).id, classId: (pastClass.outcome as { id: string }).id, effectiveFrom: '2025-01-01', effectiveTo: '2025-06-01', reason: 'Lịch sử' });
    expect(await roster.assignments(current.admin.id, current.current.id, (past.outcome as { id: string }).id)).toMatchObject([{ schoolYear: { name: 'Năm 2025' }, classroom: { name: 'Lớp cũ' }, effectiveTo: '2025-06-01' }]);
  });
});
