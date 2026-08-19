import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, Prisma, StudentStatus } from '@prisma/client';
import { CLASS_ARCHIVED, CLASS_HAS_ACTIVE_STUDENTS, CLASS_NOT_FOUND, CLASS_TRANSFER_INVALID, DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { OperationsService } from '../operations/operations.service.js';
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
  constructor(private readonly prisma: PrismaService, private readonly operations: OperationsService = new OperationsService(prisma)) {}

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
      await tx.$queryRaw`SELECT id FROM "Class" WHERE id = ${id}::uuid FOR UPDATE`;
      const record = await tx.class.findUnique({ where: { id }, include: classWithCount });
      if (!record) throw new NotFoundException('Class not found.');
      if (record.status === ClassStatus.ARCHIVED) return { data: serialize(record) };
      const activeStudentCount = await tx.student.count({ where: { classId: id, status: StudentStatus.ACTIVE } });
      if (activeStudentCount > 0) throw new DomainException(CLASS_HAS_ACTIVE_STUDENTS, 'Class has active students.', { activeStudentCount });
      const archived = await tx.class.update({ where: { id }, data: { status: ClassStatus.ARCHIVED }, include: classWithCount });
      return { data: serialize(archived) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async transfer(sourceClassId: string, destinationClassId: string, operationId: string, adminId: string) {
    const route = `/classes/${sourceClassId}/transfer`;
    const fingerprint = this.operations.fingerprint({ sourceClassId, destinationClassId });
    for (let attempt = 0; attempt < 3; attempt += 1) try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await this.operations.acquireOrReplay(tx, adminId, route, operationId, fingerprint);
        if (replay !== undefined) return replay as { data: unknown };
        if (sourceClassId === destinationClassId) throw new DomainException(CLASS_TRANSFER_INVALID, 'Source and destination classes must differ.', undefined, ['destinationClassId Destination class must differ from source class.']);
        for (const id of [sourceClassId, destinationClassId].sort()) await tx.$queryRaw`SELECT id FROM "Class" WHERE id = ${id}::uuid FOR UPDATE`;
        const [source, destination] = await Promise.all([
          tx.class.findUnique({ where: { id: sourceClassId }, include: classWithCount }),
          tx.class.findUnique({ where: { id: destinationClassId }, include: classWithCount }),
        ]);
       if (!source) throw new NotFoundException('Source class not found.');
       if (!destination) throw new DomainException(CLASS_NOT_FOUND, 'Destination class not found.', undefined, ['destinationClassId Destination class not found.']);
       if (source.status !== ClassStatus.ACTIVE) throw new DomainException(CLASS_ARCHIVED, 'Archived source classes cannot transfer students.');
       if (destination.status !== ClassStatus.ACTIVE) throw new DomainException(CLASS_ARCHIVED, 'Archived classes cannot accept students.', undefined, ['destinationClassId Archived classes cannot accept students.']);
        const affectedStudentCount = await tx.student.count({ where: { classId: sourceClassId, status: StudentStatus.ACTIVE } });
        await tx.student.updateMany({ where: { classId: sourceClassId, status: StudentStatus.ACTIVE }, data: { classId: destinationClassId } });
        const result = { data: { source: serialize(await tx.class.findUniqueOrThrow({ where: { id: sourceClassId }, include: classWithCount })), destination: serialize(await tx.class.findUniqueOrThrow({ where: { id: destinationClassId }, include: classWithCount })), affectedStudentCount, operationId } };
        await this.operations.complete(tx, { id: operationId, adminId, route, fingerprint, response: result });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(error.code)) throw error;
    }
    throw new Error('Unreachable transfer retry state.');
  }
}
