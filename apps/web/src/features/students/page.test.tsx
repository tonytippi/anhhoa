import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { resetApiClientForTests } from '../../app/api/client';
import { StudentsPage } from './page';

afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); vi.useRealTimers(); });
const student = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', fullName: 'Bé An', nickname: 'An', classId: null, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
function renderPage(entry = '/hoc-sinh') { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]}><StudentsPage /></MemoryRouter></QueryClientProvider>); }

it('hiển thị bảng searchable cùng trạng thái chữ và dữ liệu inactive', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ ...student, status: 'INACTIVE' }], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })));
  renderPage();
  expect(await screen.findByRole('table', { name: 'Danh sách học sinh' })).toBeVisible();
  expect(screen.getByText('Bé An')).toBeVisible();
  expect(screen.getByRole('cell', { name: 'Nghỉ học' })).toBeVisible();
});

it('chấp nhận Student resource có classId UUID nhưng không hiển thị hoặc gán Lớp', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ ...student, classId: 'b2e36687-69b4-4e89-8ec0-141ff397837f' }], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })));
  renderPage();
  expect(await screen.findByRole('table', { name: 'Danh sách học sinh' })).toBeVisible();
  expect(screen.queryByText('b2e36687-69b4-4e89-8ec0-141ff397837f')).not.toBeInTheDocument();
});

it('giữ form, map lỗi field và không gửi classId', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Validation failed.', fieldErrors: ['fullName should not be empty'] } }), { status: 400 }));
  vi.stubGlobal('fetch', fetch); renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' }));
  fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Bé An' } });
  fireEvent.change(screen.getByLabelText('Biệt danh (tùy chọn)'), { target: { value: 'An' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu học sinh' }));
  expect(await screen.findByText('fullName should not be empty')).toHaveAttribute('id', 'student-name-error');
  expect(screen.getByDisplayValue('Bé An')).toBeVisible();
  expect((fetch.mock.calls[2]?.[1] as RequestInit).body).toBe(JSON.stringify({ fullName: 'Bé An', nickname: 'An' }));
  expect(screen.getByText('Lớp hiện tại sẽ được quản lý ở Story 2.3.')).toBeVisible();
});

it('gửi null để xóa biệt danh khi sửa học sinh', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...student, nickname: null } }), { status: 200 }));
  vi.stubGlobal('fetch', fetch); renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }));
  fireEvent.change(screen.getByLabelText('Biệt danh (tùy chọn)'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu học sinh' }));
  await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(3));
  expect((fetch.mock.calls[2]?.[1] as RequestInit).body).toBe(JSON.stringify({ fullName: 'Bé An', nickname: null }));
});

it('mở confirmation lifecycle và giữ modal khi mutation lỗi', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Student not found.' } }), { status: 404 }));
  vi.stubGlobal('fetch', fetch); renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Cho nghỉ học' }));
  expect(screen.getByRole('dialog', { name: 'Cho Bé An nghỉ học?' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nghỉ học' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Student not found.');
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('phản hồi ngắn sau khi thay đổi trạng thái thành công', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...student, status: 'INACTIVE' } }), { status: 200 }));
  vi.stubGlobal('fetch', fetch); renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Cho nghỉ học' })); fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nghỉ học' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Bé An đã nghỉ học.');
});

it('giữ form sau timeout và chỉ gửi một write request', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => (init.signal as AbortSignal).addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  vi.stubGlobal('fetch', fetch); renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' })); fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Bé An' } });
  vi.useFakeTimers(); fireEvent.click(screen.getByRole('button', { name: 'Lưu học sinh' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(screen.getByRole('alert')).toHaveTextContent('Hãy làm mới danh sách để đối soát'); expect(screen.getByDisplayValue('Bé An')).toBeVisible(); expect(fetch).toHaveBeenCalledTimes(3);
});

it('hiển thị trang vượt phạm vi có điều hướng trở lại', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { page: 3, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })));
  renderPage('/hoc-sinh?page=3'); expect(await screen.findByText('Trang này không còn học sinh nào.')).toBeVisible(); expect(screen.getByRole('button', { name: 'Trước' })).toBeEnabled();
});

it('trả focus về CTA empty state sau khi đóng form', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })));
  renderPage();
  const create = await screen.findByRole('button', { name: 'Thêm học sinh' });
  fireEvent.click(create);
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
  expect(create).toHaveFocus();
});
