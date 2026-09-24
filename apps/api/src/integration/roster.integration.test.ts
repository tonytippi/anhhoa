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
  const position = await prisma.schoolPosition.create({ data: { schoolId, code: `TEST_${uuid().replaceAll('-', '').slice(0, 12)}`, name: `Test ${role} ${uuid()}` } });
  await prisma.positionCapabilityGrant.createMany({ data: (role === 'SCHOOL_ADMIN' ? ['SCHOOL_CONTEXT_READ', 'ACCESS_MANAGE', 'ROSTER_MANAGE', 'SETTINGS_MANAGE', 'CLASS_LEAVE_READ'] : ['SCHOOL_CONTEXT_READ', 'SETTINGS_MANAGE']).map((capability) => ({ schoolId, positionId: position.id, capability })) });
  await prisma.staffProfile.create({ data: { schoolId, fullName: 'Test actor', email: identity.emailNormalized, phone: '0900000000', dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), gender: 'Khác', address: 'Test', primaryPositionId: position.id, schoolMembershipId: membership.id, boundAt: new Date(), boundByMembershipId: membership.id } });
  return identity;
}

async function graph(prefix = 'S') {
  const current = await school(prefix);
  const admin = await actor(current.id);
  const position = await prisma.schoolPosition.findFirstOrThrow({ where: { schoolId: current.id, status: 'ACTIVE', grants: { some: { capability: 'CLASS_LEAVE_READ' } } } });
  const year = await roster.createSchoolYear(admin.id, current.id, uuid(), uuid(), { name: 'Năm 2026', ...dates });
  const classroom = await roster.createClass(admin.id, current.id, (year.outcome as { id: string }).id, uuid(), uuid(), { name: 'Mầm' });
  return { current, admin, position, year: year.outcome as { id: string }, classroom: classroom.outcome as { id: string } };
}

async function createStudent(input: Awaited<ReturnType<typeof graph>>, overrides: object = {}) {
  return roster.createStudent(input.admin.id, input.current.id, uuid(), uuid(), {
    fullName: 'Bé An', dateOfBirth: '2022-01-01', schoolYearId: input.year.id, classId: input.classroom.id,
    effectiveFrom: '2026-01-01', endedOn: null, intakeStatus: 'PLACED', ...overrides,
  });
}

afterEach(async () => {
  await prisma.auditRecord.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.schoolYear.updateMany({ where: { schoolId: { in: schools } }, data: { closeOperationId: null } });
  await prisma.operation.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.studentEnrollmentLifecycleTransition.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.enrollmentClassAssignment.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.staffClassAssignment.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.staffPhoto.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.staffCodeRegistry.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.staffProfile.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.schoolPosition.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.studentParent.deleteMany({ where: { schoolId: { in: schools } } });
  const profiles = await prisma.parentProfile.findMany({ where: { studentParents: { none: {} } }, select: { id: true } });
  await prisma.parentProfile.deleteMany({ where: { id: { in: profiles.map((profile) => profile.id) } } });
  await prisma.studentPhoto.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.studentEnrollment.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.student.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.class.deleteMany({ where: { schoolId: { in: schools } } });
  await prisma.schoolYear.deleteMany({ where: { schoolId: { in: schools } } });
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

  it('re-authorizes replay and reconciliation reads and scopes an Operation to its actor', async () => {
    const current = await graph(); const other = await actor(current.current.id);
    const key = uuid(); const created = await roster.createSchoolYear(current.admin.id, current.current.id, key, uuid(), { name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01' });
    await expect(roster.operation(current.admin.id, current.current.id, created.id)).resolves.toMatchObject({ id: created.id, status: 'COMPLETED' });
    await expect(roster.operation(other.id, current.current.id, created.id)).rejects.toMatchObject({ status: 404 });
    const membership = await prisma.schoolMembership.findFirstOrThrow({ where: { schoolId: current.current.id, userIdentityId: current.admin.id } });
    await prisma.schoolMembership.update({ where: { id: membership.id }, data: { status: 'REVOKED' } });
    await expect(roster.createSchoolYear(current.admin.id, current.current.id, key, uuid(), { name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01' })).rejects.toMatchObject({ status: 404 });
    await expect(roster.operation(current.admin.id, current.current.id, created.id)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses to remove the last active bound roster manager but permits replacement coverage', async () => {
    const current = await graph();
    const manager = await prisma.schoolPosition.findFirstOrThrow({ where: { schoolId: current.current.id, grants: { some: { capability: 'ROSTER_MANAGE' } } } });
    await expect(roster.revokePositionCapability(current.admin.id, current.current.id, manager.id, 'ROSTER_MANAGE', uuid(), uuid(), { reason: 'Sai' })).rejects.toMatchObject({ status: 409, response: { code: 'LAST_ROSTER_MANAGER' } });
    await expect(roster.inactivatePosition(current.admin.id, current.current.id, manager.id, uuid(), uuid(), { reason: 'Sai' })).rejects.toMatchObject({ status: 409, response: { code: 'LAST_ROSTER_MANAGER' } });
    await actor(current.current.id);
    await expect(roster.revokePositionCapability(current.admin.id, current.current.id, manager.id, 'ROSTER_MANAGE', uuid(), uuid(), { reason: 'Bàn giao' })).resolves.toMatchObject({ status: 'COMPLETED' });
  });

  it('generates immutable School-scoped codes, persists snapshots, and replays an identical student command', async () => {
    const a = await graph('PE'); const b = await graph('AB');
    const key = uuid(); const first = await roster.createStudent(a.admin.id, a.current.id, key, uuid(), { fullName: 'Bé An', dateOfBirth: '2022-01-01', schoolYearId: a.year.id, classId: a.classroom.id, intakeStatus: 'PLACED', effectiveFrom: '2026-01-01' });
    const replay = await roster.createStudent(a.admin.id, a.current.id, key, uuid(), { fullName: 'Bé An', dateOfBirth: '2022-01-01', schoolYearId: a.year.id, classId: a.classroom.id, intakeStatus: 'PLACED', effectiveFrom: '2026-01-01' });
    const second = await createStudent(a, { fullName: 'Bé Bình' }); const other = await createStudent(b);
    expect(first.outcome).toMatchObject({ studentCode: 'PE1', enrollments: [{ schoolYear: { name: 'Năm 2026' }, classroom: { name: 'Mầm' } }] });
    expect(second.outcome).toMatchObject({ studentCode: 'PE2' }); expect(other.outcome).toMatchObject({ studentCode: 'AB1' }); expect(replay).toEqual(first);
    await prisma.class.update({ where: { id: a.classroom.id }, data: { name: 'Đã đổi' } });
    expect((await roster.student(a.admin.id, a.current.id, (first.outcome as { id: string }).id)).enrollments[0]).toMatchObject({ classroom: { name: 'Mầm' } });
    await expect(prisma.student.create({ data: { schoolId: a.current.id, studentCode: 'pe1', fullName: 'Trùng mã', dateOfBirth: new Date('2022-01-01T00:00:00Z') } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('returns bounded paged roster rows with scoped filters, stable sort, and minimum parent summary', async () => {
    const current = await graph(); const foreign = await graph();
    const students = await Promise.all(Array.from({ length: 127 }, (_, index) => prisma.student.create({ data: { schoolId: current.current.id, studentCode: `PAGE-${index}`, fullName: `Bé ${String(127 - index).padStart(3, '0')}`, dateOfBirth: new Date('2022-01-01T00:00:00.000Z') } })));
    await prisma.studentEnrollment.createMany({ data: students.map((student) => ({ schoolId: current.current.id, studentId: student.id, schoolYearId: current.year.id, classId: current.classroom.id, lifecycle: 'ENROLLED', effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), schoolYearName: 'Năm 2026', schoolYearStartsOn: new Date('2026-01-01T00:00:00.000Z'), schoolYearEndsOn: new Date('2027-01-01T00:00:00.000Z'), className: 'Mầm' })) });
    const firstId = (await roster.students(current.admin.id, current.current.id, current.year.id, { page: '1', pageSize: '25', sort: 'name' })).data[0]!.id;
    await parents.create(current.admin.id, current.current.id, firstId, uuid(), uuid(), { fullName: 'Mai Trần', email: 'mai.roster@example.com', phone: '0900000000', relationshipLabel: 'Mẹ' });
    await parents.create(current.admin.id, current.current.id, firstId, uuid(), uuid(), { fullName: 'Ông Trần', email: 'ong.roster@example.com', phone: '0900000001', relationshipLabel: 'Ông' });
    await parents.create(current.admin.id, current.current.id, firstId, uuid(), uuid(), { fullName: 'Mai Lê', email: 'mai.le.roster@example.com', phone: '0900000002', relationshipLabel: 'Mẹ' });
    const first = await roster.students(current.admin.id, current.current.id, current.year.id, { page: '1', pageSize: '1000', sort: 'name' });
    expect(first.data).toHaveLength(100); expect(first.meta).toEqual({ page: 1, pageSize: 100, totalItems: 127, totalPages: 2 });
    expect(first.data[0]).toMatchObject({ relatives: { mother: 'Mai Trần', father: null, otherRelativeCount: 2 } });
    expect(first.data[0]).not.toHaveProperty('email'); expect(first.data[0]?.relatives).not.toHaveProperty('email'); expect(first.data[0]?.relatives).not.toHaveProperty('phone');
    expect((await roster.students(current.admin.id, current.current.id, current.year.id, { q: 'Bé 001', lifecycle: 'ENROLLED', sort: 'class' })).data).toMatchObject([{ fullName: 'Bé 001' }]);
    await expect(roster.students(current.admin.id, current.current.id, current.year.id, { classId: foreign.classroom.id })).rejects.toMatchObject({ status: 404, response: { code: 'CLASS_NOT_FOUND' } });
    await expect(roster.students(current.admin.id, current.current.id, current.year.id, { page: 'bad' })).rejects.toMatchObject({ status: 400 });
  });

  it('creates a classless waiting enrollment and permits its non-placement lifecycle changes', async () => {
    const current = await graph();
    const created = await createStudent(current, { classId: null, intakeStatus: 'WAITING_FOR_CLASS' });
    const student = created.outcome as { id: string; enrollments: [{ id: string; lifecycle: string; classId: string | null; classroom: unknown; classAssignmentHistory: unknown[] }] };
    expect(student.enrollments).toMatchObject([{ lifecycle: 'WAITING_FOR_CLASS', classId: null, classroom: null, classAssignmentHistory: [] }]);
    await roster.changeLifecycle(current.admin.id, current.current.id, student.enrollments[0].id, uuid(), uuid(), { lifecycle: 'ON_LEAVE', endedOn: '2026-06-01' });
    await expect(roster.changeLifecycle(current.admin.id, current.current.id, student.enrollments[0].id, uuid(), uuid(), { lifecycle: 'ENROLLED' })).rejects.toMatchObject({ status: 409, response: { code: 'ENROLLMENT_CLASS_REQUIRED' } });
    expect(await prisma.enrollmentClassAssignment.count({ where: { schoolId: current.current.id, enrollmentId: student.enrollments[0].id } })).toBe(0);
  });

  it('places a waiting enrollment atomically with snapshot, history, audit, and idempotent replay', async () => {
    const current = await graph();
    const created = await createStudent(current, { classId: null, intakeStatus: 'WAITING_FOR_CLASS' });
    const enrollmentId = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0].id;
    const key = uuid();
    const placed = await roster.placeWaitingEnrollment(current.admin.id, current.current.id, enrollmentId, key, uuid(), { classId: current.classroom.id, effectiveFrom: '2026-02-01' });
    expect(await roster.placeWaitingEnrollment(current.admin.id, current.current.id, enrollmentId, key, uuid(), { classId: current.classroom.id, effectiveFrom: '2026-02-01' })).toEqual(placed);
    expect(placed.outcome).toMatchObject({ lifecycle: 'ENROLLED', classroom: { name: 'Mầm' }, classAssignmentHistory: [{ effectiveFrom: '2026-02-01', reason: 'Xếp lớp sau intake' }] });
    expect(await prisma.auditRecord.findFirst({ where: { schoolId: current.current.id, action: 'STUDENT_ENROLLMENT_PLACED' } })).toBeTruthy();
    await expect(roster.placeWaitingEnrollment(current.admin.id, current.current.id, enrollmentId, uuid(), uuid(), { classId: current.classroom.id, effectiveFrom: '2026-02-01' })).rejects.toMatchObject({ status: 409, response: { code: 'ENROLLMENT_NOT_WAITING_FOR_CLASS' } });
  });

  it('validates photo signatures, fingerprints photo content, and exposes only photo existence in Student DTOs', async () => {
    const current = await graph();
    const created = await createStudent(current); const studentId = (created.outcome as { id: string }).id;
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    await expect(roster.uploadStudentPhoto(current.admin.id, current.current.id, studentId, uuid(), uuid(), 'image/png', Buffer.from('not a png'))).rejects.toMatchObject({ status: 400 });
    const key = uuid();
    await roster.uploadStudentPhoto(current.admin.id, current.current.id, studentId, key, uuid(), 'image/png', png);
    await expect(roster.uploadStudentPhoto(current.admin.id, current.current.id, studentId, key, uuid(), 'image/png', Buffer.from([...png, 0x01]))).rejects.toMatchObject({ status: 409, response: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(await roster.student(current.admin.id, current.current.id, studentId)).toMatchObject({ hasPhoto: true });
    const photo = await roster.studentPhoto(current.admin.id, current.current.id, studentId);
    expect(photo.contentType).toBe('image/png');
    expect(Buffer.from(photo.blob)).toEqual(png);
  });

  it('rejects invalid lifecycle, interval, foreign graph, and archived enrollment without a durable write', async () => {
    const current = await graph(); const foreign = await graph(); const before = await prisma.operation.count({ where: { schoolId: current.current.id } });
    await expect(createStudent(current, { intakeStatus: 'UNKNOWN' })).rejects.toMatchObject({ status: 400 });
    await expect(createStudent(current, { endedOn: '2026-01-01' })).rejects.toMatchObject({ status: 400 });
    await expect(createStudent(current, { lifecycle: 'WITHDRAWN' })).rejects.toMatchObject({ status: 400 });
    await expect(createStudent(current, { classId: foreign.classroom.id })).rejects.toMatchObject({ status: 404 });
    await roster.archiveClass(current.admin.id, current.current.id, current.classroom.id, uuid(), uuid());
    await expect(createStudent(current)).rejects.toMatchObject({ status: 409 });
    await expect(createStudent(current)).rejects.toMatchObject({ status: 409 });
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
    const current = await graph(); const created = await createStudent(current); const enrollment = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0];
    await roster.changeLifecycle(current.admin.id, current.current.id, enrollment.id, uuid(), uuid(), { lifecycle: 'TRIAL' });
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
    const key = uuid(); const linked = await parents.create(current.admin.id, current.current.id, studentId, key, uuid(), { fullName: 'Mai Trần', email: ' MAI@Example.com ', phone: '0900000000', relationshipLabel: ' Mẹ ' });
    const replay = await parents.create(current.admin.id, current.current.id, studentId, key, uuid(), { fullName: 'Mai Trần', email: ' MAI@Example.com ', phone: '0900000000', relationshipLabel: ' Mẹ ' });
    expect(linked).toEqual(replay); expect(linked.outcome).toMatchObject({ status: 'ACTIVE', relationshipLabel: 'Mẹ', parent: { email: 'mai@example.com', bound: false } });
    await expect(parents.create(current.admin.id, current.current.id, studentId, key, uuid(), { fullName: 'Mai Trần', email: ' MAI@Example.com ', phone: '0900000000', relationshipLabel: 'Bố' })).rejects.toMatchObject({ status: 409, response: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(await prisma.userIdentity.count({ where: { emailNormalized: 'mai@example.com' } })).toBe(0);
    const profile = await prisma.parentProfile.findUniqueOrThrow({ where: { emailNormalized: 'mai@example.com' } }); const linkId = (linked.outcome as { id: string }).id;
    const foreignLink = await parents.create(foreign.admin.id, foreign.current.id, otherStudentId, uuid(), uuid(), { fullName: 'Mai Trần', email: 'mai@example.com', phone: '0900000000', relationshipLabel: 'Mẹ' });
    await expect(parents.revoke(current.admin.id, current.current.id, (foreignLink.outcome as { id: string }).id, uuid(), uuid())).rejects.toMatchObject({ status: 404 });
    await parents.revoke(current.admin.id, current.current.id, linkId, uuid(), uuid());
    expect(await prisma.studentParent.findUniqueOrThrow({ where: { id: linkId } })).toMatchObject({ status: 'REVOKED', revokedAt: expect.any(Date), parentProfileId: profile.id });
    const reactivated = await parents.create(current.admin.id, current.current.id, studentId, uuid(), uuid(), { fullName: 'Mai Trần', email: 'mai@example.com', phone: '0900000000', relationshipLabel: 'Bố' });
    expect(reactivated.outcome).toMatchObject({ id: linkId, status: 'ACTIVE', relationshipLabel: 'Bố' });
    expect(await prisma.auditRecord.count({ where: { schoolId: current.current.id, action: { in: ['STUDENT_PARENT_CREATED', 'STUDENT_PARENT_REVOKED', 'STUDENT_PARENT_REACTIVATED'] } } })).toBe(3);
  });

  it('requires a trimmed relationship label and retains it in link detail and audit', async () => {
    const current = await graph(); const created = await createStudent(current); const studentId = (created.outcome as { id: string }).id;
    await expect(parents.create(current.admin.id, current.current.id, studentId, uuid(), uuid(), { fullName: 'Bà Trần', email: 'ba@example.com', phone: '0900000000', relationshipLabel: '   ' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { relationshipLabel: expect.any(String) } } });
    const link = await parents.create(current.admin.id, current.current.id, studentId, uuid(), uuid(), { fullName: 'Bà Trần', email: 'ba@example.com', phone: '0900000000', relationshipLabel: ' Bà ngoại ' });
    expect(await parents.links(current.admin.id, current.current.id, studentId)).toMatchObject([{ id: (link.outcome as { id: string }).id, relationshipLabel: 'Bà ngoại' }]);
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.current.id, action: 'STUDENT_PARENT_CREATED' } })).toMatchObject({ provenance: { relationshipLabel: 'Bà ngoại' } });
  });

  it('creates a school contact without email', async () => {
    const current = await graph(); const created = await createStudent(current); const studentId = (created.outcome as { id: string }).id;
    const link = await parents.create(current.admin.id, current.current.id, studentId, uuid(), uuid(), { fullName: 'Nguyễn Thị Liên', phone: '0900000003', relationshipLabel: 'Mẹ' });
    expect(link.outcome).toMatchObject({ status: 'ACTIVE', relationshipLabel: 'Mẹ', parent: { fullName: 'Nguyễn Thị Liên', email: null, phone: '0900000003', bound: false } });
    const replay = await parents.create(current.admin.id, current.current.id, studentId, uuid(), uuid(), { fullName: 'Nguyễn Thị Liên', phone: '0900000003', relationshipLabel: 'Bố' });
    expect(replay.outcome).toMatchObject({ id: (link.outcome as { id: string }).id, relationshipLabel: 'Bố' });
    expect(await prisma.studentParent.count({ where: { schoolId: current.current.id, studentId } })).toBe(1);
  });

  it('returns a tenant and SchoolYear-scoped parent-first page with active child links only', async () => {
    const current = await graph(); const foreign = await graph();
    const first = await createStudent(current, { fullName: 'Bé An' });
    const second = await createStudent(current, { fullName: 'Bé Bình' });
    const foreignStudent = await createStudent(foreign, { fullName: 'Bé Ngoại' });
    const firstId = (first.outcome as { id: string }).id;
    const secondId = (second.outcome as { id: string }).id;
    const parent = await parents.create(current.admin.id, current.current.id, firstId, uuid(), uuid(), { fullName: 'Mai Trần', phone: '0900000000', relationshipLabel: 'Mẹ' });
    const profileId = (await prisma.studentParent.findUniqueOrThrow({ where: { id: (parent.outcome as { id: string }).id } })).parentProfileId;
    await prisma.studentParent.create({ data: { schoolId: current.current.id, studentId: secondId, parentProfileId: profileId, relationshipLabel: 'Mẹ' } });
    await parents.create(foreign.admin.id, foreign.current.id, (foreignStudent.outcome as { id: string }).id, uuid(), uuid(), { fullName: 'Mai Trần', phone: '0900000000', relationshipLabel: 'Mẹ' });
    const firstPage = await parents.list(current.admin.id, current.current.id, current.year.id, { q: '0900', pageSize: '1' });
    expect(firstPage.meta).toEqual({ page: 1, pageSize: 1, totalItems: 1, totalPages: 1 });
    expect(firstPage.data).toMatchObject([{ fullName: 'Mai Trần', phone: '0900000000', email: null, children: expect.arrayContaining([{ linkId: expect.any(String), studentName: 'Bé An', className: 'Mầm', relationshipLabel: 'Mẹ' }, { linkId: expect.any(String), studentName: 'Bé Bình', className: 'Mầm', relationshipLabel: 'Mẹ' }]) }]);
    const linkId = (parent.outcome as { id: string }).id;
    await parents.revoke(current.admin.id, current.current.id, linkId, uuid(), uuid());
    expect((await parents.list(current.admin.id, current.current.id, current.year.id)).data).toMatchObject([{ fullName: 'Mai Trần', children: [{ studentName: 'Bé Bình' }] }]);
    await expect(parents.list(current.admin.id, current.current.id, foreign.year.id)).rejects.toMatchObject({ status: 404 });
  });

  it('paginates parent profiles stably, searches every permitted contact field, and rejects invalid pages', async () => {
    const current = await graph(); const foreign = await graph();
    const an = await createStudent(current, { fullName: 'Bé An' }); const binh = await createStudent(current, { fullName: 'Bé Bình' }); const foreignStudent = await createStudent(foreign, { fullName: 'Bé Ngoại' });
    const anId = (an.outcome as { id: string }).id; const binhId = (binh.outcome as { id: string }).id;
    const shared = await parents.create(current.admin.id, current.current.id, anId, uuid(), uuid(), { fullName: 'Ánh Nguyễn', email: 'shared.parent@example.com', phone: '0900111222', relationshipLabel: 'Mẹ' });
    await parents.create(current.admin.id, current.current.id, binhId, uuid(), uuid(), { fullName: 'Bình Trần', email: 'binh.parent@example.com', phone: '0900333444', relationshipLabel: 'Bố' });
    const sharedProfileId = (await prisma.studentParent.findUniqueOrThrow({ where: { id: (shared.outcome as { id: string }).id } })).parentProfileId;
    await prisma.studentParent.create({ data: { schoolId: foreign.current.id, studentId: (foreignStudent.outcome as { id: string }).id, parentProfileId: sharedProfileId, relationshipLabel: 'Mẹ' } });
    const first = await parents.list(current.admin.id, current.current.id, current.year.id, { page: '1', pageSize: '1' });
    const second = await parents.list(current.admin.id, current.current.id, current.year.id, { page: '2', pageSize: '1' });
    const replay = await parents.list(current.admin.id, current.current.id, current.year.id, { page: '1', pageSize: '1' });
    expect(first.meta).toEqual({ page: 1, pageSize: 1, totalItems: 2, totalPages: 2 });
    expect(first.data[0]?.fullName).not.toBe(second.data[0]?.fullName);
    expect(replay.data[0]?.id).toBe(first.data[0]?.id);
    await expect(parents.list(current.admin.id, current.current.id, current.year.id, { q: 'Ánh Nguyễn' })).resolves.toMatchObject({ data: [{ fullName: 'Ánh Nguyễn' }] });
    await expect(parents.list(current.admin.id, current.current.id, current.year.id, { q: 'Bé Bình' })).resolves.toMatchObject({ data: [{ fullName: 'Bình Trần' }] });
    await expect(parents.list(current.admin.id, current.current.id, current.year.id, { q: '0900111222' })).resolves.toMatchObject({ data: [{ fullName: 'Ánh Nguyễn' }] });
    await expect(parents.list(current.admin.id, current.current.id, current.year.id, { q: 'binh.parent@example.com' })).resolves.toMatchObject({ data: [{ fullName: 'Bình Trần' }] });
    await expect(parents.list(current.admin.id, current.current.id, current.year.id, { page: 'bad' })).rejects.toMatchObject({ status: 400 });
    await expect(parents.list(current.admin.id, current.current.id, current.year.id, { page: String(Number.MAX_SAFE_INTEGER), pageSize: '100' })).rejects.toMatchObject({ status: 400 });
    expect((await parents.list(current.admin.id, current.current.id, current.year.id, { q: 'Bé Ngoại' })).data).toEqual([]);
  });

  it('persists only Staff profile fields and retains School-scoped assignment history with audit and replay', async () => {
    const current = await graph();
    const profile = { fullName: 'Cô Mai', email: ' MAI@Example.com ', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội', primaryPositionId: current.position.id };
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

  it('persists optional Staff identifiers, scopes Staff code uniqueness, and protects Staff media', async () => {
    const current = await graph(); const foreign = await graph();
    const profile = { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội', primaryPositionId: current.position.id, staffCode: ' NV-001 ', personalIdentifier: ' CCCD-01 ' };
    const created = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), profile);
    const staffId = (created.outcome as { id: string }).id;
    expect(created.outcome).toMatchObject({ staffCode: 'NV-001', personalIdentifier: 'CCCD-01', hasPhoto: false });
    await expect(roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { ...profile, email: 'other@example.com' })).rejects.toMatchObject({ status: 409, response: { fieldErrors: { staffCode: expect.any(String) } } });
    await expect(roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { ...profile, email: 'case@example.com', staffCode: 'nv-001' })).rejects.toMatchObject({ status: 409, response: { fieldErrors: { staffCode: expect.any(String) } } });
    await roster.updateStaff(current.admin.id, current.current.id, staffId, uuid(), uuid(), { ...profile, staffCode: null, personalIdentifier: null });
    await expect(roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { ...profile, email: 'reused@example.com' })).rejects.toMatchObject({ status: 409, response: { fieldErrors: { staffCode: expect.any(String) } } });
    await expect(roster.createStaff(foreign.admin.id, foreign.current.id, uuid(), uuid(), { ...profile, primaryPositionId: foreign.position.id })).resolves.toBeTruthy();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const key = uuid(); const uploaded = await roster.uploadStaffPhoto(current.admin.id, current.current.id, staffId, key, uuid(), 'image/png', png);
    expect(await roster.uploadStaffPhoto(current.admin.id, current.current.id, staffId, key, uuid(), 'image/png', png)).toEqual(uploaded);
    expect((await roster.staff(current.admin.id, current.current.id)).data.find((item) => item.id === staffId)).toMatchObject({ hasPhoto: true, staffCode: null });
    const photo = await roster.staffPhoto(current.admin.id, current.current.id, staffId);
    expect(photo.contentType).toBe('image/png'); expect(Buffer.from(photo.blob)).toEqual(png);
    await expect(roster.uploadStaffPhoto(current.admin.id, current.current.id, staffId, uuid(), uuid(), 'image/png', Buffer.from('not a png'))).rejects.toMatchObject({ status: 400, response: { fieldErrors: { photo: expect.any(String) } } });
    await expect(roster.staffPhoto(foreign.admin.id, foreign.current.id, staffId)).rejects.toMatchObject({ status: 404 });
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.current.id, action: 'STAFF_PHOTO_UPLOADED' } })).toMatchObject({ provenance: { staffProfileId: staffId } });
  });

  it('returns bounded staff pages with scoped search, filters, stable sorts, and no foreign positions', async () => {
    const current = await graph(); const foreign = await graph();
    const position = await prisma.schoolPosition.create({ data: { schoolId: current.current.id, code: `STAFF_${uuid().slice(0, 8)}`, name: 'Trợ giảng' } });
    await prisma.staffProfile.createMany({ data: Array.from({ length: 31 }, (_, index) => ({ schoolId: current.current.id, fullName: `Nhân viên ${String(31 - index).padStart(2, '0')}`, email: `staff-${index}@example.com`, phone: `0900${String(index).padStart(6, '0')}`, dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), gender: 'Khác', address: 'Hà Nội', employmentStatus: index % 2 ? 'INACTIVE' : 'ACTIVE', primaryPositionId: index % 2 ? position.id : current.position.id, staffCode: `NV-${index}` })) });
    await prisma.staffProfile.create({ data: { schoolId: foreign.current.id, fullName: 'Nhân viên ngoại trường', email: 'foreign-staff@example.com', phone: '0999999999', dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), gender: 'Khác', address: 'Huế', primaryPositionId: foreign.position.id } });
    const first = await roster.staff(current.admin.id, current.current.id, { page: '1', pageSize: '1000', sort: 'name' });
    const second = await roster.staff(current.admin.id, current.current.id, { page: '2', pageSize: '25', sort: 'name' });
    expect(first.meta).toEqual({ page: 1, pageSize: 100, totalItems: 32, totalPages: 1 });
    expect(first.data).toHaveLength(32);
    expect(second.data).toEqual([]);
    expect((await roster.staff(current.admin.id, current.current.id, { q: 'staff-3@example.com' })).data).toMatchObject([{ staffCode: 'NV-3' }]);
    expect((await roster.staff(current.admin.id, current.current.id, { q: '0900000003', employmentStatus: 'INACTIVE', primaryPositionId: position.id, sort: 'position' })).data).toMatchObject([{ staffCode: 'NV-3', primaryPosition: { name: 'Trợ giảng' } }]);
    expect((await roster.staff(current.admin.id, current.current.id, { q: 'foreign-staff@example.com' })).data).toEqual([]);
    await expect(roster.staff(current.admin.id, current.current.id, { primaryPositionId: foreign.position.id })).rejects.toMatchObject({ status: 404, response: { code: 'POSITION_NOT_FOUND' } });
    await expect(roster.staff(current.admin.id, current.current.id, { page: 'bad' })).rejects.toMatchObject({ status: 400 });
    await expect(roster.staff(current.admin.id, current.current.id, { page: String(Number.MAX_SAFE_INTEGER), pageSize: '100' })).rejects.toMatchObject({ status: 400 });
    await expect(roster.staff(current.admin.id, current.current.id, { q: 'x'.repeat(101) })).rejects.toMatchObject({ status: 400 });
    await expect(roster.staff(current.admin.id, current.current.id, { q: ['Mai'] } as never)).rejects.toMatchObject({ status: 400 });
  });

  it('enforces Staff assignment tenant graph and half-open overlap while allowing adjacent and distinct Class intervals', async () => {
    const current = await graph(); const foreign = await graph();
    const second = await roster.createClass(current.admin.id, current.current.id, current.year.id, uuid(), uuid(), { name: 'Chồi' });
    const created = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội', primaryPositionId: current.position.id });
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
    const created = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội', primaryPositionId: current.position.id });
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
    const created = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội', primaryPositionId: current.position.id });
    const staffId = (created.outcome as { id: string }).id;
    const updated = await roster.updateStaff(current.admin.id, current.current.id, staffId, uuid(), uuid(), { fullName: 'Cô Mai mới', email: 'MOI@example.com', phone: '0900000001', dateOfBirth: '1991-01-01', gender: 'Khác', address: 'Đà Nẵng', primaryPositionId: current.position.id });
    expect(updated.outcome).toMatchObject({ id: staffId, fullName: 'Cô Mai mới', email: 'moi@example.com', phone: '0900000001', dateOfBirth: '1991-01-01', gender: 'Khác', address: 'Đà Nẵng' });
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.current.id, action: 'STAFF_PROFILE_UPDATED' } })).toMatchObject({ provenance: { staffProfileId: staffId } });
  });

  it('validates every open assignment change before writing', async () => {
    const current = await graph(); const foreign = await graph();
    const otherYear = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01' });
    const staff = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội', primaryPositionId: current.position.id });
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
    const foreignStaff = await roster.createStaff(foreign.admin.id, foreign.current.id, uuid(), uuid(), { fullName: 'Cô Ngoại', email: 'ngoai@example.com', phone: '0900000002', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Huế', primaryPositionId: foreign.position.id });
    const foreignAssignment = await roster.createAssignment(foreign.admin.id, foreign.current.id, (foreignStaff.outcome as { id: string }).id, uuid(), uuid(), { schoolYearId: foreign.year.id, classId: foreign.classroom.id, effectiveFrom: '2026-01-01', reason: 'Ngoại trường' });
    await expect(roster.changeAssignment(current.admin.id, current.current.id, (foreignAssignment.outcome as { id: string }).id, uuid(), uuid(), base)).rejects.toMatchObject({ status: 404 });
    await expect(roster.endAssignment(current.admin.id, current.current.id, (foreignAssignment.outcome as { id: string }).id, uuid(), uuid(), { effectiveTo: '2026-06-01', reason: 'Không được' })).rejects.toMatchObject({ status: 404 });
    expect((first.outcome as { id: string }).id).toBeTruthy();
  });

  it('lets exactly one concurrent overlapping assignment succeed and returns the stable conflict to the loser', async () => {
    const current = await graph();
    const staff = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội', primaryPositionId: current.position.id });
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
    const position = await prisma.schoolPosition.findFirstOrThrow({ where: { schoolId: current.current.id } });
    const staff = await prisma.staffProfile.create({ data: { schoolId: current.current.id, primaryPositionId: position.id, fullName: 'Direct', email: 'direct@example.com', phone: '0900000000', dateOfBirth: new Date('1990-01-01T00:00:00Z'), gender: 'Nữ', address: 'Hà Nội' } });
    const data = { schoolId: current.current.id, staffProfileId: staff.id, schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: new Date('2026-01-01T00:00:00Z'), reason: 'Direct', schoolYearName: 'Năm 2026', schoolYearStartsOn: new Date('2026-01-01T00:00:00Z'), schoolYearEndsOn: new Date('2027-01-01T00:00:00Z'), className: 'Mầm' };
    const foreignPosition = await prisma.schoolPosition.findFirstOrThrow({ where: { schoolId: foreign.current.id } });
    await expect(prisma.staffClassAssignment.create({ data: { ...data, staffProfileId: (await prisma.staffProfile.create({ data: { schoolId: foreign.current.id, primaryPositionId: foreignPosition.id, fullName: 'Foreign', email: 'foreign@example.com', phone: '0900000001', dateOfBirth: new Date('1990-01-01T00:00:00Z'), gender: 'Nữ', address: 'Huế' } })).id } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.staffClassAssignment.create({ data: { ...data, classId: foreign.classroom.id } })).rejects.toMatchObject({ code: 'P2003' });
    const otherYear = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01' });
    await expect(prisma.staffClassAssignment.create({ data: { ...data, schoolYearId: (otherYear.outcome as { id: string }).id } })).rejects.toMatchObject({ code: 'P2003' });
    const past = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Năm 2025', startsOn: '2025-01-01', endsOn: '2026-01-01' });
    const pastClass = await roster.createClass(current.admin.id, current.current.id, (past.outcome as { id: string }).id, uuid(), uuid(), { name: 'Lớp cũ' });
    await roster.createAssignment(current.admin.id, current.current.id, staff.id, uuid(), uuid(), { schoolYearId: (past.outcome as { id: string }).id, classId: (pastClass.outcome as { id: string }).id, effectiveFrom: '2025-01-01', effectiveTo: '2025-06-01', reason: 'Lịch sử' });
    expect(await roster.assignments(current.admin.id, current.current.id, (past.outcome as { id: string }).id)).toMatchObject([{ schoolYear: { name: 'Năm 2025' }, classroom: { name: 'Lớp cũ' }, effectiveTo: '2025-06-01' }]);
  });

  it('uses authoritative temporal placement for transfer, excludes duplicate destination enrollment, and rejects stale or changed replay', async () => {
    const current = await graph();
    const secondClass = await roster.createClass(current.admin.id, current.current.id, current.year.id, uuid(), uuid(), { name: 'Chồi' });
    const nextYear = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01' });
    const nextClass = await roster.createClass(current.admin.id, current.current.id, (nextYear.outcome as { id: string }).id, uuid(), uuid(), { name: 'Lá' });
    const created = await createStudent(current); const enrollmentId = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0].id;
    const classInput = { kind: 'CLASS_TRANSFER', sourceSchoolYearId: current.year.id, sourceClassId: current.classroom.id, destinationSchoolYearId: current.year.id, destinationClassId: (secondClass.outcome as { id: string }).id, effectiveFrom: '2026-06-01', reason: 'Điều lớp' };
    const preview = await roster.previewTransition(current.admin.id, current.current.id, classInput);
    const key = uuid(); const command = { ...classInput, selectedEnrollmentIds: [enrollmentId], previewFingerprint: preview.fingerprint, confirmation: 'CHUYỂN DANH BỘ' };
    const moved = await roster.transitionEnrollments(current.admin.id, current.current.id, key, uuid(), command);
    expect((await roster.students(current.admin.id, current.current.id, current.year.id, { classId: current.classroom.id })).data).toEqual([]);
    expect((await roster.students(current.admin.id, current.current.id, current.year.id, { classId: (secondClass.outcome as { id: string }).id })).data).toMatchObject([{ id: (created.outcome as { id: string }).id }]);
    expect(await roster.transitionEnrollments(current.admin.id, current.current.id, key, uuid(), command)).toEqual(moved);
    await expect(roster.transitionEnrollments(current.admin.id, current.current.id, key, uuid(), { ...command, reason: 'Khác' })).rejects.toMatchObject({ status: 409, response: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(await prisma.enrollmentClassAssignment.findMany({ where: { schoolId: current.current.id, enrollmentId }, orderBy: { effectiveFrom: 'asc' } })).toMatchObject([{ classId: current.classroom.id, effectiveTo: new Date('2026-06-01T00:00:00.000Z') }, { classId: (secondClass.outcome as { id: string }).id, effectiveTo: null }]);
    const yearInput = { kind: 'YEAR_TRANSITION', sourceSchoolYearId: current.year.id, sourceClassId: (secondClass.outcome as { id: string }).id, destinationSchoolYearId: (nextYear.outcome as { id: string }).id, destinationClassId: (nextClass.outcome as { id: string }).id, effectiveFrom: '2027-01-01', reason: 'Lên năm' };
    const yearPreview = await roster.previewTransition(current.admin.id, current.current.id, yearInput);
    await roster.transitionEnrollments(current.admin.id, current.current.id, uuid(), uuid(), { ...yearInput, selectedEnrollmentIds: [enrollmentId], previewFingerprint: yearPreview.fingerprint, confirmation: 'CHUYỂN DANH BỘ' });
    expect(await prisma.enrollmentClassAssignment.findFirstOrThrow({ where: { schoolId: current.current.id, enrollmentId, classId: (secondClass.outcome as { id: string }).id } })).toMatchObject({ effectiveTo: new Date('2027-01-01T00:00:00.000Z') });
    expect((await roster.previewTransition(current.admin.id, current.current.id, yearInput)).movable).toEqual([]);
  });

  it('closes a year atomically without graduating enrollment and allows only one concurrent close', async () => {
    const current = await graph(); const created = await createStudent(current); const enrollmentId = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0].id;
    const preview = await roster.previewCloseYear(current.admin.id, current.current.id, { schoolYearId: current.year.id, effectiveTo: '2026-12-31', reason: 'Kết năm' });
    const input = { schoolYearId: current.year.id, effectiveTo: '2026-12-31', reason: 'Kết năm', previewFingerprint: preview.fingerprint, confirmation: 'ĐÓNG NĂM HỌC' };
    const results = await Promise.allSettled([roster.closeYear(current.admin.id, current.current.id, uuid(), uuid(), input), roster.closeYear(current.admin.id, current.current.id, uuid(), uuid(), input)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.studentEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toMatchObject({ lifecycle: 'ENROLLED', endedOn: null });
    expect(await prisma.enrollmentClassAssignment.findFirstOrThrow({ where: { schoolId: current.current.id, enrollmentId } })).toMatchObject({ effectiveTo: new Date('2026-12-31T00:00:00.000Z') });
    expect(await prisma.schoolYear.findUniqueOrThrow({ where: { id: current.year.id } })).toMatchObject({ closedAt: expect.any(Date) });
  });

  it('keeps closed-year history readable, closes terminal placements, and rejects later roster writes', async () => {
    const current = await graph(); const created = await createStudent(current); const enrollmentId = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0].id;
    await roster.changeLifecycle(current.admin.id, current.current.id, enrollmentId, uuid(), uuid(), { lifecycle: 'WITHDRAWN', endedOn: '2026-06-01' });
    expect(await prisma.enrollmentClassAssignment.findFirstOrThrow({ where: { schoolId: current.current.id, enrollmentId } })).toMatchObject({ effectiveTo: new Date('2026-06-01T00:00:00.000Z') });
    const preview = await roster.previewCloseYear(current.admin.id, current.current.id, { schoolYearId: current.year.id, effectiveTo: '2026-12-31', reason: 'Kết năm' });
    await roster.closeYear(current.admin.id, current.current.id, uuid(), uuid(), { schoolYearId: current.year.id, effectiveTo: '2026-12-31', reason: 'Kết năm', previewFingerprint: preview.fingerprint, confirmation: 'ĐÓNG NĂM HỌC' });
    expect((await roster.students(current.admin.id, current.current.id, current.year.id)).data).toMatchObject([{ id: (created.outcome as { id: string }).id, enrollment: { id: enrollmentId } }]);
    await expect(roster.renameClass(current.admin.id, current.current.id, current.classroom.id, uuid(), uuid(), { name: 'Không được' })).rejects.toMatchObject({ status: 409, response: { code: 'SCHOOL_YEAR_CLOSED' } });
    expect(await prisma.class.findUniqueOrThrow({ where: { id: current.classroom.id } })).toMatchObject({ name: 'Mầm' });
  });

  it('rejects transition dates outside source placement and non-successor destination years', async () => {
    const current = await graph(); const created = await createStudent(current); const enrollmentId = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0].id;
    const destination = await roster.createClass(current.admin.id, current.current.id, current.year.id, uuid(), uuid(), { name: 'Chồi' });
    const invalid = { kind: 'CLASS_TRANSFER', sourceSchoolYearId: current.year.id, sourceClassId: current.classroom.id, destinationSchoolYearId: current.year.id, destinationClassId: (destination.outcome as { id: string }).id, effectiveFrom: '2026-01-01', reason: 'Sai ngày' };
    await expect(roster.previewTransition(current.admin.id, current.current.id, invalid)).rejects.toMatchObject({ status: 400, response: { fieldErrors: { effectiveFrom: expect.any(String) } } });
    const prior = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Năm cũ', startsOn: '2025-01-01', endsOn: '2026-01-01' });
    const priorClass = await roster.createClass(current.admin.id, current.current.id, (prior.outcome as { id: string }).id, uuid(), uuid(), { name: 'Cũ' });
    await expect(roster.previewTransition(current.admin.id, current.current.id, { ...invalid, kind: 'YEAR_TRANSITION', destinationSchoolYearId: (prior.outcome as { id: string }).id, destinationClassId: (priorClass.outcome as { id: string }).id, effectiveFrom: '2026-01-01' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { effectiveFrom: expect.any(String) } } });
    expect(await prisma.enrollmentClassAssignment.count({ where: { schoolId: current.current.id, enrollmentId, effectiveTo: null } })).toBe(1);
  });

  it('serializes transition against close-year without a partial destination or open source placement', async () => {
    const current = await graph(); const destination = await roster.createSchoolYear(current.admin.id, current.current.id, uuid(), uuid(), { name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01' });
    const destinationClass = await roster.createClass(current.admin.id, current.current.id, (destination.outcome as { id: string }).id, uuid(), uuid(), { name: 'Lá' });
    const created = await createStudent(current); const enrollmentId = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0].id;
    const transitionInput = { kind: 'YEAR_TRANSITION', sourceSchoolYearId: current.year.id, sourceClassId: current.classroom.id, destinationSchoolYearId: (destination.outcome as { id: string }).id, destinationClassId: (destinationClass.outcome as { id: string }).id, effectiveFrom: '2027-01-01', reason: 'Lên năm' };
    const transitionPreview = await roster.previewTransition(current.admin.id, current.current.id, transitionInput);
    const closePreview = await roster.previewCloseYear(current.admin.id, current.current.id, { schoolYearId: current.year.id, effectiveTo: '2026-12-31', reason: 'Kết năm' });
    const results = await Promise.allSettled([
      roster.transitionEnrollments(current.admin.id, current.current.id, uuid(), uuid(), { ...transitionInput, selectedEnrollmentIds: [enrollmentId], previewFingerprint: transitionPreview.fingerprint, confirmation: 'CHUYỂN DANH BỘ' }),
      roster.closeYear(current.admin.id, current.current.id, uuid(), uuid(), { schoolYearId: current.year.id, effectiveTo: '2026-12-31', reason: 'Kết năm', previewFingerprint: closePreview.fingerprint, confirmation: 'ĐÓNG NĂM HỌC' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const source = await prisma.enrollmentClassAssignment.findFirstOrThrow({ where: { schoolId: current.current.id, enrollmentId, schoolYearId: current.year.id } });
    expect(source.effectiveTo).not.toBeNull();
    const destinationEnrollment = await prisma.studentEnrollment.findMany({ where: { schoolId: current.current.id, studentId: (created.outcome as { id: string }).id, schoolYearId: (destination.outcome as { id: string }).id } });
    if (destinationEnrollment.length) expect(source.effectiveTo).toEqual(new Date('2027-01-01T00:00:00.000Z'));
    else expect(await prisma.schoolYear.findUniqueOrThrow({ where: { id: current.year.id } })).toMatchObject({ closedAt: expect.any(Date) });
  });

  it('rejects closed-year lifecycle, assignment, archive, and transition mutations without durable changes', async () => {
    const current = await graph(); const created = await createStudent(current); const enrollmentId = (created.outcome as { enrollments: [{ id: string }] }).enrollments[0].id;
    const staff = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội', primaryPositionId: current.position.id });
    const staffAssignment = await roster.createAssignment(current.admin.id, current.current.id, (staff.outcome as { id: string }).id, uuid(), uuid(), { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-01-01', reason: 'Đầu năm' });
    const preview = await roster.previewCloseYear(current.admin.id, current.current.id, { schoolYearId: current.year.id, effectiveTo: '2026-12-31', reason: 'Kết năm' });
    await roster.closeYear(current.admin.id, current.current.id, uuid(), uuid(), { schoolYearId: current.year.id, effectiveTo: '2026-12-31', reason: 'Kết năm', previewFingerprint: preview.fingerprint, confirmation: 'ĐÓNG NĂM HỌC' });
    await expect(roster.changeLifecycle(current.admin.id, current.current.id, enrollmentId, uuid(), uuid(), { lifecycle: 'WITHDRAWN', endedOn: '2026-12-31' })).rejects.toMatchObject({ status: 409, response: { code: 'SCHOOL_YEAR_CLOSED' } });
    await expect(roster.changeAssignment(current.admin.id, current.current.id, (staffAssignment.outcome as { id: string }).id, uuid(), uuid(), { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-01-01', reason: 'Sửa' })).rejects.toMatchObject({ status: 409, response: { code: 'SCHOOL_YEAR_CLOSED' } });
    await expect(roster.archiveClass(current.admin.id, current.current.id, current.classroom.id, uuid(), uuid())).rejects.toMatchObject({ status: 409, response: { code: 'SCHOOL_YEAR_CLOSED' } });
    await expect(roster.previewTransition(current.admin.id, current.current.id, { kind: 'CLASS_TRANSFER', sourceSchoolYearId: current.year.id, sourceClassId: current.classroom.id, destinationSchoolYearId: current.year.id, destinationClassId: current.classroom.id, effectiveFrom: '2026-12-31', reason: 'Không được' })).rejects.toMatchObject({ status: 409, response: { code: 'SCHOOL_YEAR_CLOSED' } });
    expect(await prisma.studentEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toMatchObject({ lifecycle: 'ENROLLED' });
    expect(await prisma.class.findUniqueOrThrow({ where: { id: current.classroom.id } })).toMatchObject({ status: 'ACTIVE' });
  });

  it('serializes createStudent and endAssignment against close-year and rejects the losing write', async () => {
    const current = await graph();
    const staff = await roster.createStaff(current.admin.id, current.current.id, uuid(), uuid(), { fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội', primaryPositionId: current.position.id });
    const assignment = await roster.createAssignment(current.admin.id, current.current.id, (staff.outcome as { id: string }).id, uuid(), uuid(), { schoolYearId: current.year.id, classId: current.classroom.id, effectiveFrom: '2026-01-01', reason: 'Đầu năm' });
    const preview = await roster.previewCloseYear(current.admin.id, current.current.id, { schoolYearId: current.year.id, effectiveTo: '2026-12-31', reason: 'Kết năm' });
    const [create, close] = await Promise.allSettled([
      createStudent(current, { fullName: 'Bé Mới' }),
      roster.closeYear(current.admin.id, current.current.id, uuid(), uuid(), { schoolYearId: current.year.id, effectiveTo: '2026-12-31', reason: 'Kết năm', previewFingerprint: preview.fingerprint, confirmation: 'ĐÓNG NĂM HỌC' }),
    ]);
    expect([create, close].filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    if (close.status === 'fulfilled') await expect(roster.endAssignment(current.admin.id, current.current.id, (assignment.outcome as { id: string }).id, uuid(), uuid(), { effectiveTo: '2026-12-31', reason: 'Không được' })).rejects.toMatchObject({ status: 409, response: { code: 'SCHOOL_YEAR_CLOSED' } });
  });

  it('rejects direct cross-school closeOperation provenance', async () => {
    const a = await graph(); const b = await graph();
    const operation = await prisma.operation.create({ data: { schoolId: b.current.id, membershipId: (await prisma.schoolMembership.findFirstOrThrow({ where: { schoolId: b.current.id } })).id, actorIdentityId: b.admin.id, actorType: 'SCHOOL_MEMBERSHIP', actorReference: (await prisma.schoolMembership.findFirstOrThrow({ where: { schoolId: b.current.id } })).id, route: 'test', fingerprint: 'test', idempotencyKey: uuid() } });
    await expect(prisma.schoolYear.update({ where: { id: a.year.id }, data: { closeOperationId: operation.id } })).rejects.toMatchObject({ code: 'P2003' });
  });
});
