import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AuthorizationService } from '../modules/authorization/authorization.service.js';
import { PrismaService } from '../modules/identity/prisma.service.js';
import { FinanceService } from '../modules/finance/finance.service.js';

const prisma = new PrismaService();
const finance = new FinanceService(prisma, new AuthorizationService(prisma));
const schools: string[] = [];
const uuid = () => crypto.randomUUID();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function graph() {
  const school = await prisma.school.create({ data: { name: 'Finance', slug: `finance-${uuid()}`, studentCodePrefix: 'FI' } });
  schools.push(school.id);
  const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const membership = await prisma.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: identity.id } });
  const position = await prisma.schoolPosition.create({ data: { schoolId: school.id, code: `FINANCE_${uuid().replaceAll('-', '').slice(0, 12)}`, name: `Finance ${uuid()}` } });
  await prisma.positionCapabilityGrant.createMany({ data: ['SCHOOL_CONTEXT_READ', 'FINANCE_MANAGE'].map((capability) => ({ schoolId: school.id, positionId: position.id, capability })) });
  await prisma.staffProfile.create({ data: { schoolId: school.id, fullName: 'Finance actor', email: identity.emailNormalized, phone: '0900000000', dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), gender: 'Khác', address: 'Test', primaryPositionId: position.id, schoolMembershipId: membership.id, boundAt: new Date(), boundByMembershipId: membership.id } });
  return { school, identity, membership, position };
}

async function group(input: Awaited<ReturnType<typeof graph>>, name = 'Học phí') {
  return finance.createGroup(input.identity.id, input.school.id, uuid(), uuid(), { name });
}

async function roster(input: Awaited<ReturnType<typeof graph>>) {
  const year = await prisma.schoolYear.create({ data: { schoolId: input.school.id, name: 'Năm học 2026', startsOn: date('2026-01-01'), endsOn: date('2027-01-01') } });
  const activeClass = await prisma.class.create({ data: { schoolId: input.school.id, schoolYearId: year.id, name: 'Mầm Active' } });
  const archivedClass = await prisma.class.create({ data: { schoolId: input.school.id, schoolYearId: year.id, name: 'Mầm Archived', status: 'ARCHIVED' } });
  return { ...input, year, activeClass, archivedClass };
}

async function enrolled(input: Awaited<ReturnType<typeof roster>>, options: { lifecycle?: 'ENROLLED' | 'TRIAL'; classId?: string; assignment?: boolean; effectiveFrom?: string; effectiveTo?: string } = {}) {
  const student = await prisma.student.create({ data: { schoolId: input.school.id, studentCode: `HS-${uuid()}`, fullName: 'Học sinh Finance', dateOfBirth: date('2022-01-01') } });
  const classId = options.classId ?? input.activeClass.id;
  const enrollment = await prisma.studentEnrollment.create({ data: { schoolId: input.school.id, studentId: student.id, schoolYearId: input.year.id, classId, lifecycle: options.lifecycle ?? 'ENROLLED', effectiveFrom: date('2026-01-01'), schoolYearName: input.year.name, schoolYearStartsOn: input.year.startsOn, schoolYearEndsOn: input.year.endsOn, className: classId === input.archivedClass.id ? input.archivedClass.name : input.activeClass.name } });
  if (options.assignment !== false) await prisma.enrollmentClassAssignment.create({ data: { schoolId: input.school.id, enrollmentId: enrollment.id, schoolYearId: input.year.id, classId, effectiveFrom: date(options.effectiveFrom ?? '2026-01-01'), effectiveTo: options.effectiveTo ? date(options.effectiveTo) : null, reason: 'Finance test' } });
  return { student, enrollment };
}

async function open(input: Awaited<ReturnType<typeof roster>>, billingMonth = '2026-09') {
  return finance.openRun(input.identity.id, input.school.id, uuid(), uuid(), { schoolYearId: input.year.id, billingMonth });
}

const outcomeId = (value: { outcome: unknown }) => (value.outcome as { id: string }).id;

afterEach(async () => {
  const ids = schools.splice(0);
  if (!ids.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.auditRecord.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receivableLifecycleTransition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receivableGroupLifecycleTransition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receivable.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receivableGroup.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunSelection.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunLifecycleTransition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRun.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.enrollmentClassAssignment.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.studentEnrollmentLifecycleTransition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.studentEnrollment.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.student.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.class.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolYear.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.operation.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.staffProfile.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.positionCapabilityGrant.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolPosition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolMembership.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.school.deleteMany({ where: { id: { in: ids } } });
  });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('finance PostgreSQL invariants', () => {
  it('persists Finance-authorized active catalog records, BIGINT VND, audit, and Operations', async () => {
    const current = await graph();
    const createdGroup = await group(current);
    const groupId = (createdGroup.outcome as { id: string }).id;
    const created = await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code: 'TUITION', displayName: 'Học phí', unitLabel: 'tháng', defaultUnitPrice: '123456789' });
    const receivableId = (created.outcome as { id: string }).id;

    expect(created).toMatchObject({ status: 'COMPLETED', outcome: { id: receivableId, code: 'TUITION', defaultUnitPrice: '123456789', status: 'ACTIVE', available: true } });
    expect(await prisma.receivable.findUniqueOrThrow({ where: { id: receivableId } })).toMatchObject({ schoolId: current.school.id, groupId, defaultUnitPrice: 123456789n });
    expect(await prisma.operation.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ schoolId: current.school.id, status: 'COMPLETED' });
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.school.id, action: 'RECEIVABLE_CREATED' } })).toMatchObject({ membershipId: current.membership.id, provenance: { operationId: created.id, newValue: { id: receivableId, defaultUnitPrice: '123456789' } } });
    await expect(finance.read(current.identity.id, current.school.id)).resolves.toMatchObject({ groups: [{ id: groupId, status: 'ACTIVE' }], receivables: [{ id: receivableId, available: true, defaultUnitPrice: '123456789' }] });
  });

  it('rejects duplicate codes and foreign group graphs without creating or disclosing catalog data', async () => {
    const current = await graph(); const foreign = await graph();
    const currentGroup = await group(current); const foreignGroup = await group(foreign);
    const groupId = (currentGroup.outcome as { id: string }).id;
    const foreignGroupId = (foreignGroup.outcome as { id: string }).id;
    const input = { groupId, code: 'MEAL', displayName: 'Tiền ăn', unitLabel: 'tháng', defaultUnitPrice: '1000' };
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { ...input, code: 'INVALID_VND', defaultUnitPrice: '0' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { defaultUnitPrice: expect.any(String) } } });
    await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), input);
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), input)).rejects.toMatchObject({ status: 400, response: { fieldErrors: { code: expect.any(String) } } });
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { ...input, groupId: foreignGroupId, code: 'FOREIGN' })).rejects.toMatchObject({ status: 404, response: { code: 'RECEIVABLE_GROUP_NOT_FOUND' } });
    expect(await prisma.receivable.count({ where: { schoolId: current.school.id } })).toBe(1);
    await expect(prisma.receivable.create({ data: { schoolId: current.school.id, groupId: foreignGroupId, displayName: 'Graph trực tiếp', unitLabel: 'lần', defaultUnitPrice: 1n } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('retains inactive catalog history while making it unavailable and rejecting new selection', async () => {
    const current = await graph();
    const createdGroup = await group(current); const groupId = (createdGroup.outcome as { id: string }).id;
    const created = await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code: 'ACTIVITY', displayName: 'Ngoại khóa', unitLabel: 'tháng', defaultUnitPrice: '50000' });
    const receivableId = (created.outcome as { id: string }).id;
    await finance.transitionGroup(current.identity.id, current.school.id, groupId, uuid(), uuid(), { status: 'INACTIVE', reason: 'Ngừng áp dụng' });

    await expect(finance.read(current.identity.id, current.school.id)).resolves.toMatchObject({ groups: [{ id: groupId, status: 'INACTIVE' }], receivables: [{ id: receivableId, status: 'ACTIVE', available: false }] });
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code: 'NEW', displayName: 'Không được chọn', unitLabel: 'lần', defaultUnitPrice: '1' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { groupId: expect.any(String) } } });
    expect(await prisma.receivableGroupLifecycleTransition.count({ where: { schoolId: current.school.id, receivableGroupId: groupId } })).toBe(2);
  });

  it('replays same-key outcomes, rejects changed fingerprints, and re-authorizes revoked access', async () => {
    const current = await graph();
    const key = uuid(); const operationId = uuid(); const body = { name: 'Dịch vụ' };
    const first = await finance.createGroup(current.identity.id, current.school.id, key, operationId, body);
    expect(await finance.createGroup(current.identity.id, current.school.id, key, uuid(), body)).toEqual(first);
    expect(await prisma.receivableGroup.count({ where: { schoolId: current.school.id } })).toBe(1);
    await expect(finance.createGroup(current.identity.id, current.school.id, key, uuid(), { name: 'Khác' })).rejects.toMatchObject({ status: 409, response: { code: 'IDEMPOTENCY_CONFLICT' } });

    const other = await graph();
    await expect(finance.operation(other.identity.id, other.school.id, first.id)).rejects.toMatchObject({ status: 404, response: { code: 'OPERATION_NOT_FOUND' } });
    await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: current.school.id, positionId: current.position.id, capability: 'FINANCE_MANAGE' } });
    await expect(finance.read(current.identity.id, current.school.id)).rejects.toMatchObject({ status: 403, response: { code: 'CAPABILITY_DENIED' } });
    await expect(finance.createGroup(current.identity.id, current.school.id, key, uuid(), body)).rejects.toMatchObject({ status: 403, response: { code: 'CAPABILITY_DENIED' } });
  });

  it('validates monthly open, returns the existing run, and serializes concurrent opens to one database row', async () => {
    const current = await roster(await graph());
    await expect(finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: '2026-13' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { billingMonth: expect.any(String) } } });
    await expect(finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: '2027-01' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { billingMonth: expect.any(String) } } });

    const first = await open(current);
    const existing = await open(current);
    expect(outcomeId(existing)).toBe(outcomeId(first));

    const concurrent = await Promise.all(Array.from({ length: 4 }, () => finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: '2026-10' })));
    expect(new Set(concurrent.map(outcomeId)).size).toBe(1);
    expect(await prisma.collectionRun.count({ where: { schoolId: current.school.id } })).toBe(2);
    await expect(prisma.collectionRun.create({ data: { schoolId: current.school.id, schoolYearId: current.year.id, billingMonth: 'not-a-month' } })).rejects.toMatchObject({ code: 'P2039' });
  });

  it('canonicalizes selected IDs and replays only an identical selection command and Operation', async () => {
    const current = await roster(await graph());
    const firstStudent = await enrolled(current); const secondStudent = await enrolled(current);
    const runId = outcomeId(await open(current));
    const key = uuid(); const operationId = uuid();
    const body = { studentIds: [secondStudent.student.id, firstStudent.student.id, secondStudent.student.id] };
    const saved = await finance.replaceSelection(current.identity.id, current.school.id, runId, key, operationId, body);
    expect(saved).toMatchObject({ status: 'COMPLETED', outcome: { id: runId, version: 2, selectedStudentIds: [firstStudent.student.id, secondStudent.student.id].sort() } });
    expect(await finance.replaceSelection(current.identity.id, current.school.id, runId, key, uuid(), { studentIds: [firstStudent.student.id, secondStudent.student.id] })).toEqual(saved);
    await expect(finance.replaceSelection(current.identity.id, current.school.id, runId, key, uuid(), { studentIds: [firstStudent.student.id] })).rejects.toMatchObject({ status: 409, response: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(await prisma.collectionRunSelection.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).toBe(2);
    expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: 'COLLECTION_RUN_SELECTION_REPLACED' } })).toBe(1);
    await expect(finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [uuid()] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { studentIds: expect.any(String) } } });
  });

  it('uses roster lifecycle, enrollment effective interval, and class status for authoritative eligible and categorized skip rows', async () => {
    const current = await roster(await graph());
    const eligible = await enrolled(current);
    const trial = await enrolled(current, { lifecycle: 'TRIAL' });
    const missingAssignment = await enrolled(current, { assignment: false });
    const futureAssignment = await enrolled(current, { effectiveFrom: '2026-10-01' });
    const archived = await enrolled(current, { classId: current.archivedClass.id });
    const ended = await enrolled(current);
    await prisma.studentEnrollment.update({ where: { id: ended.enrollment.id }, data: { lifecycle: 'WITHDRAWN', endedOn: date('2026-09-01') } });
    const runId = outcomeId(await open(current));
    await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [eligible.student.id, trial.student.id, missingAssignment.student.id, futureAssignment.student.id, archived.student.id, ended.student.id] });

    const preview = await finance.preview(current.identity.id, current.school.id, runId);
    expect(preview.eligible).toEqual([expect.objectContaining({ studentId: eligible.student.id, classId: current.activeClass.id })]);
    expect(preview.skips).toEqual(expect.arrayContaining([
      { studentId: trial.student.id, reason: 'NOT_ENROLLED' },
      { studentId: missingAssignment.student.id, reason: 'NO_CLASS_ASSIGNMENT' },
      { studentId: futureAssignment.student.id, reason: 'NO_CLASS_ASSIGNMENT' },
      { studentId: archived.student.id, reason: 'CLASS_INACTIVE' },
      { studentId: ended.student.id, reason: 'ENROLLMENT_NOT_EFFECTIVE' },
    ]));
    expect(preview).not.toHaveProperty('total');
  });

  it('rejects stale preview fingerprints after roster and SchoolYear facts change without partial lifecycle writes', async () => {
    const current = await roster(await graph());
    const student = await enrolled(current);
    const runId = outcomeId(await open(current));
    await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
    const rosterPreview = await finance.preview(current.identity.id, current.school.id, runId);
    await prisma.class.update({ where: { id: current.activeClass.id }, data: { status: 'ARCHIVED' } });
    await expect(finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: rosterPreview.fingerprint })).rejects.toMatchObject({ status: 409, response: { code: 'PREVIEW_STALE' } });
    expect((await finance.run(current.identity.id, current.school.id, runId)).status).toBe('DRAFT');

    const enrollmentPreview = await finance.preview(current.identity.id, current.school.id, runId);
    await prisma.studentEnrollment.update({ where: { id: student.enrollment.id }, data: { lifecycle: 'WITHDRAWN', endedOn: date('2026-09-01') } });
    await expect(finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: enrollmentPreview.fingerprint })).rejects.toMatchObject({ status: 409, response: { code: 'PREVIEW_STALE' } });

    const yearPreview = await finance.preview(current.identity.id, current.school.id, runId);
    await prisma.schoolYear.update({ where: { id: current.year.id }, data: { endsOn: date('2026-12-31') } });
    await expect(finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: yearPreview.fingerprint })).rejects.toMatchObject({ status: 409, response: { code: 'PREVIEW_STALE' } });
    expect((await finance.run(current.identity.id, current.school.id, runId)).status).toBe('DRAFT');
  });

  it('enforces tenant and capability boundaries, DRAFT lifecycle, and Operation reconciliation for a ready run', async () => {
    const current = await roster(await graph()); const foreign = await roster(await graph());
    const student = await enrolled(current);
    const runId = outcomeId(await open(current));
    await expect(finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [foreign.school.id] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { studentIds: expect.any(String) } } });
    await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
    await expect(finance.run(foreign.identity.id, foreign.school.id, runId)).rejects.toMatchObject({ status: 404, response: { code: 'COLLECTION_RUN_NOT_FOUND' } });

    const preview = await finance.preview(current.identity.id, current.school.id, runId);
    const key = uuid(); const operationId = uuid();
    const ready = await finance.readyRun(current.identity.id, current.school.id, runId, key, operationId, { previewFingerprint: preview.fingerprint });
    expect(ready).toMatchObject({ id: operationId, status: 'COMPLETED', outcome: { id: runId, status: 'READY', version: 3 } });
    expect(await finance.readyRun(current.identity.id, current.school.id, runId, key, uuid(), { previewFingerprint: preview.fingerprint })).toEqual(ready);
    await expect(finance.preview(current.identity.id, current.school.id, runId)).rejects.toMatchObject({ status: 409, response: { code: 'COLLECTION_RUN_NOT_DRAFT' } });
    await expect(finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] })).rejects.toMatchObject({ status: 409, response: { code: 'COLLECTION_RUN_NOT_DRAFT' } });
    await expect(finance.operation(foreign.identity.id, foreign.school.id, operationId)).rejects.toMatchObject({ status: 404, response: { code: 'OPERATION_NOT_FOUND' } });
    expect(await finance.operation(current.identity.id, current.school.id, operationId)).toEqual({ id: operationId, status: 'COMPLETED', outcome: ready.outcome });
    expect(await prisma.collectionRunLifecycleTransition.findMany({ where: { schoolId: current.school.id, collectionRunId: runId }, orderBy: { sequence: 'asc' } })).toMatchObject([{ previousStatus: null, status: 'DRAFT', membershipId: current.membership.id, sequence: 1 }, { previousStatus: 'DRAFT', status: 'READY', membershipId: current.membership.id, operationId, sequence: 2 }]);
    await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: current.school.id, positionId: current.position.id, capability: 'FINANCE_MANAGE' } });
    await expect(finance.run(current.identity.id, current.school.id, runId)).rejects.toMatchObject({ status: 403, response: { code: 'CAPABILITY_DENIED' } });
  });

  it('returns a 1,000-student authoritative preview within three seconds', async () => {
    const current = await roster(await graph());
    const students = Array.from({ length: 1000 }, () => ({ id: uuid(), schoolId: current.school.id, studentCode: `HS-${uuid()}`, fullName: 'Học sinh tải', dateOfBirth: date('2022-01-01') }));
    const enrollments = students.map((student) => ({ id: uuid(), schoolId: current.school.id, studentId: student.id, schoolYearId: current.year.id, classId: current.activeClass.id, lifecycle: 'ENROLLED' as const, effectiveFrom: date('2026-01-01'), schoolYearName: current.year.name, schoolYearStartsOn: current.year.startsOn, schoolYearEndsOn: current.year.endsOn, className: current.activeClass.name }));
    await prisma.student.createMany({ data: students });
    await prisma.studentEnrollment.createMany({ data: enrollments });
    await prisma.enrollmentClassAssignment.createMany({ data: enrollments.map((enrollment) => ({ schoolId: current.school.id, enrollmentId: enrollment.id, schoolYearId: current.year.id, classId: current.activeClass.id, effectiveFrom: date('2026-01-01'), reason: 'Performance test' })) });
    const runId = outcomeId(await open(current));
    await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: students.map((student) => student.id) });
    const started = performance.now();
    const preview = await finance.preview(current.identity.id, current.school.id, runId);
    expect(performance.now() - started).toBeLessThanOrEqual(3000);
    expect(preview.eligible).toHaveLength(1000);
    expect(preview.skips).toHaveLength(0);
  }, 15000);
});
