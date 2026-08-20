import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { resetApiClientForTests } from '../../app/api/client';
import { OverviewPage } from './page';

const august = { data: { billingMonth: '2026-08', counts: { draft: 1, pending: 2, completed: 3 }, totalCollected: 350000, cashCollected: 100000, transferCollected: 250000, transferBreakdown: [{ bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Cô Hoa', total: 250000 }] } };
afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); });

it('uses the response month for retained overview shortcuts after a new month fails', async () => {
  let failNewMonth = false;
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(failNewMonth ? new Response(JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Lỗi' } }), { status: 500 }) : new Response(JSON.stringify(august), { status: 200 })));
  vi.stubGlobal('fetch', fetch);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/?month=2026-08']}><OverviewPage /></MemoryRouter></QueryClientProvider>);
  await screen.findByText('350.000 đ'); failNewMonth = true; fireEvent.change(screen.getByLabelText('Tháng tổng quan'), { target: { value: '2026-09' } });
  expect(await screen.findByText('Đang hiển thị dữ liệu 08/2026.')).toBeVisible(); expect(screen.getByRole('link', { name: /Chờ xác nhận/ })).toHaveAttribute('href', '/hoa-don?month=2026-08&status=PENDING'); expect(screen.getByRole('link', { name: 'Xem báo cáo chi tiết' })).toHaveAttribute('href', '/bao-cao?month=2026-08');
});
