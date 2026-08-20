import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { resetApiClientForTests } from '../../app/api/client';
import { StudentsPage } from './page';

afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); vi.useRealTimers(); });
const student = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', fullName: 'Bé An', nickname: 'An', classId: null, class: null, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
function renderPage(entry = '/hoc-sinh') { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]}><StudentsPage /></MemoryRouter></QueryClientProvider>); }

it('hiển thị bảng searchable cùng trạng thái chữ và dữ liệu inactive', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ ...student, status: 'INACTIVE' }], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })));
  renderPage();
  expect(await screen.findByRole('table', { name: 'Danh sách học sinh' })).toBeVisible();
  expect(screen.getByText('Bé An')).toBeVisible();
  expect(screen.getByRole('cell', { name: 'Nghỉ học' })).toBeVisible();
});

it('không gợi ý tạo mới khi bộ lọc học sinh không có kết quả', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })));
  renderPage('/hoc-sinh?status=INACTIVE');
  expect(await screen.findByText('Không tìm thấy học sinh phù hợp.')).toBeVisible();
  expect(screen.getAllByRole('button', { name: 'Thêm học sinh' })).toHaveLength(1);
  expect(screen.getByPlaceholderText('Tìm theo tên hoặc tên gọi')).toBeVisible();
});

it('hiển thị tên Lớp từ class summary', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ ...student, classId: 'b2e36687-69b4-4e89-8ec0-141ff397837f', class: { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1' } }], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })));
  renderPage();
  expect(await screen.findByRole('table', { name: 'Danh sách học sinh' })).toBeVisible();
  expect(screen.getByRole('cell', { name: 'Mầm 1' })).toBeVisible();
});

it('giữ form, map lỗi field và không gửi classId', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Validation failed.', fieldErrors: ['fullName should not be empty'] } }), { status: 400 }));
  vi.stubGlobal('fetch', fetch); renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' }));
  fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Bé An' } });
  fireEvent.change(screen.getByLabelText('Tên gọi (tùy chọn)'), { target: { value: 'An' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu học sinh' }));
  expect(await screen.findByText('fullName should not be empty')).toHaveAttribute('id', 'student-name-error');
  expect(screen.getByDisplayValue('Bé An')).toBeVisible();
  expect((fetch.mock.calls[2]?.[1] as RequestInit).body).toBe(JSON.stringify({ fullName: 'Bé An', nickname: 'An' }));
  expect(screen.queryByLabelText('Lớp hiện tại')).not.toBeInTheDocument();
});

it('gửi null để xóa biệt danh nhưng omit classId không thay đổi', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...student, nickname: null } }), { status: 200 }));
  vi.stubGlobal('fetch', fetch); renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu học sinh' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Tên gọi (tùy chọn)'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu học sinh' }));
  await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(3));
  expect((fetch.mock.calls[3]?.[1] as RequestInit).body).toBe(JSON.stringify({ fullName: 'Bé An', nickname: null }));
});

it('giữ Lớp archived hiện tại và omit classId khi chỉ sửa identity', async () => {
  const archivedStudent = { ...student, status: 'INACTIVE', classId: 'b2e36687-69b4-4e89-8ec0-141ff397837f', class: { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm cũ' } };
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [archivedStudent], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 100, total: 0, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...archivedStudent, fullName: 'Bé An mới' } }), { status: 200 }));
  vi.stubGlobal('fetch', fetch); renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }));
  await waitFor(() => expect(screen.getByRole('option', { name: 'Mầm cũ (đã lưu trữ, chỉ đọc)' })).toBeVisible());
  fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Bé An mới' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu học sinh' }));
  await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(4));
  expect((fetch.mock.calls[3]?.[1] as RequestInit).body).toBe(JSON.stringify({ fullName: 'Bé An mới', nickname: 'An' }));
});

it('chặn submit và cho retry khi không tải được Lớp active', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Request failed.' } }), { status: 500 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 100, total: 0, pageCount: 1 } }), { status: 200 }));
  vi.stubGlobal('fetch', fetch); renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }));
  expect(await screen.findByText('Không thể tải lớp đang hoạt động.')).toBeVisible(); expect(screen.getByRole('button', { name: 'Lưu học sinh' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu học sinh' })).toBeEnabled());
});

it('chỉ cho chọn Lớp active, gửi classId và giữ selection khi API từ chối', async () => {
  const activeClass = { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1', monthlyTuition: 1500000, status: 'ACTIVE', createdAt: student.createdAt, updatedAt: student.updatedAt, activeStudentCount: 0 };
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [activeClass], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'CLASS_ARCHIVED', message: 'Archived classes cannot accept students.' } }), { status: 409 }));
  vi.stubGlobal('fetch', fetch); renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }));
  const picker = await screen.findByLabelText('Lớp hiện tại');
  await waitFor(() => expect(screen.getByRole('option', { name: 'Mầm 1' })).toBeVisible());
  fireEvent.change(picker, { target: { value: activeClass.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu học sinh' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Archived classes cannot accept students.');
  expect(picker).toHaveValue(activeClass.id);
  expect((fetch.mock.calls[3]?.[1] as RequestInit).body).toBe(JSON.stringify({ fullName: 'Bé An', nickname: 'An', classId: activeClass.id }));
});

it('tải toàn bộ các trang Lớp active cho picker', async () => {
  const firstClass = { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1', monthlyTuition: 1500000, status: 'ACTIVE', createdAt: student.createdAt, updatedAt: student.updatedAt, activeStudentCount: 0 };
  const laterClass = { ...firstClass, id: 'c2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 101' };
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [firstClass], meta: { page: 1, pageSize: 100, total: 101, pageCount: 2 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [laterClass], meta: { page: 2, pageSize: 100, total: 101, pageCount: 2 } }), { status: 200 }));
  vi.stubGlobal('fetch', fetch); renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }));
  expect(await screen.findByRole('option', { name: 'Mầm 101' })).toBeVisible();
  expect(fetch.mock.calls[2]?.[0]).toContain('page=2&pageSize=100&status=ACTIVE');
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
