import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ClassesPage } from './page';
import { resetApiClientForTests } from '../../app/api/client';

afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); });
function renderPage() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/lop']}><ClassesPage /></MemoryRouter></QueryClientProvider>); }
const item = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1', monthlyTuition: 1500000, status: 'ACTIVE', createdAt: '2026-01-01', updatedAt: '2026-01-01', activeStudentCount: 0 };

it('hiển thị bảng lớp cùng trạng thái bằng chữ và học phí VND', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [item], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })));
  renderPage();
  expect(await screen.findByRole('table', { name: 'Danh sách lớp' })).toBeVisible();
  expect(screen.getByText('1.500.000 đ')).toBeVisible();
  expect(screen.getByRole('cell', { name: 'Đang hoạt động' })).toBeVisible();
});

it('giữ form và nêu lỗi khi API từ chối lưu', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Học phí không hợp lệ.' } }), { status: 400 }));
  vi.stubGlobal('fetch', fetch);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm lớp' }));
  fireEvent.change(screen.getByLabelText('Tên lớp'), { target: { value: 'Mầm 1' } });
  fireEvent.change(screen.getByLabelText('Học phí tháng (VND)'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lớp' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Học phí không hợp lệ.');
  expect(screen.getByDisplayValue('Mầm 1')).toBeVisible();
});

it('map lỗi DTO từ server vào từng field liên kết', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Validation failed.', fieldErrors: ['name should not be empty', 'monthlyTuition must not be greater than 9007199254740991'] } }), { status: 400 }));
  vi.stubGlobal('fetch', fetch);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm lớp' }));
  fireEvent.change(screen.getByLabelText('Tên lớp'), { target: { value: 'Mầm 1' } });
  fireEvent.change(screen.getByLabelText('Học phí tháng (VND)'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lớp' }));
  expect(await screen.findByText('name should not be empty')).toHaveAttribute('id', 'class-name-error');
  expect(screen.getByText('monthlyTuition must not be greater than 9007199254740991')).toHaveAttribute('id', 'class-tuition-error');
  expect(screen.getByLabelText('Tên lớp')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Học phí tháng (VND)')).toHaveAttribute('aria-describedby', 'class-tuition-error');
});

it('liên kết lỗi từng field, trả focus về trigger form và hướng dẫn archive bị chặn', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [item], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'CLASS_HAS_ACTIVE_STUDENTS', message: 'Class has active students.', metadata: { activeStudentCount: 2 } } }), { status: 409 }));
  vi.stubGlobal('fetch', fetch);
  renderPage();
  const create = await screen.findByRole('button', { name: 'Thêm lớp' });
  fireEvent.click(create);
  fireEvent.blur(screen.getByLabelText('Tên lớp'));
  fireEvent.blur(screen.getByLabelText('Học phí tháng (VND)'));
  expect(screen.getByLabelText('Tên lớp')).toHaveAttribute('aria-describedby', 'class-name-error');
  expect(screen.getByLabelText('Học phí tháng (VND)')).toHaveAttribute('aria-describedby', 'class-tuition-error');
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  await waitFor(() => expect(create).toHaveFocus());
  fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu trữ' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Lớp còn 2 học sinh đang học. Hãy chuyển lớp hoặc cho nghỉ học các em trước.');
});

it('không cho sửa lớp đã lưu trữ', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ ...item, status: 'ARCHIVED' }], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })));
  renderPage();
  await screen.findByRole('table', { name: 'Danh sách lớp' });
  expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Lưu trữ' })).not.toBeInTheDocument();
});

it('giữ điều hướng quay lại cho trang trống vượt phạm vi có dữ liệu', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { page: 3, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/lop?page=3']}><ClassesPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText('Trang này không còn lớp nào.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Trước' })).toBeEnabled();
});

it('không định dạng học phí vượt JSON safe integer', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })));
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm lớp' }));
  const tuition = screen.getByLabelText('Học phí tháng (VND)');
  fireEvent.change(tuition, { target: { value: '9007199254740992' } });
  fireEvent.blur(tuition);
  expect(tuition).toHaveValue('9007199254740992');
  expect(screen.getByRole('alert')).toHaveTextContent('Học phí phải là số nguyên VND không âm hợp lệ.');
});

it('từ chối resource có timestamp hoặc pagination không hợp lệ', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ ...item, createdAt: 'không phải ngày' }], meta: { page: 1, pageSize: 20, total: 1, pageCount: 2 } }), { status: 200 })));
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh sách lớp.');
});

it('giữ form và hướng dẫn đối soát sau timeout chỉ gửi một write', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => (init.signal as AbortSignal).addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  vi.stubGlobal('fetch', fetch);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm lớp' }));
  fireEvent.change(screen.getByLabelText('Tên lớp'), { target: { value: 'Mầm 1' } });
  fireEvent.change(screen.getByLabelText('Học phí tháng (VND)'), { target: { value: '100' } });
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lớp' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(screen.getByRole('alert')).toHaveTextContent('Hãy làm mới danh sách để đối soát');
  expect(screen.getByDisplayValue('Mầm 1')).toBeVisible();
  expect(fetch).toHaveBeenCalledTimes(3);
  vi.useRealTimers();
});
