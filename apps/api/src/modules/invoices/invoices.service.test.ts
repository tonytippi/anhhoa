import { describe, expect, it, vi } from 'vitest';
import { InvoicesService } from './invoices.service.js';

const invoice = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: 'Bé An lúc tạo', studentNickname: 'An', classId: 'b2e36687-69b4-4e89-8ec0-141ff397837f', className: 'Mầm 1 lúc tạo', status: 'DRAFT' as const, total: 1500000n, createdAt: new Date('2026-08-02T00:00:00.000Z'), updatedAt: new Date('2026-08-02T00:00:00.000Z') };

function prisma(record = invoice) { const tx = { invoice: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([record]), findUnique: vi.fn().mockResolvedValue(record) } }; return { ...tx, $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) }; }

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
});
