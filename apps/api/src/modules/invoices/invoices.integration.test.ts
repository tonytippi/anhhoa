import { PrismaPg } from '@prisma/adapter-pg';
import { BankAccountStatus, InvoicePaymentMethod, InvoiceStatus, InvoiceTemplateAmountSource, PrismaClient, StudentStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { InvoicesService } from './invoices.service.js';
import { INVOICE_BATCH_EMPTY } from '../../common/errors/domain.exception.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new InvoicesService(prisma as never);

beforeEach(async () => {
  await prisma.studentParent.deleteMany(); await prisma.parent.deleteMany(); await prisma.invoiceItem.deleteMany(); await prisma.invoice.deleteMany(); await prisma.operation.deleteMany(); await prisma.invoiceTemplateItem.deleteMany(); await prisma.invoiceTemplate.deleteMany(); await prisma.student.deleteMany(); await prisma.bankAccount.deleteMany(); await prisma.class.deleteMany(); await prisma.admin.deleteMany();
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
      { templateId: template.id, description: 'Giảm trừ', position: 2, amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: -135000n },
    ] });

    await expect(service.preview({ billingMonth: '2026-08', allActiveClasses: true })).resolves.toEqual({ data: { eligibleCount: 1, skipped: { inactiveStudent: 1, missingClass: 1, archivedClass: 1, existingInvoice: 1 } } });
    const created = await service.createBatch({ billingMonth: '2026-08', allActiveClasses: true }, 'a2e36687-69b4-4e89-8ec0-141ff397837f', admin.id);
    expect(created).toMatchObject({ data: { createdCount: 1, skipped: { inactiveStudent: 1, missingClass: 1, archivedClass: 1, existingInvoice: 1 } } });
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { studentId_billingMonth: { studentId: eligible.id, billingMonth: new Date('2026-08-01T00:00:00.000Z') } }, include: { items: { orderBy: { position: 'asc' } } } });
    expect(invoice).toMatchObject({ studentName: 'Bé đủ điều kiện', studentNickname: 'Bông', className: 'Mầm active', total: 1665000n, items: [{ description: 'Học phí', amount: 1500000n, position: 0 }, { description: 'Tiền ăn', feeGroup: 'Ăn uống', amount: 300000n, position: 1 }, { description: 'Giảm trừ', amount: -135000n, position: 2 }] });
    await prisma.class.update({ where: { id: activeClass.id }, data: { name: 'Tên mới', monthlyTuition: 1 } });
    await prisma.invoiceTemplateItem.updateMany({ where: { templateId: template.id }, data: { description: 'Dòng mới' } });
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { items: { orderBy: { position: 'asc' } } } })).toMatchObject({ className: 'Mầm active', total: 1665000n, items: [{ description: 'Học phí', amount: 1500000n }, { description: 'Tiền ăn', amount: 300000n }, { description: 'Giảm trừ', amount: -135000n }] });
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

  it('persists reordered draft lines, a server-calculated BigInt total, and an active transfer account', async () => {
    const admin = await prisma.admin.create({ data: { email: 'update@example.com', displayName: 'Admin', googleId: 'update-admin' } });
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 2', monthlyTuition: 100 } });
    const student = await prisma.student.create({ data: { fullName: 'Bé Em', classId: schoolClass.id } });
    const account = await prisma.bankAccount.create({ data: { bankCode: 'VCB', accountNumber: '456789', accountHolderName: 'Cô Hoa' } });
    const invoice = await prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: student.fullName, classId: schoolClass.id, className: schoolClass.name, total: 0n, creatorId: admin.id, items: { create: [{ description: 'Dòng cũ', amount: 0n, position: 0 }] } } });

    await expect(service.update(invoice.id, { items: [{ description: 'Dòng hai', amount: 200 }, { description: 'Dòng một', feeGroup: 'Ăn', amount: 100 }], paymentMethod: InvoicePaymentMethod.TRANSFER, bankAccountId: account.id })).resolves.toMatchObject({ data: { total: 300, payment: { method: InvoicePaymentMethod.TRANSFER, bankAccount: { id: account.id } }, items: [{ description: 'Dòng hai', position: 0 }, { description: 'Dòng một', position: 1 }] } });
    await expect(prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { items: { orderBy: { position: 'asc' } } } })).resolves.toMatchObject({ total: 300n, paymentMethod: InvoicePaymentMethod.TRANSFER, bankAccountId: account.id, items: [{ description: 'Dòng hai', amount: 200n, position: 0 }, { description: 'Dòng một', feeGroup: 'Ăn', amount: 100n, position: 1 }] });
  });

  it('locks a transfer snapshot and QR content independently from mutable sources, then returns to draft', async () => {
    const admin = await prisma.admin.create({ data: { email: 'pending@example.com', displayName: 'Admin', googleId: 'pending-admin' } });
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 100 } });
    const student = await prisma.student.create({ data: { fullName: 'Bé An', nickname: 'An', classId: schoolClass.id } });
    const account = await prisma.bankAccount.create({ data: { bankCode: 'VCB', accountNumber: '123456', accountHolderName: 'Cô Hoa' } });
    const created = await prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: student.fullName, studentNickname: student.nickname, classId: schoolClass.id, className: schoolClass.name, total: 1500000n, creatorId: admin.id, paymentMethod: InvoicePaymentMethod.TRANSFER, bankAccountId: account.id, items: { create: { description: 'Học phí', amount: 1500000n, position: 0 } } } });
    const pending = await service.moveToPending(created.id);
    expect(pending.data).toMatchObject({ status: InvoiceStatus.PENDING, payment: { method: InvoicePaymentMethod.TRANSFER, bankAccount: { bankCode: 'VCB', accountNumber: '123456', accountHolderName: 'Cô Hoa' } }, qr: { transferContent: 'Bé An [An] Mầm 1 chuyển tiền' } });
    await prisma.bankAccount.update({ where: { id: account.id }, data: { bankCode: 'BIDV', accountNumber: '654321', accountHolderName: 'Nguồn mới', status: BankAccountStatus.INACTIVE } });
    await prisma.student.update({ where: { id: student.id }, data: { fullName: 'Tên mới' } }); await prisma.class.update({ where: { id: schoolClass.id }, data: { name: 'Lớp mới' } });
    await expect(service.get(created.id)).resolves.toMatchObject({ data: { payment: { bankAccount: { bankCode: 'VCB', accountNumber: '123456', accountHolderName: 'Cô Hoa' } }, qr: { transferContent: 'Bé An [An] Mầm 1 chuyển tiền' } } });
    await expect(service.moveToDraft(created.id)).resolves.toMatchObject({ data: { status: InvoiceStatus.DRAFT, payment: { method: InvoicePaymentMethod.TRANSFER } } });
    await expect(service.get(created.id)).resolves.toMatchObject({ data: { status: InvoiceStatus.DRAFT, qr: null } });
    await expect(service.moveToDraft(created.id)).rejects.toThrow('Only pending invoices can return to draft');
  });

  it('locks a valid cash invoice without a receiving account', async () => {
    const admin = await prisma.admin.create({ data: { email: 'cash-pending@example.com', displayName: 'Admin', googleId: 'cash-pending-admin' } });
    const schoolClass = await prisma.class.create({ data: { name: 'Chồi 1', monthlyTuition: 100 } });
    const student = await prisma.student.create({ data: { fullName: 'Bé Bình', classId: schoolClass.id } });
    const created = await prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: student.fullName, classId: schoolClass.id, className: schoolClass.name, total: 100n, creatorId: admin.id, paymentMethod: InvoicePaymentMethod.CASH, items: { create: { description: 'Học phí', amount: 100n, position: 0 } } } });

    await expect(service.moveToPending(created.id)).resolves.toMatchObject({ data: { status: InvoiceStatus.PENDING, payment: { method: InvoicePaymentMethod.CASH, bankAccount: null }, qr: null } });
  });

  it('completes a pending positive invoice once, preserves its audit on replay, and rejects invalid lifecycle requests', async () => {
    const creator = await prisma.admin.create({ data: { email: 'completion-creator@example.com', displayName: 'Creator', googleId: 'completion-creator' } });
    const confirmer = await prisma.admin.create({ data: { email: 'completion-confirmer@example.com', displayName: 'Confirmer', googleId: 'completion-confirmer' } });
    const schoolClass = await prisma.class.create({ data: { name: 'Lá 1', monthlyTuition: 100 } });
    const student = await prisma.student.create({ data: { fullName: 'Bé Cúc', classId: schoolClass.id } });
    const pending = await prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: student.fullName, classId: schoolClass.id, className: schoolClass.name, status: InvoiceStatus.PENDING, total: 100n, creatorId: creator.id, paymentSnapshotMethod: InvoicePaymentMethod.CASH, items: { create: { description: 'Học phí', amount: 100n, position: 0 } } } });
    const key = 'd2e36687-69b4-4e89-8ec0-141ff397837f';
    const first = await service.complete(pending.id, key, confirmer.id);
    expect(first).toMatchObject({ data: { status: InvoiceStatus.COMPLETED, completedBy: { id: confirmer.id, displayName: 'Confirmer' } } });
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: pending.id } });
    expect(stored).toMatchObject({ status: InvoiceStatus.COMPLETED, confirmerId: confirmer.id }); expect(stored.completedAt).not.toBeNull();
    await expect(service.complete(pending.id, key, confirmer.id)).resolves.toEqual(first);
    await expect(service.moveToDraft(pending.id)).rejects.toThrow('Only pending invoices can return to draft');
    await expect(service.complete(pending.id, 'e2e36687-69b4-4e89-8ec0-141ff397837f', confirmer.id)).rejects.toThrow('Only pending invoices can be completed');
  });

  it('replays concurrent completion requests with the same operation key', async () => {
    const creator = await prisma.admin.create({ data: { email: 'concurrent-creator@example.com', displayName: 'Creator', googleId: 'concurrent-creator' } });
    const confirmer = await prisma.admin.create({ data: { email: 'concurrent-confirmer@example.com', displayName: 'Confirmer', googleId: 'concurrent-confirmer' } });
    const schoolClass = await prisma.class.create({ data: { name: 'Lá 2', monthlyTuition: 100 } });
    const student = await prisma.student.create({ data: { fullName: 'Bé Dâu', classId: schoolClass.id } });
    const pending = await prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: student.fullName, classId: schoolClass.id, className: schoolClass.name, status: InvoiceStatus.PENDING, total: 100n, creatorId: creator.id, paymentSnapshotMethod: InvoicePaymentMethod.CASH, items: { create: { description: 'Học phí', amount: 100n, position: 0 } } } });
    const key = 'f2e36687-69b4-4e89-8ec0-141ff397837f';

    const [first, second] = await Promise.all([service.complete(pending.id, key, confirmer.id), service.complete(pending.id, key, confirmer.id)]);

    expect(second).toEqual(first);
    await expect(prisma.invoice.findUniqueOrThrow({ where: { id: pending.id } })).resolves.toMatchObject({ status: InvoiceStatus.COMPLETED, confirmerId: confirmer.id });
    await expect(prisma.operation.count({ where: { id: key } })).resolves.toBe(1);
  });
});
