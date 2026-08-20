import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { resetApiClientForTests } from '../../app/api/client';
import { InvoiceDetailPage } from './detail-page';

const draft = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', billingMonth: '2026-08', student: { name: 'Bé An', nickname: null }, schoolClass: { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1' }, status: 'DRAFT', total: 100, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', items: [{ id: 'c2e36687-69b4-4e89-8ec0-141ff397837f', description: 'Học phí', feeGroup: null, amount: 100, position: 0 }], payment: { method: null, bankAccount: null }, qr: null, createdBy: { id: 'd2e36687-69b4-4e89-8ec0-141ff397837f', displayName: 'Admin' }, completedBy: null, completedAt: null };
function renderPage() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/hoa-don/${draft.id}`]}><InvoiceDetailPage /></MemoryRouter></QueryClientProvider>); }
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); resetApiClientForTests(); sessionStorage.clear(); });

it('edits a draft with immediate total preview and persists only server-owned fields', async () => {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(String(url).includes('/auth/csrf') ? { data: { csrfToken: 'token' } } : String(url).includes('/bank-accounts') ? { data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } } : { data: draft }), { status: 200 }))); vi.stubGlobal('fetch', fetch);
  renderPage(); await screen.findByRole('heading', { name: 'Hóa đơn Bé An' }); fireEvent.change(screen.getByLabelText('Số tiền (VND)'), { target: { value: '200' } }); expect(screen.getByText('200 đ')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hóa đơn nháp' })); const call = await vi.waitFor(() => { const request = fetch.mock.calls.find(([url, init]) => String(url).endsWith(`/invoices/${draft.id}`) && init?.method === 'PATCH'); expect(request).toBeTruthy(); return request!; });
  expect(JSON.parse(call[1]!.body as string)).toEqual({ items: [{ description: 'Học phí', feeGroup: '', amount: 200 }], paymentMethod: 'CASH' });
});

it('renders pending invoices without editing controls', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(String(url).includes('/bank-accounts') ? { data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } } : { data: { ...draft, status: 'PENDING', payment: { method: 'CASH', bankAccount: null } } }), { status: 200 }))));
  renderPage(); await screen.findByText('Dòng thu đã khóa'); expect(screen.queryByRole('button', { name: 'Lưu hóa đơn nháp' })).not.toBeInTheDocument(); expect(screen.queryByLabelText('Số tiền (VND)')).not.toBeInTheDocument();
});

it('requires saving draft changes before moving to pending', async () => {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(String(url).includes('/bank-accounts') ? { data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } } : { data: draft }), { status: 200 }))); vi.stubGlobal('fetch', fetch);
  renderPage(); await screen.findByRole('heading', { name: 'Hóa đơn Bé An' }); const transition = screen.getByRole('button', { name: 'Chuyển sang chờ xác nhận' }); await vi.waitFor(() => expect(transition).toBeEnabled()); fireEvent.click(transition);
  expect(screen.getByRole('alert')).toHaveTextContent('Lưu hóa đơn nháp trước khi chuyển sang chờ xác nhận.');
  expect(fetch.mock.calls.some(([url]) => String(url).endsWith(`/invoices/${draft.id}/pending`))).toBe(false);
});

it('shows snapshotted QR payment details and lifecycle controls for pending invoices', async () => {
  const pending = { ...draft, status: 'PENDING', payment: { method: 'TRANSFER', bankAccount: { bankCode: 'VCB', accountNumber: '123456', accountHolderName: 'Cô Hoa' } }, qr: { transferContent: 'Bé An Mầm 1 chuyển tiền', url: 'https://img.vietqr.io/qr.png' } };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: pending }), { status: 200 })));
  renderPage(); await screen.findByRole('img', { name: 'Mã QR chuyển khoản 100 đ' }); expect(screen.getByText('VCB - 123456')).toBeVisible(); expect(screen.getByText('Cô Hoa')).toBeVisible(); expect(screen.getByText('Bé An Mầm 1 chuyển tiền')).toBeVisible(); expect(screen.getByText('Học sinh lúc lập hóa đơn')).toBeVisible(); expect(screen.getByText('Lớp tại thời điểm lập hóa đơn')).toBeVisible(); expect(screen.getByRole('button', { name: 'Chuyển về bản nháp' })).toBeVisible();
});

it('focuses the idle completion dialog, traps Tab, and restores its trigger after Escape', async () => {
  const pending = { ...draft, status: 'PENDING', payment: { method: 'CASH', bankAccount: null } };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: pending }), { status: 200 })));
  renderPage(); const trigger = await screen.findByRole('button', { name: 'Xác nhận đã nhận tiền' }); fireEvent.click(trigger);
  const dialog = within(screen.getByRole('dialog')); const cancel = dialog.getByRole('button', { name: 'Hủy' }); const confirm = dialog.getByRole('button', { name: 'Xác nhận đã nhận tiền' });
  expect(cancel).toHaveFocus(); fireEvent.keyDown(window, { key: 'Tab', shiftKey: true }); expect(confirm).toHaveFocus(); fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
});

it('reconciles a saved completion through 404 and pending without another completion POST', async () => {
  const operationId = 'e2e36687-69b4-4e89-8ec0-141ff397837f';
  const pending = { ...draft, status: 'PENDING', payment: { method: 'CASH', bankAccount: null } };
  const completed = { ...pending, status: 'COMPLETED', completedBy: { id: 'f2e36687-69b4-4e89-8ec0-141ff397837f', displayName: 'Confirmer' }, completedAt: '2026-08-02T00:00:00.000Z' };
  sessionStorage.setItem('anhhoa.pending-invoice-completion', JSON.stringify({ invoiceId: draft.id, operationId }));
  let lookups = 0;
  let terminal = false;
  const fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).includes(`/operations/${operationId}`)) {
      lookups += 1;
      if (lookups === 1) return Promise.resolve(new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 }));
      if (lookups === 2) return Promise.resolve(new Response(JSON.stringify({ data: { operationId, state: 'PENDING' } }), { status: 200 }));
      terminal = true;
      return Promise.resolve(new Response(JSON.stringify({ data: completed }), { status: 200 }));
    }
    void init;
    return Promise.resolve(new Response(JSON.stringify({ data: terminal ? completed : pending }), { status: 200 }));
  });
  vi.stubGlobal('fetch', fetch); renderPage();
  await screen.findByRole('dialog');
  expect(await screen.findByText('Đã hoàn tất', {}, { timeout: 3_000 })).toBeVisible();
  expect((fetch.mock.calls as unknown as [string, RequestInit | undefined][]).filter(([url, init]) => String(url).endsWith('/complete') && init?.method === 'POST')).toHaveLength(0);
  expect(sessionStorage.getItem('anhhoa.pending-invoice-completion')).toBeNull();
});
