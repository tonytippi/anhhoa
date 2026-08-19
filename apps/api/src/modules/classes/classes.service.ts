import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, Prisma, StudentStatus } from '@prisma/client';
import { CLASS_HAS_ACTIVE_STUDENTS, DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CreateClassDto, ListClassesDto, UpdateClassDto } from './classes.dto.js';

const activeStudents = { where: { status: StudentStatus.ACTIVE }, select: { id: true, fullName: true } } satisfies Prisma.StudentFindManyArgs;
type ClassRecord = Prisma.ClassGetPayload<{ include: { students: typeof activeStudents } }>;
type ArchiveRecord = Prisma.ClassGetPayload<object>;

function safeMoney(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error('Stored tuition is outside the JSON safe integer range.');
  return amount;
}

function serialize(record: ClassRecord | ArchiveRecord) {
  const students = 'students' in record ? record.students : [];
  return { id: record.id, name: record.name, monthlyTuition: safeMoney(record.monthlyTuition), status: record.status, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), activeStudents: students.map((student) => ({ id: student.id, fullName: student.fullName })) };
}

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListClassesDto) {
    const where: Prisma.ClassWhereInput = { ...(query.status ? { status: query.status } : {}), ...(query.search?.trim() ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.class.count({ where });
      const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
      const page = Math.min(query.page, pageCount);
      const records = await tx.class.findMany({ where, skip: (page - 1) * query.pageSize, take: query.pageSize, orderBy: { name: 'asc' }, include: { students: activeStudents } });
      return { data: records.map(serialize), meta: { page, pageSize: query.pageSize, total, pageCount } };
    });
  }

  async get(id: string) {
    const record = await this.prisma.class.findUnique({ where: { id }, include: { students: activeStudents } });
    if (!record) throw new NotFoundException('Class not found.');
    return { data: serialize(record) };
  }

  async create(input: CreateClassDto) {
    const record = await this.prisma.class.create({ data: { name: input.name.trim(), monthlyTuition: BigInt(input.monthlyTuition) }, include: { students: activeStudents } });
    return { data: serialize(record) };
  }

  async update(id: string, input: UpdateClassDto) {
    await this.get(id);
    const record = await this.prisma.class.update({ where: { id }, data: { name: input.name.trim(), monthlyTuition: BigInt(input.monthlyTuition) }, include: { students: activeStudents } });
    return { data: serialize(record) };
  }

  async archive(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.class.findUnique({ where: { id } });
      if (!record) throw new NotFoundException('Class not found.');
      if (record.status === ClassStatus.ARCHIVED) return { data: serialize(record) };
      const activeStudentCount = await tx.student.count({ where: { classId: id, status: StudentStatus.ACTIVE } });
      if (activeStudentCount > 0) throw new DomainException(CLASS_HAS_ACTIVE_STUDENTS, 'Class has active students.', { activeStudentCount });
      const archived = await tx.class.update({ where: { id }, data: { status: ClassStatus.ARCHIVED } });
      return { data: serialize(archived) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
