import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceTemplateAmountSource, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CreateInvoiceTemplateItemDto, UpdateInvoiceTemplateItemDto } from './invoice-template.dto.js';

const templateWithItems = { items: { orderBy: { position: 'asc' } } } satisfies Prisma.InvoiceTemplateInclude;
type ItemRecord = Prisma.InvoiceTemplateItemGetPayload<Record<string, never>>;
type TemplateRecord = Prisma.InvoiceTemplateGetPayload<{ include: typeof templateWithItems }>;

function safeMoney(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error('Stored fixed amount is outside the JSON safe integer range.');
  return amount;
}
function serializeItem(item: ItemRecord) {
  return { id: item.id, description: item.description, feeGroup: item.feeGroup, position: item.position, amountSource: item.amountSource, ...(item.amountSource === InvoiceTemplateAmountSource.FIXED ? { fixedAmount: safeMoney(item.fixedAmount!) } : {}), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}
function serialize(template: TemplateRecord) { return { id: template.id, items: template.items.map(serializeItem), createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString() }; }

@Injectable()
export class InvoiceTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    let template = await this.prisma.invoiceTemplate.findUnique({ where: { singleton: true }, include: templateWithItems });
    if (!template) {
      try { template = await this.prisma.invoiceTemplate.create({ data: { singleton: true }, include: templateWithItems }); }
      catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        template = await this.prisma.invoiceTemplate.findUniqueOrThrow({ where: { singleton: true }, include: templateWithItems });
      }
    }
    return { data: serialize(template) };
  }

  private async serializable<T>(work: (tx: PrismaService) => Promise<T>, retryUniqueConflict = false): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { return await this.prisma.$transaction((tx) => work(tx as PrismaService), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || (retryUniqueConflict && error.code === 'P2002'));
        if (attempt === 2 || !retryable) throw error;
      }
    }
    throw new Error('Unreachable invoice template transaction retry state.');
  }

  private async lockTemplate(tx: PrismaService, id: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "InvoiceTemplate" WHERE id = ${id}::uuid FOR UPDATE`;
  }

  async createItem(input: CreateInvoiceTemplateItemDto) {
    return this.serializable(async (tx) => {
      let template = await tx.invoiceTemplate.findUnique({ where: { singleton: true }, select: { id: true } });
      if (!template) template = await tx.invoiceTemplate.create({ data: { singleton: true }, select: { id: true } });
      await this.lockTemplate(tx, template.id);
      const position = await tx.invoiceTemplateItem.count({ where: { templateId: template.id } });
      const item = await tx.invoiceTemplateItem.create({ data: { templateId: template.id, description: input.description.trim(), feeGroup: input.feeGroup?.trim() || null, position, amountSource: input.amountSource, fixedAmount: input.amountSource === InvoiceTemplateAmountSource.FIXED ? BigInt(input.fixedAmount!) : null } });
      await tx.invoiceTemplate.update({ where: { id: template.id }, data: {} });
      return { data: serializeItem(item) };
    }, true);
  }

  async updateItem(id: string, input: UpdateInvoiceTemplateItemDto) {
    return this.serializable(async (tx) => {
      const existing = await tx.invoiceTemplateItem.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Invoice template item not found.');
      await this.lockTemplate(tx, existing.templateId);
      const item = await tx.invoiceTemplateItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Invoice template item not found.');
      const updated = await tx.invoiceTemplateItem.update({ where: { id }, data: { description: input.description.trim(), feeGroup: input.feeGroup?.trim() || null, amountSource: input.amountSource, fixedAmount: input.amountSource === InvoiceTemplateAmountSource.FIXED ? BigInt(input.fixedAmount!) : null } });
      await tx.invoiceTemplate.update({ where: { id: item.templateId }, data: {} });
      return { data: serializeItem(updated) };
    });
  }

  async deleteItem(id: string) {
    return this.serializable(async (tx) => {
      const item = await tx.invoiceTemplateItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Invoice template item not found.');
      await this.lockTemplate(tx, item.templateId);
      const lockedItem = await tx.invoiceTemplateItem.findUnique({ where: { id } });
      if (!lockedItem) throw new NotFoundException('Invoice template item not found.');
      await tx.invoiceTemplateItem.delete({ where: { id } });
      await tx.invoiceTemplateItem.updateMany({ where: { templateId: lockedItem.templateId, position: { gt: lockedItem.position } }, data: { position: { decrement: 1 } } });
      await tx.invoiceTemplate.update({ where: { id: lockedItem.templateId }, data: {} });
      return { data: { id } };
    });
  }

  async reorder(id: string, direction: 'up' | 'down') {
    return this.serializable(async (tx) => {
      const item = await tx.invoiceTemplateItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Invoice template item not found.');
      await this.lockTemplate(tx, item.templateId);
      const lockedItem = await tx.invoiceTemplateItem.findUnique({ where: { id } });
      if (!lockedItem) throw new NotFoundException('Invoice template item not found.');
      const neighbor = await tx.invoiceTemplateItem.findFirst({ where: { templateId: lockedItem.templateId, position: direction === 'up' ? { lt: lockedItem.position } : { gt: lockedItem.position } }, orderBy: { position: direction === 'up' ? 'desc' : 'asc' } });
      if (!neighbor) return { data: serializeItem(lockedItem) };
      await tx.invoiceTemplateItem.update({ where: { id: neighbor.id }, data: { position: lockedItem.position } });
      const reordered = await tx.invoiceTemplateItem.update({ where: { id: lockedItem.id }, data: { position: neighbor.position } });
      await tx.invoiceTemplate.update({ where: { id: lockedItem.templateId }, data: {} });
      return { data: serializeItem(reordered) };
    });
  }
}
