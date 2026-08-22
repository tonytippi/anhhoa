import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { pendingInvoices } from './api';
import { App } from './app';

describe('Parent PWA login shell', () => {
  it('shows only the Parent Google sign-in surface when bootstrap is unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 401 })));
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dành cho phụ huynh' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tiếp tục với Google' }).getAttribute('href')).toBe('/api/parent/auth/google');
  });
  it('clears the protected surface and routes to login even when logout fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'parent-1', email: 'parent@example.com', displayName: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'csrf' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 })));
    window.history.pushState({}, '', '/');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('heading', { name: 'Dành cho phụ huynh' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hóa đơn cần thanh toán' })).toBeNull();
  });
});

const parent = { id: 'parent-1', email: 'parent@example.com', displayName: null };
const students = [{ id: 'student-a', fullName: 'Bé An', nickname: 'An' }, { id: 'student-b', fullName: 'Bé Bình', nickname: null }];
const invoice = (id: string, student: string, billingMonth: string, paymentMethod: 'CASH' | 'TRANSFER' = 'TRANSFER') => ({ id, student: { id: student === 'Bé An' ? 'student-a' : 'student-b', name: student, nickname: null }, billingMonth, status: 'PENDING', total: 1500000, paymentMethod });

function mockHome(invoices: ReturnType<typeof invoice>[], visibleStudents = students): void {
  vi.stubGlobal('fetch', vi.fn((input: string) => {
    if (input.endsWith('/parent/me')) return Promise.resolve(new Response(JSON.stringify({ data: parent }), { status: 200 }));
    if (input.endsWith('/parent/students')) return Promise.resolve(new Response(JSON.stringify({ data: visibleStudents }), { status: 200 }));
    const filtered = input.includes('studentId=student-a') ? invoices.filter((entry) => entry.student.name === 'Bé An') : invoices;
    return Promise.resolve(new Response(JSON.stringify({ data: filtered, meta: { page: 1, pageSize: 100, total: filtered.length, pageCount: 1 } }), { status: 200 }));
  }));
}

describe('Parent Home', () => {
  it('groups pending invoices by the newest invoice and filters a selected student', async () => {
    mockHome([invoice('b-1', 'Bé Bình', '2026-08'), invoice('a-1', 'Bé An', '2026-08'), invoice('b-2', 'Bé Bình', '2026-09')]);
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hóa đơn cần thanh toán' })).toBeTruthy();
    await screen.findByRole('heading', { name: 'Bé Bình', level: 2 });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Bé Bình', 'An']);
    expect(screen.getAllByText('Học sinh: Bé Bình')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'An' }));
    expect(await screen.findByRole('heading', { name: 'An', level: 2 })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Bé Bình', level: 2 })).toBeNull());
  });

  it('shows the cash instruction and no substitute cards for an empty response', async () => {
    mockHome([invoice('cash-1', 'Bé An', '2026-08', 'CASH')]);
    window.history.pushState({}, '', '/');
    const { unmount } = render(<App />);
    expect(await screen.findByText('Thanh toán tiền mặt tại nhà trường.')).toBeTruthy();
    expect(screen.getByText('1.500.000 VND')).toBeTruthy();
    unmount();
    mockHome([]);
    render(<App />);
    expect(await screen.findByText('Không còn Hóa đơn cần thanh toán')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem lịch sử' })).toBeTruthy();
    expect(screen.queryByText('Cần thanh toán')).toBeNull();
  });

  it('clears protected Home content when a protected request returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input.endsWith('/parent/me') ? { data: parent } : {}), { status: input.endsWith('/parent/me') ? 200 : 401 }))));
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dành cho phụ huynh' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hóa đơn cần thanh toán' })).toBeNull();
  });

  it('removes a revoked selected student and reloads the remaining protected surface', async () => {
    mockHome([invoice('a-1', 'Bé An', '2026-08'), invoice('b-1', 'Bé Bình', '2026-08')]);
    window.history.pushState({}, '', '/');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'An' }));
    await screen.findByRole('heading', { name: 'An', level: 2 });
    mockHome([invoice('b-1', 'Bé Bình', '2026-08')], [students[1]!]);
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'An' })).toBeNull());
    expect(await screen.findByRole('heading', { name: 'Bé Bình', level: 2 })).toBeTruthy();
  });

  it('loads every pending invoice page before Home groups the result', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [invoice('a-1', 'Bé An', '2026-08')], meta: { page: 1, pageSize: 100, total: 101, pageCount: 2 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [invoice('a-2', 'Bé An', '2026-07')], meta: { page: 2, pageSize: 100, total: 101, pageCount: 2 } }), { status: 200 })));
    await expect(pendingInvoices()).resolves.toHaveLength(2);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toContain('page=2');
  });

  it('keeps cards visible with an update indicator and shows the offline banner once', async () => {
    mockHome([invoice('a-1', 'Bé An', '2026-08')]);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByText('Bạn đang ngoại tuyến. Dữ liệu có thể không mới.')).toBeTruthy();
    expect(await screen.findByText('Học sinh: Bé An')).toBeTruthy();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });
});
