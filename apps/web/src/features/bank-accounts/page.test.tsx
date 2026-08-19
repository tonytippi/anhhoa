import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BankAccountsPage } from './page';
import { resetApiClientForTests } from '../../app/api/client';

const item = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', bankCode: 'VCB', accountNumber: '123456789', accountHolderName: 'Nguyen An', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); window.history.replaceState(null, '', '/tai-khoan-nhan-tien'); });
function renderPage() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BankAccountsPage /></QueryClientProvider>); }

it('hiển thị table có trạng thái bằng chữ và không có thao tác xóa', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [item], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })));
  renderPage();
  expect(await screen.findByRole('table', { name: 'Danh sách tài khoản nhận tiền' })).toBeVisible();
  expect(screen.getByRole('cell', { name: 'Đang hoạt động' })).toBeVisible(); expect(screen.queryByRole('button', { name: /xóa/i })).not.toBeInTheDocument();
});

it('giữ form và lỗi khi write thất bại', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Mã ngân hàng không hợp lệ.' } }), { status: 400 }));
  vi.stubGlobal('fetch', fetch); renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Thêm tài khoản' }));
  fireEvent.change(screen.getByLabelText('Mã ngân hàng VietQR'), { target: { value: 'VCB' } }); fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '123' } }); fireEvent.change(screen.getByLabelText('Tên chủ tài khoản'), { target: { value: 'Nguyen An' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu tài khoản' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Mã ngân hàng không hợp lệ.'); expect(screen.getByDisplayValue('VCB')).toBeVisible();
});

it('hiển thị lỗi cho tất cả field không hợp lệ khi submit', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })));
  renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Thêm tài khoản' })); fireEvent.click(screen.getByRole('button', { name: 'Lưu tài khoản' }));
  for (const [label, key] of [['Mã ngân hàng VietQR', 'bankCode'], ['Số tài khoản', 'accountNumber'], ['Tên chủ tài khoản', 'accountHolderName']] as const) {
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-describedby', `bank-account-${key}-error`);
  }
});

it('đính lỗi field từ API vào input tương ứng', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Validation failed.', fieldErrors: ['bankCode must not be empty', 'accountNumber must not be empty', 'accountHolderName must not be empty'] } }), { status: 400 }));
  vi.stubGlobal('fetch', fetch); renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Thêm tài khoản' }));
  fireEvent.change(screen.getByLabelText('Mã ngân hàng VietQR'), { target: { value: 'VCB' } }); fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '123' } }); fireEvent.change(screen.getByLabelText('Tên chủ tài khoản'), { target: { value: 'Nguyen An' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu tài khoản' }));
  expect(await screen.findByText('bankCode must not be empty')).toHaveAttribute('id', 'bank-account-bankCode-error');
  expect(screen.getByText('accountNumber must not be empty')).toHaveAttribute('id', 'bank-account-accountNumber-error');
  expect(screen.getByLabelText('Tên chủ tài khoản')).toHaveAttribute('aria-describedby', 'bank-account-accountHolderName-error');
});

it('tạo tài khoản đóng form, về trang đầu, và tải lại danh sách', async () => {
  window.history.replaceState(null, '', '/tai-khoan-nhan-tien?page=2');
  const fetch = vi.fn((url: string, init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(url.endsWith('/auth/csrf') ? { data: { csrfToken: 'token' } } : init?.method === 'POST' ? { data: item } : url.includes('page=1') ? { data: [item], meta: { page: 1, pageSize: 20, total: 2, pageCount: 1 } } : { data: [], meta: { page: 2, pageSize: 20, total: 1, pageCount: 1 } }), { status: init?.method === 'POST' ? 201 : 200 })));
  vi.stubGlobal('fetch', fetch); renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Thêm tài khoản' }));
  fireEvent.change(screen.getByLabelText('Mã ngân hàng VietQR'), { target: { value: 'VCB' } }); fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '123' } }); fireEvent.change(screen.getByLabelText('Tên chủ tài khoản'), { target: { value: 'Nguyen An' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu tài khoản' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); await screen.findByRole('table', { name: 'Danh sách tài khoản nhận tiền' });
  expect(window.location.search).toBe(''); expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/bank-accounts?page=1'), expect.anything());
});

it('đọc filters từ URL, phân trang, và đồng bộ popstate', async () => {
  window.history.replaceState(null, '', '/tai-khoan-nhan-tien?search=VCB&status=ACTIVE&page=2');
  const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: [item], meta: { page: 2, pageSize: 20, total: 21, pageCount: 2 } }), { status: 200 })));
  vi.stubGlobal('fetch', fetch); renderPage(); await screen.findByRole('table', { name: 'Danh sách tài khoản nhận tiền' });
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=2&search=VCB&status=ACTIVE'), expect.anything());
  fireEvent.click(screen.getByRole('button', { name: 'Trước' })); await waitFor(() => expect(window.location.search).not.toContain('page='));
  window.history.replaceState(null, '', '/tai-khoan-nhan-tien?search=TCB&page=3'); act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=3&search=TCB'), expect.anything()));
});

it('giữ điều hướng quay lại cho trang trống vượt phạm vi có dữ liệu', async () => {
  window.history.replaceState(null, '', '/tai-khoan-nhan-tien?page=3');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { page: 3, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })));
  renderPage(); expect(await screen.findByText('Trang này không còn tài khoản nào.')).toBeVisible(); expect(screen.getByRole('button', { name: 'Trước' })).toBeEnabled();
});

it('xác nhận ngừng dùng, khóa thao tác và trả focus về trigger', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [item], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...item, status: 'INACTIVE' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ ...item, status: 'INACTIVE' }], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 }));
  vi.stubGlobal('fetch', fetch); renderPage(); const trigger = await screen.findByRole('button', { name: 'Ngừng dùng' }); fireEvent.click(trigger); fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ngừng dùng' })); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); await waitFor(() => expect(trigger).toHaveFocus());
});
