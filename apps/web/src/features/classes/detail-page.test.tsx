import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { resetApiClientForTests } from '../../app/api/client';
import { ClassDetailPage } from './detail-page';

const source = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1', monthlyTuition: 1500000, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', activeStudentCount: 1 };
const destination = { ...source, id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 2', activeStudentCount: 0 };
const student = { id: 'c2e36687-69b4-4e89-8ec0-141ff397837f', fullName: 'Bé An', nickname: null, classId: source.id, class: { id: source.id, name: source.name }, status: 'ACTIVE', createdAt: source.createdAt, updatedAt: source.updatedAt };
afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); sessionStorage.clear(); });
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }); }
function renderPage() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/lop/${source.id}`]}><Routes><Route path="/lop/:id" element={<ClassDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>); }
function mockReads() { return vi.fn((url: string) => {
  if (url.includes(`/classes/${source.id}`)) return Promise.resolve(response({ data: source }));
  if (url.includes('/students?')) return Promise.resolve(response({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }));
  if (url.includes('/classes?')) return Promise.resolve(response({ data: [source, destination], meta: { page: 1, pageSize: 100, total: 2, pageCount: 1 } }));
  return Promise.resolve(response({ data: { csrfToken: 'token' } }));
}); }

it('shows paginated students and active-only transfer confirmation without writing on cancel', async () => {
  const fetch = mockReads(); vi.stubGlobal('fetch', fetch); renderPage();
  expect(await screen.findByRole('heading', { name: 'Mầm 1' })).toBeVisible();
  expect(await screen.findByRole('table', { name: 'Học sinh thuộc lớp' })).toHaveTextContent('Bé An');
  fireEvent.click(screen.getByRole('button', { name: 'Chuyển cả lớp' }));
  expect(await screen.findByRole('dialog', { name: 'Chuyển học sinh đang học' })).toHaveTextContent('Học sinh nghỉ học vẫn ở lại Mầm 1.');
  await waitFor(() => expect(screen.getByRole('option', { name: 'Mầm 2' })).toBeVisible());
  expect(screen.queryByRole('option', { name: 'Mầm 1' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  expect((fetch.mock.calls as unknown as [string, RequestInit | undefined][]).some(([url, init]) => url.includes('/transfer') && init?.method === 'POST')).toBe(false);
});

it('sends one UUID idempotency header and preserves destination while reconciling a timeout', async () => {
  const fetch = mockReads();
  fetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/transfer')) return new Promise((_resolve, reject) => (init?.signal as AbortSignal).addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    if (url.includes('/operations/')) return Promise.resolve(response({ error: { code: 'NOT_FOUND', message: 'Operation not found.' } }, 404));
    if (url.includes(`/classes/${source.id}`)) return Promise.resolve(response({ data: source }));
    if (url.includes('/students?')) return Promise.resolve(response({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }));
    if (url.includes('/classes?')) return Promise.resolve(response({ data: [source, destination], meta: { page: 1, pageSize: 100, total: 2, pageCount: 1 } }));
    return Promise.resolve(response({ data: { csrfToken: 'token' } }));
  });
  vi.stubGlobal('fetch', fetch); renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Chuyển cả lớp' }));
  await waitFor(() => expect(screen.getByRole('option', { name: 'Mầm 2' })).toBeVisible());
  fireEvent.change(screen.getByLabelText('Lớp đích'), { target: { value: destination.id } });
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chuyển' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1_800); });
  vi.useRealTimers();
  expect(await screen.findByRole('alert')).toHaveTextContent('Server xác nhận thao tác chưa được áp dụng');
  const write = (fetch.mock.calls as unknown as [string, RequestInit | undefined][]).find(([url, init]) => url.includes('/transfer') && init?.method === 'POST');
  expect(write?.[1]?.headers).toMatchObject({ 'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/i) });
  expect(screen.getByLabelText('Lớp đích')).toHaveValue(destination.id);
  expect(screen.getByRole('button', { name: 'Gửi lại' })).toBeEnabled();
});

it('keeps a pending operation after reload and reconciles it when it completes', async () => {
  const operationId = '8a04d9b2-2f11-4a77-8e24-4f0a3c20a9bb';
  sessionStorage.setItem('anhhoa.pending-class-transfer', JSON.stringify({ sourceClassId: source.id, destinationClassId: destination.id, operationId }));
  const fetch = mockReads();
  fetch.mockImplementation((url: string) => {
    if (url.includes(`/operations/${operationId}`)) return Promise.resolve(response({ data: { source: { ...source, activeStudentCount: 0 }, destination: { ...destination, activeStudentCount: 1 }, affectedStudentCount: 1, operationId } }));
    if (url.includes(`/classes/${source.id}`)) return Promise.resolve(response({ data: source }));
    if (url.includes('/students?')) return Promise.resolve(response({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }));
    if (url.includes('/classes?')) return Promise.resolve(response({ data: [source, destination], meta: { page: 1, pageSize: 100, total: 2, pageCount: 1 } }));
    return Promise.resolve(response({ data: { csrfToken: 'token' } }));
  });
  vi.stubGlobal('fetch', fetch); renderPage();
  expect(await screen.findByRole('dialog', { name: 'Chuyển học sinh đang học' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại kết quả' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Đã chuyển 1 học sinh sang Mầm 2.');
  expect(sessionStorage.getItem('anhhoa.pending-class-transfer')).toBeNull();
});
