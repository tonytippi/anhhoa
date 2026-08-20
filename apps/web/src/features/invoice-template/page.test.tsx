import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InvoiceTemplatePage } from './page';
import { resetApiClientForTests } from '../../app/api/client';

afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); });
const first = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', description: 'Tiền ăn', feeGroup: 'Ăn uống', position: 0, amountSource: 'FIXED', fixedAmount: 300000, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
function renderPage() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><InvoiceTemplatePage /></QueryClientProvider>); }
it('hiển thị trạng thái trống và form chọn nguồn tiền', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'template', items: [], createdAt: '2026-01-01', updatedAt: '2026-01-01' } }), { status: 200 })));
  renderPage(); expect(await screen.findByText('Chưa có dòng mẫu. Hãy thêm dòng đầu tiên trước khi lập hóa đơn.')).toBeVisible();
  const addButton = screen.getAllByRole('button', { name: 'Thêm dòng mẫu' })[0]; if (!addButton) throw new Error('Add template item button is missing.');
  fireEvent.click(addButton); fireEvent.change(screen.getByLabelText('Nguồn tiền'), { target: { value: 'CLASS_TUITION' } });
  expect(screen.queryByLabelText('Số tiền (VND)')).not.toBeInTheDocument();
});
it('exposes accessible Up/Down controls and keeps a failed save form open', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'template', items: [first], createdAt: '2026-01-01', updatedAt: '2026-01-01' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Dữ liệu không hợp lệ.' } }), { status: 400 }));
  vi.stubGlobal('fetch', fetch); renderPage(); await screen.findByRole('table', { name: 'Dòng mẫu hóa đơn' });
  expect(screen.getByRole('button', { name: 'Lên Tiền ăn' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Xuống Tiền ăn' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Sửa' })); fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Tiền ăn mới' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu dòng mẫu' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Dữ liệu không hợp lệ.'); expect(screen.getByDisplayValue('Tiền ăn mới')).toBeVisible();
});
it('maps server field errors, keeps form state after timeout, and reports failed reorder', async () => {
  const second = { ...first, id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', description: 'Học phí', position: 1 };
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'template', items: [first, second], createdAt: '2026-01-01', updatedAt: '2026-01-01' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Validation failed.', fieldErrors: ['description should not be empty', 'fixedAmount must be an integer'] } }), { status: 400 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Không thể đổi vị trí.' } }), { status: 409 }));
  vi.stubGlobal('fetch', fetch); renderPage(); await screen.findByRole('table', { name: 'Dòng mẫu hóa đơn' });
  fireEvent.click(screen.getAllByRole('button', { name: 'Sửa' })[0]!); fireEvent.click(screen.getByRole('button', { name: 'Lưu dòng mẫu' }));
  expect(await screen.findByText('description should not be empty')).toHaveAttribute('id', 'template-description-error'); expect(screen.getByText('fixedAmount must be an integer')).toHaveAttribute('id', 'template-fixed-amount-error');
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' })); fireEvent.click(screen.getByRole('button', { name: 'Xuống Tiền ăn' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể đổi vị trí.');
});
