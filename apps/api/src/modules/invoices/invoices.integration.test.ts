import { PrismaPg } from '@prisma/adapter-pg';
import { InvoiceStatus, InvoiceTemplateAmountSource, PrismaClient, StudentStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { InvoicesService } from './invoices.service.js';
import { INVOICE_BATCH_EMPTY } from '../../common/errors/domain.exception.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new InvoicesService(prisma as never);

beforeEach(async () => {
  await prisma.invoiceItem.deleteMany(); await prisma.invoice.deleteMany(); await prisma.operation.deleteMany(); await prisma.invoiceTemplateItem.deleteMany(); await prisma.invoiceTemplate.deleteMany(); await prisma.student.deleteMany(); await prisma.class.deleteMany(); await prisma.admin.deleteMany();
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

  it('previews skip reasons then creates immutable template and tuition snapshots', async () => {
    const admin = await prisma.admin.create({ data: { email: 'batch@example.com', displayName: 'Admin', googleId: 'batch-admin' } });
    const activeClass = await prisma.class.create({ data: { name: 'Mầm active', monthlyTuition: 1500000 } });
    const archivedClass = await prisma.class.create({ data: { name: 'Mầm archived', monthlyTuition: 900000, status: 'ARCHIVED' } });
    const eligible = await prisma.student.create({ data: { fullName: 'Bé đủ điều kiện', nickname: 'Bông', classId: activeClass.id } });
    await prisma.student.create({ data: { fullName: 'Bé nghỉ học', classId: activeClass.id, status: StudentStatus.INACTIVE } });
    await prisma.student.create({ data: { fullName: 'Bé chưa có lớp' } });
    await prisma.student.create({ data: { fullName: 'Bé lớp lưu trữ', classId: archivedClass.id } });
    const existing = await prisma.student.create({ data: { fullName: 'Bé đã có hóa đơn', classId: activeClass.id } });
    await prisma.invoice.create({ data: { studentId: existing.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: existing.fullName, classId: activeClass.id, className: activeClass.name, total: 1n, creatorId: admin.id } });
    const template = await prisma.invoiceTemplate.create({ data: { singleton: true } });
    await prisma.invoiceTemplateItem.createMany({ data: [
      { templateId: template.id, description: 'Học phí', position: 0, amountSource: InvoiceTemplateAmountSource.CLASS_TUITION },
      { templateId: template.id, description: 'Tiền ăn', feeGroup: 'Ăn uống', position: 1, amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 300000n },
    ] });

    await expect(service.preview({ billingMonth: '2026-08', allActiveClasses: true })).resolves.toEqual({ data: { eligibleCount: 1, skipped: { inactiveStudent: 1, missingClass: 1, archivedClass: 1, existingInvoice: 1 } } });
    const created = await service.createBatch({ billingMonth: '2026-08', allActiveClasses: true }, 'a2e36687-69b4-4e89-8ec0-141ff397837f', admin.id);
    expect(created).toMatchObject({ data: { createdCount: 1, skipped: { inactiveStudent: 1, missingClass: 1, archivedClass: 1, existingInvoice: 1 } } });
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { studentId_billingMonth: { studentId: eligible.id, billingMonth: new Date('2026-08-01T00:00:00.000Z') } }, include: { items: { orderBy: { position: 'asc' } } } });
    expect(invoice).toMatchObject({ studentName: 'Bé đủ điều kiện', studentNickname: 'Bông', className: 'Mầm active', total: 1800000n, items: [{ description: 'Học phí', amount: 1500000n, position: 0 }, { description: 'Tiền ăn', feeGroup: 'Ăn uống', amount: 300000n, position: 1 }] });
    await prisma.class.update({ where: { id: activeClass.id }, data: { name: 'Tên mới', monthlyTuition: 1 } });
    await prisma.invoiceTemplateItem.updateMany({ where: { templateId: template.id }, data: { description: 'Dòng mới' } });
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { items: { orderBy: { position: 'asc' } } } })).toMatchObject({ className: 'Mầm active', total: 1800000n, items: [{ description: 'Học phí', amount: 1500000n }, { description: 'Tiền ăn', amount: 300000n }] });
  });

  it('replays a batch key and prevents duplicates for overlapping batch requests', async () => {
    const admin = await prisma.admin.create({ data: { email: 'replay@example.com', displayName: 'Admin', googleId: 'replay-admin' } });
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 100 } });
    const student = await prisma.student.create({ data: { fullName: 'Bé An', classId: schoolClass.id } });
    const template = await prisma.invoiceTemplate.create({ data: { singleton: true } });
    await prisma.invoiceTemplateItem.create({ data: { templateId: template.id, description: 'Học phí', position: 0, amountSource: InvoiceTemplateAmountSource.CLASS_TUITION } });
    const input = { billingMonth: '2026-08', allActiveClasses: true };
    const key = 'b2e36687-69b4-4e89-8ec0-141ff397837f';
    const first = await service.createBatch(input, key, admin.id);
    await expect(service.createBatch(input, key, admin.id)).resolves.toEqual(first);
    await expect(service.createBatch(input, 'c2e36687-69b4-4e89-8ec0-141ff397837f', admin.id)).rejects.toMatchObject({ response: { code: INVOICE_BATCH_EMPTY } });
    await expect(prisma.invoice.count({ where: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z') } })).resolves.toBe(1);
  });
});
