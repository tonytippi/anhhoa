import { PrismaPg } from '@prisma/adapter-pg';
import { InvoiceStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { InvoicesService } from './invoices.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new InvoicesService(prisma as never);

beforeEach(async () => {
  await prisma.invoice.deleteMany(); await prisma.student.deleteMany(); await prisma.class.deleteMany(); await prisma.admin.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe('InvoicesService PostgreSQL contract', () => {
  it('lists month, name, status, and class snapshots without joining mutable source names', async () => {
    const admin = await prisma.admin.create({ data: { email: 'invoice@example.com', displayName: 'Admin', googleId: 'invoice-admin' } });
    const schoolClass = await prisma.class.create({ data: { name: 'Lớp hiện tại', monthlyTuition: 1 } });
    const student = await prisma.student.create({ data: { fullName: 'Tên hiện tại', classId: schoolClass.id } });
    const created = await prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: 'Bé An lúc tạo', classId: schoolClass.id, className: 'Mầm 1 lúc tạo', status: InvoiceStatus.PENDING, total: 1500000n, creatorId: admin.id } });
    await prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-09-01T00:00:00.000Z'), studentName: 'Bé An tháng sau', classId: schoolClass.id, className: 'Mầm 1 lúc tạo', total: 0n, creatorId: admin.id } });
    await prisma.student.update({ where: { id: student.id }, data: { fullName: 'Tên đã đổi' } }); await prisma.class.update({ where: { id: schoolClass.id }, data: { name: 'Lớp đã đổi' } });
    const result = await service.list({ billingMonth: '2026-08', search: 'An lúc', status: InvoiceStatus.PENDING, classId: schoolClass.id, page: 1, pageSize: 20 });
    expect(result).toMatchObject({ data: [{ id: created.id, student: { name: 'Bé An lúc tạo' }, schoolClass: { name: 'Mầm 1 lúc tạo' }, status: InvoiceStatus.PENDING }], meta: { total: 1 } });
  });
});
