import { PrismaPg } from '@prisma/adapter-pg';
import { ClassStatus, PrismaClient, StudentStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ClassesService } from './classes.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new ClassesService(prisma as never);

beforeEach(async () => { await prisma.student.deleteMany(); await prisma.class.deleteMany(); });
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
});
