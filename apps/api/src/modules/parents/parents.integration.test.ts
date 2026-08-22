import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, StudentParentStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ParentsService } from './parents.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new ParentsService(prisma as never);

beforeEach(async () => {
  await prisma.studentParent.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.operation.deleteMany();
  await prisma.admin.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe('ParentsService PostgreSQL contract', () => {
  it('creates a retained parent and active link with normalized email', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const result = await service.grant(student.id, ' Parent@Example.com ');
    expect(result).toMatchObject({ outcome: 'created', parent: { emailNormalized: 'parent@example.com', status: 'ACTIVE' }, link: { studentId: student.id, status: StudentParentStatus.ACTIVE, revokedAt: null, revokedBy: null } });
    await expect(prisma.studentParent.create({ data: { parentId: result.parent.id, studentId: student.id } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('reactivates the single revoked record instead of creating another', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google-id' } });
    const granted = await service.grant(student.id, 'parent@example.com');
    await service.revoke(granted.parent.id, student.id, admin.id);
    const reactivated = await service.grant(student.id, 'PARENT@example.com');
    expect(reactivated).toMatchObject({ outcome: 'reactivated', link: { id: granted.link.id, status: StudentParentStatus.ACTIVE, revokedAt: null, revokedBy: null } });
    await expect(prisma.studentParent.count({ where: { parentId: granted.parent.id, studentId: student.id } })).resolves.toBe(1);
  });

  it('retains a revoked link and records the revoking admin', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google-id' } });
    const granted = await service.grant(student.id, 'parent@example.com');
    const revoked = await service.revoke(granted.parent.id, student.id, admin.id);
    expect(revoked).toMatchObject({ id: granted.link.id, status: StudentParentStatus.REVOKED, revokedBy: admin.id });
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    await expect(service.revoke(granted.parent.id, student.id, admin.id)).rejects.toThrow('Active parent-student link not found.');
    await expect(prisma.parent.findUniqueOrThrow({ where: { id: granted.parent.id } })).resolves.toBeDefined();
  });

  it('keeps active links for both sides of the many-to-many relation', async () => {
    const firstStudent = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const secondStudent = await prisma.student.create({ data: { fullName: 'Bé Bình' } });
    const firstParentFirstLink = await service.grant(firstStudent.id, 'parent-one@example.com');
    const firstParentSecondLink = await service.grant(secondStudent.id, 'parent-one@example.com');
    const secondParentFirstLink = await service.grant(firstStudent.id, 'parent-two@example.com');
    expect(firstParentSecondLink.link.status).toBe(StudentParentStatus.ACTIVE);
    expect(secondParentFirstLink.link.status).toBe(StudentParentStatus.ACTIVE);
    await expect(prisma.studentParent.count({ where: { parentId: firstParentFirstLink.parent.id, status: StudentParentStatus.ACTIVE } })).resolves.toBe(2);
    await expect(prisma.studentParent.count({ where: { studentId: firstStudent.id, status: StudentParentStatus.ACTIVE } })).resolves.toBe(2);
  });

  it('uses restrictive foreign keys for referenced parents and students', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const granted = await service.grant(student.id, 'parent@example.com');
    await expect(prisma.parent.delete({ where: { id: granted.parent.id } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.student.delete({ where: { id: student.id } })).rejects.toMatchObject({ code: 'P2003' });
  });
});
