import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, Prisma, StudentStatus } from '@prisma/client';
import { CLASS_ARCHIVED, CLASS_HAS_ACTIVE_STUDENTS, DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CreateClassDto, ListClassesDto, UpdateClassDto } from './classes.dto.js';

const classWithCount = { _count: { select: { students: { where: { status: StudentStatus.ACTIVE } } } } } satisfies Prisma.ClassInclude;
type ClassRecord = Prisma.ClassGetPayload<{ include: typeof classWithCount }>;

function safeMoney(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error('Stored tuition is outside the JSON safe integer range.');
  return amount;
}

function serialize(record: ClassRecord) {
  return { id: record.id, name: record.name, monthlyTuition: safeMoney(record.monthlyTuition), status: record.status, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), activeStudentCount: record._count.students };
}

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListClassesDto) {
    const where: Prisma.ClassWhereInput = { ...(query.status ? { status: query.status } : {}), ...(query.search?.trim() ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.class.count({ where });
      const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
      const records = await tx.class.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: classWithCount });
      return { data: records.map(serialize), meta: { page: query.page, pageSize: query.pageSize, total, pageCount } };
    });
  }

  async get(id: string) {
    const record = await this.prisma.class.findUnique({ where: { id }, include: classWithCount });
    if (!record) throw new NotFoundException('Class not found.');
    return { data: serialize(record) };
  }

  async create(input: CreateClassDto) {
    const record = await this.prisma.class.create({ data: { name: input.name.trim(), monthlyTuition: BigInt(input.monthlyTuition) }, include: classWithCount });
    return { data: serialize(record) };
  }

  async update(id: string, input: UpdateClassDto) {
    const data = { name: input.name.trim(), monthlyTuition: BigInt(input.monthlyTuition) };
    const updated = await this.prisma.class.updateMany({ where: { id, status: ClassStatus.ACTIVE }, data });
    if (updated.count === 0) {
      const existing = await this.prisma.class.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Class not found.');
      throw new DomainException(CLASS_ARCHIVED, 'Archived classes are read-only.');
    }
    const record = await this.prisma.class.findUniqueOrThrow({ where: { id }, include: classWithCount });
    return { data: serialize(record) };
  }

  async archive(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.class.findUnique({ where: { id }, include: classWithCount });
      if (!record) throw new NotFoundException('Class not found.');
      if (record.status === ClassStatus.ARCHIVED) return { data: serialize(record) };
      const activeStudentCount = await tx.student.count({ where: { classId: id, status: StudentStatus.ACTIVE } });
      if (activeStudentCount > 0) throw new DomainException(CLASS_HAS_ACTIVE_STUDENTS, 'Class has active students.', { activeStudentCount });
      const archived = await tx.class.update({ where: { id }, data: { status: ClassStatus.ARCHIVED }, include: classWithCount });
      return { data: serialize(archived) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
