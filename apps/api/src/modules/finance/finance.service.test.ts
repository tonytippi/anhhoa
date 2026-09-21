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
});
