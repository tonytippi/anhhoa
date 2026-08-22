import { describe, expect, it, vi } from 'vitest';
import { ParentPortalController } from './parent-portal.controller.js';

const parentId = 'a2e36687-69b4-4e89-8ec0-141ff397837f';
const invoiceId = 'b2e36687-69b4-4e89-8ec0-141ff397837f';
const portal = {
  students: vi.fn(), invoices: vi.fn(), invoice: vi.fn(),
  payment: vi.fn().mockResolvedValue({ data: { total: 100 }, vietQr: '000201' }),
  paymentPng: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
};
const request = (accept?: string) => ({ user: { id: parentId }, get: vi.fn((name: string) => name === 'accept' ? accept : undefined) });
const response = () => {
  const value = { type: vi.fn(), attachment: vi.fn() };
  value.type.mockReturnValue(value); value.attachment.mockReturnValue(value);
  return value;
};

describe('ParentPortalController payment contract', () => {
  it('defaults absent and wildcard Accept headers to the JSON payment payload', async () => {
    const controller = new ParentPortalController(portal as never);
    for (const accept of [undefined, '*/*']) {
      await expect(controller.payment(request(accept) as never, { invoiceId }, response() as never)).resolves.toEqual({ data: { total: 100 }, vietQr: '000201' });
    }
    expect(portal.payment).toHaveBeenCalledTimes(2);
    expect(portal.paymentPng).not.toHaveBeenCalled();
  });

  it('selects a downloadable PNG only for an explicit image/png media range', async () => {
    const controller = new ParentPortalController(portal as never);
    const res = response();
    await expect(controller.payment(request('application/json, image/png;q=0.9') as never, { invoiceId }, res as never)).resolves.toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(res.type).toHaveBeenCalledWith('png');
    expect(res.attachment).toHaveBeenCalledWith(`anh-hoa-${invoiceId}.png`);
    expect(portal.paymentPng).toHaveBeenCalledWith(parentId, invoiceId);
  });
});
