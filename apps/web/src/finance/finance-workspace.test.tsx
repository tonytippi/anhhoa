import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinanceWorkspace } from './finance-workspace';

const catalog = { groups: [], receivables: [] };
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('FinanceWorkspace', () => {
  it('renders loading then empty catalog rows and keeps accessible lifecycle reason errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response(catalog)))); render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect(screen.getAllByText(/Đang tải/).length).toBeGreaterThan(0); await screen.findByText('Chưa có nhóm khoản thu.'); expect(screen.getByText('Chưa có khoản thu.')).toBeTruthy();
  });
  it('reconciles an uncertain HTTP response instead of rendering it as a final error', async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) => options?.method === 'POST' ? Promise.resolve(new Response(null, { status: 503 })) : url.includes('/operations/') ? response({ status: 'PENDING' }) : response(catalog)); vi.stubGlobal('fetch', fetch); render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Tên nhóm'), { target: { value: 'Học phí' } }); fireEvent.submit(screen.getByRole('button', { name: 'Thêm nhóm' }).closest('form')!);
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-finance-operation')).toContain('school-a')); expect(fetch.mock.calls.some(([url]) => url.includes('/operations/'))).toBe(true);
  });
  it('discards a malformed persisted operation without clearing protected context', async () => {
    sessionStorage.setItem('passionedu.app.pending-finance-operation', JSON.stringify({ id: 'bad', schoolId: 'school-a' })); const denied = vi.fn(); vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response(catalog)))); render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={denied} />);
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-finance-operation')).toBeNull()); expect(denied).not.toHaveBeenCalled();
  });
});
