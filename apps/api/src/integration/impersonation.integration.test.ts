import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AuthService } from '../modules/auth/auth.service.js';
import { PrismaService } from '../modules/identity/prisma.service.js';
import { OpsService } from '../modules/ops/ops.service.js';
import { auditData } from '../modules/common/audit.js';
import { runWithImpersonation } from '../modules/common/impersonation-context.js';

const prisma = new PrismaService(); const ops = new OpsService(prisma); const auth = new AuthService(prisma); const prefix = `imp-${crypto.randomUUID()}`; const identityIds: string[] = []; const schoolIds: string[] = [];
const key = () => crypto.randomUUID();
async function operator() { const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${prefix}-${crypto.randomUUID()}@example.com`, googleSubject: `subject-${crypto.randomUUID()}` } }); identityIds.push(identity.id); await prisma.platformOperatorGrant.create({ data: { userIdentityId: identity.id } }); return identity.id; }
async function school(actor: string) {
  const ownerEmail = `${prefix}-${crypto.randomUUID()}@example.com`;
  const result = await ops.provision(actor, key(), key(), { name: 'Trường giả lập', slug: `${prefix}-${crypto.randomUUID().slice(0, 8)}`, ownerEmail, studentCodePrefix: 'S', kind: 'PRESCHOOL' });
  const schoolId = (result.outcome as { schoolId: string }).schoolId; schoolIds.push(schoolId);
  const owner = await prisma.userIdentity.findUniqueOrThrow({ where: { emailNormalized: ownerEmail } }); identityIds.push(owner.id);
  return { schoolId, owner };
}
const ticketOf = (url: string) => new URL(url).searchParams.get('ticket')!;
afterEach(async () => {
  const schools = schoolIds.splice(0); const identities = identityIds.splice(0);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.schoolUserAccess.deleteMany({ where: { schoolId: { in: schools } } }); await tx.auditRecord.deleteMany({ where: { schoolId: { in: schools } } }); await tx.schoolYear.deleteMany({ where: { schoolId: { in: schools } } }); await tx.receivableGroup.deleteMany({ where: { schoolId: { in: schools } } });
    await tx.operation.deleteMany({ where: { OR: [{ schoolId: { in: schools } }, { actorIdentityId: { in: identities } }] } }); await tx.impersonation.deleteMany({ where: { operatorIdentityId: { in: identities } } });
    await tx.staffProfile.deleteMany({ where: { schoolId: { in: schools } } }); await tx.positionCapabilityGrant.deleteMany({ where: { schoolId: { in: schools } } }); await tx.schoolPosition.deleteMany({ where: { schoolId: { in: schools } } }); await tx.schoolMembership.deleteMany({ where: { schoolId: { in: schools } } }); await tx.school.deleteMany({ where: { id: { in: schools } } });
    await tx.platformOperatorGrant.deleteMany({ where: { userIdentityId: { in: identities } } }); await tx.userIdentity.deleteMany({ where: { id: { in: identities } } });
  });
});
afterAll(async () => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('Platform Operator impersonation', () => {
  it('exchanges a single-use ticket for a portal session of the target user', async () => {
    const actor = await operator(); const { owner } = await school(actor);
    const started = await ops.startImpersonation(actor, { targetIdentityId: owner.id, audience: 'app', reason: 'Kiểm tra lỗi đợt thu' });
    expect(new URL(started.url).pathname).toBe('/api/app/auth/impersonate');
    await expect(auth.impersonate('teacher', ticketOf(started.url))).rejects.toMatchObject({ status: 401 });
    const session = await auth.impersonate('app', ticketOf(started.url));
    expect(auth.session('app', session.cookie)).toEqual({ userIdentityId: owner.id, email: owner.emailNormalized, impersonation: { id: started.impersonationId, operatorEmail: expect.stringContaining(prefix) } });
    await expect(auth.impersonate('app', ticketOf(started.url))).rejects.toMatchObject({ status: 401 });
    await expect(prisma.impersonation.findUniqueOrThrow({ where: { id: started.impersonationId } })).resolves.toMatchObject({ operatorIdentityId: actor, targetIdentityId: owner.id, audience: 'app', reason: 'Kiểm tra lỗi đợt thu', startedAt: expect.any(Date), endedAt: null });
    await expect(auth.impersonationActive(started.impersonationId)).resolves.toBe(true);
    await auth.endImpersonation(started.impersonationId);
    await expect(auth.impersonationActive(started.impersonationId)).resolves.toBe(false);
  });
  it('attributes Operations and AuditRecords written during the impersonated request', async () => {
    const actor = await operator(); const { owner, schoolId } = await school(actor);
    const started = await ops.startImpersonation(actor, { targetIdentityId: owner.id, audience: 'app', reason: 'Kiểm tra thao tác' }); await auth.impersonate('app', ticketOf(started.url));
    const membership = await prisma.schoolMembership.findFirstOrThrow({ where: { schoolId, userIdentityId: owner.id } });
    const [audit, operation] = await runWithImpersonation(started.impersonationId, () => prisma.$transaction(async (tx) => [
      await tx.auditRecord.create({ data: auditData(schoolId, { identityId: owner.id, type: 'SCHOOL_MEMBERSHIP', reference: membership.id, membershipId: membership.id }, 'IMPERSONATION_TEST', {}) }),
      await tx.operation.create({ data: { schoolId, membershipId: membership.id, actorIdentityId: owner.id, actorType: 'SCHOOL_MEMBERSHIP', actorReference: membership.id, route: 'impersonation-test', fingerprint: 'f', idempotencyKey: key(), status: 'COMPLETED' } }),
    ]));
    expect(audit.impersonationId).toBe(started.impersonationId); expect(operation.impersonationId).toBe(started.impersonationId);
    const plain = await prisma.auditRecord.create({ data: auditData(schoolId, { identityId: owner.id, type: 'SCHOOL_MEMBERSHIP', reference: membership.id, membershipId: membership.id }, 'IMPERSONATION_TEST', {}) });
    expect(plain.impersonationId).toBeNull();
  });
  it('refuses operators as targets, short reasons and revoked grants', async () => {
    const actor = await operator(); const other = await operator(); const { owner } = await school(actor);
    await expect(ops.startImpersonation(actor, { targetIdentityId: other, audience: 'app', reason: 'Kiểm tra' })).rejects.toMatchObject({ status: 403 });
    await expect(ops.startImpersonation(actor, { targetIdentityId: owner.id, audience: 'ops', reason: 'Kiểm tra' })).rejects.toMatchObject({ status: 400 });
    await expect(ops.startImpersonation(actor, { targetIdentityId: owner.id, audience: 'app', reason: 'x' })).rejects.toMatchObject({ status: 400 });
    const started = await ops.startImpersonation(actor, { targetIdentityId: owner.id, audience: 'parent', reason: 'Kiểm tra phụ huynh' }); await auth.impersonate('parent', ticketOf(started.url));
    await prisma.platformOperatorGrant.update({ where: { userIdentityId: actor }, data: { revokedAt: new Date() } });
    await expect(auth.impersonationActive(started.impersonationId)).resolves.toBe(false);
    await expect(ops.identities(actor, owner.emailNormalized)).rejects.toMatchObject({ status: 403 });
  });
  it('records School access only for members of that School', async () => {
    const actor = await operator(); const first = await school(actor); const second = await school(actor);
    await auth.touchSchoolAccess('app', first.owner.id, first.schoolId);
    await auth.touchSchoolAccess('app', first.owner.id, second.schoolId);
    await auth.touchSchoolAccess('parent', first.owner.id, first.schoolId);
    const rows = await prisma.schoolUserAccess.findMany({ where: { userIdentityId: first.owner.id } });
    expect(rows).toEqual([expect.objectContaining({ schoolId: first.schoolId, lastSeenAt: expect.any(Date) })]);
  });
  it('searches identities with their School memberships', async () => {
    const actor = await operator(); const { owner } = await school(actor);
    const result = await ops.identities(actor, owner.emailNormalized.slice(0, 20));
    expect(result.identities).toEqual(expect.arrayContaining([expect.objectContaining({ id: owner.id, platformOperator: false, lastLoginAt: null, lastSeenAt: null, memberships: [expect.objectContaining({ schoolName: 'Trường giả lập', status: 'ACTIVE' })] })]));
    await auth.touchLastSeen(owner.id);
    const all = await ops.identities(actor, '');
    expect(all.identities.find((identity) => identity.id === owner.id)?.lastSeenAt).toEqual(expect.any(String));
  });
});
