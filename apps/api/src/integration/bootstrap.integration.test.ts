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

  it('seeds the PeakLand roster and reserves the fixture student code sequence', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
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

  it('seeds active Mẹ and Bố links from complete PeakLand source contacts', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
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
