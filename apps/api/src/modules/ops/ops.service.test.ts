import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { OpsService } from './ops.service.js';

const key = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';
function database(existing: any = null) {
  const tx = { operation: { create: vi.fn().mockResolvedValue({ id: operationId }), update: vi.fn().mockResolvedValue({ id: operationId, status: 'COMPLETED', outcome: { schoolId: 'school-id', status: 'ACTIVE' } }) }, userIdentity: { upsert: vi.fn().mockResolvedValue({ id: 'owner-id' }) }, school: { create: vi.fn().mockResolvedValue({ id: 'school-id', status: 'ACTIVE' }), findUnique: vi.fn().mockResolvedValue({ id: 'school-id', status: 'SUSPENDED' }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, schoolMembership: { create: vi.fn().mockResolvedValue({ id: 'membership-id' }) }, schoolRoleGrant: { create: vi.fn() }, auditRecord: { create: vi.fn() } };
  return { platformOperatorGrant: { findFirst: vi.fn().mockResolvedValue({ id: 'grant-id', userIdentityId: 'actor-id' }) }, operation: { findUnique: vi.fn().mockResolvedValue(existing), findUniqueOrThrow: vi.fn(), findFirst: vi.fn() }, school: { findMany: vi.fn() }, $transaction: vi.fn(async (work) => work(tx)), tx };
}

describe('OpsService', () => {
  it('provisions the owner graph and completed platform-scoped operation in one transaction', async () => {
    const prisma = database(); const service = new OpsService(prisma as never);
    await expect(service.provision('actor-id', key, operationId, { name: ' Trường Mới ', slug: 'Truong-Moi', ownerEmail: ' Owner@Example.com ' })).resolves.toMatchObject({ id: operationId, status: 'COMPLETED' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1); expect(prisma.tx.operation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: operationId, platformOperatorGrantId: 'grant-id', actorType: 'PLATFORM_OPERATOR_GRANT' }) })); expect(prisma.tx.operation.create.mock.calls[0]![0].data.schoolId).toBeUndefined();
    expect(prisma.tx.school.create).toHaveBeenCalledWith({ data: { name: 'Trường Mới', slug: 'truong-moi', initialOwnerIdentityId: 'owner-id' } });
    expect(prisma.tx.userIdentity.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { emailNormalized: 'owner@example.com' } })); expect(prisma.tx.schoolMembership.create).toHaveBeenCalled(); expect(prisma.tx.schoolRoleGrant.create).toHaveBeenCalled(); expect(prisma.tx.auditRecord.create).toHaveBeenCalled();
  });
  it('rejects malformed provision input and prevents an operator from bootstrapping their own School role', async () => {
    const invalid = database(); const service = new OpsService(invalid as never);
    await expect(service.provision('actor-id', key, operationId, null as never)).rejects.toMatchObject({ status: 400 });
    expect(invalid.$transaction).not.toHaveBeenCalled();
    const selfOwner = database(); selfOwner.tx.userIdentity.upsert.mockResolvedValue({ id: 'actor-id' });
    await expect(new OpsService(selfOwner as never).provision('actor-id', key, operationId, { name: 'A', slug: 'a', ownerEmail: 'operator@example.com' })).rejects.toMatchObject({ status: 403 });
    expect(selfOwner.tx.school.create).not.toHaveBeenCalled();
  });
  it('replays same key and rejects a changed fingerprint without another transaction', async () => {
    const replay = { id: operationId, fingerprint: 'different', status: 'COMPLETED', outcome: {} }; const prisma = database(replay); const service = new OpsService(prisma as never);
    await expect(service.provision('actor-id', key, operationId, { name: 'A', slug: 'a', ownerEmail: 'a@example.com' })).rejects.toMatchObject({ status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    const matching = { ...replay, fingerprint: createHash('sha256').update(JSON.stringify({ name: 'A', slug: 'a', ownerEmail: 'a@example.com' })).digest('hex') }; prisma.operation.findUnique.mockResolvedValue(matching);
    await expect(service.provision('actor-id', key, operationId, { name: 'A', slug: 'a', ownerEmail: 'a@example.com' })).resolves.toMatchObject({ id: operationId });
  });
  it('makes same-state lifecycle a completed no-op and scopes operation reads to its grant', async () => {
    const prisma = database(); const service = new OpsService(prisma as never);
    const schoolId = '33333333-3333-4333-8333-333333333333';
    prisma.tx.school.findUnique.mockResolvedValue({ id: schoolId, status: 'SUSPENDED' });
    await expect(service.lifecycle('actor-id', schoolId, 'SUSPENDED', key, operationId)).resolves.toMatchObject({ status: 'COMPLETED' });
    expect(prisma.tx.operation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ schoolId }) }));
    expect(prisma.tx.school.updateMany).not.toHaveBeenCalled(); expect(prisma.tx.auditRecord.create).not.toHaveBeenCalled();
    prisma.operation.findFirst.mockResolvedValue(null); await expect(service.operation('actor-id', operationId)).rejects.toMatchObject({ status: 404 }); expect(prisma.operation.findFirst).toHaveBeenCalledWith({ where: { id: operationId, platformOperatorGrantId: 'grant-id' } });
  });
  it('validates lifecycle targets and conflicts when another lifecycle mutation wins', async () => {
    const invalid = database(); await expect(new OpsService(invalid as never).lifecycle('actor-id', 'not-a-uuid', 'SUSPENDED', key, operationId)).rejects.toMatchObject({ status: 400 });
    const conflict = database(); conflict.tx.school.findUnique.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE' }); conflict.tx.school.updateMany.mockResolvedValue({ count: 0 });
    await expect(new OpsService(conflict as never).lifecycle('actor-id', '11111111-1111-4111-8111-111111111111', 'SUSPENDED', key, operationId)).rejects.toMatchObject({ status: 409 });
  });
  it('returns ordered school control-plane DTOs', async () => {
    const prisma = database(); const now = new Date('2026-09-16T00:00:00.000Z'); prisma.school.findMany.mockResolvedValue([{ id: 'school-id', name: 'Trường A', slug: 'truong-a', status: 'ACTIVE', initialOwnerIdentity: { emailNormalized: 'owner@example.com', googleSubject: null }, updatedAt: now }]);
    await expect(new OpsService(prisma as never).list('actor-id')).resolves.toEqual([{ id: 'school-id', name: 'Trường A', slug: 'truong-a', status: 'ACTIVE', ownerEmail: 'owner@example.com', ownerBound: false, updatedAt: now.toISOString() }]);
    expect(prisma.school.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' }, include: { initialOwnerIdentity: true } });
  });
});
