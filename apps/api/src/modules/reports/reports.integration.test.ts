import { PrismaPg } from '@prisma/adapter-pg';
import { InvoicePaymentMethod, InvoiceStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ReportsService } from './reports.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new ReportsService(prisma as never);

beforeEach(async () => { await prisma.studentParent.deleteMany(); await prisma.parent.deleteMany(); await prisma.invoiceItem.deleteMany(); await prisma.invoice.deleteMany(); await prisma.operation.deleteMany(); await prisma.student.deleteMany(); await prisma.bankAccount.deleteMany(); await prisma.class.deleteMany(); await prisma.admin.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('ReportsService PostgreSQL contract', () => {
  it('aggregates completed snapshot payments only after the source account changes', async () => {
    const admin = await prisma.admin.create({ data: { email: 'report@example.com', displayName: 'Admin', googleId: 'report-admin' } });
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1 } });
    const account = await prisma.bankAccount.create({ data: { bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Cô Hoa' } });
    const cashStudent = await prisma.student.create({ data: { fullName: 'Hoàn tất tiền mặt', classId: schoolClass.id } });
    const transferStudent = await prisma.student.create({ data: { fullName: 'Hoàn tất chuyển khoản', classId: schoolClass.id } });
    const secondTransferStudent = await prisma.student.create({ data: { fullName: 'Hoàn tất chuyển khoản hai', classId: schoolClass.id } });
    const draftStudent = await prisma.student.create({ data: { fullName: 'Nháp', classId: schoolClass.id } });
    const pendingStudent = await prisma.student.create({ data: { fullName: 'Chờ xác nhận', classId: schoolClass.id } });
    const common = { billingMonth: new Date('2026-08-01T00:00:00.000Z'), classId: schoolClass.id, className: schoolClass.name, creatorId: admin.id };
    await prisma.invoice.createMany({ data: [
      { ...common, studentId: cashStudent.id, studentName: cashStudent.fullName, status: InvoiceStatus.COMPLETED, total: 100n, paymentSnapshotMethod: InvoicePaymentMethod.CASH },
      { ...common, studentId: transferStudent.id, studentName: transferStudent.fullName, status: InvoiceStatus.COMPLETED, total: 250n, paymentSnapshotMethod: InvoicePaymentMethod.TRANSFER, paymentSnapshotBankCode: 'VCB', paymentSnapshotAccountNumber: '123', paymentSnapshotAccountHolderName: 'Cô Hoa', bankAccountId: account.id },
      { ...common, studentId: secondTransferStudent.id, studentName: secondTransferStudent.fullName, status: InvoiceStatus.COMPLETED, total: 150n, paymentSnapshotMethod: InvoicePaymentMethod.TRANSFER, paymentSnapshotBankCode: 'TCB', paymentSnapshotAccountNumber: '456', paymentSnapshotAccountHolderName: 'Cô Mai' },
      { ...common, studentId: draftStudent.id, studentName: draftStudent.fullName, status: InvoiceStatus.DRAFT, total: 999n },
      { ...common, studentId: pendingStudent.id, studentName: pendingStudent.fullName, status: InvoiceStatus.PENDING, total: 888n, paymentSnapshotMethod: InvoicePaymentMethod.CASH },
    ] });
    await prisma.bankAccount.update({ where: { id: account.id }, data: { bankCode: 'BIDV', accountNumber: '999', accountHolderName: 'Nguồn mới', status: 'INACTIVE' } });
    await expect(service.monthly({ billingMonth: '2026-08' })).resolves.toEqual({ data: { billingMonth: '2026-08', counts: { draft: 1, pending: 1, completed: 3 }, totalCollected: 500, cashCollected: 100, transferCollected: 400, transferBreakdown: [{ bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Cô Hoa', total: 250 }, { bankCode: 'TCB', accountNumber: '456', accountHolderName: 'Cô Mai', total: 150 }] } });
  });
});
