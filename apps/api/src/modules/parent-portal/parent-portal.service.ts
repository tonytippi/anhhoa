import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InvoiceStatus, Prisma, StudentParentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ListParentInvoicesDto } from './parent-portal.dto.js';

const allowedStatuses = [InvoiceStatus.PENDING, InvoiceStatus.COMPLETED];
const invoiceSelect = {
  id: true, billingMonth: true, studentName: true, studentNickname: true, status: true, total: true,
  paymentSnapshotMethod: true, items: { select: { description: true, feeGroup: true, amount: true, position: true }, orderBy: { position: 'asc' as const } },
} satisfies Prisma.InvoiceSelect;
type ParentInvoice = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;

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
    student: { name: invoice.studentName, nickname: invoice.studentNickname },
    billingMonth: formatMonth(invoice.billingMonth),
    status: invoice.status,
    total: money(invoice.total),
    paymentMethod: invoice.paymentSnapshotMethod,
    items: invoice.items.map((item) => ({ description: item.description, feeGroup: item.feeGroup, amount: money(item.amount), position: item.position })),
  };
}

@Injectable()
export class ParentPortalService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async assertStudent(parentId: string, studentId: string) {
    if (!this.isUuid(studentId)) this.denied();
    const link = await this.prisma.studentParent.findFirst({ where: { parentId, studentId, status: StudentParentStatus.ACTIVE, parent: { status: 'ACTIVE' } }, select: { id: true } });
    if (!link) this.denied();
  }

  private denied(): never { throw new UnauthorizedException('Parent is not authorized to access this resource.'); }
  private isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
}
