import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { CreateInvoiceTemplateItemDto } from './invoice-template.dto.js';

describe('CreateInvoiceTemplateItemDto', () => {
  it('requires a signed fixed safe amount and rejects it for class tuition', async () => {
    await expect(validate(plainToInstance(CreateInvoiceTemplateItemDto, { description: 'Tiền ăn', amountSource: 'FIXED' }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(CreateInvoiceTemplateItemDto, { description: 'Giảm trừ', amountSource: 'FIXED', fixedAmount: -135000 }))).resolves.toHaveLength(0);
    await expect(validate(plainToInstance(CreateInvoiceTemplateItemDto, { description: 'Quá cận', amountSource: 'FIXED', fixedAmount: 9007199254740992 }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(CreateInvoiceTemplateItemDto, { description: 'Quá cận âm', amountSource: 'FIXED', fixedAmount: -9007199254740992 }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(CreateInvoiceTemplateItemDto, { description: 'Học phí', amountSource: 'CLASS_TUITION', fixedAmount: 1 }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(CreateInvoiceTemplateItemDto, { description: 'Học phí', amountSource: 'CLASS_TUITION' }))).resolves.toHaveLength(0);
  });
});
