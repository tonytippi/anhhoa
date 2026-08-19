import { PrismaPg } from '@prisma/adapter-pg';
import { InvoiceTemplateAmountSource, PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { InvoiceTemplateService } from './invoice-template.service.js';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL !== databaseUrl) throw new Error('Integration tests require the dedicated Docker Compose PostgreSQL database.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const service = new InvoiceTemplateService(prisma as never);
beforeEach(async () => { await prisma.invoiceTemplateItem.deleteMany(); await prisma.invoiceTemplate.deleteMany(); await prisma.invoiceTemplate.create({ data: { singleton: true } }); });
afterAll(async () => { await prisma.$disconnect(); });

describe('InvoiceTemplateService PostgreSQL contract', () => {
  it('runs the idempotent seed executable from the integration runner', async () => {
    const runner = await readFile(resolve(import.meta.dirname, '../../../scripts/test-integration.ts'), 'utf8');
    expect(runner).toContain("run('pnpm', ['prisma', 'db', 'seed'])");
    await prisma.invoiceTemplate.upsert({ where: { singleton: true }, update: {}, create: { singleton: true } });
    await expect(prisma.invoiceTemplate.count()).resolves.toBe(1);
  });

  it('enforces non-negative persisted amounts and positions', async () => {
    const template = await prisma.invoiceTemplate.findUniqueOrThrow({ where: { singleton: true } });
    await expect(prisma.invoiceTemplateItem.create({ data: { templateId: template.id, description: 'Sai tiền', position: 0, amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: -1n } })).rejects.toThrow();
    await expect(prisma.invoiceTemplateItem.create({ data: { templateId: template.id, description: 'Tiền không JSON-safe', position: 0, amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 9007199254740992n } })).rejects.toThrow();
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
