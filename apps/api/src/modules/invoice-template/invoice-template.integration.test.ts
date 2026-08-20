import { PrismaPg } from '@prisma/adapter-pg';
import { InvoiceTemplateAmountSource, PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { InvoiceTemplateService } from './invoice-template.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new InvoiceTemplateService(prisma as never);
const run = promisify(execFile);
beforeEach(async () => { await prisma.invoiceTemplateItem.deleteMany(); await prisma.invoiceTemplate.deleteMany(); await prisma.invoiceTemplate.create({ data: { singleton: true } }); });
afterAll(async () => { await prisma.$disconnect(); });

describe('InvoiceTemplateService PostgreSQL contract', () => {
  it('seeds default items once and preserves configured template items', async () => {
    await prisma.invoiceTemplateItem.deleteMany();
    await prisma.invoiceTemplate.deleteMany();
    const options = { cwd: resolve(import.meta.dirname, '../../..'), env: { ...process.env, DATABASE_URL: databaseUrl } };
    await run('pnpm', ['prisma', 'db', 'seed'], options);
    const seeded = await prisma.invoiceTemplate.findUniqueOrThrow({ where: { singleton: true }, include: { items: { orderBy: { position: 'asc' } } } });
    expect(seeded.items.map((item) => [item.description, item.amountSource, item.fixedAmount])).toEqual([
      ['Học phí', InvoiceTemplateAmountSource.CLASS_TUITION, null],
      ['Xe', InvoiceTemplateAmountSource.FIXED, 0n],
      ['Khác', InvoiceTemplateAmountSource.FIXED, 0n],
      ['Tạm thu tiền ăn', InvoiceTemplateAmountSource.FIXED, 0n],
      ['Phụ phí', InvoiceTemplateAmountSource.FIXED, 0n],
      ['Phụ ăn', InvoiceTemplateAmountSource.FIXED, 0n],
      ['Ngoài giờ', InvoiceTemplateAmountSource.FIXED, 0n],
      ['Ăn tối', InvoiceTemplateAmountSource.FIXED, 0n],
      ['Đổi trừ Phép T7', InvoiceTemplateAmountSource.FIXED, 0n],
      ['Khác', InvoiceTemplateAmountSource.FIXED, 0n],
    ]);
    await run('pnpm', ['prisma', 'db', 'seed'], options);
    await expect(prisma.invoiceTemplateItem.count({ where: { templateId: seeded.id } })).resolves.toBe(10);
    await prisma.invoiceTemplateItem.deleteMany({ where: { templateId: seeded.id } });
    await prisma.invoiceTemplateItem.create({ data: { templateId: seeded.id, description: 'Cấu hình Admin', position: 0, amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 42n } });
    await run('pnpm', ['prisma', 'db', 'seed'], options);
    await expect(prisma.invoiceTemplateItem.findMany({ where: { templateId: seeded.id } })).resolves.toMatchObject([{ description: 'Cấu hình Admin', position: 0, fixedAmount: 42n }]);
  });

  it('persists signed JSON-safe amounts and rejects out-of-range amounts and positions', async () => {
    const template = await prisma.invoiceTemplate.findUniqueOrThrow({ where: { singleton: true } });
    await expect(prisma.invoiceTemplateItem.create({ data: { templateId: template.id, description: 'Giảm trừ', position: 0, amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: -135000n } })).resolves.toMatchObject({ fixedAmount: -135000n });
    await expect(prisma.invoiceTemplateItem.create({ data: { templateId: template.id, description: 'Tiền không JSON-safe', position: 0, amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 9007199254740992n } })).rejects.toThrow();
    await expect(prisma.invoiceTemplateItem.create({ data: { templateId: template.id, description: 'Tiền âm không JSON-safe', position: 1, amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: -9007199254740992n } })).rejects.toThrow();
    await expect(prisma.invoiceTemplateItem.create({ data: { templateId: template.id, description: 'Sai thứ tự', position: -1, amountSource: InvoiceTemplateAmountSource.CLASS_TUITION } })).rejects.toThrow();
  });

  it('persists singleton items, source exclusivity, continuous order, and reordering', async () => {
    const first = await service.createItem({ description: 'Tiền ăn', feeGroup: 'Ăn uống', amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 300000 });
    const second = await service.createItem({ description: 'Học phí', amountSource: InvoiceTemplateAmountSource.CLASS_TUITION });
    await service.reorder(second.data.id, 'up');
    const ordered = await service.get();
    expect(ordered.data.items.map((item) => item.id)).toEqual([second.data.id, first.data.id]);
    expect(ordered.data.items[0]).not.toHaveProperty('fixedAmount');
    await service.deleteItem(second.data.id);
    await expect(service.get()).resolves.toMatchObject({ data: { items: [{ id: first.data.id, position: 0, fixedAmount: 300000 }] } });
  });

  it('serializes concurrent creates and keeps positions continuous', async () => {
    const [first, second] = await Promise.all([service.createItem({ description: 'Tiền ăn', amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 100 }), service.createItem({ description: 'Tiền học', amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 200 })]);
    const current = await service.get();
    expect(new Set(current.data.items.map((item) => item.id))).toEqual(new Set([first.data.id, second.data.id]));
    expect(current.data.items.map((item) => item.position)).toEqual([0, 1]);
  });

  it('recovers concurrent first writes when a migrated database has no seeded singleton', async () => {
    await prisma.invoiceTemplate.deleteMany();
    const [first, second] = await Promise.all([service.createItem({ description: 'Tiền ăn', amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 100 }), service.createItem({ description: 'Tiền học', amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 200 })]);
    const current = await service.get();
    expect(current.data.items.map((item) => item.position)).toEqual([0, 1]);
    expect(new Set(current.data.items.map((item) => item.id))).toEqual(new Set([first.data.id, second.data.id]));
    await expect(prisma.invoiceTemplate.count()).resolves.toBe(1);
  });
});
