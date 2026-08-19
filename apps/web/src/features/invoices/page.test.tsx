import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { resetApiClientForTests } from '../../app/api/client';
import { InvoicesPage } from './page';

afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); });
const schoolClass = { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1', monthlyTuition: 1500000, status: 'ARCHIVED', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', activeStudentCount: 0 };
const invoice = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', billingMonth: '2026-08', student: { name: 'Bé An', nickname: 'An' }, schoolClass: { id: schoolClass.id, name: 'Mầm 1' }, status: 'PENDING', total: 1500000, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' };
const classesResponse = { data: [schoolClass], meta: { page: 1, pageSize: 100, total: 1, pageCount: 1 } };
function responseFor(url: string, invoices = [invoice], meta = { page: 1, pageSize: 20, total: 1, pageCount: 1 }) { return new Response(JSON.stringify(url.includes('/classes?') ? classesResponse : { data: invoices, meta }), { status: 200 }); }
function renderPage(entry = '/hoa-don?month=2026-08') { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]}><InvoicesPage /></MemoryRouter></QueryClientProvider>); }

it('renders snapshots, VND, status text, and URL-driven filters with archived class selection', async () => {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(responseFor(url))); vi.stubGlobal('fetch', fetch);
  renderPage(); expect(await screen.findByRole('table', { name: 'Danh sách hóa đơn tháng 08/2026' })).toBeVisible();
  expect(await screen.findByRole('option', { name: 'Mầm 1 (Đã lưu trữ)' })).toBeVisible(); expect(screen.getByText('1.500.000 đ')).toBeVisible(); expect(screen.getByRole('cell', { name: 'Chờ xác nhận' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Lớp snapshot'), { target: { value: schoolClass.id } });
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes(`classId=${schoolClass.id}`))).toBe(true));
});

it('normalizes a missing month URL before fetching invoices', async () => {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(responseFor(url, [], { page: 1, pageSize: 20, total: 0, pageCount: 1 }))); vi.stubGlobal('fetch', fetch);
  renderPage('/hoa-don'); await screen.findByLabelText('Tháng hóa đơn');
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => String(url).includes('/invoices?'))).toHaveLength(1));
  expect(fetch.mock.calls.find(([url]) => String(url).includes('/invoices?'))![0]).toContain('billingMonth=');
});

it('normalizes an invalid month URL before fetching invoices', async () => {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(responseFor(url, [], { page: 1, pageSize: 20, total: 0, pageCount: 1 }))); vi.stubGlobal('fetch', fetch);
  renderPage('/hoa-don?month=2026-13&page=3'); await screen.findByLabelText('Tháng hóa đơn');
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => String(url).includes('/invoices?'))).toHaveLength(1));
  const invoiceUrl = String(fetch.mock.calls.find(([url]) => String(url).includes('/invoices?'))![0]);
  const now = new Date(); const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  expect(invoiceUrl).toContain(`billingMonth=${currentMonth}`); expect(invoiceUrl).not.toContain('billingMonth=2026-13'); expect(invoiceUrl).not.toContain('page=3');
});

it('resets page when changing every invoice filter', async () => {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(responseFor(url))); vi.stubGlobal('fetch', fetch);
  renderPage('/hoa-don?month=2026-08&page=3'); await screen.findByRole('table', { name: 'Danh sách hóa đơn tháng 08/2026' });
  const expectFirstPageRequest = async (action: () => void, parameter: string) => {
    const requestsBefore = fetch.mock.calls.filter(([url]) => String(url).includes('/invoices?')).length;
    action();
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => String(url).includes('/invoices?')).length).toBeGreaterThan(requestsBefore));
    const invoiceUrl = String(fetch.mock.calls.filter(([url]) => String(url).includes('/invoices?')).at(-1)![0]);
    expect(invoiceUrl).toContain(parameter); expect(invoiceUrl).not.toContain('page=3');
  };
  await expectFirstPageRequest(() => fireEvent.change(screen.getByLabelText('Tháng hóa đơn'), { target: { value: '2026-09' } }), 'billingMonth=2026-09');
  await expectFirstPageRequest(() => fireEvent.change(screen.getByPlaceholderText('Tìm theo tên học sinh'), { target: { value: 'Bé An' } }), 'search=B%C3%A9+An');
  await expectFirstPageRequest(() => fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'PENDING' } }), 'status=PENDING');
  await expectFirstPageRequest(() => fireEvent.change(screen.getByLabelText('Lớp snapshot'), { target: { value: schoolClass.id } }), `classId=${schoolClass.id}`);
});

it('recovers from an out-of-range page instead of presenting it as an empty month', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(responseFor(url, [], { page: 3, pageSize: 20, total: 1, pageCount: 1 }))));
  renderPage('/hoa-don?month=2026-08&page=3'); expect(await screen.findByText('Trang này không còn hóa đơn.')).toBeVisible(); expect(screen.getByRole('button', { name: 'Trước' })).toBeEnabled();
});

it('keeps the selected month and opens the invoice creation workflow', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(responseFor(url, [], { page: 1, pageSize: 20, total: 0, pageCount: 1 }))));
  renderPage(); expect(await screen.findByText('Chưa có hóa đơn trong 08/2026.')).toBeVisible(); expect(screen.getByLabelText('Tháng hóa đơn')).toHaveValue('2026-08'); fireEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn tháng' })); expect(await screen.findByRole('heading', { name: 'Tạo hóa đơn tháng' })).toBeVisible();
});

it('previews the current scope, creates it, and shows the batch result', async () => {
  const fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    void init;
    if (String(url).includes('/auth/csrf')) return Promise.resolve(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 }));
    if (String(url).includes('/invoices/batch-preview')) return Promise.resolve(new Response(JSON.stringify({ data: { eligibleCount: 2, skipped: { inactiveStudent: 0, missingClass: 0, archivedClass: 0, existingInvoice: 0 } } }), { status: 200 }));
    if (String(url).includes('/invoices/batch')) return Promise.resolve(new Response(JSON.stringify({ data: { operationId: 'a2e36687-69b4-4e89-8ec0-141ff397837f', createdCount: 2, skipped: { inactiveStudent: 0, missingClass: 0, archivedClass: 0, existingInvoice: 0 } } }), { status: 200 }));
    return Promise.resolve(responseFor(String(url)));
  }); vi.stubGlobal('fetch', fetch);
  renderPage(); await screen.findByRole('table'); fireEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn tháng' })); fireEvent.click(screen.getByRole('button', { name: 'Xem trước' }));
  expect(await screen.findByText('Có 2 học sinh đủ điều kiện.')).toBeVisible(); fireEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn nháp' })); expect(await screen.findByText('Đã tạo 2 hóa đơn nháp.')).toBeVisible();
  const previewCall = fetch.mock.calls.find(([url]) => String(url).includes('/invoices/batch-preview'))!; const createCall = fetch.mock.calls.find(([url]) => String(url).endsWith('/invoices/batch'))!;
  expect(JSON.parse(previewCall[1]!.body as string)).toEqual({ billingMonth: '2026-08', allActiveClasses: true }); expect(JSON.parse(createCall[1]!.body as string)).toEqual({ billingMonth: '2026-08', allActiveClasses: true });
});

it('clears a zero-eligible preview and keeps creation disabled', async () => {
  const fetch = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('/auth/csrf')) return Promise.resolve(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 }));
    if (String(url).includes('/invoices/batch-preview')) return Promise.resolve(new Response(JSON.stringify({ data: { eligibleCount: 0, skipped: { inactiveStudent: 0, missingClass: 0, archivedClass: 0, existingInvoice: 1 } } }), { status: 200 }));
    return Promise.resolve(responseFor(String(url), [], { page: 1, pageSize: 20, total: 0, pageCount: 1 }));
  }); vi.stubGlobal('fetch', fetch);
  renderPage(); await screen.findByText('Chưa có hóa đơn trong 08/2026.'); fireEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn tháng' })); fireEvent.click(screen.getByRole('button', { name: 'Xem trước' }));
  expect(await screen.findByText('Có 0 học sinh đủ điều kiện.')).toBeVisible(); expect(screen.getByRole('button', { name: 'Tạo hóa đơn nháp' })).toBeDisabled(); fireEvent.change(screen.getByLabelText('Tháng tạo hóa đơn'), { target: { value: '2026-09' } }); expect(screen.queryByText('Có 0 học sinh đủ điều kiện.')).not.toBeInTheDocument();
});
