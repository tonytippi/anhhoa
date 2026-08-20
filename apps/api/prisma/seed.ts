import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export async function seed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to seed the database.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoiceTemplate.upsert({ where: { singleton: true }, update: {}, create: { singleton: true } });

      const classes = [
        await seedClass(tx, 'Mầm non 3 tuổi A', 2_500_000n),
        await seedClass(tx, 'Mầm non 4 tuổi B', 2_700_000n),
        await seedClass(tx, 'Mầm non 5 tuổi C', 2_900_000n),
      ];

      await seedStudent(tx, 'Nguyễn Minh Anh', 'Bông', classes[0].id);
      await seedStudent(tx, 'Trần Gia Hân', 'Su', classes[0].id);
      await seedStudent(tx, 'Lê Đức Minh', 'Tí', classes[1].id);
      await seedStudent(tx, 'Phạm Khánh Linh', 'Miu', classes[1].id);
      await seedStudent(tx, 'Võ Hoàng Nam', 'Bin', classes[2].id);
      await seedStudent(tx, 'Đặng Bảo Ngọc', 'Na', classes[2].id);

      await seedBankAccount(tx, 'VCB', '0000000001', 'TAI KHOAN THU NGHIEM');
      await seedBankAccount(tx, 'TCB', '0000000002', 'TAI KHOAN THU NGHIEM');
      await seedBankAccount(tx, 'MB', '0000000003', 'TAI KHOAN THU NGHIEM');
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function seedClass(prisma: PrismaClient | Prisma.TransactionClient, name: string, monthlyTuition: bigint) {
  const existing = await prisma.class.findFirst({ where: { name } });
  if (existing) return existing;

  return prisma.class.create({ data: { name, monthlyTuition } });
}

async function seedStudent(prisma: PrismaClient | Prisma.TransactionClient, fullName: string, nickname: string, classId: string) {
  const existing = await prisma.student.findFirst({ where: { fullName, nickname } });
  if (existing) return existing;

  return prisma.student.create({ data: { fullName, nickname, classId } });
}

async function seedBankAccount(
  prisma: PrismaClient | Prisma.TransactionClient,
  bankCode: string,
  accountNumber: string,
  accountHolderName: string,
) {
  const existing = await prisma.bankAccount.findFirst({ where: { bankCode, accountNumber } });
  if (existing) return existing;

  return prisma.bankAccount.create({ data: { bankCode, accountNumber, accountHolderName } });
}

void seed().catch((error: unknown) => {
  console.error('Failed to seed the database.', error);
  process.exitCode = 1;
});
