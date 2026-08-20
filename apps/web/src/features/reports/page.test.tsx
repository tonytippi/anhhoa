import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { resetApiClientForTests } from '../../app/api/client';
import { ReportsPage } from './page';

const report = { data: { billingMonth: '2026-08', counts: { draft: 1, pending: 2, completed: 3 }, totalCollected: 350000, cashCollected: 100000, transferCollected: 250000, transferBreakdown: [{ bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Cô Hoa', total: 250000 }] } };
afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); });

it('loads the URL month and presents transfer snapshot breakdown', async () => {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(report), { status: 200 }))); vi.stubGlobal('fetch', fetch);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/bao-cao?month=2026-08']}><ReportsPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText('Cô Hoa')).toBeVisible(); expect(screen.getAllByText('250.000 đ')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('Tháng báo cáo'), { target: { value: '2026-09' } });
  expect(await screen.findByText('Cô Hoa')).toBeVisible(); expect(fetch.mock.calls.some(([url]) => String(url).includes('billingMonth=2026-09'))).toBe(true);
});

it('keeps the response month visible and retries a failed new month without repeating the toast', async () => {
  const fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => { const url = input instanceof Request ? input.url : String(input); return Promise.resolve(new URL(url).searchParams.get('billingMonth') === '2026-09' ? new Response(JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Lỗi' } }), { status: 500 }) : new Response(JSON.stringify(report), { status: 200 })); });
  vi.stubGlobal('fetch', fetch);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/bao-cao?month=2026-08']}><ReportsPage /></MemoryRouter></QueryClientProvider>);
  await screen.findByText('Cô Hoa'); fireEvent.change(screen.getByLabelText('Tháng báo cáo'), { target: { value: '2026-09' } });
  expect(await screen.findByText('Đang hiển thị dữ liệu 08/2026.')).toBeVisible(); expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải tháng 09/2026'); expect(screen.getByText('Không thể tải tháng mới. Đang hiển thị dữ liệu trước đó.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await waitFor(() => expect(fetch.mock.calls.filter(([input]) => { const url = input instanceof Request ? input.url : String(input); return new URL(url).searchParams.get('billingMonth') === '2026-09'; })).toHaveLength(2)); expect(screen.getAllByText('Không thể tải tháng mới. Đang hiển thị dữ liệu trước đó.')).toHaveLength(1);
});
