import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AuthorizationService } from '../modules/authorization/authorization.service.js';
import { PrismaService } from '../modules/identity/prisma.service.js';
import { FinanceService } from '../modules/finance/finance.service.js';

const prisma = new PrismaService();
const finance = new FinanceService(prisma, new AuthorizationService(prisma));
const schools: string[] = [];
const uuid = () => crypto.randomUUID();

async function graph() {
  const school = await prisma.school.create({ data: { name: 'Finance', slug: `finance-${uuid()}`, studentCodePrefix: 'FI' } });
  schools.push(school.id);
  const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const membership = await prisma.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: identity.id } });
  const position = await prisma.schoolPosition.create({ data: { schoolId: school.id, code: `FINANCE_${uuid().replaceAll('-', '').slice(0, 12)}`, name: `Finance ${uuid()}` } });
  await prisma.positionCapabilityGrant.createMany({ data: ['SCHOOL_CONTEXT_READ', 'FINANCE_MANAGE'].map((capability) => ({ schoolId: school.id, positionId: position.id, capability })) });
  await prisma.staffProfile.create({ data: { schoolId: school.id, fullName: 'Finance actor', email: identity.emailNormalized, phone: '0900000000', dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), gender: 'Khác', address: 'Test', primaryPositionId: position.id, schoolMembershipId: membership.id, boundAt: new Date(), boundByMembershipId: membership.id } });
  return { school, identity, membership, position };
}

async function group(input: Awaited<ReturnType<typeof graph>>, name = 'Học phí') {
  return finance.createGroup(input.identity.id, input.school.id, uuid(), uuid(), { name });
}

afterEach(async () => {
  const ids = schools.splice(0);
  if (!ids.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.auditRecord.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receivableLifecycleTransition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receivableGroupLifecycleTransition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receivable.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receivableGroup.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.operation.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.staffProfile.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.positionCapabilityGrant.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolPosition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolMembership.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.school.deleteMany({ where: { id: { in: ids } } });
  });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('finance PostgreSQL invariants', () => {
  it('persists Finance-authorized active catalog records, BIGINT VND, audit, and Operations', async () => {
    const current = await graph();
    const createdGroup = await group(current);
    const groupId = (createdGroup.outcome as { id: string }).id;
    const created = await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code: 'TUITION', displayName: 'Học phí', unitLabel: 'tháng', defaultUnitPrice: '123456789' });
    const receivableId = (created.outcome as { id: string }).id;

    expect(created).toMatchObject({ status: 'COMPLETED', outcome: { id: receivableId, code: 'TUITION', defaultUnitPrice: '123456789', status: 'ACTIVE', available: true } });
    expect(await prisma.receivable.findUniqueOrThrow({ where: { id: receivableId } })).toMatchObject({ schoolId: current.school.id, groupId, defaultUnitPrice: 123456789n });
    expect(await prisma.operation.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ schoolId: current.school.id, status: 'COMPLETED' });
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.school.id, action: 'RECEIVABLE_CREATED' } })).toMatchObject({ membershipId: current.membership.id, provenance: { operationId: created.id, newValue: { id: receivableId, defaultUnitPrice: '123456789' } } });
    await expect(finance.read(current.identity.id, current.school.id)).resolves.toMatchObject({ groups: [{ id: groupId, status: 'ACTIVE' }], receivables: [{ id: receivableId, available: true, defaultUnitPrice: '123456789' }] });
  });

  it('rejects duplicate codes and foreign group graphs without creating or disclosing catalog data', async () => {
    const current = await graph(); const foreign = await graph();
    const currentGroup = await group(current); const foreignGroup = await group(foreign);
    const groupId = (currentGroup.outcome as { id: string }).id;
    const foreignGroupId = (foreignGroup.outcome as { id: string }).id;
    const input = { groupId, code: 'MEAL', displayName: 'Tiền ăn', unitLabel: 'tháng', defaultUnitPrice: '1000' };
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { ...input, code: 'INVALID_VND', defaultUnitPrice: '0' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { defaultUnitPrice: expect.any(String) } } });
    await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), input);
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), input)).rejects.toMatchObject({ status: 400, response: { fieldErrors: { code: expect.any(String) } } });
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { ...input, groupId: foreignGroupId, code: 'FOREIGN' })).rejects.toMatchObject({ status: 404, response: { code: 'RECEIVABLE_GROUP_NOT_FOUND' } });
    expect(await prisma.receivable.count({ where: { schoolId: current.school.id } })).toBe(1);
    await expect(prisma.receivable.create({ data: { schoolId: current.school.id, groupId: foreignGroupId, displayName: 'Graph trực tiếp', unitLabel: 'lần', defaultUnitPrice: 1n } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('retains inactive catalog history while making it unavailable and rejecting new selection', async () => {
    const current = await graph();
    const createdGroup = await group(current); const groupId = (createdGroup.outcome as { id: string }).id;
    const created = await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code: 'ACTIVITY', displayName: 'Ngoại khóa', unitLabel: 'tháng', defaultUnitPrice: '50000' });
    const receivableId = (created.outcome as { id: string }).id;
    await finance.transitionGroup(current.identity.id, current.school.id, groupId, uuid(), uuid(), { status: 'INACTIVE', reason: 'Ngừng áp dụng' });

    await expect(finance.read(current.identity.id, current.school.id)).resolves.toMatchObject({ groups: [{ id: groupId, status: 'INACTIVE' }], receivables: [{ id: receivableId, status: 'ACTIVE', available: false }] });
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code: 'NEW', displayName: 'Không được chọn', unitLabel: 'lần', defaultUnitPrice: '1' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { groupId: expect.any(String) } } });
    expect(await prisma.receivableGroupLifecycleTransition.count({ where: { schoolId: current.school.id, receivableGroupId: groupId } })).toBe(2);
  });

  it('replays same-key outcomes, rejects changed fingerprints, and re-authorizes revoked access', async () => {
    const current = await graph();
    const key = uuid(); const operationId = uuid(); const body = { name: 'Dịch vụ' };
    const first = await finance.createGroup(current.identity.id, current.school.id, key, operationId, body);
    expect(await finance.createGroup(current.identity.id, current.school.id, key, uuid(), body)).toEqual(first);
    expect(await prisma.receivableGroup.count({ where: { schoolId: current.school.id } })).toBe(1);
    await expect(finance.createGroup(current.identity.id, current.school.id, key, uuid(), { name: 'Khác' })).rejects.toMatchObject({ status: 409, response: { code: 'IDEMPOTENCY_CONFLICT' } });

    const other = await graph();
    await expect(finance.operation(other.identity.id, other.school.id, first.id)).rejects.toMatchObject({ status: 404, response: { code: 'OPERATION_NOT_FOUND' } });
    await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: current.school.id, positionId: current.position.id, capability: 'FINANCE_MANAGE' } });
    await expect(finance.read(current.identity.id, current.school.id)).rejects.toMatchObject({ status: 403, response: { code: 'CAPABILITY_DENIED' } });
    await expect(finance.createGroup(current.identity.id, current.school.id, key, uuid(), body)).rejects.toMatchObject({ status: 403, response: { code: 'CAPABILITY_DENIED' } });
  });
});
