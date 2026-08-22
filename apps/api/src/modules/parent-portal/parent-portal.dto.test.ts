import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListParentInvoicesDto } from './parent-portal.dto.js';

describe('ListParentInvoicesDto', () => {
  it('accepts bounded valid Parent invoice filters', async () => {
    const dto = plainToInstance(ListParentInvoicesDto, { studentId: 'a2e36687-69b4-4e89-8ec0-141ff397837f', billingMonth: '2026-08', status: 'PENDING', page: '2', pageSize: '50' });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ billingMonth: '2026-08', status: 'PENDING', page: 2, pageSize: 50 });
  });

  it('rejects draft status and malformed filters', async () => {
    for (const value of [
      { status: 'DRAFT' },
      { studentId: 'invalid' },
      { billingMonth: '2026-13' },
      { page: '0' },
      { pageSize: '101' },
    ]) {
      await expect(validate(plainToInstance(ListParentInvoicesDto, value))).resolves.not.toHaveLength(0);
    }
  });
});
