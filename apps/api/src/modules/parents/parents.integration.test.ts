import { PrismaPg } from '@prisma/adapter-pg';
import { ParentStatus, PrismaClient, StudentParentStatus } from '@prisma/client';
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

  it('reactivates an inactive parent when granting access', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const parent = await prisma.parent.create({ data: { emailNormalized: 'parent@example.com', status: 'INACTIVE' } });
    const granted = await service.grant(student.id, parent.emailNormalized);
    expect(granted.parent.status).toBe('ACTIVE');
    expect(granted.link.status).toBe(StudentParentStatus.ACTIVE);
  });

  it('retains a revoked link and records the revoking admin', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google-id' } });
    const granted = await service.grant(student.id, 'parent@example.com');
    const revoked = await service.revoke(granted.parent.id, student.id, admin.id);
    expect(revoked).toMatchObject({ id: granted.link.id, status: StudentParentStatus.REVOKED, revokedBy: admin.id });
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    await expect(service.revoke(granted.parent.id, student.id, admin.id)).rejects.toThrow('Active parent-student link not found.');
    await expect(service.revoke(granted.parent.id, student.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow('Admin not found.');
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

  it('authorizes an active parent only for students with an active link', async () => {
    const authorizedStudent = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const unauthorizedStudent = await prisma.student.create({ data: { fullName: 'Bé Bình' } });
    const granted = await service.grant(authorizedStudent.id, 'parent@example.com');

    await expect(service.authorizeStudent(granted.parent.id, authorizedStudent.id)).resolves.toEqual({ studentId: authorizedStudent.id });
    await expect(service.authorizeStudent(granted.parent.id, unauthorizedStudent.id)).rejects.toThrow('Parent is not authorized to access this resource.');
    await expect(service.authorizeStudent(granted.parent.id, 'not-a-uuid')).rejects.toThrow('Parent is not authorized to access this resource.');
    await prisma.parent.update({ where: { id: granted.parent.id }, data: { status: ParentStatus.INACTIVE } });
    await expect(service.authorizeStudent(granted.parent.id, authorizedStudent.id)).rejects.toThrow('Parent is not authorized to access this resource.');
  });

  it('authorizes an invoice only through the active parent-student link', async () => {
    const schoolClass = await prisma.class.create({ data: { name: 'Mầm 1', monthlyTuition: 1500000n } });
    const authorizedStudent = await prisma.student.create({ data: { fullName: 'Bé An', classId: schoolClass.id } });
    const otherStudent = await prisma.student.create({ data: { fullName: 'Bé Bình', classId: schoolClass.id } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google-id' } });
    const granted = await service.grant(authorizedStudent.id, 'parent@example.com');
    const authorizedInvoice = await prisma.invoice.create({ data: { studentId: authorizedStudent.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: authorizedStudent.fullName, classId: schoolClass.id, className: schoolClass.name, total: 0n, creatorId: admin.id } });
    const otherInvoice = await prisma.invoice.create({ data: { studentId: otherStudent.id, billingMonth: new Date('2026-08-01T00:00:00.000Z'), studentName: otherStudent.fullName, classId: schoolClass.id, className: schoolClass.name, total: 0n, creatorId: admin.id } });

    await expect(service.authorizeInvoice(granted.parent.id, authorizedInvoice.id)).resolves.toEqual({ invoiceId: authorizedInvoice.id, studentId: authorizedStudent.id });
    await expect(service.authorizeInvoice(granted.parent.id, otherInvoice.id)).rejects.toThrow('Parent is not authorized to access this resource.');
    await expect(service.authorizeInvoice(granted.parent.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow('Parent is not authorized to access this resource.');
    await expect(service.authorizeInvoice(granted.parent.id, 'not-a-uuid')).rejects.toThrow('Parent is not authorized to access this resource.');
    await prisma.parent.update({ where: { id: granted.parent.id }, data: { status: ParentStatus.INACTIVE } });
    await expect(service.authorizeInvoice(granted.parent.id, authorizedInvoice.id)).rejects.toThrow('Parent is not authorized to access this resource.');
    await prisma.parent.update({ where: { id: granted.parent.id }, data: { status: ParentStatus.ACTIVE } });
    await prisma.studentParent.update({ where: { parentId_studentId: { parentId: granted.parent.id, studentId: authorizedStudent.id } }, data: { status: StudentParentStatus.REVOKED } });
    await expect(service.authorizeInvoice(granted.parent.id, authorizedInvoice.id)).rejects.toThrow('Parent is not authorized to access this resource.');
  });

  it('applies a revoked link to the next authorization request without affecting another active link', async () => {
    const firstStudent = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const secondStudent = await prisma.student.create({ data: { fullName: 'Bé Bình' } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google-id' } });
    const firstLink = await service.grant(firstStudent.id, 'parent@example.com');
    await service.grant(secondStudent.id, 'parent@example.com');

    await service.revoke(firstLink.parent.id, firstStudent.id, admin.id);

    await expect(service.authorizeStudent(firstLink.parent.id, firstStudent.id)).rejects.toThrow('Parent is not authorized to access this resource.');
    await expect(service.authorizeStudent(firstLink.parent.id, secondStudent.id)).resolves.toEqual({ studentId: secondStudent.id });
  });

  it('validates the full batch before changing any retained link', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An' } });
    await expect(service.grantBatch(student.id, ['valid@example.com', 'not-an-email'], 'a2e36687-69b4-4e89-8ec0-141ff397837f', 'admin-1')).rejects.toThrow('Each parent email must be valid.');
    await expect(prisma.studentParent.count()).resolves.toBe(0);
  });

  it('grants atomically and replays a completed operation without duplicating links', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google-id' } });
    const operationId = 'a2e36687-69b4-4e89-8ec0-141ff397837f';
    const first = await service.grantBatch(student.id, ['First@Example.com', 'second@example.com'], operationId, admin.id);
    const replay = await service.grantBatch(student.id, ['first@example.com', 'second@example.com'], operationId, admin.id);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({ data: { outcomes: [{ email: 'first@example.com', outcome: 'created' }, { email: 'second@example.com', outcome: 'created' }] } });
    await expect(prisma.studentParent.count({ where: { studentId: student.id } })).resolves.toBe(2);
    await expect(service.grantBatch(student.id, ['different@example.com'], operationId, admin.id)).rejects.toThrow('Idempotency key was already used for another request.');
  });

  it('revokes once, replays the stored outcome, and requires an existing admin', async () => {
    const student = await prisma.student.create({ data: { fullName: 'Bé An' } });
    const admin = await prisma.admin.create({ data: { email: 'admin@example.com', displayName: 'Admin', googleId: 'admin-google-id' } });
    const otherAdmin = await prisma.admin.create({ data: { email: 'other-admin@example.com', displayName: 'Other admin', googleId: 'other-admin-google-id' } });
    const granted = await service.grant(student.id, 'parent@example.com');
    const operationId = 'b2e36687-69b4-4e89-8ec0-141ff397837f';
    const first = await service.revokeWithOperation(student.id, granted.parent.id, operationId, admin.id);
    const replay = await service.revokeWithOperation(student.id, granted.parent.id, operationId, admin.id);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({ data: { parentId: granted.parent.id, status: 'REVOKED' } });
    await expect(service.revokeWithOperation(student.id, granted.parent.id, 'c2e36687-69b4-4e89-8ec0-141ff397837f', '00000000-0000-0000-0000-000000000000')).rejects.toThrow('Admin not found.');
    await expect(service.revokeWithOperation(student.id, granted.parent.id, operationId, admin.id)).resolves.toEqual(first);
    await expect(service.revokeWithOperation(student.id, granted.parent.id, operationId, otherAdmin.id)).rejects.toThrow('Idempotency key was already used for another request.');
  });
});
