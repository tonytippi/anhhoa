import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from './settings.service.js';

const actor = { membershipId: 'membership' };
const authorization = { resolve: vi.fn().mockResolvedValue(actor) };

describe('SettingsService validation and read scope', () => {
  it('returns field errors for invalid dates and overlapping holiday ranges before a write', async () => {
    const prisma = { schoolProfileVersion: { findFirst: vi.fn() }, schoolCalendarVersion: { findFirst: vi.fn() }, financePolicy: { findFirst: vi.fn() }, bankAccount: { findMany: vi.fn() } };
    const service = new SettingsService(prisma as never, authorization as never);
    await expect(service.createProfile('identity', 'school', crypto.randomUUID(), crypto.randomUUID(), { effectiveFrom: '2026-02-30', schoolName: 'A' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { effectiveFrom: expect.any(String) } } });
    await expect(service.createCalendar('identity', 'school', crypto.randomUUID(), crypto.randomUUID(), { effectiveFrom: '2026-01-01', holidays: [{ name: 'Tết', startsOn: '2026-02-05', endsOn: '2026-02-01' }] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { endsOn: expect.any(String) } } });
    await expect(service.createCalendar('identity', 'school', crypto.randomUUID(), crypto.randomUUID(), { effectiveFrom: '2026-01-01', holidays: [{ name: 'A', startsOn: '2026-02-01', endsOn: '2026-02-03' }, { name: 'B', startsOn: '2026-02-03', endsOn: '2026-02-05' }] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { startsOn: expect.any(String) } } });
  });
  it('reads profile and calendar as-of with the School tenant selector', async () => {
    const profile = { id: 'profile', effectiveFrom: new Date('2026-01-01T00:00:00Z'), schoolName: 'A', address: null, phone: null, actorIdentityId: 'identity', membershipId: 'membership', createdAt: new Date('2026-01-01T00:00:00Z') };
    const calendar = { id: 'calendar', effectiveFrom: new Date('2026-01-01T00:00:00Z'), actorIdentityId: 'identity', membershipId: 'membership', createdAt: new Date('2026-01-01T00:00:00Z'), holidays: [] };
    const policy = { id: 'policy', effectiveFrom: new Date('2026-01-01T00:00:00Z'), dueDaysAfterIssue: 30, taxTreatment: 'NOT_APPLICABLE', debtScope: 'CURRENT_SCHOOL_YEAR_ONLY', reversalMode: 'DIRECT', reason: null, createdAt: new Date('2026-01-01T00:00:00Z') };
    const account = { id: 'account', receivingBank: 'A', accountNumber: '1', accountHolderName: 'B', transferTemplate: '{{studentName}} {{className}}', createdAt: new Date('2026-01-01T00:00:00Z'), lifecycleTransitions: [{ previousStatus: null, status: 'ACTIVE', reason: null, sequence: 1, changedAt: new Date('2026-01-01T00:00:00Z') }] };
    const prisma = { schoolProfileVersion: { findFirst: vi.fn().mockResolvedValue(profile) }, schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue(calendar) }, financePolicy: { findMany: vi.fn().mockResolvedValue([policy]) }, bankAccount: { findMany: vi.fn().mockResolvedValue([account]) } };
    const service = new SettingsService(prisma as never, authorization as never);
    await expect(service.read('identity', 'school-a', '2026-02-01')).resolves.toMatchObject({ asOf: '2026-02-01', timezone: 'Asia/Ho_Chi_Minh', profile: { schoolName: 'A' }, calendar: { workweek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] } });
    expect(prisma.schoolProfileVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: 'school-a', effectiveFrom: { lte: new Date('2026-02-01T00:00:00.000Z') } } }));
    expect((await service.read('identity', 'school-a', '2026-02-01')).profile).not.toHaveProperty('actorIdentityId');
    expect((await service.read('identity', 'school-a', '2026-02-01')).calendar).not.toHaveProperty('membershipId');
    await expect(service.read('identity', 'school-a', '2026-02-01')).resolves.toMatchObject({ financePolicy: { dueDaysAfterIssue: 30 }, financePolicyVersions: [{ id: 'policy' }], bankAccounts: [{ status: 'ACTIVE', lifecycleTransitions: [{ status: 'ACTIVE' }] }] });
    expect(prisma.bankAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: { lifecycleTransitions: expect.objectContaining({ where: { changedAt: { lte: expect.any(Date) } } }) } }));
  });
  it('validates typed finance policy and the only permitted transfer template before writes', async () => {
    const prisma = { financePolicy: { findFirst: vi.fn() }, bankAccount: { findMany: vi.fn() } };
    const service = new SettingsService(prisma as never, authorization as never);
    await expect(service.createFinancePolicy('identity', 'school', crypto.randomUUID(), crypto.randomUUID(), { effectiveFrom: '2026-01-01', dueDaysAfterIssue: 366, taxTreatment: 'NOT_APPLICABLE', debtScope: 'CURRENT_SCHOOL_YEAR_ONLY', reversalMode: 'DIRECT' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { dueDaysAfterIssue: expect.any(String) } } });
    await expect(service.createBankAccount('identity', 'school', crypto.randomUUID(), crypto.randomUUID(), { receivingBank: 'A', accountNumber: '1', accountHolderName: 'B', transferTemplate: '{{studentCode}}' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { transferTemplate: expect.any(String) } } });
  });
  it('audits the immediately preceding effective version rather than the latest version', async () => {
    const prior = { id: 'prior', effectiveFrom: new Date('2026-01-01T00:00:00Z'), schoolName: 'Cũ', address: null, phone: null, createdAt: new Date('2026-01-01T00:00:00Z') };
    const created = { ...prior, id: 'new', effectiveFrom: new Date('2026-03-01T00:00:00Z'), schoolName: 'Mới' };
    const tx = { $queryRaw: vi.fn(), schoolMembership: { findFirst: vi.fn().mockResolvedValue({}) }, operation: { create: vi.fn().mockResolvedValue({ id: 'operation' }), update: vi.fn().mockResolvedValue({ id: 'operation', status: 'COMPLETED', outcome: created }) }, schoolProfileVersion: { findFirst: vi.fn().mockResolvedValue(prior), create: vi.fn().mockResolvedValue(created) }, auditRecord: { create: vi.fn() } };
    const prisma = { operation: { findFirst: vi.fn().mockResolvedValue(null) }, $transaction: vi.fn((work: (value: typeof tx) => unknown) => work(tx)) };
    const service = new SettingsService(prisma as never, authorization as never);
    await service.createProfile('identity', 'school', crypto.randomUUID(), crypto.randomUUID(), { effectiveFrom: '2026-03-01', schoolName: 'Mới' });
    expect(tx.schoolProfileVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: 'school', effectiveFrom: { lt: new Date('2026-03-01T00:00:00.000Z') } } }));
    expect(tx.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ provenance: expect.objectContaining({ oldValue: expect.objectContaining({ schoolName: 'Cũ' }) }) }) }));
  });
});
