import { afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../modules/identity/prisma.service.js';

const prisma = new PrismaService();
const uuid = () => crypto.randomUUID();
const rollback = new Error('rollback legacy-shape fixture');
afterAll(() => prisma.$disconnect());

// Story 5.33: replays the migration's normalize_receivable_groups() on legacy-shaped data inside a rolled-back transaction.
describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('receivable group kind migration', () => {
  it('maps legacy groups, removes custom groups and leaves exactly three typed groups per School, idempotently and with audit', async () => {
    await expect(prisma.$transaction(async (tx) => {
      // Make the table legacy-shaped again: untyped groups, no fixed-name check.
      await tx.$executeRawUnsafe('ALTER TABLE "ReceivableGroup" ALTER COLUMN "kind" DROP NOT NULL');
      await tx.$executeRawUnsafe('ALTER TABLE "ReceivableGroup" DROP CONSTRAINT "ReceivableGroup_fixed_name"');
      const school = (suffix: string) => tx.school.create({ data: { name: `Legacy ${suffix}`, slug: `legacy-${uuid()}`, studentCodePrefix: 'LG' } });
      const [a, b, c] = [await school('a'), await school('b'), await school('c')];
      const legacyGroup = async (schoolId: string, name: string) => {
        const id = uuid();
        await tx.$executeRaw`INSERT INTO "ReceivableGroup" ("id", "schoolId", "name") VALUES (${id}::uuid, ${schoolId}::uuid, ${name})`;
        return id;
      };
      const receivable = async (schoolId: string, groupId: string, displayName: string) => (await tx.receivable.create({ data: { schoolId, groupId, displayName, unitLabel: 'tháng', defaultUnitPrice: 1000n } })).id;

      // School A: the three legacy groups plus a custom one that has lifecycle history.
      const chung = await legacyGroup(a.id, 'Khoản thu chung');
      const dotXuat = await legacyGroup(a.id, 'Khoản thu đột xuất');
      const ngoaiKhoa = await legacyGroup(a.id, 'Ngoại khóa');
      const custom = await legacyGroup(a.id, 'Đồng phục');
      const identity = await tx.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
      const membership = await tx.schoolMembership.create({ data: { schoolId: a.id, userIdentityId: identity.id } });
      const operation = await tx.operation.create({ data: { schoolId: a.id, membershipId: membership.id, actorIdentityId: identity.id, actorType: 'SCHOOL_MEMBERSHIP', actorReference: membership.id, route: 'legacy', fingerprint: 'legacy', idempotencyKey: uuid(), status: 'COMPLETED' } });
      await tx.receivableGroupLifecycleTransition.create({ data: { schoolId: a.id, receivableGroupId: custom, status: 'ACTIVE', actorIdentityId: identity.id, membershipId: membership.id, operationId: operation.id, sequence: 1 } });
      const tuition = await receivable(a.id, chung, 'Học phí');
      const trip = await receivable(a.id, dotXuat, 'Dã ngoại');
      const english = await receivable(a.id, ngoaiKhoa, 'Tiếng Anh');
      const uniform = await receivable(a.id, custom, 'Áo');
      // School B: a custom group already named like the new fixed name while the legacy group exists.
      const bChung = await legacyGroup(b.id, 'Khoản thu chung');
      const bClash = await legacyGroup(b.id, 'Khoản thu cố định');
      const bTuition = await receivable(b.id, bChung, 'Học phí B');
      const bClashed = await receivable(b.id, bClash, 'Khoản trùng tên');

      await tx.$executeRaw`SELECT normalize_receivable_groups()`;

      const typed = async (schoolId: string) => (await tx.receivableGroup.findMany({ where: { schoolId }, orderBy: { kind: 'asc' } })).map((group) => ({ id: group.id, kind: group.kind, name: group.name }));
      for (const { id } of [a, b, c]) expect((await typed(id)).map(({ kind, name }) => [kind, name])).toEqual([['FIXED', 'Khoản thu cố định'], ['FLEXIBLE', 'Khoản thu linh hoạt'], ['EXTRACURRICULAR', 'Ngoại khóa']]);
      const groupOf = async (receivableId: string) => (await tx.receivable.findUniqueOrThrow({ where: { id: receivableId }, include: { group: true } })).group;
      // Legacy groups keep their identity and are renamed; custom groups are gone and their Receivables moved to FLEXIBLE.
      expect(await typed(a.id)).toEqual(expect.arrayContaining([{ id: chung, kind: 'FIXED', name: 'Khoản thu cố định' }, { id: dotXuat, kind: 'FLEXIBLE', name: 'Khoản thu linh hoạt' }, { id: ngoaiKhoa, kind: 'EXTRACURRICULAR', name: 'Ngoại khóa' }]));
      expect(await groupOf(tuition)).toMatchObject({ id: chung, kind: 'FIXED' });
      expect(await groupOf(trip)).toMatchObject({ id: dotXuat, kind: 'FLEXIBLE' });
      expect(await groupOf(english)).toMatchObject({ id: ngoaiKhoa, kind: 'EXTRACURRICULAR' });
      expect(await groupOf(uniform)).toMatchObject({ id: dotXuat, kind: 'FLEXIBLE' });
      expect(await tx.receivableGroup.count({ where: { id: custom } })).toBe(0);
      expect(await tx.receivableGroupLifecycleTransition.count({ where: { receivableGroupId: custom } })).toBe(0);
      expect(await groupOf(bTuition)).toMatchObject({ id: bChung, kind: 'FIXED' });
      expect(await groupOf(bClashed)).toMatchObject({ kind: 'FLEXIBLE', schoolId: b.id });
      expect(await tx.receivableGroup.count({ where: { id: bClash } })).toBe(0);
      expect((await groupOf(bClashed)).id).not.toBe(bClash);

      const audit = async (schoolId: string) => tx.auditRecord.findMany({ where: { schoolId, action: 'RECEIVABLE_GROUPS_NORMALIZED' } });
      const [auditA] = await audit(a.id);
      expect(auditA).toMatchObject({ actorType: null, provenance: { migration: '20261002000001_fixed_receivable_group_kinds', removedGroups: [{ groupId: custom, name: 'Đồng phục', movedReceivableIds: [uniform], movedToKind: 'FLEXIBLE' }] } });
      expect((await audit(c.id))[0]!.provenance).toMatchObject({ createdGroups: [{ kind: 'FIXED' }, { kind: 'FLEXIBLE' }, { kind: 'EXTRACURRICULAR' }] });

      // Replaying changes nothing and writes no further audit.
      const before = { a: await typed(a.id), b: await typed(b.id), audits: await tx.auditRecord.count({ where: { schoolId: { in: [a.id, b.id, c.id] }, action: 'RECEIVABLE_GROUPS_NORMALIZED' } }) };
      await tx.$executeRaw`SELECT normalize_receivable_groups()`;
      expect({ a: await typed(a.id), b: await typed(b.id), audits: await tx.auditRecord.count({ where: { schoolId: { in: [a.id, b.id, c.id] }, action: 'RECEIVABLE_GROUPS_NORMALIZED' } }) }).toEqual(before);
      throw rollback;
    })).rejects.toBe(rollback);
  });
});
