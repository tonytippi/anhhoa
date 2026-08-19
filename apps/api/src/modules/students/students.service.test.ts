import { NotFoundException } from '@nestjs/common';
import { StudentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { StudentsService } from './students.service.js';

const record = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', fullName: 'Bé An', nickname: 'An', classId: null, status: StudentStatus.ACTIVE, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') };
function prisma() {
  const tx = { student: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([record]) } };
  return { student: { findUnique: vi.fn().mockResolvedValue(record), create: vi.fn().mockResolvedValue(record), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)), tx };
}

describe('StudentsService', () => {
  it('searches full name and nickname before status filtering with deterministic pagination', async () => {
    const db = prisma();
    db.tx.student.findMany.mockResolvedValue([]);
    const result = await new StudentsService(db as never).list({ search: ' An ', status: StudentStatus.INACTIVE, page: 99, pageSize: 20 });
    expect(result).toMatchObject({ data: [], meta: { page: 99, pageCount: 1, total: 1 } });
    expect(db.tx.student.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 1960, where: { status: StudentStatus.INACTIVE, OR: [{ fullName: { contains: 'An', mode: 'insensitive' } }, { nickname: { contains: 'An', mode: 'insensitive' } }] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }));
  });

  it('creates and updates identity without accepting or changing classId', async () => {
    const db = prisma();
    const service = new StudentsService(db as never);
    await expect(service.create({ fullName: ' Bé An ', nickname: ' An ' })).resolves.toMatchObject({ data: { status: 'ACTIVE', classId: null } });
    expect(db.student.create).toHaveBeenCalledWith({ data: { fullName: 'Bé An', nickname: 'An' } });
    await service.update(record.id, { fullName: 'Bé Bình' });
    expect(db.student.updateMany).toHaveBeenLastCalledWith({ where: { id: record.id }, data: { fullName: 'Bé Bình' } });
    await service.update(record.id, { fullName: 'Bé Bình', nickname: ' Bình ' });
    expect(db.student.updateMany).toHaveBeenLastCalledWith({ where: { id: record.id }, data: { fullName: 'Bé Bình', nickname: 'Bình' } });
    await service.update(record.id, { fullName: 'Bé Bình', nickname: null });
    expect(db.student.updateMany).toHaveBeenLastCalledWith({ where: { id: record.id }, data: { fullName: 'Bé Bình', nickname: null } });
  });

  it('soft transitions status idempotently and returns not found for absent students', async () => {
    const db = prisma();
    const service = new StudentsService(db as never);
    await expect(service.setStatus(record.id, StudentStatus.INACTIVE)).resolves.toMatchObject({ data: { id: record.id } });
    expect(db.student.updateMany).toHaveBeenCalledWith({ where: { id: record.id }, data: { status: StudentStatus.INACTIVE } });
    db.student.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.setStatus(record.id, StudentStatus.ACTIVE)).rejects.toBeInstanceOf(NotFoundException);
  });
});
