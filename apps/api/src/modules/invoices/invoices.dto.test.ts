import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListInvoicesDto } from './invoices.dto.js';

describe('ListInvoicesDto', () => {
  it('requires a calendar billing month and valid pagination', async () => {
    await expect(validate(plainToInstance(ListInvoicesDto, { billingMonth: '2026-08', page: '2', pageSize: '50' }))).resolves.toHaveLength(0);
    await expect(validate(plainToInstance(ListInvoicesDto, { billingMonth: '2026-13', page: '0' }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(ListInvoicesDto, { billingMonth: '0000-01' }))).resolves.not.toHaveLength(0);
  });
});
