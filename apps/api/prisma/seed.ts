import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { assertDevelopmentEnvironment as assertDevelopment } from '../scripts/development-environment.js';

const peakLand = {
  name: 'Mầm Non Giáo dục Đỉnh Cao - PeakLand Preschool',
  slug: 'pl',
  studentCodePrefix: 'PL',
  ownerEmail: 'sonnh273@gmail.com',
} as const;

const positions = [
  ['HIEU_TRUONG', 'Hiệu trưởng'],
  ['QUAN_LY_TRUONG', 'Quản lý trường'],
  ['KE_TOAN', 'Kế toán'],
  ['GIAO_VIEN', 'Giáo viên'],
  ['TUYEN_SINH', 'Nhân viên tuyển sinh'],
  ['BEP', 'Bếp'],
  ['Y_TE', 'Y tế'],
] as const;

const ownerCapabilities = ['SCHOOL_CONTEXT_READ', 'ACCESS_MANAGE', 'ROSTER_MANAGE', 'SETTINGS_MANAGE', 'FINANCE_MANAGE', 'CLASS_LEAVE_READ', 'LEAVE_REQUEST_DECIDE'];

export function assertDevelopmentEnvironment(): void {
  assertDevelopment('Development seed');
}

export async function seed(): Promise<void> {
  assertDevelopmentEnvironment();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to seed the database.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(9162026)`;
      const owner = await tx.userIdentity.upsert({
        where: { emailNormalized: peakLand.ownerEmail },
        create: { emailNormalized: peakLand.ownerEmail },
        update: {},
      });
      const school = await tx.school.upsert({
        where: { slug: peakLand.slug },
        create: {
          name: peakLand.name,
          slug: peakLand.slug,
          studentCodePrefix: peakLand.studentCodePrefix,
          initialOwnerIdentityId: owner.id,
        },
        update: { name: peakLand.name, studentCodePrefix: peakLand.studentCodePrefix, initialOwnerIdentityId: owner.id },
      });
      const membership = await tx.schoolMembership.upsert({
        where: { schoolId_userIdentityId: { schoolId: school.id, userIdentityId: owner.id } },
        create: { schoolId: school.id, userIdentityId: owner.id },
        update: { status: 'ACTIVE' },
      });
      const seededPositions = await Promise.all(positions.map(async ([code, name]) => [code, await tx.schoolPosition.upsert({
        where: { schoolId_code: { schoolId: school.id, code } },
        create: { schoolId: school.id, code, name, status: 'ACTIVE' },
        update: { name, status: 'ACTIVE' },
      })] as const));
      const positionByCode = new Map(seededPositions);
      const ownerPosition = positionByCode.get('HIEU_TRUONG')!;
      const financePosition = positionByCode.get('KE_TOAN')!;
      await tx.positionCapabilityGrant.createMany({
        data: ownerCapabilities.map((capability) => ({ schoolId: school.id, positionId: ownerPosition.id, capability })),
        skipDuplicates: true,
      });
      await tx.positionCapabilityGrant.createMany({
        data: [{ schoolId: school.id, positionId: financePosition.id, capability: 'FINANCE_MANAGE' }],
        skipDuplicates: true,
      });
      const staffData = {
        schoolId: school.id,
        fullName: peakLand.ownerEmail,
        email: peakLand.ownerEmail,
        employmentStatus: 'ACTIVE' as const,
        primaryPositionId: ownerPosition.id,
        schoolMembershipId: membership.id,
        boundAt: new Date(),
        boundByMembershipId: membership.id,
      };
      const existingStaff = await tx.staffProfile.findFirst({ where: { schoolId: school.id, schoolMembershipId: membership.id } });
      if (existingStaff) await tx.staffProfile.update({ where: { id: existingStaff.id }, data: staffData });
      else await tx.staffProfile.create({
        data: {
          ...staffData,
          phone: 'Chưa cập nhật',
          dateOfBirth: new Date('1900-01-01T00:00:00.000Z'),
          gender: 'Chưa cập nhật',
          address: 'Chưa cập nhật',
        },
      });
    });
  } finally {
    await prisma.$disconnect();
  }
}

if (process.env.PRISMA_SEED === 'true') {
  void seed().catch((error: unknown) => {
    console.error('Failed to seed the database.', error);
    process.exitCode = 1;
  });
}
