import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, Prisma, StudentStatus } from '@prisma/client';
import { CLASS_ARCHIVED, CLASS_NOT_FOUND, DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CreateStudentDto, ListStudentsDto, UpdateStudentDto } from './students.dto.js';

const studentWithClass = { class: { select: { id: true, name: true } } } satisfies Prisma.StudentInclude;
type StudentRecord = Prisma.StudentGetPayload<{ include: typeof studentWithClass }>;

function serialize(record: StudentRecord) {
  return { id: record.id, fullName: record.fullName, nickname: record.nickname, classId: record.classId, class: record.class, status: record.status, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListStudentsDto) {
    const search = query.search?.trim();
    const where: Prisma.StudentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { nickname: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.student.count({ where });
      const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
      const records = await tx.student.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: studentWithClass });
      return { data: records.map(serialize), meta: { page: query.page, pageSize: query.pageSize, total, pageCount } };
    });
  }

  async get(id: string) {
    const record = await this.prisma.student.findUnique({ where: { id }, include: studentWithClass });
    if (!record) throw new NotFoundException('Student not found.');
    return { data: serialize(record) };
  }

  async create(input: CreateStudentDto) {
    const record = await this.prisma.student.create({ data: { fullName: input.fullName.trim(), ...(input.nickname ? { nickname: input.nickname.trim() } : {}) }, include: studentWithClass });
    return { data: serialize(record) };
  }

  async update(id: string, input: UpdateStudentDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.student.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Student not found.');
      if (input.classId !== undefined) await this.lockActiveClass(tx, input.classId);
      const nickname = input.nickname?.trim();
      await tx.student.update({ where: { id }, data: { fullName: input.fullName.trim(), ...(input.nickname !== undefined ? { nickname: nickname || null } : {}), ...(input.classId !== undefined ? { classId: input.classId } : {}) } });
      return { data: serialize(await tx.student.findUniqueOrThrow({ where: { id }, include: studentWithClass })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async setStatus(id: string, status: StudentStatus) {
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { id } });
      if (!student) throw new NotFoundException('Student not found.');
      if (status === StudentStatus.ACTIVE && student.classId) await this.lockActiveClass(tx, student.classId);
      const record = await tx.student.update({ where: { id }, data: { status }, include: studentWithClass });
      return { data: serialize(record) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async lockActiveClass(tx: Prisma.TransactionClient, classId: string | null) {
    if (!classId) return;
    await tx.$queryRaw`SELECT id FROM "Class" WHERE id = ${classId}::uuid FOR UPDATE`;
    const schoolClass = await tx.class.findUnique({ where: { id: classId } });
    if (!schoolClass) throw new DomainException(CLASS_NOT_FOUND, 'Class not found.', undefined, ['classId Class not found.']);
    if (schoolClass.status !== ClassStatus.ACTIVE) throw new DomainException(CLASS_ARCHIVED, 'Archived classes cannot accept students.', undefined, ['classId Archived classes cannot accept students.']);
  }
}
