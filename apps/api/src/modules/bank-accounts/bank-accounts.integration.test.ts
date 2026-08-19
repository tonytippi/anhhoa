import { PrismaPg } from '@prisma/adapter-pg';
import { BankAccountStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BankAccountsService } from './bank-accounts.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new BankAccountsService(prisma as never);

beforeEach(async () => { await prisma.invoiceItem.deleteMany(); await prisma.invoice.deleteMany(); await prisma.bankAccount.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('BankAccountsService PostgreSQL contract', () => {
  it('persists, orders, filters, and transitions accounts without deletion', async () => {
    const older = await prisma.bankAccount.create({ data: { bankCode: 'VCB', accountNumber: '111', accountHolderName: 'Nguyen An', createdAt: new Date('2026-01-01T00:00:00.000Z') } });
    const newer = await service.create({ bankCode: ' TCB ', accountNumber: ' 222 ', accountHolderName: ' Tran Binh ' });
    const list = await service.list({ page: 1, pageSize: 20, search: ' TCB ' });
    expect(list.data).toHaveLength(1); expect(list.data[0]).toMatchObject({ id: newer.data.id, bankCode: 'TCB', status: BankAccountStatus.ACTIVE });
    const ordered = await service.list({ page: 1, pageSize: 20 });
    expect(ordered.data.map((item) => item.id)).toEqual([newer.data.id, older.id]);
    await expect(service.list({ page: 2, pageSize: 20 })).resolves.toMatchObject({ data: [], meta: { page: 2, pageCount: 1, total: 2 } });
    await expect(service.setStatus(newer.data.id, BankAccountStatus.INACTIVE)).resolves.toMatchObject({ data: { status: BankAccountStatus.INACTIVE } });
    await expect(service.setStatus(newer.data.id, BankAccountStatus.INACTIVE)).resolves.toMatchObject({ data: { status: BankAccountStatus.INACTIVE } });
    await expect(service.setStatus(newer.data.id, BankAccountStatus.ACTIVE)).resolves.toMatchObject({ data: { status: BankAccountStatus.ACTIVE } });
    await expect(prisma.bankAccount.findUniqueOrThrow({ where: { id: newer.data.id } })).resolves.toMatchObject({ status: BankAccountStatus.ACTIVE });
    await expect(service.get('a2e36687-69b4-4e89-8ec0-141ff397837f')).rejects.toMatchObject({ status: 404 });
  });
});
