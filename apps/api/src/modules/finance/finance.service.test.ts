import { describe, expect, it, vi } from 'vitest';
import { FinanceService } from './finance.service.js';

const actor = { membershipId: 'membership' };
const authorization = { resolve: vi.fn().mockResolvedValue(actor) };

describe('FinanceService validation', () => {
  it('rejects invalid VND, group graph ID, lifecycle, and idempotency before writes', async () => {
    const prisma = { operation: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const service = new FinanceService(prisma as never, authorization as never);
    const school = crypto.randomUUID();
    await expect(service.createReceivable('identity', school, crypto.randomUUID(), crypto.randomUUID(), { groupId: 'not-uuid', displayName: 'Học phí', unitLabel: 'tháng', defaultUnitPrice: '1000' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { groupId: expect.any(String) } } });
    await expect(service.createReceivable('identity', school, crypto.randomUUID(), crypto.randomUUID(), { groupId: crypto.randomUUID(), displayName: 'Học phí', unitLabel: 'tháng', defaultUnitPrice: '1.5' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { defaultUnitPrice: expect.any(String) } } });
    await expect(service.createGroup('identity', school, 'not-uuid', crypto.randomUUID(), { name: 'Học phí' })).rejects.toMatchObject({ status: 401, response: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('serializes BigInt VND as a safe JSON integer string and scopes catalog reads by School', async () => {
    const prisma = { receivableGroup: { findMany: vi.fn().mockResolvedValue([{ id: 'group', name: 'Học phí', createdAt: new Date('2026-01-01T00:00:00Z'), lifecycleTransitions: [{ status: 'ACTIVE' }] }]) }, receivable: { findMany: vi.fn().mockResolvedValue([{ id: 'item', groupId: 'group', code: null, displayName: 'Tháng', unitLabel: 'tháng', defaultUnitPrice: 500000n, createdAt: new Date('2026-01-01T00:00:00Z'), lifecycleTransitions: [{ status: 'ACTIVE' }] }]) } };
    const school = crypto.randomUUID(); const result = await new FinanceService(prisma as never, authorization as never).read('identity', school);
    expect(result).toMatchObject({ groups: [{ status: 'ACTIVE' }], receivables: [{ defaultUnitPrice: '500000', status: 'ACTIVE' }] });
    expect(prisma.receivableGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: school } }));
    expect(prisma.receivable.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: school } }));
  });
  it('marks an active Receivable unavailable when its Group is inactive', async () => {
    const prisma = { receivableGroup: { findMany: vi.fn().mockResolvedValue([]) }, receivable: { findMany: vi.fn().mockResolvedValue([{ id: 'item', groupId: 'group', code: null, displayName: 'Tháng', unitLabel: 'tháng', defaultUnitPrice: 500000n, createdAt: new Date(), lifecycleTransitions: [{ status: 'ACTIVE' }], group: { lifecycleTransitions: [{ status: 'INACTIVE' }] } }]) } };
    await expect(new FinanceService(prisma as never, authorization as never).read('identity', crypto.randomUUID())).resolves.toMatchObject({ receivables: [{ status: 'ACTIVE', available: false }] });
  });
  it('replays an existing idempotent result and rejects an operation ID collision', async () => {
    const operation = { id: crypto.randomUUID(), fingerprint: expect.any(String), status: 'COMPLETED', outcome: { id: 'group' } };
    const prisma = { operation: { findFirst: vi.fn().mockResolvedValueOnce({ ...operation, fingerprint: undefined }).mockResolvedValueOnce(null) }, $transaction: vi.fn() };
    const key = crypto.randomUUID(); const input = { name: 'Học phí' };
    prisma.operation.findFirst.mockReset().mockResolvedValueOnce({ ...operation, fingerprint: JSON.stringify(input) });
    const { requestFingerprint } = await import('../common/mutation-protection.js');
    prisma.operation.findFirst.mockReset().mockResolvedValueOnce({ ...operation, fingerprint: requestFingerprint(input) });
    await expect(new FinanceService(prisma as never, authorization as never).createGroup('identity', crypto.randomUUID(), key, crypto.randomUUID(), input)).resolves.toMatchObject({ id: operation.id, outcome: { id: 'group' } });
  });
  it('returns issued BIGINT snapshots as JSON-safe strings without using live account data', async () => {
    const issuedAt = new Date('2026-09-21T00:00:00.000Z');
    const prisma = { invoice: { findFirst: vi.fn().mockResolvedValue({ id: 'invoice', schoolId: crypto.randomUUID(), status: 'ISSUED', total: 9007199254740991n, billingMonth: '2026-09', studentCodeSnapshot: 'HS001', studentNameSnapshot: 'Bé Đỗ', classNameSnapshot: 'Lá 1', lines: [], issuedAt, obligationTotalSnapshot: 9007199254740991n, obligationLinesSnapshot: [{ amount: '9007199254740991' }], bankAccountIdSnapshot: 'bank', receivingBankSnapshot: 'Ngân hàng A', accountNumberSnapshot: '123', accountHolderNameSnapshot: 'Bé Đỗ', transferContentSnapshot: 'Be Do La 1', financePolicyEffectiveFrom: issuedAt, dueDaysAfterIssueSnapshot: 7, taxTreatmentSnapshot: 'NOT_APPLICABLE', debtScopeSnapshot: 'CURRENT_SCHOOL_YEAR_ONLY', reversalModeSnapshot: 'DIRECT', dueOn: new Date('2026-09-28T00:00:00.000Z') }) } };
    const result = await new FinanceService(prisma as never, authorization as never).invoice('identity', crypto.randomUUID(), '11111111-1111-4111-8111-111111111111');
    expect(result).toMatchObject({ status: 'ISSUED', total: '9007199254740991', issue: { obligationTotal: '9007199254740991', transferContent: 'Be Do La 1', bankAccount: { accountNumber: '123' }, policy: { dueDaysAfterIssue: 7 } } });
  });
  it('orders every projected Invoice line by amount descending then ID ascending', async () => {
    const prisma = { invoice: { findFirst: vi.fn().mockResolvedValue({ id: 'invoice', schoolId: crypto.randomUUID(), status: 'DRAFT', total: 12n, billingMonth: '2026-09', studentCodeSnapshot: 'HS001', studentNameSnapshot: 'Bé Đỗ', classNameSnapshot: 'Lá 1', lines: [{ id: 'b', receivableId: 'b', receivableNameSnapshot: 'B', unitLabelSnapshot: 'lần', defaultUnitPriceSnapshot: 5n, unitPrice: 5n, quantity: 1, amount: 5n }, { id: 'a', receivableId: 'a', receivableNameSnapshot: 'A', unitLabelSnapshot: 'lần', defaultUnitPriceSnapshot: 5n, unitPrice: 5n, quantity: 1, amount: 5n }, { id: 'c', receivableId: 'c', receivableNameSnapshot: 'C', unitLabelSnapshot: 'lần', defaultUnitPriceSnapshot: 7n, unitPrice: 7n, quantity: 1, amount: 7n }] }) } };
    const result = await new FinanceService(prisma as never, authorization as never).invoice('identity', crypto.randomUUID(), '11111111-1111-4111-8111-111111111111');
    expect(result.lines.map((line: { id: string }) => line.id)).toEqual(['c', 'a', 'b']);
  });
  it('only projects active same-School bank accounts', async () => {
    const prisma = { bankAccount: { findMany: vi.fn().mockResolvedValue([{ id: 'active', receivingBank: 'A', accountNumber: '1', accountHolderName: 'Holder', lifecycleTransitions: [{ status: 'ACTIVE' }] }, { id: 'inactive', receivingBank: 'B', accountNumber: '2', accountHolderName: 'Old', lifecycleTransitions: [{ status: 'INACTIVE' }] }]) } };
    const school = crypto.randomUUID(); const result = await new FinanceService(prisma as never, authorization as never).bankAccounts('identity', school);
    expect(result).toEqual({ accounts: [{ id: 'active', receivingBank: 'A', accountNumber: '1', accountHolderName: 'Holder' }] });
    expect(prisma.bankAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: school } }));
  });
  it('requires a close reason before creating an Operation', async () => {
    const prisma = { operation: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const school = crypto.randomUUID(); const run = crypto.randomUUID();
    await expect(new FinanceService(prisma as never, authorization as never).closeRun('identity', school, run, crypto.randomUUID(), crypto.randomUUID(), {})).rejects.toMatchObject({ status: 400, response: { fieldErrors: { reason: expect.any(String) } } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
