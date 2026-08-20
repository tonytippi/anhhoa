import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service.js';

const base = { status: 'COMPLETED', total: 100n, paymentSnapshotMethod: 'CASH', paymentSnapshotBankCode: null, paymentSnapshotAccountNumber: null, paymentSnapshotAccountHolderName: null };

describe('ReportsService', () => {
  it('counts every status but aggregates only completed cash and transfer snapshots', async () => {
    const findMany = vi.fn().mockResolvedValue([
      base,
      { ...base, status: 'DRAFT' },
      { ...base, status: 'PENDING' },
      { ...base, total: 250n, paymentSnapshotMethod: 'TRANSFER', paymentSnapshotBankCode: 'VCB', paymentSnapshotAccountNumber: '123', paymentSnapshotAccountHolderName: 'Cô Hoa' },
      { ...base, total: 50n, paymentSnapshotMethod: 'TRANSFER', paymentSnapshotBankCode: 'VCB', paymentSnapshotAccountNumber: '123', paymentSnapshotAccountHolderName: 'Cô Hoa' },
    ]);
    const result = await new ReportsService({ invoice: { findMany } } as never).monthly({ billingMonth: '2026-08' });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { billingMonth: new Date('2026-08-01T00:00:00.000Z') } }));
    expect(result).toEqual({ data: { billingMonth: '2026-08', counts: { draft: 1, pending: 1, completed: 3 }, totalCollected: 400, cashCollected: 100, transferCollected: 300, transferBreakdown: [{ bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Cô Hoa', total: 300 }] } });
  });

  it('rejects unsafe totals rather than emitting lossy JSON', async () => {
    await expect(new ReportsService({ invoice: { findMany: vi.fn().mockResolvedValue([{ ...base, total: BigInt(Number.MAX_SAFE_INTEGER) + 1n }]) } } as never).monthly({ billingMonth: '2026-08' })).rejects.toThrow('outside the JSON safe integer range');
  });

  it('returns zero totals for an empty month and never treats unknown statuses as completed', async () => {
    const findMany = vi.fn().mockResolvedValue([{ ...base, status: 'UNKNOWN' }]);
    const result = await new ReportsService({ invoice: { findMany } } as never).monthly({ billingMonth: '2026-09' });
    expect(result).toEqual({ data: { billingMonth: '2026-09', counts: { draft: 0, pending: 0, completed: 0 }, totalCollected: 0, cashCollected: 0, transferCollected: 0, transferBreakdown: [] } });
    findMany.mockResolvedValue([]);
    await expect(new ReportsService({ invoice: { findMany } } as never).monthly({ billingMonth: '2026-10' })).resolves.toMatchObject({ data: { totalCollected: 0, transferBreakdown: [] } });
  });
});
