import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { BatchInvoiceDto, InvoiceIdDto, ListInvoicesDto, UpdateInvoiceDto } from './invoices.dto.js';

describe('ListInvoicesDto', () => {
  it('requires a calendar billing month and valid pagination', async () => {
    await expect(validate(plainToInstance(ListInvoicesDto, { billingMonth: '2026-08', page: '2', pageSize: '50' }))).resolves.toHaveLength(0);
    await expect(validate(plainToInstance(ListInvoicesDto, { billingMonth: '2026-13', page: '0' }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(ListInvoicesDto, { billingMonth: '0000-01' }))).resolves.not.toHaveLength(0);
  });
});

describe('UpdateInvoiceDto', () => {
  it('allows whole-VND draft lines within the inclusive financial boundary', async () => {
    await expect(validate(plainToInstance(UpdateInvoiceDto, { items: [{ description: 'Điều chỉnh', amount: -100_000_000 }, { description: 'Thu', amount: 100_000_000 }], paymentMethod: 'CASH' }))).resolves.toHaveLength(0);
    await expect(validate(plainToInstance(UpdateInvoiceDto, { items: [{ description: 'Quá giới hạn', amount: 100_000_001 }], paymentMethod: 'CASH' }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(UpdateInvoiceDto, { items: [], paymentMethod: 'TRANSFER' }))).resolves.not.toHaveLength(0);
  });
});

describe('BatchInvoiceDto', () => {
  it('requires a valid month and non-empty selected class scope', async () => {
    await expect(validate(plainToInstance(BatchInvoiceDto, { billingMonth: '2026-08', allActiveClasses: true }))).resolves.toHaveLength(0);
    await expect(validate(plainToInstance(BatchInvoiceDto, { billingMonth: '2026-08', allActiveClasses: false, classIds: ['a2e36687-69b4-4e89-8ec0-141ff397837f'] }))).resolves.toHaveLength(0);
    await expect(validate(plainToInstance(BatchInvoiceDto, { billingMonth: '2026-13', allActiveClasses: false, classIds: [] }))).resolves.not.toHaveLength(0);
  });
});

describe('InvoiceIdDto', () => {
  it('only accepts UUID action parameters', async () => {
    await expect(validate(plainToInstance(InvoiceIdDto, { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f' }))).resolves.toHaveLength(0);
    await expect(validate(plainToInstance(InvoiceIdDto, { id: 'not-a-uuid' }))).resolves.not.toHaveLength(0);
  });
});
