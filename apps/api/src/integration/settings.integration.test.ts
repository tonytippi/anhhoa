import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AuthorizationService } from '../modules/authorization/authorization.service.js';
import { PrismaService } from '../modules/identity/prisma.service.js';
import { SettingsService } from '../modules/settings/settings.service.js';

const prisma = new PrismaService();
const settings = new SettingsService(prisma, new AuthorizationService(prisma));
const schools: string[] = [];
const uuid = () => crypto.randomUUID();
async function graph() { const school = await prisma.school.create({ data: { name: 'Settings', slug: `settings-${uuid()}`, studentCodePrefix: 'ST' } }); schools.push(school.id); const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } }); const membership = await prisma.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: identity.id } }); await prisma.schoolRoleGrant.create({ data: { schoolId: school.id, membershipId: membership.id, role: 'SCHOOL_ADMIN' } }); return { school, identity, membership }; }
afterEach(async () => { const ids = schools.splice(0); if (!ids.length) return; await prisma.$transaction(async (tx) => { await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`; await tx.auditRecord.deleteMany({ where: { schoolId: { in: ids } } }); await tx.operation.deleteMany({ where: { schoolId: { in: ids } } }); await tx.schoolCalendarHoliday.deleteMany({ where: { schoolId: { in: ids } } }); await tx.schoolCalendarVersion.deleteMany({ where: { schoolId: { in: ids } } }); await tx.schoolProfileVersion.deleteMany({ where: { schoolId: { in: ids } } }); await tx.schoolRoleGrant.deleteMany({ where: { schoolId: { in: ids } } }); await tx.schoolMembership.deleteMany({ where: { schoolId: { in: ids } } }); await tx.school.deleteMany({ where: { id: { in: ids } } }); }); });
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('settings PostgreSQL invariants', () => {
  it('isolates tenant writes, resolves immutable versions as-of, and audits old/new values', async () => {
    const a = await graph(); const b = await graph();
    const old = await settings.createProfile(a.identity.id, a.school.id, uuid(), uuid(), { effectiveFrom: '2026-01-01', schoolName: 'Cũ' });
    await settings.createProfile(a.identity.id, a.school.id, uuid(), uuid(), { effectiveFrom: '2026-06-01', schoolName: 'Mới' });
    await settings.createCalendar(a.identity.id, a.school.id, uuid(), uuid(), { effectiveFrom: '2026-01-01', holidays: [{ name: 'Tết', startsOn: '2026-02-01', endsOn: '2026-02-03' }] });
    await expect(settings.read(a.identity.id, a.school.id, '2026-05-31')).resolves.toMatchObject({ profile: { schoolName: 'Cũ' }, calendar: { holidays: [{ name: 'Tết', startsOn: '2026-02-01', endsOn: '2026-02-03' }] } });
    await expect(settings.read(a.identity.id, a.school.id, '2026-06-01')).resolves.toMatchObject({ profile: { schoolName: 'Mới' } });
    await expect(settings.createProfile(b.identity.id, b.school.id, uuid(), uuid(), { effectiveFrom: '2026-01-01', schoolName: 'Khác' })).resolves.toBeTruthy();
    await expect(settings.read(a.identity.id, a.school.id, '2026-01-01')).resolves.toMatchObject({ profile: { schoolName: 'Cũ' } });
    expect(await prisma.auditRecord.findFirst({ where: { schoolId: a.school.id, action: 'SCHOOL_PROFILE_VERSION_CREATED' } })).toMatchObject({ provenance: { oldValue: null, newValue: { schoolName: 'Cũ' } } });
    expect(old.outcome).toMatchObject({ schoolName: 'Cũ' });
  });
  it('enforces same-day version uniqueness, inclusive holiday non-overlap, tenant graph, and immutable records', async () => {
    const a = await graph(); const b = await graph();
    const created = await settings.createCalendar(a.identity.id, a.school.id, uuid(), uuid(), { effectiveFrom: '2026-01-01', holidays: [{ name: 'A', startsOn: '2026-02-01', endsOn: '2026-02-03' }] });
    await expect(settings.createCalendar(a.identity.id, a.school.id, uuid(), uuid(), { effectiveFrom: '2026-01-01', holidays: [] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { effectiveFrom: expect.any(String) } } });
    await expect(prisma.schoolCalendarHoliday.create({ data: { schoolId: a.school.id, calendarVersionId: (created.outcome as { id: string }).id, name: 'Chồng', startsOn: new Date('2026-02-03T00:00:00Z'), endsOn: new Date('2026-02-04T00:00:00Z') } })).rejects.toBeTruthy();
    await expect(prisma.schoolCalendarHoliday.create({ data: { schoolId: b.school.id, calendarVersionId: (created.outcome as { id: string }).id, name: 'Ngoại trường', startsOn: new Date('2026-03-01T00:00:00Z'), endsOn: new Date('2026-03-02T00:00:00Z') } })).rejects.toMatchObject({ code: 'P2003' });
    const calendarId = (created.outcome as { id: string }).id;
    expect(await prisma.schoolCalendarVersion.findUniqueOrThrow({ where: { id: calendarId } })).toMatchObject({ effectiveFrom: new Date('2026-01-01T00:00:00.000Z') });
    await expect(prisma.schoolCalendarVersion.update({ where: { id: calendarId }, data: { effectiveFrom: new Date('2026-01-02T00:00:00.000Z') } })).rejects.toBeTruthy();
    await expect(prisma.schoolCalendarVersion.delete({ where: { id: calendarId } })).rejects.toBeTruthy();
    const holiday = await prisma.schoolCalendarHoliday.findFirstOrThrow({ where: { schoolId: a.school.id } });
    await expect(prisma.schoolCalendarHoliday.update({ where: { id: holiday.id }, data: { name: 'Không được sửa' } })).rejects.toBeTruthy();
    await expect(prisma.schoolCalendarHoliday.delete({ where: { id: holiday.id } })).rejects.toBeTruthy();
    const profile = await settings.createProfile(a.identity.id, a.school.id, uuid(), uuid(), { effectiveFrom: '2026-03-01', schoolName: 'Không sửa' });
    await expect(prisma.schoolProfileVersion.update({ where: { id: (profile.outcome as { id: string }).id }, data: { schoolName: 'Không được sửa' } })).rejects.toBeTruthy();
  });
});
