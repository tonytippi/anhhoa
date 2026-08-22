import { Inject, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InvoicePaymentMethod, InvoiceStatus, Prisma, StudentParentStatus } from '@prisma/client';
import QRCode from 'qrcode';
import { Banks, QRPay } from 'vietnam-qr-pay';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AUTH_CONFIG } from '../../common/config/config.module.js';
import type { AuthConfig } from '../../common/config/auth-config.js';
import type { ListParentInvoicesDto } from './parent-portal.dto.js';

const allowedStatuses = [InvoiceStatus.PENDING, InvoiceStatus.COMPLETED];
const invoiceSelect = {
  id: true, studentId: true, billingMonth: true, studentName: true, studentNickname: true, status: true, total: true,
  paymentSnapshotMethod: true, items: { select: { description: true, feeGroup: true, amount: true, position: true }, orderBy: { position: 'asc' as const } },
} satisfies Prisma.InvoiceSelect;
type ParentInvoice = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;
const paymentSelect = {
  id: true, studentId: true, billingMonth: true, studentName: true, className: true, status: true, total: true,
  paymentSnapshotMethod: true, paymentSnapshotBankCode: true, paymentSnapshotAccountNumber: true,
  paymentSnapshotAccountHolderName: true, paymentSnapshotTransferContent: true,
} satisfies Prisma.InvoiceSelect;
type ParentPayment = Prisma.InvoiceGetPayload<{ select: typeof paymentSelect }>;

function formatMonth(month: Date) { return month.toISOString().slice(0, 7); }
function money(value: bigint) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new InternalServerErrorException('Stored invoice amount is outside the JSON safe integer range.');
  return amount;
}
function serializeInvoice(invoice: ParentInvoice) {
  if (!invoice.paymentSnapshotMethod) throw new InternalServerErrorException('Visible invoice is missing its payment snapshot method.');
  return {
    id: invoice.id,
    student: { id: invoice.studentId, name: invoice.studentName, nickname: invoice.studentNickname },
    billingMonth: formatMonth(invoice.billingMonth),
    status: invoice.status,
    total: money(invoice.total),
    paymentMethod: invoice.paymentSnapshotMethod,
    items: invoice.items.map((item) => ({ description: item.description, feeGroup: item.feeGroup, amount: money(item.amount), position: item.position })),
  };
}
function paymentSnapshot(invoice: ParentPayment) {
  const bankCode = invoice.paymentSnapshotBankCode?.trim();
  const accountNumber = invoice.paymentSnapshotAccountNumber?.trim();
  const accountHolderName = invoice.paymentSnapshotAccountHolderName?.trim();
  const transferContent = invoice.paymentSnapshotTransferContent?.trim();
  if (invoice.status !== InvoiceStatus.PENDING || invoice.paymentSnapshotMethod !== InvoicePaymentMethod.TRANSFER || invoice.total <= 0n || !invoice.studentName.trim() || !invoice.className.trim() || !bankCode || !accountNumber || !accountHolderName || !transferContent || !(Banks as Array<{ code: string }>).some((bank) => bank.code === bankCode)) return null;
  return {
    id: invoice.id,
    student: { id: invoice.studentId, name: invoice.studentName },
    billingMonth: formatMonth(invoice.billingMonth),
    total: money(invoice.total),
    bankCode,
    accountNumber,
    accountHolderName,
    transferContent,
  };
}
function vietQrPayload(payment: NonNullable<ReturnType<typeof paymentSnapshot>>) {
  const bank = (Banks as Array<{ code: string; bin: string }>).find((entry) => entry.code === payment.bankCode);
  if (!bank) throw new InternalServerErrorException('Payment snapshot bank code cannot generate VietQR.');
  return QRPay.initVietQR({ bankBin: bank.bin, bankNumber: payment.accountNumber, amount: payment.total.toString(), purpose: payment.transferContent }).build();
}
function bankDeepLink(payment: NonNullable<ReturnType<typeof paymentSnapshot>>, config: AuthConfig) {
  const template = config.bankDeepLinks.get(payment.bankCode)?.template;
  if (!template) return undefined;
  const values: Record<string, string> = { bankCode: payment.bankCode, accountNumber: payment.accountNumber, accountHolderName: payment.accountHolderName, transferContent: payment.transferContent, total: payment.total.toString() };
  const uri = template.replace(/\{([A-Za-z]+)\}/g, (_, name: string) => encodeURIComponent(values[name]!));
  try { new URL(uri); return { uri }; } catch { return undefined; }
}

@Injectable()
export class ParentPortalService {
  constructor(private readonly prisma: PrismaService, @Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  async students(parentId: string) {
    const records = await this.prisma.studentParent.findMany({
      where: { parentId, status: StudentParentStatus.ACTIVE, parent: { status: 'ACTIVE' } },
      select: { student: { select: { id: true, fullName: true, nickname: true } } },
      orderBy: [{ student: { fullName: 'asc' } }, { studentId: 'asc' }],
    });
    return { data: records.map(({ student }) => ({ id: student.id, fullName: student.fullName, nickname: student.nickname })) };
  }

  async invoices(parentId: string, query: ListParentInvoicesDto) {
    if (query.studentId) await this.assertStudent(parentId, query.studentId);
    const where: Prisma.InvoiceWhereInput = {
      status: query.status ?? { in: allowedStatuses },
      student: { parents: { some: { parentId, status: StudentParentStatus.ACTIVE, parent: { status: 'ACTIVE' } } } },
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.billingMonth ? { billingMonth: new Date(`${query.billingMonth}-01T00:00:00.000Z`) } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.invoice.count({ where });
      const records = await tx.invoice.findMany({ where, select: invoiceSelect, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return { data: records.map(serializeInvoice), meta: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.max(1, Math.ceil(total / query.pageSize)) } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async invoice(parentId: string, invoiceId: string) {
    if (!this.isUuid(invoiceId)) this.denied();
    const record = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, status: { in: allowedStatuses }, student: { parents: { some: { parentId, status: StudentParentStatus.ACTIVE, parent: { status: 'ACTIVE' } } } } },
      select: invoiceSelect,
    });
    if (!record) this.denied();
    return { data: serializeInvoice(record) };
  }

  async payment(parentId: string, invoiceId: string) {
    if (!this.isUuid(invoiceId)) this.denied();
    const record = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, student: { parents: { some: { parentId, status: StudentParentStatus.ACTIVE, parent: { status: 'ACTIVE' } } } } },
      select: paymentSelect,
    });
    const snapshot = record && paymentSnapshot(record);
    if (!snapshot) this.denied();
    const action = bankDeepLink(snapshot, this.config);
    return { data: snapshot, vietQr: vietQrPayload(snapshot), ...(action ? { action } : {}) };
  }

  async paymentPng(parentId: string, invoiceId: string) {
    const payment = await this.payment(parentId, invoiceId);
    try {
      return await QRCode.toBuffer(payment.vietQr, { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 512 });
    } catch {
      throw new InternalServerErrorException('Unable to generate VietQR PNG.');
    }
  }

  private async assertStudent(parentId: string, studentId: string) {
    if (!this.isUuid(studentId)) this.denied();
    const link = await this.prisma.studentParent.findFirst({ where: { parentId, studentId, status: StudentParentStatus.ACTIVE, parent: { status: 'ACTIVE' } }, select: { id: true } });
    if (!link) this.denied();
  }

  private denied(): never { throw new UnauthorizedException('Parent is not authorized to access this resource.'); }
  private isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
}
