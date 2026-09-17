import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApi } from '../main.js';
import { PrismaService } from '../modules/identity/prisma.service.js';

const prisma = new PrismaService();
const ids = { schools: [] as string[], identities: [] as string[] };
let baseUrl = '';
let app: Awaited<ReturnType<typeof createApi>>;
const uuid = () => crypto.randomUUID();

function cookie(headers: Headers, name: string) {
  return headers.getSetCookie().find((value) => value.startsWith(`${name}=`))?.split(';')[0];
}

async function login(audience: 'app' | 'teacher' | 'parent' | 'ops', email: string) {
  const start = await fetch(`${baseUrl}/api/${audience}/auth/google/start`, { redirect: 'manual' });
  const location = new URL(start.headers.get('location')!);
  const state = location.searchParams.get('state')!;
  const nonce = location.searchParams.get('nonce')!;
  const clientId = location.searchParams.get('client_id')!;
  const correlation = cookie(start.headers, `${audience}_oauth_correlation`)!;
  const token = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', sub: `release-${uuid()}`, email, email_verified: true, aud: clientId, nonce, exp: Math.ceil(Date.now() / 1000) + 600 })).toString('base64url');
  const callback = await fetch(`${baseUrl}/api/${audience}/auth/google/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(token)}`, { redirect: 'manual', headers: { cookie: correlation } });
  return { status: callback.status, session: cookie(callback.headers, `${audience}_session`), csrf: cookie(callback.headers, `${audience}_csrf`)?.split('=')[1] };
}

const error = async (response: Response) => (await response.json() as { error: { code: string; message: string } }).error;
const appHeaders = (session: { session?: string; csrf?: string }, key = uuid()) => ({ cookie: `${session.session}; app_csrf=${session.csrf}`, origin: 'http://localhost:5173', 'x-csrf-token': session.csrf!, 'idempotency-key': key, 'x-operation-id': uuid(), 'content-type': 'application/json' });
const opsHeaders = (session: { session?: string; csrf?: string }, key = uuid()) => ({ cookie: `${session.session}; ops_csrf=${session.csrf}`, origin: 'http://localhost:5176', 'x-csrf-token': session.csrf!, 'idempotency-key': key, 'x-operation-id': uuid(), 'content-type': 'application/json' });

async function identity(email: string) {
  const result = await prisma.userIdentity.findUniqueOrThrow({ where: { emailNormalized: email } });
  ids.identities.push(result.id);
  return result;
}

async function school(name: string) {
  const result = await prisma.school.create({ data: { name, slug: `release-${uuid()}`, studentCodePrefix: 'S' } });
  ids.schools.push(result.id);
  return result;
}

async function grant(schoolId: string, userIdentityId: string, role: 'SCHOOL_ADMIN' | 'FINANCE_MANAGER' | 'CLASS_TEACHER' = 'SCHOOL_ADMIN') {
  const membership = await prisma.schoolMembership.create({ data: { schoolId, userIdentityId } });
  await prisma.schoolRoleGrant.create({ data: { schoolId, membershipId: membership.id, role } });
  return membership;
}

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('Epic 1 release gate through HTTP', () => {
  beforeAll(async () => {
    app = await createApi();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    const memberships = await prisma.schoolMembership.findMany({ where: { schoolId: { in: ids.schools } }, select: { userIdentityId: true } });
    ids.identities.push(...memberships.map((membership) => membership.userIdentityId));
    const identityIds = [...new Set(ids.identities)];
    await prisma.auditRecord.deleteMany({ where: { schoolId: { in: ids.schools } } });
    await prisma.operation.deleteMany({ where: { OR: [{ schoolId: { in: ids.schools } }, { actorIdentityId: { in: identityIds } }] } });
    await prisma.schoolRoleGrant.deleteMany({ where: { schoolId: { in: ids.schools } } });
    await prisma.schoolMembership.deleteMany({ where: { schoolId: { in: ids.schools } } });
    await prisma.school.deleteMany({ where: { id: { in: ids.schools.splice(0) } } });
    await prisma.platformOperatorGrant.deleteMany({ where: { userIdentityId: { in: identityIds } } });
    await prisma.userIdentity.deleteMany({ where: { id: { in: identityIds } } });
    ids.identities.splice(0);
  });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it('rejects cross-School selectors before state changes, scopes idempotency, and records provenance', async () => {
    const actorEmail = `release-${uuid()}@example.com`; const adminEmail = `release-admin-${uuid()}@example.com`;
    const actorSession = await login('app', actorEmail); const adminSession = await login('app', adminEmail);
    expect(actorSession).toMatchObject({ status: 302 }); expect(adminSession).toMatchObject({ status: 302 });
    const actor = await identity(actorEmail); const secondAdmin = await identity(adminEmail);
    const a = await school('Release A'); const b = await school('Release B');
    const membershipA = await grant(a.id, actor.id); await grant(b.id, actor.id); await grant(a.id, secondAdmin.id);
    const crossSchool = await fetch(`${baseUrl}/api/app/schools/${b.id}/memberships/${membershipA.id}/revoke`, { method: 'POST', headers: appHeaders(actorSession), body: JSON.stringify({ reason: 'crafted' }) });
    expect(crossSchool.status).toBe(404); expect(await error(crossSchool)).toMatchObject({ code: 'MEMBERSHIP_NOT_FOUND' });
    expect(await prisma.schoolMembership.findUniqueOrThrow({ where: { id: membershipA.id } })).toMatchObject({ status: 'ACTIVE', schoolId: a.id });
    expect(await prisma.operation.count({ where: { schoolId: b.id } })).toBe(0); expect(await prisma.auditRecord.count({ where: { schoolId: b.id } })).toBe(0);

    const key = uuid(); const bodyA = { email: `target-a-${uuid()}@example.com`, roles: ['CLASS_TEACHER'], reason: 'release gate' }; const bodyB = { email: `target-b-${uuid()}@example.com`, roles: ['CLASS_TEACHER'], reason: 'release gate' };
    const createdA = await fetch(`${baseUrl}/api/app/schools/${a.id}/memberships`, { method: 'POST', headers: appHeaders(actorSession, key), body: JSON.stringify(bodyA) });
    const createdB = await fetch(`${baseUrl}/api/app/schools/${b.id}/memberships`, { method: 'POST', headers: appHeaders(actorSession, key), body: JSON.stringify(bodyB) });
    expect(createdA.status).toBe(201); expect(createdB.status).toBe(201);
    const operationA = ((await createdA.json()) as { data: { id: string; status: string; outcome: { membershipId: string } } }).data;
    const operationB = ((await createdB.json()) as { data: { id: string; status: string; outcome: { membershipId: string } } }).data;
    expect(operationB.id).not.toBe(operationA.id); expect(operationB.status).toBe('COMPLETED');
    expect(operationA.status).toBe('COMPLETED');
    const targetMembership = await prisma.schoolMembership.findUniqueOrThrow({ where: { id: operationA.outcome.membershipId } }); ids.identities.push(targetMembership.userIdentityId);
    const operation = await prisma.operation.findUniqueOrThrow({ where: { id: operationA.id } });
    const audit = await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: a.id, action: 'MEMBERSHIP_CREATED' } });
    expect(operation).toMatchObject({ schoolId: a.id, actorIdentityId: actor.id, membershipId: membershipA.id, actorType: 'SCHOOL_MEMBERSHIP', actorReference: membershipA.id, idempotencyKey: key, status: 'COMPLETED' });
    expect(audit).toMatchObject({ actorIdentityId: actor.id, membershipId: membershipA.id, actorType: 'SCHOOL_MEMBERSHIP', actorReference: membershipA.id, provenance: { operationId: operationA.id, targetMembershipId: targetMembership.id } });
    expect((await fetch(`${baseUrl}/api/app/schools/${b.id}/operations/${operationA.id}`, { headers: { cookie: actorSession.session! } })).status).toBe(404);

    const revoke = await fetch(`${baseUrl}/api/app/schools/${a.id}/memberships/${membershipA.id}/revoke`, { method: 'POST', headers: appHeaders(adminSession), body: JSON.stringify({ reason: 'release revoke' }) });
    expect(revoke.status).toBe(201); expect(((await revoke.json()) as { data: { status: string } }).data.status).toBe('COMPLETED');
    expect(await prisma.schoolMembership.findUniqueOrThrow({ where: { id: membershipA.id } })).toMatchObject({ status: 'REVOKED' });
    expect((await fetch(`${baseUrl}/api/app/schools/${a.id}`, { headers: { cookie: actorSession.session! } })).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/app/schools/${b.id}`, { headers: { cookie: actorSession.session! } })).status).toBe(200);
  });

  it('proves every issued audience session is rejected by every other audience endpoint, keeps Parent fail-closed, enforces mutation origin, and suspends through Ops', async () => {
    const appEmail = `audience-app-${uuid()}@example.com`; const teacherEmail = `audience-teacher-${uuid()}@example.com`; const operatorEmail = `audience-ops-${uuid()}@example.com`;
    process.env.SUPERADMIN_EMAIL = operatorEmail;
    const appSession = await login('app', appEmail); const teacherSession = await login('teacher', teacherEmail); const opsSession = await login('ops', operatorEmail);
    expect(appSession).toMatchObject({ status: 302, session: expect.any(String) }); expect(teacherSession).toMatchObject({ status: 302, session: expect.any(String) }); expect(opsSession).toMatchObject({ status: 302, session: expect.any(String) });
    const actor = await identity(appEmail); const operator = await identity(operatorEmail); const target = await school('Audience'); await grant(target.id, actor.id);
    await prisma.platformOperatorGrant.upsert({ where: { userIdentityId: operator.id }, create: { userIdentityId: operator.id }, update: { revokedAt: null } });
    const issued = [{ audience: 'app', session: appSession }, { audience: 'teacher', session: teacherSession }, { audience: 'ops', session: opsSession }] as const;
    for (const source of issued) {
      expect((await fetch(`${baseUrl}/api/${source.audience}/auth/session`, { headers: { cookie: source.session.session! } })).status).toBe(200);
      for (const destination of ['app', 'teacher', 'parent', 'ops'] as const) {
        if (destination === source.audience) continue;
        const response = await fetch(`${baseUrl}/api/${destination}/auth/session`, { headers: { cookie: source.session.session! } });
        expect(response.status).toBe(401); expect(await error(response)).toMatchObject({ code: 'AUTHENTICATION_REQUIRED', message: 'Cần đăng nhập.' });
      }
    }
    const parent = await login('parent', `audience-parent-${uuid()}@example.com`);
    expect(parent).toMatchObject({ status: 302, session: undefined, csrf: undefined });
    expect((await fetch(`${baseUrl}/api/parent/auth/session`)).status).toBe(401);
    const before = await prisma.operation.count({ where: { schoolId: target.id } });
    const invalidOrigin = await fetch(`${baseUrl}/api/app/schools/${target.id}/memberships`, { method: 'POST', headers: { ...appHeaders(appSession), origin: 'http://localhost:5174' }, body: JSON.stringify({ email: `blocked-${uuid()}@example.com`, roles: ['CLASS_TEACHER'] }) });
    expect(invalidOrigin.status).toBe(401); expect(await error(invalidOrigin)).toMatchObject({ code: 'CSRF_INVALID' }); expect(await prisma.operation.count({ where: { schoolId: target.id } })).toBe(before);

    const suspended = await fetch(`${baseUrl}/api/ops/schools/${target.id}/suspend`, { method: 'POST', headers: opsHeaders(opsSession) });
    expect(suspended.status).toBe(201); const lifecycle = ((await suspended.json()) as { data: { id: string; status: string } }).data; expect(lifecycle.status).toBe('COMPLETED');
    expect((await fetch(`${baseUrl}/api/app/schools/${target.id}`, { headers: { cookie: appSession.session! } })).status).toBe(404);
    expect(await prisma.school.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({ status: 'SUSPENDED' });
    expect(await prisma.operation.findUniqueOrThrow({ where: { id: lifecycle.id } })).toMatchObject({ schoolId: target.id, actorIdentityId: operator.id, actorType: 'PLATFORM_OPERATOR_GRANT', status: 'COMPLETED' });
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: target.id, action: 'SCHOOL_SUSPENDED' } })).toMatchObject({ actorIdentityId: operator.id, actorType: 'PLATFORM_OPERATOR_GRANT', provenance: { operationId: lifecycle.id } });
  });
});
