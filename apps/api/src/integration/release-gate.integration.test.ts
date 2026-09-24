import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApi } from '../main.js';
import { PrismaService } from '../modules/identity/prisma.service.js';

const prisma = new PrismaService();
const schools: string[] = [];
const parentProfiles: string[] = [];
let app: Awaited<ReturnType<typeof createApi>>;
let baseUrl = '';
const uuid = () => crypto.randomUUID();

function cookie(headers: Headers, name: string) { return headers.getSetCookie().find((value) => value.startsWith(`${name}=`))?.split(';')[0]; }
async function login(email: string, audience: 'app' | 'parent' = 'app') { const start = await fetch(`${baseUrl}/api/${audience}/auth/google/start`, { redirect: 'manual' }); const url = new URL(start.headers.get('location')!); const state = url.searchParams.get('state')!; const nonce = url.searchParams.get('nonce')!; const correlation = cookie(start.headers, `${audience}_oauth_correlation`)!; const token = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', sub: `release-${uuid()}`, email, email_verified: true, aud: url.searchParams.get('client_id')!, nonce, exp: Math.ceil(Date.now() / 1000) + 600 })).toString('base64url'); const callback = await fetch(`${baseUrl}/api/${audience}/auth/google/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(token)}`, { redirect: 'manual', headers: { cookie: correlation } }); return { session: cookie(callback.headers, `${audience}_session`)!, csrf: cookie(callback.headers, `${audience}_csrf`)!.split('=')[1]! }; }
const headers = (session: { session: string; csrf: string }) => ({ cookie: `${session.session}; app_csrf=${session.csrf}`, origin: 'http://localhost:5173', 'x-csrf-token': session.csrf, 'idempotency-key': uuid(), 'x-operation-id': uuid(), 'content-type': 'application/json' });
async function actor(schoolId: string, email: string) { const identity = await prisma.userIdentity.findUniqueOrThrow({ where: { emailNormalized: email } }); const membership = await prisma.schoolMembership.create({ data: { schoolId, userIdentityId: identity.id } }); const fallbackIdentity = await prisma.userIdentity.create({ data: { emailNormalized: `release-fallback-${uuid()}@example.com` } }); const fallbackMembership = await prisma.schoolMembership.create({ data: { schoolId, userIdentityId: fallbackIdentity.id } }); const position = await prisma.schoolPosition.create({ data: { schoolId, code: `RELEASE_${uuid().replaceAll('-', '').slice(0, 12)}`, name: `Release ${uuid()}` } }); const fallbackPosition = await prisma.schoolPosition.create({ data: { schoolId, code: `RELEASE_FALLBACK_${uuid().replaceAll('-', '').slice(0, 12)}`, name: `Release fallback ${uuid()}` } }); await prisma.positionCapabilityGrant.createMany({ data: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'].map((capability) => ({ schoolId, positionId: position.id, capability })) }); await prisma.positionCapabilityGrant.create({ data: { schoolId, positionId: fallbackPosition.id, capability: 'ROSTER_MANAGE' } }); await prisma.staffProfile.create({ data: { schoolId, fullName: 'Release actor', email, phone: '0900000000', dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), gender: 'Khác', address: 'Test', primaryPositionId: position.id, schoolMembershipId: membership.id, boundAt: new Date(), boundByMembershipId: membership.id } }); await prisma.staffProfile.create({ data: { schoolId, fullName: 'Release fallback manager', email: fallbackIdentity.emailNormalized, phone: '0900000001', dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), gender: 'Khác', address: 'Test', primaryPositionId: fallbackPosition.id, schoolMembershipId: fallbackMembership.id, boundAt: new Date(), boundByMembershipId: fallbackMembership.id } }); return { membership, position }; }

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('SchoolPosition HTTP release gate', () => {
  beforeAll(async () => { app = await createApi(); await app.listen(0, '127.0.0.1'); baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`; });
  afterEach(async () => { const ids = schools.splice(0); await prisma.auditRecord.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.operation.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.leaveRequestDay.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.leaveRequest.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.studentParent.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.student.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.staffProfile.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.schoolPosition.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.schoolMembership.deleteMany({ where: { schoolId: { in: ids } } }); await prisma.school.deleteMany({ where: { id: { in: ids } } }); await prisma.parentProfile.deleteMany({ where: { id: { in: parentProfiles.splice(0) } } }); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it('authorizes a Position capability, then denies the next request after it is revoked', async () => {
    const email = `release-${uuid()}@example.com`; const session = await login(email); const school = await prisma.school.create({ data: { name: 'Release', slug: `release-${uuid()}`, studentCodePrefix: 'R' } }); schools.push(school.id); const { position } = await actor(school.id, email);
    await expect(fetch(`${baseUrl}/api/app/schools/${school.id}/roster/positions`, { headers: { cookie: session.session } })).resolves.toMatchObject({ status: 200 });
    const revoke = await fetch(`${baseUrl}/api/app/schools/${school.id}/roster/positions/${position.id}/grants/ROSTER_MANAGE/revoke`, { method: 'POST', headers: headers(session), body: JSON.stringify({ reason: 'Thu hồi kiểm thử' }) });
    expect(revoke.status).toBe(201);
    await expect(fetch(`${baseUrl}/api/app/schools/${school.id}/roster/positions`, { headers: { cookie: session.session } })).resolves.toMatchObject({ status: 403 });
  });
  it('does not let a Parent session access teacher/app operations or evidence and returns a minimum leave DTO', async () => {
    const school = await prisma.school.create({ data: { name: 'Parent release', slug: `parent-release-${uuid()}`, studentCodePrefix: 'P' } }); schools.push(school.id);
    const email = `parent-release-${uuid()}@example.com`;
    const parent = await prisma.parentProfile.create({ data: { emailNormalized: email, fullName: 'Phụ huynh Release', phone: '0900000013' } }); parentProfiles.push(parent.id);
    const student = await prisma.student.create({ data: { schoolId: school.id, studentCode: `P-${uuid()}`, fullName: 'Bé Parent', dateOfBirth: new Date('2022-01-01T00:00:00.000Z') } });
    await prisma.studentParent.create({ data: { schoolId: school.id, studentId: student.id, parentProfileId: parent.id } });
    const leave = await prisma.leaveRequest.create({ data: { schoolId: school.id, studentId: student.id, parentProfileId: parent.id, status: 'PENDING', policyEffectiveFrom: new Date('2026-01-01T00:00:00.000Z'), policyDeadlineLocalTime: '08:00' } });
    const session = await login(email, 'parent');
    const parentHeaders = { cookie: session.session };
    await expect(fetch(`${baseUrl}/api/teacher/schools/${school.id}/attendance`, { method: 'POST', headers: { ...parentHeaders, 'idempotency-key': uuid(), 'x-operation-id': uuid(), 'content-type': 'application/json' }, body: JSON.stringify({ classId: uuid(), studentId: student.id, attendanceOn: '2026-02-09', state: 'PRESENT' }) })).resolves.toMatchObject({ status: 401 });
    await expect(fetch(`${baseUrl}/api/app/schools/${school.id}/leave-requests/${leave.id}/approve`, { method: 'POST', headers: { ...parentHeaders, origin: 'http://localhost:5173', 'x-csrf-token': session.csrf, 'idempotency-key': uuid(), 'x-operation-id': uuid() } })).resolves.toMatchObject({ status: 401 });
    await expect(fetch(`${baseUrl}/api/teacher/schools/${school.id}/attendance-evidence/${uuid()}`, { headers: parentHeaders })).resolves.toMatchObject({ status: 401 });
    expect(await prisma.attendanceRecord.count({ where: { schoolId: school.id } })).toBe(0);
    expect(await prisma.operation.count({ where: { schoolId: school.id } })).toBe(0);
    const response = await fetch(`${baseUrl}/api/parent/schools/${school.id}/leave-requests`, { headers: parentHeaders });
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Array<Record<string, unknown>> };
    expect(body.data).toEqual([expect.objectContaining({ id: leave.id, studentId: student.id, status: 'PENDING', startsOn: null })]);
    expect(Object.keys(body.data[0]!)).toEqual(['id', 'studentId', 'status', 'startsOn', 'operatingDates', 'createdAt']);
  });
});
