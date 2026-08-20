import { describe, expect, it, vi } from 'vitest';
import { InvoicesService } from './invoices.service.js';
import { INVOICE_TEMPLATE_EMPTY } from '../../common/errors/domain.exception.js';

const invoice = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: 'Bé An lúc tạo', studentNickname: 'An', classId: 'b2e36687-69b4-4e89-8ec0-141ff397837f', className: 'Mầm 1 lúc tạo', status: 'DRAFT' as const, total: 1500000n, createdAt: new Date('2026-08-02T00:00:00.000Z'), updatedAt: new Date('2026-08-02T00:00:00.000Z') };

function prisma(record: Record<string, unknown> = invoice) { const tx = { invoice: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([record]), findUnique: vi.fn().mockResolvedValue(record), findUniqueOrThrow: vi.fn().mockResolvedValue(record), update: vi.fn() } }; return { ...tx, $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) }; }

describe('InvoicesService', () => {
  it('filters by month and serializes immutable invoice snapshots', async () => {
    const db = prisma(); const result = await new InvoicesService(db as never).list({ billingMonth: '2026-08', page: 1, pageSize: 20 });
    expect(db.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { billingMonth: new Date('2026-08-01T00:00:00.000Z') }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }));
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
    expect(result.data[0]).toMatchObject({ student: { name: 'Bé An lúc tạo' }, schoolClass: { name: 'Mầm 1 lúc tạo' }, total: 1500000 });
  });

  it('rejects unsafe stored money instead of serializing a lossy JSON number', async () => {
    await expect(new InvoicesService(prisma({ ...invoice, total: BigInt(Number.MAX_SAFE_INTEGER) + 1n }) as never).get(invoice.id)).rejects.toThrow('outside the JSON safe integer range');
  });

  it('rejects batch preview when the singleton template has no lines', async () => {
    const db = prisma(); Object.assign(db, { invoiceTemplate: { findFirst: vi.fn().mockResolvedValue({ items: [] }) } });
    await expect(new InvoicesService(db as never).preview({ billingMonth: '2026-08', allActiveClasses: true })).rejects.toMatchObject({ response: { code: INVOICE_TEMPLATE_EMPTY } });
  });

  it('rejects moving drafts with invalid totals before creating snapshots', async () => {
    const db = prisma({ ...invoice, total: 0n, paymentMethod: 'CASH', bankAccountId: null, bankAccount: null });
    await expect(new InvoicesService(db as never).moveToPending(invoice.id)).rejects.toThrow('Invoice total must be greater than zero');
    expect(db.invoice.update).not.toHaveBeenCalled();
  });

  it('completes only positive pending invoices and stores the operation response atomically', async () => {
    const completed = { ...invoice, status: 'COMPLETED' as const, total: 100n, paymentSnapshotMethod: 'CASH', paymentSnapshotBankCode: null, paymentSnapshotAccountNumber: null, paymentSnapshotAccountHolderName: null, items: [], creator: { id: 'admin', displayName: 'Creator' }, confirmer: { id: 'admin', displayName: 'Admin' }, bankAccount: null, completedAt: new Date('2026-08-03T00:00:00.000Z') };
    const db = prisma(completed); db.invoice.findUnique.mockResolvedValueOnce({ ...completed, status: 'PENDING' }); const operations = { fingerprint: vi.fn().mockReturnValue('fingerprint'), acquireOrReplay: vi.fn().mockResolvedValue(undefined), complete: vi.fn() };
    const result = await new InvoicesService(db as never, operations as never).complete(invoice.id, 'a2e36687-69b4-4e89-8ec0-141ff397837f', 'admin');
    expect(db.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', confirmerId: 'admin' }) }));
    expect(operations.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ response: result }));
    expect(result).toMatchObject({ data: { status: 'COMPLETED', completedBy: { displayName: 'Admin' } } });
  });

  it('rejects completion unless the pending invoice has a positive total', async () => {
    const db = prisma({ ...invoice, status: 'PENDING', total: 0n }); const operations = { fingerprint: vi.fn().mockReturnValue('fingerprint'), acquireOrReplay: vi.fn().mockResolvedValue(undefined), complete: vi.fn() };
    await expect(new InvoicesService(db as never, operations as never).complete(invoice.id, 'a2e36687-69b4-4e89-8ec0-141ff397837f', 'admin')).rejects.toThrow('Invoice total must be greater than zero');
    expect(db.invoice.update).not.toHaveBeenCalled();
  });
});
