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
        },
      });
      expect(school).toMatchObject({
        name: 'Mầm Non Giáo dục Đỉnh Cao - PeakLand Preschool',
        studentCodePrefix: 'PL',
        initialOwnerIdentity: { emailNormalized: 'sonnh273@gmail.com' },
      });
      expect(school.memberships).toHaveLength(1);
      expect(school.memberships[0]).toMatchObject({
        status: 'ACTIVE',
        boundStaffProfile: {
          employmentStatus: 'ACTIVE',
          primaryPosition: {
            code: 'HIEU_TRUONG',
            status: 'ACTIVE',
            grants: expect.arrayContaining([{ capability: 'SCHOOL_CONTEXT_READ' }]),
          },
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  });
});
