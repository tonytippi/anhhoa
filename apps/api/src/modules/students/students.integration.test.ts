import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, StudentStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { StudentsService } from './students.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new StudentsService(prisma as never);
beforeEach(async () => { await prisma.student.deleteMany(); });
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

  it('preserves an omitted nickname and clears it only when explicitly null', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An', nickname: 'An' } });
    await service.update(student.id, { fullName: 'Bé An mới' });
    await expect(prisma.student.findUniqueOrThrow({ where: { id: student.id } })).resolves.toMatchObject({ fullName: 'Bé An mới', nickname: 'An' });
    await service.update(student.id, { fullName: 'Bé An mới', nickname: null });
    await expect(prisma.student.findUniqueOrThrow({ where: { id: student.id } })).resolves.toMatchObject({ nickname: null });
  });
});
