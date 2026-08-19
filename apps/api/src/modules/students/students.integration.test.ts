import { PrismaPg } from '@prisma/adapter-pg';
import { ClassStatus, PrismaClient, StudentStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { StudentsService } from './students.service.js';
import { ClassesService } from '../classes/classes.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new StudentsService(prisma as never);
const classes = new ClassesService(prisma as never);
beforeEach(async () => { await prisma.invoiceItem.deleteMany(); await prisma.invoice.deleteMany(); await prisma.student.deleteMany(); await prisma.class.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('StudentsService PostgreSQL contract', () => {
  it('persists nullable nickname and keeps classId null', async () => {
    const result = await service.create({ fullName: 'Bé An', nickname: 'An' });
    expect(result.data).toMatchObject({ fullName: 'Bé An', nickname: 'An', classId: null, status: StudentStatus.ACTIVE });
    await expect(prisma.student.findUniqueOrThrow({ where: { id: result.data.id } })).resolves.toMatchObject({ nickname: 'An', classId: null });
  });

  it('lists inactive students and changes lifecycle without deletion', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An', nickname: 'An' } });
    await service.setStatus(student.id, StudentStatus.INACTIVE);
    const result = await service.list({ search: 'An', status: StudentStatus.INACTIVE, page: 1, pageSize: 20 });
    expect(result.data).toEqual([expect.objectContaining({ id: student.id, status: StudentStatus.INACTIVE })]);
    await service.setStatus(student.id, StudentStatus.ACTIVE);
    await expect(prisma.student.findUniqueOrThrow({ where: { id: student.id } })).resolves.toMatchObject({ status: StudentStatus.ACTIVE });
  });

  it('paginates students by classId without embedding them in the class resource', async () => {
    const first = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const second = await prisma.class.create({ data: { name: 'Mầm 2', monthlyTuition: 1500000n } });
    const included = await prisma.student.create({ data: { fullName: 'Bé An', classId: first.id } });
    await prisma.student.create({ data: { fullName: 'Bé Bình', classId: second.id } });
    const result = await service.list({ classId: first.id, page: 1, pageSize: 1 });
    expect(result).toMatchObject({ data: [expect.objectContaining({ id: included.id, classId: first.id })], meta: { total: 1, page: 1, pageSize: 1 } });
  });

  it('preserves an omitted nickname and clears it only when explicitly null', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An', nickname: 'An' } });
    await service.update(student.id, { fullName: 'Bé An mới' });
    await expect(prisma.student.findUniqueOrThrow({ where: { id: student.id } })).resolves.toMatchObject({ fullName: 'Bé An mới', nickname: 'An' });
    await service.update(student.id, { fullName: 'Bé An mới', nickname: null });
    await expect(prisma.student.findUniqueOrThrow({ where: { id: student.id } })).resolves.toMatchObject({ nickname: null });
  });

  it('assigns or clears only the current class and returns its summary', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const student = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const assigned = await service.update(student.id, { fullName: 'Bé An', classId: schoolClass.id });
    expect(assigned.data).toMatchObject({ classId: schoolClass.id, class: { id: schoolClass.id, name: 'Mầm 1' } });
    await service.update(student.id, { fullName: 'Bé An', classId: null });
    await expect(prisma.student.findUniqueOrThrow({ where: { id: student.id } })).resolves.toMatchObject({ classId: null });
  });

  it('rejects missing or archived targets without changing the student and blocks reactivation into an archived class', async () => {
    const archived = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n, status: ClassStatus.ARCHIVED } });
    const student = await prisma.student.create({ data: { fullName: 'Bé An', classId: archived.id, status: StudentStatus.INACTIVE } });
    await expect(service.update(student.id, { fullName: 'Bé An mới', classId: archived.id })).rejects.toMatchObject({ response: { code: 'CLASS_ARCHIVED', fieldErrors: ['classId Archived classes cannot accept students.'] } });
    await expect(service.update(student.id, { fullName: 'Bé An mới', classId: 'b2e36687-69b4-4e89-8ec0-141ff397837f' })).rejects.toMatchObject({ response: { code: 'CLASS_NOT_FOUND', fieldErrors: ['classId Class not found.'] } });
    await expect(service.setStatus(student.id, StudentStatus.ACTIVE)).rejects.toMatchObject({ response: { code: 'CLASS_ARCHIVED' } });
    await expect(prisma.student.findUniqueOrThrow({ where: { id: student.id } })).resolves.toMatchObject({ fullName: 'Bé An', status: StudentStatus.INACTIVE, classId: archived.id });
  });

  it('never commits an active student assigned to a class archived concurrently', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const student = await prisma.student.create({ data: { fullName: 'Bé An', status: StudentStatus.ACTIVE } });
    const results = await Promise.allSettled([service.update(student.id, { fullName: 'Bé An', classId: schoolClass.id }), classes.archive(schoolClass.id)]);
    const persistedStudent = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    const persistedClass = await prisma.class.findUniqueOrThrow({ where: { id: schoolClass.id } });
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(persistedStudent.status === StudentStatus.ACTIVE && persistedStudent.classId === schoolClass.id && persistedClass.status === ClassStatus.ARCHIVED).toBe(false);
  });

  it('never reactivates a student into a class archived concurrently', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const student = await prisma.student.create({ data: { fullName: 'Bé An', status: StudentStatus.INACTIVE, classId: schoolClass.id } });
    const results = await Promise.allSettled([service.setStatus(student.id, StudentStatus.ACTIVE), classes.archive(schoolClass.id)]);
    const persistedStudent = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    const persistedClass = await prisma.class.findUniqueOrThrow({ where: { id: schoolClass.id } });
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(persistedStudent.status === StudentStatus.ACTIVE && persistedStudent.classId === schoolClass.id && persistedClass.status === ClassStatus.ARCHIVED).toBe(false);
  });
});
