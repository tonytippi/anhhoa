import { InvoiceTemplateAmountSource } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceTemplateService } from './invoice-template.service.js';

const template = { id: 'ca2e3668-69b4-4e89-8ec0-141ff397837f', singleton: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), items: [] };
const item = { id: 'da2e3668-69b4-4e89-8ec0-141ff397837f', templateId: template.id, description: 'Tiền ăn', feeGroup: 'Ăn uống', position: 0, amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 300000n, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') };
function prisma() {
  const tx = { $queryRaw: vi.fn(), invoiceTemplate: { findUnique: vi.fn().mockResolvedValue({ id: template.id }), create: vi.fn().mockResolvedValue({ id: template.id }), update: vi.fn() }, invoiceTemplateItem: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue(item), findUnique: vi.fn().mockResolvedValue(item), findFirst: vi.fn(), update: vi.fn().mockResolvedValue(item), delete: vi.fn(), updateMany: vi.fn() } };
  return { invoiceTemplate: { findUnique: vi.fn().mockResolvedValue(template), create: vi.fn().mockResolvedValue(template) }, invoiceTemplateItem: { update: vi.fn().mockResolvedValue(item) }, $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)), tx };
}

describe('InvoiceTemplateService', () => {
  it('returns the singleton with items in persisted order', async () => {
    const db = prisma();
    db.invoiceTemplate.findUnique.mockResolvedValue({ ...template, items: [{ ...item, position: 1 }, { ...item, id: 'ea2e3668-69b4-4e89-8ec0-141ff397837f', position: 0, amountSource: InvoiceTemplateAmountSource.CLASS_TUITION, fixedAmount: null }] });
    await expect(new InvoiceTemplateService(db as never).get()).resolves.toMatchObject({ data: { items: [{ position: 1 }, { position: 0, amountSource: 'CLASS_TUITION' }] } });
  });

  it('creates a fixed item with BigInt and strips fixed amount from class tuition', async () => {
    const db = prisma(); const service = new InvoiceTemplateService(db as never);
    await expect(service.createItem({ description: ' Tiền ăn ', feeGroup: ' Ăn uống ', amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 300000 })).resolves.toMatchObject({ data: { fixedAmount: 300000 } });
    expect(db.tx.invoiceTemplateItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ description: 'Tiền ăn', fixedAmount: 300000n }) }));
    db.tx.invoiceTemplateItem.create.mockResolvedValue({ ...item, amountSource: InvoiceTemplateAmountSource.CLASS_TUITION, fixedAmount: null });
    await expect(service.createItem({ description: 'Học phí', amountSource: InvoiceTemplateAmountSource.CLASS_TUITION })).resolves.toMatchObject({ data: { amountSource: 'CLASS_TUITION' } });
  });

  it('does not mutate order on update and makes boundary reorder a no-op', async () => {
    const db = prisma(); const service = new InvoiceTemplateService(db as never);
    await service.updateItem(item.id, { description: 'Tiền ăn', amountSource: InvoiceTemplateAmountSource.FIXED, fixedAmount: 200000 });
    expect(db.tx.invoiceTemplateItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ position: expect.anything() }) }));
    await expect(service.reorder(item.id, 'up')).resolves.toMatchObject({ data: { position: 0 } });
    expect(db.tx.invoiceTemplate.update).toHaveBeenCalledTimes(1);
  });

  it('compacts positions when deleting an item', async () => {
    const db = prisma();
    await expect(new InvoiceTemplateService(db as never).deleteItem(item.id)).resolves.toEqual({ data: { id: item.id } });
    expect(db.tx.invoiceTemplateItem.updateMany).toHaveBeenCalledWith({ where: { templateId: template.id, position: { gt: 0 } }, data: { position: { decrement: 1 } } });
    expect(db.tx.invoiceTemplate.update).toHaveBeenCalledWith({ where: { id: template.id }, data: {} });
  });
});
