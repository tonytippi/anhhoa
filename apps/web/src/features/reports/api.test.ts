import { expect, it } from 'vitest';
import { ApiError } from '../../app/api/client';
import { parseMonthlyReport } from './api';

const report = { data: { billingMonth: '2026-08', counts: { draft: 1, pending: 2, completed: 3 }, totalCollected: 350, cashCollected: 100, transferCollected: 250, transferBreakdown: [{ bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Cô Hoa', total: 250 }] } };

it('parses safe monthly totals and immutable transfer identifiers', () => {
  expect(parseMonthlyReport(report)).toMatchObject({ billingMonth: '2026-08', transferBreakdown: [{ accountHolderName: 'Cô Hoa' }] });
});

it('rejects unsafe or inconsistent report totals', () => {
  expect(() => parseMonthlyReport({ data: { ...report.data, totalCollected: Number.MAX_SAFE_INTEGER + 1 } })).toThrow(ApiError);
  expect(() => parseMonthlyReport({ data: { ...report.data, cashCollected: 101 } })).toThrow(ApiError);
});
