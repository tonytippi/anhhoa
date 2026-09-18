import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AuthorizationService } from '../modules/authorization/authorization.service.js';
import { PrismaService } from '../modules/identity/prisma.service.js';
import { SettingsService } from '../modules/settings/settings.service.js';

const prisma = new PrismaService();
const settings = new SettingsService(prisma, new AuthorizationService(prisma));
const schools: string[] = [];
const uuid = () => crypto.randomUUID();
async function graph() { const school = await prisma.school.create({ data: { name: 'Settings', slug: `settings-${uuid()}`, studentCodePrefix: 'ST' } }); schools.push(school.id); const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } }); const membership = await prisma.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: identity.id } }); await prisma.schoolRoleGrant.create({ data: { schoolId: school.id, membershipId: membership.id, role: 'SCHOOL_ADMIN' } }); return { school, identity, membership }; }
afterEach(async () => { const ids = schools.splice(0); if (!ids.length) return; await prisma.$transaction(async (tx) => { await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`; await tx.auditRecord.deleteMany({ where: { schoolId: { in: ids } } }); await tx.bankAccountLifecycleTransition.deleteMany({ where: { schoolId: { in: ids } } }); await tx.operation.deleteMany({ where: { schoolId: { in: ids } } }); await tx.bankAccount.deleteMany({ where: { schoolId: { in: ids } } }); await tx.financePolicy.deleteMany({ where: { schoolId: { in: ids } } }); await tx.schoolCalendarHoliday.deleteMany({ where: { schoolId: { in: ids } } }); await tx.schoolCalendarVersion.deleteMany({ where: { schoolId: { in: ids } } }); await tx.schoolProfileVersion.deleteMany({ where: { schoolId: { in: ids } } }); await tx.schoolRoleGrant.deleteMany({ where: { schoolId: { in: ids } } }); await tx.schoolMembership.deleteMany({ where: { schoolId: { in: ids } } }); await tx.school.deleteMany({ where: { id: { in: ids } } }); }); });
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
  it('keeps FinancePolicy append-only and BankAccount financial identity immutable across lifecycle history', async () => {
    const a = await graph(); const b = await graph();
    const policy = await settings.createFinancePolicy(a.identity.id, a.school.id, uuid(), uuid(), { effectiveFrom: '2026-01-01', dueDaysAfterIssue: 30, taxTreatment: 'NOT_APPLICABLE', debtScope: 'CURRENT_SCHOOL_YEAR_ONLY', reversalMode: 'DIRECT' });
    await settings.createFinancePolicy(a.identity.id, a.school.id, uuid(), uuid(), { effectiveFrom: '2026-06-01', dueDaysAfterIssue: 14, taxTreatment: 'TAX_INCLUDED', debtScope: 'CURRENT_SCHOOL_YEAR_ONLY', reversalMode: 'SCHOOL_ADMIN_APPROVAL' });
    const account = await settings.createBankAccount(a.identity.id, a.school.id, uuid(), uuid(), { receivingBank: 'Ngân hàng A', accountNumber: '123', accountHolderName: 'Trường A', transferTemplate: '{{studentName}} {{className}}' });
    const accountId = (account.outcome as { id: string }).id;
    await settings.transitionBankAccount(a.identity.id, a.school.id, accountId, uuid(), uuid(), { status: 'INACTIVE', reason: 'Đổi tài khoản' });
    await expect(settings.read(a.identity.id, a.school.id)).resolves.toMatchObject({ bankAccounts: [{ id: accountId, status: 'INACTIVE', lifecycleTransitions: [{ previousStatus: 'ACTIVE', status: 'INACTIVE', reason: 'Đổi tài khoản' }, { previousStatus: null, status: 'ACTIVE' }] }] });
    await expect(prisma.financePolicy.update({ where: { id: (policy.outcome as { id: string }).id }, data: { dueDaysAfterIssue: 1 } })).rejects.toBeTruthy();
    await expect(prisma.bankAccount.update({ where: { id: accountId }, data: { accountNumber: '456' } })).rejects.toBeTruthy();
    await expect(prisma.bankAccountLifecycleTransition.create({ data: { schoolId: b.school.id, bankAccountId: accountId, previousStatus: 'INACTIVE', status: 'ACTIVE', reason: 'Sai tenant', actorIdentityId: b.identity.id, membershipId: b.membership.id, operationId: uuid(), sequence: 2 } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(settings.transitionBankAccount(a.identity.id, b.school.id, accountId, uuid(), uuid(), { status: 'ACTIVE', reason: 'Ngoại trường' })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.auditRecord.findFirst({ where: { schoolId: a.school.id, action: 'BANK_ACCOUNT_LIFECYCLE_CHANGED' } })).toMatchObject({ provenance: { oldValue: { status: 'ACTIVE' }, newValue: { status: 'INACTIVE' } } });
  });
});
