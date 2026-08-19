import { Injectable, NotFoundException } from '@nestjs/common';
import { BankAccountStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CreateBankAccountDto, ListBankAccountsDto } from './bank-accounts.dto.js';

function serialize(record: { id: string; bankCode: string; accountNumber: string; accountHolderName: string; status: BankAccountStatus; createdAt: Date; updatedAt: Date }) {
  return { id: record.id, bankCode: record.bankCode, accountNumber: record.accountNumber, accountHolderName: record.accountHolderName, status: record.status, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
}

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListBankAccountsDto) {
    const search = query.search?.trim();
    const where: Prisma.BankAccountWhereInput = { ...(query.status ? { status: query.status } : {}), ...(search ? { OR: [{ bankCode: { contains: search, mode: 'insensitive' } }, { accountNumber: { contains: search, mode: 'insensitive' } }, { accountHolderName: { contains: search, mode: 'insensitive' } }] } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.bankAccount.count({ where });
      const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
      const records = await tx.bankAccount.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return { data: records.map(serialize), meta: { page: query.page, pageSize: query.pageSize, total, pageCount } };
    });
  }

  async get(id: string) {
    const record = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Bank account not found.');
    return { data: serialize(record) };
  }

  async create(input: CreateBankAccountDto) {
    const record = await this.prisma.bankAccount.create({ data: { bankCode: input.bankCode.trim(), accountNumber: input.accountNumber.trim(), accountHolderName: input.accountHolderName.trim() } });
    return { data: serialize(record) };
  }

  async setStatus(id: string, status: BankAccountStatus) {
    return this.prisma.$transaction(async (tx) => {
      try {
        // `update` locks and returns the row written by this request, including idempotent writes.
        const record = await tx.bankAccount.update({ where: { id }, data: { status } });
        return { data: serialize(record) };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Bank account not found.');
        throw error;
      }
    });
  }
}
