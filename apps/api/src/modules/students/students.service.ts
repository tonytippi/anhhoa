import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StudentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CreateStudentDto, ListStudentsDto, UpdateStudentDto } from './students.dto.js';

type StudentRecord = Prisma.StudentGetPayload<Record<never, never>>;

function serialize(record: StudentRecord) {
  return { id: record.id, fullName: record.fullName, nickname: record.nickname, classId: record.classId, status: record.status, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
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
      const records = await tx.student.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return { data: records.map(serialize), meta: { page: query.page, pageSize: query.pageSize, total, pageCount } };
    });
  }

  async get(id: string) {
    const record = await this.prisma.student.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Student not found.');
    return { data: serialize(record) };
  }

  async create(input: CreateStudentDto) {
    const record = await this.prisma.student.create({ data: { fullName: input.fullName.trim(), ...(input.nickname ? { nickname: input.nickname.trim() } : {}) } });
    return { data: serialize(record) };
  }

  async update(id: string, input: UpdateStudentDto) {
    const updated = await this.prisma.student.updateMany({ where: { id }, data: { fullName: input.fullName.trim(), ...(input.nickname !== undefined ? { nickname: input.nickname === null ? null : input.nickname.trim() } : {}) } });
    if (updated.count === 0) throw new NotFoundException('Student not found.');
    return this.get(id);
  }

  async setStatus(id: string, status: StudentStatus) {
    const updated = await this.prisma.student.updateMany({ where: { id }, data: { status } });
    if (updated.count === 0) throw new NotFoundException('Student not found.');
    return this.get(id);
  }
}
