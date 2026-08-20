import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { BankAccountStatus, ClassStatus, InvoicePaymentMethod, InvoiceStatus, Prisma, StudentStatus } from '@prisma/client';
import { DomainException, INVOICE_BATCH_EMPTY, INVOICE_TEMPLATE_EMPTY } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { OperationsService } from '../operations/operations.service.js';
import type { BatchInvoiceDto, ListInvoicesDto, UpdateInvoiceDto } from './invoices.dto.js';

function monthStart(value: string): Date { return new Date(`${value}-01T00:00:00.000Z`); }
function formatMonth(value: Date): string { return value.toISOString().slice(0, 7); }
function safeMoney(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new InternalServerErrorException('Stored invoice total is outside the JSON safe integer range.');
  return amount;
}
function transferContent(record: { studentName: string; studentNickname: string | null; className: string }): string {
  return `${record.studentName}${record.studentNickname ? ` [${record.studentNickname}]` : ''} ${record.className} chuyển tiền`;
}
function snapshotPayment(record: { paymentSnapshotMethod: InvoicePaymentMethod | null; paymentSnapshotBankCode: string | null; paymentSnapshotAccountNumber: string | null; paymentSnapshotAccountHolderName: string | null }) {
  if (!record.paymentSnapshotMethod) return null;
  if (record.paymentSnapshotMethod === InvoicePaymentMethod.CASH) return { method: InvoicePaymentMethod.CASH, bankAccount: null };
  if (!record.paymentSnapshotBankCode || !record.paymentSnapshotAccountNumber || !record.paymentSnapshotAccountHolderName) throw new InternalServerErrorException('Pending transfer invoice is missing its payment snapshot.');
  return { method: InvoicePaymentMethod.TRANSFER, bankAccount: { bankCode: record.paymentSnapshotBankCode, accountNumber: record.paymentSnapshotAccountNumber, accountHolderName: record.paymentSnapshotAccountHolderName } };
}
function serialize(record: { id: string; billingMonth: Date; studentName: string; studentNickname: string | null; classId: string; className: string; status: import('@prisma/client').InvoiceStatus; total: bigint; createdAt: Date; updatedAt: Date }) {
  return { id: record.id, billingMonth: formatMonth(record.billingMonth), student: { name: record.studentName, nickname: record.studentNickname }, schoolClass: { id: record.classId, name: record.className }, status: record.status, total: safeMoney(record.total), createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
}
function serializeDetail(record: Prisma.InvoiceGetPayload<{ include: { items: true; creator: true; confirmer: true; bankAccount: true } }>) {
  const payment = record.status === InvoiceStatus.DRAFT
    ? { method: record.paymentMethod, bankAccount: record.bankAccount ? { id: record.bankAccount.id, bankCode: record.bankAccount.bankCode, accountNumber: record.bankAccount.accountNumber, accountHolderName: record.bankAccount.accountHolderName } : null }
    : snapshotPayment(record);
  const qr = (record.status === InvoiceStatus.PENDING || record.status === InvoiceStatus.COMPLETED) && payment?.method === InvoicePaymentMethod.TRANSFER && payment.bankAccount
    ? { transferContent: transferContent(record), url: `https://img.vietqr.io/image/${encodeURIComponent(payment.bankAccount.bankCode)}-${encodeURIComponent(payment.bankAccount.accountNumber)}-compact2.png?amount=${safeMoney(record.total)}&addInfo=${encodeURIComponent(transferContent(record))}&accountName=${encodeURIComponent(payment.bankAccount.accountHolderName)}` }
    : null;
  return {
    ...serialize(record),
    items: record.items.sort((a, b) => a.position - b.position).map((item) => ({ id: item.id, description: item.description, feeGroup: item.feeGroup, amount: safeMoney(item.amount), position: item.position })),
    payment,
    qr,
    createdBy: { id: record.creator.id, displayName: record.creator.displayName },
    completedBy: record.confirmer ? { id: record.confirmer.id, displayName: record.confirmer.displayName } : null,
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}
type SkipReason = 'inactiveStudent' | 'missingClass' | 'archivedClass' | 'existingInvoice';
type Candidate = { id: string; fullName: string; nickname: string | null; status: StudentStatus; classId: string | null; class: { id: string; name: string; monthlyTuition: bigint; status: ClassStatus } | null };
type Eligibility = { eligible: Candidate[]; skipped: Record<SkipReason, number> };

async function eligibility(tx: Prisma.TransactionClient, input: BatchInvoiceDto): Promise<Eligibility> {
  const students = await tx.student.findMany({
    where: input.allActiveClasses ? {} : { classId: { in: [...new Set(input.classIds ?? [])] } },
    include: { class: true },
  });
  const existing = new Set((await tx.invoice.findMany({ where: { billingMonth: monthStart(input.billingMonth), studentId: { in: students.map((student) => student.id) } }, select: { studentId: true } })).map((invoice) => invoice.studentId));
  const skipped: Record<SkipReason, number> = { inactiveStudent: 0, missingClass: 0, archivedClass: 0, existingInvoice: 0 };
  const eligible: Candidate[] = [];
  for (const student of students) {
    if (existing.has(student.id)) skipped.existingInvoice += 1;
    else if (student.status !== StudentStatus.ACTIVE) skipped.inactiveStudent += 1;
    else if (!student.class) skipped.missingClass += 1;
    else if (student.class.status !== ClassStatus.ACTIVE) skipped.archivedClass += 1;
    else eligible.push(student);
  }
  return { eligible, skipped };
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService, private readonly operations: OperationsService = new OperationsService(prisma)) {}

  async list(query: ListInvoicesDto) {
    const where: Prisma.InvoiceWhereInput = {
      billingMonth: monthStart(query.billingMonth),
      ...(query.status ? { status: query.status } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.search ? { studentName: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.invoice.count({ where });
      const records = await tx.invoice.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return { data: records.map(serialize), meta: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.max(1, Math.ceil(total / query.pageSize)) } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async get(id: string) {
    const record = await this.prisma.invoice.findUnique({ where: { id }, include: { items: { orderBy: { position: 'asc' } }, creator: true, confirmer: true, bankAccount: true } });
    if (!record) throw new NotFoundException('Invoice not found.');
    return { data: serializeDetail(record) };
  }

  async update(id: string, input: UpdateInvoiceDto) {
    for (let attempt = 0; attempt < 3; attempt += 1) try {
      return await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id }, select: { status: true } });
      if (!invoice) throw new NotFoundException('Invoice not found.');
      if (invoice.status !== InvoiceStatus.DRAFT) throw new ConflictException('Only draft invoices can be edited.');
      if (input.paymentMethod === InvoicePaymentMethod.CASH && input.bankAccountId !== undefined) throw new ConflictException('Cash payment cannot include a bank account.');
      if (input.paymentMethod === InvoicePaymentMethod.TRANSFER) {
        const account = await tx.bankAccount.findUnique({ where: { id: input.bankAccountId } });
        if (!account || account.status !== BankAccountStatus.ACTIVE) throw new ConflictException('Transfer payment requires an active bank account.');
      }
      const items = input.items.map((item, position) => ({ description: item.description.trim(), feeGroup: item.feeGroup?.trim() || null, amount: BigInt(item.amount), position }));
      const total = items.reduce((sum, item) => sum + item.amount, 0n);
      safeMoney(total);
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({ where: { id }, data: { total, paymentMethod: input.paymentMethod, bankAccountId: input.paymentMethod === InvoicePaymentMethod.TRANSFER ? input.bankAccountId : null, items: { create: items } } });
       const record = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { position: 'asc' } }, creator: true, confirmer: true, bankAccount: true } });
      return { data: serializeDetail(record) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
    }
    throw new Error('Unreachable invoice update retry state.');
  }

  async moveToPending(id: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { id }, include: { bankAccount: true } });
        if (!invoice) throw new NotFoundException('Invoice not found.');
        if (invoice.status !== InvoiceStatus.DRAFT) throw new ConflictException('Only draft invoices can move to pending.');
        if (invoice.total <= 0n || invoice.total > 100_000_000n) throw new ConflictException('Invoice total must be greater than zero and no more than 100,000,000 VND.');
        if (!invoice.paymentMethod) throw new ConflictException('Select a payment method before moving to pending.');
        if (invoice.paymentMethod === InvoicePaymentMethod.CASH && invoice.bankAccountId) throw new ConflictException('Cash payment cannot include a bank account.');
        if (invoice.paymentMethod === InvoicePaymentMethod.TRANSFER && (!invoice.bankAccount || invoice.bankAccount.status !== BankAccountStatus.ACTIVE)) throw new ConflictException('Transfer payment requires an active bank account.');
        await tx.invoice.update({ where: { id }, data: {
          status: InvoiceStatus.PENDING,
          paymentSnapshotMethod: invoice.paymentMethod,
          paymentSnapshotBankCode: invoice.paymentMethod === InvoicePaymentMethod.TRANSFER ? invoice.bankAccount!.bankCode : null,
          paymentSnapshotAccountNumber: invoice.paymentMethod === InvoicePaymentMethod.TRANSFER ? invoice.bankAccount!.accountNumber : null,
          paymentSnapshotAccountHolderName: invoice.paymentMethod === InvoicePaymentMethod.TRANSFER ? invoice.bankAccount!.accountHolderName : null,
        } });
        const record = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { position: 'asc' } }, creator: true, confirmer: true, bankAccount: true } });
        return { data: serializeDetail(record) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
    }
    throw new Error('Unreachable invoice pending retry state.');
  }

  async moveToDraft(id: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { id }, select: { status: true } });
        if (!invoice) throw new NotFoundException('Invoice not found.');
        if (invoice.status !== InvoiceStatus.PENDING) throw new ConflictException('Only pending invoices can return to draft.');
        await tx.invoice.update({ where: { id }, data: { status: InvoiceStatus.DRAFT } });
        const record = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { position: 'asc' } }, creator: true, confirmer: true, bankAccount: true } });
        return { data: serializeDetail(record) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
    }
    throw new Error('Unreachable invoice draft retry state.');
  }

  async preview(input: BatchInvoiceDto) {
    const template = await this.prisma.invoiceTemplate.findFirst({ where: { singleton: true }, select: { items: { select: { id: true } } } });
    if (!template?.items.length) throw new DomainException(INVOICE_TEMPLATE_EMPTY, 'Invoice template must contain at least one item.');
    const result = await this.prisma.$transaction((tx) => eligibility(tx, input), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { data: { eligibleCount: result.eligible.length, skipped: result.skipped } };
  }

  async complete(id: string, operationId: string, adminId: string) {
    const route = `/invoices/${id}/complete`;
    const fingerprint = this.operations.fingerprint({});
    for (let attempt = 0; attempt < 3; attempt += 1) try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await this.operations.acquireOrReplay(tx, adminId, route, operationId, fingerprint);
        if (replay !== undefined) return replay as { data: unknown };
        const invoice = await tx.invoice.findUnique({ where: { id } });
        if (!invoice) throw new NotFoundException('Invoice not found.');
        if (invoice.status !== InvoiceStatus.PENDING) throw new ConflictException('Only pending invoices can be completed.');
        if (invoice.total <= 0n) throw new ConflictException('Invoice total must be greater than zero to complete.');
        await tx.invoice.update({ where: { id }, data: { status: InvoiceStatus.COMPLETED, confirmerId: adminId, completedAt: new Date() } });
        const record = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { position: 'asc' } }, creator: true, confirmer: true, bankAccount: true } });
        const response = { data: serializeDetail(record) };
        await this.operations.complete(tx, { id: operationId, adminId, route, fingerprint, response });
        return response;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // A concurrent request with this key can win the initial operation insert; retry to replay it.
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(error.code)) throw error;
    }
    throw new Error('Unreachable invoice completion retry state.');
  }

  async createBatch(input: BatchInvoiceDto, operationId: string, adminId: string) {
    const route = '/invoices/batch';
    const fingerprint = this.operations.fingerprint({ billingMonth: input.billingMonth, allActiveClasses: input.allActiveClasses, classIds: input.allActiveClasses ? [] : [...new Set(input.classIds ?? [])].sort() });
    for (let attempt = 0; attempt < 3; attempt += 1) try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await this.operations.acquireOrReplay(tx, adminId, route, operationId, fingerprint);
        if (replay !== undefined) return replay as { data: unknown };
        const template = await tx.invoiceTemplate.findFirst({ where: { singleton: true }, include: { items: { orderBy: { position: 'asc' } } } });
        if (!template?.items.length) throw new DomainException(INVOICE_TEMPLATE_EMPTY, 'Invoice template must contain at least one item.');
        const result = await eligibility(tx, input);
        if (!result.eligible.length) throw new DomainException(INVOICE_BATCH_EMPTY, 'No students are eligible for invoice creation.');
        for (const student of result.eligible) {
          const schoolClass = student.class!;
          const items = template.items.map((item) => ({ description: item.description, feeGroup: item.feeGroup, position: item.position, amount: item.amountSource === 'CLASS_TUITION' ? schoolClass.monthlyTuition : item.fixedAmount! }));
          const total = items.reduce((sum, item) => sum + item.amount, 0n);
          await tx.invoice.create({ data: { studentId: student.id, billingMonth: monthStart(input.billingMonth), studentName: student.fullName, studentNickname: student.nickname, classId: schoolClass.id, className: schoolClass.name, total, creatorId: adminId, items: { create: items } } });
        }
        const response = { data: { operationId, createdCount: result.eligible.length, skipped: result.skipped } };
        await this.operations.complete(tx, { id: operationId, adminId, route, fingerprint, response });
        return response;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(error.code)) throw error;
    }
    throw new Error('Unreachable invoice batch retry state.');
  }
}
