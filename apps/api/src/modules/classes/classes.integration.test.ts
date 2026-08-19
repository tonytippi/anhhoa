import { PrismaPg } from '@prisma/adapter-pg';
import { ClassStatus, PrismaClient, StudentStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ClassesService } from './classes.service.js';
import { OperationsService } from '../operations/operations.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new ClassesService(prisma as never, new OperationsService(prisma as never));

beforeEach(async () => { await prisma.invoiceItem.deleteMany(); await prisma.invoice.deleteMany(); await prisma.operation.deleteMany(); await prisma.student.deleteMany(); await prisma.class.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('ClassesService PostgreSQL contract', () => {
  it('lists count-only resources in created-at and id descending order', async () => {
    const older = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n, createdAt: new Date('2026-01-01T00:00:00.000Z') } });
    const newer = await prisma.class.create({ data: { name: 'Mầm 2', monthlyTuition: 1600000n, createdAt: new Date('2026-01-02T00:00:00.000Z') } });
    await prisma.student.create({ data: { fullName: 'Bé An', status: StudentStatus.ACTIVE, classId: newer.id } });
    const result = await service.list({ page: 1, pageSize: 20 });
    expect(result.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: newer.id, activeStudentCount: 1 }), expect.objectContaining({ id: older.id, activeStudentCount: 0 })]));
    expect(result.data.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(result.data[0]).not.toHaveProperty('students');
  });

  it('archives an empty class and returns only its active student count', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const result = await service.archive(schoolClass.id);
    expect(result.data).toMatchObject({ id: schoolClass.id, status: ClassStatus.ARCHIVED, activeStudentCount: 0 });
    expect(result.data).not.toHaveProperty('students');
  });

  it('rejects archive with the active student count and keeps the class active', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    await prisma.student.create({ data: { fullName: 'Bé An', status: StudentStatus.ACTIVE, classId: schoolClass.id } });
    await expect(service.archive(schoolClass.id)).rejects.toMatchObject({ response: { code: 'CLASS_HAS_ACTIVE_STUDENTS', metadata: { activeStudentCount: 1 } } });
    await expect(prisma.class.findUniqueOrThrow({ where: { id: schoolClass.id } })).resolves.toMatchObject({ status: ClassStatus.ACTIVE });
  });

  it('transfers only active students atomically and replays the completed operation', async () => {
    const source = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const destination = await prisma.class.create({ data: { name: 'Mầm 2', monthlyTuition: 1500000n } });
    const admin = await prisma.admin.create({ data: { email: 'admin-transfer@example.com', displayName: 'Admin', googleId: 'google-transfer' } });
    const active = await prisma.student.create({ data: { fullName: 'Bé An', status: StudentStatus.ACTIVE, classId: source.id } });
    const inactive = await prisma.student.create({ data: { fullName: 'Bé Bình', status: StudentStatus.INACTIVE, classId: source.id } });
    const key = '2a04d9b2-2f11-4a77-8e24-4f0a3c20a9bb';
    const result = await service.transfer(source.id, destination.id, key, admin.id);
    expect(result.data).toMatchObject({ affectedStudentCount: 1, operationId: key, source: { activeStudentCount: 0 }, destination: { activeStudentCount: 1 } });
    await expect(prisma.student.findUniqueOrThrow({ where: { id: active.id } })).resolves.toMatchObject({ classId: destination.id });
    await expect(prisma.student.findUniqueOrThrow({ where: { id: inactive.id } })).resolves.toMatchObject({ classId: source.id });
    await expect(service.transfer(source.id, destination.id, key, admin.id)).resolves.toEqual(result);
    await expect(service.transfer(source.id, source.id, key, admin.id)).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_CONFLICT' } });
  });

  it('rolls back a new operation with a rejected transfer so the same key can be retried safely', async () => {
    const source = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const destination = await prisma.class.create({ data: { name: 'Mầm 2', monthlyTuition: 1500000n, status: ClassStatus.ARCHIVED } });
    const admin = await prisma.admin.create({ data: { email: 'admin-rollback@example.com', displayName: 'Admin', googleId: 'google-rollback' } });
    const key = '2b04d9b2-2f11-4a77-8e24-4f0a3c20a9bb';
    await expect(service.transfer(source.id, destination.id, key, admin.id)).rejects.toMatchObject({ response: { code: 'CLASS_ARCHIVED' } });
    await expect(prisma.operation.count({ where: { id: key } })).resolves.toBe(0);
    await prisma.class.update({ where: { id: destination.id }, data: { status: ClassStatus.ACTIVE } });
    await expect(service.transfer(source.id, destination.id, key, admin.id)).resolves.toMatchObject({ data: { operationId: key } });
  });

  it('recovers a legacy pending operation with the same key inside the transfer transaction', async () => {
    const source = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const destination = await prisma.class.create({ data: { name: 'Mầm 2', monthlyTuition: 1500000n } });
    const admin = await prisma.admin.create({ data: { email: 'admin-recover@example.com', displayName: 'Admin', googleId: 'google-recover' } });
    await prisma.student.create({ data: { fullName: 'Bé An', status: StudentStatus.ACTIVE, classId: source.id } });
    const key = '2c04d9b2-2f11-4a77-8e24-4f0a3c20a9bb';
    await prisma.operation.create({ data: { id: key, adminId: admin.id, route: `/classes/${source.id}/transfer`, fingerprint: new OperationsService(prisma as never).fingerprint({ sourceClassId: source.id, destinationClassId: destination.id }), state: 'PENDING' } });
    const result = await service.transfer(source.id, destination.id, key, admin.id);
    expect(result.data).toMatchObject({ affectedStudentCount: 1, operationId: key });
    await expect(prisma.operation.findUniqueOrThrow({ where: { id: key } })).resolves.toMatchObject({ state: 'COMPLETED', response: result });
    await expect(service.transfer(source.id, destination.id, key, admin.id)).resolves.toEqual(result);
  });

  it('serializes concurrent requests with the same operation key into one transfer and a replayed outcome', async () => {
    const source = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const destination = await prisma.class.create({ data: { name: 'Mầm 2', monthlyTuition: 1500000n } });
    const admin = await prisma.admin.create({ data: { email: 'admin-concurrent@example.com', displayName: 'Admin', googleId: 'google-concurrent' } });
    await prisma.student.create({ data: { fullName: 'Bé An', status: StudentStatus.ACTIVE, classId: source.id } });
    const key = '3a04d9b2-2f11-4a77-8e24-4f0a3c20a9bb';
    const [first, second] = await Promise.all([service.transfer(source.id, destination.id, key, admin.id), service.transfer(source.id, destination.id, key, admin.id)]);
    expect(first).toEqual(second);
    expect(first.data).toMatchObject({ affectedStudentCount: 1, operationId: key });
    await expect(prisma.operation.count({ where: { id: key } })).resolves.toBe(1);
    await expect(prisma.student.count({ where: { classId: destination.id, status: StudentStatus.ACTIVE } })).resolves.toBe(1);
  });

  it.each(['source', 'destination'])('never leaves active students in an archived %s class during an archive race', async (archived) => {
    const source = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const destination = await prisma.class.create({ data: { name: 'Mầm 2', monthlyTuition: 1500000n } });
    const admin = await prisma.admin.create({ data: { email: `admin-race-${archived}@example.com`, displayName: 'Admin', googleId: `google-race-${archived}` } });
    await prisma.student.create({ data: { fullName: 'Bé An', status: StudentStatus.ACTIVE, classId: source.id } });
    await Promise.allSettled([service.transfer(source.id, destination.id, `4a04d9b2-2f11-4a77-8e24-4f0a3c20a9b${archived === 'source' ? '1' : '2'}`, admin.id), service.archive(archived === 'source' ? source.id : destination.id)]);
    const invalid = await prisma.student.count({ where: { status: StudentStatus.ACTIVE, class: { status: ClassStatus.ARCHIVED } } });
    expect(invalid).toBe(0);
  });
});
