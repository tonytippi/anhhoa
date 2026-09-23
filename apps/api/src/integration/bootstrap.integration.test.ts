import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.TARGET_INTEGRATION_DATABASE_URL;

describe.skipIf(!databaseUrl)('target database bootstrap', () => {
  it('requires a PostgreSQL target database supplied by the integration environment', () => {
    expect(databaseUrl).toMatch(/^postgresql:\/\//);
  });

  it('seeds the PeakLand owner graph for development login', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
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
    } finally {
      await prisma.$disconnect();
    }
  });
});
