import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export async function seed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to seed the database.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.invoiceTemplate.upsert({ where: { singleton: true }, update: {}, create: { singleton: true } });
  } finally {
    await prisma.$disconnect();
  }
}

void seed();
