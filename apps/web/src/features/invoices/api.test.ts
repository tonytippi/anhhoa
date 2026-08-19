import { expect, it } from 'vitest';
import { ApiError } from '../../app/api/client';
import { parseInvoice } from './api';

const invoice = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', billingMonth: '2026-08', student: { name: 'Bé An', nickname: null }, schoolClass: { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1' }, status: 'DRAFT', total: 1500000, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' };

it('parses only safe invoice JSON values', () => {
  expect(parseInvoice(invoice)).toMatchObject({ student: { name: 'Bé An' }, total: 1500000 });
  expect(() => parseInvoice({ ...invoice, total: Number.MAX_SAFE_INTEGER + 1 })).toThrow(ApiError);
});
