import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { resetApiClientForTests } from '../../app/api/client';
import { InvoiceDetailPage } from './detail-page';

const draft = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', billingMonth: '2026-08', student: { name: 'Bé An', nickname: null }, schoolClass: { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1' }, status: 'DRAFT', total: 100, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', items: [{ id: 'c2e36687-69b4-4e89-8ec0-141ff397837f', description: 'Học phí', feeGroup: null, amount: 100, position: 0 }], payment: { method: null, bankAccount: null }, createdBy: { id: 'd2e36687-69b4-4e89-8ec0-141ff397837f', displayName: 'Admin' } };
function renderPage() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/hoa-don/${draft.id}`]}><InvoiceDetailPage /></MemoryRouter></QueryClientProvider>); }
afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); });

it('edits a draft with immediate total preview and persists only server-owned fields', async () => {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(String(url).includes('/auth/csrf') ? { data: { csrfToken: 'token' } } : String(url).includes('/bank-accounts') ? { data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } } : { data: draft }), { status: 200 }))); vi.stubGlobal('fetch', fetch);
  renderPage(); await screen.findByRole('heading', { name: 'Hóa đơn Bé An' }); fireEvent.change(screen.getByLabelText('Số tiền (VND)'), { target: { value: '200' } }); expect(screen.getByText('200 đ')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hóa đơn nháp' })); const call = await vi.waitFor(() => { const request = fetch.mock.calls.find(([url, init]) => String(url).endsWith(`/invoices/${draft.id}`) && init?.method === 'PATCH'); expect(request).toBeTruthy(); return request!; });
  expect(JSON.parse(call[1]!.body as string)).toEqual({ items: [{ description: 'Học phí', feeGroup: '', amount: 200 }], paymentMethod: 'CASH' });
});

it('renders pending invoices without editing controls', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(String(url).includes('/bank-accounts') ? { data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } } : { data: { ...draft, status: 'PENDING' } }), { status: 200 }))));
  renderPage(); await screen.findByText('Dòng thu đã khóa'); expect(screen.queryByRole('button', { name: 'Lưu hóa đơn nháp' })).not.toBeInTheDocument(); expect(screen.queryByLabelText('Số tiền (VND)')).not.toBeInTheDocument();
});
