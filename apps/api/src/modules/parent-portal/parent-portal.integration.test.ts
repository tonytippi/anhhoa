import { PrismaPg } from '@prisma/adapter-pg';
import { InvoicePaymentMethod, InvoiceStatus, PrismaClient, StudentParentStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ParentPortalService } from './parent-portal.service.js';
import { InvoicesService } from '../invoices/invoices.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new ParentPortalService(prisma as never, { bankDeepLinks: new Map() } as never);

beforeEach(async () => {
  await prisma.studentParent.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.operation.deleteMany();
  await prisma.admin.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe('ParentPortalService PostgreSQL contract', () => {
  it('scopes students and minimized pending/completed invoice snapshots to active links', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1n } });
    const createdStudents = await Promise.all(['Bé An', 'Bé Bình', 'Bé Cúc'].map((fullName) => prisma.student.create({ data: { fullName, classId: schoolClass.id } })));
    const [first, second, other] = createdStudents as [typeof createdStudents[0], typeof createdStudents[0], typeof createdStudents[0]];
    const parent = await prisma.parent.create({ data: { emailNormalized: 'parent@example.com' } });
    await prisma.studentParent.createMany({ data: [{ parentId: parent.id, studentId: first.id }, { parentId: parent.id, studentId: second.id }, { parentId: parent.id, studentId: other.id, status: StudentParentStatus.REVOKED }] });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google' } });
    const pending = await prisma.invoice.create({ data: { studentId: first.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: 'Snapshot An', classId: schoolClass.id, className: 'Snapshot class', status: InvoiceStatus.PENDING, total: 100n, creatorId: admin.id, paymentSnapshotMethod: InvoicePaymentMethod.CASH, items: { create: { description: 'Học phí', amount: 100n, position: 0 } } } });
    await prisma.invoice.create({ data: { studentId: second.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: 'Snapshot Bình', classId: schoolClass.id, className: 'Snapshot class', status: InvoiceStatus.COMPLETED, total: 200n, creatorId: admin.id, paymentSnapshotMethod: InvoicePaymentMethod.TRANSFER } });
    await prisma.invoice.create({ data: { studentId: other.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: 'Hidden', classId: schoolClass.id, className: 'Snapshot class', status: InvoiceStatus.PENDING, total: 300n, creatorId: admin.id } });
    await prisma.invoice.create({ data: { studentId: first.id, billingMonth: new Date('2026-09-01T00:00:00.000Z'), studentName: 'Draft', classId: schoolClass.id, className: 'Snapshot class', status: InvoiceStatus.DRAFT, total: 400n, creatorId: admin.id } });

    await expect(service.students(parent.id)).resolves.toEqual({ data: [{ id: first.id, fullName: 'Bé An', nickname: null }, { id: second.id, fullName: 'Bé Bình', nickname: null }] });
    const invoices = await service.invoices(parent.id, { page: 1, pageSize: 20 });
    expect(invoices.meta).toEqual({ page: 1, pageSize: 20, total: 2, pageCount: 1 });
    const listedPending = invoices.data.find((invoice) => invoice.id === pending.id)!;
    expect(Object.keys(listedPending).sort()).toEqual(['billingMonth', 'id', 'items', 'paymentMethod', 'status', 'student', 'total']);
    expect(Object.keys(listedPending.student).sort()).toEqual(['id', 'name', 'nickname']);
    expect(Object.keys(listedPending.items[0]!).sort()).toEqual(['amount', 'description', 'feeGroup', 'position']);
    expect(listedPending).toMatchObject({ student: { id: first.id, name: 'Snapshot An', nickname: null }, billingMonth: '2026-08', paymentMethod: 'CASH', items: [{ description: 'Học phí', amount: 100, feeGroup: null, position: 0 }] });
    expect(invoices.data.find((invoice) => invoice.status === InvoiceStatus.COMPLETED)).toBeDefined();
    const detail = await service.invoice(parent.id, pending.id);
    expect(Object.keys(detail)).toEqual(['data']);
    expect(Object.keys(detail.data).sort()).toEqual(['billingMonth', 'id', 'items', 'paymentMethod', 'status', 'student', 'total']);
    expect(Object.keys(detail.data.student).sort()).toEqual(['id', 'name', 'nickname']);
    expect(Object.keys(detail.data.items[0]!).sort()).toEqual(['amount', 'description', 'feeGroup', 'position']);
    expect(detail.data).toEqual(listedPending);
  });

  it('applies valid filters, stable paging, and opaque denials for revoked, draft, and unknown IDs', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1n } });
    const createdStudents = await Promise.all(['Bé An', 'Bé Bình'].map((fullName) => prisma.student.create({ data: { fullName, classId: schoolClass.id } })));
    const [first, second] = createdStudents as [typeof createdStudents[0], typeof createdStudents[0]];
    const parent = await prisma.parent.create({ data: { emailNormalized: 'parent@example.com' } });
    await prisma.studentParent.createMany({ data: [{ parentId: parent.id, studentId: first.id }, { parentId: parent.id, studentId: second.id, status: StudentParentStatus.REVOKED }] });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google' } });
    const visible = await prisma.invoice.create({ data: { studentId: first.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: first.fullName, classId: schoolClass.id, className: schoolClass.name, status: InvoiceStatus.PENDING, total: 1n, creatorId: admin.id, paymentSnapshotMethod: InvoicePaymentMethod.CASH } });
    const draft = await prisma.invoice.create({ data: { studentId: first.id, billingMonth: new Date('2026-09-01T00:00:00.000Z'), studentName: first.fullName, classId: schoolClass.id, className: schoolClass.name, status: InvoiceStatus.DRAFT, total: 1n, creatorId: admin.id } });
    const revoked = await prisma.invoice.create({ data: { studentId: second.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: second.fullName, classId: schoolClass.id, className: schoolClass.name, status: InvoiceStatus.PENDING, total: 1n, creatorId: admin.id } });

    await expect(service.invoices(parent.id, { studentId: first.id, billingMonth: '2026-08', status: InvoiceStatus.PENDING, page: 2, pageSize: 1 })).resolves.toMatchObject({ data: [], meta: { total: 1, page: 2, pageSize: 1 } });
    for (const id of [second.id, 'not-a-uuid']) await expect(service.invoices(parent.id, { studentId: id, page: 1, pageSize: 20 })).rejects.toMatchObject({ status: 401 });
    for (const id of [draft.id, revoked.id, 'a2e36687-69b4-4e89-8ec0-141ff397837f']) await expect(service.invoice(parent.id, id)).rejects.toMatchObject({ status: 401 });
    await expect(service.invoice(parent.id, visible.id)).resolves.toMatchObject({ data: { id: visible.id } });
  });

  it('sorts invoices by createdAt then ID across page boundaries', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1n } });
    const parent = await prisma.parent.create({ data: { emailNormalized: 'parent@example.com' } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google' } });
    const students = await Promise.all(['Bé An', 'Bé Bình', 'Bé Cúc', 'Bé Dũng'].map(async (fullName) => {
      const student = await prisma.student.create({ data: { fullName, classId: schoolClass.id } });
      await prisma.studentParent.create({ data: { parentId: parent.id, studentId: student.id } });
      return student;
    }));
    const dates = ['2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', '2026-08-04T00:00:00.000Z', '2026-08-03T00:00:00.000Z'];
    const created = await Promise.all(students.map((student, index) => prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: student.fullName, classId: schoolClass.id, className: schoolClass.name, status: InvoiceStatus.PENDING, total: 1n, creatorId: admin.id, paymentSnapshotMethod: InvoicePaymentMethod.CASH, createdAt: new Date(dates[index]!) } })));
    const expected = [...created].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id)).map((invoice) => invoice.id);

    const firstPage = await service.invoices(parent.id, { page: 1, pageSize: 2 });
    const secondPage = await service.invoices(parent.id, { page: 2, pageSize: 2 });
    expect([...firstPage.data, ...secondPage.data].map((invoice) => invoice.id)).toEqual(expected);
    expect(firstPage.meta).toEqual({ page: 1, pageSize: 2, total: 4, pageCount: 2 });
    expect(secondPage.meta).toEqual({ page: 2, pageSize: 2, total: 4, pageCount: 2 });
  });

  it('fails safely when a visible invoice has no payment snapshot method', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1n } });
    const student = await prisma.student.create({ data: { fullName: 'Bé An', classId: schoolClass.id } });
    const parent = await prisma.parent.create({ data: { emailNormalized: 'parent@example.com' } });
    await prisma.studentParent.create({ data: { parentId: parent.id, studentId: student.id } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google' } });
    const invoice = await prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: student.fullName, classId: schoolClass.id, className: schoolClass.name, status: InvoiceStatus.PENDING, total: 1n, creatorId: admin.id } });

    await expect(service.invoices(parent.id, { page: 1, pageSize: 20 })).rejects.toMatchObject({ status: 500 });
    await expect(service.invoice(parent.id, invoice.id)).rejects.toMatchObject({ status: 500 });
  });

  it('returns payment and PNG only from a lifecycle-locked transfer snapshot and denies every ineligible state opaquely', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm nguồn', monthlyTuition: 1n } });
    const student = await prisma.student.create({ data: { fullName: 'Tên nguồn', classId: schoolClass.id } });
    const parent = await prisma.parent.create({ data: { emailNormalized: 'parent@example.com' } });
    await prisma.studentParent.create({ data: { parentId: parent.id, studentId: student.id } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google' } });
    const account = await prisma.bankAccount.create({ data: { bankCode: ' VCB ', accountNumber: ' 123456 ', accountHolderName: ' Cô Hoa ' } });
    const invoice = await prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: 'Bé snapshot', classId: schoolClass.id, className: 'Lớp snapshot', total: 1500000n, creatorId: admin.id, paymentMethod: InvoicePaymentMethod.TRANSFER, bankAccountId: account.id } });
    await new InvoicesService(prisma as never).moveToPending(invoice.id);
    await prisma.student.update({ where: { id: student.id }, data: { fullName: 'Tên đã đổi' } });
    await prisma.class.update({ where: { id: schoolClass.id }, data: { name: 'Lớp đã đổi' } });
    await prisma.bankAccount.update({ where: { id: account.id }, data: { bankCode: 'BID', accountNumber: '654321', accountHolderName: 'Nguồn mới', status: 'INACTIVE' } });

    await expect(service.payment(parent.id, invoice.id)).resolves.toEqual({ data: { id: invoice.id, student: { id: student.id, name: 'Bé snapshot' }, billingMonth: '2026-08', total: 1500000, bankCode: 'VCB', accountNumber: '123456', accountHolderName: 'Cô Hoa', transferContent: 'Bé snapshot Lớp snapshot chuyển tiền' }, vietQr: expect.any(String) });
    const png = await service.paymentPng(parent.id, invoice.id);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    await expect(prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).resolves.toMatchObject({ status: InvoiceStatus.PENDING, paymentSnapshotBankCode: 'VCB', paymentSnapshotAccountNumber: '123456', paymentSnapshotAccountHolderName: 'Cô Hoa', paymentSnapshotTransferContent: 'Bé snapshot Lớp snapshot chuyển tiền' });

    const createIneligible = async (data: Record<string, unknown>) => {
      const child = await prisma.student.create({ data: { fullName: `Bé ${crypto.randomUUID()}`, classId: schoolClass.id } });
      await prisma.studentParent.create({ data: { parentId: parent.id, studentId: child.id } });
      return prisma.invoice.create({ data: { studentId: child.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: 'Bé snapshot', classId: schoolClass.id, className: 'Lớp snapshot', total: 1n, creatorId: admin.id, ...data } });
    };
    const [draft, completed, cash, incomplete, unsupported] = await Promise.all([
      createIneligible({ status: InvoiceStatus.DRAFT, paymentMethod: InvoicePaymentMethod.TRANSFER }),
      createIneligible({ status: InvoiceStatus.COMPLETED, paymentSnapshotMethod: InvoicePaymentMethod.TRANSFER, paymentSnapshotBankCode: 'VCB', paymentSnapshotAccountNumber: '1', paymentSnapshotAccountHolderName: 'Cô Hoa', paymentSnapshotTransferContent: 'Nội dung' }),
      createIneligible({ status: InvoiceStatus.PENDING, paymentSnapshotMethod: InvoicePaymentMethod.CASH }),
      createIneligible({ status: InvoiceStatus.PENDING, paymentSnapshotMethod: InvoicePaymentMethod.TRANSFER, paymentSnapshotBankCode: 'VCB', paymentSnapshotAccountNumber: null, paymentSnapshotAccountHolderName: 'Cô Hoa', paymentSnapshotTransferContent: 'Nội dung' }),
      createIneligible({ status: InvoiceStatus.PENDING, paymentSnapshotMethod: InvoicePaymentMethod.TRANSFER, paymentSnapshotBankCode: 'NOPE', paymentSnapshotAccountNumber: '1', paymentSnapshotAccountHolderName: 'Cô Hoa', paymentSnapshotTransferContent: 'Nội dung' }),
    ]);
    const otherStudent = await prisma.student.create({ data: { fullName: 'Bé khác', classId: schoolClass.id } });
    const other = await prisma.invoice.create({ data: { studentId: otherStudent.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: 'Bé khác', classId: schoolClass.id, className: 'Lớp snapshot', status: InvoiceStatus.PENDING, total: 1n, creatorId: admin.id, paymentSnapshotMethod: InvoicePaymentMethod.TRANSFER, paymentSnapshotBankCode: 'VCB', paymentSnapshotAccountNumber: '1', paymentSnapshotAccountHolderName: 'Cô Hoa', paymentSnapshotTransferContent: 'Nội dung' } });
    for (const id of [draft.id, completed.id, cash.id, incomplete.id, unsupported.id, other.id, 'a2e36687-69b4-4e89-8ec0-141ff397837f']) {
      await expect(service.payment(parent.id, id)).rejects.toMatchObject({ status: 401 });
      await expect(service.paymentPng(parent.id, id)).rejects.toMatchObject({ status: 401 });
    }
    await prisma.studentParent.update({ where: { parentId_studentId: { parentId: parent.id, studentId: student.id } }, data: { status: StudentParentStatus.REVOKED } });
    await expect(service.payment(parent.id, invoice.id)).rejects.toMatchObject({ status: 401 });
    await expect(service.paymentPng(parent.id, invoice.id)).rejects.toMatchObject({ status: 401 });
  });

  it('adds a configured bank URI from the locked snapshot without mutating the invoice', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1n } });
    const student = await prisma.student.create({ data: { fullName: 'Bé An', classId: schoolClass.id } });
    const parent = await prisma.parent.create({ data: { emailNormalized: 'parent@example.com' } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google' } });
    await prisma.studentParent.create({ data: { parentId: parent.id, studentId: student.id } });
    const invoice = await prisma.invoice.create({ data: { studentId: student.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: 'Bé snapshot', classId: schoolClass.id, className: schoolClass.name, status: InvoiceStatus.PENDING, total: 100n, creatorId: admin.id, paymentSnapshotMethod: InvoicePaymentMethod.TRANSFER, paymentSnapshotBankCode: 'VCB', paymentSnapshotAccountNumber: '123 456', paymentSnapshotAccountHolderName: 'Cô Hoa', paymentSnapshotTransferContent: 'Nội dung test' } });
    const configured = new ParentPortalService(prisma as never, { bankDeepLinks: new Map([['VCB', { template: 'mybank://transfer?account={accountNumber}&amount={total}&content={transferContent}' }]]) } as never);
    await expect(configured.payment(parent.id, invoice.id)).resolves.toMatchObject({ action: { uri: 'mybank://transfer?account=123%20456&amount=100&content=N%E1%BB%99i%20dung%20test' } });
    await expect(prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).resolves.toMatchObject({ status: InvoiceStatus.PENDING });
  });
});
