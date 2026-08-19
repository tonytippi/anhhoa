import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { OperationsService } from './operations.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new OperationsService(prisma as never);

beforeEach(async () => { await prisma.operation.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('OperationsService PostgreSQL contract', () => {
  it('returns an operation only to its owner', async () => {
    const owner = await prisma.admin.create({ data: { email: 'operation-owner@example.com', displayName: 'Owner', googleId: 'operation-owner' } });
    const other = await prisma.admin.create({ data: { email: 'operation-other@example.com', displayName: 'Other', googleId: 'operation-other' } });
    const response = { data: { operationId: '5a04d9b2-2f11-4a77-8e24-4f0a3c20a9bb', affectedStudentCount: 1 } };
    await prisma.operation.create({ data: { id: '5a04d9b2-2f11-4a77-8e24-4f0a3c20a9bb', adminId: owner.id, route: '/classes/source/transfer', fingerprint: 'fingerprint', response } });
    await expect(service.getForAdmin('5a04d9b2-2f11-4a77-8e24-4f0a3c20a9bb', owner.id)).resolves.toEqual(response);
    await expect(service.getForAdmin('5a04d9b2-2f11-4a77-8e24-4f0a3c20a9bb', other.id)).rejects.toMatchObject({ status: 404 });
  });
});
