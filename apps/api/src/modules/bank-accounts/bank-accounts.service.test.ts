import { NotFoundException } from '@nestjs/common';
import { BankAccountStatus, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BankAccountsService } from './bank-accounts.service.js';

const record = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', bankCode: 'VCB', accountNumber: '123456789', accountHolderName: 'Nguyen An', status: BankAccountStatus.ACTIVE, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') };
function prisma() {
  let current: Omit<typeof record, 'status'> & { status: BankAccountStatus } = { ...record };
  const tx = { bankAccount: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([record]), update: vi.fn(async ({ where, data }: { where: { id: string }; data: { status: BankAccountStatus } }) => { if (where.id !== current.id) { const error = new Prisma.PrismaClientKnownRequestError('Missing record.', { code: 'P2025', clientVersion: 'test' }); throw error; } current = { ...current, status: data.status }; return current; }) } };
  return { bankAccount: { findUnique: vi.fn().mockResolvedValue(record), create: vi.fn().mockResolvedValue(record) }, $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)), tx };
}

describe('BankAccountsService', () => {
  it('lists trimmed search results deterministically and preserves empty out-of-range pages', async () => {
    const db = prisma(); db.tx.bankAccount.findMany.mockResolvedValue([]);
    await expect(new BankAccountsService(db as never).list({ page: 99, pageSize: 20, status: BankAccountStatus.ACTIVE, search: ' VCB ' })).resolves.toMatchObject({ data: [], meta: { page: 99, pageCount: 1, total: 1 } });
    expect(db.tx.bankAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 1960, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], where: { status: BankAccountStatus.ACTIVE, OR: expect.any(Array) } }));
  });

  it('creates trimmed active resources and serializes timestamps', async () => {
    const db = prisma();
    await expect(new BankAccountsService(db as never).create({ bankCode: ' VCB ', accountNumber: ' 123 ', accountHolderName: ' Nguyen An ' })).resolves.toMatchObject({ data: { status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z' } });
    expect(db.bankAccount.create).toHaveBeenCalledWith({ data: { bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Nguyen An' } });
  });

  it('deactivates and reactivates idempotently, while missing accounts return 404', async () => {
    const db = prisma(); const service = new BankAccountsService(db as never);
    await expect(service.setStatus(record.id, BankAccountStatus.INACTIVE)).resolves.toMatchObject({ data: { status: 'INACTIVE' } });
    await expect(service.setStatus(record.id, BankAccountStatus.ACTIVE)).resolves.toMatchObject({ data: { status: 'ACTIVE' } });
    expect(db.tx.bankAccount.update).toHaveBeenNthCalledWith(1, { where: { id: record.id }, data: { status: BankAccountStatus.INACTIVE } });
    await expect(service.setStatus('b2e36687-69b4-4e89-8ec0-141ff397837f', BankAccountStatus.ACTIVE)).rejects.toBeInstanceOf(NotFoundException);
  });
});
