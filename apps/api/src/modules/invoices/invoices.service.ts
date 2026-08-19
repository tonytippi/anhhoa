import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ListInvoicesDto } from './invoices.dto.js';

function monthStart(value: string): Date { return new Date(`${value}-01T00:00:00.000Z`); }
function formatMonth(value: Date): string { return value.toISOString().slice(0, 7); }
function safeMoney(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new InternalServerErrorException('Stored invoice total is outside the JSON safe integer range.');
  return amount;
}
function serialize(record: { id: string; billingMonth: Date; studentName: string; studentNickname: string | null; classId: string; className: string; status: import('@prisma/client').InvoiceStatus; total: bigint; createdAt: Date; updatedAt: Date }) {
  return { id: record.id, billingMonth: formatMonth(record.billingMonth), student: { name: record.studentName, nickname: record.studentNickname }, schoolClass: { id: record.classId, name: record.className }, status: record.status, total: safeMoney(record.total), createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

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
    const record = await this.prisma.invoice.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Invoice not found.');
    return { data: serialize(record) };
  }
}
