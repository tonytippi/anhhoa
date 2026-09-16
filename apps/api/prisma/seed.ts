import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export async function seed(): Promise<void> {
  if (process.env.ALLOW_DEVELOPMENT_SEED !== 'true') throw new Error('Set ALLOW_DEVELOPMENT_SEED=true to seed development or test fixtures.');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to seed the database.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(9162026)`;
      await tx.school.upsert({
        where: { slug: 'truong-mau-passionedu' },
        update: {},
        create: { name: 'Trường mẫu PassionEdu', slug: 'truong-mau-passionedu' },
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
