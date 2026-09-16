import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AuthorizationService } from '../modules/authorization/authorization.service.js';
import { MembershipsService } from '../modules/memberships/memberships.service.js';
import { PrismaService } from '../modules/identity/prisma.service.js';

const prisma = new PrismaService(); const authorization = new AuthorizationService(prisma); const memberships = new MembershipsService(prisma, authorization); const ids: string[] = [];
const uuid = () => crypto.randomUUID();
async function school(name: string) { const result = await prisma.school.create({ data: { name, slug: `membership-${uuid()}` } }); ids.push(result.id); return result; }
async function identity() { const result = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } }); return result; }
async function grant(schoolId: string, identityId: string, role: 'SCHOOL_ADMIN' | 'FINANCE_MANAGER' | 'CLASS_TEACHER') { const membership = await prisma.schoolMembership.create({ data: { schoolId, userIdentityId: identityId } }); await prisma.schoolRoleGrant.create({ data: { schoolId, membershipId: membership.id, role } }); return membership; }
afterEach(async () => { await prisma.auditRecord.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.operation.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.schoolRoleGrant.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.schoolMembership.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.school.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
afterAll(async () => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('membership PostgreSQL isolation', () => {
  it('resolves only active same-School grants and denies a revoked context without affecting another School', async () => {
    const user = await identity(); const a = await school('A'); const b = await school('B'); const membershipA = await grant(a.id, user.id, 'SCHOOL_ADMIN'); await grant(b.id, user.id, 'FINANCE_MANAGER');
    await expect(authorization.resolve(user.id, a.id, 'app', 'ACCESS_MANAGE')).resolves.toMatchObject({ schoolName: 'A' }); await prisma.schoolRoleGrant.deleteMany({ where: { membershipId: membershipA.id } }); await prisma.schoolMembership.update({ where: { id: membershipA.id }, data: { status: 'REVOKED' } }); await expect(authorization.resolve(user.id, a.id, 'app')).rejects.toMatchObject({ status: 404 }); await expect(authorization.resolve(user.id, b.id, 'app')).resolves.toMatchObject({ schoolName: 'B' });
  });
  it('replays access commands, audits them, and protects the final School Admin', async () => {
    const admin = await identity(); const target = await identity(); const current = await school('Admin'); const adminMembership = await grant(current.id, admin.id, 'SCHOOL_ADMIN'); const input = { email: target.emailNormalized, roles: ['CLASS_TEACHER'] };
    const first = await memberships.create(admin.id, current.id, uuid(), uuid(), input); const replay = await memberships.create(admin.id, current.id, (await prisma.operation.findUniqueOrThrow({ where: { id: first.id } })).idempotencyKey, uuid(), input); expect(replay.id).toBe(first.id); await expect(memberships.revoke(admin.id, current.id, adminMembership.id, uuid(), uuid(), { reason: 'test' })).rejects.toMatchObject({ status: 403 }); await expect(prisma.auditRecord.count({ where: { schoolId: current.id, action: 'MEMBERSHIP_CREATED' } })).resolves.toBe(1);
  });
  it('rejects a raw cross-School role grant through the composite foreign key', async () => {
    const first = await school('FK A'); const second = await school('FK B'); const user = await identity(); const membership = await grant(first.id, user.id, 'SCHOOL_ADMIN');
    await expect(prisma.$executeRawUnsafe('INSERT INTO "SchoolRoleGrant" ("id", "schoolId", "membershipId", "role", "createdAt") VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"SchoolRole", NOW())', uuid(), second.id, membership.id, 'CLASS_TEACHER')).rejects.toBeDefined();
  });
  it('rejects cross-School membership links in AuditRecord and Operation', async () => {
    const first = await school('Audit A'); const second = await school('Audit B'); const user = await identity(); const membership = await grant(first.id, user.id, 'SCHOOL_ADMIN');
    await expect(prisma.$executeRawUnsafe('INSERT INTO "AuditRecord" ("id", "schoolId", "membershipId", "action", "createdAt") VALUES ($1::uuid, $2::uuid, $3::uuid, $4, NOW())', uuid(), second.id, membership.id, 'CROSS_SCHOOL')).rejects.toBeDefined();
    await expect(prisma.$executeRawUnsafe('INSERT INTO "Operation" ("id", "schoolId", "membershipId", "actorType", "actorReference", "route", "fingerprint", "idempotencyKey", "createdAt", "updatedAt") VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"OperationActorType", $5, $6, $7, $8, NOW(), NOW())', uuid(), second.id, membership.id, 'SCHOOL_MEMBERSHIP', membership.id, 'POST test', 'fingerprint', uuid())).rejects.toBeDefined();
  });
  it('rejects claimed typed audit actors that are cross-School, nonexistent, or identity-mismatched', async () => {
    const first = await school('Actor A'); const second = await school('Actor B'); const actor = await identity(); const other = await identity(); const membership = await grant(first.id, actor.id, 'SCHOOL_ADMIN'); const grantRecord = await prisma.platformOperatorGrant.create({ data: { userIdentityId: actor.id } });
    await expect(prisma.$executeRawUnsafe('INSERT INTO "AuditRecord" ("id", "schoolId", "actorIdentityId", "membershipId", "actorType", "actorReference", "action", "createdAt") VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::"OperationActorType", $6, $7, NOW())', uuid(), second.id, actor.id, membership.id, 'SCHOOL_MEMBERSHIP', membership.id, 'CROSS_SCHOOL_ACTOR')).rejects.toBeDefined();
    await expect(prisma.$executeRawUnsafe('INSERT INTO "AuditRecord" ("id", "schoolId", "actorIdentityId", "membershipId", "actorType", "actorReference", "action", "createdAt") VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, $4::"OperationActorType", $5, $6, NOW())', uuid(), first.id, other.id, 'PLATFORM_OPERATOR_GRANT', grantRecord.id, 'WRONG_GRANT_IDENTITY')).rejects.toBeDefined();
    await expect(prisma.$executeRawUnsafe('INSERT INTO "AuditRecord" ("id", "schoolId", "actorIdentityId", "membershipId", "actorType", "actorReference", "action", "createdAt") VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::"OperationActorType", $6, $7, NOW())', uuid(), first.id, actor.id, membership.id, 'SCHOOL_MEMBERSHIP', uuid(), 'UNKNOWN_ACTOR')).rejects.toBeDefined();
  });
  it('serializes concurrent self-revokes so an active School Admin remains', async () => {
    const current = await school('Concurrent'); const firstIdentity = await identity(); const secondIdentity = await identity(); const first = await grant(current.id, firstIdentity.id, 'SCHOOL_ADMIN'); const second = await grant(current.id, secondIdentity.id, 'SCHOOL_ADMIN');
    const results = await Promise.allSettled([memberships.revoke(firstIdentity.id, current.id, first.id, uuid(), uuid(), { reason: 'one' }), memberships.revoke(secondIdentity.id, current.id, second.id, uuid(), uuid(), { reason: 'two' })]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1); await expect(prisma.schoolRoleGrant.count({ where: { schoolId: current.id, role: 'SCHOOL_ADMIN', membership: { status: 'ACTIVE' } } })).resolves.toBe(1);
  });
  it('does not create an audit or Operation when final-admin revoke or demotion is rejected', async () => {
    const current = await school('Final'); const owner = await identity(); const membership = await grant(current.id, owner.id, 'SCHOOL_ADMIN'); const audits = await prisma.auditRecord.count({ where: { schoolId: current.id } }); const operations = await prisma.operation.count({ where: { schoolId: current.id } });
    await expect(memberships.revoke(owner.id, current.id, membership.id, uuid(), uuid(), { reason: 'no' })).rejects.toMatchObject({ status: 403 }); await expect(memberships.replaceRoles(owner.id, current.id, membership.id, uuid(), uuid(), { roles: ['CLASS_TEACHER'], reason: 'no' })).rejects.toMatchObject({ status: 403 });
    await expect(prisma.auditRecord.count({ where: { schoolId: current.id } })).resolves.toBe(audits); await expect(prisma.operation.count({ where: { schoolId: current.id } })).resolves.toBe(operations);
  });
  it('keeps B selectable when A is suspended and prevents cross-School operation disclosure', async () => {
    const actor = await identity(); const target = await identity(); const a = await school('Suspended A'); const b = await school('Active B'); const membershipA = await grant(a.id, actor.id, 'SCHOOL_ADMIN'); await grant(b.id, actor.id, 'FINANCE_MANAGER');
    const operation = await memberships.create(actor.id, a.id, uuid(), uuid(), { email: target.emailNormalized, roles: ['CLASS_TEACHER'] }); await prisma.school.update({ where: { id: a.id }, data: { status: 'SUSPENDED' } });
    await expect(authorization.resolve(actor.id, a.id, 'app')).rejects.toMatchObject({ status: 404 }); await expect(authorization.resolve(actor.id, b.id, 'app')).resolves.toMatchObject({ schoolName: 'Active B' }); await expect(memberships.operation(actor.id, b.id, operation.id)).rejects.toMatchObject({ status: 404 }); await expect(memberships.operation(actor.id, 'not-a-uuid', operation.id)).rejects.toMatchObject({ status: 400 }); await expect(memberships.operation(actor.id, a.id, 'not-a-uuid')).rejects.toMatchObject({ status: 400 }); expect(membershipA.id).toBeTruthy();
  });
  it('rechecks School ACTIVE inside the locked mutation transaction', async () => {
    const current = await school('Suspend mutation'); const owner = await identity(); const target = await identity(); await grant(current.id, owner.id, 'SCHOOL_ADMIN'); await prisma.school.update({ where: { id: current.id }, data: { status: 'SUSPENDED' } });
    await expect(memberships.create(owner.id, current.id, uuid(), uuid(), { email: target.emailNormalized, roles: ['CLASS_TEACHER'] })).rejects.toMatchObject({ status: 404 }); await expect(prisma.operation.count({ where: { schoolId: current.id } })).resolves.toBe(0);
  });
  it('replays equal commands, rejects changed fingerprints, replaces full role sets, and permits self-operation reconciliation after revoke', async () => {
    const current = await school('Replay'); const owner = await identity(); const other = await identity(); const target = await identity(); const ownerMembership = await grant(current.id, owner.id, 'SCHOOL_ADMIN'); await grant(current.id, other.id, 'SCHOOL_ADMIN'); const key = uuid(); const operationId = uuid(); const input = { email: target.emailNormalized, roles: ['CLASS_TEACHER', 'FINANCE_MANAGER'] };
    const created = await memberships.create(owner.id, current.id, key, operationId, input); await expect(memberships.create(owner.id, current.id, key, uuid(), { ...input, roles: ['CLASS_TEACHER'] })).rejects.toMatchObject({ status: 409 }); const targetMembership = (created.outcome as { membershipId: string }).membershipId;
    await memberships.replaceRoles(owner.id, current.id, targetMembership, uuid(), uuid(), { roles: ['SCHOOL_ADMIN', 'FINANCE_MANAGER'], reason: 'replace' }); await expect(prisma.schoolRoleGrant.findMany({ where: { membershipId: targetMembership }, select: { role: true } })).resolves.toEqual(expect.arrayContaining([{ role: 'SCHOOL_ADMIN' }, { role: 'FINANCE_MANAGER' }])); const revoked = await memberships.revoke(owner.id, current.id, ownerMembership.id, uuid(), uuid(), { reason: 'self' }); await expect(memberships.operation(owner.id, current.id, revoked.id)).resolves.toMatchObject({ id: revoked.id });
  });
  it('scopes the same idempotency key independently by School and records typed membership provenance', async () => {
    const actor = await identity(); const targetA = await identity(); const targetB = await identity(); const a = await school('Idempotency A'); const b = await school('Idempotency B'); const actorA = await grant(a.id, actor.id, 'SCHOOL_ADMIN'); await grant(b.id, actor.id, 'SCHOOL_ADMIN'); const sharedKey = uuid();
    const first = await memberships.create(actor.id, a.id, sharedKey, uuid(), { email: targetA.emailNormalized, roles: ['CLASS_TEACHER'], reason: 'A' }); const second = await memberships.create(actor.id, b.id, sharedKey, uuid(), { email: targetB.emailNormalized, roles: ['CLASS_TEACHER'], reason: 'B' }); expect(second.id).not.toBe(first.id);
    const audit = await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: a.id, action: 'MEMBERSHIP_CREATED' } }); expect(audit).toMatchObject({ actorIdentityId: actor.id, actorType: 'SCHOOL_MEMBERSHIP', actorReference: actorA.id, membershipId: actorA.id, reason: 'A' }); expect(audit.provenance).toMatchObject({ operationId: first.id });
    await expect(memberships.operation(actor.id, b.id, first.id)).rejects.toMatchObject({ status: 404 });
  });
  it('uses the partial School idempotency index for concurrent equal retries exactly once', async () => {
    const current = await school('Concurrent replay'); const actor = await identity(); const target = await identity(); await grant(current.id, actor.id, 'SCHOOL_ADMIN'); const requestKey = uuid(); const input = { email: target.emailNormalized, roles: ['CLASS_TEACHER'], reason: 'concurrent' };
    const results = await Promise.all([memberships.create(actor.id, current.id, requestKey, uuid(), input), memberships.create(actor.id, current.id, requestKey, uuid(), { roles: ['CLASS_TEACHER'], reason: 'concurrent', email: target.emailNormalized })]);
    expect(new Set(results.map((result) => result.id)).size).toBe(1); await expect(prisma.operation.count({ where: { schoolId: current.id, idempotencyKey: requestKey } })).resolves.toBe(1); await expect(prisma.auditRecord.count({ where: { schoolId: current.id, action: 'MEMBERSHIP_CREATED' } })).resolves.toBe(1); await expect(prisma.schoolMembership.count({ where: { schoolId: current.id, userIdentityId: target.id } })).resolves.toBe(1);
  });
  it('has replaced and revoked membership audit provenance including actor, reason, and operation', async () => {
    const current = await school('Audit commands'); const actor = await identity(); const target = await identity(); const actorMembership = await grant(current.id, actor.id, 'SCHOOL_ADMIN'); const targetMembership = await grant(current.id, target.id, 'CLASS_TEACHER');
    const replaced = await memberships.replaceRoles(actor.id, current.id, targetMembership.id, uuid(), uuid(), { roles: ['FINANCE_MANAGER'], reason: 'role correction' }); const revoked = await memberships.revoke(actor.id, current.id, targetMembership.id, uuid(), uuid(), { reason: 'access ended' }); const audits = await prisma.auditRecord.findMany({ where: { schoolId: current.id }, orderBy: { createdAt: 'asc' } });
    expect(audits).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'MEMBERSHIP_ROLES_REPLACED', actorIdentityId: actor.id, actorType: 'SCHOOL_MEMBERSHIP', actorReference: actorMembership.id, membershipId: actorMembership.id, reason: 'role correction', provenance: expect.objectContaining({ operationId: replaced.id }) }), expect.objectContaining({ action: 'MEMBERSHIP_REVOKED', actorIdentityId: actor.id, actorType: 'SCHOOL_MEMBERSHIP', actorReference: actorMembership.id, membershipId: actorMembership.id, reason: 'access ended', provenance: expect.objectContaining({ operationId: revoked.id }) })]));
  });
  it('proves migrated partial indexes replace the stale global idempotency index', async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'Operation'`;
    expect(indexes.map((index) => index.indexname)).toEqual(expect.arrayContaining(['Operation_school_idempotency_scope_key', 'Operation_platform_idempotency_scope_key'])); expect(indexes.map((index) => index.indexname)).not.toEqual(expect.arrayContaining(['Operation_actorReference_route_idempotencyKey_key', 'Operation_schoolId_actorReference_route_fingerprint_key']));
    expect(indexes.filter((index) => index.indexname.endsWith('idempotency_scope_key')).every((index) => index.indexdef.includes('actorType'))).toBe(true);
  });
  it('rethrows a duplicate Operation id without creating another business outcome or audit', async () => {
    const current = await school('Operation id conflict'); const actor = await identity(); const firstTarget = await identity(); const secondTarget = await identity(); await grant(current.id, actor.id, 'SCHOOL_ADMIN'); const operationId = uuid();
    await memberships.create(actor.id, current.id, uuid(), operationId, { email: firstTarget.emailNormalized, roles: ['CLASS_TEACHER'] }); const audits = await prisma.auditRecord.count({ where: { schoolId: current.id } });
    await expect(memberships.create(actor.id, current.id, uuid(), operationId, { email: secondTarget.emailNormalized, roles: ['CLASS_TEACHER'] })).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.schoolMembership.count({ where: { schoolId: current.id, userIdentityId: secondTarget.id } })).resolves.toBe(0); await expect(prisma.auditRecord.count({ where: { schoolId: current.id } })).resolves.toBe(audits);
  });
  it('rethrows an existing membership unique violation without an Operation or audit', async () => {
    const current = await school('Existing membership'); const actor = await identity(); const target = await identity(); await grant(current.id, actor.id, 'SCHOOL_ADMIN'); await grant(current.id, target.id, 'CLASS_TEACHER'); const operations = await prisma.operation.count({ where: { schoolId: current.id } }); const audits = await prisma.auditRecord.count({ where: { schoolId: current.id } });
    await expect(memberships.create(actor.id, current.id, uuid(), uuid(), { email: target.emailNormalized, roles: ['FINANCE_MANAGER'] })).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.operation.count({ where: { schoolId: current.id } })).resolves.toBe(operations); await expect(prisma.auditRecord.count({ where: { schoolId: current.id } })).resolves.toBe(audits);
  });
  it('denies a self-revoke operation outcome after its School is suspended', async () => {
    const current = await school('Suspended operation'); const owner = await identity(); const other = await identity(); const membership = await grant(current.id, owner.id, 'SCHOOL_ADMIN'); await grant(current.id, other.id, 'SCHOOL_ADMIN'); const result = await memberships.revoke(owner.id, current.id, membership.id, uuid(), uuid(), { reason: 'self' }); await prisma.school.update({ where: { id: current.id }, data: { status: 'SUSPENDED' } });
    await expect(memberships.operation(owner.id, current.id, result.id)).rejects.toMatchObject({ status: 404 });
  });
});
