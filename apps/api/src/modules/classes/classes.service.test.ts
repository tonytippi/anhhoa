import { NotFoundException } from '@nestjs/common';
import { ClassStatus, StudentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ClassesService } from './classes.service.js';

const record = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1', monthlyTuition: 1500000n, status: ClassStatus.ACTIVE, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), _count: { students: 0 } };
function prisma() {
  const tx = { $queryRaw: vi.fn(), class: { findMany: vi.fn().mockResolvedValue([record]), count: vi.fn().mockResolvedValue(1), findUnique: vi.fn().mockResolvedValue(record), update: vi.fn().mockResolvedValue({ ...record, status: ClassStatus.ARCHIVED }) }, student: { count: vi.fn().mockResolvedValue(0) } };
  return { class: { findMany: vi.fn().mockResolvedValue([record]), count: vi.fn().mockResolvedValue(1), findUnique: vi.fn().mockResolvedValue(record), findUniqueOrThrow: vi.fn().mockResolvedValue(record), create: vi.fn().mockResolvedValue(record), update: vi.fn().mockResolvedValue(record), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, student: { count: vi.fn() }, $transaction: vi.fn(async (argument: unknown) => Array.isArray(argument) ? Promise.all(argument) : (argument as (client: typeof tx) => Promise<unknown>)(tx)), tx };
}

describe('ClassesService', () => {
  it('filters, trims search, orders deterministically, and preserves empty requested pages', async () => {
    const db = prisma();
    db.tx.class.findMany.mockResolvedValue([]);
    const result = await new ClassesService(db as never).list({ page: 99, pageSize: 20, status: ClassStatus.ACTIVE, search: ' Mầm ' });
    expect(result).toMatchObject({ data: [], meta: { page: 99, pageCount: 1, total: 1 } });
    expect(db.tx.class.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 1960, where: { status: ClassStatus.ACTIVE, name: { contains: 'Mầm', mode: 'insensitive' } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { _count: { select: { students: { where: { status: StudentStatus.ACTIVE } } } } } }));
  });

  it('creates supplied tuition as bigint and serializes it', async () => {
    const db = prisma();
    db.class.create.mockResolvedValue({ ...record, monthlyTuition: 2300000n });
    await expect(new ClassesService(db as never).create({ name: 'Mầm 1', monthlyTuition: 2300000 })).resolves.toMatchObject({ data: { monthlyTuition: 2300000 } });
    expect(db.class.create).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Mầm 1', monthlyTuition: 2300000n } }));
  });

  it('gets and updates active classes, returning not found when absent', async () => {
    const db = prisma();
    const service = new ClassesService(db as never);
    await expect(service.get(record.id)).resolves.toMatchObject({ data: { id: record.id, activeStudentCount: 0 } });
    await expect(service.update(record.id, { name: 'Mầm 2', monthlyTuition: 100 })).resolves.toMatchObject({ data: { name: 'Mầm 1' } });
    expect(db.class.updateMany).toHaveBeenCalledWith({ where: { id: record.id, status: ClassStatus.ACTIVE }, data: { name: 'Mầm 2', monthlyTuition: 100n } });
    db.class.findUnique.mockResolvedValueOnce(null);
    await expect(service.get(record.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not update archived classes', async () => {
    const db = prisma();
    db.class.updateMany.mockResolvedValue({ count: 0 });
    db.class.findUnique.mockResolvedValue({ ...record, status: ClassStatus.ARCHIVED });
    await expect(new ClassesService(db as never).update(record.id, { name: 'Mầm 2', monthlyTuition: 100 })).rejects.toMatchObject({ response: { code: 'CLASS_ARCHIVED' } });
    expect(db.class.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('rejects unsafe persisted bigint before JSON serialization', async () => {
    const db = prisma();
    db.class.findUnique.mockResolvedValue({ ...record, monthlyTuition: BigInt(Number.MAX_SAFE_INTEGER) + 1n });
    await expect(new ClassesService(db as never).get(record.id)).rejects.toThrow('Stored tuition is outside the JSON safe integer range.');
  });

  it('uses a serializable transaction and blocks archive with active student count', async () => {
    const db = prisma();
    db.tx.student.count.mockResolvedValue(2);
    await expect(new ClassesService(db as never).archive(record.id)).rejects.toMatchObject({ response: { code: 'CLASS_HAS_ACTIVE_STUDENTS', metadata: { activeStudentCount: 2 } } });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(db.tx.class.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: record.id } }));
  });

  it('soft archives and leaves an archived class idempotent', async () => {
    const db = prisma();
    const service = new ClassesService(db as never);
    await expect(service.archive(record.id)).resolves.toMatchObject({ data: { status: 'ARCHIVED', activeStudentCount: 0 } });
    db.tx.class.findUnique.mockResolvedValue({ ...record, status: ClassStatus.ARCHIVED });
    await expect(service.archive(record.id)).resolves.toMatchObject({ data: { status: 'ARCHIVED' } });
    expect(db.tx.class.update).toHaveBeenCalledTimes(1);
  });
});
