import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { CreateInvoiceTemplateItemDto } from './invoice-template.dto.js';

describe('CreateInvoiceTemplateItemDto', () => {
  it('requires a fixed safe amount and rejects it for class tuition', async () => {
    await expect(validate(plainToInstance(CreateInvoiceTemplateItemDto, { description: 'Tiền ăn', amountSource: 'FIXED' }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(CreateInvoiceTemplateItemDto, { description: 'Học phí', amountSource: 'CLASS_TUITION', fixedAmount: 1 }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(CreateInvoiceTemplateItemDto, { description: 'Học phí', amountSource: 'CLASS_TUITION' }))).resolves.toHaveLength(0);
  });
});
