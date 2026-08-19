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

it('recovers from an out-of-range page instead of presenting it as an empty month', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(responseFor(url, [], { page: 3, pageSize: 20, total: 1, pageCount: 1 }))));
  renderPage('/hoa-don?month=2026-08&page=3'); expect(await screen.findByText('Trang này không còn hóa đơn.')).toBeVisible(); expect(screen.getByRole('button', { name: 'Trước' })).toBeEnabled();
});

it('keeps the selected month and explains the unavailable creation workflow', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(responseFor(url, [], { page: 1, pageSize: 20, total: 0, pageCount: 1 }))));
  renderPage(); expect(await screen.findByText('Chưa có hóa đơn trong 08/2026.')).toBeVisible(); expect(screen.getByLabelText('Tháng hóa đơn')).toHaveValue('2026-08'); expect(screen.getByRole('button', { name: 'Tạo hóa đơn tháng' })).toBeDisabled(); expect(screen.getByRole('status')).toHaveTextContent('sẽ có ở bước tiếp theo');
});
