import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InvoicePaymentMethod, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MonthlyReportDto } from './reports.dto.js';

function monthStart(value: string): Date { return new Date(`${value}-01T00:00:00.000Z`); }
function safeMoney(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new InternalServerErrorException('Stored invoice total is outside the JSON safe integer range.');
  return amount;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async monthly(query: MonthlyReportDto) {
    const invoices = await this.prisma.invoice.findMany({
      where: { billingMonth: monthStart(query.billingMonth) },
      select: { status: true, total: true, paymentSnapshotMethod: true, paymentSnapshotBankCode: true, paymentSnapshotAccountNumber: true, paymentSnapshotAccountHolderName: true },
    });
    const counts = { draft: 0, pending: 0, completed: 0 };
    let totalCollected = 0n;
    let cashCollected = 0n;
    let transferCollected = 0n;
    const transfers = new Map<string, { bankCode: string; accountNumber: string; accountHolderName: string; total: bigint }>();
    for (const invoice of invoices) {
      if (invoice.status === InvoiceStatus.DRAFT) { counts.draft += 1; continue; }
      if (invoice.status === InvoiceStatus.PENDING) { counts.pending += 1; continue; }
      if (invoice.status !== InvoiceStatus.COMPLETED) continue;
      counts.completed += 1;
      totalCollected += invoice.total;
      if (invoice.paymentSnapshotMethod === InvoicePaymentMethod.CASH) { cashCollected += invoice.total; continue; }
      if (invoice.paymentSnapshotMethod !== InvoicePaymentMethod.TRANSFER || !invoice.paymentSnapshotBankCode || !invoice.paymentSnapshotAccountNumber || !invoice.paymentSnapshotAccountHolderName) throw new InternalServerErrorException('Completed invoice is missing its payment snapshot.');
      transferCollected += invoice.total;
      const key = `${invoice.paymentSnapshotBankCode}\u0000${invoice.paymentSnapshotAccountNumber}\u0000${invoice.paymentSnapshotAccountHolderName}`;
      const existing = transfers.get(key);
      if (existing) existing.total += invoice.total;
      else transfers.set(key, { bankCode: invoice.paymentSnapshotBankCode, accountNumber: invoice.paymentSnapshotAccountNumber, accountHolderName: invoice.paymentSnapshotAccountHolderName, total: invoice.total });
    }
    return { data: {
      billingMonth: query.billingMonth,
      counts,
      totalCollected: safeMoney(totalCollected),
      cashCollected: safeMoney(cashCollected),
      transferCollected: safeMoney(transferCollected),
      transferBreakdown: [...transfers.values()].map((account) => ({ ...account, total: safeMoney(account.total) })).sort((left, right) => right.total - left.total || left.bankCode.localeCompare(right.bankCode) || left.accountNumber.localeCompare(right.accountNumber)),
    } };
  }
}
