import { expect, it, vi } from 'vitest';
import { ApiError } from '../../app/api/client';
import { completeInvoice, getInvoiceBatchOperation, parseBatchResult, parseInvoice, parseInvoiceDetail } from './api';

const invoice = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', billingMonth: '2026-08', student: { name: 'Bé An', nickname: null }, schoolClass: { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1' }, status: 'DRAFT', total: 1500000, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' };
const noCompletion = { completedBy: null, completedAt: null };

it('parses only safe invoice JSON values', () => {
  expect(parseInvoice(invoice)).toMatchObject({ student: { name: 'Bé An' }, total: 1500000 });
  expect(() => parseInvoice({ ...invoice, total: Number.MAX_SAFE_INTEGER + 1 })).toThrow(ApiError);
});

it('parses ordered draft lines and editable payment selection', () => {
  expect(parseInvoiceDetail({ data: { ...invoice, ...noCompletion, items: [{ id: 'c2e36687-69b4-4e89-8ec0-141ff397837f', description: 'Học phí', feeGroup: null, amount: 1500000, position: 0 }], payment: { method: 'CASH', bankAccount: null }, qr: null, createdBy: { id: 'd2e36687-69b4-4e89-8ec0-141ff397837f', displayName: 'Admin' } } })).toMatchObject({ items: [{ position: 0 }], payment: { method: 'CASH' } });
});

it('parses a pending transfer QR only with payment snapshot data', () => {
  expect(parseInvoiceDetail({ data: { ...invoice, ...noCompletion, status: 'PENDING', items: [], payment: { method: 'TRANSFER', bankAccount: { bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Cô Hoa' } }, qr: { transferContent: 'Bé An Mầm 1 chuyển tiền', url: 'https://img.vietqr.io/qr.png' }, createdBy: { id: 'd2e36687-69b4-4e89-8ec0-141ff397837f', displayName: 'Admin' } } })).toMatchObject({ qr: { transferContent: 'Bé An Mầm 1 chuyển tiền' } });
});

it('rejects QR on drafts and missing payment on locked invoices', () => {
  const detail = { items: [], payment: { method: 'TRANSFER', bankAccount: { bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Cô Hoa' } }, qr: { transferContent: 'Bé An Mầm 1 chuyển tiền', url: 'https://img.vietqr.io/qr.png' }, createdBy: { id: 'd2e36687-69b4-4e89-8ec0-141ff397837f', displayName: 'Admin' } };
  expect(() => parseInvoiceDetail({ data: { ...invoice, ...detail } })).toThrow(ApiError);
  expect(() => parseInvoiceDetail({ data: { ...invoice, status: 'PENDING', ...detail, payment: { method: null, bankAccount: null }, qr: null } })).toThrow(ApiError);
});

it('accepts a pending operation while reconciling a batch timeout', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { operationId: 'a2e36687-69b4-4e89-8ec0-141ff397837f', state: 'PENDING' } }), { status: 200 })); vi.stubGlobal('fetch', fetch);
  await expect(getInvoiceBatchOperation('a2e36687-69b4-4e89-8ec0-141ff397837f')).resolves.toMatchObject({ state: 'PENDING' });
});

it('parses a batch result only with safe counts and all skip reasons', () => {
  const result = { data: { operationId: 'a2e36687-69b4-4e89-8ec0-141ff397837f', createdCount: 2, skipped: { inactiveStudent: 1, missingClass: 0, archivedClass: 0, existingInvoice: 3 } } };
  expect(parseBatchResult(result)).toMatchObject({ createdCount: 2, skipped: { existingInvoice: 3 } });
  expect(() => parseBatchResult({ data: { ...result.data, skipped: {} } })).toThrow(ApiError);
});

it('posts completion with its UUID idempotency key and accepts completion audit data', async () => {
  const operationId = 'e2e36687-69b4-4e89-8ec0-141ff397837f';
  const completion = { data: { ...invoice, ...noCompletion, status: 'COMPLETED', items: [], payment: { method: 'CASH', bankAccount: null }, qr: null, createdBy: { id: 'd2e36687-69b4-4e89-8ec0-141ff397837f', displayName: 'Creator' }, completedBy: { id: 'f2e36687-69b4-4e89-8ec0-141ff397837f', displayName: 'Confirmer' }, completedAt: '2026-08-02T00:00:00.000Z' } };
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(String(url).endsWith('/auth/csrf') ? { data: { csrfToken: 'token' } } : completion), { status: 200 })));
  vi.stubGlobal('fetch', fetch);
  await expect(completeInvoice(invoice.id, operationId)).resolves.toMatchObject({ status: 'COMPLETED', completedBy: { displayName: 'Confirmer' } });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/invoices/${invoice.id}/complete`), expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'Idempotency-Key': operationId }) }));
});
