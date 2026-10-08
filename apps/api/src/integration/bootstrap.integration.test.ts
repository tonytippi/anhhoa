import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const databaseUrl = process.env.TARGET_INTEGRATION_DATABASE_URL;
const execFileAsync = promisify(execFile);

describe.skipIf(!databaseUrl)('target database bootstrap', () => {
  it('requires a PostgreSQL target database supplied by the integration environment', () => {
    expect(databaseUrl).toMatch(/^postgresql:\/\//);
  });

  it('seeds the PeakLand owner graph for development login', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl!, options: '-c TimeZone=UTC' }) });
    try {
      const school = await prisma.school.findUniqueOrThrow({
        where: { slug: 'pl' },
        include: {
          initialOwnerIdentity: true,
          memberships: {
            where: { userIdentity: { emailNormalized: 'sonnh273@gmail.com' } },
            include: { boundStaffProfile: { include: { primaryPosition: { include: { grants: true } } } } },
          },
          schoolYears: { where: { name: '2026-2027' } },
          receivableGroups: { include: { lifecycleTransitions: true }, orderBy: { name: 'asc' } },
        },
      });
      expect(school).toMatchObject({
        name: 'Mầm Non Giáo dục Đỉnh Cao - PeakLand Preschool',
        studentCodePrefix: 'PL',
        initialOwnerIdentity: { emailNormalized: 'sonnh273@gmail.com' },
      });
      expect(school.schoolYears).toEqual([
        expect.objectContaining({
          name: '2026-2027',
          startsOn: new Date('2026-08-01T00:00:00.000Z'),
          endsOn: new Date('2027-07-31T00:00:00.000Z'),
        }),
      ]);
      expect(school.memberships).toHaveLength(1);
      const membership = school.memberships[0];
      if (!membership) throw new Error('Thiếu membership PeakLand đã seed.');
      expect(membership).toMatchObject({
        status: 'ACTIVE',
        boundStaffProfile: {
          employmentStatus: 'ACTIVE',
          primaryPosition: {
            code: 'HIEU_TRUONG',
            status: 'ACTIVE',
          },
        },
      });
      expect(membership.boundStaffProfile?.primaryPosition.grants.some((grant) => grant.capability === 'SCHOOL_CONTEXT_READ')).toBe(true);
      expect(school.receivableGroups.map((group) => [group.kind, group.name])).toEqual([['FIXED', 'Khoản thu cố định'], ['FLEXIBLE', 'Khoản thu linh hoạt'], ['EXTRACURRICULAR', 'Ngoại khóa']]);
      expect(school.initialOwnerIdentity).not.toBeNull();
      expect(school.receivableGroups.flatMap((group) => group.lifecycleTransitions)).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('seeds the PeakLand roster and reserves the fixture student code sequence', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl!, options: '-c TimeZone=UTC' }) });
    try {
      const school = await prisma.school.findUniqueOrThrow({
        where: { slug: 'pl' },
        include: {
          classes: { where: { schoolYear: { name: '2026-2027' } } },
          students: {
            where: { studentCode: { in: Array.from({ length: 127 }, (_, index) => `PL${index + 1}`) } },
            include: { enrollments: { where: { schoolYear: { name: '2026-2027' } }, include: { classAssignments: true } } },
          },
        },
      });
      expect(school.studentCodeSequence).toBe(127);
      expect(school.classes).toHaveLength(7);
      expect(school.students).toHaveLength(127);
      expect(school.students.filter((student) => student.enrollments[0]?.lifecycle === 'ENROLLED')).toHaveLength(126);
      expect(school.students.filter((student) => student.enrollments[0]?.lifecycle === 'WAITING_FOR_CLASS')).toHaveLength(1);
      expect(school.students.filter((student) => student.enrollments[0]?.classAssignments).flatMap((student) => student.enrollments[0]!.classAssignments)).toHaveLength(126);
      expect(school.students.find((student) => student.studentCode === 'PL1')).toMatchObject({
        fullName: 'Nguyễn Minh An',
        preferredName: 'Sữa',
        gender: 'NAM',
        address: 'căn hộ GSB 2110B, toà nhà Geleximco 897 Giải Phóng',
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('seeds the PeakLand staff graph without implicit login bindings and remains idempotent', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl!, options: '-c TimeZone=UTC' }) });
    try {
      const school = await prisma.school.findUniqueOrThrow({
        where: { slug: 'pl' },
        include: {
          schoolYears: { where: { name: '2026-2027' } },
          staffProfiles: {
            where: { staffCode: { not: null } },
            include: { issuedCodes: true, assignments: { where: { schoolYear: { name: '2026-2027' } } }, primaryPosition: true },
          },
        },
      });
      expect(school.staffProfiles).toHaveLength(31);
      expect(school.staffProfiles.flatMap((staff) => staff.issuedCodes)).toHaveLength(31);
      const nancy = school.staffProfiles.find((staff) => staff.staffCode === 'TSC-2023-2688-705934')!;
      expect(nancy).toMatchObject({ fullName: 'Ms. Nancy', primaryPosition: { code: 'HIEU_TRUONG' }, schoolMembershipId: null, boundAt: null, boundByMembershipId: null });
      const voHuong = school.staffProfiles.find((staff) => staff.staffCode === 'GSC-2023-2688-799930')!;
      expect(voHuong).toMatchObject({ email: null, phone: null, gender: null, address: null, primaryPosition: { code: 'GIAO_VIEN' } });
      expect(voHuong.assignments).toEqual([expect.objectContaining({ effectiveFrom: new Date('2026-08-01T00:00:00.000Z'), effectiveTo: null, reason: 'PeakLand development seed', className: 'Archimedes' })]);
      const hana = school.staffProfiles.find((staff) => staff.staffCode === 'KSC-2023-2688-795757')!;
      expect(hana.assignments).toHaveLength(7);
       expect(school.staffProfiles.filter((staff) => staff.primaryPosition.code !== 'GIAO_VIEN').flatMap((staff) => staff.assignments)).toHaveLength(0);
       for (const staff of school.staffProfiles) expect(staff.issuedCodes).toEqual([expect.objectContaining({ schoolId: school.id, staffId: staff.id, staffCode: staff.staffCode })]);
       const defaultGroupsBefore = await prisma.receivableGroup.findMany({
         where: { schoolId: school.id },
         include: { lifecycleTransitions: true },
         orderBy: { name: 'asc' },
       });
       const defaultOperationBefore = await prisma.operation.findFirstOrThrow({
         where: { schoolId: school.id, route: 'development-seed/default-receivable-groups', idempotencyKey: '4e1a3ac3-659a-4c01-a567-51b06f8b2feb' },
       });
       await execFileAsync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl!, NODE_ENV: 'development', PRISMA_SEED: 'true' },
      });
      expect(await prisma.staffProfile.count({ where: { schoolId: school.id, staffCode: { not: null } } })).toBe(31);
      expect(await prisma.staffCodeRegistry.count({ where: { schoolId: school.id } })).toBe(31);
      expect(await prisma.staffClassAssignment.count({ where: { schoolId: school.id, schoolYearId: school.schoolYears[0]!.id } })).toBe(28);
       expect(await prisma.receivableGroup.count({ where: { schoolId: school.id } })).toBe(3);
       expect(await prisma.receivableGroupLifecycleTransition.count({ where: { schoolId: school.id } })).toBe(0);
       const receivables = await prisma.receivable.findMany({ where: { schoolId: school.id }, include: { group: true } });
       expect(receivables).toHaveLength(44);
       expect(receivables.filter((item) => item.group.kind === 'FIXED').map((item) => item.displayName).sort()).toEqual(['HỌC PHÍ TIÊU CHUẨN THÁNG', 'Tiền ăn']);
       expect(receivables.find((item) => item.code === 'KO-26112')).toMatchObject({ displayName: 'Tiền ăn', defaultUnitPrice: 50000n, refundUnitPrice: 40000n, autoLeaveDeduction: true, taxCategory: 'NOT_DECLARED' });
       expect(receivables.some((item) => item.taxCategory !== 'NOT_DECLARED')).toBe(false);
       expect(await prisma.financePolicy.findFirstOrThrow({ where: { schoolId: school.id } })).toMatchObject({ schoolWeekdays: [1, 2, 3, 4, 5] });
       const accounts = await prisma.bankAccount.findMany({ where: { schoolId: school.id } });
       expect(accounts).toHaveLength(9);
       expect(accounts.filter((account) => account.kind === 'PERSONAL').every((account) => account.accountHolderName === 'NGUYEN THI HOAN')).toBe(true);
       expect(accounts.filter((account) => account.kind === 'SCHOOL').map((account) => account.receivingBank).sort()).toEqual(['BIDV', 'TPBank']);
       const bidv = accounts.find((account) => account.receivingBank === 'BIDV')!;
       expect((await prisma.class.findMany({ where: { schoolId: school.id } })).every((classroom) => classroom.defaultSchoolBankAccountId === bidv.id)).toBe(true);
       const promotions = await prisma.promotionPolicyVersion.findMany({ where: { schoolId: school.id }, include: { policy: true, targets: { include: { receivable: true } } } });
       expect(promotions).toHaveLength(29);
       expect(promotions.every((version) => version.status === 'ACTIVE' && version.fulfillmentMode === 'DISCOUNT' && version.targets.length > 0)).toBe(true);
       expect(promotions.find((version) => version.policy.name === 'GÓI ƯU ĐÃI 6 TẶNG 3')).toMatchObject({ discountType: 'FIXED_VND', discountValue: 20700000n, targets: [expect.objectContaining({ receivable: expect.objectContaining({ code: 'KO-37955' }) })] });
       expect((await prisma.extracurricularClass.findMany({ where: { schoolId: school.id }, include: { receivable: { include: { group: true } } } })).map((item) => [item.name, item.receivable.group.kind]).sort()).toEqual([['Lớp MC', 'EXTRACURRICULAR'], ['Mỹ thuật', 'EXTRACURRICULAR'], ['Nhảy hiện đại', 'EXTRACURRICULAR'], ['Võ thuật', 'EXTRACURRICULAR']]);
       const defaultGroupsAfter = await prisma.receivableGroup.findMany({
         where: { schoolId: school.id },
         include: { lifecycleTransitions: true },
         orderBy: { name: 'asc' },
       });
       const defaultOperationAfter = await prisma.operation.findFirstOrThrow({
         where: { schoolId: school.id, route: 'development-seed/default-receivable-groups', idempotencyKey: '4e1a3ac3-659a-4c01-a567-51b06f8b2feb' },
       });
       const ownerMembership = await prisma.schoolMembership.findFirstOrThrow({ where: { schoolId: school.id, userIdentityId: school.initialOwnerIdentityId! } });
       expect(defaultGroupsAfter.map((group) => ({ id: group.id, name: group.name, transitions: group.lifecycleTransitions.map((transition) => ({ id: transition.id, operationId: transition.operationId, actorIdentityId: transition.actorIdentityId, membershipId: transition.membershipId })) }))).toEqual(defaultGroupsBefore.map((group) => ({ id: group.id, name: group.name, transitions: group.lifecycleTransitions.map((transition) => ({ id: transition.id, operationId: transition.operationId, actorIdentityId: transition.actorIdentityId, membershipId: transition.membershipId })) })));
       expect(defaultOperationAfter).toMatchObject({ id: defaultOperationBefore.id, status: 'COMPLETED', schoolId: school.id, actorType: 'SCHOOL_MEMBERSHIP', actorIdentityId: school.initialOwnerIdentityId, membershipId: ownerMembership.id, actorReference: ownerMembership.id, fingerprint: 'peakland-default-receivable-groups-v1' });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('seeds active Mẹ and Bố links from complete PeakLand source contacts', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl!, options: '-c TimeZone=UTC' }) });
    try {
      const school = await prisma.school.findUniqueOrThrow({
        where: { slug: 'pl' },
        include: {
          students: {
            where: { studentCode: { in: ['PL1', 'PL9'] } },
            include: { parentLinks: { include: { parentProfile: true } } },
          },
        },
      });
      const first = school.students.find((student) => student.studentCode === 'PL1')!;
      expect(first.parentLinks.filter((link) => link.status === 'ACTIVE')).toEqual([expect.objectContaining({ relationshipLabel: 'Mẹ', parentProfile: expect.objectContaining({ fullName: 'Nguyễn Minh Hòa', phone: '0966695297', emailNormalized: null }) })]);
      const ninth = school.students.find((student) => student.studentCode === 'PL9')!;
      expect(ninth.parentLinks).toEqual([
        expect.objectContaining({ status: 'ACTIVE', relationshipLabel: 'Mẹ', parentProfile: expect.objectContaining({ fullName: 'Phạm Thị Tú Anh', phone: '0334355172', emailNormalized: null }) }),
        expect.objectContaining({ status: 'ACTIVE', relationshipLabel: 'Bố', parentProfile: expect.objectContaining({ fullName: 'Cao Văn Quân', phone: '0973133121', emailNormalized: null }) }),
      ]);
    } finally {
      await prisma.$disconnect();
    }
  });
});
